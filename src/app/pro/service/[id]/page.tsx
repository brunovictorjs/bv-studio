"use client";

import { Check, Delete, Pause, Play, Plus } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Chip, Row, Segmented, SkeletonBlock } from "@/components/kit";
import { BottomBar, MobileHeader } from "@/components/mobile";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useT, type Messages } from "@/i18n";
import { C, METHOD } from "@/i18n/common";
import { useAction, useClock, useDb, useQ } from "@/lib/client/hooks";
import { nowLocal } from "@/lib/domain/time";
import { cn } from "@/lib/utils";

const M = {
  title: ["Em atendimento", "In service"],
  live: ["Ao vivo", "Live"],
  started: ["começou {t}", "started {t}"],
  chair: ["cadeira {n}", "chair {n}"],
  chairTime: ["Tempo de cadeira", "Chair time"],
  estimate: ["estimado {e} · faltam {r}", "estimated {e} · {r} left"],
  over: ["estimado {e} · {r} além", "estimated {e} · {r} over"],
  package: ["Pacote do cliente", "Client package"],
  doneAt: ["feito às {t}", "done at {t}"],
  inProgress: ["{d} estimados · em andamento", "{d} estimated · in progress"],
  mark: ["Marcar", "Mark"],
  unmark: ["Desmarcar", "Unmark"],
  extra: ["extra", "extra"],
  deskHands: ["a balconista entrega", "the front desk hands it over"],
  add: ["Adicionar serviço ou produto", "Add a service or product"],
  paidOnline: ["Pago online · {m}", "Paid online · {m}"],
  toDesk: ["A pagar no balcão", "To pay at the desk"],
  timerHint: ["Só os serviços entram no cronômetro e têm o botão Marcar.", "Only services count toward the timer and have the Mark button."],
  missing: ["Falta marcar: {s}.", "Still to mark: {s}."],
  pause: ["Pausar", "Pause"],
  resume: ["Retomar", "Resume"],
  finish: ["Concluir", "Finish"],
  addTitle: ["Adicionar ao pedido", "Add to the order"],
  addHint: [
    "Produtos só entram no valor. A comissão de produtos vai para você. Se o pedido já foi pago online, a diferença fica para o balcão.",
    "Products only add to the amount. Product commission goes to you. If the order was paid online, the difference goes to the front desk.",
  ],
  services: ["Serviços", "Services"],
  products: ["Produtos", "Products"],
  unavailable: ["indisponível", "unavailable"],
  inOrder: ["já no pedido · soma mais 1", "already in the order · adds 1 more"],
  addN: ["Adicionar {n} item(ns) · + {v}", "Add {n} item(s) · + {v}"],
  added: ["Itens adicionados.", "Items added."],
  codeTitle: ["Código de conclusão", "Completion code"],
  codeHint: ["Peça o código que aparece no app de {name}. Só com ele o pedido fecha.", "Ask for the code shown in {name}'s app. Only with it the order closes."],
  client: ["Cliente", "Client"],
  pkg: ["Pacote", "Package"],
  realTime: ["Tempo real", "Actual time"],
  realOf: ["{a} · estimado {b}", "{a} · estimated {b}"],
  payment: ["Pagamento", "Payment"],
  balanceDesk: ["Saldo de {v} no balcão", "{v} balance at the desk"],
  allPaid: ["Tudo pago", "Fully paid"],
  execLine: ["Execução · {p}% de {v}", "Service · {p}% of {v}"],
  prodLine: ["Produto · {p}% de {v}", "Product · {p}% of {v}"],
  yourCommission: ["Sua comissão", "Your commission"],
  conclude: ["Concluir pedido", "Complete order"],
  backToService: ["Voltar ao atendimento", "Back to the service"],
  walkinTitle: ["Concluir pedido avulso", "Complete walk-in order"],
  walkinHint: ["Pedido criado por você: não precisa de código de conclusão.", "You created this order: no completion code needed."],
  receivedNow: ["Recebi agora", "I got paid now"],
  deskReceives: ["Balcão recebe", "Desk collects"],
  payLogged: ["O pagamento fica registrado com o seu nome e entra no caixa da unidade.", "The payment is logged under your name and goes into the location's register."],
  concludeRegister: ["Concluir e registrar pagamento", "Complete and log payment"],
  concluded: ["Pedido concluído.", "Order completed."],
  demoCode: ["Na demo, o código está no app do cliente. Dica: {c}", "In the demo, the code is in the client's app. Hint: {c}"],
  notInService: ["Este pedido não está mais em atendimento.", "This order is no longer in service."],
} satisfies Messages;

const COUNTER = ["cash", "store_pix", "pos_debit", "pos_credit"] as const;

export default function ServicePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t, tx, fmt } = useT();
  const { data } = useQ("proOrder", { id }, "pro");
  const { run, busy } = useAction("pro");
  const [paused, setPaused] = useState<{ since: number; total: number }>({ since: 0, total: 0 });
  const nowMs = useClock(1000);
  const [addOpen, setAddOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  if (!data) return <SkeletonBlock className="m-4 h-96" />;
  if (data.status !== "in_service")
    return (
      <>
        <MobileHeader title={t(M.title)} back="/pro" />
        <p className="p-6 text-center text-ink-muted">{t(M.notInService)}</p>
      </>
    );

  const startedAt = data.startedAt ?? nowLocal();
  const nowSec = nowMs / 1000;
  const startSec = epochMinToLocalSec(startedAt);
  const pausedSec = paused.total + (paused.since ? nowSec - paused.since : 0);
  const elapsed = Math.max(0, Math.floor(nowSec - startSec - pausedSec));
  const mm = Math.floor(elapsed / 60);
  const est = data.durationMin;
  const services = data.items.filter((i) => i.kind === "service");
  const products = data.items.filter((i) => i.kind === "product");
  const missing = services.filter((s) => !s.doneAt);

  return (
    <div className="flex flex-1 flex-col">
      <MobileHeader title={t(M.title)} back="/pro" right={<Chip active>● {t(M.live)}</Chip>} />
      <div className="flex flex-col gap-5 p-4">
        <div className="flex flex-col gap-0.5" data-anim>
          <span className="text-2xl font-semibold">{data.client}</span>
          <span className="font-mono text-xs text-ink-muted">
            {data.code} · {t(M.started, { t: startedAt.slice(11) })}
            {data.chair && ` · ${t(M.chair, { n: data.chair })}`}
          </span>
        </div>
        <div className="flex flex-col items-center gap-1 rounded-md bg-ink p-6 text-surface-0" data-anim>
          <span className="bv-label text-surface-0/70">{t(M.chairTime)}</span>
          <span className="font-mono text-5xl tabular" aria-live="off">
            {String(Math.floor(elapsed / 60)).padStart(2, "0")}:{String(elapsed % 60).padStart(2, "0")}
          </span>
          <span className="text-sm text-surface-0/70">
            {mm <= est ? t(M.estimate, { e: fmt.dur(est), r: fmt.dur(est - mm) }) : t(M.over, { e: fmt.dur(est), r: fmt.dur(mm - est) })}
          </span>
        </div>

        <section className="flex flex-col gap-2" data-anim>
          <h2 className="text-lg font-semibold">{t(M.package)}</h2>
          <ul className="flex flex-col divide-y divide-hairline rounded-md border border-hairline">
            {services.map((s) => (
              <li key={s.id} className="flex items-center gap-3 p-3">
                <span className={cn("flex size-6 items-center justify-center rounded-sm border", s.doneAt ? "border-ink bg-ink text-surface-0" : "border-line-strong")} aria-hidden="true">
                  {s.doneAt && <Check className="size-4" />}
                </span>
                <div className="flex flex-1 flex-col">
                  <span className="font-medium">{tx(s.name)}</span>
                  <span className="text-xs text-ink-muted">{s.doneAt ? t(M.doneAt, { t: s.doneAt.slice(11) }) : t(M.inProgress, { d: fmt.dur(s.durationMin) })}</span>
                </div>
                <Button size="sm" variant={s.doneAt ? "ghost" : "outline"} disabled={busy} onClick={() => run("pro.markDone", { orderId: data.id, itemId: s.id })}>
                  {s.doneAt ? t(M.unmark) : t(M.mark)}
                </Button>
              </li>
            ))}
            {products.map((p) => (
              <li key={p.id} className="flex items-center gap-3 p-3">
                <span className="size-6" aria-hidden="true" />
                <div className="flex flex-1 flex-col">
                  <span className="font-medium">
                    {tx(p.name)} × {p.qty} {p.addedBy && <span className="text-xs text-ink-muted">· {t(M.extra)}</span>}
                  </span>
                  <span className="text-xs text-ink-muted">{t(M.deskHands)}</span>
                </div>
                <span className="tabular text-sm">{fmt.money(p.unitPrice * p.qty)}</span>
              </li>
            ))}
          </ul>
          <Button variant="outline" onClick={() => setAddOpen(true)}>
            <Plus /> {t(M.add)}
          </Button>
        </section>

        <section className="flex flex-col divide-y divide-hairline rounded-md border border-hairline px-3" data-anim>
          <Row label={t(C.total)} value={fmt.money(data.total, { decimals: "always" })} strong />
          {data.paid > 0 && <Row label={t(M.paidOnline, { m: data.method ? t(METHOD[data.method]) : "" })} value={`− ${fmt.money(data.paid, { decimals: "always" })}`} muted />}
          <Row label={t(M.toDesk)} value={fmt.money(data.balance, { decimals: "always" })} strong />
        </section>
        <p className="text-xs text-ink-muted">
          {t(M.timerHint)} {missing.length > 0 && t(M.missing, { s: missing.map((s) => tx(s.name)).join(", ") })}
        </p>
      </div>
      <BottomBar withTabs>
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <Button
            variant="outline"
            size="lg"
            onClick={() =>
              setPaused((p) => (p.since ? { since: 0, total: p.total + (nowMs / 1000 - p.since) } : { ...p, since: nowMs / 1000 }))
            }
          >
            {paused.since ? <Play /> : <Pause />} {paused.since ? t(M.resume) : t(M.pause)}
          </Button>
          <Button size="lg" onClick={() => setFinishOpen(true)}>
            {t(M.finish)}
          </Button>
        </div>
      </BottomBar>

      <AddSheet open={addOpen} onClose={() => setAddOpen(false)} orderId={data.id} existing={products.map((p) => p.refId)} />
      <FinishSheet
        open={finishOpen}
        onClose={() => setFinishOpen(false)}
        order={data}
        elapsedMin={mm}
        onDone={() => router.push("/pro")}
      />
    </div>
  );
}

/** Naive local "YYYY-MM-DDTHH:mm" → epoch seconds in the browser's timezone. */
function epochMinToLocalSec(dt: string) {
  const [d, t] = dt.split("T");
  const [y, m, day] = d.split("-").map(Number);
  const [h, min] = t.split(":").map(Number);
  return new Date(y, m - 1, day, h, min).getTime() / 1000;
}

function AddSheet({ open, onClose, orderId, existing }: { open: boolean; onClose: () => void; orderId: string; existing: string[] }) {
  const { t, tx, fmt } = useT();
  const { data } = useQ("proCatalog", {}, "pro", { enabled: open });
  const { run, busy } = useAction("pro");
  const [tab, setTab] = useState<"service" | "product">("product");
  const [picked, setPicked] = useState<{ kind: "service" | "product"; refId: string; price: number }[]>([]);
  const list = tab === "service" ? data?.services ?? [] : data?.products ?? [];
  const total = picked.reduce((s, p) => s + p.price, 0);
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="mx-auto max-h-[85dvh] max-w-[430px] overflow-y-auto rounded-t-md">
        <SheetHeader>
          <SheetTitle>{t(M.addTitle)}</SheetTitle>
          <SheetDescription>{t(M.addHint)}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-3 px-4 pb-4">
          <Segmented
            label={t(M.addTitle)}
            value={tab}
            onChange={setTab}
            options={[
              { value: "service", label: t(M.services) },
              { value: "product", label: t(M.products) },
            ]}
          />
          <ul className="flex flex-col divide-y divide-hairline rounded-md border border-hairline">
            {list.map((it) => {
              const unavailable = "available" in it && !it.available;
              const on = picked.some((p) => p.refId === it.id);
              return (
                <li key={it.id}>
                  <label className={cn("flex min-h-12 items-center gap-3 p-3", unavailable && "text-ink-muted")}>
                    <Checkbox
                      checked={on}
                      disabled={unavailable}
                      onCheckedChange={(v) => setPicked(v ? [...picked, { kind: tab, refId: it.id, price: it.price }] : picked.filter((p) => p.refId !== it.id))}
                    />
                    <span className="flex flex-1 flex-col">
                      <span className="font-medium">{tx(it.name)}</span>
                      <span className="text-xs text-ink-muted">
                        {"durationMin" in it ? fmt.dur(it.durationMin) : tx(it.detail)}
                        {unavailable && ` · ${t(M.unavailable)}`}
                        {existing.includes(it.id) && ` · ${t(M.inOrder)}`}
                      </span>
                    </span>
                    <span className="tabular text-sm">{fmt.money(it.price)}</span>
                  </label>
                </li>
              );
            })}
          </ul>
          <Button
            size="lg"
            disabled={!picked.length || busy}
            onClick={async () => {
              const r = await run("pro.addItems", { orderId, items: picked.map(({ kind, refId }) => ({ kind, refId })) }, { success: t(M.added) });
              if (r) {
                setPicked([]);
                onClose();
              }
            }}
          >
            {t(M.addN, { n: picked.length, v: fmt.money(total) })}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

type ProOrder = NonNullable<ReturnType<typeof useQ<"proOrder">>["data"]>;

function FinishSheet({ open, onClose, order, elapsedMin, onDone }: { open: boolean; onClose: () => void; order: ProOrder; elapsedMin: number; onDone: () => void }) {
  const { t, tx, fmt } = useT();
  const { run, busy } = useAction("pro");
  const db = useDb();
  const demoCode = db?.orders.find((o) => o.id === order.id)?.completionCode;
  const [digits, setDigits] = useState("");
  const [payMode, setPayMode] = useState<"now" | "desk">("now");
  const [method, setMethod] = useState<(typeof COUNTER)[number]>("cash");
  const c = order.commissionBreakdown;
  const site = order.origin === "site";
  const done = async () => {
    const r = await run(
      "pro.complete",
      { orderId: order.id, completionCode: site ? digits : undefined, payNow: !site && payMode === "now" && order.balance > 0 ? { method } : null },
      { success: t(M.concluded) },
    );
    if (r) onDone();
  };
  const summary = (
    <div className="flex flex-col divide-y divide-hairline rounded-md border border-hairline px-3 text-sm">
      <Row label={t(M.client)} value={order.client} />
      <Row label={t(M.pkg)} value={order.items.map((i) => tx(i.name)).join(" + ")} />
      <Row label={t(M.realTime)} value={t(M.realOf, { a: fmt.dur(elapsedMin), b: fmt.dur(order.durationMin) })} />
      <Row label={t(M.payment)} value={order.balance > 0 ? t(M.balanceDesk, { v: fmt.money(order.balance) }) : t(M.allPaid)} />
      <Row label={t(M.execLine, { p: c.execPct, v: fmt.money(c.execBase) })} value={fmt.money(c.exec, { decimals: "always" })} muted />
      {c.product > 0 && <Row label={t(M.prodLine, { p: c.productPct, v: fmt.money(c.productBase) })} value={fmt.money(c.product, { decimals: "always" })} muted />}
      <Row label={t(M.yourCommission)} value={fmt.money(c.total, { decimals: "always" })} strong />
    </div>
  );
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="mx-auto max-h-[92dvh] max-w-[430px] overflow-y-auto rounded-t-md">
        <SheetHeader>
          <SheetTitle className="text-xl">{site ? t(M.codeTitle) : t(M.walkinTitle)}</SheetTitle>
          <SheetDescription>{site ? t(M.codeHint, { name: order.client.split(" ")[0] }) : t(M.walkinHint)}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4 pb-6">
          {site ? (
            <>
              <div className="flex items-center justify-center gap-2" aria-label={`OK-${digits}`}>
                <span className="font-mono text-xl text-ink-muted">OK-</span>
                {[0, 1, 2, 3].map((i) => (
                  <span key={i} className={cn("flex size-12 items-center justify-center rounded-sm border font-mono text-2xl", digits[i] ? "border-ink bg-ink text-surface-0" : i === digits.length ? "border-2 border-ink" : "border-hairline")}>
                    {digits[i] ?? ""}
                  </span>
                ))}
              </div>
              {demoCode && <p className="text-center font-mono text-xs text-ink-muted">{t(M.demoCode, { c: demoCode })}</p>}
              <div className="grid grid-cols-3 gap-1.5">
                {"123456789".split("").map((d) => (
                  <button key={d} type="button" className="h-12 rounded-sm border border-hairline font-mono text-lg hover:bg-muted" onClick={() => digits.length < 4 && setDigits(digits + d)}>
                    {d}
                  </button>
                ))}
                <span />
                <button type="button" className="h-12 rounded-sm border border-hairline font-mono text-lg hover:bg-muted" onClick={() => digits.length < 4 && setDigits(digits + "0")}>
                  0
                </button>
                <button type="button" aria-label="⌫" className="flex h-12 items-center justify-center rounded-sm bg-muted" onClick={() => setDigits(digits.slice(0, -1))}>
                  <Delete className="size-5" />
                </button>
              </div>
            </>
          ) : (
            order.balance > 0 && (
              <div className="flex flex-col gap-3">
                <Segmented
                  label={t(M.payment)}
                  value={payMode}
                  onChange={setPayMode}
                  options={[
                    { value: "now", label: t(M.receivedNow) },
                    { value: "desk", label: t(M.deskReceives) },
                  ]}
                />
                {payMode === "now" && (
                  <div className="grid grid-cols-2 gap-2">
                    {COUNTER.map((m) => (
                      <button key={m} type="button" aria-pressed={method === m} onClick={() => setMethod(m)} className={cn("h-11 rounded-sm border text-sm", method === m ? "border-ink bg-ink text-surface-0" : "border-hairline")}>
                        {t(METHOD[m])}
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-xs text-ink-muted">{t(M.payLogged)}</p>
              </div>
            )
          )}
          {summary}
          <Button size="lg" disabled={busy || (site && digits.length !== 4)} onClick={done}>
            {site ? t(M.conclude) : t(M.concludeRegister)}
          </Button>
          <Button variant="link" onClick={onClose}>
            {t(M.backToService)}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

