import { z } from "zod";
import {
  advertisedOffer,
  balanceDue,
  discountFor,
  hasServices,
  liveState,
  offerFor,
  orderDuration,
  orderTotal,
  paidAmount,
  productPriceAt,
  servicePriceAt,
  unitHoursOn,
} from "@/lib/domain/rules";
import { addDays, addMinutes, datePart, epochMin } from "@/lib/domain/time";
import type { DB, ID, Order, RequestCtx } from "@/lib/domain/types";
import { actor, fail, fullName, getOrder, getUnit } from "../core";
import { busyUntil, canFit, daySlots, eligiblePros, lateInfo, monthDays, servicesDuration } from "../scheduling";
import { ratingOf } from "./shared";

function serviceCard(db: DB, unitId: ID, serviceId: ID, today: string) {
  const s = db.services.find((x) => x.id === serviceId)!;
  const price = servicePriceAt(s, unitId);
  const offer = advertisedOffer(db, s.id, unitId, today);
  const reviews = db.reviews.filter((r) => r.serviceId === s.id && r.unitId === unitId);
  const rating = ratingOf(reviews);
  return {
    id: s.id,
    name: s.name,
    categoryId: s.categoryId,
    summary: s.summary,
    durationMin: s.durationMin,
    price,
    offer: offer
      ? { id: offer.id, name: offer.name, type: offer.type, value: offer.value, price: price - discountFor(offer, price), weekdays: offer.weekdays, end: offer.end }
      : null,
    rating: rating.avg,
    ratingCount: rating.count,
    isNew: s.isNew,
    media: s.media,
    sold: s.soldCount,
    allowFavorites: s.allowFavorites,
  };
}

export const unitCatalog = (db: DB, raw: unknown, ctx: RequestCtx) => {
  const input = z.object({ unitId: z.string() }).parse(raw);
  const unit = getUnit(db, input.unitId);
  const today = datePart(ctx.now);
  const services = db.services
    .filter((s) => s.status === "active" && s.units.some((u) => u.unitId === unit.id))
    .map((s) => serviceCard(db, unit.id, s.id, today));
  const products = db.products
    .filter((p) => p.sellOnline && p.units.some((u) => u.unitId === unit.id))
    .map((p) => {
      const reviews = db.reviews.filter((r) => r.productId === p.id && r.productRating);
      return {
        id: p.id,
        name: p.name,
        detail: p.detail,
        badge: p.badge ?? null,
        categoryId: p.categoryId,
        price: productPriceAt(p, unit.id),
        available: p.available,
        media: p.media,
        rating: ratingOf(reviews.map((r) => ({ ...r, serviceRating: r.productRating! }))).avg,
        sold: p.soldOnline,
      };
    });
  const cats = (kind: "service" | "product") =>
    db.categories
      .filter((c) => c.kind === kind)
      .sort((a, b) => a.order - b.order)
      .map((c) => ({
        id: c.id,
        name: c.name,
        count: (kind === "service" ? services : products).filter((x) => x.categoryId === c.id).length,
        from: Math.min(...(kind === "service" ? services : products).filter((x) => x.categoryId === c.id).map((x) => x.price)),
      }))
      .filter((c) => c.count > 0);
  const pros = db.users
    .filter((u) => u.roles.includes("professional") && u.unitId === unit.id && u.status === "active")
    .map((u) => {
      const r = ratingOf(db.reviews.filter((x) => x.professionalId === u.id), "proRating");
      return {
        id: u.id,
        name: fullName(u),
        firstName: u.firstName,
        about: u.about,
        rating: r.avg,
        ratingCount: r.count,
        since: u.since,
        served: db.orders.filter((o) => o.professionalId === u.id && o.status === "completed").length,
        services: services.filter((s) => db.services.find((x) => x.id === s.id)!.units.find((l) => l.unitId === unit.id)?.professionalIds.includes(u.id)).map((s) => s.id),
      };
    });
  // next free slot today (or the next open day)
  let nextFree: { date: string; time: string } | null = null;
  const popular = [...services].sort((a, b) => b.sold - a.sold)[0];
  if (popular) {
    for (let i = 0; i < 7 && !nextFree; i++) {
      const date = addDays(today, i);
      const slot = daySlots(db, unit.id, [popular.id], date, ctx.now, 10).find((s) => s.free.length);
      if (slot) nextFree = { date, time: slot.time };
    }
  }
  const unitReviews = db.reviews.filter((r) => r.unitId === unit.id);
  const h = unitHoursOn(unit, today);
  const nowT = ctx.now.slice(11);
  return {
    unit,
    openNow: !!h && nowT >= h.start && nowT < h.end,
    todayHours: h,
    services,
    products,
    categories: cats("service"),
    productTypes: cats("product"),
    pros,
    nextFree,
    rating: ratingOf(unitReviews).avg,
    ratingCount: unitReviews.length,
    homeReviews: unitReviews
      .filter((r) => r.onHome)
      .slice(0, 8)
      .map((r) => ({ ...r, serviceName: db.services.find((s) => s.id === r.serviceId)?.name ?? "", proName: db.users.find((u) => u.id === r.professionalId)?.firstName ?? "" })),
    offers: db.offers
      .filter((o) => o.unitId === unit.id && !o.endedAt && o.end >= today && o.start <= today)
      .map((o) => ({ ...o, daysLeft: Math.max(0, Math.round((epochMin(`${o.end}T23:59`) - epochMin(ctx.now)) / 1440)) })),
  };
};

export const serviceDetail = (db: DB, raw: unknown, ctx: RequestCtx) => {
  const input = z.object({ unitId: z.string(), serviceId: z.string() }).parse(raw);
  const s = db.services.find((x) => x.id === input.serviceId);
  if (!s || !s.units.some((u) => u.unitId === input.unitId)) fail("service_unavailable");
  const today = datePart(ctx.now);
  const link = s!.units.find((u) => u.unitId === input.unitId)!;
  return {
    card: serviceCard(db, input.unitId, s!.id, today),
    description: s!.description,
    pros: link.professionalIds
      .map((id) => db.users.find((u) => u.id === id))
      .filter(Boolean)
      .map((u) => ({ id: u!.id, name: fullName(u!), rating: ratingOf(db.reviews.filter((r) => r.professionalId === u!.id), "proRating").avg })),
    reviews: db.reviews
      .filter((r) => r.serviceId === s!.id && r.unitId === input.unitId)
      .slice(0, 6)
      .map((r) => ({ ...r, proName: db.users.find((u) => u.id === r.professionalId)?.firstName ?? "" })),
  };
};

export const availabilityMonth = (db: DB, raw: unknown, ctx: RequestCtx) => {
  const input = z.object({ unitId: z.string(), serviceIds: z.array(z.string()), month: z.string() }).parse(raw);
  return { days: monthDays(db, input.unitId, input.serviceIds, input.month, ctx.now), durationMin: servicesDuration(db, input.serviceIds) };
};

export const availabilityDay = (db: DB, raw: unknown, ctx: RequestCtx) => {
  const input = z.object({ unitId: z.string(), serviceIds: z.array(z.string()), date: z.string(), proId: z.string().nullable().optional() }).parse(raw);
  const slots = daySlots(db, input.unitId, input.serviceIds, input.date, ctx.now);
  const today = datePart(ctx.now);
  const discount = input.serviceIds.reduce((s, id) => {
    const svc = db.services.find((x) => x.id === id);
    const offer = offerFor(db, id, input.unitId, input.date, today);
    return svc && offer ? s + discountFor(offer, servicePriceAt(svc, input.unitId)) : s;
  }, 0);
  return {
    slots: input.proId ? slots.map((s) => ({ ...s, free: s.free.filter((p) => p === input.proId) })) : slots,
    durationMin: servicesDuration(db, input.serviceIds),
    discount,
  };
};

export const availabilityPros = (db: DB, raw: unknown) => {
  const input = z.object({ unitId: z.string(), serviceIds: z.array(z.string()), start: z.string() }).parse(raw);
  const unit = getUnit(db, input.unitId);
  const dur = servicesDuration(db, input.serviceIds);
  return eligiblePros(db, input.unitId, input.serviceIds).map((p) => {
    const free = canFit(db, p, unit, input.start, dur);
    return {
      id: p.id,
      name: fullName(p),
      rating: ratingOf(db.reviews.filter((r) => r.professionalId === p.id), "proRating").avg,
      free,
      busyUntil: free ? null : busyUntil(db, p, input.start),
      off: !free && !busyUntil(db, p, input.start),
    };
  });
};

function clientOrderView(db: DB, o: Order, now: string) {
  const unit = db.units.find((u) => u.id === o.unitId)!;
  const pro = db.users.find((u) => u.id === o.professionalId);
  const late = lateInfo(db, o, now);
  const canCancel = ["awaiting_payment", "paid"].includes(o.status) && (!o.start || epochMin(now) < epochMin(o.start));
  return {
    id: o.id,
    code: o.code,
    unitId: o.unitId,
    unitName: unit.name,
    unitSlug: unit.slug,
    unitAddress: unit.address,
    unitPhone: unit.phone,
    status: o.status,
    state: liveState(o, now),
    start: o.start,
    end: o.start ? addMinutes(o.start, orderDuration(o)) : null,
    durationMin: orderDuration(o),
    pro: pro ? { id: pro.id, name: fullName(pro), firstName: pro.firstName, chair: pro.chair ?? null } : null,
    items: o.items,
    discount: o.discount,
    total: orderTotal(o),
    paid: paidAmount(o),
    balance: balanceDue(o),
    refunded: o.refunded,
    method: o.payments[0]?.method ?? o.chosenMethod ?? null,
    payments: o.payments,
    timeline: o.timeline,
    startedAt: o.startedAt ?? null,
    completedAt: o.completedAt ?? null,
    // only shown once the service started
    completionCode: o.status === "in_service" ? o.completionCode : null,
    canCancel,
    cancelFee: canCancel ? Math.min(paidAmount(o), db.settings.payment.cancelFee) : 0,
    late,
    reviewed: !!o.reviewed,
    hasServices: hasServices(o),
    holdUntil: o.holdUntil ?? null,
    anyProfessional: !!o.anyProfessional,
  };
}

export const clientOrders = (db: DB, _raw: unknown, ctx: RequestCtx) => {
  const me = actor(db, ctx);
  const mine = db.orders.filter((o) => o.clientId === me.id && o.status !== "cart");
  const views = mine.map((o) => clientOrderView(db, o, ctx.now));
  const upcoming = views
    .filter((v) => ["awaiting_payment", "paid", "in_service"].includes(v.status))
    .sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""));
  const history = views
    .filter((v) => !["awaiting_payment", "paid", "in_service"].includes(v.status))
    .sort((a, b) => (b.start ?? b.timeline[0]?.at ?? "").localeCompare(a.start ?? a.timeline[0]?.at ?? ""));
  return { upcoming, history, toReview: history.find((v) => v.status === "completed" && !v.reviewed && v.hasServices) ?? null };
};

export const clientOrder = (db: DB, raw: unknown, ctx: RequestCtx) => {
  const input = z.object({ id: z.string() }).parse(raw);
  const me = actor(db, ctx);
  const o = getOrder(db, input.id);
  if (o.clientId !== me.id) fail("forbidden");
  return clientOrderView(db, o, ctx.now);
};

export const clientCart = (db: DB, raw: unknown, ctx: RequestCtx) => {
  const input = z.object({ unitId: z.string() }).parse(raw);
  const me = actor(db, ctx);
  const o = db.orders.find((x) => x.clientId === me.id && x.unitId === input.unitId && (x.status === "cart" || (x.status === "awaiting_payment" && x.payments.length === 0 && x.chosenMethod !== "cash" && !!x.holdUntil)));
  if (!o) return null;
  const today = datePart(ctx.now);
  const suggestions = db.products
    .filter((p) => p.available && p.sellOnline && p.units.some((u) => u.unitId === input.unitId) && !o.items.some((i) => i.refId === p.id))
    .slice(0, 2)
    .map((p) => ({ id: p.id, name: p.name, price: productPriceAt(p, input.unitId) }));
  const items = o.items.map((i) => {
    const offer = i.kind === "service" ? db.offers.find((x) => x.unitId === o.unitId && x.serviceIds.includes(i.refId) && !x.endedAt && x.end >= today) : null;
    return { ...i, offerHint: offer ? { name: offer.name, weekdays: offer.weekdays, type: offer.type, value: offer.value } : null };
  });
  return {
    orderId: o.id,
    status: o.status,
    items,
    subtotal: o.items.reduce((s, i) => s + i.unitPrice * i.qty, 0),
    discount: o.discount,
    total: orderTotal(o),
    durationMin: orderDuration(o),
    hasServices: hasServices(o),
    start: o.start,
    professionalId: o.professionalId,
    proName: o.professionalId ? fullName(db.users.find((u) => u.id === o.professionalId)!) : null,
    anyProfessional: !!o.anyProfessional,
    holdUntil: o.holdUntil ?? null,
    count: o.items.reduce((s, i) => s + i.qty, 0),
    suggestions,
    methods: db.settings.payment.methods,
    installments: db.settings.payment.installments,
    minInstallment: db.settings.payment.minInstallment,
    cancelFee: db.settings.payment.cancelFee,
  };
};

export const clientProfile = (db: DB, _raw: unknown, ctx: RequestCtx) => {
  const me = actor(db, ctx);
  return {
    user: me,
    orders: db.orders.filter((o) => o.clientId === me.id && o.status === "completed").length,
    favorites: me.favorites.services.length + me.favorites.products.length + me.favorites.professionals.length,
    reviews: db.reviews.filter((r) => r.clientId === me.id).length,
    termsVersion: db.settings.policies.terms.version,
  };
};

export const clientConversation = (db: DB, raw: unknown, ctx: RequestCtx) => {
  const input = z.object({ unitId: z.string() }).parse(raw);
  const me = actor(db, ctx);
  const unit = getUnit(db, input.unitId);
  const c = db.conversations.find((x) => x.clientId === me.id && x.unitId === input.unitId) ?? null;
  return {
    unitName: unit.name,
    whatsapp: unit.whatsapp,
    connected: unit.whatsappConnected,
    greeting: unit.ai.greeting,
    assistantName: unit.ai.assistantName,
    conversation: c ? { ...c, messages: c.messages.map((m) => ({ ...m, byName: m.by ? db.users.find((u) => u.id === m.by)?.firstName ?? null : null })) } : null,
  };
};

export const productDetail = (db: DB, raw: unknown) => {
  const input = z.object({ unitId: z.string(), productId: z.string() }).parse(raw);
  const p = db.products.find((x) => x.id === input.productId);
  if (!p || !p.units.some((u) => u.unitId === input.unitId)) fail("product_unavailable");
  const reviews = db.reviews.filter((r) => r.productId === p!.id && r.productRating);
  return {
    product: { ...p!, price: productPriceAt(p!, input.unitId) },
    rating: ratingOf(reviews.map((r) => ({ ...r, serviceRating: r.productRating! }))),
    reviews: reviews.slice(0, 4),
    related: db.products
      .filter((x) => x.id !== p!.id && x.categoryId === p!.categoryId && x.units.some((u) => u.unitId === input.unitId) && x.sellOnline)
      .slice(0, 4)
      .map((x) => ({ id: x.id, name: x.name, price: productPriceAt(x, input.unitId), available: x.available })),
  };
};

export const professionalDetail = (db: DB, raw: unknown) => {
  const input = z.object({ id: z.string() }).parse(raw);
  const u = db.users.find((x) => x.id === input.id && x.roles.includes("professional"));
  if (!u) fail("user_not_found");
  const reviews = db.reviews.filter((r) => r.professionalId === u!.id);
  return {
    id: u!.id,
    name: fullName(u!),
    firstName: u!.firstName,
    about: u!.about,
    since: u!.since,
    unitId: u!.unitId,
    rating: ratingOf(reviews, "proRating"),
    served: db.orders.filter((o) => o.professionalId === u!.id && o.status === "completed").length,
    services: db.services
      .filter((s) => s.status === "active" && s.units.some((l) => l.unitId === u!.unitId && l.professionalIds.includes(u!.id)))
      .map((s) => ({ id: s.id, name: s.name })),
    reviews: reviews.filter((r) => r.text).slice(0, 4).map((r) => ({ ...r, serviceName: db.services.find((s) => s.id === r.serviceId)?.name ?? "" })),
  };
};

