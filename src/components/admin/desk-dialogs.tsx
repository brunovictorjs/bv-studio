"use client";

import { Check, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Field, Row } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useT, type Messages } from "@/i18n";
import { C, METHOD } from "@/i18n/common";
import { useAction, useDb, useQ } from "@/lib/client/hooks";
import { balanceDue, paidAmount, productPriceAt, servicePriceAt } from "@/lib/domain/rules";
import { matches, parseMoney } from "@/lib/domain/text";
import { nowLocal } from "@/lib/domain/time";
import { cn } from "@/lib/utils";

const M = {
  settle: ["Dar baixa", "Collect payment"],
  with: ["com {name}", "with {name}"],
  paidOnline: ["pago online · {m}", "paid online · {m}"],
  launchedBy: ["lançado pela profissional", "added by the professional"],
  alreadyPaid: ["Já pago", "Already paid"],
  dueNow: ["A receber agora", "Due now"],
  how: ["Como o cliente pagou", "How the client paid"],
  received: ["Valor recebido", "Amount received"],
  change: ["Troco", "Change"],
  delivered: ["{p} entregue ao cliente", "{p} handed to the client"],
  logged: ["A baixa fica registrada com o seu nome e o horário.", "The payment is logged with your name and the time."],
  confirmAmount: ["Confirmar {v}", "Confirm {v}"],
  settled: ["Baixa registrada.", "Payment recorded."],
  deliver: ["Entregar produtos", "Hand over products"],
  deliverSub: ["{client} · {type}", "{client} · {type}"],
  pickup: ["retirada no balcão", "front desk pickup"],
  extra: ["extra do atendimento", "extra from the service"],
  orderCode: ["Código do pedido", "Order code"],
  codeOk: ["O código confere com este pedido.", "The code matches this order."],
  codeHint: ["Peça o código para o cliente. A retirada conclui o pedido quando tudo for entregue.", "Ask the client for their code. A pickup order completes once everything is handed over."],
  confirmDelivery: ["Confirmar entrega", "Confirm hand-over"],
  deliveredOk: ["Entrega registrada.", "Hand-over recorded."],
  walkin: ["Novo pedido avulso", "New walk-in order"],
  walkinSub: ["Cliente chegou sem horário. O pedido entra na próxima folga da profissional.", "The client arrived without a booking. The order goes into the professional's next free gap."],
  items: ["Serviços e produtos", "Services and products"],
  searchCatalog: ["Buscar no catálogo da unidade", "Search the location's catalog"],
  freeNow: ["livre agora", "free now"],
  freeAt: ["livre às {t}", "free at {t}"],
  noGap: ["sem folga hoje", "no gap today"],
  notDoes: ["não faz {s}", "doesn't do {s}"],
  chair: ["{d} de cadeira", "{d} in the chair"],
  create: ["Criar e enviar à profissional", "Create and send to the professional"],
  created: ["Pedido {code} criado para as {t}.", "Order {code} created for {t}."],
} satisfies Messages;

const COUNTER = ["cash", "store_pix", "pos_debit", "pos_credit"] as const;

export function SettleDialog({ orderId, onClose }: { orderId: string | null; onClose: () => void }) {
  const { t, tx, fmt } = useT();
  const db = useDb();
  const { run, busy } = useAction("staff");
  const order = db?.orders.find((o) => o.id === orderId);
  const [method, setMethod] = useState<(typeof COUNTER)[number]>("cash");
  const [received, setReceived] = useState("");
  const [deliver, setDeliver] = useState(true);
  if (!order || !db) return null;
  const due = balanceDue(order);
  const paid = paidAmount(order);
  const pro = db.users.find((u) => u.id === order.professionalId);
  const receivedCents = method === "cash" ? parseMoney(received) ?? 0 : due;
  const products = order.items.filter((i) => i.kind === "product" && !i.delivered);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl">{t(M.settle)}</DialogTitle>
          <DialogDescription className="font-mono">
            {order.code} · {order.clientName} {pro && `· ${t(M.with, { name: pro.firstName })}`}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col divide-y divide-hairline rounded-sm border border-hairline px-4">
          {order.items.map((i) => (
            <Row
              key={i.id}
              label={
                <span>
                  {tx(i.name)} {i.qty > 1 && `× ${i.qty}`}
                  <span className="block text-xs text-ink-muted">
                    {i.addedBy ? t(M.launchedBy) : order.payments[0]?.channel === "online" ? t(M.paidOnline, { m: t(METHOD[order.payments[0].method]) }) : ""}
                  </span>
                </span>
              }
              value={fmt.money(i.unitPrice * i.qty, { decimals: "always" })}
            />
          ))}
          {order.discount > 0 && <Row label={t(["Desconto", "Discount"])} value={`− ${fmt.money(order.discount, { decimals: "always" })}`} muted />}
          {paid > 0 && <Row label={t(M.alreadyPaid)} value={`− ${fmt.money(paid, { decimals: "always" })}`} muted />}
          <Row label={t(M.dueNow)} value={fmt.money(due, { decimals: "always" })} strong className="text-lg" />
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">{t(M.how)}</legend>
          <div className="grid grid-cols-2 gap-2">
            {COUNTER.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={method === m}
                onClick={() => setMethod(m)}
                className={cn(
                  "h-11 rounded-sm border text-sm",
                  method === m ? "border-ink bg-ink text-surface-0" : "border-hairline hover:border-ink",
                )}
              >
                {t(METHOD[m])}
              </button>
            ))}
          </div>
        </fieldset>
        {method === "cash" && (
          <div className="grid grid-cols-2 items-end gap-3">
            <Field label={t(M.received)}>
              <Input inputMode="decimal" value={received} placeholder={fmt.money(due, { decimals: "always" })} onChange={(e) => setReceived(e.target.value)} />
            </Field>
            <Row label={t(M.change)} value={fmt.money(Math.max(0, receivedCents - due), { decimals: "always" })} strong />
          </div>
        )}
        {products.length > 0 && (
          <label className="flex items-center gap-3 text-sm">
            <Checkbox checked={deliver} onCheckedChange={(v) => setDeliver(!!v)} />
            {t(M.delivered, { p: products.map((p) => tx(p.name)).join(", ") })}
          </label>
        )}
        <p className="text-xs text-ink-muted">{t(M.logged)}</p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t(C.cancel)}
          </Button>
          <Button
            disabled={busy || due <= 0 || (method === "cash" && receivedCents < due && received !== "")}
            onClick={async () => {
              const r = await run("desk.settle", { orderId: order.id, method, received: method === "cash" ? (received ? receivedCents : due) : undefined, deliver }, { success: t(M.settled) });
              if (r) onClose();
            }}
          >
            {t(M.confirmAmount, { v: fmt.money(due, { decimals: "always" }) })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DeliverDialog({ orderId, onClose }: { orderId: string | null; onClose: () => void }) {
  const { t, tx, fmt } = useT();
  const db = useDb();
  const { run, busy } = useAction("staff");
  const [code, setCode] = useState("");
  const order = db?.orders.find((o) => o.id === orderId);
  if (!order) return null;
  const products = order.items.filter((i) => i.kind === "product" && !i.delivered);
  const typed = code.toUpperCase().replace(/\s/g, "");
  const ok = typed === order.code || `BV-${typed}` === order.code;
  const pickup = !order.items.some((i) => i.kind === "service");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl">{t(M.deliver)}</DialogTitle>
          <DialogDescription>{t(M.deliverSub, { client: order.clientName, type: t(pickup ? M.pickup : M.extra) })}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col divide-y divide-hairline rounded-sm border border-hairline px-4">
          {products.map((p) => (
            <Row key={p.id} label={<span><strong className="font-medium">{tx(p.name)}</strong> × {p.qty}</span>} value={fmt.money(p.unitPrice * p.qty)} />
          ))}
        </div>
        <Field label={t(M.orderCode)}>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="BV-0A0A0"
            autoFocus
            className={cn("h-14 font-mono text-xl tracking-[0.15em] uppercase", ok && "border-2 border-ink")}
            aria-describedby="code-ok"
          />
        </Field>
        <span id="code-ok" className="flex min-h-5 items-center gap-2 text-sm font-medium">
          {ok && (
            <>
              <Check className="size-4" /> {t(M.codeOk)}
            </>
          )}
        </span>
        <p className="text-sm text-ink-muted">{t(M.codeHint)}</p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t(C.cancel)}
          </Button>
          <Button
            disabled={!ok || busy}
            onClick={async () => {
              const r = await run("desk.deliver", { orderId: order.id, code: typed }, { success: t(M.deliveredOk) });
              if (r) onClose();
            }}
          >
            {t(M.confirmDelivery)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function WalkinDialog({ unitId, open, onClose }: { unitId: string; open: boolean; onClose: () => void }) {
  const { t, tx, fmt } = useT();
  const db = useDb();
  const { run, busy } = useAction("staff");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<{ kind: "service" | "product"; refId: string }[]>([]);
  const [proId, setProId] = useState<string | null>(null);
  const today = nowLocal().slice(0, 10);
  const { data: agenda } = useQ("agenda", { unitId, date: today }, "staff", { enabled: open });

  const catalog = useMemo(() => {
    if (!db) return [];
    const s = db.services
      .filter((x) => x.status === "active" && x.units.some((u) => u.unitId === unitId))
      .map((x) => ({ kind: "service" as const, id: x.id, name: tx(x.name), price: servicePriceAt(x, unitId), dur: x.durationMin }));
    const p = db.products
      .filter((x) => x.available && x.units.some((u) => u.unitId === unitId))
      .map((x) => ({ kind: "product" as const, id: x.id, name: tx(x.name), price: productPriceAt(x, unitId), dur: 0 }));
    return [...s, ...p].filter((x) => matches(x.name, q));
  }, [db, unitId, q, tx]);

  if (!db) return null;
  const pickedServices = picked.filter((p) => p.kind === "service").map((p) => p.refId);
  const total = picked.reduce((s, p) => s + (catalog.find((c) => c.id === p.refId)?.price ?? 0), 0);
  const dur = picked.reduce((s, p) => s + (db.services.find((x) => x.id === p.refId)?.durationMin ?? 0), 0);
  const pros = db.users.filter((u) => u.roles.includes("professional") && u.unitId === unitId && u.status === "active");
  const proState = (id: string) => {
    const doesAll = pickedServices.every((s) => db.services.find((x) => x.id === s)?.units.find((l) => l.unitId === unitId)?.professionalIds.includes(id));
    if (!doesAll) {
      const missing = pickedServices.find((s) => !db.services.find((x) => x.id === s)?.units.find((l) => l.unitId === unitId)?.professionalIds.includes(id));
      return { ok: false, label: t(M.notDoes, { s: tx(db.services.find((x) => x.id === missing)?.name) }) };
    }
    const col = agenda?.pros.find((p) => p.id === id);
    if (!col?.hours) return { ok: false, label: t(["folga", "day off"]) };
    const now = nowLocal().slice(11);
    const busyNow = col.blocks.some((b) => b.start <= now && b.end > now && b.state !== "completed" && b.state !== "no_show");
    if (!busyNow) return { ok: true, label: t(M.freeNow) };
    const nextEnd = col.blocks.filter((b) => b.end > now && b.state !== "completed").map((b) => b.end).sort()[0];
    return { ok: true, label: nextEnd ? t(M.freeAt, { t: nextEnd }) : t(M.noGap) };
  };
  const toggle = (kind: "service" | "product", id: string) =>
    setPicked((p) => (p.some((x) => x.refId === id) ? p.filter((x) => x.refId !== id) : [...p, { kind, refId: id }]));
  const close = () => {
    setName("");
    setPhone("");
    setPicked([]);
    setProId(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">{t(M.walkin)}</DialogTitle>
          <DialogDescription>{t(M.walkinSub)}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t(C.client)}>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </Field>
          <Field label={`${t(C.phone)} ${t(C.optional)}`}>
            <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(81) 9 0000-0000" />
          </Field>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">{t(M.items)}</span>
          <label className="flex h-10 items-center gap-2 rounded-sm border border-input px-3">
            <Search className="size-4 text-ink-muted" />
            <input className="flex-1 bg-transparent outline-none" placeholder={t(M.searchCatalog)} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t(C.search)} />
          </label>
          <div className="flex flex-wrap gap-2">
            {catalog.map((c) => {
              const on = picked.some((p) => p.refId === c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(c.kind, c.id)}
                  className={cn("min-h-10 rounded-sm border px-3 text-sm", on ? "border-ink bg-ink text-surface-0" : "border-hairline hover:border-ink")}
                >
                  {c.name} · {fmt.money(c.price)}
                </button>
              );
            })}
          </div>
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">{t(C.professional)}</legend>
          {pros.map((p) => {
            const st = proState(p.id);
            return (
              <button
                key={p.id}
                type="button"
                disabled={!st.ok || pickedServices.length === 0}
                aria-pressed={proId === p.id}
                onClick={() => setProId(p.id)}
                className={cn(
                  "flex min-h-11 items-center justify-between rounded-sm border px-3 text-left text-sm disabled:opacity-50",
                  proId === p.id ? "border-ink bg-ink text-surface-0" : "border-hairline hover:border-ink",
                  !st.ok && "border-dashed",
                )}
              >
                <span className="font-medium">
                  {p.firstName} {p.lastName}
                </span>
                <span className="font-mono text-xs uppercase">{st.label}</span>
              </button>
            );
          })}
        </fieldset>
        <div className="flex items-baseline justify-between border-t border-hairline pt-3">
          <span className="text-sm text-ink-muted">{t(M.chair, { d: fmt.dur(dur) })}</span>
          <span className="text-lg font-semibold">
            {t(C.total)} {fmt.money(total, { decimals: "always" })}
          </span>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            {t(C.cancel)}
          </Button>
          <Button
            disabled={busy || name.trim().length < 2 || pickedServices.length === 0 || !proId}
            onClick={async () => {
              const r = await run<{ code: string; start: string }>("desk.createWalkin", { unitId, clientName: name, phone, professionalId: proId, items: picked });
              if (r) {
                const { toast } = await import("sonner");
                toast.success(t(M.created, { code: r.code, t: r.start.slice(11) }));
                close();
              }
            }}
          >
            {t(M.create)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

