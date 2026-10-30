import { orderDuration, proHoursOn } from "@/lib/domain/rules";
import { addDays, datePart, diffDays, epochMin, toMinutes } from "@/lib/domain/time";
import type { DateStr, DB, ID, Order, Review } from "@/lib/domain/types";

export const REALIZED = ["completed", "paid", "in_service", "no_show"] as const;

export const orderDate = (o: Order): DateStr => datePart(o.start ?? o.createdAt);

export function inPeriod(o: Order, from: DateStr, to: DateStr) {
  const d = orderDate(o);
  return d >= from && d <= to;
}

export function isRealized(o: Order) {
  return (REALIZED as readonly string[]).includes(o.status);
}

export function previousPeriod(from: DateStr, to: DateStr) {
  const days = diffDays(to, from) + 1;
  return { from: addDays(from, -days), to: addDays(from, -1), days };
}

export function avg(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

export function ratingOf(reviews: Review[], key: "serviceRating" | "proRating" = "serviceRating") {
  const vals = reviews.map((r) => r[key]).filter((x): x is number => typeof x === "number");
  return { avg: Math.round(avg(vals) * 10) / 10, count: vals.length };
}

/** Booked minutes / available minutes of the unit's professionals over a period. */
export function occupancy(db: DB, unitId: ID | null, from: DateStr, to: DateStr, proId?: ID) {
  let available = 0;
  let booked = 0;
  const pros = db.users.filter(
    (u) => u.roles.includes("professional") && u.status === "active" && (proId ? u.id === proId : !unitId || u.unitId === unitId),
  );
  for (let d = from; d <= to; d = addDays(d, 1)) {
    for (const pro of pros) {
      const unit = db.units.find((x) => x.id === pro.unitId);
      if (!unit) continue;
      const h = proHoursOn(pro, unit, d);
      if (!h) continue;
      let min = toMinutes(h.end) - toMinutes(h.start);
      if (h.breakStart && h.breakEnd) min -= toMinutes(h.breakEnd) - toMinutes(h.breakStart);
      available += Math.max(0, min);
    }
  }
  for (const o of db.orders) {
    if (!o.start || !o.professionalId || !pros.some((p) => p.id === o.professionalId)) continue;
    if (!["completed", "paid", "in_service", "awaiting_payment"].includes(o.status)) continue;
    const d = datePart(o.start);
    if (d < from || d > to) continue;
    booked += orderDuration(o);
  }
  return { available, booked, pct: available ? Math.round((booked / available) * 100) : 0 };
}

export function minutesBetween(a: string, b: string) {
  return epochMin(b) - epochMin(a);
}

