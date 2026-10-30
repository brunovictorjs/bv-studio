"use client";

import { Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SignInGate, useUnitSlug } from "@/components/client/shared";
import { Avatar } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { useT, type Messages } from "@/i18n";
import { useAction, useQ } from "@/lib/client/hooks";
import { cn } from "@/lib/utils";

const M = {
  assistant: ["assistente virtual · {n}", "virtual assistant · {n}"],
  message: ["Mensagem", "Message"],
  send: ["Enviar", "Send"],
  try: ["Experimente perguntar", "Try asking"],
  s1: ["Meu pedido está confirmado?", "Is my order confirmed?"],
  s2: ["Tem horário amanhã?", "Any time tomorrow?"],
  s3: ["Quanto custa a hidratação?", "How much is deep conditioning?"],
  s4: ["Quero falar com uma pessoa", "I want to talk to a person"],
  waiting: ["Uma pessoa da equipe vai responder por aqui.", "Someone from the team will reply here."],
  disconnected: ["O WhatsApp desta unidade está desconectado.", "This location's WhatsApp is disconnected."],
  demo: ["Simulação do WhatsApp: as respostas vêm das regras da unidade, no servidor.", "WhatsApp simulation: replies come from the location's rules on the server."],
} satisfies Messages;

export default function ChatPage() {
  return (
    <SignInGate>
      <Chat />
    </SignInGate>
  );
}

function Chat() {
  const { t, tx } = useT();
  const unit = useUnitSlug();
  const { data } = useQ("clientConversation", { unitId: unit?.id }, "client", { enabled: !!unit });
  const { run, busy } = useAction("client");
  const [text, setText] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const msgs = data?.conversation?.messages ?? [];
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [msgs.length]);
  if (!unit || !data) return null;
  const send = async (value: string) => {
    if (!value.trim()) return;
    setText("");
    await run("chat.clientSend", { unitId: unit.id, text: value });
  };
  const waiting = data.conversation && (data.conversation.status === "forwarded" || data.conversation.status === "human");
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-3 border-b border-hairline bg-ink p-3 text-surface-0">
        <Avatar name={`BV ${tx(unit.name)}`} className="border-surface-0 text-surface-0" />
        <div className="flex flex-col">
          <span className="font-medium">BV Studio · {tx(data.unitName)}</span>
          <span className="text-xs text-surface-0/70">{t(M.assistant, { n: data.whatsapp })}</span>
        </div>
      </div>
      <div ref={scroller} className="flex max-h-[calc(100dvh-16rem)] min-h-80 flex-1 flex-col gap-2 overflow-y-auto bg-surface-1 p-4" aria-live="polite">
        <p className="self-center rounded-sm bg-surface-0 px-3 py-1 text-center text-[11px] text-ink-muted">{t(M.demo)}</p>
        {msgs.length === 0 && <div className="max-w-[85%] self-start rounded-md bg-surface-0 px-3 py-2 text-sm">{tx(data.greeting)}</div>}
        {msgs.map((m) =>
          m.who === "system" ? (
            <p key={m.id} className="self-center rounded-sm border border-dashed border-hairline px-2 py-1 text-center text-[11px] text-ink-muted">
              {tx(m.text)}
            </p>
          ) : (
            <div key={m.id} className={cn("flex max-w-[85%] flex-col gap-0.5", m.who === "client" ? "self-end items-end" : "self-start")}>
              {m.tag && <span className="bv-label text-[10px]">{tx(m.tag)}</span>}
              {m.who === "staff" && <span className="bv-label text-[10px]">{m.byName}</span>}
              <div className={cn("whitespace-pre-line rounded-md px-3 py-2 text-sm", m.who === "client" ? "bg-ink text-surface-0" : "bg-surface-0")}>{tx(m.text)}</div>
              <span className="font-mono text-[10px] text-ink-muted">{m.at.slice(11)}</span>
            </div>
          ),
        )}
        {waiting && <p className="self-center text-xs text-ink-muted">{t(M.waiting)}</p>}
      </div>
      {!waiting && (
        <div className="flex gap-1.5 overflow-x-auto border-t border-hairline p-2" aria-label={t(M.try)}>
          {[M.s1, M.s2, M.s3, M.s4].map((s) => (
            <button key={s[0]} type="button" disabled={busy} onClick={() => send(t(s))} className="h-8 shrink-0 rounded-sm border border-hairline px-3 text-xs hover:border-ink">
              {t(s)}
            </button>
          ))}
        </div>
      )}
      <form
        className="flex gap-2 border-t border-hairline p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send(text);
        }}
      >
        <label htmlFor="msg" className="sr-only">
          {t(M.message)}
        </label>
        <input
          id="msg"
          className="h-11 flex-1 rounded-sm border border-input bg-transparent px-3 outline-none focus-visible:border-ink"
          placeholder={data.connected ? t(M.message) : t(M.disconnected)}
          disabled={!data.connected}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <Button type="submit" size="icon" className="size-11" aria-label={t(M.send)} disabled={busy || !text.trim() || !data.connected}>
          <Send />
        </Button>
      </form>
    </div>
  );
}
