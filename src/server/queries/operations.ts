import { z } from "zod";
import {
  balanceDue,
  hasServices,
  liveState,
  orderCommission,
  orderDuration,
  orderFees,
  orderTotal,
  paidAmount,
  proHoursOn,
  unitHoursOn,
} from "@/lib/domain/rules";
import { matches, tx } from "@/lib/domain/text";
import { addMinutes, datePart, epochMin } from "@/lib/domain/time";
import type { DB, Order, PaymentMethod, RequestCtx } from "@/lib/domain/types";
import { fullName, getOrder, getUnit, requireRole, requireUnitStaff } from "../core";
import { lateInfo } from "../scheduling";
import { orderDate } from "./shared";

const userName = (db: DB, id: string | null | undefined) => {
  const u = db.users.find((x) => x.id === id);
  return u ? fullName(u) : null;
};

function receivableReason(o: Order): "cash_booking" | "balance" | "walkin" | "pickup" {
  if (o.origin === "walkin") return "walkin";
  if (!hasServices(o)) return "pickup";
  if (paidAmount(o) === 0) return "cash_booking";
  return "balance";
}

export const counter = (db: DB, raw: unknown, ctx: RequestCtx) => {
  const input = z.object({ unitId: z.string() }).parse(raw);
  requireUnitStaff(db, ctx, input.unitId);
  const today = datePart(ctx.now);
  const unitOrders = db.orders.filter((o) => o.unitId === input.unitId);

  const receivables = unitOrders
    .filter((o) => {
      if (balanceDue(o) <= 0) return false;
      if (["completed", "in_service"].includes(o.status)) return true;
      // cash bookings show up on the day
      return ["awaiting_payment", "paid"].includes(o.status) && !!o.start && datePart(o.start) === today;
    })
    .map((o) => {
      const extra = o.items.find((i) => i.addedBy && i.kind === "product");
      const late = lateInfo(db, o, ctx.now);
      return {
        orderId: o.id,
        code: o.code,
        client: o.clientName,
        walkin: o.origin === "walkin",
        reason: receivableReason(o),
        extraName: extra?.name ?? null,
        pro: db.users.find((u) => u.id === o.professionalId)?.firstName ?? null,
        state: liveState(o, ctx.now),
        start: o.start,
        fitAt: late?.fitAt ?? null,
        amount: balanceDue(o),
      };
    })
    .sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""));

  const toDeliver = unitOrders
    .filter((o) => !["cart", "cancelled", "awaiting_payment"].includes(o.status) || (o.status === "awaiting_payment" && o.origin === "walkin"))
    .flatMap((o) =>
      o.items
        .filter((i) => i.kind === "product" && !i.delivered)
        .map((i) => ({
          orderId: o.id,
          itemId: i.id,
          product: i.name,
          qty: i.qty,
          code: o.code,
          client: o.clientName,
          type: hasServices(o) ? (i.addedBy ? "extra" : "with_service") : "pickup",
          method: o.payments[0]?.method ?? null,
          due: balanceDue(o),
          serviceDay: o.start ? datePart(o.start) : null,
        })),
    )
    .filter((x) => x.type !== "with_service" || x.serviceDay === today || x.serviceDay! < today);

  const paymentsToday = unitOrders.flatMap((o) => o.payments.filter((p) => datePart(p.at) === today));
  const sumBy = (pred: (m: PaymentMethod, ch: string) => boolean) =>
    paymentsToday.filter((p) => pred(p.method, p.channel)).reduce((s, p) => s + p.amount, 0);
  const ordersToday = unitOrders.filter((o) => o.start && datePart(o.start) === today && !["cart", "cancelled"].includes(o.status));

  return {
    unitName: getUnit(db, input.unitId).name,
    receivables,
    receivableTotal: receivables.reduce((s, r) => s + r.amount, 0),
    receivedToday: sumBy((_, ch) => ch === "counter"),
    cashToday: sumBy((m) => m === "cash"),
    toDeliver,
    pickups: toDeliver.filter((x) => x.type === "pickup").length,
    ordersToday: ordersToday.length,
    walkinsToday: ordersToday.filter((o) => o.origin === "walkin").length,
    closing: {
      cash: sumBy((m) => m === "cash"),
      store_pix: sumBy((m) => m === "store_pix"),
      pos_debit: sumBy((m) => m === "pos_debit"),
      pos_credit: sumBy((m) => m === "pos_credit"),
      online: sumBy((_, ch) => ch === "online"),
    },
    forwarded: db.conversations
      .filter((c) => c.unitId === input.unitId && (c.status === "forwarded" || c.status === "human"))
      .map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        waitMin: c.forwardedAt ? Math.max(0, epochMin(ctx.now) - epochMin(c.forwardedAt)) : 0,
      })),
  };
};

export const agenda = (db: DB, raw: unknown, ctx: RequestCtx) => {
  const input = z.object({ unitId: z.string(), date: z.string() }).parse(raw);
  requireUnitStaff(db, ctx, input.unitId);
  const unit = getUnit(db, input.unitId);
  const hours = unitHoursOn(unit, input.date);
  const closure = unit.closures.find((c) => input.date >= c.start && input.date <= c.end);
  const pros = db.users
    .filter((u) => u.roles.includes("professional") && u.unitId === unit.id && u.status === "active")
    .map((pro) => {
      const h = proHoursOn(pro, unit, input.date);
      const offPeriod = pro.periods.find((p) => p.type === "closed" && datePart(p.start) <= input.date && datePart(p.end) >= input.date);
      const orders = db.orders
        .filter((o) => o.professionalId === pro.id && o.start && datePart(o.start) === input.date && !["cart"].includes(o.status))
        .sort((a, b) => a.start!.localeCompare(b.start!));
      const blocks = orders
        .filter((o) => o.status !== "cancelled")
        .map((o) => {
          const late = lateInfo(db, o, ctx.now);
          return {
            orderId: o.id,
            code: o.code,
            start: o.start!.slice(11),
            end: addMinutes(o.start!, Math.max(orderDuration(o), 15)).slice(11),
            client: o.clientName,
            phone: o.clientPhone,
            services: o.items.filter((i) => i.kind === "service").map((i) => i.name),
            durationMin: orderDuration(o),
            state: liveState(o, ctx.now),
            startedAt: o.startedAt?.slice(11) ?? null,
            paid: paidAmount(o) > 0,
            method: o.payments[0]?.method ?? o.chosenMethod ?? null,
            total: orderTotal(o),
            walkin: o.origin === "walkin",
            late: late
              ? { minutes: late.minutesLate, fitAt: late.fitAt?.slice(11) ?? null, deadline: late.deadline.slice(11) }
              : null,
          };
        });
      return {
        id: pro.id,
        name: fullName(pro),
        firstName: pro.firstName,
        hours: h ? { start: h.start, end: h.end, breakStart: h.breakStart ?? null, breakEnd: h.breakEnd ?? null } : null,
        offLabel: offPeriod?.label ?? null,
        count: blocks.filter((b) => b.state !== "no_show").length,
        blocks,
      };
    });
  const today = datePart(ctx.now);
  return {
    unitName: unit.name,
    hours: hours ? { start: hours.start, end: hours.end, breakStart: hours.breakStart ?? null, breakEnd: hours.breakEnd ?? null } : null,
    closure: closure?.label ?? null,
    pros,
    now: input.date === today ? ctx.now.slice(11) : null,
  };
};

export const ordersList = (db: DB, raw: unknown, ctx: RequestCtx) => {
  const me = requireRole(db, ctx, "admin", "desk");
  const input = z
    .object({
      q: z.string().default(""),
      from: z.string(),
      to: z.string(),
      unitId: z.string().default("all"),
      proId: z.string().default("all"),
      serviceId: z.string().default("all"),
      method: z.string().default("all"),
      origin: z.string().default("all"),
      status: z.string().default("all"),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(5).max(100).default(20),
    })
    .parse(raw);
  const unitId = me.roles.includes("admin") ? input.unitId : me.unitId!;
  const base = db.orders.filter((o) => {
    if (unitId !== "all" && o.unitId !== unitId) return false;
    const d = orderDate(o);
    if (d < input.from || d > input.to) return false;
    if (input.proId !== "all" && o.professionalId !== input.proId) return false;
    if (input.serviceId !== "all" && !o.items.some((i) => i.refId === input.serviceId)) return false;
    if (input.origin !== "all" && o.origin !== input.origin) return false;
    if (input.method !== "all") {
      const methods = o.payments.map((p) => p.method);
      if (input.method === "card" && !methods.some((m) => m === "credit" || m === "debit")) return false;
      if (input.method === "pix" && !methods.includes("pix")) return false;
      if (input.method === "counter" && !o.payments.some((p) => p.channel === "counter")) return false;
    }
    if (input.q) {
      const hay = `${o.code} ${o.clientName} ${o.clientPhone}`;
      if (!matches(hay, input.q)) return false;
    }
    return true;
  });
  const counts: Record<string, number> = { all: base.length };
  for (const o of base) counts[o.status] = (counts[o.status] ?? 0) + 1;
  const filtered = input.status === "all" ? base : base.filter((o) => o.status === input.status);
  filtered.sort((a, b) => (b.start ?? b.createdAt).localeCompare(a.start ?? a.createdAt));
  const pages = Math.max(1, Math.ceil(filtered.length / input.pageSize));
  const page = Math.min(input.page, pages);
  const rows = filtered.slice((page - 1) * input.pageSize, page * input.pageSize).map((o) => ({
    id: o.id,
    code: o.code,
    unitId: o.unitId,
    client: o.clientName,
    walkin: o.origin === "walkin",
    items: o.items.map((i) => i.name),
    pro: db.users.find((u) => u.id === o.professionalId)?.firstName ?? null,
    start: o.start,
    createdAt: o.createdAt,
    methods: [...new Set(o.payments.map((p) => p.method))],
    chosenMethod: o.chosenMethod ?? null,
    state: liveState(o, ctx.now),
    status: o.status,
    total: orderTotal(o),
    pickup: !hasServices(o),
  }));
  return {
    rows,
    counts,
    total: filtered.length,
    sum: filtered.filter((o) => o.status !== "cancelled" && o.status !== "cart").reduce((s, o) => s + orderTotal(o), 0),
    page,
    pages,
  };
};

export const orderDetail = (db: DB, raw: unknown, ctx: RequestCtx) => {
  const input = z.object({ id: z.string() }).parse(raw);
  const o = getOrder(db, input.id);
  const me = requireUnitStaff(db, ctx, o.unitId);
  const client = db.users.find((u) => u.id === o.clientId);
  const history = o.clientId ? db.orders.filter((x) => x.clientId === o.clientId && x.status !== "cart") : [];
  const lates = history.filter((x) => x.timeline.some((e) => e.kind === "late" || e.kind === "no_show") || (x.startedAt && x.start && epochMin(x.startedAt) - epochMin(x.start) > 10)).length;
  const commission = orderCommission(db, o);
  const fees = orderFees(o);
  const total = orderTotal(o);
  const conv = db.conversations.find((c) => c.clientId && c.clientId === o.clientId && c.unitId === o.unitId);
  const late = lateInfo(db, o, ctx.now);
  return {
    order: o,
    state: liveState(o, ctx.now),
    total,
    subtotal: o.items.reduce((s, i) => s + i.unitPrice * i.qty, 0),
    paid: paidAmount(o),
    balance: balanceDue(o),
    fees,
    commission,
    net: paidAmount(o) - o.refunded - fees - commission.total,
    offerName: db.offers.find((x) => x.id === o.offerId)?.name ?? null,
    proName: userName(db, o.professionalId),
    timeline: [...o.timeline]
      .sort((a, b) => b.at.localeCompare(a.at))
      .map((e) => ({ ...e, byName: e.by ? userName(db, e.by) : null })),
    client: client
      ? { id: client.id, name: fullName(client), email: client.email, phone: client.phone, since: client.since, orders: history.length, lates }
      : { id: null, name: o.clientName, email: "", phone: o.clientPhone, since: null, orders: 1, lates: 0 },
    payments: o.payments.map((p) => ({ ...p, byName: userName(db, p.by) })),
    conversationId: conv?.id ?? null,
    late: late ? { ...late } : null,
    canSeeCompletion: me.roles.includes("admin"),
    durationMin: orderDuration(o),
    productLabels: o.items.filter((i) => i.kind === "product").map((i) => tx(i.name, ctx.locale)),
  };
};
