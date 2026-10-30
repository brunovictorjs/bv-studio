import type {
  Cents,
  DateStr,
  DateTimeStr,
  DB,
  DayHours,
  Offer,
  Order,
  OrderItem,
  PaymentMethod,
  Product,
  Service,
  Settings,
  Unit,
  User,
} from "./types";
import { addMinutes, datePart, epochMin, inRange, weekday } from "./time";

/**
 * Pure business rules shared by the API handlers and the seed generator.
 * Nothing here touches storage — the handlers in src/server own mutations.
 */

export const ONLINE_METHODS: PaymentMethod[] = ["pix", "credit", "debit"];
export const COUNTER_METHODS: PaymentMethod[] = ["cash", "store_pix", "pos_debit", "pos_credit"];

export function itemsTotal(items: OrderItem[]): Cents {
  return items.reduce((s, i) => s + i.unitPrice * i.qty, 0);
}

export function orderTotal(o: Pick<Order, "items" | "discount">): Cents {
  return Math.max(0, itemsTotal(o.items) - o.discount);
}

export function paidAmount(o: Pick<Order, "payments">): Cents {
  return o.payments.reduce((s, p) => s + p.amount, 0);
}

export function balanceDue(o: Order): Cents {
  if (o.status === "cancelled" || o.status === "cart") return 0;
  return Math.max(0, orderTotal(o) - paidAmount(o));
}

export function orderDuration(o: Pick<Order, "items">): number {
  return o.items.filter((i) => i.kind === "service").reduce((s, i) => s + i.durationMin * i.qty, 0);
}

export function orderEnd(o: Order): DateTimeStr | null {
  if (!o.start) return null;
  return addMinutes(o.start, Math.max(orderDuration(o), 10));
}

export function hasServices(o: Pick<Order, "items">): boolean {
  return o.items.some((i) => i.kind === "service");
}

export function stripeFee(method: PaymentMethod, amount: Cents, s: Settings): Cents {
  const f = s.payment.fees;
  if (method === "pix") return Math.round((amount * f.pixPct) / 100);
  if (method === "credit") return Math.round((amount * f.creditPct) / 100) + f.creditFixed;
  if (method === "debit") return Math.round((amount * f.debitPct) / 100);
  return 0;
}

export function unitHoursOn(unit: Unit, date: DateStr): DayHours | null {
  if (!unit.active) return null;
  if (unit.closures.some((c) => inRange(date, c.start, c.end))) return null;
  const h = unit.hours[weekday(date)];
  return h && h.open ? h : null;
}

/** Working window of a professional on a date, clipped by the unit hours. */
export function proHoursOn(pro: User, unit: Unit, date: DateStr): DayHours | null {
  const unitH = unitHoursOn(unit, date);
  const own = pro.schedule ? pro.schedule[weekday(date)] : null;
  let h: DayHours | null = unitH;
  if (pro.schedule) {
    if (!own || !own.open || !unitH) h = null;
    else
      h = {
        open: true,
        start: own.start > unitH.start ? own.start : unitH.start,
        end: own.end < unitH.end ? own.end : unitH.end,
        breakStart: unitH.breakStart,
        breakEnd: unitH.breakEnd,
      };
  }
  // closed periods (vacation) remove the whole overlap
  const dayStart = epochMin(`${date}T00:00`);
  const closedAllDay = pro.periods.some(
    (p) =>
      p.type === "closed" && epochMin(p.start) <= dayStart && epochMin(p.end) >= dayStart + 1439,
  );
  if (closedAllDay) return null;
  // extra shifts open a window even on a closed day (inside the unit hours when there are any)
  const extra = pro.periods.find((p) => p.type === "extra" && datePart(p.start) === date);
  if (!h && extra) {
    return { open: true, start: extra.start.slice(11, 16), end: extra.end.slice(11, 16) };
  }
  return h;
}

export function servicePriceAt(service: Service, unitId: string): Cents {
  const link = service.units.find((u) => u.unitId === unitId);
  return link?.price ?? service.price;
}

export function productPriceAt(product: Product, unitId: string): Cents {
  const link = product.units.find((u) => u.unitId === unitId);
  return link?.price ?? product.price;
}

export type OfferState = "active" | "scheduled" | "ended";

export function offerState(o: Offer, today: DateStr): OfferState {
  if (o.endedAt) return "ended";
  if (o.usageLimit != null && o.uses >= o.usageLimit) return "ended";
  if (today > o.end) return "ended";
  if (today < o.start) return "scheduled";
  return "active";
}

/** Offer that applies to a service at a unit on a given date (null when none). */
export function offerFor(db: DB, serviceId: string, unitId: string, date: DateStr, today: DateStr): Offer | null {
  return (
    db.offers.find(
      (o) =>
        o.unitId === unitId &&
        o.serviceIds.includes(serviceId) &&
        offerState(o, today) !== "ended" &&
        inRange(date, o.start, o.end) &&
        o.weekdays.includes(weekday(date)),
    ) ?? null
  );
}

/** Best offer currently advertised for a service (ignores the booking day). */
export function advertisedOffer(db: DB, serviceId: string, unitId: string, today: DateStr): Offer | null {
  return (
    db.offers.find(
      (o) =>
        o.unitId === unitId && o.serviceIds.includes(serviceId) && offerState(o, today) === "active",
    ) ?? null
  );
}

export function discountFor(offer: Offer, price: Cents): Cents {
  if (offer.type === "percent") return Math.round((price * offer.value) / 100);
  return Math.min(price, offer.value);
}

export function commissionPctFor(db: DB, pro: User, unitId: string, categoryId: string): number {
  const ex = db.settings.commissions.exceptions.find((e) => e.unitId === unitId && e.categoryId === categoryId);
  if (ex) return ex.pct;
  return pro.commission?.exec ?? db.settings.commissions.defaultExec;
}

export interface CommissionBreakdown {
  exec: Cents;
  execBase: Cents;
  execPct: number;
  product: Cents;
  productBase: Cents;
  productPct: number;
  total: Cents;
}

/** Commission owed to the order's professional, following the settings rules. */
export function orderCommission(db: DB, o: Order): CommissionBreakdown {
  const zero: CommissionBreakdown = {
    exec: 0,
    execBase: 0,
    execPct: 0,
    product: 0,
    productBase: 0,
    productPct: 0,
    total: 0,
  };
  const pro = db.users.find((u) => u.id === o.professionalId);
  if (!pro) return zero;
  const rules = db.settings.commissions.rules;
  if (o.status === "cancelled") {
    if (!rules.refunded) return zero;
  } else if (o.status === "no_show") {
    if (!rules.noShow) return zero;
  } else if (o.status !== "completed") return zero;

  const services = o.items.filter((i) => i.kind === "service");
  const servicesGross = itemsTotal(services);
  const discountShare = servicesGross > 0 ? Math.min(o.discount, servicesGross) : 0;
  let exec = 0;
  let execBase = 0;
  let weightedPct = 0;
  for (const it of services) {
    const svc = db.services.find((s) => s.id === it.refId);
    const gross = it.unitPrice * it.qty;
    const share = servicesGross ? Math.round((gross / servicesGross) * discountShare) : 0;
    const base = gross - share;
    const pct = svc ? commissionPctFor(db, pro, o.unitId, svc.categoryId) : pro.commission?.exec ?? 55;
    exec += Math.round((base * pct) / 100);
    execBase += base;
    weightedPct += pct * base;
  }
  const productPct = pro.commission?.product ?? db.settings.commissions.defaultProduct;
  const productItems = o.items.filter(
    (i) =>
      i.kind === "product" &&
      ((i.addedBy && rules.productByPro) || (!i.addedBy && rules.productOnline && o.professionalId)),
  );
  const productBase = itemsTotal(productItems);
  const product = Math.round((productBase * productPct) / 100);
  return {
    exec,
    execBase,
    execPct: execBase ? Math.round(weightedPct / execBase) : pro.commission?.exec ?? 0,
    product,
    productBase,
    productPct,
    total: exec + product,
  };
}

export function orderFees(o: Order): Cents {
  return o.payments.reduce((s, p) => s + p.fee, 0);
}

/** Display state that also folds in lateness (not stored). */
export type LiveState =
  | "cart"
  | "awaiting_payment"
  | "paid"
  | "late"
  | "in_service"
  | "completed"
  | "cancelled"
  | "no_show"
  | "pickup";

export function liveState(o: Order, now: DateTimeStr): LiveState {
  if ((o.status === "paid" || o.status === "awaiting_payment") && o.start && epochMin(now) > epochMin(o.start)) {
    return "late";
  }
  if (o.status === "paid" && !o.start) return "pickup";
  return o.status;
}

export const CODE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
export const CODE_DIGITS = "0123456789";
