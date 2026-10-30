"use client";

import { Bell, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Meter } from "@/components/charts";
import { Segmented, SkeletonBlock, Stars } from "@/components/kit";
import { ProSwitcher } from "@/components/pro/switcher";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useT, type Messages } from "@/i18n";
import { C } from "@/i18n/common";
import { useAction, useQ } from "@/lib/client/hooks";
import { store } from "@/lib/client/store";

const M = {
  title: ["Minhas avaliações", "My reviews"],
  notes: ["{n} notas", "{n} ratings"],
  all: ["Todas", "All"],
  five: ["5 estrelas", "5 stars"],
  below: ["Abaixo de 4", "Below 4"],
  withText: ["Com texto", "With text"],
  houseReply: ["Resposta da casa", "Reply from the house"],
  editProfile: ["Editar perfil público", "Edit public profile"],
  aboutTitle: ["Sobre mim", "About me"],
  aboutHint: ["É o texto que aparece no seu perfil público. Sem ele, você não aparece em \"Quem vai te atender\".", "This text shows on your public profile. Without it, you don't appear under \"Who will serve you\"."],
  saved: ["Perfil salvo.", "Profile saved."],
  notices: ["Avisos", "Notices"],
  panel: ["Painel da casa · você também é admin", "House panel · you're also an admin"],
  empty: ["Nenhuma avaliação com esse filtro.", "No reviews with this filter."],
  showing: ["{a} de {b}", "{a} of {b}"],
  more: ["Ver mais", "Show more"],
} satisfies Messages;

export default function ProProfile() {
  const { t, tx, fmt } = useT();
  const { data } = useQ("proReviews", {}, "pro");
  const { run, busy } = useAction("pro");
  const [f, setF] = useState<"all" | "five" | "below" | "text">("all");
  const [limit, setLimit] = useState(8);
  const [editing, setEditing] = useState(false);
  const [about, setAbout] = useState("");
  if (!data) return <SkeletonBlock className="m-4 h-96" />;
  const list = data.list.filter((r) =>
    f === "all" ? true : f === "five" ? r.proRating === 5 : f === "below" ? (r.proRating ?? 5) < 4 : !!tx(r.text),
  );
  const max = Math.max(1, ...data.dist.map((d) => d.count));
  return (
    <div className="flex flex-col gap-5 p-4">
      <div className="flex items-center gap-2">
        <ProSwitcher sub={t(M.title)} />
      </div>
      <section className="flex items-center gap-5 rounded-md border border-hairline bg-card p-4" data-anim>
        <div className="flex flex-col items-center gap-1">
          <span className="text-4xl font-semibold">{fmt.num(data.avg, 1)}</span>
          <Stars value={data.avg} />
          <span className="text-xs text-ink-muted">{t(M.notes, { n: data.count })}</span>
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          {data.dist.map((d) => (
            <div key={d.stars} className="flex items-center gap-2 text-xs">
              <span className="w-3 font-mono">{d.stars}</span>
              <Meter pct={(d.count / max) * 100} />
              <span className="w-6 text-right font-mono text-ink-muted">{d.count}</span>
            </div>
          ))}
        </div>
      </section>
      <Segmented
        size="sm"
        label={t(M.title)}
        value={f}
        onChange={(v) => (setF(v), setLimit(8))}
        options={[
          { value: "all", label: t(M.all) },
          { value: "five", label: t(M.five) },
          { value: "below", label: t(M.below) },
          { value: "text", label: t(M.withText) },
        ]}
      />
      <ul className="flex flex-col divide-y divide-hairline rounded-md border border-hairline">
        {list.length === 0 && <li className="p-4 text-center text-sm text-ink-muted">{t(M.empty)}</li>}
        {list.slice(0, limit).map((r) => (
          <li key={r.id} className="flex flex-col gap-1 p-3">
            <div className="flex items-center justify-between">
              <span className="font-medium">{r.clientName}</span>
              <Stars value={r.proRating ?? r.serviceRating} size={12} />
            </div>
            <span className="text-xs text-ink-muted">
              {tx(r.serviceName)} · {fmt.relative(r.at)}
            </span>
            {tx(r.text) && <p className="text-sm">{tx(r.text)}</p>}
            {r.reply && (
              <p className="border-l border-ink pl-3 text-sm text-ink-muted">
                <span className="bv-label mr-1">{t(M.houseReply)}</span>
                {tx(r.reply.text)}
              </p>
            )}
          </li>
        ))}
      </ul>
      {limit < list.length && (
        <Button variant="outline" size="sm" className="self-center" onClick={() => setLimit(limit + 8)}>
          {t(M.more)} · {t(M.showing, { a: limit, b: list.length })}
        </Button>
      )}
      <nav className="flex flex-col divide-y divide-hairline rounded-md border border-hairline">
        <button
          type="button"
          className="flex min-h-12 items-center justify-between px-4 text-left hover:bg-muted"
          onClick={() => {
            setAbout(tx(data.pro.about));
            setEditing(true);
          }}
        >
          {t(M.editProfile)} <span aria-hidden="true">›</span>
        </button>
        <Link href="/pro/notices" className="flex min-h-12 items-center justify-between px-4 hover:bg-muted">
          <span className="flex items-center gap-2">
            <Bell className="size-4" /> {t(M.notices)}
          </span>
          <span aria-hidden="true">›</span>
        </Link>
        {data.pro.isAdmin && (
          <Link href="/admin" onClick={() => store.setSession({ staffId: data.pro.id })} className="flex min-h-12 items-center justify-between px-4 hover:bg-muted">
            <span className="flex items-center gap-2">
              <LayoutDashboard className="size-4" /> {t(M.panel)}
            </span>
            <span aria-hidden="true">›</span>
          </Link>
        )}
      </nav>
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t(M.aboutTitle)}</DialogTitle>
            <DialogDescription>{t(M.aboutHint)}</DialogDescription>
          </DialogHeader>
          <Textarea rows={5} maxLength={400} value={about} onChange={(e) => setAbout(e.target.value)} aria-label={t(M.aboutTitle)} />
          <span className="text-right font-mono text-xs text-ink-muted">{about.length}/400</span>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(false)}>
              {t(C.cancel)}
            </Button>
            <Button disabled={busy} onClick={() => run("user.update", { id: data.pro.id, about }, { success: t(M.saved) }).then((r) => r && setEditing(false))}>
              {t(C.save)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
