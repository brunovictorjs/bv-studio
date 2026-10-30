"use client";

import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { RoleGate } from "@/components/admin/shell";
import { Chip, Field, Panel, Row, ToggleRow } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useT, type Messages } from "@/i18n";
import { useAction, useDb } from "@/lib/client/hooks";
import { parseMoney } from "@/lib/domain/text";
import type { Settings } from "@/lib/domain/types";

const M = {
  save: ["Salvar alterações", "Save changes"],
  saved: ["Pagamento salvo.", "Payment saved."],
  stripe: ["Conta Stripe", "Stripe account"],
  connected: ["Conectada", "Connected"],
  country: ["País e moeda", "Country and currency"],
  env: ["Ambiente", "Environment"],
  envVal: ["Demonstração (simulado)", "Demo (simulated)"],
  payout: ["Repasse", "Payout"],
  payoutVal: ["semanal, toda sexta", "weekly, every Friday"],
  units: ["Unidades", "Locations"],
  unitsVal: ["uma conta para todas", "one account for all"],
  stripeHint: [
    "Cada cobrança leva a unidade na descrição (\"BV Studio · Salão · pedido BV-…\"), para os relatórios separarem o faturamento. As chaves ficam só no servidor.",
    "Each charge carries the location in its description (\"BV Studio · Salon · order BV-…\"), so reports can split revenue. Keys stay on the server.",
  ],
  openStripe: ["Abrir painel do Stripe", "Open Stripe dashboard"],
  methods: ["Formas aceitas", "Accepted methods"],
  pix: ["Pix", "Pix"],
  pixH: ["taxa {v}% · confirma na hora", "{v}% fee · confirms instantly"],
  credit: ["Cartão de crédito", "Credit card"],
  creditH: ["taxa {v}% + {f}", "{v}% fee + {f}"],
  debit: ["Cartão de débito", "Debit card"],
  debitH: ["taxa {v}%", "{v}% fee"],
  cash: ["Dinheiro no balcão", "Cash at the desk"],
  cashH: ["sem taxa · reserva na hora", "no fee · holds the time immediately"],
  boleto: ["Boleto", "Bank slip"],
  boletoH: ["compensação lenta demais para agendamento", "clears too slowly for bookings"],
  installments: ["Parcelar em até", "Installments up to"],
  noInterest: ["{n}x sem juros", "{n}x interest-free"],
  minInst: ["Parcela mínima", "Minimum installment"],
  webhooks: ["Webhooks", "Webhooks"],
  active: ["Ativo", "Active"],
  refund: ["Política de reembolso", "Refund policy"],
  cancelFee: ["Taxa de cancelamento", "Cancellation fee"],
  autoRefund: ["Estorno automático ao cancelar no prazo", "Automatic refund when cancelling in time"],
  adminLate: ["Administrador pode estornar fora do prazo", "Admins can refund after the deadline"],
  refundHint: [
    "O prazo de cancelamento e o tempo que o horário fica segurado esperando o pagamento são de cada unidade.",
    "The cancellation deadline and how long a time is held while paying are set per location.",
  ],
} satisfies Messages;

export default function PaymentPage() {
  return (
    <RoleGate roles={["admin"]}>
      <Payment />
    </RoleGate>
  );
}

function Payment() {
  const { t, fmt } = useT();
  const db = useDb();
  const { run, busy } = useAction("staff");
  const [p, setP] = useState<Settings["payment"] | null>(db ? structuredClone(db.settings.payment) : null);
  const [minInst, setMinInst] = useState(() => (db ? (db.settings.payment.minInstallment / 100).toFixed(2).replace(".", ",") : ""));
  const [fee, setFee] = useState(() => (db ? (db.settings.payment.cancelFee / 100).toFixed(2).replace(".", ",") : ""));
  const [dirty, setDirty] = useState(false);
  if (!db || !p) return null;
  const set = (patch: Partial<Settings["payment"]>) => {
    setP({ ...p, ...patch });
    setDirty(true);
  };
  const method = (k: keyof Settings["payment"]["methods"], v: boolean) => set({ methods: { ...p.methods, [k]: v } });
  const save = () =>
    run(
      "settings.save",
      { section: "payment", value: { ...p, minInstallment: parseMoney(minInst) ?? 0, cancelFee: parseMoney(fee) ?? 0 } },
      { success: t(M.saved) },
    ).then((r) => r && setDirty(false));
  const pct = (n: number) => fmt.num(n, 2);

  return (
    <>
      <div className="flex justify-end" data-anim>
        <Button disabled={busy || !dirty} onClick={save}>
          {t(M.save)}
        </Button>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title={t(M.stripe)}>
          <Chip active className="mb-3">
            ● {t(M.connected)}
          </Chip>
          <div className="flex flex-col divide-y divide-hairline text-sm">
            <Row label={t(M.country)} value={db.settings.company.currency === "auto" ? "Brasil · BRL" : db.settings.company.currency} />
            <Row label={t(M.env)} value={t(M.envVal)} />
            <Row label={t(M.payout)} value={t(M.payoutVal)} />
            <Row label={t(M.units)} value={t(M.unitsVal)} />
          </div>
          <p className="my-3 text-xs text-ink-muted">{t(M.stripeHint)}</p>
          <Button asChild variant="outline" size="sm">
            <a href="https://dashboard.stripe.com" target="_blank" rel="noreferrer">
              {t(M.openStripe)} <ExternalLink />
            </a>
          </Button>
        </Panel>
        <Panel title={t(M.methods)}>
          <ToggleRow title={t(M.pix)} description={t(M.pixH, { v: pct(p.fees.pixPct) })} checked={p.methods.pix} onChange={(v) => method("pix", v)} />
          <ToggleRow title={t(M.credit)} description={t(M.creditH, { v: pct(p.fees.creditPct), f: fmt.money(p.fees.creditFixed, { decimals: "always" }) })} checked={p.methods.credit} onChange={(v) => method("credit", v)} />
          <ToggleRow title={t(M.debit)} description={t(M.debitH, { v: pct(p.fees.debitPct) })} checked={p.methods.debit} onChange={(v) => method("debit", v)} />
          <ToggleRow title={t(M.cash)} description={t(M.cashH)} checked={p.methods.cash} onChange={(v) => method("cash", v)} />
          <ToggleRow title={t(M.boleto)} description={t(M.boletoH)} checked={p.methods.boleto} onChange={(v) => method("boleto", v)} />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label={t(M.installments)}>
              <Select value={String(p.installments)} onValueChange={(v) => set({ installments: Number(v) })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 6, 10, 12].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {t(M.noInterest, { n })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t(M.minInst)}>
              <Input inputMode="decimal" value={minInst} onChange={(e) => (setMinInst(e.target.value), setDirty(true))} />
            </Field>
          </div>
        </Panel>
        <Panel title={t(M.webhooks)}>
          <div className="flex flex-col divide-y divide-hairline font-mono text-sm">
            {["payment_intent.succeeded", "charge.refunded"].map((w) => (
              <Row key={w} label={w} value={<Chip active>{t(M.active)}</Chip>} />
            ))}
          </div>
        </Panel>
        <Panel title={t(M.refund)}>
          <Field label={t(M.cancelFee)} className="mb-2 max-w-48">
            <Input inputMode="decimal" value={fee} onChange={(e) => (setFee(e.target.value), setDirty(true))} />
          </Field>
          <ToggleRow title={t(M.autoRefund)} checked={p.autoRefund} onChange={(v) => set({ autoRefund: v })} />
          <ToggleRow title={t(M.adminLate)} checked={p.adminLateRefund} onChange={(v) => set({ adminLateRefund: v })} />
          <p className="mt-3 text-xs text-ink-muted">{t(M.refundHint)}</p>
        </Panel>
      </div>
    </>
  );
}
