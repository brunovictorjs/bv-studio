"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { downloadCsv } from "@/components/admin/period";
import { BarChart, Meter } from "@/components/charts";
import { CountUp } from "@/components/motion";
import { Row, Segmented, SkeletonBlock } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { useT, type Messages } from "@/i18n";
import { useQ } from "@/lib/client/hooks";
import { cn } from "@/lib/utils";

const M = {
  title: ["Meus ganhos", "My earnings"],
  export: ["Exportar", "Export"],
  month: ["Este mês", "This month"],
  week: ["Semana", "Week"],
  lastMonth: ["Mês passado", "Last month"],
  period: ["Período", "Period"],
  commission: ["Comissão do período", "Commission for the period"],
  vs: ["sobre {a} a {b}", "vs {a} to {b}"],
  execLine: ["Execução · {p}% de {v}", "Service · {p}% of {v}"],
  prodLine: ["Produtos · {p}% de {v}", "Products · {p}% of {v}"],
  payout: ["Repasse na {d}", "Payout on {d}"],
  served: ["Atendimentos", "Services"],
  ticket: ["Ticket médio", "Average ticket"],
  chair: ["Na cadeira", "In the chair"],
  occ: ["ocupação {n}%", "{n}% booked"],
  rating: ["Sua nota", "Your rating"],
  reviews: ["{n} avaliações", "{n} reviews"],
  perDay: ["Por dia · últimos 7 dias", "Per day · last 7 days"],
  mix: ["De onde vem o dinheiro", "Where the money comes from"],
  list: ["Atendimentos do período", "Services in the period"],
  all: ["Todos", "All"],
  completed: ["Concluídos", "Completed"],
  cancelled: ["Cancelados", "Cancelled"],
  of: ["de {v}", "of {v}"],
  refunded: ["estornado", "refunded"],
  noShow: ["falta", "no-show"],
  realOf: ["{a} de {b}", "{a} of {b}"],
  plusProd: ["{a} + {b} produto", "{a} + {b} product"],
  showing: ["{a} de {b} atendimentos", "{a} of {b} services"],
  more: ["Ver mais", "Show more"],
} satisfies Messages;

export default function Earnings() {
  const { t, tx, fmt } = useT();
  const [period, setPeriod] = useState<"month" | "week" | "last_month">("month");
  const [filter, setFilter] = useState<"all" | "completed" | "cancelled">("all");
  const [limit, setLimit] = useState(10);
  const { data } = useQ("proEarnings", { period }, "pro");
  if (!data) return <SkeletonBlock className="m-4 h-96" />;
  const rows = data.rows.filter((r) => filter === "all" || (filter === "completed" ? r.status === "completed" : r.status !== "completed"));
  const exportCsv = () =>
    downloadCsv(`ganhos-${data.from}-${data.to}.csv`, [
      ["code", "client", "date", "commission"],
      ...data.rows.map((r) => [r.code, r.client, r.at ?? "", r.commission / 100]),
    ]);

  return (
    <div className="flex flex-col gap-5 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t(M.title)}</h1>
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download /> {t(M.export)}
        </Button>
      </div>
      <Segmented
        label={t(M.period)}
        value={period}
        onChange={(v) => (setPeriod(v), setLimit(10))}
        options={[
          { value: "month", label: t(M.month) },
          { value: "week", label: t(M.week) },
          { value: "last_month", label: t(M.lastMonth) },
        ]}
      />
      <section className="flex flex-col gap-3 rounded-md bg-ink p-5 text-surface-0" data-anim>
        <span className="bv-label text-surface-0/70">{t(M.commission)}</span>
        <span className="text-4xl font-semibold tracking-[-0.02em]">
          <CountUp value={data.total} format={(n) => fmt.money(n, { decimals: "always" })} />
        </span>
        {data.change != null && (
          <span className="text-sm text-surface-0/70">
            {data.change >= 0 ? "▲" : "▼"} {Math.abs(data.change)}% {t(M.vs, { a: fmt.day(data.prevFrom), b: fmt.day(data.prevTo) })}
          </span>
        )}
        <div className="flex flex-col divide-y divide-surface-0/20 border-t border-surface-0/20 text-sm">
          <Row label={t(M.execLine, { p: data.execPct, v: fmt.money(data.execBase) })} value={fmt.money(data.exec, { decimals: "always" })} />
          <Row label={t(M.prodLine, { p: data.productPct, v: fmt.money(data.productBase) })} value={fmt.money(data.product, { decimals: "always" })} />
          <Row label={t(M.payout, { d: fmt.dayWeek(data.payout) })} value="" />
        </div>
      </section>
      <section className="grid grid-cols-2 gap-2" data-anim>
        {[
          [M.served, String(data.count), `${data.countChange >= 0 ? "+" : ""}${data.countChange}`],
          [M.ticket, fmt.money(data.ticket), `${data.ticketChange >= 0 ? "+" : "−"} ${fmt.money(Math.abs(data.ticketChange))}`],
          [M.chair, fmt.dur(data.chairMin), t(M.occ, { n: data.occupancy })],
          [M.rating, data.rating.count ? fmt.num(data.rating.avg, 1) : "—", t(M.reviews, { n: data.rating.count })],
        ].map(([label, value, hint], i) => (
          <div key={i} className="flex flex-col gap-1 rounded-md border border-hairline bg-card p-3">
            <span className="bv-label text-[10px]">{t(label as readonly [string, string])}</span>
            <span className="text-xl font-semibold">{value as string}</span>
            <span className="text-xs text-ink-muted">{hint as string}</span>
          </div>
        ))}
      </section>
      <section className="flex flex-col gap-3 rounded-md border border-hairline bg-card p-4" data-anim>
        <span className="font-medium">{t(M.perDay)}</span>
        <BarChart
          height={140}
          ariaLabel={t(M.perDay)}
          bars={data.last7.map((d, i) => ({
            key: d.date,
            label: i === 6 ? t(["hoje", "today"]) : fmt.weekday(d.date),
            value: d.amount,
            detail: fmt.money(d.amount),
            highlight: i === 6,
          }))}
        />
      </section>
      {data.mix.length > 0 && (
        <section className="flex flex-col gap-3 rounded-md border border-hairline bg-card p-4" data-anim>
          <span className="font-medium">{t(M.mix)}</span>
          {data.mix.map((m) => (
            <div key={m.categoryId} className="flex flex-col gap-1 text-sm">
              <div className="flex justify-between">
                <span>{tx(m.name)}</span>
                <span className="tabular">{m.pct}%</span>
              </div>
              <Meter pct={m.pct} />
            </div>
          ))}
        </section>
      )}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t(M.list)}</h2>
        <Segmented
          size="sm"
          label={t(M.list)}
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: `${t(M.all)} · ${data.counts.all}` },
            { value: "completed", label: `${t(M.completed)} · ${data.counts.completed}` },
            { value: "cancelled", label: `${t(M.cancelled)} · ${data.counts.cancelled}` },
          ]}
        />
        <ul className="flex flex-col divide-y divide-hairline rounded-md border border-hairline">
          {rows.slice(0, limit).map((r) => (
            <li key={r.id} className={cn("flex flex-col gap-0.5 p-3", r.status !== "completed" && "text-ink-muted")}>
              <div className="flex justify-between gap-2">
                <span className="font-medium">{r.client}</span>
                <span className="tabular font-semibold">{fmt.money(r.commission, { decimals: "always" })}</span>
              </div>
              <span className="truncate font-mono text-[11px] text-ink-muted">
                {r.code} · {r.items.map((i) => tx(i)).join(" + ")} · {r.at ? fmt.when(r.at) : ""}
              </span>
              <span className="text-xs text-ink-muted">
                {r.status === "cancelled"
                  ? t(M.refunded)
                  : r.status === "no_show"
                    ? t(M.noShow)
                    : [
                        r.product ? t(M.plusProd, { a: fmt.money(r.exec), b: fmt.money(r.product) }) : t(M.of, { v: fmt.money(r.serviceTotal) }),
                        r.realMin != null ? t(M.realOf, { a: fmt.dur(r.realMin), b: fmt.dur(r.estMin) }) : null,
                        r.rating ? `★ ${r.rating}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
              </span>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between text-sm text-ink-muted">
          <span>{t(M.showing, { a: Math.min(limit, rows.length), b: rows.length })}</span>
          {limit < rows.length && (
            <Button variant="outline" size="sm" onClick={() => setLimit(limit + 10)}>
              {t(M.more)}
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}
