import { CODE_DIGITS, CODE_LETTERS } from "@/lib/domain/rules";
import type { DB } from "@/lib/domain/types";

export type Rng = () => number;

/** Deterministic PRNG so the demo data is stable between resets on the same day. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const pick = <T>(rng: Rng, list: readonly T[]): T => list[Math.floor(rng() * list.length)];

export function uid(prefix: string, rng: Rng = Math.random): string {
  return `${prefix}-${Math.floor(rng() * 36 ** 8)
    .toString(36)
    .padStart(8, "0")}`;
}

/** Order codes alternate digit/letter (7F2K9) so the pro keypad can switch modes on its own. */
export function newOrderCode(db: Pick<DB, "orders">, rng: Rng = Math.random): string {
  for (;;) {
    let s = "";
    for (let i = 0; i < 5; i++) s += i % 2 === 0 ? pick(rng, CODE_DIGITS.split("")) : pick(rng, CODE_LETTERS.split(""));
    const code = `BV-${s}`;
    if (!db.orders.some((o) => o.code === code)) return code;
  }
}

export function newCompletionCode(rng: Rng = Math.random): string {
  return `OK-${String(Math.floor(rng() * 9000) + 1000)}`;
}

export function newWalkinCode(db: DB): string {
  db.counters.walkin += 1;
  return `AVL-${String(db.counters.walkin).padStart(4, "0")}`;
}
