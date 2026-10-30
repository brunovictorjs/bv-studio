"use client";

import { useCallback, useMemo } from "react";
import { store, useStore } from "@/lib/client/store";
import { formatMoney, formatNumber, formatPct, tx as txRaw } from "@/lib/domain/text";
import { durationLabel, epochMin, nowLocal } from "@/lib/domain/time";
import type { DateStr, DateTimeStr, LText, Locale } from "@/lib/domain/types";

/** A message is a [português, english] pair, colocated with the screen that uses it. */
export type Msg = readonly [string, string];
export type Messages = Record<string, Msg>;

export function interpolate(text: string, params?: Record<string, string | number>) {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (_, k) => (params[k] != null ? String(params[k]) : `{${k}}`));
}

export function useLocale(): Locale {
  return useStore((s) => s.locale);
}

export const setLocale = (l: Locale) => store.setLocale(l);

const MONTHS: Record<Locale, string[]> = {
  pt: ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};
const MONTHS_LONG: Record<Locale, string[]> = {
  pt: ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};
const WEEKDAYS: Record<Locale, string[]> = {
  pt: ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"],
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
};
const WEEKDAYS_LONG: Record<Locale, string[]> = {
  pt: ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
};

export function useT() {
  const locale = useLocale();
  const currency = useStore((s) => s.db?.settings.company.currency ?? "auto");

  const t = useCallback(
    (msg: Msg, params?: Record<string, string | number>) => interpolate(msg[locale === "pt" ? 0 : 1], params),
    [locale],
  );
  const tx = useCallback((v: LText | null | undefined) => txRaw(v, locale), [locale]);

  const fmt = useMemo(() => {
    const parts = (d: DateStr) => {
      const [y, m, day] = d.slice(0, 10).split("-").map(Number);
      const wd = new Date(Date.UTC(y, m - 1, day)).getUTCDay();
      return { y, m, day, wd };
    };
    return {
      money: (cents: number, opts?: { compact?: boolean; decimals?: "auto" | "always" }) => formatMoney(cents, locale, currency, opts),
      pct: (v: number, digits = 1) => formatPct(v, locale, digits),
      num: (v: number, digits = 0) => formatNumber(v, locale, digits),
      dur: (min: number) => durationLabel(min, locale),
      weekday: (d: DateStr, long = false) => (long ? WEEKDAYS_LONG : WEEKDAYS)[locale][parts(d).wd],
      weekdayName: (i: number, long = false) => (long ? WEEKDAYS_LONG : WEEKDAYS)[locale][i],
      monthName: (m: number, long = true) => (long ? MONTHS_LONG : MONTHS)[locale][m - 1],
      /** 14 out · Oct 14 */
      day: (d: DateStr) => {
        const p = parts(d);
        return locale === "pt" ? `${p.day} ${MONTHS[locale][p.m - 1]}` : `${MONTHS[locale][p.m - 1]} ${p.day}`;
      },
      /** qua, 14 out · Wed, Oct 14 */
      dayWeek: (d: DateStr) => {
        const p = parts(d);
        return locale === "pt"
          ? `${WEEKDAYS.pt[p.wd]}, ${p.day} ${MONTHS.pt[p.m - 1]}`
          : `${WEEKDAYS.en[p.wd]}, ${MONTHS.en[p.m - 1]} ${p.day}`;
      },
      /** quinta, 15 de outubro · Thursday, October 15 */
      dayLong: (d: DateStr) => {
        const p = parts(d);
        return locale === "pt"
          ? `${WEEKDAYS_LONG.pt[p.wd]}, ${p.day} de ${MONTHS_LONG.pt[p.m - 1]}`
          : `${WEEKDAYS_LONG.en[p.wd]}, ${MONTHS_LONG.en[p.m - 1]} ${p.day}`;
      },
      /** 14/10/2026 · 10/14/2026 */
      numeric: (d: DateStr) => {
        const p = parts(d);
        const dd = String(p.day).padStart(2, "0");
        const mm = String(p.m).padStart(2, "0");
        return locale === "pt" ? `${dd}/${mm}` : `${mm}/${dd}`;
      },
      time: (dt: DateTimeStr | string) => {
        const t = dt.length > 5 ? dt.slice(11, 16) : dt;
        if (locale === "pt") return t;
        const [h, m] = t.split(":").map(Number);
        return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
      },
      /** "10h" / "10h30" in pt; "10 AM" in en */
      hour: (t: string) => {
        const [h, m] = t.slice(-5).split(":").map(Number);
        if (locale === "pt") return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
        return `${((h + 11) % 12) + 1}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "AM" : "PM"}`;
      },
      relative: (dt: DateTimeStr) => {
        const now = nowLocal();
        const diff = epochMin(now) - epochMin(dt);
        const today = now.slice(0, 10);
        const abs = Math.abs(diff);
        if (diff >= 0) {
          if (abs < 1) return locale === "pt" ? "agora" : "now";
          if (abs < 60) return locale === "pt" ? `há ${abs} min` : `${abs} min ago`;
          if (abs < 60 * 24 && dt.slice(0, 10) === today) return locale === "pt" ? `há ${Math.floor(abs / 60)} h` : `${Math.floor(abs / 60)} h ago`;
        }
        const d = dt.slice(0, 10);
        const days = Math.round((epochMin(`${d}T00:00`) - epochMin(`${today}T00:00`)) / 1440);
        if (days === 0) return locale === "pt" ? `hoje ${dt.slice(11, 16)}` : `today ${dt.slice(11, 16)}`;
        if (days === 1) return locale === "pt" ? `amanhã ${dt.slice(11, 16)}` : `tomorrow ${dt.slice(11, 16)}`;
        if (days === -1) return locale === "pt" ? `ontem ${dt.slice(11, 16)}` : `yesterday ${dt.slice(11, 16)}`;
        const p = parts(d);
        return locale === "pt" ? `${WEEKDAYS.pt[p.wd]}, ${p.day} ${MONTHS.pt[p.m - 1]}` : `${WEEKDAYS.en[p.wd]}, ${MONTHS.en[p.m - 1]} ${p.day}`;
      },
      /** "hoje 16:00" / "amanhã 10:00" / "ter 14:00" */
      when: (dt: DateTimeStr) => {
        const today = nowLocal().slice(0, 10);
        const d = dt.slice(0, 10);
        const days = Math.round((epochMin(`${d}T00:00`) - epochMin(`${today}T00:00`)) / 1440);
        const time = dt.slice(11, 16);
        if (days === 0) return locale === "pt" ? `hoje ${time}` : `today ${time}`;
        if (days === 1) return locale === "pt" ? `amanhã ${time}` : `tomorrow ${time}`;
        if (days === -1) return locale === "pt" ? `ontem ${time}` : `yesterday ${time}`;
        const p = parts(d);
        if (Math.abs(days) < 7) return `${WEEKDAYS[locale][p.wd]} ${time}`;
        return locale === "pt" ? `${p.day}/${String(p.m).padStart(2, "0")} ${time}` : `${p.m}/${p.day} ${time}`;
      },
    };
  }, [locale, currency]);

  return { t, tx, locale, fmt };
}

export type Fmt = ReturnType<typeof useT>["fmt"];
