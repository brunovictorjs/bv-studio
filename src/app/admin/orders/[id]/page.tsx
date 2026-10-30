"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { SettleDialog } from "@/components/admin/desk-dialogs";
import { RoleGate } from "@/components/admin/shell";
import { Avatar, Chip, Panel, Row, SkeletonBlock, StatusBadge } from "@/components/kit";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useT, type Messages } from "@/i18n";
import { C, METHOD, TIMELINE } from "@/i18n/common";
import { useAction, useDb, useQ, useStaff } from "@/lib/client/hooks";

const M = {
  back: ["Pedidos", "Orders"],
  seeChat: ["Ver conversa", "See chat"],
  resend: ["Reenviar comprovante", "Resend receipt"],
  resent: ["Comprovante reenviado para {to}.", "Receipt resent to {to}."],
  items: ["Itens do pedido", "Order items"],
  doneAt: ["feito às {t}", "done at {t}"],
  extra: ["extra", "extra"],
  delivered: ["entregue", "handed over"],
  launchedBy: ["lançado por {name}", "added by {name}"],
  discount: ["Desconto", "Discount"],
  fee: ["Taxa Stripe · {m}", "Stripe fee · {m}"],
  commExec: ["Comissão {name} · execução ({p}%)", "Commission {name} · service ({p}%)"],
  commProduct: ["Comissão {name} · produto ({p}%)", "Commission {name} · product ({p}%)"],
  refunded: ["Estornado", "Refunded"],
  net: ["Líquido para a casa", "Net for the house"],
  timeline: ["Linha do tempo", "Timeline"],
  clientSince: ["Cliente desde", "Client since"],
  orders: ["Pedidos", "Orders"],
  lates: ["Atrasos", "Late arrivals"],
  none: ["nenhum", "none"],
  desk: ["Balcão", "Front desk"],
  toReceive: ["A receber", "To collect"],
  allPaid: ["Tudo pago e entregue.", "All paid and handed over."],
  settle: ["Dar baixa", "Collect"],
  codes: ["Códigos", "Codes"],
  orderCode: ["Do pedido", "Order"],
  completionCode: ["De conclusão", "Completion"],
  completionHint: ["O de conclusão só fica visível para o cliente; aqui aparece para suporte.", "The completion code is only shown to the client; it appears here for support."],
  payments: ["Pagamentos", "Payments"],
  received: ["{name} · recebeu {r}, troco {c}", "{name} · received {r}, change {c}"],
  noPayments: ["Nenhum pagamento ainda.", "No payments yet."],
  late: ["Atrasado {n} min · encaixe {fit} · vira falta às {dl}", "{n} min late · fit at {fit} · no-show at {dl}"],
  noShow: ["Marcar falta", "Mark no-show"],
  noShowTitle: ["Marcar como falta?", "Mark as no-show?"],
  noShowBody: ["O horário volta para a agenda. O valor pago não é estornado.", "The time goes back to the agenda. The paid amount is not refunded."],
  cancel: ["Cancelar e estornar", "Cancel and refund"],
  cancelTitle: ["Cancelar o pedido {code}?", "Cancel order {code}?"],
  cancelBody: ["O horário volta para a agenda e o valor pago online é estornado.", "The time goes back to the agenda and the online payment is refunded."],
  refund: ["Estornar", "Refund"],
  done: ["Feito.", "Done."],
  noShowBtn: ["Confirmar falta", "Confirm no-show"],
  keep: ["Manter", "Keep"],
  walkin: ["avulso", "walk-in"],
} satisfies Messages;

export default function OrderDetailPage() {
  return (
    <RoleGate roles={["admin", "desk"]}>
      <OrderDetail />
    </RoleGate>
  );
}

function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const { t, tx, fmt } = useT();
  const me = useStaff();
  const db = useDb();
  const { data, error } = useQ("orderDetail", { id }, "staff");
  const { run, busy } = useAction("staff");
  const [settle, setSettle] = useState(false);
  if (error) return <p className="text-ink-muted">{t(["Pedido não encontrado.", "Order not found."])}</p>;
  if (!data) return <SkeletonBlock className="h-96" />;
  const o = data.order;
  const isAdmin = me?.roles.includes("admin");
  const pro = data.proName ?? "—";
  return (
    <>
      <Link href="/admin/orders" className="flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ChevronLeft className="size-4" /> {t(M.back)}
      </Link>
      <header className="flex flex-wrap items-end justify-between gap-4" data-anim>
        <div className="flex flex-col gap-2">
          <h1 className="font-mono text-3xl font-normal tracking-[0.04em] md:text-4xl">{o.code}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge state={data.state} />
            <Chip>{tx(db?.units.find((u) => u.id === o.unitId)?.name)}</Chip>
            {o.origin === "walkin" && <Chip>{t(M.walkin)}</Chip>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {data.conversationId && (
            <Button asChild variant="outline">
              <Link href={`/admin/conversations?c=${data.conversationId}`}>{t(M.seeChat)}</Link>
            </Button>
          )}
          <Button
            variant="outline"
            disabled={busy}
            onClick={async () => {
              const r = await run<{ to: string }>("order.resendReceipt", { orderId: o.id });
              if (r) (await import("sonner")).toast.success(t(M.resent, { to: r.to }));
            }}
          >
            {t(M.resend)}
          </Button>
          {data.state === "late" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline">{t(M.noShow)}</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t(M.noShowTitle)}</AlertDialogTitle>
                  <AlertDialogDescription>{t(M.noShowBody)}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t(M.keep)}</AlertDialogCancel>
                  <AlertDialogAction onClick={() => run("order.noShow", { orderId: o.id }, { success: t(M.done) })}>{t(M.noShowBtn)}</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {isAdmin && ["paid", "awaiting_payment"].includes(o.status) && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline">{t(M.cancel)}</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t(M.cancelTitle, { code: o.code })}</AlertDialogTitle>
                  <AlertDialogDescription>{t(M.cancelBody)}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t(M.keep)}</AlertDialogCancel>
                  <AlertDialogAction onClick={() => run("order.cancel", { orderId: o.id }, { success: t(M.done) })}>{t(M.cancel)}</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {isAdmin && o.status === "completed" && o.payments.some((p) => p.channel === "online") && o.refunded === 0 && (
            <Button variant="outline" disabled={busy} onClick={() => run("order.refund", { orderId: o.id }, { success: t(M.done) })}>
              {t(M.refund)}
            </Button>
          )}
        </div>
      </header>
      {data.late && (
        <p className="bv-hatch-strong rounded-sm border border-dashed border-ink p-3 text-sm" data-anim>
          {t(M.late, { n: data.late.minutesLate, fit: data.late.fitAt?.slice(11) ?? "—", dl: data.late.deadline.slice(11) })}
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-6">
          <Panel title={t(M.items)}>
            <div className="flex flex-col divide-y divide-hairline">
              {o.items.map((i) => (
                <Row
                  key={i.id}
                  label={
                    <span className="flex flex-col">
                      <span className="font-medium">
                        {tx(i.name)} {i.qty > 1 && `× ${i.qty}`} {i.addedBy && <span className="text-ink-muted">· {t(M.extra)}</span>}
                        {i.kind === "product" && i.delivered && <span className="text-ink-muted"> · {t(M.delivered)}</span>}
                      </span>
                      <span className="text-sm text-ink-muted">
                        {i.kind === "service" ? `${fmt.dur(i.durationMin)}${i.doneAt ? ` · ${t(M.doneAt, { t: i.doneAt.slice(11) })}` : ""}` : t(C.product)}
                        {i.addedBy && ` · ${t(M.launchedBy, { name: pro })}`}
                      </span>
                    </span>
                  }
                  value={fmt.money(i.unitPrice * i.qty, { decimals: "always" })}
                />
              ))}
              <Row label={t(C.subtotal)} value={fmt.money(data.subtotal, { decimals: "always" })} muted />
              {o.discount > 0 && <Row label={`${t(M.discount)} ${data.offerName ? `· ${tx(data.offerName)}` : ""}`} value={`− ${fmt.money(o.discount, { decimals: "always" })}`} muted />}
              <Row label={t(C.total)} value={fmt.money(data.total, { decimals: "always" })} strong className="text-lg" />
              {o.payments
                .filter((p) => p.fee > 0)
                .map((p) => (
                  <Row key={p.id} label={t(M.fee, { m: t(METHOD[p.method]) })} value={`− ${fmt.money(p.fee, { decimals: "always" })}`} muted />
                ))}
              {data.commission.exec > 0 && (
                <Row label={t(M.commExec, { name: pro, p: data.commission.execPct })} value={`− ${fmt.money(data.commission.exec, { decimals: "always" })}`} muted />
              )}
              {data.commission.product > 0 && (
                <Row label={t(M.commProduct, { name: pro, p: data.commission.productPct })} value={`− ${fmt.money(data.commission.product, { decimals: "always" })}`} muted />
              )}
              {o.refunded > 0 && <Row label={t(M.refunded)} value={`− ${fmt.money(o.refunded, { decimals: "always" })}`} muted />}
              <Row label={t(M.net)} value={fmt.money(data.net, { decimals: "always" })} strong />
            </div>
          </Panel>
          <Panel title={t(M.timeline)}>
            <ol className="flex flex-col">
              {data.timeline.map((e, i) => (
                <li key={i} className="flex gap-4 border-b border-hairline py-3 last:border-b-0">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-ink" aria-hidden="true" />
                  <div className="flex flex-col">
                    <span className="font-medium">
                      {t(TIMELINE[e.kind] ?? ["", ""])}
                      {e.note ? ` · ${tx(e.note)}` : ""}
                    </span>
                    <span className="text-sm text-ink-muted">
                      {fmt.relative(e.at)} {e.byName && `· ${e.byName}`}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
        <div className="flex flex-col gap-6">
          <Panel>
            <div className="flex items-center gap-3">
              <Avatar name={data.client.name || "?"} className="size-12" />
              <div className="flex min-w-0 flex-col">
                <span className="font-medium">{data.client.name}</span>
                <span className="truncate text-sm text-ink-muted">{[data.client.email, data.client.phone].filter(Boolean).join(" · ")}</span>
              </div>
            </div>
            <div className="mt-4 flex flex-col divide-y divide-hairline text-sm">
              {data.client.since && <Row label={t(M.clientSince)} value={fmt.monthName(Number(data.client.since.slice(5, 7)), false) + " " + data.client.since.slice(0, 4)} />}
              <Row label={t(M.orders)} value={data.client.orders} />
              <Row label={t(M.lates)} value={data.client.lates || t(M.none)} />
              <Row label={t(C.professional)} value={pro} />
            </div>
          </Panel>
          <Panel tag={t(M.desk).toLowerCase()}>
            <Row label={t(M.toReceive)} value={fmt.money(data.balance, { decimals: "always" })} strong className="text-lg" />
            {data.balance > 0 ? (
              <Button className="mt-3 w-full" onClick={() => setSettle(true)}>
                {t(M.settle)}
              </Button>
            ) : (
              <p className="text-sm text-ink-muted">{t(M.allPaid)}</p>
            )}
          </Panel>
          <Panel tag={t(M.codes).toLowerCase()}>
            <Row label={t(M.orderCode)} value={<span className="font-mono">{o.code}</span>} />
            {data.canSeeCompletion && <Row label={t(M.completionCode)} value={<span className="font-mono">{o.completionCode}</span>} />}
            <p className="mt-2 text-xs text-ink-muted">{t(M.completionHint)}</p>
          </Panel>
          <Panel tag={t(M.payments).toLowerCase()}>
            {data.payments.length === 0 && <p className="text-sm text-ink-muted">{t(M.noPayments)}</p>}
            <div className="flex flex-col divide-y divide-hairline">
              {data.payments.map((p) => (
                <Row
                  key={p.id}
                  label={
                    <span className="flex flex-col">
                      <span className="font-medium">
                        {t(METHOD[p.method])} · {p.channel === "online" ? t(C.online).toLowerCase() : t(C.counter).toLowerCase()}
                      </span>
                      <span className="font-mono text-xs text-ink-muted">
                        {p.stripeId
                          ? `Stripe ${p.stripeId.slice(0, 8)}…`
                          : p.byName && p.received != null
                            ? t(M.received, { name: p.byName.split(" ")[0], r: fmt.money(p.received), c: fmt.money(p.change ?? 0) })
                            : p.byName}
                      </span>
                    </span>
                  }
                  value={fmt.money(p.amount, { decimals: "always" })}
                />
              ))}
            </div>
          </Panel>
        </div>
      </div>
      {settle && <SettleDialog orderId={o.id} onClose={() => setSettle(false)} />}
    </>
  );
}
