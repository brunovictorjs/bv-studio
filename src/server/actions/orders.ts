import { z } from "zod";
import {
  balanceDue,
  discountFor,
  hasServices,
  offerFor,
  orderDuration,
  orderTotal,
  paidAmount,
  productPriceAt,
  servicePriceAt,
  stripeFee,
} from "@/lib/domain/rules";
import { L, tx } from "@/lib/domain/text";
import { addMinutes, datePart, epochMin } from "@/lib/domain/time";
import type { DB, Order, OrderItem, PaymentMethod, RequestCtx, User } from "@/lib/domain/types";
import { actor, fail, fullName, getOrder, getUnit, getUser, must, requireUnitStaff, type ActionFn } from "../core";
import { newCompletionCode, newOrderCode, newWalkinCode, uid } from "../ids";
import { canFit, eligiblePros, nextGap, pickProfessional } from "../scheduling";

const id = z.string().min(1);

function event(o: Order, ctx: RequestCtx, kind: Order["timeline"][number]["kind"], note?: Order["timeline"][number]["note"]) {
  o.timeline.push({ at: ctx.now, kind, by: ctx.actorId, note: note ?? null });
}

function makeItem(db: DB, unitId: string, kind: "service" | "product", refId: string, addedBy?: string | null): OrderItem {
  if (kind === "service") {
    const s = must(db.services.find((x) => x.id === refId), "service_not_found");
    if (s.status !== "active" || !s.units.some((u) => u.unitId === unitId)) fail("service_unavailable");
    return {
      id: uid("it"),
      kind,
      refId,
      name: s.name,
      unitPrice: servicePriceAt(s, unitId),
      qty: 1,
      durationMin: s.durationMin,
      doneAt: null,
      addedBy: addedBy ?? null,
    };
  }
  const p = must(db.products.find((x) => x.id === refId), "product_not_found");
  if (!p.available || !p.units.some((u) => u.unitId === unitId)) fail("product_unavailable");
  return {
    id: uid("it"),
    kind,
    refId,
    name: p.name,
    unitPrice: productPriceAt(p, unitId),
    qty: 1,
    durationMin: 0,
    addedBy: addedBy ?? null,
    delivered: false,
  };
}

function notifyPro(db: DB, o: Order, ctx: RequestCtx, kind: "order_paid" | "cancelled") {
  if (!o.professionalId) return;
  const when = o.start ? o.start.slice(11) : "";
  db.notices.unshift({
    id: uid("nt"),
    userId: o.professionalId,
    kind,
    title:
      kind === "order_paid"
        ? L(`Pedido ${o.code} confirmado`, `Order ${o.code} confirmed`)
        : L(`Pedido ${o.code} cancelado`, `Order ${o.code} cancelled`),
    body: L(`${o.clientName} · ${o.start?.slice(8, 10)}/${o.start?.slice(5, 7)} ${when}`, `${o.clientName} · ${o.start?.slice(5, 7)}/${o.start?.slice(8, 10)} ${when}`),
    at: ctx.now,
    read: false,
    orderId: o.id,
  });
}

function logDelivery(db: DB, ctx: RequestCtx, channel: "email" | "whatsapp", label: ReturnType<typeof L>, to: string) {
  db.settings.notifications.log.unshift({ id: uid("lg"), ok: true, channel, label, to, at: ctx.now });
  db.settings.notifications.log = db.settings.notifications.log.slice(0, 12);
}

// ------------------------------------------------------------------ client: cart & checkout

function clientCart(db: DB, client: User, unitId: string): Order | undefined {
  return db.orders.find((o) => o.clientId === client.id && o.unitId === unitId && o.status === "cart");
}

export const cartAdd: ActionFn = (db, raw, ctx) => {
  const input = z.object({ unitId: id, kind: z.enum(["service", "product"]), refId: id }).parse(raw);
  const client = actor(db, ctx);
  getUnit(db, input.unitId);
  let cart = clientCart(db, client, input.unitId);
  if (!cart) {
    cart = {
      id: uid("o"),
      code: newOrderCode(db),
      completionCode: newCompletionCode(),
      unitId: input.unitId,
      clientId: client.id,
      clientName: fullName(client),
      clientPhone: client.phone,
      origin: "site",
      professionalId: null,
      start: null,
      status: "cart",
      items: [],
      discount: 0,
      offerId: null,
      payments: [],
      refunded: 0,
      timeline: [{ at: ctx.now, kind: "cart", by: client.id }],
      createdAt: ctx.now,
    };
    db.orders.push(cart);
  }
  const existing = cart.items.find((i) => i.kind === input.kind && i.refId === input.refId);
  if (existing) {
    if (input.kind === "service") fail("service_already_in_cart");
    existing.qty += 1;
  } else {
    cart.items.push(makeItem(db, input.unitId, input.kind, input.refId));
  }
  return { orderId: cart.id, count: cart.items.reduce((s, i) => s + i.qty, 0) };
};

export const cartRemove: ActionFn = (db, raw, ctx) => {
  const input = z.object({ orderId: id, itemId: id }).parse(raw);
  const o = getOrder(db, input.orderId);
  if (o.clientId !== ctx.actorId || o.status !== "cart") fail("forbidden");
  const item = must(o.items.find((i) => i.id === input.itemId));
  if (item.qty > 1) item.qty -= 1;
  else o.items = o.items.filter((i) => i.id !== input.itemId);
  if (o.items.length === 0) db.orders = db.orders.filter((x) => x.id !== o.id);
  return { ok: true };
};

/** Step 3 of booking: holds the time for the client while they pay. */
export const checkoutReserve: ActionFn = (db, raw, ctx) => {
  const input = z.object({ orderId: id, start: z.string().nullable(), professionalId: z.string().nullable() }).parse(raw);
  const o = getOrder(db, input.orderId);
  if (o.clientId !== ctx.actorId) fail("forbidden");
  if (!["cart", "awaiting_payment"].includes(o.status)) fail("order_not_editable");
  const unit = getUnit(db, o.unitId);
  const serviceIds = o.items.filter((i) => i.kind === "service").map((i) => i.refId);

  if (serviceIds.length) {
    if (!input.start) fail("pick_a_time");
    const start = input.start!;
    if (epochMin(start) <= epochMin(ctx.now)) fail("time_in_past");
    const dur = orderDuration(o);
    let pro: User | null;
    if (input.professionalId) {
      pro = getUser(db, input.professionalId);
      if (!eligiblePros(db, o.unitId, serviceIds).some((p) => p.id === pro!.id)) fail("pro_not_eligible");
      if (!canFit(db, pro, unit, start, dur, { excludeId: o.id })) fail("slot_taken");
    } else {
      pro = pickProfessional(db, o.unitId, serviceIds, start);
      if (!pro) fail("slot_taken");
    }
    o.start = start;
    o.professionalId = pro!.id;
    o.anyProfessional = !input.professionalId;
    // offers depend on the chosen day
    const today = datePart(ctx.now);
    o.discount = 0;
    o.offerId = null;
    for (const it of o.items.filter((i) => i.kind === "service")) {
      const offer = offerFor(db, it.refId, o.unitId, datePart(start), today);
      if (offer) {
        o.discount += discountFor(offer, it.unitPrice);
        o.offerId = offer.id;
      }
    }
  } else {
    o.start = null;
    o.professionalId = null;
  }
  o.status = "awaiting_payment";
  o.holdUntil = addMinutes(ctx.now, unit.holdMinutes);
  if (!o.timeline.some((e) => e.kind === "created")) event(o, ctx, "created");
  return { orderId: o.id, total: orderTotal(o), discount: o.discount, professionalId: o.professionalId };
};

export const checkoutPay: ActionFn = (db, raw, ctx) => {
  const input = z
    .object({ orderId: id, method: z.enum(["pix", "credit", "debit", "cash"]), installments: z.number().int().min(1).max(12).optional() })
    .parse(raw);
  const o = getOrder(db, input.orderId);
  if (o.clientId !== ctx.actorId) fail("forbidden");
  if (o.status !== "awaiting_payment") fail("order_not_awaiting_payment");
  const methods = db.settings.payment.methods;
  if (!methods[input.method]) fail("method_disabled");
  if (input.method === "cash" && !hasServices(o)) fail("cash_needs_service");
  if (o.holdUntil && epochMin(ctx.now) > epochMin(o.holdUntil) + 60) {
    // hold expired long ago: make sure the slot is still free
    const unit = getUnit(db, o.unitId);
    if (o.start && o.professionalId && !canFit(db, getUser(db, o.professionalId), unit, o.start, orderDuration(o), { excludeId: o.id }))
      fail("hold_expired");
  }
  const total = orderTotal(o);
  if (input.method === "cash") {
    o.chosenMethod = "cash";
    o.holdUntil = null;
    event(o, ctx, "reserved_cash");
  } else {
    if (input.method === "credit" && input.installments && input.installments > db.settings.payment.installments) fail("too_many_installments");
    o.payments.push({
      id: uid("pay"),
      method: input.method,
      channel: "online",
      amount: total,
      at: ctx.now,
      stripeId: `pi_3Q${Math.random().toString(36).slice(2, 12)}`,
      fee: stripeFee(input.method, total, db.settings),
    });
    o.status = "paid";
    o.chosenMethod = input.method;
    o.holdUntil = null;
    event(o, ctx, "paid", input.installments && input.installments > 1 ? L(`${input.installments}x`, `${input.installments}x`) : null);
    if (!hasServices(o)) {
      o.items.forEach((i) => (i.delivered = false));
    }
  }
  if (o.offerId) {
    const offer = db.offers.find((x) => x.id === o.offerId);
    if (offer) offer.uses += 1;
  }
  notifyPro(db, o, ctx, "order_paid");
  const client = getUser(db, o.clientId!);
  logDelivery(db, ctx, "email", L("Comprovante do pedido", "Order receipt"), client.email);
  return { orderId: o.id, status: o.status };
};

export const orderCancel: ActionFn = (db, raw, ctx) => {
  const input = z.object({ orderId: id, reason: z.string().optional() }).parse(raw);
  const o = getOrder(db, input.orderId);
  const me = actor(db, ctx);
  const isStaff = me.roles.includes("admin") || (me.roles.includes("desk") && me.unitId === o.unitId);
  if (o.clientId !== me.id && !isStaff) fail("forbidden");
  if (!["awaiting_payment", "paid"].includes(o.status)) fail("cannot_cancel_status");
  const inTime = !o.start || epochMin(ctx.now) < epochMin(o.start);
  if (!inTime && !(me.roles.includes("admin") && db.settings.payment.adminLateRefund)) fail("cancel_deadline_passed");
  const paid = paidAmount(o);
  const fee = o.clientId === me.id ? db.settings.payment.cancelFee : 0;
  const refund = Math.max(0, paid - fee);
  o.status = "cancelled";
  event(o, ctx, "cancelled", input.reason ? input.reason : null);
  if (refund > 0 && (db.settings.payment.autoRefund || isStaff)) {
    o.refunded = refund;
    event(o, ctx, "refunded");
  }
  if (o.offerId) {
    const offer = db.offers.find((x) => x.id === o.offerId);
    if (offer && offer.uses > 0) offer.uses -= 1;
  }
  notifyPro(db, o, ctx, "cancelled");
  return { refunded: o.refunded };
};

export const orderReview: ActionFn = (db, raw, ctx) => {
  const r = z.number().int().min(1).max(5);
  const input = z
    .object({ orderId: id, serviceRating: r, proRating: r.nullable(), productRating: r.nullable(), text: z.string().max(600) })
    .parse(raw);
  const o = getOrder(db, input.orderId);
  if (o.clientId !== ctx.actorId) fail("forbidden");
  if (o.status !== "completed") fail("review_only_completed");
  if (o.reviewed) fail("already_reviewed");
  const svc = o.items.find((i) => i.kind === "service");
  const prod = o.items.find((i) => i.kind === "product");
  const text = input.text.trim();
  db.reviews.unshift({
    id: uid("rv"),
    orderId: o.id,
    unitId: o.unitId,
    clientId: o.clientId,
    clientName: o.clientName,
    serviceId: svc?.refId ?? null,
    productId: prod?.refId ?? null,
    professionalId: o.professionalId,
    serviceRating: input.serviceRating,
    proRating: input.proRating,
    productRating: input.productRating,
    text,
    at: ctx.now,
    reply: null,
    // the home carousel only shows 5 + 5 with a text
    onHome: input.serviceRating === 5 && (input.proRating ?? 5) === 5 && text.length > 0,
  });
  o.reviewed = true;
  if (o.professionalId)
    db.notices.unshift({
      id: uid("nt"),
      userId: o.professionalId,
      kind: "review",
      title: L(`Você recebeu ${input.proRating ?? input.serviceRating} estrelas`, `You got ${input.proRating ?? input.serviceRating} stars`),
      body: L(o.clientName, o.clientName),
      at: ctx.now,
      read: false,
      orderId: o.id,
    });
  return { onHome: input.serviceRating === 5 && input.proRating === 5 && text.length > 0 };
};

// ------------------------------------------------------------------ professional app

export const proCheckIn: ActionFn = (db, raw, ctx) => {
  const input = z.object({ code: z.string().min(3) }).parse(raw);
  const me = actor(db, ctx);
  if (!me.roles.includes("professional")) fail("forbidden");
  const code = input.code.toUpperCase().replace(/^BV-?/, "");
  const today = datePart(ctx.now);
  const o = db.orders.find(
    (x) => x.code === `BV-${code}` && x.unitId === me.unitId && x.start && datePart(x.start) === today,
  );
  if (!o) fail("code_not_found_today");
  if (o!.professionalId !== me.id) {
    // another pro can take it only if they do every service
    const ok = eligiblePros(db, o!.unitId, o!.items.filter((i) => i.kind === "service").map((i) => i.refId)).some((p) => p.id === me.id);
    if (!ok) fail("code_other_pro", { name: getUser(db, o!.professionalId!).firstName });
    o!.professionalId = me.id;
  }
  if (!["paid", "awaiting_payment"].includes(o!.status)) fail("order_not_startable");
  if (db.orders.some((x) => x.professionalId === me.id && x.status === "in_service")) fail("already_in_service");
  o!.status = "in_service";
  o!.startedAt = ctx.now;
  event(o!, ctx, "checkin");
  return { orderId: o!.id };
};

export const proAddItems: ActionFn = (db, raw, ctx) => {
  const input = z.object({ orderId: id, items: z.array(z.object({ kind: z.enum(["service", "product"]), refId: id })).min(1) }).parse(raw);
  const o = getOrder(db, input.orderId);
  const me = requireUnitStaff(db, ctx, o.unitId);
  if (o.status !== "in_service") fail("order_not_in_service");
  for (const it of input.items) {
    if (it.kind === "product") {
      const p = must(db.products.find((x) => x.id === it.refId));
      if (!p.staffCanAdd) fail("product_not_for_staff");
      const same = o.items.find((i) => i.kind === "product" && i.refId === it.refId && i.addedBy === me.id);
      if (same) same.qty += 1;
      else o.items.push(makeItem(db, o.unitId, "product", it.refId, me.id));
    } else {
      const s = must(db.services.find((x) => x.id === it.refId));
      if (!s.units.find((u) => u.unitId === o.unitId)?.professionalIds.includes(me.id)) fail("pro_not_eligible");
      o.items.push(makeItem(db, o.unitId, "service", it.refId, me.id));
    }
    event(o, ctx, "extra", tx(o.items[o.items.length - 1].name, ctx.locale));
  }
  return { total: orderTotal(o), balance: balanceDue(o) };
};

export const proMarkDone: ActionFn = (db, raw, ctx) => {
  const input = z.object({ orderId: id, itemId: id }).parse(raw);
  const o = getOrder(db, input.orderId);
  requireUnitStaff(db, ctx, o.unitId);
  const it = must(o.items.find((i) => i.id === input.itemId && i.kind === "service"));
  it.doneAt = it.doneAt ? null : ctx.now;
  if (it.doneAt) event(o, ctx, "service_done", it.name);
  return { ok: true };
};

const counterMethod = z.enum(["cash", "store_pix", "pos_debit", "pos_credit"]);

export const proComplete: ActionFn = (db, raw, ctx) => {
  const input = z
    .object({
      orderId: id,
      completionCode: z.string().optional(),
      payNow: z.object({ method: counterMethod, received: z.number().int().nonnegative().optional() }).nullable().optional(),
    })
    .parse(raw);
  const o = getOrder(db, input.orderId);
  const me = requireUnitStaff(db, ctx, o.unitId);
  if (o.status !== "in_service") fail("order_not_in_service");
  if (o.origin === "site") {
    const typed = (input.completionCode ?? "").toUpperCase().replace(/^OK-?/, "");
    if (`OK-${typed}` !== o.completionCode) fail("completion_code_wrong");
  }
  o.items.filter((i) => i.kind === "service").forEach((i) => (i.doneAt = i.doneAt ?? ctx.now));
  o.status = "completed";
  o.completedAt = ctx.now;
  event(o, ctx, "completed");
  const due = balanceDue(o);
  if (input.payNow && due > 0) {
    const received = input.payNow.method === "cash" ? Math.max(input.payNow.received ?? due, due) : due;
    o.payments.push({
      id: uid("pay"),
      method: input.payNow.method,
      channel: "counter",
      amount: due,
      at: ctx.now,
      by: me.id,
      received,
      change: received - due,
      fee: 0,
    });
    o.items.forEach((i) => (i.delivered = true));
    event(o, ctx, "counter_received");
  }
  if (o.clientId) {
    logDelivery(db, ctx, "email", L("Pedido concluído", "Order completed"), getUser(db, o.clientId).email);
  }
  return { balance: balanceDue(o) };
};

export const proCreateWalkin: ActionFn = (db, raw, ctx) => {
  const input = z
    .object({
      clientName: z.string().trim().min(2),
      phone: z.string().optional(),
      items: z.array(z.object({ kind: z.enum(["service", "product"]), refId: id })).min(1),
    })
    .parse(raw);
  const me = actor(db, ctx);
  if (!me.roles.includes("professional") || !me.unitId) fail("forbidden");
  if (!input.items.some((i) => i.kind === "service")) fail("walkin_needs_service");
  if (db.orders.some((x) => x.professionalId === me.id && x.status === "in_service")) fail("already_in_service");
  const o = buildWalkin(db, ctx, me.unitId!, input.clientName, input.phone ?? "", input.items, me);
  o.start = ctx.now;
  o.status = "in_service";
  o.startedAt = ctx.now;
  event(o, ctx, "checkin");
  return { orderId: o.id, code: o.code };
};

function buildWalkin(
  db: DB,
  ctx: RequestCtx,
  unitId: string,
  clientName: string,
  phone: string,
  items: { kind: "service" | "product"; refId: string }[],
  pro: User,
): Order {
  for (const it of items) {
    if (it.kind === "service") {
      const s = must(db.services.find((x) => x.id === it.refId));
      if (!s.units.find((u) => u.unitId === unitId)?.professionalIds.includes(pro.id)) fail("pro_not_eligible");
    }
  }
  const client = phone ? db.users.find((u) => u.phone === phone && u.roles.includes("client")) : undefined;
  const o: Order = {
    id: uid("o"),
    code: newWalkinCode(db),
    completionCode: newCompletionCode(),
    unitId,
    clientId: client?.id ?? null,
    clientName,
    clientPhone: phone,
    origin: "walkin",
    professionalId: pro.id,
    start: null,
    status: "awaiting_payment",
    items: items.map((i) => makeItem(db, unitId, i.kind, i.refId, i.kind === "product" ? pro.id : null)),
    discount: 0,
    offerId: null,
    payments: [],
    refunded: 0,
    timeline: [{ at: ctx.now, kind: "created", by: ctx.actorId }],
    createdAt: ctx.now,
    chosenMethod: null,
  };
  db.orders.push(o);
  return o;
}

export const proReadNotices: ActionFn = (db, _raw, ctx) => {
  const me = actor(db, ctx);
  db.notices.forEach((n) => {
    if (n.userId === me.id) n.read = true;
  });
  return { ok: true };
};

// ------------------------------------------------------------------ front desk

export const deskSettle: ActionFn = (db, raw, ctx) => {
  const input = z
    .object({ orderId: id, method: counterMethod, received: z.number().int().nonnegative().optional(), deliver: z.boolean().default(true) })
    .parse(raw);
  const o = getOrder(db, input.orderId);
  const me = requireUnitStaff(db, ctx, o.unitId);
  const due = balanceDue(o);
  if (due <= 0) fail("nothing_to_receive");
  if (input.method === "cash" && (input.received ?? 0) < due) fail("received_less_than_due");
  const received = input.method === "cash" ? input.received! : due;
  o.payments.push({
    id: uid("pay"),
    method: input.method as PaymentMethod,
    channel: "counter",
    amount: due,
    at: ctx.now,
    by: me.id,
    received,
    change: received - due,
    fee: 0,
  });
  event(o, ctx, "counter_received");
  if (input.deliver) o.items.filter((i) => i.kind === "product").forEach((i) => (i.delivered = true));
  // a cash booking paid before the service becomes "paid"
  if (o.status === "awaiting_payment" && o.origin === "site") o.status = "paid";
  if (o.status === "awaiting_payment" && o.origin === "walkin") o.status = "paid";
  if (!hasServices(o) && o.items.every((i) => i.delivered)) {
    o.status = "completed";
    o.completedAt = ctx.now;
  }
  return { change: received - due };
};

export const deskDeliver: ActionFn = (db, raw, ctx) => {
  const input = z.object({ orderId: id, code: z.string().min(3) }).parse(raw);
  const o = getOrder(db, input.orderId);
  requireUnitStaff(db, ctx, o.unitId);
  const typed = input.code.toUpperCase().replace(/\s/g, "");
  if (typed !== o.code && `BV-${typed}` !== o.code) fail("delivery_code_wrong");
  if (balanceDue(o) > 0) fail("receive_before_delivering");
  o.items.filter((i) => i.kind === "product").forEach((i) => (i.delivered = true));
  event(o, ctx, "delivered");
  if (!hasServices(o)) {
    o.status = "completed";
    o.completedAt = ctx.now;
  }
  return { ok: true };
};

export const deskCreateWalkin: ActionFn = (db, raw, ctx) => {
  const input = z
    .object({
      unitId: id,
      clientName: z.string().trim().min(2),
      phone: z.string().optional(),
      professionalId: id,
      items: z.array(z.object({ kind: z.enum(["service", "product"]), refId: id })).min(1),
    })
    .parse(raw);
  requireUnitStaff(db, ctx, input.unitId);
  const unit = getUnit(db, input.unitId);
  const pro = getUser(db, input.professionalId);
  if (pro.unitId !== unit.id) fail("pro_not_in_unit");
  if (!input.items.some((i) => i.kind === "service")) fail("walkin_needs_service");
  const o = buildWalkin(db, ctx, unit.id, input.clientName, input.phone ?? "", input.items, pro);
  const dur = orderDuration(o);
  // goes into the professional's next free gap
  const at = nextGap(db, pro, unit, ctx.now, dur, o.id);
  if (!at) {
    db.orders = db.orders.filter((x) => x.id !== o.id);
    db.counters.walkin -= 1;
    fail("no_gap_today", { name: pro.firstName });
  }
  o.start = at!;
  db.notices.unshift({
    id: uid("nt"),
    userId: pro.id,
    kind: "info",
    title: L(`Novo avulso · ${o.clientName}`, `New walk-in · ${o.clientName}`),
    body: L(`Encaixe às ${at!.slice(11)}`, `Fitted in at ${at!.slice(11)}`),
    at: ctx.now,
    read: false,
    orderId: o.id,
  });
  return { orderId: o.id, code: o.code, start: o.start };
};

export const orderNoShow: ActionFn = (db, raw, ctx) => {
  const input = z.object({ orderId: id }).parse(raw);
  const o = getOrder(db, input.orderId);
  requireUnitStaff(db, ctx, o.unitId);
  if (!["paid", "awaiting_payment"].includes(o.status) || !o.start) fail("cannot_mark_no_show");
  if (epochMin(ctx.now) < epochMin(o.start!)) fail("not_late_yet");
  o.status = "no_show";
  event(o, ctx, "no_show");
  return { ok: true };
};

export const orderRefund: ActionFn = (db, raw, ctx) => {
  const input = z.object({ orderId: id }).parse(raw);
  const o = getOrder(db, input.orderId);
  const me = actor(db, ctx);
  if (!me.roles.includes("admin")) fail("forbidden");
  const paidOnline = o.payments.filter((p) => p.channel === "online").reduce((s, p) => s + p.amount, 0);
  if (paidOnline - o.refunded <= 0) fail("nothing_to_refund");
  o.refunded = paidOnline;
  if (o.status !== "completed") o.status = "cancelled";
  event(o, ctx, "refunded");
  return { refunded: o.refunded };
};

export const orderResendReceipt: ActionFn = (db, raw, ctx) => {
  const input = z.object({ orderId: id }).parse(raw);
  const o = getOrder(db, input.orderId);
  requireUnitStaff(db, ctx, o.unitId);
  const to = o.clientId ? getUser(db, o.clientId).email : o.clientPhone || o.clientName;
  logDelivery(db, ctx, o.clientId ? "email" : "whatsapp", L("Comprovante reenviado", "Receipt resent"), to);
  return { to };
};

export const orderReschedule: ActionFn = (db, raw, ctx) => {
  const input = z.object({ orderId: id, start: z.string(), professionalId: z.string().nullable() }).parse(raw);
  const o = getOrder(db, input.orderId);
  requireUnitStaff(db, ctx, o.unitId);
  if (!["paid", "awaiting_payment"].includes(o.status)) fail("order_not_editable");
  const unit = getUnit(db, o.unitId);
  const pro = getUser(db, input.professionalId ?? o.professionalId!);
  if (!canFit(db, pro, unit, input.start, orderDuration(o), { excludeId: o.id })) fail("slot_taken");
  o.start = input.start;
  o.professionalId = pro.id;
  event(o, ctx, "rescheduled", input.start.replace("T", " "));
  return { ok: true };
};

