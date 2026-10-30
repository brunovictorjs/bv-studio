"use client";

import { MessageCircle, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { DeliverDialog, SettleDialog, WalkinDialog } from "@/components/admin/desk-dialogs";
import { RoleGate, UnitPicker, useAdminUnit } from "@/components/admin/shell";
import { Empty, PageHeader, Panel, SkeletonBlock, Stat, StatusBadge } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useT, type Messages } from "@/i18n";
import { C, METHOD } from "@/i18n/common";
import { useNow, useQ } from "@/lib/client/hooks";
import { matches } from "@/lib/domain/text";
import { nowLocal } from "@/lib/domain/time";

const M = {
  title: ["Pedidos de hoje", "Today's orders"],
  search: ["Código ou nome do cliente", "Code or client name"],
  newWalkin: ["Novo pedido avulso", "New walk-in"],
  waiting: ["{n} cliente(s) esperando uma pessoa no WhatsApp", "{n} client(s) waiting for a person on WhatsApp"],
  waitingWith: ["com você", "with you"],
  waitingFor: ["há {n} min", "{n} min ago"],
  reply: ["Responder", "Reply"],
  toReceive: ["A receber no balcão", "To collect at the desk"],
  ordersN: ["{n} pedidos", "{n} orders"],
  receivedToday: ["Recebido hoje", "Collected today"],
  inCash: ["{v} em dinheiro", "{v} in cash"],
  toDeliver: ["Produtos a entregar", "Products to hand over"],
  pickups: ["{n} retirada(s)", "{n} pickup(s)"],
  ordersToday: ["Pedidos hoje", "Orders today"],
  walkins: ["{n} avulsos", "{n} walk-ins"],
  reason: ["Motivo", "Reason"],
  situation: ["Situação", "Status"],
  value: ["Valor", "Amount"],
  settle: ["Dar baixa", "Collect"],
  cash_booking: ["Agendado em dinheiro", "Booked to pay in cash"],
  balance: ["Saldo · {p}", "Balance · {p}"],
  balanceGeneric: ["Saldo do atendimento", "Service balance"],
  walkin: ["Pedido avulso", "Walk-in order"],
  pickup: ["Retirada", "Pickup"],
  fit: ["atrasado · encaixe {t}", "late · fitted at {t}"],
  deliverTitle: ["Produtos para entregar", "Products to hand over"],
  deliverHint: ["Confirme digitando o código do pedido.", "Confirm by typing the order code."],
  qty: ["Qtd.", "Qty"],
  type: ["Tipo", "Type"],
  typePickup: ["Retirada", "Pickup"],
  typeExtra: ["Extra do atendimento", "Extra from the service"],
  typeWith: ["Junto com o serviço", "Together with the service"],
  paidVia: ["Pago · {m}", "Paid · {m}"],
  dueAmount: ["{v} a receber", "{v} due"],
  deliver: ["Entregar", "Hand over"],
  receiveDeliver: ["Receber e entregar", "Collect and hand over"],
  closing: ["Fechamento do caixa", "Cash register closing"],
  closingHint: ["hoje · no balcão {a} + online {b}", "today · at the desk {a} + online {b}"],
  nothing: ["Nada a receber agora.", "Nothing to collect right now."],
  nothingDeliver: ["Nenhum produto esperando entrega.", "No products waiting to be handed over."],
} satisfies Messages;

export default function DeskPage() {
  return (
    <RoleGate roles={["admin", "desk"]}>
      <Desk />
    </RoleGate>
  );
}

function Desk() {
  const { t, tx, fmt } = useT();
  useNow(30000);
  const [unitId] = useAdminUnit({ allowAll: false });
  const { data } = useQ("counter", { unitId }, "staff");
  const [q, setQ] = useState("");
  const [settle, setSettle] = useState<string | null>(null);
  const [deliver, setDeliver] = useState<string | null>(null);
  const [walkin, setWalkin] = useState(false);
  const today = nowLocal().slice(0, 10);

  const receivables = data?.receivables.filter((r) => matches(`${r.code} ${r.client}`, q)) ?? [];
  const toDeliver = data?.toDeliver.filter((r) => matches(`${r.code} ${r.client}`, q)) ?? [];
  const reasonText = (r: (typeof receivables)[number]) =>
    r.reason === "cash_booking"
      ? t(M.cash_booking)
      : r.reason === "walkin"
        ? t(M.walkin)
        : r.reason === "pickup"
          ? t(M.pickup)
          : r.extraName
            ? t(M.balance, { p: tx(r.extraName) })
            : t(M.balanceGeneric);

  return (
    <>
      <PageHeader
        eyebrow={`${tx(data?.unitName ?? "")} · ${fmt.dayLong(today)}`}
        title={t(M.title)}
        actions={
          <>
            <UnitPicker allowAll={false} className="min-w-56" />
            <label className="flex h-10 min-w-64 items-center gap-2 rounded-sm border border-input px-3">
              <Search className="size-4 text-ink-muted" />
              <input type="search" className="flex-1 bg-transparent outline-none" placeholder={t(M.search)} aria-label={t(M.search)} value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
            <Button onClick={() => setWalkin(true)}>
              <Plus /> {t(M.newWalkin)}
            </Button>
          </>
        }
      />

      {data && data.forwarded.length > 0 && (
        <Link href="/admin/conversations" className="bv-gradient flex flex-wrap items-center gap-4 rounded-md border border-hairline p-4" data-anim>
          <MessageCircle className="size-6" />
          <span className="flex flex-1 flex-col">
            <span className="font-medium">{t(M.waiting, { n: data.forwarded.filter((f) => f.status === "forwarded").length })}</span>
            <span className="text-sm text-ink-muted">
              {data.forwarded.map((f) => `${f.name} ${f.status === "human" ? t(M.waitingWith) : t(M.waitingFor, { n: f.waitMin })}`).join(" · ")}
            </span>
          </span>
          <span className="bv-label text-ink">{t(M.reply)} →</span>
        </Link>
      )}

      {!data ? (
        <SkeletonBlock className="h-32" />
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label={t(M.toReceive)} value={data.receivableTotal} format={(n) => fmt.money(n)} hint={t(M.ordersN, { n: data.receivables.length })} />
          <Stat label={t(M.receivedToday)} value={data.receivedToday} format={(n) => fmt.money(n)} hint={t(M.inCash, { v: fmt.money(data.cashToday) })} />
          <Stat label={t(M.toDeliver)} value={data.toDeliver.length} format={(n) => String(n)} hint={t(M.pickups, { n: data.pickups })} />
          <Stat label={t(M.ordersToday)} value={data.ordersToday} format={(n) => String(n)} hint={t(M.walkins, { n: data.walkinsToday })} />
        </section>
      )}

      <Panel title={t(M.toReceive)}>
        {data && receivables.length === 0 ? (
          <Empty>{t(M.nothing)}</Empty>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[820px]">
              <TableHeader>
                <TableRow>
                  <TableHead>{t(C.code)}</TableHead>
                  <TableHead>{t(C.client)}</TableHead>
                  <TableHead>{t(M.reason)}</TableHead>
                  <TableHead>{t(C.professional)}</TableHead>
                  <TableHead>{t(M.situation)}</TableHead>
                  <TableHead className="text-right">{t(M.value)}</TableHead>
                  <TableHead>
                    <span className="sr-only">{t(C.actions)}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receivables.map((r) => (
                  <TableRow key={r.orderId}>
                    <TableCell>
                      <Link href={`/admin/orders/${r.orderId}`} className="font-mono font-medium underline-offset-4 hover:underline">
                        {r.code}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {r.client} {r.walkin && <span className="text-ink-muted">· {t(C.walkin)}</span>}
                    </TableCell>
                    <TableCell className="text-ink-muted">{reasonText(r)}</TableCell>
                    <TableCell>{r.pro ?? "—"}</TableCell>
                    <TableCell>
                      {r.state === "late" ? (
                        <StatusBadge state="late">{r.fitAt ? t(M.fit, { t: r.fitAt.slice(11) }) : undefined}</StatusBadge>
                      ) : r.state === "paid" || r.state === "awaiting_payment" ? (
                        <StatusBadge state="awaiting_payment">{r.start ? r.start.slice(11) : undefined}</StatusBadge>
                      ) : (
                        <StatusBadge state={r.state} />
                      )}
                    </TableCell>
                    <TableCell className="tabular text-right font-semibold">{fmt.money(r.amount, { decimals: "always" })}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => setSettle(r.orderId)}>
                        {t(M.settle)}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>

      <Panel title={t(M.deliverTitle)} description={t(M.deliverHint)}>
        {data && toDeliver.length === 0 ? (
          <Empty>{t(M.nothingDeliver)}</Empty>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[820px]">
              <TableHeader>
                <TableRow>
                  <TableHead>{t(C.product)}</TableHead>
                  <TableHead className="text-right">{t(M.qty)}</TableHead>
                  <TableHead>{t(C.code)}</TableHead>
                  <TableHead>{t(C.client)}</TableHead>
                  <TableHead>{t(M.type)}</TableHead>
                  <TableHead>{t(C.payment)}</TableHead>
                  <TableHead>
                    <span className="sr-only">{t(C.actions)}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {toDeliver.map((r) => (
                  <TableRow key={`${r.orderId}${r.itemId}`}>
                    <TableCell className="font-medium">{tx(r.product)}</TableCell>
                    <TableCell className="tabular text-right">{r.qty}</TableCell>
                    <TableCell>
                      <Link href={`/admin/orders/${r.orderId}`} className="font-mono underline-offset-4 hover:underline">
                        {r.code}
                      </Link>
                    </TableCell>
                    <TableCell>{r.client}</TableCell>
                    <TableCell className="text-ink-muted">{t(r.type === "pickup" ? M.typePickup : r.type === "extra" ? M.typeExtra : M.typeWith)}</TableCell>
                    <TableCell>
                      {r.due > 0 ? (
                        <StatusBadge state="awaiting_payment">{t(M.dueAmount, { v: fmt.money(r.due, { decimals: "always" }) })}</StatusBadge>
                      ) : (
                        <StatusBadge state="paid">{t(M.paidVia, { m: r.method ? t(METHOD[r.method]) : "—" })}</StatusBadge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.due > 0 ? (
                        <Button size="sm" onClick={() => setSettle(r.orderId)}>
                          {t(M.receiveDeliver)}
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => setDeliver(r.orderId)}>
                          {t(M.deliver)}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>

      {data && (
        <Panel
          title={t(M.closing)}
          description={t(M.closingHint, { a: fmt.money(data.receivedToday), b: fmt.money(data.closing.online) })}
        >
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {(["cash", "store_pix", "pos_debit", "pos_credit"] as const).map((m) => (
              <div key={m} className="flex flex-col gap-1 rounded-sm bg-muted p-4">
                <span className="text-xs text-ink-muted">{t(METHOD[m])}</span>
                <span className="tabular text-xl font-semibold">{fmt.money(data.closing[m])}</span>
              </div>
            ))}
            <div className="flex flex-col gap-1 rounded-sm bg-ink p-4 text-surface-0">
              <span className="text-xs opacity-70">{t(C.online)} (Stripe)</span>
              <span className="tabular text-xl font-semibold">{fmt.money(data.closing.online)}</span>
            </div>
          </div>
        </Panel>
      )}

      <SettleDialog key={settle ?? "s"} orderId={settle} onClose={() => setSettle(null)} />
      <DeliverDialog key={deliver ?? "d"} orderId={deliver} onClose={() => setDeliver(null)} />
      <WalkinDialog unitId={unitId} open={walkin} onClose={() => setWalkin(false)} />
    </>
  );
}
