import { orderDuration, proHoursOn, unitHoursOn } from "@/lib/domain/rules";
import {
  addDays,
  addMinutes,
  datePart,
  daysInMonth,
  epochMin,
  fromEpochMin,
  fromMinutes,
  join,
  startOfMonth,
  toMinutes,
} from "@/lib/domain/time";
import type { DateStr, DateTimeStr, DB, ID, Order, Service, Unit, User } from "@/lib/domain/types";

/** Orders that hold time on a professional's agenda. */
export function blocksTime(o: Order): boolean {
  return !!o.start && !!o.professionalId && !["cart", "cancelled", "no_show"].includes(o.status);
}

export function proOrdersOn(db: DB, proId: ID, date: DateStr, excludeId?: ID): Order[] {
  return db.orders.filter(
    (o) => o.professionalId === proId && o.id !== excludeId && blocksTime(o) && datePart(o.start!) === date,
  );
}

export function eligiblePros(db: DB, unitId: ID, serviceIds: ID[]): User[] {
  const services = serviceIds.map((id) => db.services.find((s) => s.id === id)).filter(Boolean) as Service[];
  return db.users.filter(
    (u) =>
      u.roles.includes("professional") &&
      u.status === "active" &&
      u.unitId === unitId &&
      services.every((s) => s.units.find((l) => l.unitId === unitId)?.professionalIds.includes(u.id)),
  );
}

export function servicesDuration(db: DB, serviceIds: ID[]): number {
  return serviceIds.reduce((s, id) => s + (db.services.find((x) => x.id === id)?.durationMin ?? 0), 0);
}

/** Can `pro` take [start, start+dur) at `unit`? */
export function canFit(
  db: DB,
  pro: User,
  unit: Unit,
  start: DateTimeStr,
  dur: number,
  opts: { excludeId?: ID; ignoreBreak?: boolean } = {},
): boolean {
  const date = datePart(start);
  const h = proHoursOn(pro, unit, date);
  if (!h) return false;
  const s = epochMin(start);
  const e = s + dur;
  const open = epochMin(join(date, h.start));
  const close = epochMin(join(date, h.end));
  if (s < open || e > close) return false;
  if (!opts.ignoreBreak && h.breakStart && h.breakEnd) {
    const bs = epochMin(join(date, h.breakStart));
    const be = epochMin(join(date, h.breakEnd));
    if (s < be && bs < e) return false;
  }
  // partial closed periods (doctor appointment etc.)
  for (const p of pro.periods) {
    if (p.type !== "closed") continue;
    if (s < epochMin(p.end) && epochMin(p.start) < e) return false;
  }
  for (const o of proOrdersOn(db, pro.id, date, opts.excludeId)) {
    const os = epochMin(o.start!);
    const oe = os + Math.max(orderDuration(o), 10);
    if (s < oe && os < e) return false;
  }
  return true;
}

/** First start ≥ `from` (5-minute grid) where the pro fits `dur` minutes, same day. */
export function nextGap(db: DB, pro: User, unit: Unit, from: DateTimeStr, dur: number, excludeId?: ID): DateTimeStr | null {
  const date = datePart(from);
  const h = proHoursOn(pro, unit, date);
  if (!h) return null;
  let t = Math.ceil(epochMin(from) / 5) * 5;
  const close = epochMin(join(date, h.end));
  while (t + dur <= close) {
    const start = fromEpochMin(t);
    if (canFit(db, pro, unit, start, dur, { excludeId })) return start;
    t += 5;
  }
  return null;
}

export interface Slot {
  time: string;
  free: ID[];
}

export function daySlots(db: DB, unitId: ID, serviceIds: ID[], date: DateStr, now: DateTimeStr, step = 30): Slot[] {
  const unit = db.units.find((u) => u.id === unitId);
  if (!unit) return [];
  const h = unitHoursOn(unit, date);
  if (!h) return [];
  const dur = Math.max(servicesDuration(db, serviceIds), 10);
  const pros = eligiblePros(db, unitId, serviceIds);
  const slots: Slot[] = [];
  for (let t = toMinutes(h.start); t + dur <= toMinutes(h.end); t += step) {
    const start = join(date, fromMinutes(t));
    if (epochMin(start) <= epochMin(now) + 15) continue;
    if (h.breakStart && h.breakEnd && t >= toMinutes(h.breakStart) && t < toMinutes(h.breakEnd)) continue;
    const free = pros.filter((p) => canFit(db, p, unit, start, dur)).map((p) => p.id);
    slots.push({ time: fromMinutes(t), free });
  }
  return slots;
}

export type DayState = "past" | "closed" | "full" | "free";

export function monthDays(db: DB, unitId: ID, serviceIds: ID[], month: DateStr, now: DateTimeStr) {
  const first = startOfMonth(month);
  const today = datePart(now);
  const unit = db.units.find((u) => u.id === unitId);
  const days: { date: DateStr; state: DayState }[] = [];
  for (let i = 0; i < daysInMonth(first); i++) {
    const date = addDays(first, i);
    let state: DayState;
    if (date < today) state = "past";
    else if (!unit || !unitHoursOn(unit, date)) state = "closed";
    else state = daySlots(db, unitId, serviceIds, date, now).some((s) => s.free.length) ? "free" : "full";
    days.push({ date, state });
  }
  return days;
}

/** For "any professional": the free one with the lightest day. */
export function pickProfessional(db: DB, unitId: ID, serviceIds: ID[], start: DateTimeStr): User | null {
  const unit = db.units.find((u) => u.id === unitId);
  if (!unit) return null;
  const dur = servicesDuration(db, serviceIds);
  const free = eligiblePros(db, unitId, serviceIds).filter((p) => canFit(db, p, unit, start, dur));
  free.sort((a, b) => proOrdersOn(db, a.id, datePart(start)).length - proOrdersOn(db, b.id, datePart(start)).length);
  return free[0] ?? null;
}

/** Busy-until hint for a pro that is taken at `start` ("Ocupada até 11h10"). */
export function busyUntil(db: DB, pro: User, start: DateTimeStr): string | null {
  const s = epochMin(start);
  const o = proOrdersOn(db, pro.id, datePart(start)).find((x) => {
    const os = epochMin(x.start!);
    return os <= s && s < os + orderDuration(x);
  });
  return o ? addMinutes(o.start!, orderDuration(o)).slice(11) : null;
}

export interface LateInfo {
  minutesLate: number;
  fitAt: DateTimeStr | null;
  deadline: DateTimeStr;
  queuePos: number;
  refundable: boolean;
}

/** Late client: when can they still be fitted in, and when does it become a no-show. */
export function lateInfo(db: DB, o: Order, now: DateTimeStr): LateInfo | null {
  if (!o.start || !o.professionalId || !["paid", "awaiting_payment"].includes(o.status)) return null;
  if (epochMin(now) <= epochMin(o.start)) return null;
  const unit = db.units.find((u) => u.id === o.unitId)!;
  const pro = db.users.find((u) => u.id === o.professionalId)!;
  const deadline = addMinutes(o.start, unit.lateToleranceMin);
  const fitAt = nextGap(db, pro, unit, now, orderDuration(o), o.id);
  const lateOnes = db.orders.filter(
    (x) =>
      x.unitId === o.unitId &&
      x.start &&
      datePart(x.start) === datePart(now) &&
      ["paid", "awaiting_payment"].includes(x.status) &&
      epochMin(x.start) < epochMin(now),
  );
  lateOnes.sort((a, b) => a.start!.localeCompare(b.start!));
  return {
    minutesLate: epochMin(now) - epochMin(o.start),
    fitAt,
    deadline,
    queuePos: lateOnes.findIndex((x) => x.id === o.id) + 1,
    refundable: false,
  };
}
