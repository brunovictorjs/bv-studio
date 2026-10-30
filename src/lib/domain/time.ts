import type { DateStr, DateTimeStr, TimeStr } from "./types";

/** Naive local date-time helpers. Everything is computed as if it were UTC so
 * the result never depends on the machine's timezone. */

const pad = (n: number) => String(n).padStart(2, "0");

export function toMinutes(t: TimeStr): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function fromMinutes(min: number): TimeStr {
  const m = ((min % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

export function datePart(dt: DateTimeStr): DateStr {
  return dt.slice(0, 10);
}

export function timePart(dt: DateTimeStr): TimeStr {
  return dt.slice(11, 16);
}

export function join(date: DateStr, time: TimeStr): DateTimeStr {
  return `${date}T${time}`;
}

/** Epoch minutes for a naive date-time. */
export function epochMin(dt: DateTimeStr): number {
  const [d, t = "00:00"] = dt.split("T");
  const [y, mo, da] = d.split("-").map(Number);
  const [h, mi] = t.split(":").map(Number);
  return Date.UTC(y, mo - 1, da, h, mi) / 60000;
}

export function fromEpochMin(min: number): DateTimeStr {
  const d = new Date(min * 60000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(
    d.getUTCHours(),
  )}:${pad(d.getUTCMinutes())}`;
}

export function addMinutes(dt: DateTimeStr, min: number): DateTimeStr {
  return fromEpochMin(epochMin(dt) + min);
}

export function addDays(date: DateStr, days: number): DateStr {
  return datePart(fromEpochMin(epochMin(`${date}T00:00`) + days * 1440));
}

export function diffMin(a: DateTimeStr, b: DateTimeStr): number {
  return epochMin(a) - epochMin(b);
}

export function diffDays(a: DateStr, b: DateStr): number {
  return Math.round((epochMin(`${a}T00:00`) - epochMin(`${b}T00:00`)) / 1440);
}

/** 0 = Sunday */
export function weekday(date: DateStr): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function startOfMonth(date: DateStr): DateStr {
  return `${date.slice(0, 7)}-01`;
}

export function daysInMonth(date: DateStr): number {
  const [y, m] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function addMonths(date: DateStr, n: number): DateStr {
  const [y, m] = date.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-01`;
}

export function inRange(date: DateStr, start: DateStr, end: DateStr): boolean {
  return date >= start && date <= end;
}

/** Overlap of [aStart, aEnd) and [bStart, bEnd) in epoch minutes. */
export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function nowLocal(): DateTimeStr {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export function durationLabel(min: number, locale: "pt" | "en" = "pt"): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return locale === "pt" ? `${h}h` : `${h}h`;
  return `${h}h${pad(m)}`;
}

/** Parses "2h30", "50 min", "1h", "90" into minutes. */
export function parseDuration(input: string): number | null {
  const s = input.trim().toLowerCase().replace(/\s/g, "");
  if (!s) return null;
  const hm = s.match(/^(\d+)h(\d{1,2})?(min)?$/);
  if (hm) return Number(hm[1]) * 60 + Number(hm[2] || 0);
  const m = s.match(/^(\d+)(min|m)?$/);
  if (m) return Number(m[1]);
  return null;
}
