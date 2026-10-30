import { z } from "zod";
import {
  balanceDue,
  liveState,
  orderCommission,
  orderDuration,
  orderTotal,
  paidAmount,
  proHoursOn,
} from "@/lib/domain/rules";
import { addDays, addMinutes, datePart, epochMin, join, startOfMonth, toMinutes } from "@/lib/domain/time";
import type { DB, Order, User, RequestCtx } from "@/lib/domain/types";
import { actor, fail, fullName, getOrder, getUnit } from "../core";
import { lateInfo, nextGap } from "../scheduling";
import { occupancy, previousPeriod, ratingOf } from "./shared";

function requirePro(db: DB, actorId: string | null): User {
  const me = actor(db, { actorId, now: "", locale: "pt" });
  if (!me.roles.includes("professional")) fail("forbidden");
  return me;
}

const view = (db: DB, o: Order, now: string) => ({
  id: o.id,
  code: o.code,
  start: o.start,
  end: o.start ? addMinutes(o.start, orderDuration(o)) : null,
  client: o.clientName,
  walkin: o.origin === "walkin",
  items: o.items,
  durationMin: orderDuration(o),
  state: liveState(o, now),
  status: o.status,
  method: o.payments[0]?.method ?? o.chosenMethod ?? null,
  paid: paidAmount(o),
  total: orderTotal(o),
  balance: balanceDue(o),
  late: lateInfo(db, o, now),
  startedAt: o.startedAt ?? null,
  commission: orderCommission(db, { ...o, status: "completed" }).total,
});

export const proDay = (db: DB, _raw: unknown, ctx: RequestCtx) => {
  const me = requirePro(db, ctx.actorId);
  const unit = getUnit(db, me.unitId!);
  const today = datePart(ctx.now);
  const h = proHoursOn(me, unit, today);
  const mine = db.orders
    .filter((o) => o.professionalId === me.id && o.start && datePart(o.start) === today && !["cart", "cancelled"].includes(o.status))
    .sort((a, b) => a.start!.localeCompare(b.start!));
  const current = mine.find((o) => o.status === "in_service") ?? db.orders.find((o) => o.professionalId === me.id && o.status === "in_service");
  const upcoming = mine.filter((o) => ["paid", "awaiting_payment"].includes(o.status));
  const done = mine.filter((o) => o.status === "completed" || o.status === "no_show");
  // free gaps for walk-ins between now and the end of the day
  const gaps: { start: string; min: number }[] = [];
  if (h) {
    let cursor = epochMin(ctx.now) > epochMin(join(today, h.start)) ? ctx.now : join(today, h.start);
    for (let i = 0; i < 6; i++) {
      const g = nextGap(db, me, unit, cursor, 15);
      if (!g) break;
      let len = 15;
      while (len < 240 && nextGap(db, me, unit, g, len + 5) === g) len += 5;
      gaps.push({ start: g.slice(11), min: len });
      cursor = addMinutes(g, len + 5);
    }
  }
  const chairMin = mine.filter((o) => o.status !== "no_show").reduce((s, o) => s + orderDuration(o), 0);
  const available = h ? toMinutes(h.end) - toMinutes(h.start) - (h.breakStart && h.breakEnd ? toMinutes(h.breakEnd) - toMinutes(h.breakStart) : 0) : 0;
  const commissionOf = (os: Order[]) => os.reduce((s, o) => s + orderCommission(db, { ...o, status: "completed" }).total, 0);
  const yesterday = db.orders.filter(
    (o) => o.professionalId === me.id && o.start && datePart(o.start) === addDays(today, -1) && ["completed"].includes(o.status),
  );
  const expected = commissionOf(mine.filter((o) => o.status !== "no_show"));
  const prev = commissionOf(yesterday);
  return {
    pro: { id: me.id, name: fullName(me), chair: me.chair ?? null },
    unit: { id: unit.id, name: unit.name },
    hours: h,
    kpis: {
      total: mine.length,
      done: done.length,
      chairMin,
      occupancy: available ? Math.round((chairMin / available) * 100) : 0,
      commission: expected,
      change: prev ? Math.round(((expected - prev) / prev) * 100) : null,
    },
    current: current ? view(db, current, ctx.now) : null,
    upcoming: upcoming.map((o) => view(db, o, ctx.now)),
    gaps: gaps.filter((g) => !upcoming.some((o) => o.start!.slice(11) === g.start)),
    done: done.map((o) => view(db, o, ctx.now)),
    unread: db.notices.filter((n) => n.userId === me.id && !n.read).length,
  };
};

export const proOrder = (db: DB, raw: unknown, ctx: RequestCtx) => {
  const input = z.object({ id: z.string() }).parse(raw);
  const me = requirePro(db, ctx.actorId);
  const o = getOrder(db, input.id);
  if (o.unitId !== me.unitId) fail("forbidden_unit");
  const c = orderCommission(db, { ...o, status: "completed" });
  return {
    ...view(db, o, ctx.now),
    origin: o.origin,
    clientPhone: o.clientPhone,
    payments: o.payments,
    commissionBreakdown: c,
    chair: me.chair ?? null,
    elapsedMin: o.startedAt ? Math.max(0, epochMin(ctx.now) - epochMin(o.startedAt)) : 0,
  };
};

/** Today's orders of the unit that a code can match (the keypad suggests as you type). */
export const proCodeLookup = (db: DB, raw: unknown, ctx: RequestCtx) => {
  const input = z.object({ code: z.string() }).parse(raw);
  const me = requirePro(db, ctx.actorId);
  const today = datePart(ctx.now);
  const typed = input.code.toUpperCase();
  if (typed.length < 3) return { matches: [] };
  return {
    matches: db.orders
      .filter(
        (o) =>
          o.unitId === me.unitId &&
          o.start &&
          datePart(o.start) === today &&
          ["paid", "awaiting_payment"].includes(o.status) &&
          o.code.slice(3).startsWith(typed),
      )
      .map((o) => ({
        id: o.id,
        code: o.code,
        client: o.clientName,
        items: o.items.filter((i) => i.kind === "service").map((i) => i.name),
        time: o.start!.slice(11),
        total: orderTotal(o),
        mine: o.professionalId === me.id,
      })),
  };
};

export const proEarnings = (db: DB, raw: unknown, ctx: RequestCtx) => {
  const input = z.object({ period: z.enum(["month", "week", "last_month"]) }).parse(raw);
  const me = requirePro(db, ctx.actorId);
  const today = datePart(ctx.now);
  let from: string;
  let to: string;
  if (input.period === "month") {
    from = startOfMonth(today);
    to = today;
  } else if (input.period === "week") {
    from = addDays(today, -6);
    to = today;
  } else {
    const firstThis = startOfMonth(today);
    to = addDays(firstThis, -1);
    from = startOfMonth(to);
  }
  const prev = previousPeriod(from, to);
  const ordersIn = (a: string, b: string) =>
    db.orders.filter((o) => o.professionalId === me.id && o.start && datePart(o.start) >= a && datePart(o.start) <= b && ["completed", "cancelled", "no_show"].includes(o.status));
  const cur = ordersIn(from, to);
  const old = ordersIn(prev.from, prev.to);
  const comm = cur.map((o) => ({ o, c: orderCommission(db, o) }));
  const sum = (k: "exec" | "product" | "total" | "execBase" | "productBase") => comm.reduce((s, x) => s + x.c[k], 0);
  const prevTotal = old.reduce((s, o) => s + orderCommission(db, o).total, 0);
  const done = cur.filter((o) => o.status === "completed");
  const doneOld = old.filter((o) => o.status === "completed");
  const ticket = done.length ? Math.round(done.reduce((s, o) => s + orderTotal(o), 0) / done.length) : 0;
  const ticketPrev = doneOld.length ? Math.round(doneOld.reduce((s, o) => s + orderTotal(o), 0) / doneOld.length) : 0;
  const occ = occupancy(db, null, from, to, me.id);
  const reviews = db.reviews.filter((r) => r.professionalId === me.id && datePart(r.at) >= from && datePart(r.at) <= to);
  const last7: { date: string; amount: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = addDays(today, -i);
    last7.push({ date: d, amount: ordersIn(d, d).reduce((s, o) => s + orderCommission(db, o).total, 0) });
  }
  const mix = new Map<string, number>();
  done.forEach((o) =>
    o.items
      .filter((i) => i.kind === "service")
      .forEach((i) => {
        const cat = db.services.find((s) => s.id === i.refId)?.categoryId ?? "";
        mix.set(cat, (mix.get(cat) ?? 0) + i.unitPrice);
      }),
  );
  const mixTotal = [...mix.values()].reduce((a, b) => a + b, 0);
  let payout = today;
  while (new Date(`${payout}T00:00:00Z`).getUTCDay() !== 5 || payout === today) payout = addDays(payout, 1);
  const reviewByOrder = new Map(db.reviews.map((r) => [r.orderId, r]));
  return {
    from,
    to,
    prevFrom: prev.from,
    prevTo: prev.to,
    total: sum("total"),
    exec: sum("exec"),
    execBase: sum("execBase"),
    execPct: me.commission?.exec ?? db.settings.commissions.defaultExec,
    product: sum("product"),
    productBase: sum("productBase"),
    productPct: me.commission?.product ?? db.settings.commissions.defaultProduct,
    prevTotal,
    change: prevTotal ? Math.round(((sum("total") - prevTotal) / prevTotal) * 100) : null,
    payout,
    count: done.length,
    countChange: done.length - doneOld.length,
    ticket,
    ticketChange: ticket - ticketPrev,
    chairMin: occ.booked,
    occupancy: occ.pct,
    rating: ratingOf(reviews, "proRating"),
    last7,
    mix: [...mix.entries()]
      .map(([categoryId, v]) => ({ categoryId, name: db.categories.find((c) => c.id === categoryId)?.name ?? "", pct: mixTotal ? Math.round((v / mixTotal) * 100) : 0 }))
      .sort((a, b) => b.pct - a.pct),
    counts: { all: cur.length, completed: done.length, cancelled: cur.filter((o) => o.status !== "completed").length },
    rows: comm
      .sort((a, b) => b.o.start!.localeCompare(a.o.start!))
      .map(({ o, c }) => ({
        id: o.id,
        code: o.code,
        client: o.clientName,
        items: o.items.map((i) => i.name),
        at: o.completedAt ?? o.start,
        status: o.status,
        refunded: o.refunded > 0,
        commission: c.total,
        exec: c.exec,
        product: c.product,
        serviceTotal: c.execBase,
        realMin: o.startedAt && o.completedAt ? epochMin(o.completedAt) - epochMin(o.startedAt) : null,
        estMin: orderDuration(o),
        rating: reviewByOrder.get(o.id)?.proRating ?? null,
      })),
  };
};

export const proReviews = (db: DB, _raw: unknown, ctx: RequestCtx) => {
  const me = requirePro(db, ctx.actorId);
  const reviews = db.reviews.filter((r) => r.professionalId === me.id);
  const r = ratingOf(reviews, "proRating");
  const dist = [5, 4, 3, 2, 1].map((n) => ({ stars: n, count: reviews.filter((x) => x.proRating === n).length }));
  return {
    pro: { id: me.id, name: fullName(me), about: me.about, isAdmin: me.roles.includes("admin") },
    avg: r.avg,
    count: r.count,
    dist,
    list: reviews.map((x) => ({ ...x, serviceName: db.services.find((s) => s.id === x.serviceId)?.name ?? "" })),
  };
};

export const proNotices = (db: DB, _raw: unknown, ctx: RequestCtx) => {
  const me = requirePro(db, ctx.actorId);
  const list = db.notices.filter((n) => n.userId === me.id).sort((a, b) => b.at.localeCompare(a.at));
  const lastPaid = db.orders
    .filter((o) => o.professionalId === me.id && o.status === "paid" && o.start && epochMin(o.start) > epochMin(ctx.now))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  return {
    list,
    unitName: getUnit(db, me.unitId!).name,
    emailPreview: lastPaid
      ? { client: lastPaid.clientName, start: lastPaid.start, items: lastPaid.items.filter((i) => i.kind === "service").map((i) => i.name), code: lastPaid.code, orderId: lastPaid.id }
      : null,
  };
};

export const proCatalog = (db: DB, _raw: unknown, ctx: RequestCtx) => {
  const me = requirePro(db, ctx.actorId);
  return {
    services: db.services
      .filter((s) => s.status === "active" && s.units.some((l) => l.unitId === me.unitId && l.professionalIds.includes(me.id)))
      .map((s) => ({ id: s.id, name: s.name, durationMin: s.durationMin, price: s.units.find((l) => l.unitId === me.unitId)?.price ?? s.price })),
    products: db.products
      .filter((p) => p.staffCanAdd && p.units.some((l) => l.unitId === me.unitId))
      .map((p) => ({ id: p.id, name: p.name, detail: p.detail, available: p.available, price: p.units.find((l) => l.unitId === me.unitId)?.price ?? p.price })),
  };
};

