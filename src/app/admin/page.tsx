"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { presetRange, PeriodPicker } from "@/components/admin/period";
import { RoleGate, UnitPicker, useAdminUnit } from "@/components/admin/shell";
import { BarChart } from "@/components/charts";
import { Chip, Delta, Empty, PageHeader, Panel, SkeletonBlock, Stat } from "@/components/kit";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useT, type Messages } from "@/i18n";
import { C } from "@/i18n/common";
import { useQ, useStaff } from "@/lib/client/hooks";

const M = {
  eyebrow: ["Painel · consolidado", "Panel · consolidated"],
  title: ["Visão geral", "Overview"],
  comparing: ["{days} dias · comparando com {from} a {to}", "{days} days · compared with {from} to {to}"],
  revenue: ["Faturamento", "Revenue"],
  more: ["{v} a mais", "{v} more"],
  less: ["{v} a menos", "{v} less"],
  paidOrders: ["Pedidos pagos", "Paid orders"],
  ordersDelta: ["{v} pedidos", "{v} orders"],
  ticket: ["Ticket médio", "Average ticket"],
  cancelled: ["Cancelados e estornados", "Cancelled and refunded"],
  refunded: ["{v} devolvidos", "{v} refunded"],
  ai: ["Atendimento IA", "AI handling"],
  aiHint: ["{a} de {b} conversas sem humano · {w} aguardando", "{a} of {b} chats with no human · {w} waiting"],
  byUnit: ["Por unidade", "By location"],
  byUnitHint: ["Ranking do período · as que precisam de atenção ficam marcadas", "Period ranking · the ones that need attention are flagged"],
  manageUnits: ["Gerenciar unidades", "Manage locations"],
  unitCol: ["Unidade", "Location"],
  change: ["Variação", "Change"],
  share: ["% da receita", "% of revenue"],
  ordersTicket: ["Pedidos · ticket", "Orders · ticket"],
  occupancy: ["Ocupação", "Occupancy"],
  aiSolved: ["IA resolveu", "AI solved"],
  forwarded: ["Encaminhadas", "Forwarded"],
  late: ["{n} atrasada(s)", "{n} late"],
  openUntil: ["aberta até {t}", "open until {t}"],
  closedToday: ["fechada hoje", "closed today"],
  perDay: ["Faturamento por dia", "Revenue by day"],
  perDayHint: ["Total das unidades no filtro do topo", "Total of the locations in the filter above"],
  closed: ["fechado", "closed"],
  topServices: ["Serviços mais vendidos", "Best-selling services"],
  orders: ["Pedidos", "Orders"],
  receita: ["Receita", "Revenue"],
  pros: ["Desempenho por profissional", "Performance by professional"],
  prosHint: ["Cada profissional pertence a uma única unidade", "Each professional belongs to a single location"],
  served: ["Atendimentos", "Services"],
} satisfies Messages;

export default function OverviewPage() {
  const me = useStaff();
  const router = useRouter();
  const deskOnly = !!me && !me.roles.includes("admin");
  useEffect(() => {
    if (deskOnly) router.replace("/admin/desk");
  }, [deskOnly, router]);
  if (deskOnly) return null;
  return (
    <RoleGate roles={["admin"]}>
      <Overview />
    </RoleGate>
  );
}

function Overview() {
  const { t, tx, fmt } = useT();
  const [unit] = useAdminUnit();
  const [period, setPeriod] = useState(() => presetRange("week"));
  const { data, loading } = useQ("dashboard", { unitId: unit, ...period }, "staff");
  const k = data?.kpis;
  const money = (n: number) => fmt.money(n);
  const unitName = (id: string | null) => tx(data?.units.find((u) => u.id === id)?.name ?? "");

  return (
    <>
      <PageHeader eyebrow={t(M.eyebrow)} title={t(M.title)} actions={<UnitPicker label={t(C.unit)} />} />
      <div className="flex flex-col gap-2">
        <PeriodPicker value={period} onChange={setPeriod} />
        {data && (
          <p className="font-mono text-xs text-ink-muted">
            {t(M.comparing, { days: data.period.days, from: fmt.day(data.period.prevFrom), to: fmt.day(data.period.prevTo) })}
          </p>
        )}
      </div>

      {!k ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-32" />
          ))}
        </div>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5" aria-label={t(M.title)}>
          <Stat
            label={t(M.revenue)}
            value={k.revenue}
            format={money}
            hint={
              <>
                <Delta value={k.revenuePrev ? ((k.revenue - k.revenuePrev) / k.revenuePrev) * 100 : null} />{" "}
                · {t(k.revenue >= k.revenuePrev ? M.more : M.less, { v: fmt.money(Math.abs(k.revenue - k.revenuePrev)) })}
              </>
            }
          />
          <Stat
            label={t(M.paidOrders)}
            value={k.orders}
            format={(n) => fmt.num(n)}
            hint={<Delta value={k.orders - k.ordersPrev} suffix={` ${t(["pedidos", "orders"])}`} />}
          />
          <Stat label={t(M.ticket)} value={k.ticket} format={money} hint={`${k.ticket >= k.ticketPrev ? "▲" : "▼"} ${fmt.money(Math.abs(k.ticket - k.ticketPrev), { decimals: "always" })}`} />
          <Stat label={t(M.cancelled)} value={k.cancelled} format={(n) => fmt.num(n)} hint={t(M.refunded, { v: fmt.money(k.refunded) })} />
          <Link href="/admin/conversations" className="rounded-md focus-visible:outline-2">
            <Stat
              inverted
              className="h-full"
              label={t(M.ai)}
              value={k.ai.rate}
              format={(n) => `${n}%`}
              hint={t(M.aiHint, { a: k.ai.resolved, b: k.ai.total, w: k.ai.waiting })}
            />
          </Link>
        </section>
      )}

      <Panel
        title={t(M.byUnit)}
        description={t(M.byUnitHint)}
        actions={
          <Link href="/admin/units" className="text-sm underline-offset-4 hover:underline">
            {t(M.manageUnits)} →
          </Link>
        }
      >
        <div className="overflow-x-auto">
          <Table className="min-w-[960px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>{t(M.unitCol)}</TableHead>
                <TableHead className="text-right">{t(M.revenue)}</TableHead>
                <TableHead className="text-right">{t(M.change)}</TableHead>
                <TableHead className="text-right">{t(M.share)}</TableHead>
                <TableHead className="text-right">{t(M.ordersTicket)}</TableHead>
                <TableHead className="text-right">{t(M.occupancy)}</TableHead>
                <TableHead className="text-right">{t(C.rating)}</TableHead>
                <TableHead className="text-right">{t(M.aiSolved)}</TableHead>
                <TableHead>{t(M.forwarded)}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.units.map((u, i) => (
                <TableRow key={u.id}>
                  <TableCell className="font-mono text-ink-muted">{String(i + 1).padStart(2, "0")}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <span className="flex size-8 items-center justify-center rounded-sm bg-ink font-mono text-sm text-surface-0">{tx(u.name).slice(0, 1)}</span>
                      <div className="flex flex-col">
                        <span className="font-medium">{tx(u.name)}</span>
                        <span className="text-xs text-ink-muted">
                          {tx(u.kind)} · {u.openUntil ? t(M.openUntil, { t: fmt.hour(u.openUntil) }) : t(M.closedToday)}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="tabular text-right font-medium">{fmt.money(u.revenue)}</TableCell>
                  <TableCell className="text-right">
                    <Delta value={u.change} />
                  </TableCell>
                  <TableCell className="tabular text-right">{u.share}%</TableCell>
                  <TableCell className="tabular text-right">
                    {u.orders} · {fmt.money(u.ticket)}
                  </TableCell>
                  <TableCell className="tabular text-right">{u.occupancy}%</TableCell>
                  <TableCell className="tabular text-right">{fmt.num(u.rating, 1)}</TableCell>
                  <TableCell className="tabular text-right">{u.aiRate}%</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="tabular">{u.forwardedOpen}</span>
                      {u.late > 0 && <Chip className="border-dashed border-ink text-ink">{t(M.late, { n: u.late })}</Chip>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Panel title={t(M.perDay)} description={t(M.perDayHint)}>
          {data ? (
            <BarChart
              ariaLabel={t(M.perDay)}
              bars={data.byDay.map((d) => ({
                key: d.date,
                label: data.byDay.length > 10 ? fmt.numeric(d.date) : `${fmt.weekday(d.date)} ${Number(d.date.slice(8))}`,
                value: d.revenue,
                detail: fmt.money(d.revenue),
                stub: d.closed ? t(M.closed) : undefined,
                highlight: d.revenue === Math.max(...data.byDay.map((x) => x.revenue)),
              }))}
            />
          ) : (
            <SkeletonBlock className="h-52" />
          )}
        </Panel>
        <Panel title={t(M.topServices)}>
          {data && data.topServices.length === 0 && <Empty>{t(C.noResults)}</Empty>}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t(C.service)}</TableHead>
                <TableHead>{t(C.unit)}</TableHead>
                <TableHead className="text-right">{t(M.orders)}</TableHead>
                <TableHead className="text-right">{t(M.receita)}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.topServices.map((s) => (
                <TableRow key={`${s.id}${s.unitId}`}>
                  <TableCell className="font-medium">{tx(s.name as never)}</TableCell>
                  <TableCell className="text-ink-muted">{unitName(s.unitId)}</TableCell>
                  <TableCell className="tabular text-right">{s.orders}</TableCell>
                  <TableCell className="tabular text-right">{fmt.money(s.revenue)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      </div>

      <Panel title={t(M.pros)} description={t(M.prosHint)}>
        <div className="overflow-x-auto">
          <Table className="min-w-[620px]">
            <TableHeader>
              <TableRow>
                <TableHead>{t(C.professional)}</TableHead>
                <TableHead>{t(C.unit)}</TableHead>
                <TableHead className="text-right">{t(M.served)}</TableHead>
                <TableHead className="text-right">{t(C.rating)}</TableHead>
                <TableHead className="text-right">{t(M.receita)}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.pros.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>
                    <Chip>{unitName(p.unitId)}</Chip>
                  </TableCell>
                  <TableCell className="tabular text-right">{p.count}</TableCell>
                  <TableCell className="tabular text-right">{p.rating ? fmt.num(p.rating, 1) : "—"}</TableCell>
                  <TableCell className="tabular text-right">{fmt.money(p.revenue)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {loading && !data && <SkeletonBlock className="h-40" />}
      </Panel>
    </>
  );
}
