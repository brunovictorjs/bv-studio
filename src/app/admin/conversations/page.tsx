"use client";

import { Search, Send } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { RoleGate, UnitPicker, useAdminUnit } from "@/components/admin/shell";
import { Avatar, Chip, Empty, PageHeader, Row, StatusBadge } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { useT, type Messages } from "@/i18n";
import { C } from "@/i18n/common";
import { useAction, useDb, useNow } from "@/lib/client/hooks";
import { liveState, orderTotal } from "@/lib/domain/rules";
import { matches } from "@/lib/domain/text";
import { epochMin, nowLocal } from "@/lib/domain/time";
import type { Conversation } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

const M = {
  eyebrow: ["Operação · WhatsApp", "Operations · WhatsApp"],
  title: ["Conversas da IA", "AI chats"],
  tabs: ["Filtrar conversas", "Filter chats"],
  all: ["Todas", "All"],
  forwarded: ["Esperando gente", "Waiting for a person"],
  human: ["Com a equipe", "With the team"],
  ai: ["IA respondendo", "AI replying"],
  closed: ["Finalizadas", "Finished"],
  search: ["Buscar nome, telefone ou código", "Search name, phone or code"],
  emptyFwd: ["Nenhuma conversa esperando gente. A IA está dando conta.", "No chats waiting for a person. The assistant has it covered."],
  pick: ["Escolha uma conversa.", "Pick a chat."],
  talkingWith: ["conversando com {unit}", "talking to {unit}"],
  aiOn: ["IA ligada", "AI on"],
  aiPaused: ["IA pausada aqui", "AI paused here"],
  aiOff: ["Finalizada", "Finished"],
  takeHint: ["A IA está respondendo esta conversa. Para escrever, assuma: ela pausa só aqui.", "The assistant is replying in this chat. To write, take over: it pauses only here."],
  take: ["Assumir conversa", "Take over"],
  writeTo: ["Escreva para {name}…", "Write to {name}…"],
  send: ["Enviar", "Send"],
  pausedHint: ["IA pausada nesta conversa. A mensagem sai pelo número {n}.", "Assistant paused in this chat. The message goes out from {n}."],
  finish: ["Finalizar e religar IA", "Finish and turn AI back on"],
  sentPanel: ["enviada pelo painel", "sent from the panel"],
  why: ["Por que foi encaminhada", "Why it was forwarded"],
  client: ["Cliente", "Client"],
  since: ["Cliente desde", "Client since"],
  orders: ["Pedidos", "Orders"],
  next: ["Próximo pedido", "Next order"],
  noOrder: ["Sem pedido marcado", "No upcoming order"],
  aiDoes: ["O que a IA faz sozinha", "What the assistant does on its own"],
  aiDoesBody: [
    "Responde sobre pedidos, serviços, produtos e horários desta unidade; lembra 1 dia e 2 horas antes; avisa o novo horário quando o cliente atrasa. Encaminha quando não sabe responder ou quando o cliente pede uma pessoa.",
    "Answers about orders, services, products and open times at this location; reminds 1 day and 2 hours before; tells the new time when a client is late. Forwards when it doesn't know or the client asks for a person.",
  ],
  waitFor: ["há {n} min", "{n} min"],
  assistant: ["Assistente", "Assistant"],
} satisfies Messages;

type Tab = "all" | "forwarded" | "human" | "ai" | "closed";

export default function ConversationsPage() {
  return (
    <RoleGate roles={["admin", "desk"]}>
      <Suspense>
        <Conversations />
      </Suspense>
    </RoleGate>
  );
}

function Conversations() {
  const { t, tx, fmt } = useT();
  useNow(30000);
  const db = useDb();
  const params = useSearchParams();
  const [unit] = useAdminUnit();
  const [tab, setTab] = useState<Tab>(params.get("c") ? "all" : "forwarded");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(params.get("c"));
  const [draft, setDraft] = useState("");
  const { run, busy } = useAction("staff");
  const scroller = useRef<HTMLDivElement>(null);

  const scoped = useMemo(() => db?.conversations.filter((c) => unit === "all" || c.unitId === unit) ?? [], [db, unit]);
  const counts = useMemo(() => {
    const c: Record<Tab, number> = { all: scoped.length, forwarded: 0, human: 0, ai: 0, closed: 0 };
    scoped.forEach((x) => (c[x.status as Tab] += 1));
    return c;
  }, [scoped]);
  const list = scoped
    .filter((c) => tab === "all" || c.status === tab)
    .filter((c) => matches(`${c.name} ${c.phone}`, q))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const sel: Conversation | undefined = scoped.find((c) => c.id === selected) ?? (selected ? undefined : list[0]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [sel?.id, sel?.messages.length]);

  if (!db) return null;
  const unitOf = (id: string) => db.units.find((u) => u.id === id);
  const client = sel?.clientId ? db.users.find((u) => u.id === sel.clientId) : undefined;
  const now = nowLocal();
  const nextOrder = sel?.clientId
    ? db.orders
        .filter((o) => o.clientId === sel.clientId && o.unitId === sel.unitId && o.start && ["paid", "awaiting_payment", "in_service"].includes(o.status))
        .sort((a, b) => a.start!.localeCompare(b.start!))[0]
    : undefined;
  const lastMsg = (c: Conversation) => c.messages.filter((m) => m.who !== "system").at(-1);
  const send = async () => {
    if (!sel || !draft.trim()) return;
    const r = await run("chat.send", { id: sel.id, text: draft });
    if (r) setDraft("");
  };

  return (
    <>
      <PageHeader eyebrow={t(M.eyebrow)} title={t(M.title)} actions={<UnitPicker label={t(C.unit)} />} />
      <div className="grid min-h-[640px] gap-4 xl:grid-cols-[320px_1fr_300px]" data-anim>
        <section className="flex flex-col gap-3 rounded-md border border-hairline bg-card p-3">
          <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={t(M.tabs)}>
            {(["forwarded", "human", "ai", "closed", "all"] as Tab[]).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={tab === k}
                onClick={() => setTab(k)}
                className={cn("h-8 rounded-sm px-2.5 text-xs", tab === k ? "bg-ink text-surface-0" : "text-ink-muted hover:bg-muted hover:text-ink")}
              >
                {t(M[k])} · {counts[k]}
              </button>
            ))}
          </div>
          <label className="flex h-10 items-center gap-2 rounded-sm border border-input px-3">
            <Search className="size-4 text-ink-muted" />
            <input type="search" className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder={t(M.search)} aria-label={t(M.search)} value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <ul className="flex max-h-[560px] flex-col gap-1 overflow-y-auto">
            {list.length === 0 && <li className="p-4 text-center text-sm text-ink-muted">{tab === "forwarded" ? t(M.emptyFwd) : t(C.noResults)}</li>}
            {list.map((c) => {
              const m = lastMsg(c);
              const active = sel?.id === c.id;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(c.id)}
                    aria-current={active ? "true" : undefined}
                    className={cn("flex w-full gap-3 rounded-sm p-2.5 text-left", active ? "bg-muted" : "hover:bg-muted/60")}
                  >
                    <Avatar name={c.name} inverted={c.status === "forwarded"} />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-medium">{c.name}</span>
                        <span className="shrink-0 font-mono text-[11px] text-ink-muted">{c.updatedAt.slice(11)}</span>
                      </span>
                      <span className="truncate text-xs text-ink-muted">{m ? tx(m.text) : ""}</span>
                      <span className="flex items-center gap-1.5">
                        <Chip>{tx(unitOf(c.unitId)?.name)}</Chip>
                        {c.status === "forwarded" && c.forwardedAt && (
                          <Chip active>{t(M.waitFor, { n: Math.max(0, epochMin(now) - epochMin(c.forwardedAt)) })}</Chip>
                        )}
                        {c.status === "human" && <Chip>{t(M.human)}</Chip>}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="flex min-h-[560px] flex-col overflow-hidden rounded-md border border-hairline bg-card">
          {!sel ? (
            <Empty className="m-6">{t(M.pick)}</Empty>
          ) : (
            <>
              <header className="flex items-center gap-3 border-b border-hairline p-4">
                <Avatar name={sel.name} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium">{sel.name}</span>
                  <span className="truncate text-xs text-ink-muted">
                    {sel.phone} · {t(M.talkingWith, { unit: tx(unitOf(sel.unitId)?.name) })}
                  </span>
                </div>
                <Chip active={sel.status === "ai"}>{sel.status === "ai" ? t(M.aiOn) : sel.status === "closed" ? t(M.aiOff) : t(M.aiPaused)}</Chip>
              </header>
              <div ref={scroller} className="flex flex-1 flex-col gap-3 overflow-y-auto bg-surface-0 p-4" aria-live="polite">
                {sel.messages.map((m) =>
                  m.who === "system" ? (
                    <p key={m.id} className="self-center rounded-sm border border-dashed border-hairline px-3 py-1 text-center text-xs text-ink-muted">
                      {tx(m.text)}
                    </p>
                  ) : (
                    <div key={m.id} className={cn("flex max-w-[80%] flex-col gap-1", m.who === "client" ? "self-start" : "self-end items-end")}>
                      {m.tag && <span className="bv-label">{tx(m.tag)}</span>}
                      <div
                        className={cn(
                          "whitespace-pre-line rounded-md px-3 py-2 text-sm",
                          m.who === "client" ? "border border-hairline bg-card" : m.who === "staff" ? "bg-ink text-surface-0" : "bg-surface-2",
                        )}
                      >
                        {tx(m.text)}
                      </div>
                      <span className="font-mono text-[11px] text-ink-muted">
                        {m.at.slice(11)}
                        {m.who === "ai" && ` · ${t(M.assistant)}`}
                        {m.who === "staff" && ` · ${db.users.find((u) => u.id === m.by)?.firstName ?? ""} · ${t(M.sentPanel)}`}
                      </span>
                    </div>
                  ),
                )}
              </div>
              <footer className="border-t border-hairline p-4">
                {sel.status === "human" ? (
                  <div className="flex flex-col gap-2">
                    <form
                      className="flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void send();
                      }}
                    >
                      <label className="sr-only" htmlFor="draft">
                        {t(M.send)}
                      </label>
                      <input
                        id="draft"
                        className="h-11 flex-1 rounded-sm border border-input bg-transparent px-3 outline-none focus-visible:border-ink"
                        placeholder={t(M.writeTo, { name: sel.name.split(" ")[0] })}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                      />
                      <Button type="submit" size="lg" disabled={busy || !draft.trim()}>
                        <Send /> {t(M.send)}
                      </Button>
                    </form>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-ink-muted">{t(M.pausedHint, { n: unitOf(sel.unitId)?.whatsapp ?? "" })}</span>
                      <Button variant="outline" size="sm" disabled={busy} onClick={() => run("chat.finish", { id: sel.id })}>
                        {t(M.finish)}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-sm text-ink-muted">{t(M.takeHint)}</span>
                    <Button disabled={busy} onClick={() => run("chat.takeOver", { id: sel.id })}>
                      {t(M.take)}
                    </Button>
                  </div>
                )}
              </footer>
            </>
          )}
        </section>

        <aside className="flex flex-col gap-4">
          {sel?.reason && (
            <div className="rounded-md border border-ink p-4">
              <span className="bv-label">{t(M.why)}</span>
              <p className="mt-2 font-medium">{tx(sel.reason)}</p>
              {sel.reasonDetail && <p className="mt-1 text-sm text-ink-muted">{tx(sel.reasonDetail)}</p>}
            </div>
          )}
          {sel && (
            <div className="rounded-md border border-hairline bg-card p-4 text-sm">
              <span className="bv-label">{t(M.client)}</span>
              <div className="mt-2 flex flex-col divide-y divide-hairline">
                {client && <Row label={t(M.since)} value={`${fmt.monthName(Number(client.since.slice(5, 7)), false)} ${client.since.slice(0, 4)}`} />}
                <Row label={t(M.orders)} value={db.orders.filter((o) => o.clientId && o.clientId === sel.clientId && o.status !== "cart").length} />
                <Row label={t(C.unit)} value={tx(unitOf(sel.unitId)?.name)} />
              </div>
            </div>
          )}
          {sel && (
            <div className="rounded-md border border-hairline bg-card p-4 text-sm">
              <span className="bv-label">{t(M.next)}</span>
              {nextOrder ? (
                <div className="mt-2 flex flex-col gap-1.5">
                  <span className="font-mono font-medium">{nextOrder.code}</span>
                  <span>{fmt.when(nextOrder.start!)}</span>
                  <span className="text-ink-muted">
                    {nextOrder.items.map((i) => tx(i.name)).join(" + ")} · {fmt.money(orderTotal(nextOrder))}
                  </span>
                  <StatusBadge state={liveState(nextOrder, now)} className="self-start" />
                  <Button asChild size="sm" variant="outline" className="mt-2">
                    <Link href={`/admin/orders/${nextOrder.id}`}>{t(C.viewOrder)} →</Link>
                  </Button>
                </div>
              ) : (
                <p className="mt-2 text-ink-muted">{t(M.noOrder)}</p>
              )}
            </div>
          )}
          <div className="rounded-md bg-muted p-4 text-sm">
            <span className="font-medium">{t(M.aiDoes)}</span>
            <p className="mt-1 text-ink-muted">{t(M.aiDoesBody)}</p>
          </div>
        </aside>
      </div>
    </>
  );
}
