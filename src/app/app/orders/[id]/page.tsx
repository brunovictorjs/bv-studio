"use client";

import { Check, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import { SignInGate } from "@/components/client/shared";
import { Avatar, Row, SkeletonBlock, StatusBadge } from "@/components/kit";
import { gsap } from "@/components/motion";
import { BottomBar, MobileHeader } from "@/components/mobile";
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
import { METHOD } from "@/i18n/common";
import { useAction, useClient, useClock, useNow, useQ } from "@/lib/client/hooks";
import { nowLocal } from "@/lib/domain/time";
import { cn } from "@/lib/utils";

const M = {
  order: ["Pedido", "Order"],
  allSet: ["Tudo certo", "All set"],
  paidTitle: ["Pago", "Paid"],
  heldTitle: ["Reservado", "Held"],
  showCode: ["Mostre este código na chegada", "Show this code on arrival"],
  codeHint: ["A profissional digita esse código para confirmar que é você e começar o atendimento.", "The professional types this code to confirm it's you and start the service."],
  receipt: ["Enviamos o comprovante para {email}. A assistente do {unit} vai te lembrar 1 dia e 2 horas antes, no WhatsApp.", "We sent the receipt to {email}. The {unit} assistant will remind you 1 day and 2 hours before, on WhatsApp."],
  withPro: ["com {name}", "with {name}"],
  showOnArrival: ["Mostre na chegada · {d}", "Show on arrival · {d}"],
  progress: ["Andamento", "Progress"],
  stCart: ["No carrinho", "In cart"],
  stPaid: ["Pago com {m}", "Paid with {m}"],
  stHeld: ["Reservado · paga no balcão", "Held · pays at the desk"],
  stWaiting: ["Aguardando você no {unit}", "Waiting for you at the {unit}"],
  stReminder: ["lembrete enviado no WhatsApp", "reminder sent on WhatsApp"],
  stService: ["Em atendimento", "In service"],
  stDone: ["Concluído", "Completed"],
  items: ["Itens", "Items"],
  deskHands: ["a balconista entrega", "the front desk hands it over"],
  discount: ["Desconto", "Discount"],
  paidOnline: ["Pago online", "Paid online"],
  toPay: ["A pagar no balcão", "To pay at the desk"],
  refunded: ["Estornado", "Refunded"],
  cancel: ["Cancelar e pedir reembolso", "Cancel and get a refund"],
  cancelUntil: ["Disponível até {d}", "Available until {d}"],
  cancelTitle: ["Cancelar o pedido {code}?", "Cancel order {code}?"],
  cancelBody: ["Seu horário volta para a agenda do {unit} e o valor é estornado.", "Your time goes back to the {unit} agenda and the amount is refunded."],
  paidAmount: ["Valor pago", "Amount paid"],
  fee: ["Taxa de cancelamento", "Cancellation fee"],
  youGet: ["Você recebe", "You get back"],
  refundTiming: ["Pix cai em até 1 hora. Cartão pode levar até 2 faturas, conforme o banco.", "Pix arrives within 1 hour. Cards can take up to 2 statements, depending on the bank."],
  confirmCancel: ["Sim, cancelar e estornar", "Yes, cancel and refund"],
  keep: ["Manter meu horário", "Keep my time"],
  cancelled: ["Pedido cancelado.", "Order cancelled."],
  live: ["Seu atendimento", "Your service"],
  liveBadge: ["Ao vivo", "Live"],
  startedAt: ["começou às {t}", "started at {t}"],
  chair: ["cadeira {n}", "chair {n}"],
  completionCode: ["Código de conclusão", "Completion code"],
  completionHint: ["Quando {name} terminar, vai pedir este código. Só com ele o pedido é fechado como concluído.", "When {name} finishes, they'll ask for this code. Only with it the order is closed as completed."],
  completionWarn: ["Não mostre o código antes do serviço acabar. Ele confirma que você foi atendida.", "Don't show the code before the service is over. It confirms you were served."],
  pkg: ["Pacote em execução", "Package in progress"],
  inProgress: ["em andamento", "in progress"],
  done: ["feito", "done"],
  lateTitle: ["Seu horário já passou", "Your time has passed"],
  lateBody: [
    "O reembolso valia até {t}. Seu pedido continua valendo: assim que você chegar, a gente encaixa você na primeira folga entre os agendamentos.",
    "Refunds were available until {t}. Your order is still valid: as soon as you arrive, we'll fit you into the first gap between bookings.",
  ],
  wasNow: ["Era {a} · agora são {b}", "Was {a} · it's now {b}"],
  fit: ["Encaixe estimado", "Estimated fit"],
  forecast: ["previsão", "forecast"],
  queue: ["{n}º na fila de encaixe", "#{n} in the fit-in queue"],
  noShowAt: ["A assistente já te avisou no WhatsApp. Se não chegar até {t}, o pedido vira falta.", "The assistant already let you know on WhatsApp. If you don't arrive by {t}, it becomes a no-show."],
  priority: ["Quem chegou no horário tem prioridade. Precisa de ajuda? Fale com a recepção: {p} ou", "People who arrived on time come first. Need help? Call the front desk: {p} or"],
  onWhatsapp: ["no WhatsApp", "on WhatsApp"],
  cancelUnavailable: ["Cancelamento indisponível", "Cancellation unavailable"],
  deadlinePassed: ["O prazo de cancelamento terminou às {t}.", "The cancellation window ended at {t}."],
  review: ["Avaliar atendimento", "Rate the service"],
  reviewed: ["Obrigada pela avaliação.", "Thanks for your review."],
  again: ["Agendar de novo", "Book again"],
  pickupCode: ["Mostre este código no balcão", "Show this code at the desk"],
} satisfies Messages;

export default function OrderPage() {
  return (
    <SignInGate>
      <Suspense>
        <OrderView />
      </Suspense>
    </SignInGate>
  );
}

function OrderView() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const fresh = params.get("new") === "1";
  const { t, tx, fmt } = useT();
  useNow(15000);
  const client = useClient();
  const { data: o } = useQ("clientOrder", { id }, "client");
  const { run, busy } = useAction("client");
  const codeRef = useRef<HTMLDivElement>(null);
  const nowMs = useClock(1000);
  useEffect(() => {
    if (fresh && codeRef.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      gsap.fromTo(codeRef.current, { scale: 0.85, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.7, ease: "back.out(1.6)", delay: 0.2 });
  }, [fresh, o?.id]);
  if (!o) return <SkeletonBlock className="m-4 h-96" />;

  const unit = tx(o.unitName);
  const services = o.items.filter((i) => i.kind === "service");
  const proFirst = o.pro?.firstName ?? "";
  const startLabel = o.start ? `${fmt.dayLong(o.start)} · ${fmt.hour(o.start.slice(11))}` : "";

  // ---------- live service
  if (o.state === "in_service") {
    const started = o.startedAt ?? o.start ?? nowLocal();
    const [d, tm] = started.split("T");
    const [y, mo, da] = d.split("-").map(Number);
    const [h, mi] = tm.split(":").map(Number);
    const secs = Math.max(0, Math.floor((nowMs - new Date(y, mo - 1, da, h, mi).getTime()) / 1000));
    return (
      <div className="flex flex-1 flex-col">
        <MobileHeader title={t(M.live)} back="/app/orders" right={<span className="bv-label mr-2 rounded-sm bg-ink px-2 py-1 text-surface-0">● {t(M.liveBadge)}</span>} />
        <div className="flex flex-col gap-5 p-5">
          <div className="flex items-center gap-3" data-anim>
            {o.pro && <Avatar name={o.pro.name} inverted className="size-12" />}
            <div className="flex flex-1 flex-col">
              <span className="font-semibold">{o.pro?.name}</span>
              <span className="text-sm text-ink-muted">
                {t(M.startedAt, { t: fmt.hour(started.slice(11)) })} {o.pro?.chair && `· ${t(M.chair, { n: o.pro.chair })}`} · {unit}
              </span>
            </div>
            <span className="font-mono text-lg tabular">
              {String(Math.floor(secs / 60)).padStart(2, "0")}:{String(secs % 60).padStart(2, "0")}
            </span>
          </div>
          <div className="flex flex-col items-center gap-2 rounded-md bg-ink p-6 text-center text-surface-0" data-anim>
            <span className="bv-label text-surface-0/70">{t(M.completionCode)}</span>
            <span className="font-mono text-5xl tracking-[0.1em]">{o.completionCode}</span>
            <p className="text-sm text-surface-0/80">{t(M.completionHint, { name: proFirst })}</p>
          </div>
          <p className="rounded-md border border-dashed border-ink p-3 text-sm">{t(M.completionWarn)}</p>
          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">{t(M.pkg)}</h2>
            <div className="flex flex-col divide-y divide-hairline rounded-md border border-hairline px-3">
              {o.items.map((i) => (
                <Row
                  key={i.id}
                  label={
                    <span className="flex items-center gap-2">
                      {i.kind === "service" && (i.doneAt ? <Check className="size-4" /> : <span className="size-2 animate-pulse rounded-full bg-ink" />)}
                      {tx(i.name)} {i.qty > 1 && `× ${i.qty}`}
                    </span>
                  }
                  value={<span className="text-xs text-ink-muted">{i.kind === "service" ? (i.doneAt ? t(M.done) : `${t(M.inProgress)} · ${fmt.dur(i.durationMin)}`) : t(M.deskHands)}</span>}
                />
              ))}
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="font-mono">
                {t(M.order)} {o.code}
              </span>
              <StatusBadge state={o.paid > 0 ? "paid" : "awaiting_payment"}>{o.paid > 0 && o.method ? `${t(["Pago", "Paid"])} · ${t(METHOD[o.method])}` : undefined}</StatusBadge>
            </div>
          </section>
        </div>
      </div>
    );
  }

  // ---------- late
  if (o.state === "late" && o.late) {
    return (
      <div className="flex flex-1 flex-col">
        <MobileHeader title={`${t(M.order)} ${o.code}`} back="/app/orders" />
        <div className="flex flex-col gap-5 p-5">
          <StatusBadge state="late" className="self-start" />
          <span className="font-mono text-4xl">{o.code}</span>
          <p className="text-sm text-ink-muted">
            {t(M.wasNow, { a: fmt.hour(o.start!.slice(11)), b: fmt.hour(nowLocal().slice(11)) })}
            <br />
            {services.map((s) => tx(s.name)).join(" + ")} {o.pro && `· ${t(M.withPro, { name: proFirst })}`} · {unit}
          </p>
          <div className="flex flex-col gap-2 rounded-md border border-hairline p-4">
            <span className="font-semibold">{t(M.lateTitle)}</span>
            <p className="text-sm text-ink-muted">{t(M.lateBody, { t: fmt.hour(o.start!.slice(11)) })}</p>
          </div>
          <div className="bv-hatch-strong flex flex-col gap-1 rounded-md border border-dashed border-ink p-4">
            <span className="bv-label">{t(M.fit)}</span>
            <span className="text-4xl font-semibold">{o.late.fitAt ? fmt.hour(o.late.fitAt.slice(11)) : "—"}</span>
            <span className="text-sm">
              {t(M.forecast)} · {t(M.queue, { n: o.late.queuePos })}
            </span>
          </div>
          <p className="text-sm text-ink-muted">{t(M.noShowAt, { t: fmt.hour(o.late.deadline.slice(11)) })}</p>
          <p className="text-sm text-ink-muted">
            {t(M.priority, { p: o.unitPhone })}{" "}
            <Link href={`/app/${o.unitSlug}/chat`} className="text-ink underline">
              {t(M.onWhatsapp)}
            </Link>
            .
          </p>
        </div>
        <BottomBar>
          <Button size="lg" variant="outline" className="w-full" disabled>
            {t(M.cancelUnavailable)}
          </Button>
          <p className="mt-2 text-center text-xs text-ink-muted">{t(M.deadlinePassed, { t: fmt.hour(o.start!.slice(11)) })}</p>
        </BottomBar>
      </div>
    );
  }

  // ---------- default (confirmation / scheduled / history)
  const steps = [
    { label: t(M.stCart), at: o.timeline.find((e) => e.kind === "cart" || e.kind === "created")?.at, done: true },
    {
      label: o.paid > 0 ? t(M.stPaid, { m: o.method ? t(METHOD[o.method]) : "" }) : t(M.stHeld),
      at: o.timeline.find((e) => e.kind === "paid" || e.kind === "reserved_cash")?.at,
      done: ["paid", "awaiting_payment", "in_service", "completed"].includes(o.status),
    },
    ...(o.hasServices
      ? [
          {
            label: t(M.stWaiting, { unit }),
            sub: o.timeline.some((e) => e.kind === "reminder") ? t(M.stReminder) : undefined,
            current: ["paid", "awaiting_payment"].includes(o.status),
            done: ["in_service", "completed"].includes(o.status),
          },
          { label: t(M.stService), at: o.startedAt ?? undefined, done: ["completed"].includes(o.status) || o.status === "in_service" },
        ]
      : []),
    { label: t(M.stDone), at: o.completedAt ?? undefined, done: o.status === "completed" },
  ];
  const isOpen = ["paid", "awaiting_payment"].includes(o.status);

  return (
    <div className="flex flex-1 flex-col">
      <MobileHeader title={fresh ? t(M.allSet) : `${t(M.order)} ${o.code}`} back="/app/orders" />
      <div className="flex flex-col gap-5 p-5">
        {fresh && isOpen ? (
          <div className="flex flex-col gap-1" data-anim>
            <span className="bv-label">{t(M.allSet)}</span>
            <h1 className="text-4xl font-semibold">{o.paid > 0 ? t(M.paidTitle) : t(M.heldTitle)}</h1>
            {o.start && (
              <p className="text-ink-muted">
                <span className="inline-block first-letter:uppercase">{startLabel}</span> {o.pro && `· ${t(M.withPro, { name: proFirst })}`}
                <br />
                {unit} · {o.unitAddress}
              </p>
            )}
          </div>
        ) : (
          <StatusBadge state={o.state} className="self-start" />
        )}
        {isOpen && (
          <div ref={codeRef} className="flex flex-col items-center gap-2 rounded-md border-2 border-ink p-6 text-center">
            <span className="bv-label">{o.hasServices ? t(M.showCode) : t(M.pickupCode)}</span>
            <span className="font-mono text-4xl tracking-[0.08em]">{o.code}</span>
            {o.hasServices && !fresh && o.start && <span className="text-sm text-ink-muted first-letter:uppercase">{t(M.showOnArrival, { d: startLabel })}</span>}
            {o.pro && !fresh && (
              <span className="text-sm text-ink-muted">
                {unit} · {t(M.withPro, { name: proFirst })}
              </span>
            )}
            {o.hasServices && <p className="mt-1 text-xs text-ink-muted">{t(M.codeHint)}</p>}
          </div>
        )}

        {!fresh && (
          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">{t(M.progress)}</h2>
            <ol className="flex flex-col">
              {steps.map((s, i) => (
                <li key={i} className="flex gap-3 pb-4 last:pb-0">
                  <span className="flex flex-col items-center">
                    <span className={cn("flex size-5 items-center justify-center rounded-full border", s.done ? "border-ink bg-ink text-surface-0" : "current" in s && s.current ? "border-2 border-ink" : "border-hairline")}>
                      {s.done && <Check className="size-3" />}
                    </span>
                    {i < steps.length - 1 && <span className={cn("w-px flex-1", s.done ? "bg-ink" : "bg-hairline")} />}
                  </span>
                  <span className="flex flex-col pb-1">
                    <span className={cn("text-sm", s.done || ("current" in s && s.current) ? "font-medium" : "text-ink-muted")}>{s.label}</span>
                    {"at" in s && s.at && <span className="text-xs text-ink-muted">{fmt.relative(s.at)}</span>}
                    {"sub" in s && s.sub && <span className="text-xs text-ink-muted">{s.sub}</span>}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">{t(M.items)}</h2>
          <div className="flex flex-col divide-y divide-hairline rounded-md border border-hairline px-3">
            {o.items.map((i) => (
              <Row
                key={i.id}
                label={
                  <span>
                    {tx(i.name)} {i.kind === "service" ? `· ${fmt.dur(i.durationMin)}` : `× ${i.qty}`}
                    {i.kind === "product" && o.hasServices && <span className="block text-xs text-ink-muted">{t(M.deskHands)}</span>}
                  </span>
                }
                value={fmt.money(i.unitPrice * i.qty)}
              />
            ))}
            {o.discount > 0 && <Row label={t(M.discount)} value={`− ${fmt.money(o.discount)}`} muted />}
            {o.paid > 0 && <Row label={t(M.paidOnline)} value={fmt.money(o.paid)} strong />}
            {o.balance > 0 && <Row label={t(M.toPay)} value={fmt.money(o.balance)} strong />}
            {o.refunded > 0 && <Row label={t(M.refunded)} value={fmt.money(o.refunded)} muted />}
          </div>
        </section>

        {fresh && client && <p className="text-sm text-ink-muted">{t(M.receipt, { email: client.email, unit })}</p>}

        {o.status === "completed" && o.hasServices && (
          <div className="flex gap-2">
            {!o.reviewed ? (
              <Button asChild className="flex-1">
                <Link href={`/app/orders/${o.id}/review`}>{t(M.review)} →</Link>
              </Button>
            ) : (
              <p className="flex-1 text-sm text-ink-muted">{t(M.reviewed)}</p>
            )}
            <Button asChild variant="outline">
              <Link href={`/app/${o.unitSlug}/services`}>{t(M.again)}</Link>
            </Button>
          </div>
        )}
        {isOpen && (
          <Link href={`/app/${o.unitSlug}/chat`} className="flex items-center gap-2 text-sm underline-offset-4 hover:underline">
            <MessageCircle className="size-4" /> WhatsApp · {unit}
          </Link>
        )}
      </div>

      {o.canCancel && (
        <BottomBar>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="lg" variant="outline" className="w-full">
                {t(M.cancel)}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t(M.cancelTitle, { code: o.code })}</AlertDialogTitle>
                <AlertDialogDescription>{t(M.cancelBody, { unit })}</AlertDialogDescription>
              </AlertDialogHeader>
              <div className="flex flex-col divide-y divide-hairline rounded-sm border border-hairline px-3 text-sm">
                <Row label={t(M.paidAmount)} value={fmt.money(o.paid, { decimals: "always" })} />
                <Row label={t(M.fee)} value={fmt.money(o.cancelFee, { decimals: "always" })} />
                <Row label={t(M.youGet)} value={fmt.money(Math.max(0, o.paid - o.cancelFee), { decimals: "always" })} strong />
              </div>
              <p className="text-xs text-ink-muted">{t(M.refundTiming)}</p>
              <AlertDialogFooter>
                <AlertDialogCancel>{t(M.keep)}</AlertDialogCancel>
                <AlertDialogAction disabled={busy} onClick={() => run("order.cancel", { orderId: o.id }, { success: t(M.cancelled) })}>
                  {t(M.confirmCancel)}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          {o.start && <p className="mt-2 text-center text-xs text-ink-muted">{t(M.cancelUntil, { d: `${fmt.dayWeek(o.start)} · ${fmt.hour(o.start.slice(11))}` })}</p>}
        </BottomBar>
      )}
    </div>
  );
}
