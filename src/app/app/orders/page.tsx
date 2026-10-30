"use client";

import Link from "next/link";
import { useState } from "react";
import { SignInGate } from "@/components/client/shared";
import { Avatar, Empty, Segmented, SkeletonBlock, StatusBadge } from "@/components/kit";
import { Stagger } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { useT, type Messages } from "@/i18n";
import { useNow, useQ } from "@/lib/client/hooks";
import { epochMin, nowLocal } from "@/lib/domain/time";

const M = {
  title: ["Meus pedidos", "My orders"],
  upcoming: ["Próximos · {n}", "Upcoming · {n}"],
  history: ["Histórico · {n}", "History · {n}"],
  with: ["com {name}", "with {name}"],
  inHours: ["em {n} h · cancelamento com reembolso disponível", "in {n} h · cancel with refund available"],
  inMin: ["em {n} min · cancelamento com reembolso disponível", "in {n} min · cancel with refund available"],
  payDesk: ["pague no balcão, depois do atendimento", "pay at the desk after the service"],
  pickup: ["retire no balcão com o código", "pick up at the desk with your code"],
  live: ["acontecendo agora", "happening now"],
  late: ["você está atrasado · veja o encaixe", "you're late · see your new slot"],
  hint: ["Seus pedidos de todas as unidades aparecem aqui.", "Your orders from every location show up here."],
  rate: ["Como foi?", "How was it?"],
  rateCta: ["Avaliar {s}", "Rate {s}"],
  empty: ["Nada por aqui ainda.", "Nothing here yet."],
  book: ["Agendar", "Book"],
} satisfies Messages;

export default function OrdersPage() {
  return (
    <SignInGate>
      <Orders />
    </SignInGate>
  );
}

function Orders() {
  const { t, tx, fmt } = useT();
  useNow(30000);
  const { data } = useQ("clientOrders", {}, "client");
  const [tab, setTab] = useState<"upcoming" | "history">("upcoming");
  if (!data) return <SkeletonBlock className="m-4 h-96" />;
  const list = tab === "upcoming" ? data.upcoming : data.history;
  const now = nowLocal();
  const sub = (o: (typeof list)[number]) => {
    if (o.state === "in_service") return t(M.live);
    if (o.state === "late") return t(M.late);
    if (o.status === "awaiting_payment") return t(M.payDesk);
    if (!o.hasServices && o.status === "paid") return t(M.pickup);
    if (o.start && o.canCancel) {
      const min = epochMin(o.start) - epochMin(now);
      return min < 120 ? t(M.inMin, { n: min }) : t(M.inHours, { n: Math.round(min / 60) });
    }
    return null;
  };
  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-3xl font-semibold">{t(M.title)}</h1>
      {data.toReview && (
        <Link href={`/app/orders/${data.toReview.id}/review`} className="flex items-center justify-between gap-3 rounded-md bg-ink p-4 text-surface-0" data-anim>
          <span className="flex flex-col">
            <span className="font-semibold">{t(M.rate)}</span>
            <span className="text-sm text-surface-0/70">{t(M.rateCta, { s: data.toReview.items.filter((i) => i.kind === "service").map((i) => tx(i.name)).join(" + ") })}</span>
          </span>
          <span aria-hidden="true">→</span>
        </Link>
      )}
      <Segmented
        label={t(M.title)}
        value={tab}
        onChange={setTab}
        options={[
          { value: "upcoming", label: t(M.upcoming, { n: data.upcoming.length }) },
          { value: "history", label: t(M.history, { n: data.history.length }) },
        ]}
      />
      {list.length === 0 ? (
        <Empty>
          <p>{t(M.empty)}</p>
          <Button asChild className="mt-3" variant="outline">
            <Link href="/app">{t(M.book)} →</Link>
          </Button>
        </Empty>
      ) : (
        <Stagger deps={[tab]} className="flex flex-col gap-3">
          {list.map((o) => (
            <Link key={o.id} href={`/app/orders/${o.id}`} data-anim className={o.state === "in_service" ? "flex flex-col gap-2 rounded-md bg-ink p-4 text-surface-0" : "flex flex-col gap-2 rounded-md border border-hairline p-4 hover:border-ink"}>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge state={o.state} className={o.state === "in_service" ? "border-surface-0 bg-surface-0 text-ink" : ""} />
                <span className="bv-label">{tx(o.unitName)}</span>
                <span className="ml-auto font-mono text-xs">{o.code}</span>
              </div>
              <span className="text-lg font-semibold">{o.items.map((i) => tx(i.name)).join(" + ")}</span>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2">
                  {o.pro && <Avatar name={o.pro.name} className="size-7 text-[10px]" />}
                  {o.start ? fmt.when(o.start) : fmt.relative(o.timeline[0]?.at ?? now)} {o.pro && `· ${t(M.with, { name: o.pro.firstName })}`}
                </span>
                <span className="font-semibold">{fmt.money(o.total)}</span>
              </div>
              {sub(o) && <span className={o.state === "in_service" ? "text-xs text-surface-0/70" : "text-xs text-ink-muted"}>{sub(o)}</span>}
            </Link>
          ))}
        </Stagger>
      )}
      <p className="text-center text-xs text-ink-muted">{t(M.hint)}</p>
    </div>
  );
}
