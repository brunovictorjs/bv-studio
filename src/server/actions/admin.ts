import { z } from "zod";
import { orderDuration } from "@/lib/domain/rules";
import { L, normalize } from "@/lib/domain/text";
import { addMinutes, datePart, epochMin, weekday } from "@/lib/domain/time";
import type { DB, Order, RequestCtx, Role, Unit, User, WeekHours } from "@/lib/domain/types";
import { actor, fail, fullName, getUnit, getUser, must, requireRole, requireUnitStaff, type ActionFn } from "../core";
import { uid } from "../ids";
import { canFit } from "../scheduling";

const ltext = z.union([z.string(), z.object({ pt: z.string(), en: z.string() })]);
const time = z.string().regex(/^\d{2}:\d{2}$/);
const dayHours = z.object({
  open: z.boolean(),
  start: time,
  end: time,
  breakStart: time.nullable().optional(),
  breakEnd: time.nullable().optional(),
});
const week = z.array(dayHours).length(7);

function validateWeek(w: WeekHours) {
  w.forEach((d) => {
    if (!d.open) return;
    if (d.end <= d.start) fail("hours_end_before_start");
    if (d.breakStart && d.breakEnd && (d.breakEnd <= d.breakStart || d.breakStart < d.start || d.breakEnd > d.end)) fail("break_outside_hours");
  });
}

/** Future bookings that would no longer fit the agenda once a rule changes. */
function futureConflicts(db: DB, ctx: RequestCtx, filter: (o: Order) => boolean): Order[] {
  return db.orders.filter(
    (o) => o.start && ["paid", "awaiting_payment"].includes(o.status) && epochMin(o.start) > epochMin(ctx.now) && filter(o),
  );
}

const conflictList = (orders: Order[]) =>
  orders.slice(0, 6).map((o) => ({ id: o.id, code: o.code, client: o.clientName, start: o.start! }));

// ------------------------------------------------------------------ units

const unitSchema = z.object({
  id: z.string().nullable(),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: ltext,
  kind: ltext,
  audience: z.enum(["female", "male", "unisex"]),
  tagline: ltext,
  phone: z.string(),
  whatsapp: z.string(),
  instagram: z.string(),
  address: z.string(),
  district: z.string(),
  city: z.string(),
  zip: z.string(),
  coords: z.string(),
  active: z.boolean(),
  chairs: z.number().int().min(1).max(50),
  hours: week,
  closures: z.array(z.object({ id: z.string(), start: z.string(), end: z.string(), label: ltext })),
  lateToleranceMin: z.number().int().min(0).max(240),
  holdMinutes: z.number().int().min(5).max(60),
});

export const unitSave: ActionFn = (db, raw, ctx) => {
  requireRole(db, ctx, "admin");
  const input = unitSchema.parse(raw);
  validateWeek(input.hours);
  if (db.units.some((u) => u.slug === input.slug && u.id !== input.id)) fail("slug_taken");
  input.closures.forEach((c) => c.end < c.start && fail("end_before_start"));
  if (input.id) {
    const unit = getUnit(db, input.id);
    // bookings that fall outside the new opening hours or closures
    const conflicts = futureConflicts(db, ctx, (o) => {
      if (o.unitId !== unit.id) return false;
      const d = datePart(o.start!);
      if (input.closures.some((c) => d >= c.start && d <= c.end)) return true;
      const h = input.hours[weekday(d)];
      if (!h.open) return true;
      const t = o.start!.slice(11);
      const end = addMinutes(o.start!, orderDuration(o)).slice(11);
      return t < h.start || end > h.end;
    });
    if (conflicts.length) fail("unit_hours_conflict", { count: conflicts.length, list: JSON.stringify(conflictList(conflicts)) });
    Object.assign(unit, { ...input, id: unit.id });
    return { id: unit.id };
  }
  const base = db.units[0];
  const unit: Unit = {
    ...input,
    id: uid("u"),
    whatsappConnected: false,
    whatsappInstance: `bv-${input.slug}`,
    ai: structuredClone(base.ai),
  };
  db.units.push(unit);
  return { id: unit.id };
};

export const unitCatalogToggle: ActionFn = (db, raw, ctx) => {
  requireRole(db, ctx, "admin");
  const input = z
    .object({ unitId: z.string(), kind: z.enum(["service", "product"]), refId: z.string(), on: z.boolean(), price: z.number().int().nullable().optional() })
    .parse(raw);
  getUnit(db, input.unitId);
  if (input.kind === "service") {
    const s = must(db.services.find((x) => x.id === input.refId));
    const link = s.units.find((u) => u.unitId === input.unitId);
    if (input.on && !link) s.units.push({ unitId: input.unitId, price: input.price ?? null, professionalIds: [] });
    else if (!input.on && link) {
      const pending = futureConflicts(db, ctx, (o) => o.unitId === input.unitId && o.items.some((i) => i.refId === s.id));
      if (pending.length) fail("service_has_bookings", { count: pending.length });
      s.units = s.units.filter((u) => u.unitId !== input.unitId);
    } else if (link && input.price !== undefined) link.price = input.price;
  } else {
    const p = must(db.products.find((x) => x.id === input.refId));
    const link = p.units.find((u) => u.unitId === input.unitId);
    if (input.on && !link) p.units.push({ unitId: input.unitId, price: input.price ?? null });
    else if (!input.on && link) p.units = p.units.filter((u) => u.unitId !== input.unitId);
    else if (link && input.price !== undefined) link.price = input.price;
  }
  return { ok: true };
};

export const unitWhatsapp: ActionFn = (db, raw, ctx) => {
  requireRole(db, ctx, "admin");
  const input = z.object({ unitId: z.string(), connected: z.boolean() }).parse(raw);
  getUnit(db, input.unitId).whatsappConnected = input.connected;
  return { ok: true };
};

export const aiSave: ActionFn = (db, raw, ctx) => {
  requireRole(db, ctx, "admin");
  const input = z
    .object({
      unitId: z.string(),
      ai: z.object({
        assistantName: ltext,
        answers: z.object({ orders: z.boolean(), catalog: z.boolean(), slots: z.boolean(), info: z.boolean() }),
        forwardTopics: z.array(ltext),
        notifyWho: ltext,
        alertAfterMin: z.number().int().min(1).max(240),
        reminder1: ltext,
        reminder2: ltext,
        lateNotice: z.boolean(),
        afterHours: ltext,
        greeting: ltext,
      }),
    })
    .parse(raw);
  getUnit(db, input.unitId).ai = input.ai;
  return { ok: true };
};

// ------------------------------------------------------------------ people

export const userInvite: ActionFn = (db, raw, ctx) => {
  requireRole(db, ctx, "admin");
  const input = z
    .object({
      email: z.string().email(),
      firstName: z.string().trim().min(1),
      lastName: z.string().trim(),
      roles: z.array(z.enum(["admin", "desk", "professional"])).min(1),
      unitId: z.string().nullable(),
    })
    .parse(raw);
  if (db.users.some((u) => u.email.toLowerCase() === input.email.toLowerCase() && !u.roles.includes("client"))) fail("email_taken");
  const needsUnit = input.roles.some((r) => r === "desk" || r === "professional");
  if (needsUnit && !input.unitId) fail("unit_required_for_role");
  if (input.unitId) getUnit(db, input.unitId);
  const u: User = {
    id: uid("p"),
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: "",
    roles: input.roles as Role[],
    unitId: needsUnit ? input.unitId : null,
    about: "",
    since: datePart(ctx.now),
    status: "invited",
    commission: input.roles.includes("professional")
      ? { exec: db.settings.commissions.defaultExec, product: db.settings.commissions.defaultProduct }
      : null,
    schedule: null,
    periods: [],
    favorites: { services: [], products: [], professionals: [] },
  };
  db.users.push(u);
  db.settings.notifications.log.unshift({ id: uid("lg"), ok: true, channel: "email", label: L("Convite", "Invitation"), to: u.email, at: ctx.now });
  return { id: u.id };
};

export const userUpdate: ActionFn = (db, raw, ctx) => {
  const me = actor(db, ctx);
  const input = z
    .object({
      id: z.string(),
      firstName: z.string().trim().min(1).optional(),
      lastName: z.string().trim().optional(),
      phone: z.string().optional(),
      about: z.string().max(400).optional(),
      roles: z.array(z.enum(["admin", "desk", "professional", "client"])).min(1).optional(),
      commission: z.object({ exec: z.number().min(0).max(100), product: z.number().min(0).max(100) }).nullable().optional(),
    })
    .parse(raw);
  const u = getUser(db, input.id);
  const self = me.id === u.id;
  if (!self && !me.roles.includes("admin")) fail("forbidden");
  if ((input.roles || input.commission !== undefined) && !me.roles.includes("admin")) fail("forbidden");
  if (input.roles && self && !input.roles.includes("admin") && u.roles.includes("admin")) fail("cannot_remove_own_admin");
  if (input.firstName !== undefined) u.firstName = input.firstName;
  if (input.lastName !== undefined) u.lastName = input.lastName;
  if (input.phone !== undefined) u.phone = input.phone;
  if (input.about !== undefined) u.about = input.about;
  if (input.roles) u.roles = input.roles as Role[];
  if (input.commission !== undefined) u.commission = input.commission;
  return { ok: true };
};

export const userSetStatus: ActionFn = (db, raw, ctx) => {
  const me = requireRole(db, ctx, "admin");
  const input = z.object({ id: z.string(), status: z.enum(["active", "disabled", "invited"]) }).parse(raw);
  const u = getUser(db, input.id);
  if (u.id === me.id) fail("cannot_disable_self");
  if (input.status === "disabled" && u.roles.includes("professional")) {
    const pending = futureConflicts(db, ctx, (o) => o.professionalId === u.id);
    if (pending.length) fail("pro_has_bookings", { count: pending.length, list: JSON.stringify(conflictList(pending)) });
  }
  u.status = input.status;
  return { ok: true };
};

export const userTransfer: ActionFn = (db, raw, ctx) => {
  requireRole(db, ctx, "admin");
  const input = z.object({ id: z.string(), unitId: z.string() }).parse(raw);
  const u = getUser(db, input.id);
  getUnit(db, input.unitId);
  if (u.unitId === input.unitId) return { ok: true };
  const pending = futureConflicts(db, ctx, (o) => o.professionalId === u.id);
  if (pending.length) fail("pro_has_bookings", { count: pending.length, list: JSON.stringify(conflictList(pending)) });
  // the old unit's services stop listing this person
  db.services.forEach((s) => s.units.forEach((l) => (l.professionalIds = l.professionalIds.filter((p) => p !== u.id))));
  u.unitId = input.unitId;
  return { ok: true };
};

export const teamSaveSchedule: ActionFn = (db, raw, ctx) => {
  const input = z.object({ userId: z.string(), schedule: week.nullable() }).parse(raw);
  const u = getUser(db, input.userId);
  if (!u.unitId) fail("user_without_unit");
  requireUnitStaff(db, ctx, u.unitId!);
  if (input.schedule) validateWeek(input.schedule);
  const unit = getUnit(db, u.unitId!);
  const before = u.schedule;
  u.schedule = input.schedule;
  const conflicts = futureConflicts(
    db,
    ctx,
    (o) => o.professionalId === u.id && !canFit(db, u, unit, o.start!, orderDuration(o), { excludeId: o.id }),
  );
  if (conflicts.length) {
    u.schedule = before;
    fail("schedule_conflict", { name: u.firstName, count: conflicts.length, list: JSON.stringify(conflictList(conflicts)) });
  }
  return { ok: true };
};

export const teamAddPeriod: ActionFn = (db, raw, ctx) => {
  const input = z
    .object({
      userId: z.string(),
      id: z.string().nullable(),
      type: z.enum(["closed", "extra"]),
      start: z.string(),
      end: z.string(),
      label: ltext,
    })
    .parse(raw);
  const u = getUser(db, input.userId);
  requireUnitStaff(db, ctx, u.unitId!);
  if (epochMin(input.end) <= epochMin(input.start)) fail("end_before_start");
  if (input.type === "extra" && datePart(input.start) !== datePart(input.end)) fail("extra_same_day");
  if (input.type === "closed") {
    const conflicts = futureConflicts(
      db,
      ctx,
      (o) =>
        o.professionalId === u.id &&
        epochMin(o.start!) < epochMin(input.end) &&
        epochMin(input.start) < epochMin(o.start!) + orderDuration(o),
    );
    if (conflicts.length) fail("period_conflict", { name: u.firstName, count: conflicts.length, list: JSON.stringify(conflictList(conflicts)) });
  }
  const period = { id: input.id ?? uid("per"), type: input.type, start: input.start, end: input.end, label: input.label };
  u.periods = [...u.periods.filter((p) => p.id !== period.id), period].sort((a, b) => a.start.localeCompare(b.start));
  return { id: period.id };
};

export const teamRemovePeriod: ActionFn = (db, raw, ctx) => {
  const input = z.object({ userId: z.string(), periodId: z.string() }).parse(raw);
  const u = getUser(db, input.userId);
  requireUnitStaff(db, ctx, u.unitId!);
  const p = must(u.periods.find((x) => x.id === input.periodId));
  if (p.type === "extra") {
    const conflicts = futureConflicts(
      db,
      ctx,
      (o) => o.professionalId === u.id && epochMin(o.start!) >= epochMin(p.start) && epochMin(o.start!) < epochMin(p.end),
    );
    if (conflicts.length) fail("period_conflict", { name: u.firstName, count: conflicts.length, list: JSON.stringify(conflictList(conflicts)) });
  }
  u.periods = u.periods.filter((x) => x.id !== p.id);
  return { ok: true };
};

// ------------------------------------------------------------------ settings

export const settingsSave: ActionFn = (db, raw, ctx) => {
  requireRole(db, ctx, "admin");
  const input = z.object({ section: z.enum(["company", "payment", "commissions", "notifications"]), value: z.record(z.string(), z.unknown()) }).parse(raw);
  const s = db.settings;
  if (input.section === "company") {
    const v = z
      .object({
        name: z.string().min(1),
        legalName: z.string(),
        taxId: z.string(),
        cityReg: z.string(),
        email: z.string().email(),
        instagram: z.string(),
        domain: z.string().min(3),
        currency: z.enum(["auto", "BRL", "USD", "EUR"]),
      })
      .parse(input.value);
    s.company = v;
  } else if (input.section === "payment") {
    const v = z
      .object({
        methods: z.object({ pix: z.boolean(), credit: z.boolean(), debit: z.boolean(), cash: z.boolean(), boleto: z.boolean() }),
        installments: z.number().int().min(1).max(12),
        minInstallment: z.number().int().min(0),
        cancelFee: z.number().int().min(0),
        autoRefund: z.boolean(),
        adminLateRefund: z.boolean(),
      })
      .parse(input.value);
    if (!v.methods.pix && !v.methods.credit && !v.methods.debit && !v.methods.cash) fail("one_method_required");
    Object.assign(s.payment, v);
  } else if (input.section === "commissions") {
    const v = z
      .object({
        defaultExec: z.number().min(0).max(100),
        defaultProduct: z.number().min(0).max(100),
        exceptions: z.array(z.object({ id: z.string(), unitId: z.string(), categoryId: z.string(), pct: z.number().min(0).max(100), reason: ltext })),
        rules: z.object({
          completed: z.boolean(),
          noShow: z.boolean(),
          lateFit: z.boolean(),
          refunded: z.boolean(),
          productByPro: z.boolean(),
          productOnline: z.boolean(),
        }),
        pros: z.array(z.object({ id: z.string(), exec: z.number().min(0).max(100), product: z.number().min(0).max(100) })).optional(),
      })
      .parse(input.value);
    const keys = new Set<string>();
    v.exceptions.forEach((e) => {
      const k = `${e.unitId}:${e.categoryId}`;
      if (keys.has(k)) fail("exception_duplicate");
      keys.add(k);
    });
    s.commissions.defaultExec = v.defaultExec;
    s.commissions.defaultProduct = v.defaultProduct;
    s.commissions.exceptions = v.exceptions;
    s.commissions.rules = v.rules;
    v.pros?.forEach((p) => {
      const u = getUser(db, p.id);
      u.commission = { exec: p.exec, product: p.product };
    });
  } else {
    const v = z
      .object({
        matrix: z.record(z.string(), z.record(z.string(), z.boolean())),
        senderName: z.string().min(1),
        replyTo: z.string().email(),
      })
      .parse(input.value);
    // low ratings always reach the admin
    v.matrix.review = { ...v.matrix.review, admin: true };
    s.notifications.matrix = v.matrix as typeof s.notifications.matrix;
    s.notifications.senderName = v.senderName;
    s.notifications.replyTo = v.replyTo;
  }
  return { ok: true };
};

export const notifyTest: ActionFn = (db, raw, ctx) => {
  const me = requireRole(db, ctx, "admin");
  const input = z.object({ channel: z.enum(["email", "whatsapp"]) }).parse(raw);
  db.settings.notifications.log.unshift({
    id: uid("lg"),
    ok: true,
    channel: input.channel,
    label: L("Mensagem de teste", "Test message"),
    to: input.channel === "email" ? me.email : me.phone || fullName(me),
    at: ctx.now,
  });
  return { ok: true };
};

export const policySave: ActionFn = (db, raw, ctx) => {
  const me = requireRole(db, ctx, "admin");
  const input = z.object({ doc: z.enum(["terms", "privacy"]), draft: z.string().min(10), publish: z.boolean() }).parse(raw);
  const p = db.settings.policies[input.doc];
  p.draft = input.draft;
  p.editedBy = fullName(me);
  p.editedAt = ctx.now;
  if (input.publish) {
    p.version += 1;
    p.published = input.draft;
    p.publishedAt = datePart(ctx.now);
    p.acceptances = 0;
    p.history.push({ version: p.version, publishedAt: p.publishedAt });
  }
  return { version: p.version };
};

// ------------------------------------------------------------------ client account

export const clientSignIn: ActionFn = (db, raw, ctx) => {
  const input = z.object({ mode: z.enum(["demo", "new"]), email: z.string().email().optional(), name: z.string().optional() }).parse(raw);
  if (input.mode === "demo") {
    const u = must(db.users.find((x) => x.email === "mariana.lopes@gmail.com"));
    return { clientId: u.id, isNew: false };
  }
  const email = input.email ?? `visitante.${Math.floor(Math.random() * 9999)}@gmail.com`;
  const existing = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase() && u.roles.includes("client"));
  if (existing) return { clientId: existing.id, isNew: false };
  const [firstName, ...rest] = (input.name ?? "").trim().split(/\s+/);
  const u: User = {
    id: uid("cl"),
    firstName: firstName || "",
    lastName: rest.join(" "),
    email,
    phone: "",
    roles: ["client"],
    unitId: null,
    about: "",
    since: datePart(ctx.now),
    status: "active",
    commission: null,
    schedule: null,
    periods: [],
    favorites: { services: [], products: [], professionals: [] },
    acceptedTermsVersion: db.settings.policies.terms.version,
  };
  db.users.push(u);
  return { clientId: u.id, isNew: true };
};

export const clientUpdateProfile: ActionFn = (db, raw, ctx) => {
  const me = actor(db, ctx);
  const input = z
    .object({
      firstName: z.string().trim().min(1).optional(),
      lastName: z.string().trim().min(1).optional(),
      phone: z
        .string()
        .regex(/^[\d\s()+-]{8,}$/)
        .optional(),
      about: z.string().max(400).optional(),
      preferredUnitId: z.string().optional(),
      acceptTerms: z.boolean().optional(),
    })
    .parse(raw);
  if (input.phone && db.users.some((u) => u.id !== me.id && u.roles.includes("client") && normalize(u.phone) === normalize(input.phone!)))
    fail("phone_taken");
  Object.assign(me, {
    ...(input.firstName !== undefined && { firstName: input.firstName }),
    ...(input.lastName !== undefined && { lastName: input.lastName }),
    ...(input.phone !== undefined && { phone: input.phone }),
    ...(input.about !== undefined && { about: input.about }),
    ...(input.preferredUnitId !== undefined && { preferredUnitId: input.preferredUnitId }),
  });
  if (input.acceptTerms) me.acceptedTermsVersion = db.settings.policies.terms.version;
  return { ok: true };
};

export const clientToggleFavorite: ActionFn = (db, raw, ctx) => {
  const me = actor(db, ctx);
  const input = z.object({ kind: z.enum(["services", "products", "professionals"]), id: z.string() }).parse(raw);
  if (input.kind === "services") {
    const s = must(db.services.find((x) => x.id === input.id));
    if (!s.allowFavorites) fail("favorites_disabled");
  }
  const list = me.favorites[input.kind];
  me.favorites[input.kind] = list.includes(input.id) ? list.filter((x) => x !== input.id) : [...list, input.id];
  return { favorite: me.favorites[input.kind].includes(input.id) };
};

