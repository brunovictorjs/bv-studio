"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field } from "@/components/kit";
import { BottomBar, MobileHeader } from "@/components/mobile";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useT, type Messages } from "@/i18n";
import { C } from "@/i18n/common";
import { useAction, useQ } from "@/lib/client/hooks";
import { matches } from "@/lib/domain/text";
import { cn } from "@/lib/utils";

const M = {
  title: ["Novo pedido avulso", "New walk-in order"],
  intro: ["Cliente chegou sem agendamento? Monte o pedido aqui e comece na hora.", "Client arrived without a booking? Build the order here and start right away."],
  name: ["Nome do cliente", "Client name"],
  search: ["Buscar serviço ou produto", "Search services or products"],
  yourServices: ["Serviços que você faz", "Services you do"],
  products: ["Produtos", "Products"],
  unavailable: ["indisponível", "unavailable"],
  services: ["Serviços", "Services"],
  chair: ["{d} de cadeira · produtos não contam no tempo", "{d} in the chair · products don't count toward time"],
  hint: ["Como foi você que criou o pedido, ele começa sem conferir código e termina sem código de conclusão.", "Since you created the order, it starts without checking a code and finishes without a completion code."],
  create: ["Criar e começar · {v}", "Create and start · {v}"],
} satisfies Messages;

export default function ProWalkin() {
  const { t, tx, fmt } = useT();
  const router = useRouter();
  const { data } = useQ("proCatalog", {}, "pro");
  const { run, busy } = useAction("pro");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Record<string, { kind: "service" | "product"; price: number; dur: number }>>({});
  const toggle = (id: string, v: { kind: "service" | "product"; price: number; dur: number }) =>
    setPicked((p) => {
      const n = { ...p };
      if (n[id]) delete n[id];
      else n[id] = v;
      return n;
    });
  const items = Object.entries(picked);
  const total = items.reduce((s, [, v]) => s + v.price, 0);
  const servicesTotal = items.filter(([, v]) => v.kind === "service").reduce((s, [, v]) => s + v.price, 0);
  const dur = items.reduce((s, [, v]) => s + v.dur, 0);
  const hasService = items.some(([, v]) => v.kind === "service");

  return (
    <div className="flex flex-1 flex-col">
      <MobileHeader title={t(M.title)} back="/pro" />
      <div className="flex flex-col gap-4 p-4">
        <p className="text-sm text-ink-muted">{t(M.intro)}</p>
        <Field label={t(M.name)}>
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <Field label={`${t(C.phone)} ${t(C.optional)}`}>
          <Input type="tel" placeholder="(81) 9 0000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <label className="flex h-10 items-center gap-2 rounded-sm border border-input px-3">
          <Search className="size-4 text-ink-muted" />
          <input className="flex-1 bg-transparent outline-none" placeholder={t(M.search)} aria-label={t(M.search)} value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        {(
          [
            [M.yourServices, data?.services.filter((s) => matches(tx(s.name), q)).map((s) => ({ id: s.id, name: tx(s.name), sub: fmt.dur(s.durationMin), price: s.price, dur: s.durationMin, kind: "service" as const, off: false }))],
            [M.products, data?.products.filter((p) => matches(tx(p.name), q)).map((p) => ({ id: p.id, name: tx(p.name), sub: tx(p.detail), price: p.price, dur: 0, kind: "product" as const, off: !p.available }))],
          ] as const
        ).map(([label, list]) => (
          <section key={label[0]} className="flex flex-col gap-2">
            <span className="bv-label">{t(label)}</span>
            <ul className="flex flex-col divide-y divide-hairline rounded-md border border-hairline">
              {list?.map((it) => (
                <li key={it.id}>
                  <label className={cn("flex min-h-12 items-center gap-3 p-3", it.off && "text-ink-muted")}>
                    <Checkbox checked={!!picked[it.id]} disabled={it.off} onCheckedChange={() => toggle(it.id, { kind: it.kind, price: it.price, dur: it.dur })} />
                    <span className="flex flex-1 flex-col">
                      <span className="font-medium">{it.name}</span>
                      <span className="text-xs text-ink-muted">
                        {it.sub}
                        {it.off && ` · ${t(M.unavailable)}`}
                      </span>
                    </span>
                    <span className="tabular text-sm">{fmt.money(it.price)}</span>
                  </label>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <div className="flex flex-col gap-1 rounded-md bg-muted p-3 text-sm">
          <div className="flex justify-between">
            <span>{t(M.services)}</span>
            <span className="tabular">{fmt.money(servicesTotal)}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>{t(C.total)}</span>
            <span className="tabular">{fmt.money(total)}</span>
          </div>
          <span className="text-xs text-ink-muted">{t(M.chair, { d: fmt.dur(dur) })}</span>
        </div>
        <p className="text-xs text-ink-muted">{t(M.hint)}</p>
      </div>
      <BottomBar withTabs>
        <Button
          size="lg"
          className="w-full"
          disabled={busy || name.trim().length < 2 || !hasService}
          onClick={async () => {
            const r = await run<{ orderId: string }>("pro.createWalkin", { clientName: name, phone, items: items.map(([refId, v]) => ({ kind: v.kind, refId })) });
            if (r) router.push(`/pro/service/${r.orderId}`);
          }}
        >
          {t(M.create, { v: fmt.money(total) })}
        </Button>
      </BottomBar>
    </div>
  );
}
