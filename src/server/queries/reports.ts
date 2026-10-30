import { z } from "zod";
import { orderCommission, orderFees, orderTotal, paidAmount, unitHoursOn } from "@/lib/domain/rules";
import { addDays, datePart, epochMin, weekday } from "@/lib/domain/time";
import type { DB, ID, PaymentMethod, RequestCtx } from "@/lib/domain/types";
import { fullName, requireRole } from "../core";
import { lateInfo } from "../scheduling";
import { inPeriod, isRealized, occupancy, orderDate, previousPeriod, ratingOf } from "./shared";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const unitFilter = z.string().default("all");

function realizedIn(db: DB, unitId: string, from: string, to: string) {
  return db.orders.filter((o) => (unitId === "all" || o.unitId === unitId) && inPeriod(o, from, to) && isRealized(o));
}

function aiStats(db: DB, unitId: string, from: string, to: string) {
  const convs = db.conversations.filter((c) => (unitId === "all" || c.unitId === unitId) && datePart(c.updatedAt) >= from && datePart(c.updatedAt) <= to);
  const resolved = convs.filter((c) => !c.forwardedAt).length;
  const waiting = db.conversations.filter((c) => (unitId === "all" || c.unitId === unitId) && c.status === "forwarded").length;
  return { total: convs.length, resolved, rate: convs.length ? Math.round((resolved / convs.length) * 100) : 0, waiting };
}

export const dashboard = (db: DB, raw: unknown, ctx: RequestCtx) => {
  requireRole(db, ctx, "admin");
  const input = z.object({ unitId: unitFilter, from: date, to: date }).parse(raw);
  const prev = previousPeriod(input.from, input.to);
  const cur = realizedIn(db, input.unitId, input.from, input.to);
  const old = realizedIn(db, input.unitId, prev.from, prev.to);
  const sum = (os: typeof cur) => os.reduce((s, o) => s + orderTotal(o), 0);
  const revenue = sum(cur);
  const revenuePrev = sum(old);
  const cancelled = db.orders.filter(
    (o) => (input.unitId === "all" || o.unitId === input.unitId) && inPeriod(o, input.from, input.to) && o.status === "cancelled",
  );
  const ai = aiStats(db, input.unitId, input.from, input.to);
  const today = datePart(ctx.now);

  const units = db.units
    .filter((u) => input.unitId === "all" || u.id === input.unitId)
    .map((u) => {
      const r = sum(realizedIn(db, u.id, input.from, input.to));
      const rp = sum(realizedIn(db, u.id, prev.from, prev.to));
      const count = realizedIn(db, u.id, input.from, input.to).length;
      const unitAi = aiStats(db, u.id, input.from, input.to);
      const h = unitHoursOn(u, today);
      const late = db.orders.filter((o) => o.unitId === u.id && lateInfo(db, o, ctx.now)).length;
      return {
        id: u.id,
        name: u.name,
        kind: u.kind,
        openUntil: h?.end ?? null,
        revenue: r,
        change: rp ? Math.round(((r - rp) / rp) * 1000) / 10 : null,
        share: revenue ? Math.round((r / revenue) * 100) : 0,
        orders: count,
        ticket: count ? Math.round(r / count) : 0,
        occupancy: occupancy(db, u.id, input.from, input.to).pct,
        rating: ratingOf(db.reviews.filter((x) => x.unitId === u.id)).avg,
        aiRate: unitAi.rate,
        forwardedOpen: unitAi.waiting,
        late,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  const byDay: { date: string; revenue: number; closed: boolean }[] = [];
  for (let d = input.from; d <= input.to; d = addDays(d, 1)) {
    const closed = db.units.filter((u) => input.unitId === "all" || u.id === input.unitId).every((u) => !unitHoursOn(u, d));
    byDay.push({ date: d, revenue: sum(cur.filter((o) => orderDate(o) === d)), closed });
  }

  const svcMap = new Map<string, { id: ID; name: unknown; unitId: ID; orders: number; revenue: number }>();
  for (const o of cur) {
    for (const it of o.items.filter((i) => i.kind === "service")) {
      const key = `${it.refId}:${o.unitId}`;
      const e = svcMap.get(key) ?? { id: it.refId, name: it.name, unitId: o.unitId, orders: 0, revenue: 0 };
      e.orders += 1;
      e.revenue += it.unitPrice * it.qty;
      svcMap.set(key, e);
    }
  }
  const pros = db.users
    .filter((u) => u.roles.includes("professional") && u.status === "active" && (input.unitId === "all" || u.unitId === input.unitId))
    .map((u) => {
      const mine = cur.filter((o) => o.professionalId === u.id);
      return {
        id: u.id,
        name: fullName(u),
        unitId: u.unitId,
        count: mine.length,
        rating: ratingOf(db.reviews.filter((r) => r.professionalId === u.id), "proRating").avg,
        revenue: sum(mine),
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  return {
    period: { ...input, prevFrom: prev.from, prevTo: prev.to, days: prev.days },
    kpis: {
      revenue,
      revenuePrev,
      orders: cur.length,
      ordersPrev: old.length,
      ticket: cur.length ? Math.round(revenue / cur.length) : 0,
      ticketPrev: old.length ? Math.round(revenuePrev / old.length) : 0,
      cancelled: cancelled.length,
      refunded: cancelled.reduce((s, o) => s + o.refunded, 0),
      ai,
    },
    units,
    byDay,
    topServices: [...svcMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 6),
    pros: pros.slice(0, 8),
  };
};

const methodGroup = (m: PaymentMethod): "pix" | "credit" | "debit" | "counter" =>
  m === "pix" || m === "credit" || m === "debit" ? m : "counter";

export const sales = (db: DB, raw: unknown, ctx: RequestCtx) => {
  requireRole(db, ctx, "admin");
  const input = z
    .object({ unitId: unitFilter, from: date, to: date, method: z.string().default("all"), proId: z.string().default("all"), groupBy: z.enum(["day", "week"]).default("day") })
    .parse(raw);
  const orders = db.orders.filter(
    (o) =>
      (input.unitId === "all" || o.unitId === input.unitId) &&
      (input.proId === "all" || o.professionalId === input.proId) &&
      inPeriod(o, input.from, input.to) &&
      (isRealized(o) || (o.status === "cancelled" && o.refunded > 0)) &&
      (input.method === "all" || o.payments.some((p) => methodGroup(p.method) === input.method)),
  );
  const rowOf = (os: typeof orders) => {
    const gross = os.reduce((s, o) => s + paidAmount(o), 0);
    const refunds = os.reduce((s, o) => s + o.refunded, 0);
    const fees = os.reduce((s, o) => s + orderFees(o), 0);
    const commissions = os.reduce((s, o) => s + orderCommission(db, o).total, 0);
    const net = gross - refunds - fees - commissions;
    return {
      orders: os.filter((o) => o.status !== "cancelled").length,
      gross,
      refunds,
      refundOrders: os.filter((o) => o.refunded > 0).length,
      fees,
      commissions,
      net,
      margin: gross - refunds > 0 ? Math.round((net / (gross - refunds)) * 1000) / 10 : 0,
    };
  };
  const total = rowOf(orders);
  const rows: ({ label: string; from: string; to: string } & ReturnType<typeof rowOf>)[] = [];
  if (input.groupBy === "day") {
    for (let d = input.to; d >= input.from; d = addDays(d, -1)) {
      const os = orders.filter((o) => orderDate(o) === d);
      if (os.length) rows.push({ label: d, from: d, to: d, ...rowOf(os) });
    }
  } else {
    for (let end = input.to; end >= input.from; end = addDays(end, -7)) {
      const start = addDays(end, -6) < input.from ? input.from : addDays(end, -6);
      const os = orders.filter((o) => orderDate(o) >= start && orderDate(o) <= end);
      if (os.length) rows.push({ label: start, from: start, to: end, ...rowOf(os) });
    }
  }
  const byMethod = (["pix", "credit", "counter", "debit"] as const).map((key) => {
    const amount = orders.reduce((s, o) => s + o.payments.filter((p) => methodGroup(p.method) === key).reduce((a, p) => a + p.amount, 0), 0);
    return { key, amount, pct: total.gross ? Math.round((amount / total.gross) * 100) : 0 };
  });
  const byDay: { date: string; gross: number; closed: boolean }[] = [];
  for (let d = input.from; d <= input.to; d = addDays(d, 1)) {
    byDay.push({
      date: d,
      gross: orders.filter((o) => orderDate(o) === d).reduce((s, o) => s + paidAmount(o), 0),
      closed: db.units.every((u) => !unitHoursOn(u, d)),
    });
  }
  // Stripe pays out every Friday what was captured online in the week before
  const today = datePart(ctx.now);
  let payout = today;
  while (weekday(payout) !== 5 || payout === today) payout = addDays(payout, 1);
  const weekAgo = addDays(today, -7);
  const pending = db.orders
    .flatMap((o) => o.payments.filter((p) => p.channel === "online" && datePart(p.at) > weekAgo).map((p) => p.amount - p.fee))
    .reduce((s, x) => s + x, 0);
  const prosCount = new Set(orders.map((o) => o.professionalId).filter(Boolean)).size;
  return { total, prosCount, rows, byMethod, byDay, nextPayout: { date: payout, amount: pending } };
};

export const commissions = (db: DB, raw: unknown, ctx: RequestCtx) => {
  requireRole(db, ctx, "admin");
  const input = z.object({ unitId: z.string(), from: date, to: date }).parse(raw);
  const pros = db.users.filter((u) => u.roles.includes("professional") && u.unitId === input.unitId && u.status !== "disabled");
  const rows = pros.map((u) => {
    const os = db.orders.filter((o) => o.professionalId === u.id && inPeriod(o, input.from, input.to));
    const done = os.filter((o) => o.status === "completed");
    const breakdown = os.map((o) => orderCommission(db, o));
    return {
      id: u.id,
      name: fullName(u),
      exec: u.commission?.exec ?? db.settings.commissions.defaultExec,
      product: u.commission?.product ?? db.settings.commissions.defaultProduct,
      count: done.length,
      services: breakdown.reduce((s, b) => s + b.execBase, 0),
      products: breakdown.reduce((s, b) => s + b.productBase, 0),
      toPay: breakdown.reduce((s, b) => s + b.total, 0),
    };
  });
  const totals = rows.reduce(
    (t, r) => ({ count: t.count + r.count, services: t.services + r.services, products: t.products + r.products, toPay: t.toPay + r.toPay }),
    { count: 0, services: 0, products: 0, toPay: 0 },
  );
  return { rows, totals };
};

export const unitsOverview = (db: DB, _raw: unknown, ctx: RequestCtx) => {
  requireRole(db, ctx, "admin");
  const today = datePart(ctx.now);
  const from = addDays(today, -6);
  return db.units.map((u) => {
    const team = db.users.filter((x) => x.unitId === u.id && x.status !== "disabled");
    const h = unitHoursOn(u, today);
    const nowT = ctx.now.slice(11);
    return {
      id: u.id,
      pros: team.filter((x) => x.roles.includes("professional")).length,
      desks: team.filter((x) => x.roles.includes("desk")).length,
      services: db.services.filter((s) => s.status === "active" && s.units.some((l) => l.unitId === u.id)).length,
      revenue7: realizedIn(db, u.id, from, today).reduce((s, o) => s + orderTotal(o), 0),
      today: db.orders.filter((o) => o.unitId === u.id && o.start && datePart(o.start) === today && !["cart", "cancelled"].includes(o.status)).length,
      forwarded: db.conversations.filter((c) => c.unitId === u.id && c.status === "forwarded").length,
      openNow: !!h && u.active && nowT >= h.start && nowT < h.end,
      openDays: u.hours.map((d, i) => (d.open ? i : -1)).filter((i) => i >= 0),
    };
  });
};

export const reviewsSummary = (db: DB, _raw: unknown, ctx: RequestCtx) => {
  requireRole(db, ctx, "admin", "desk");
  const today = datePart(ctx.now);
  const weekAgo = addDays(today, -7);
  const completed = db.orders.filter((o) => o.status === "completed" && o.clientId).length;
  return {
    overall: ratingOf(db.reviews).avg,
    byUnit: db.units.map((u) => ({ id: u.id, name: u.name, avg: ratingOf(db.reviews.filter((r) => r.unitId === u.id)).avg })),
    onHome: db.reviews.filter((r) => r.onHome).length,
    low: db.reviews.filter((r) => r.serviceRating < 4).length,
    lowWeek: db.reviews.filter((r) => r.serviceRating < 4 && datePart(r.at) >= weekAgo).length,
    count: db.reviews.length,
    completed,
    rate: completed ? Math.round((db.reviews.length / completed) * 100) : 0,
    ageDays: epochMin(ctx.now) ? 0 : 0,
  };
};
