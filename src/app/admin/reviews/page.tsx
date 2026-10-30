"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { RoleGate } from "@/components/admin/shell";
import { Empty, PageHeader, Pager, Panel, Stars, Stat } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useT, type Messages } from "@/i18n";
import { C } from "@/i18n/common";
import { useAction, useDb, useQ, useStaff } from "@/lib/client/hooks";
import { matches } from "@/lib/domain/text";
import type { Review } from "@/lib/domain/types";

const M = {
  eyebrow: ["Operação", "Operations"],
  title: ["Avaliações", "Reviews"],
  search: ["Buscar no texto das avaliações", "Search review text"],
  overall: ["Nota geral", "Overall rating"],
  onHome: ["No carrossel da home", "On the home carousel"],
  onHomeHint: ["cada unidade mostra as suas", "each location shows its own"],
  low: ["Abaixo de 4 estrelas", "Below 4 stars"],
  lowHint: ["{n} nos últimos 7 dias", "{n} in the last 7 days"],
  rate: ["Taxa de resposta", "Response rate"],
  rateHint: ["{a} de {b} atendimentos avaliados", "{a} of {b} services reviewed"],
  allRatings: ["Todas as notas", "All ratings"],
  five: ["5 estrelas nas duas", "5 stars on both"],
  four: ["4 no serviço", "4 on the service"],
  below: ["Abaixo de 4", "Below 4"],
  homeAll: ["Na home e fora", "On and off home"],
  homeOnly: ["Só na home", "Home only"],
  allPros: ["Todos os profissionais", "All professionals"],
  count: ["{n} avaliações", "{n} reviews"],
  servicePro: ["Serviço · profissional", "Service · professional"],
  ratings: ["Notas", "Ratings"],
  text: ["Texto", "Text"],
  home: ["Na home", "On home"],
  service: ["serviço", "service"],
  pro: ["profissional", "professional"],
  reply: ["Responder", "Reply"],
  editReply: ["Editar resposta", "Edit reply"],
  replyTitle: ["Resposta da casa", "Reply from the house"],
  replyHint: ["A resposta aparece junto da avaliação no site da unidade.", "The reply shows with the review on the location's site."],
  saved: ["Resposta salva.", "Reply saved."],
  rule: [
    "Só entram no carrossel avaliações com as duas notas 5, texto e serviço. Cada unidade mostra apenas as próprias avaliações no seu endereço. Tirar da home não apaga a avaliação.",
    "Only reviews with both ratings at 5, a text and a service go on the carousel. Each location shows only its own reviews. Removing from home doesn't delete the review.",
  ],
  toggleHome: ["Mostrar na home", "Show on home"],
} satisfies Messages;

export default function ReviewsPage() {
  return (
    <RoleGate roles={["admin", "desk"]}>
      <Reviews />
    </RoleGate>
  );
}

function Reviews() {
  const { t, tx, fmt } = useT();
  const db = useDb();
  const me = useStaff();
  const { data: s } = useQ("reviewsSummary", {}, "staff");
  const { run, busy } = useAction("staff");
  const isAdmin = me?.roles.includes("admin");
  const [f, setF] = useState({ q: "", unit: isAdmin ? "all" : me?.unitId ?? "all", rating: "all", home: "all", pro: "all", page: 1 });
  const [replying, setReplying] = useState<Review | null>(null);
  const [reply, setReply] = useState("");
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, page: 1, ...p }));

  const list = useMemo(
    () =>
      (db?.reviews ?? []).filter((r) => {
        if (f.unit !== "all" && r.unitId !== f.unit) return false;
        if (f.pro !== "all" && r.professionalId !== f.pro) return false;
        if (f.home === "home" && !r.onHome) return false;
        if (f.rating === "five" && !(r.serviceRating === 5 && r.proRating === 5)) return false;
        if (f.rating === "four" && r.serviceRating !== 4) return false;
        if (f.rating === "below" && r.serviceRating >= 4) return false;
        return matches(`${tx(r.text)} ${r.clientName}`, f.q);
      }),
    [db, f, tx],
  );
  if (!db) return null;
  const page = list.slice((f.page - 1) * 15, f.page * 15);
  const pros = db.users.filter((u) => u.roles.includes("professional") && (f.unit === "all" || u.unitId === f.unit));
  const order = (r: Review) => db.orders.find((o) => o.id === r.orderId);

  const sel = (value: string, onChange: (v: string) => void, opts: [string, string][], label: string) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-48" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {opts.map(([v, l]) => (
          <SelectItem key={v} value={v}>
            {l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <>
      <PageHeader
        eyebrow={t(M.eyebrow)}
        title={t(M.title)}
        actions={
          <label className="flex h-10 min-w-72 items-center gap-2 rounded-sm border border-input px-3">
            <Search className="size-4 text-ink-muted" />
            <input type="search" className="flex-1 bg-transparent outline-none" placeholder={t(M.search)} aria-label={t(M.search)} value={f.q} onChange={(e) => set({ q: e.target.value })} />
          </label>
        }
      />
      {s && (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label={t(M.overall)} display={fmt.num(s.overall, 1)} hint={s.byUnit.map((u) => `${tx(u.name)} ${fmt.num(u.avg, 1)}`).join(" · ")} />
          <Stat label={t(M.onHome)} value={s.onHome} format={String} hint={t(M.onHomeHint)} />
          <Stat label={t(M.low)} value={s.low} format={String} hint={t(M.lowHint, { n: s.lowWeek })} />
          <Stat label={t(M.rate)} display={`${s.rate}%`} hint={t(M.rateHint, { a: s.count, b: s.completed })} />
        </section>
      )}
      <section className="flex flex-wrap gap-2" data-anim>
        {isAdmin &&
          sel(f.unit, (v) => set({ unit: v, pro: "all" }), [["all", t(C.allUnits)], ...db.units.map((u) => [u.id, tx(u.name)] as [string, string])], t(C.unit))}
        {sel(f.rating, (v) => set({ rating: v }), [["all", t(M.allRatings)], ["five", t(M.five)], ["four", t(M.four)], ["below", t(M.below)]], t(C.rating))}
        {sel(f.home, (v) => set({ home: v }), [["all", t(M.homeAll)], ["home", t(M.homeOnly)]], t(M.home))}
        {sel(f.pro, (v) => set({ pro: v }), [["all", t(M.allPros)], ...pros.map((p) => [p.id, `${p.firstName} ${p.lastName}`] as [string, string])], t(C.professional))}
      </section>
      <Panel title={t(M.count, { n: list.length })}>
        {list.length === 0 ? (
          <Empty>{t(C.noResults)}</Empty>
        ) : (
          <ul className="flex flex-col divide-y divide-hairline">
            {page.map((r) => {
              const o = order(r);
              const svc = db.services.find((x) => x.id === r.serviceId);
              const pro = db.users.find((u) => u.id === r.professionalId);
              const eligible = r.serviceRating === 5 && (r.proRating ?? 5) === 5 && !!tx(r.text) && !!r.serviceId;
              return (
                <li key={r.id} className="grid gap-3 py-4 md:grid-cols-[200px_200px_160px_1fr_auto] md:items-start">
                  <div className="flex flex-col">
                    <span className="font-medium">{r.clientName}</span>
                    <span className="font-mono text-xs text-ink-muted">
                      {o?.code} · {tx(db.units.find((u) => u.id === r.unitId)?.name)}
                    </span>
                    <span className="text-xs text-ink-muted">{fmt.relative(r.at)}</span>
                  </div>
                  <div className="flex flex-col text-sm">
                    <span className="font-medium">{tx(svc?.name) || "—"}</span>
                    <span className="text-ink-muted">{pro?.firstName}</span>
                  </div>
                  <div className="flex flex-col gap-1 text-xs">
                    <span className="flex items-center gap-1.5">
                      <Stars value={r.serviceRating} size={12} /> {t(M.service)}
                    </span>
                    {r.proRating != null && (
                      <span className="flex items-center gap-1.5">
                        <Stars value={r.proRating} size={12} /> {t(M.pro)}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 text-sm">
                    <p>{tx(r.text) || <span className="text-ink-muted">—</span>}</p>
                    {r.reply && (
                      <p className="border-l border-ink pl-3 text-ink-muted">
                        ↳ {tx(r.reply.text)} · {db.users.find((u) => u.id === r.reply!.by)?.firstName}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 md:flex-col md:items-end">
                    <label className="flex items-center gap-2 text-xs text-ink-muted">
                      {t(M.home)}
                      <Switch
                        checked={r.onHome}
                        disabled={busy || (!r.onHome && !eligible)}
                        aria-label={t(M.toggleHome)}
                        onCheckedChange={() => run("review.toggleHome", { id: r.id })}
                      />
                    </label>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setReplying(r);
                        setReply(r.reply ? tx(r.reply.text) : "");
                      }}
                    >
                      {r.reply ? t(M.editReply) : t(M.reply)}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <Pager page={f.page} pages={Math.ceil(list.length / 15)} total={list.length} pageSize={15} onPage={(p) => setF((x) => ({ ...x, page: p }))} />
        <p className="mt-4 text-sm text-ink-muted">{t(M.rule)}</p>
      </Panel>
      <Dialog open={!!replying} onOpenChange={(o) => !o && setReplying(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t(M.replyTitle)}</DialogTitle>
            <DialogDescription>{t(M.replyHint)}</DialogDescription>
          </DialogHeader>
          {replying && <p className="rounded-sm bg-muted p-3 text-sm">“{tx(replying.text) || "—"}” · {replying.clientName}</p>}
          <Textarea rows={4} value={reply} onChange={(e) => setReply(e.target.value)} aria-label={t(M.replyTitle)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReplying(null)}>
              {t(C.cancel)}
            </Button>
            <Button
              disabled={busy}
              onClick={async () => {
                const ok = await run("review.reply", { id: replying!.id, text: reply }, { success: t(M.saved) });
                if (ok) setReplying(null);
              }}
            >
              {t(C.save)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
