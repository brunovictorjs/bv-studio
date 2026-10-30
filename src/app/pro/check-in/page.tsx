"use client";

import { Delete } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar } from "@/components/kit";
import { BottomBar } from "@/components/mobile";
import { Button } from "@/components/ui/button";
import { useT, type Messages } from "@/i18n";
import { useAction, useQ, useDb, usePro } from "@/lib/client/hooks";
import { CODE_DIGITS, CODE_LETTERS } from "@/lib/domain/rules";
import { nowLocal } from "@/lib/domain/time";
import { cn } from "@/lib/utils";

const M = {
  title: ["Conferir código", "Check in"],
  hint: ["Peça ao cliente o código do pedido e digite abaixo.", "Ask the client for their order code and type it below."],
  nowNumber: ["Agora um número", "Now a number"],
  nowLetter: ["Agora uma letra (sem I e O)", "Now a letter (no I or O)"],
  noMatch: ["Nenhum pedido de hoje começa com esse código.", "No order today starts with that code."],
  otherPro: ["pedido de outro profissional", "another professional's order"],
  start: ["Iniciar atendimento", "Start service"],
  timerHint: ["O cronômetro começa no momento em que você confirma.", "The timer starts the moment you confirm."],
  erase: ["Apagar", "Erase"],
  letters: ["Letras", "Letters"],
  numbers: ["Números", "Numbers"],
  started: ["Atendimento iniciado.", "Service started."],
  todayCodes: ["Códigos de hoje (só na demo)", "Today's codes (demo only)"],
} satisfies Messages;

export default function CheckInPage() {
  const { t, tx, fmt } = useT();
  const router = useRouter();
  const db = useDb();
  const me = usePro();
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<"123" | "abc" | null>(null);
  const { run, busy } = useAction("pro");
  const { data } = useQ("proCodeLookup", { code }, "pro", { enabled: code.length >= 3 });
  const auto = code.length % 2 === 0 ? "123" : "abc";
  const current = mode ?? auto;
  const matches = code.length >= 3 ? data?.matches ?? [] : [];
  const found = matches.find((m) => m.code === `BV-${code}`) ?? (matches.length === 1 ? matches[0] : undefined);
  const complete = code.length === 5 && found?.code === `BV-${code}`;
  const add = (ch: string) => {
    if (code.length < 5) {
      setCode(code + ch);
      setMode(null);
    }
  };
  const keys = current === "123" ? CODE_DIGITS.slice(1).split("").concat(["0"]) : CODE_LETTERS.split("");
  // demo helper: today's codes for this professional
  const today = nowLocal().slice(0, 10);
  const hints =
    db?.orders
      .filter((o) => o.professionalId === me?.id && o.start?.startsWith(today) && ["paid", "awaiting_payment"].includes(o.status))
      .slice(0, 4) ?? [];

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-col gap-2 p-4 pb-2">
        <span className="bv-label">{tx(db?.units.find((u) => u.id === me?.unitId)?.name)}</span>
        <h1 className="text-2xl font-semibold">{t(M.title)}</h1>
        <p className="text-sm text-ink-muted">{t(M.hint)}</p>
      </div>
      <div className="flex items-center justify-center gap-2 py-4" aria-live="polite" aria-label={`BV-${code}`}>
        <span className="font-mono text-xl text-ink-muted">BV-</span>
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={cn(
              "flex size-12 items-center justify-center rounded-sm border font-mono text-2xl",
              code[i] ? "border-ink bg-ink text-surface-0" : i === code.length ? "border-2 border-ink" : "border-hairline",
            )}
          >
            {code[i] ?? ""}
          </span>
        ))}
      </div>
      <div className="min-h-20 px-4">
        {found ? (
          <div className={cn("flex items-center gap-3 rounded-md border p-3", complete ? "border-2 border-ink" : "border-hairline")}>
            <Avatar name={found.client} />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="font-medium">{found.client}</span>
              <span className="truncate text-xs text-ink-muted">
                {found.items.map((i) => tx(i)).join(" + ")} · {found.time} · {fmt.money(found.total)}
                {!found.mine && ` · ${t(M.otherPro)}`}
              </span>
            </div>
          </div>
        ) : code.length >= 3 && data ? (
          <p className="rounded-md border border-dashed border-hairline p-3 text-center text-sm text-ink-muted">{t(M.noMatch)}</p>
        ) : (
          hints.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
              <span>{t(M.todayCodes)}:</span>
              {hints.map((o) => (
                <button key={o.id} type="button" onClick={() => setCode(o.code.slice(3))} className="rounded-sm border border-hairline px-2 py-1 font-mono hover:border-ink hover:text-ink">
                  {o.code}
                </button>
              ))}
            </div>
          )
        )}
      </div>
      <div className="flex flex-col gap-2 px-4 pb-4">
        <span className="text-center text-xs text-ink-muted">{current === "123" ? t(M.nowNumber) : t(M.nowLetter)}</span>
        <div className={cn("grid gap-1.5", current === "123" ? "grid-cols-3" : "grid-cols-6")}>
          {keys.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => add(k)}
              className={cn("rounded-sm border border-hairline font-mono text-lg hover:bg-muted active:bg-ink active:text-surface-0", current === "123" ? "h-14" : "h-11")}
            >
              {k}
            </button>
          ))}
          <button type="button" onClick={() => setMode(current === "123" ? "abc" : "123")} className="h-11 rounded-sm bg-muted font-mono text-sm" aria-label={current === "123" ? t(M.letters) : t(M.numbers)}>
            {current === "123" ? "ABC" : "123"}
          </button>
          <button type="button" onClick={() => (setCode(code.slice(0, -1)), setMode(null))} className="flex h-11 items-center justify-center rounded-sm bg-muted" aria-label={t(M.erase)}>
            <Delete className="size-5" />
          </button>
        </div>
      </div>
      <BottomBar withTabs>
        <Button
          size="lg"
          className="w-full"
          disabled={!complete || busy}
          onClick={async () => {
            const r = await run<{ orderId: string }>("pro.checkIn", { code }, { success: t(M.started) });
            if (r) router.push(`/pro/service/${r.orderId}`);
          }}
        >
          {t(M.start)}
        </Button>
        <p className="mt-2 text-center text-xs text-ink-muted">{t(M.timerHint)}</p>
      </BottomBar>
    </div>
  );
}
