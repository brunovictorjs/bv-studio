"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { downloadCsv, PeriodPicker, presetRange } from "@/components/admin/period";
import { RoleGate } from "@/components/admin/shell";
import { BarChart, ShareBar } from "@/components/charts";
import { Field, PageHeader, Panel, Row, SkeletonBlock, Stat } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useT, type Messages } from "@/i18n";
import { C, METHOD } from "@/i18n/common";
import { useDb, useQ } from "@/lib/client/hooks";

const M = {
  eyebrow: ["Painel · só administradores", "Panel · admins only"],
  title: ["Vendas", "Sales"],
  groupBy: ["Agrupar por", "Group by"],
  day: ["Dia", "Day"],
  week: ["Semana", "Week"],
  allMethods: ["Todas as formas", "All methods"],
  gross: ["Bruto vendido", "Gross sold"],
  grossHint: ["{n} pedidos pagos", "{n} paid orders"],
  refunds: ["Estornos", "Refunds"],
  refundsHint: ["{n} pedidos", "{n} orders"],
  fees: ["Taxas Stripe", "Stripe fees"],
  feesHint: ["Pix {pix}% · cartão {card}% + {fixed}", "Pix {pix}% · card {card}% + {fixed}"],
  commissions: ["Comissões", "Commissions"],
  commissionsHint: ["{n} profissionais", "{n} professionals"],
  net: ["Líquido da casa", "House net"],
  margin: ["margem {v}", "margin {v}"],
  perDay: ["Bruto por dia", "Gross by day"],
  byMethod: ["Por forma de pagamento", "By payment method"],
  payout: ["Próximo repasse do Stripe", "Next Stripe payout"],
  table: ["Vendas do período", "Sales in the period"],
  tableHint: ["o líquido já desconta estorno, taxa e comissão", "net already deducts refunds, fees and commissions"],
  orders: ["Pedidos", "Orders"],
  closed: ["fechado", "closed"],
} satisfies Messages;

export default function SalesPage() {
  return (
    <RoleGate roles={["admin"]}>
      <Sales />
    </RoleGate>
  );
}

function Sales() {
  const { t, tx, fmt } = useT();
  const db = useDb();
  const [period, setPeriod] = useState(() => presetRange("week"));
  const [unitId, setUnitId] = useState("all");
  const [method, setMethod] = useState("all");
  const [proId, setProId] = useState("all");
  const [groupBy, setGroupBy] = useState<"day" | "week">("day");
  const { data } = useQ("sales", { ...period, unitId, method, proId, groupBy }, "staff");
  const pros = db?.users.filter((u) => u.roles.includes("professional") && u.status === "active" && (unitId === "all" || u.unitId === unitId)) ?? [];
  const fees = db?.settings.payment.fees;
  const tot = data?.total;
  const rowLabel = (r: { from: string; to: string }) => (r.from === r.to ? fmt.dayWeek(r.from) : `${fmt.day(r.from)} – ${fmt.day(r.to)}`);

  const exportCsv = () => {
    if (!data) return;
    downloadCsv(`vendas-${period.from}-${period.to}.csv`, [
      [t(M.day), t(M.orders), t(M.gross), t(M.refunds), t(M.fees), t(M.commissions), t(M.net), "%"],
      ...data.rows.map((r) => [rowLabel(r), r.orders, r.gross / 100, r.refunds / 100, r.fees / 100, r.commissions / 100, r.net / 100, r.margin]),
    ]);
  };

  return (
    <>
      <PageHeader
        eyebrow={t(M.eyebrow)}
        title={t(M.title)}
        actions={
          <Button variant="outline" onClick={exportCsv} disabled={!data}>
            <Download /> {t(C.exportCsv)}
          </Button>
        }
      />
      <section className="flex flex-col gap-4 rounded-md border border-hairline bg-card p-4" aria-label="Filtros" data-anim>
        <PeriodPicker value={period} onChange={setPeriod} />
        <div className="flex flex-wrap gap-3">
          <Field label={t(C.unit)}>
            <Select value={unitId} onValueChange={(v) => (setUnitId(v), setProId("all"))}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t(C.allUnits)}</SelectItem>
                {db?.units.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {tx(u.name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t(M.groupBy)}>
            <Select value={groupBy} onValueChange={(v) => setGroupBy(v as "day" | "week")}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">{t(M.day)}</SelectItem>
                <SelectItem value="week">{t(M.week)}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label={t(C.payment)}>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t(M.allMethods)}</SelectItem>
                {(["pix", "credit", "debit", "counter"] as const).map((m) => (
                  <SelectItem key={m} value={m}>
                    {t(METHOD[m])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t(C.professional)}>
            <Select value={proId} onValueChange={setProId}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t(C.all)}</SelectItem>
                {pros.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.firstName} {p.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </section>

      {!tot ? (
        <SkeletonBlock className="h-32" />
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Stat label={t(M.gross)} value={tot.gross} format={(n) => fmt.money(n)} hint={t(M.grossHint, { n: tot.orders })} />
          <Stat label={t(M.refunds)} value={tot.refunds} format={(n) => `− ${fmt.money(n)}`} hint={t(M.refundsHint, { n: tot.refundOrders })} />
          <Stat
            label={t(M.fees)}
            value={tot.fees}
            format={(n) => `− ${fmt.money(n, { decimals: "always" })}`}
            hint={fees && t(M.feesHint, { pix: fmt.num(fees.pixPct, 2), card: fmt.num(fees.creditPct, 2), fixed: fmt.money(fees.creditFixed, { decimals: "always" }) })}
          />
          <Stat label={t(M.commissions)} value={tot.commissions} format={(n) => `− ${fmt.money(n)}`} hint={t(M.commissionsHint, { n: data.prosCount })} />
          <Stat inverted label={t(M.net)} value={tot.net} format={(n) => fmt.money(n, { decimals: "always" })} hint={t(M.margin, { v: fmt.pct(tot.margin) })} />
        </section>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title={t(M.perDay)}>
          {data ? (
            <BarChart
              ariaLabel={t(M.perDay)}
              bars={data.byDay.map((d) => ({
                key: d.date,
                label: data.byDay.length > 10 ? fmt.numeric(d.date) : `${fmt.weekday(d.date)} ${Number(d.date.slice(8))}`,
                value: d.gross,
                detail: fmt.money(d.gross),
                stub: d.closed ? t(M.closed) : undefined,
                highlight: d.gross === Math.max(...data.byDay.map((x) => x.gross)),
              }))}
            />
          ) : (
            <SkeletonBlock className="h-52" />
          )}
        </Panel>
        <Panel title={t(M.byMethod)}>
          {data && (
            <div className="flex flex-col gap-5">
              <ShareBar
                ariaLabel={t(M.byMethod)}
                parts={data.byMethod.map((m) => ({ key: m.key, label: t(METHOD[m.key]), value: fmt.money(m.amount), pct: m.pct }))}
              />
              <div className="rounded-sm bg-muted px-3">
                <Row label={t(M.payout)} value={`${fmt.dayWeek(data.nextPayout.date)} · ${fmt.money(data.nextPayout.amount)}`} strong />
              </div>
            </div>
          )}
        </Panel>
      </div>

      <Panel title={t(M.table)} description={t(M.tableHint)}>
        <div className="overflow-x-auto">
          <Table className="min-w-[860px]">
            <TableHeader>
              <TableRow>
                <TableHead>{groupBy === "day" ? t(M.day) : t(M.week)}</TableHead>
                <TableHead className="text-right">{t(M.orders)}</TableHead>
                <TableHead className="text-right">{t(M.gross)}</TableHead>
                <TableHead className="text-right">{t(M.refunds)}</TableHead>
                <TableHead className="text-right">{t(M.fees)}</TableHead>
                <TableHead className="text-right">{t(M.commissions)}</TableHead>
                <TableHead className="text-right">{t(M.net)}</TableHead>
                <TableHead className="text-right">%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="tabular">
              {data?.rows.map((r) => (
                <TableRow key={r.from}>
                  <TableCell>{rowLabel(r)}</TableCell>
                  <TableCell className="text-right">{r.orders}</TableCell>
                  <TableCell className="text-right">{fmt.money(r.gross, { decimals: "always" })}</TableCell>
                  <TableCell className="text-right">{fmt.money(r.refunds, { decimals: "always" })}</TableCell>
                  <TableCell className="text-right">{fmt.money(r.fees, { decimals: "always" })}</TableCell>
                  <TableCell className="text-right">{fmt.money(r.commissions, { decimals: "always" })}</TableCell>
                  <TableCell className="text-right font-semibold">{fmt.money(r.net, { decimals: "always" })}</TableCell>
                  <TableCell className="text-right">{fmt.pct(r.margin)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Panel>
    </>
  );
}
