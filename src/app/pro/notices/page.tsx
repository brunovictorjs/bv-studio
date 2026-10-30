"use client";

import { Star } from "lucide-react";
import Link from "next/link";
import { BrandMark } from "@/components/brand";
import { Row, SkeletonBlock } from "@/components/kit";
import { MobileHeader } from "@/components/mobile";
import { Button } from "@/components/ui/button";
import { useT, type Messages } from "@/i18n";
import { useAction, useQ } from "@/lib/client/hooks";
import { cn } from "@/lib/utils";

const M = {
  title: ["Avisos", "Notices"],
  markRead: ["Marcar lidos", "Mark read"],
  emailPreview: ["Prévia do e-mail", "Email preview"],
  newPaid: ["Novo pedido pago", "New paid order"],
  client: ["Cliente", "Client"],
  when: ["Quando", "When"],
  services: ["Serviços", "Services"],
  code: ["Código", "Code"],
  openAgenda: ["Abrir na agenda", "Open in agenda"],
  inApp: ["No app", "In the app"],
  empty: ["Sem avisos por enquanto.", "No notices yet."],
} satisfies Messages;

export default function Notices() {
  const { t, tx, fmt } = useT();
  const { data } = useQ("proNotices", {}, "pro");
  const { run, busy } = useAction("pro");
  if (!data) return <SkeletonBlock className="m-4 h-96" />;
  const e = data.emailPreview;
  return (
    <div className="flex flex-1 flex-col">
      <MobileHeader
        title={t(M.title)}
        back="/pro"
        right={
          <Button variant="ghost" size="sm" disabled={busy || !data.list.some((n) => !n.read)} onClick={() => run("pro.readNotices", {})}>
            {t(M.markRead)}
          </Button>
        }
      />
      <div className="flex flex-col gap-5 p-4">
        {e && (
          <section className="flex flex-col gap-2" data-anim>
            <span className="bv-label">{t(M.emailPreview)}</span>
            <div className="overflow-hidden rounded-md border border-hairline">
              <div className="bv-gradient flex items-center justify-between p-4">
                <span className="font-mono text-xs text-ink-muted">BV STUDIO · {tx(data.unitName).toUpperCase()}</span>
                <BrandMark className="h-4" />
              </div>
              <div className="flex flex-col gap-2 p-4">
                <span className="text-lg font-semibold">{t(M.newPaid)}</span>
                <div className="flex flex-col divide-y divide-hairline text-sm">
                  <Row label={t(M.client)} value={e.client} />
                  <Row label={t(M.when)} value={e.start ? fmt.when(e.start) : "—"} />
                  <Row label={t(M.services)} value={e.items.map((i) => tx(i)).join(" + ")} />
                  <Row label={t(M.code)} value={<span className="font-mono">{e.code}</span>} />
                </div>
                <Button asChild size="sm" className="mt-2 self-start">
                  <Link href="/pro">{t(M.openAgenda)} →</Link>
                </Button>
              </div>
            </div>
          </section>
        )}
        <section className="flex flex-col gap-2">
          <span className="bv-label">{t(M.inApp)}</span>
          {data.list.length === 0 && <p className="text-sm text-ink-muted">{t(M.empty)}</p>}
          <ul className="flex flex-col divide-y divide-hairline rounded-md border border-hairline">
            {data.list.map((n) => (
              <li key={n.id} className={cn("flex gap-3 p-3", !n.read && "bg-muted")}>
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-ink")} aria-hidden="true" />
                <div className="flex flex-1 flex-col">
                  <span className="flex items-center gap-1.5 font-medium">
                    {n.kind === "review" && <Star className="size-3.5 fill-current" />}
                    {tx(n.title)}
                  </span>
                  <span className="text-sm text-ink-muted">{tx(n.body)}</span>
                </div>
                <span className="shrink-0 text-xs text-ink-muted">{fmt.relative(n.at)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
