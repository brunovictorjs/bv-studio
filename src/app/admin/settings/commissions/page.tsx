"use client";

import { useState } from "react";
import { RoleGate, UnitPicker, useAdminUnit } from "@/components/admin/shell";
import { Field, Panel, ToggleRow } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useT, type Messages } from "@/i18n";
import { C } from "@/i18n/common";
import { useAction, useDb, useQ } from "@/lib/client/hooks";
import { parsePct } from "@/lib/domain/text";
import { nowLocal, startOfMonth } from "@/lib/domain/time";
import type { Settings } from "@/lib/domain/types";

const M = {
  save: ["Salvar alterações", "Save changes"],
  saved: ["Comissões salvas.", "Commissions saved."],
  scope: ["Percentuais e exceções valem por unidade. Valores do mês, de {a} a {b}.", "Rates and exceptions apply per location. Month figures, {a} to {b}."],
  perPro: ["Comissão por profissional", "Commission per professional"],
  exec: ["Execução", "Service"],
  products: ["Produtos", "Products"],
  served: ["Atendimentos", "Services"],
  services: ["Serviços", "Services"],
  sold: ["Produtos vendidos", "Products sold"],
  toPay: ["A repassar", "To pay out"],
  totalUnit: ["Total da unidade", "Location total"],
  exceptions: ["Exceção por categoria", "Category exception"],
  pct: ["%", "%"],
  reason: ["Motivo", "Reason"],
  add: ["Adicionar", "Add"],
  exHint: ["A exceção vence o percentual do profissional, só nesta unidade.", "The exception overrides the professional's rate, at this location only."],
  rules: ["O que entra na comissão", "What counts toward commission"],
  rCompleted: ["Pedido concluído", "Completed order"],
  rNoShow: ["Pedido pago mas não concluído (falta)", "Paid but not completed (no-show)"],
  rLate: ["Encaixe de cliente atrasado", "Late client fitted in"],
  rRefunded: ["Pedido estornado", "Refunded order"],
  rByPro: ["Produto lançado pelo profissional", "Product added by the professional"],
  rOnline: ["Produto comprado no site", "Product bought online"],
  defaults: ["Padrão para novos profissionais", "Default for new professionals"],
  footer: ["Fechamento semanal, de sábado a sexta; repasse na sexta.", "Weekly closing, Saturday to Friday; payout on Friday."],
} satisfies Messages;

export default function CommissionsPage() {
  return (
    <RoleGate roles={["admin"]}>
      <Commissions />
    </RoleGate>
  );
}

function Commissions() {
  const { t, tx, fmt } = useT();
  const db = useDb();
  const [unitId] = useAdminUnit({ allowAll: false });
  const today = nowLocal().slice(0, 10);
  const from = startOfMonth(today);
  const { data } = useQ("commissions", { unitId, from, to: today }, "staff");
  const { run, busy } = useAction("staff");
  const [c, setC] = useState<Settings["commissions"] | null>(db ? structuredClone(db.settings.commissions) : null);
  const [pros, setPros] = useState<Record<string, { exec: string; product: string }>>({});
  const [dirty, setDirty] = useState(false);
  const [ex, setEx] = useState({ categoryId: "", pct: "", reason: "" });
  if (!db || !c) return null;
  const set = (p: Partial<Settings["commissions"]>) => {
    setC({ ...c, ...p });
    setDirty(true);
  };
  const cats = db.categories.filter((x) => x.kind === "service");
  const save = () =>
    run(
      "settings.save",
      {
        section: "commissions",
        value: {
          ...c,
          pros: (data?.rows ?? []).map((r) => ({
            id: r.id,
            exec: parsePct(pros[r.id]?.exec ?? String(r.exec)) ?? r.exec,
            product: parsePct(pros[r.id]?.product ?? String(r.product)) ?? r.product,
          })),
        },
      },
      { success: t(M.saved) },
    ).then((r) => r && setDirty(false));

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3" data-anim>
        <UnitPicker allowAll={false} label={t(C.unit)} />
        <Button disabled={busy || !dirty} onClick={save}>
          {t(M.save)}
        </Button>
      </div>
      <p className="text-sm text-ink-muted" data-anim>
        {t(M.scope, { a: fmt.day(from), b: fmt.day(today) })}
      </p>
      <Panel title={t(M.perPro)}>
        <div className="overflow-x-auto">
          <Table className="min-w-[820px]">
            <TableHeader>
              <TableRow>
                <TableHead>{t(C.professional)}</TableHead>
                <TableHead>{t(M.exec)}</TableHead>
                <TableHead>{t(M.products)}</TableHead>
                <TableHead className="text-right">{t(M.served)}</TableHead>
                <TableHead className="text-right">{t(M.services)}</TableHead>
                <TableHead className="text-right">{t(M.sold)}</TableHead>
                <TableHead className="text-right">{t(M.toPay)}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  {(["exec", "product"] as const).map((k) => (
                    <TableCell key={k}>
                      <div className="flex items-center gap-1">
                        <Input
                          className="h-8 w-16"
                          inputMode="decimal"
                          aria-label={`${t(k === "exec" ? M.exec : M.products)} · ${r.name}`}
                          value={pros[r.id]?.[k] ?? String(r[k])}
                          onChange={(e) => {
                            setPros({ ...pros, [r.id]: { exec: pros[r.id]?.exec ?? String(r.exec), product: pros[r.id]?.product ?? String(r.product), [k]: e.target.value } });
                            setDirty(true);
                          }}
                        />
                        <span className="text-ink-muted">%</span>
                      </div>
                    </TableCell>
                  ))}
                  <TableCell className="tabular text-right">{r.count}</TableCell>
                  <TableCell className="tabular text-right">{fmt.money(r.services)}</TableCell>
                  <TableCell className="tabular text-right">{fmt.money(r.products)}</TableCell>
                  <TableCell className="tabular text-right font-semibold">{fmt.money(r.toPay, { decimals: "always" })}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            {data && (
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3}>{t(M.totalUnit)}</TableCell>
                  <TableCell className="tabular text-right">{data.totals.count}</TableCell>
                  <TableCell className="tabular text-right">{fmt.money(data.totals.services)}</TableCell>
                  <TableCell className="tabular text-right">{fmt.money(data.totals.products)}</TableCell>
                  <TableCell className="tabular text-right font-semibold">{fmt.money(data.totals.toPay, { decimals: "always" })}</TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </div>
      </Panel>
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title={t(M.exceptions)} description={tx(db.units.find((u) => u.id === unitId)?.name)}>
          <ul className="flex flex-col divide-y divide-hairline">
            {c.exceptions
              .filter((e) => e.unitId === unitId)
              .map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span>
                    <strong className="font-medium">{tx(cats.find((x) => x.id === e.categoryId)?.name)}</strong> · {e.pct}% · <span className="text-ink-muted">{tx(e.reason)}</span>
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => set({ exceptions: c.exceptions.filter((x) => x.id !== e.id) })}>
                    {t(C.remove)}
                  </Button>
                </li>
              ))}
          </ul>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <Field label={t(C.category)}>
              <Select value={ex.categoryId} onValueChange={(v) => setEx({ ...ex, categoryId: v })}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {cats.map((x) => (
                    <SelectItem key={x.id} value={x.id}>
                      {tx(x.name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t(M.pct)}>
              <Input className="w-20" inputMode="decimal" value={ex.pct} onChange={(e) => setEx({ ...ex, pct: e.target.value })} />
            </Field>
            <Field label={t(M.reason)} className="min-w-40 flex-1">
              <Input value={ex.reason} onChange={(e) => setEx({ ...ex, reason: e.target.value })} />
            </Field>
            <Button
              variant="outline"
              disabled={!ex.categoryId || parsePct(ex.pct) == null}
              onClick={() => {
                set({ exceptions: [...c.exceptions, { id: `ex-${Date.now()}`, unitId, categoryId: ex.categoryId, pct: parsePct(ex.pct)!, reason: ex.reason }] });
                setEx({ categoryId: "", pct: "", reason: "" });
              }}
            >
              {t(M.add)}
            </Button>
          </div>
          <p className="mt-3 text-xs text-ink-muted">{t(M.exHint)}</p>
        </Panel>
        <Panel title={t(M.rules)}>
          {(
            [
              ["completed", M.rCompleted],
              ["noShow", M.rNoShow],
              ["lateFit", M.rLate],
              ["refunded", M.rRefunded],
              ["productByPro", M.rByPro],
              ["productOnline", M.rOnline],
            ] as const
          ).map(([k, label]) => (
            <ToggleRow key={k} title={t(label)} checked={c.rules[k]} onChange={(v) => set({ rules: { ...c.rules, [k]: v } })} />
          ))}
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <span className="w-full text-sm font-medium">{t(M.defaults)}</span>
            <Field label={t(M.exec)}>
              <Input className="w-24" inputMode="decimal" value={c.defaultExec} onChange={(e) => set({ defaultExec: parsePct(e.target.value) ?? 0 })} />
            </Field>
            <Field label={t(M.products)}>
              <Input className="w-24" inputMode="decimal" value={c.defaultProduct} onChange={(e) => set({ defaultProduct: parsePct(e.target.value) ?? 0 })} />
            </Field>
          </div>
          <p className="mt-3 text-xs text-ink-muted">{t(M.footer)}</p>
        </Panel>
      </div>
    </>
  );
}
