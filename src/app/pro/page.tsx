"use client";

import { Bell, Plus } from "lucide-react";
import Link from "next/link";
import { Delta, Empty, SkeletonBlock, StatusBadge } from "@/components/kit";
import { Stagger } from "@/components/motion";
import { ProSwitcher } from "@/components/pro/switcher";
import { Button } from "@/components/ui/button";
import { useT, type Messages } from "@/i18n";
import { METHOD } from "@/i18n/common";
import { useNow, useQ } from "@/lib/client/hooks";
import { nowLocal } from "@/lib/domain/time";

const M = {
  chair: ["cadeira {n}", "chair {n}"],
  hours: ["seu horário {a} às {b}", "your hours {a} to {b}"],
  hoursBreak: ["seu horário {a} às {b} e {c} às {d}", "your hours {a}–{b} and {c}–{d}"],
  off: ["você não trabalha hoje", "you're off today"],
  today: ["Hoje", "Today"],
  done: ["{n} já feitos", "{n} done"],
  chairTime: ["Cadeira", "Chair"],
  occ: ["ocupação {n}%", "{n}% booked"],
  toReceive: ["Comissão do dia", "Today's commission"],
  vsYesterday: ["vs ontem", "vs yesterday"],
  newWalkin: ["Novo pedido avulso", "New walk-in"],
  inChair: ["Na cadeira · {t}", "In the chair · {t}"],
  open: ["Abrir atendimento", "Open service"],
  next: ["Na sequência", "Up next"],
  remaining: ["{n} restantes", "{n} left"],
  freeGap: ["Livre para encaixe · {n} min", "Free for a walk-in · {n} min"],
  late: ["atrasado {n} min · encaixe {t}", "{n} min late · fit at {t}"],
  paysDesk: ["paga no balcão", "pays at the desk"],
  doneToday: ["Concluídos hoje", "Done today"],
  nothing: ["Nada marcado para o resto do dia.", "Nothing booked for the rest of the day."],
  notices: ["Avisos", "Notices"],
  checkin: ["Conferir código", "Check in"],
  noShow: ["falta", "no-show"],
  walkin: ["avulso", "walk-in"],
} satisfies Messages;

export default function ProAgenda() {
  const { t, tx, fmt } = useT();
  useNow(30000);
  const { data } = useQ("proDay", {}, "pro");
  const today = nowLocal().slice(0, 10);
  if (!data) return <SkeletonBlock className="m-4 h-96" />;
  const h = data.hours;
  const hoursText = !h
    ? t(M.off)
    : h.breakStart
      ? t(M.hoursBreak, { a: fmt.hour(h.start), b: fmt.hour(h.breakStart), c: fmt.hour(h.breakEnd!), d: fmt.hour(h.end) })
      : t(M.hours, { a: fmt.hour(h.start), b: fmt.hour(h.end) });
  const timeline = [
    ...data.upcoming.map((o) => ({ kind: "order" as const, at: o.start!.slice(11), o })),
    ...data.gaps.map((g) => ({ kind: "gap" as const, at: g.start, g })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  return (
    <div className="flex flex-col gap-5 p-4">
      <div className="flex items-center gap-2">
        <ProSwitcher sub={`${tx(data.unit.name)}${data.pro.chair ? ` · ${t(M.chair, { n: data.pro.chair })}` : ""}`} />
        <Button asChild variant="ghost" size="icon" className="relative" aria-label={t(M.notices)}>
          <Link href="/pro/notices">
            <Bell />
            {data.unread > 0 && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-ink" />}
          </Link>
        </Button>
      </div>
      <p className="text-sm text-ink-muted" data-anim>
        <span className="inline-block first-letter:uppercase">{fmt.dayLong(today)}</span> · {hoursText}
      </p>

      <section className="grid grid-cols-3 gap-2" data-anim>
        <div className="flex flex-col gap-1 rounded-md border border-hairline bg-card p-3">
          <span className="bv-label text-[10px]">{t(M.today)}</span>
          <span className="text-2xl font-semibold">{data.kpis.total}</span>
          <span className="text-[11px] text-ink-muted">{t(M.done, { n: data.kpis.done })}</span>
        </div>
        <div className="flex flex-col gap-1 rounded-md border border-hairline bg-card p-3">
          <span className="bv-label text-[10px]">{t(M.chairTime)}</span>
          <span className="text-2xl font-semibold">{fmt.dur(data.kpis.chairMin)}</span>
          <span className="text-[11px] text-ink-muted">{t(M.occ, { n: data.kpis.occupancy })}</span>
        </div>
        <div className="flex flex-col gap-1 rounded-md bg-ink p-3 text-surface-0">
          <span className="bv-label text-[10px] text-surface-0/70">{t(M.toReceive)}</span>
          <span className="text-xl font-semibold leading-8">{fmt.money(data.kpis.commission)}</span>
          <span className="text-[11px] text-surface-0/70">
            <Delta value={data.kpis.change} /> {t(M.vsYesterday)}
          </span>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-2" data-anim>
        <Button asChild variant="outline" size="lg">
          <Link href="/pro/walkin">
            <Plus /> {t(M.newWalkin)}
          </Link>
        </Button>
        <Button asChild size="lg">
          <Link href="/pro/check-in">{t(M.checkin)} →</Link>
        </Button>
      </div>

      {data.current && (
        <Link href={`/pro/service/${data.current.id}`} className="flex flex-col gap-2 rounded-md border-2 border-ink bg-ink p-4 text-surface-0" data-anim>
          <span className="bv-label text-surface-0/70">{t(M.inChair, { t: (data.current.startedAt ?? data.current.start ?? "").slice(11) })}</span>
          <span className="text-xl font-semibold">{data.current.client}</span>
          <span className="text-sm text-surface-0/80">
            {data.current.items.filter((i) => i.kind === "service").map((i) => tx(i.name)).join(" + ")} · {fmt.dur(data.current.durationMin)}
            {data.current.method && ` · ${t(METHOD[data.current.method])}`}
          </span>
          <span className="mt-1 self-start rounded-sm bg-surface-0 px-3 py-1.5 text-sm font-medium text-ink">{t(M.open)} →</span>
        </Link>
      )}

      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">{t(M.next)}</h2>
          <span className="text-sm text-ink-muted">{t(M.remaining, { n: data.upcoming.length })}</span>
        </div>
        {timeline.length === 0 ? (
          <Empty>{t(M.nothing)}</Empty>
        ) : (
          <Stagger deps={[timeline.length]} className="flex flex-col gap-2">
            {timeline.map((row) =>
              row.kind === "gap" ? (
                <Link key={`g${row.at}`} href="/pro/walkin" data-anim className="flex items-center gap-3 rounded-md border border-dashed border-line-strong p-3 text-sm text-ink-muted">
                  <span className="w-12 font-mono">{row.at}</span>
                  {t(M.freeGap, { n: row.g.min })}
                </Link>
              ) : (
                <div key={row.o.id} data-anim className={row.o.state === "late" ? "bv-hatch-strong flex gap-3 rounded-md border border-dashed border-ink p-3" : "flex gap-3 rounded-md border border-hairline bg-card p-3"}>
                  <div className="flex w-12 flex-col">
                    <span className="font-mono text-sm">{row.at}</span>
                    <span className="text-[11px] text-ink-muted">{fmt.dur(row.o.durationMin)}</span>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">
                      {row.o.client} {row.o.walkin && <span className="text-xs text-ink-muted">· {t(M.walkin)}</span>}
                    </span>
                    <span className="truncate text-xs text-ink-muted">
                      {row.o.items.filter((i) => i.kind === "service").map((i) => tx(i.name)).join(" + ")}
                      {row.o.balance > 0 && ` · ${t(M.paysDesk)}`}
                    </span>
                    {row.o.late && (
                      <span className="text-xs font-medium">{t(M.late, { n: row.o.late.minutesLate, t: row.o.late.fitAt?.slice(11) ?? "—" })}</span>
                    )}
                  </div>
                  <StatusBadge state={row.o.state === "late" ? "late" : row.o.paid > 0 ? "paid" : "awaiting_payment"}>
                    {row.o.state === "late" ? undefined : row.o.paid > 0 ? undefined : row.o.method ? t(METHOD[row.o.method]) : undefined}
                  </StatusBadge>
                </div>
              ),
            )}
          </Stagger>
        )}
      </section>

      {data.done.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">{t(M.doneToday)}</h2>
          <ul className="flex flex-col divide-y divide-hairline rounded-md border border-hairline">
            {data.done.map((o) => (
              <li key={o.id} className="flex items-center gap-3 p-3 text-sm text-ink-muted">
                <span className="w-12 font-mono">{o.start?.slice(11)}</span>
                <span className="flex-1 truncate">
                  {o.client} · {o.items.filter((i) => i.kind === "service").map((i) => tx(i.name)).join(" + ")}
                </span>
                {o.state === "no_show" ? <span className="text-xs">{t(M.noShow)}</span> : <span className="tabular text-ink">{fmt.money(o.commission)}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
