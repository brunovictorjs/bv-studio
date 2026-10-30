import type { Currency, LText, Locale } from "./types";

export function tx(value: LText | null | undefined, locale: Locale): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  return value[locale] ?? value.pt;
}

export const L = (pt: string, en: string): LText => ({ pt, en });

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function matches(haystack: string, query: string): boolean {
  const q = normalize(query.trim());
  return !q || normalize(haystack).includes(q);
}

export function resolveCurrency(currency: Currency, locale: Locale): "BRL" | "USD" | "EUR" {
  if (currency !== "auto") return currency;
  return locale === "pt" ? "BRL" : "USD";
}

export function formatMoney(
  cents: number,
  locale: Locale,
  currency: Currency = "auto",
  opts: { compact?: boolean; decimals?: "auto" | "always" } = {},
): string {
  const cur = resolveCurrency(currency, locale);
  const loc = locale === "pt" ? "pt-BR" : "en-US";
  const value = cents / 100;
  if (opts.compact && Math.abs(value) >= 1000) {
    return new Intl.NumberFormat(loc, {
      style: "currency",
      currency: cur,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }
  const whole = cents % 100 === 0;
  const fd = opts.decimals === "always" ? 2 : whole ? 0 : 2;
  return new Intl.NumberFormat(loc, {
    style: "currency",
    currency: cur,
    minimumFractionDigits: fd,
    maximumFractionDigits: fd,
  }).format(value);
}

export function formatPct(value: number, locale: Locale, digits = 1): string {
  return (
    new Intl.NumberFormat(locale === "pt" ? "pt-BR" : "en-US", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value) + "%"
  );
}

export function formatNumber(value: number, locale: Locale, digits = 0): string {
  return new Intl.NumberFormat(locale === "pt" ? "pt-BR" : "en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/** Parses "R$ 48,00", "48", "$48.50", "48,5" into cents. */
export function parseMoney(input: string): number | null {
  const s = input.replace(/[^\d,.-]/g, "");
  if (!s) return null;
  let normalized = s;
  if (s.includes(",") && s.includes(".")) {
    normalized = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (s.includes(",")) {
    normalized = s.replace(",", ".");
  }
  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

export function parsePct(input: string): number | null {
  const n = Number(input.replace("%", "").replace(",", ".").trim());
  return Number.isFinite(n) ? n : null;
}
