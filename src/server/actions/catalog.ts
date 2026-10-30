import { z } from "zod";
import { offerState } from "@/lib/domain/rules";
import { datePart } from "@/lib/domain/time";
import type { Category, LText, Offer, Product, Service } from "@/lib/domain/types";
import { fail, must, requireRole, requireUnitStaff, type ActionFn } from "../core";
import { uid } from "../ids";

const ltext = z.union([z.string(), z.object({ pt: z.string(), en: z.string() })]);
const cents = z.number().int().nonnegative();
const textOf = (t: LText) => (typeof t === "string" ? t : t.pt);

const serviceSchema = z.object({
  id: z.string().nullable(),
  name: ltext,
  categoryId: z.string().min(1),
  price: cents,
  durationMin: z.number().int().min(5).max(600),
  summary: ltext,
  description: ltext,
  media: z.number().int().min(0).max(12),
  isNew: z.boolean(),
  allowFavorites: z.boolean(),
  units: z.array(z.object({ unitId: z.string(), price: cents.nullable().optional(), professionalIds: z.array(z.string()) })),
  publish: z.boolean(),
});

export const serviceSave: ActionFn = (db, raw, ctx) => {
  requireRole(db, ctx, "admin");
  const input = serviceSchema.parse(raw);
  if (!textOf(input.name).trim()) fail("name_required");
  if (textOf(input.summary).length > 160) fail("summary_too_long");
  const cat = db.categories.find((c) => c.id === input.categoryId && c.kind === "service");
  if (!cat) fail("category_not_found");
  for (const link of input.units) {
    const unitPros = db.users.filter((u) => u.unitId === link.unitId && u.roles.includes("professional")).map((u) => u.id);
    if (link.professionalIds.some((p) => !unitPros.includes(p))) fail("pro_not_in_unit");
    if (input.publish && link.professionalIds.length === 0) {
      const unit = db.units.find((u) => u.id === link.unitId);
      fail("publish_needs_pro", { unit: unit ? textOf(unit.name) : link.unitId });
    }
  }
  if (input.publish && input.units.length === 0) fail("publish_needs_unit");
  const existing = input.id ? db.services.find((s) => s.id === input.id) : undefined;
  const data: Omit<Service, "id" | "soldCount" | "status"> = {
    name: input.name,
    categoryId: input.categoryId,
    price: input.price,
    durationMin: input.durationMin,
    summary: input.summary,
    description: input.description,
    media: input.media,
    isNew: input.isNew,
    allowFavorites: input.allowFavorites,
    units: input.units.map((u) => ({ unitId: u.unitId, price: u.price ?? null, professionalIds: u.professionalIds })),
  };
  if (existing) {
    Object.assign(existing, data);
    existing.status = input.publish ? "active" : existing.status === "archived" ? "archived" : "draft";
    return { id: existing.id };
  }
  const s: Service = { id: uid("s"), soldCount: 0, status: input.publish ? "active" : "draft", ...data };
  db.services.push(s);
  return { id: s.id };
};

export const serviceSetStatus: ActionFn = (db, raw, ctx) => {
  requireRole(db, ctx, "admin");
  const input = z.object({ id: z.string(), status: z.enum(["active", "draft", "archived"]) }).parse(raw);
  const s = must(db.services.find((x) => x.id === input.id));
  if (input.status === "active" && (s.units.length === 0 || s.units.some((u) => u.professionalIds.length === 0))) fail("publish_needs_pro", { unit: "" });
  s.status = input.status;
  return { ok: true };
};

const productSchema = z.object({
  id: z.string().nullable(),
  name: ltext,
  categoryId: z.string(),
  price: cents,
  detail: ltext,
  badge: ltext.nullable(),
  description: ltext,
  media: z.number().int().min(0).max(8),
  available: z.boolean(),
  sellOnline: z.boolean(),
  staffCanAdd: z.boolean(),
  units: z.array(z.object({ unitId: z.string(), price: cents.nullable().optional() })),
});

export const productSave: ActionFn = (db, raw, ctx) => {
  requireRole(db, ctx, "admin");
  const input = productSchema.parse(raw);
  if (!textOf(input.name).trim()) fail("name_required");
  if (!db.categories.some((c) => c.id === input.categoryId && c.kind === "product")) fail("category_not_found");
  const existing = input.id ? db.products.find((p) => p.id === input.id) : undefined;
  const data = { ...input, units: input.units.map((u) => ({ unitId: u.unitId, price: u.price ?? null })) };
  if (existing) {
    Object.assign(existing, { ...data, id: existing.id });
    return { id: existing.id };
  }
  const p: Product = { ...data, id: uid("pr"), soldOnline: 0, soldByStaff: 0 };
  db.products.push(p);
  return { id: p.id };
};

export const productToggle: ActionFn = (db, raw, ctx) => {
  requireRole(db, ctx, "admin");
  const input = z.object({ id: z.string(), available: z.boolean() }).parse(raw);
  must(db.products.find((p) => p.id === input.id)).available = input.available;
  return { ok: true };
};

const itemCount = (db: Parameters<ActionFn>[0], c: Category) =>
  c.kind === "service"
    ? db.services.filter((s) => s.categoryId === c.id && s.status !== "archived").length
    : db.products.filter((p) => p.categoryId === c.id).length;

export const categorySave: ActionFn = (db, raw, ctx) => {
  requireRole(db, ctx, "admin");
  const input = z.object({ id: z.string().nullable(), kind: z.enum(["service", "product"]), name: ltext, special: z.boolean().optional() }).parse(raw);
  if (!textOf(input.name).trim()) fail("name_required");
  const dup = db.categories.find(
    (c) => c.kind === input.kind && c.id !== input.id && textOf(c.name).toLowerCase() === textOf(input.name).toLowerCase(),
  );
  if (dup) fail("category_exists");
  if (input.id) {
    const c = must(db.categories.find((x) => x.id === input.id));
    if (c.kind !== input.kind && itemCount(db, c) > 0) fail("category_has_items");
    c.name = input.name;
    c.kind = input.kind;
    c.special = input.special ?? c.special;
    return { id: c.id };
  }
  const order = Math.max(0, ...db.categories.filter((c) => c.kind === input.kind).map((c) => c.order)) + 1;
  const c: Category = { id: uid("c"), kind: input.kind, name: input.name, order, special: input.special };
  db.categories.push(c);
  return { id: c.id };
};

export const categoryMove: ActionFn = (db, raw, ctx) => {
  requireRole(db, ctx, "admin");
  const input = z.object({ id: z.string(), dir: z.union([z.literal(-1), z.literal(1)]) }).parse(raw);
  const c = must(db.categories.find((x) => x.id === input.id));
  const list = db.categories.filter((x) => x.kind === c.kind).sort((a, b) => a.order - b.order);
  const i = list.indexOf(c);
  const j = i + input.dir;
  if (j < 0 || j >= list.length) return { ok: false };
  [list[i], list[j]] = [list[j], list[i]];
  list.forEach((x, k) => (x.order = k + 1));
  return { ok: true };
};

export const categoryDelete: ActionFn = (db, raw, ctx) => {
  requireRole(db, ctx, "admin");
  const input = z.object({ id: z.string() }).parse(raw);
  const c = must(db.categories.find((x) => x.id === input.id));
  if (itemCount(db, c) > 0) fail("category_has_items");
  db.categories = db.categories.filter((x) => x.id !== c.id);
  return { ok: true };
};

const offerSchema = z.object({
  id: z.string().nullable(),
  unitId: z.string(),
  name: ltext,
  type: z.enum(["percent", "fixed"]),
  value: z.number().positive(),
  usageLimit: z.number().int().positive().nullable(),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1),
  serviceIds: z.array(z.string()).min(1),
});

/** Services already in another active/scheduled offer of the same unit with overlapping dates. */
export function servicesTaken(db: Parameters<ActionFn>[0], unitId: string, start: string, end: string, today: string, excludeId?: string | null) {
  const taken = new Map<string, Offer>();
  for (const o of db.offers) {
    if (o.id === excludeId || o.unitId !== unitId || offerState(o, today) === "ended") continue;
    if (o.start > end || o.end < start) continue;
    o.serviceIds.forEach((s) => taken.set(s, o));
  }
  return taken;
}

export const offerSave: ActionFn = (db, raw, ctx) => {
  requireRole(db, ctx, "admin");
  const input = offerSchema.parse(raw);
  if (!textOf(input.name).trim()) fail("name_required");
  if (input.end < input.start) fail("end_before_start");
  if (input.type === "percent" && input.value > 90) fail("discount_too_high");
  const today = datePart(ctx.now);
  for (const sid of input.serviceIds) {
    const s = must(db.services.find((x) => x.id === sid));
    if (!s.units.some((u) => u.unitId === input.unitId)) fail("service_not_in_unit");
  }
  const taken = servicesTaken(db, input.unitId, input.start, input.end, today, input.id);
  const clash = input.serviceIds.find((s) => taken.has(s));
  if (clash) fail("service_in_other_offer", { offer: textOf(taken.get(clash)!.name) });
  const unit = must(db.units.find((u) => u.id === input.unitId));
  const openDays = input.weekdays.filter((d) => unit.hours[d]?.open);
  if (openDays.length === 0) fail("offer_days_closed");
  if (input.id) {
    const o = must(db.offers.find((x) => x.id === input.id));
    Object.assign(o, { ...input, id: o.id });
    return { id: o.id };
  }
  const o: Offer = { ...input, id: uid("of"), uses: 0, endedAt: null };
  db.offers.push(o);
  return { id: o.id };
};

export const offerEnd: ActionFn = (db, raw, ctx) => {
  requireRole(db, ctx, "admin");
  const input = z.object({ id: z.string() }).parse(raw);
  const o = must(db.offers.find((x) => x.id === input.id));
  o.endedAt = ctx.now;
  return { ok: true };
};

export const reviewReply: ActionFn = (db, raw, ctx) => {
  const input = z.object({ id: z.string(), text: z.string().trim() }).parse(raw);
  const r = must(db.reviews.find((x) => x.id === input.id));
  const me = requireUnitStaff(db, ctx, r.unitId);
  r.reply = input.text ? { text: input.text, by: me.id, at: ctx.now } : null;
  return { ok: true };
};

export const reviewToggleHome: ActionFn = (db, raw, ctx) => {
  const input = z.object({ id: z.string() }).parse(raw);
  const r = must(db.reviews.find((x) => x.id === input.id));
  requireUnitStaff(db, ctx, r.unitId);
  if (!r.onHome) {
    const eligible = r.serviceRating === 5 && (r.proRating ?? 5) === 5 && textOf(r.text).trim().length > 0 && !!r.serviceId;
    if (!eligible) fail("review_not_eligible_home");
  }
  r.onHome = !r.onHome;
  return { onHome: r.onHome };
};
