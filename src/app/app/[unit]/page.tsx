"use client";

import { ArrowRight, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useUnitSlug } from "@/components/client/shared";
import { Tag } from "@/components/brand";
import { AutoCarousel } from "@/components/carousel";
import { Avatar, SkeletonBlock, Stars } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { useT, type Messages } from "@/i18n";
import { useQ } from "@/lib/client/hooks";
import { nowLocal } from "@/lib/domain/time";

const M = {
  openUntil: ["Aberta até {t}", "Open until {t}"],
  closedNow: ["Fechada agora", "Closed now"],
  agendaOpen: ["agenda aberta", "booking open"],
  blurb: ["{c} cadeiras, {p} profissionais e o próximo horário livre {when}.", "{c} chairs, {p} professionals and the next free time {when}."],
  blurbNone: ["{c} cadeiras e {p} profissionais.", "{c} chairs and {p} professionals."],
  book: ["Agendar", "Book"],
  nextFree: ["Próximo livre", "Next free"],
  rating: ["Avaliação", "Rating"],
  quick: ["Escolha rápida", "Quick pick"],
  from: ["a partir de {v}", "from {v}"],
  offers: ["Em oferta", "On offer"],
  seeAll: ["ver todos", "see all"],
  endsIn: ["termina em {n} dia(s)", "ends in {n} day(s)"],
  reviews: ["O que dizem", "What people say"],
  team: ["Quem vai te atender", "Who will serve you"],
  house: ["A casa", "The place"],
  daysHours: ["{days} · {h}", "{days} · {h}"],
  whatsapp: ["WhatsApp com a assistente · {n}", "WhatsApp with the assistant · {n}"],
  terms: ["Termos", "Terms"],
  today: ["hoje, {t}", "today, {t}"],
  on: ["{d}, {t}", "{d}, {t}"],
  with: ["com {name}", "with {name}"],
} satisfies Messages;

export default function UnitHome() {
  const { t, tx, fmt } = useT();
  const unit = useUnitSlug();
  const { data } = useQ("unitCatalog", { unitId: unit?.id }, "client", { enabled: !!unit });
  if (!unit) return null;
  if (!data) return <SkeletonBlock className="m-4 h-96" />;
  const today = nowLocal().slice(0, 10);
  const nf = data.nextFree;
  const when = nf ? (nf.date === today ? t(M.today, { t: fmt.hour(nf.time) }) : t(M.on, { d: fmt.dayWeek(nf.date), t: fmt.hour(nf.time) })) : null;
  const shownPros = data.pros.filter((p) => tx(p.about));
  const openDays = unit.hours.map((d, i) => (d.open ? i : -1)).filter((i) => i >= 0);
  const firstOpen = unit.hours.find((d) => d.open);

  return (
    <div className="flex flex-col">
      <section className="bv-gradient flex flex-col gap-5 border-b border-hairline px-5 pb-8 pt-6">
        <span className="bv-label self-start rounded-sm border border-hairline px-2 py-1" data-anim>
          ● {data.openNow && data.todayHours ? t(M.openUntil, { t: fmt.hour(data.todayHours.end) }) : t(M.closedNow)}
        </span>
        <div className="flex flex-col gap-2" data-anim>
          <Tag>{t(M.agendaOpen)}</Tag>
          <h1 className="text-4xl font-semibold leading-[1.05] tracking-[-0.02em]">{tx(unit.tagline)}</h1>
          <p className="text-ink-muted">
            {when ? t(M.blurb, { c: unit.chairs, p: data.pros.length, when }) : t(M.blurbNone, { c: unit.chairs, p: data.pros.length })}
          </p>
        </div>
        <Button asChild size="lg" className="self-start" data-anim>
          <Link href={`/app/${unit.slug}/services`}>
            {t(M.book)} <ArrowRight />
          </Link>
        </Button>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-hairline bg-hairline" data-anim>
          <div className="flex flex-col gap-0.5 bg-surface-0 p-3">
            <span className="bv-label text-[10px]">{t(M.nextFree)}</span>
            <span className="font-medium">{when ?? "—"}</span>
          </div>
          <div className="flex flex-col gap-0.5 bg-surface-0 p-3">
            <span className="bv-label text-[10px]">{t(M.rating)}</span>
            <span className="font-medium">
              {fmt.num(data.rating, 1)} ★ · {data.ratingCount}
            </span>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3 p-5">
        <h2 className="text-xl font-semibold">{t(M.quick)}</h2>
        <div className="grid grid-cols-2 gap-2">
          {data.categories.map((c) => (
            <Link key={c.id} href={`/app/${unit.slug}/services?cat=${c.id}`} data-anim className="flex flex-col gap-1 rounded-md border border-hairline p-4 hover:border-ink">
              <span className="bv-label text-ink">{tx(c.name)}</span>
              <span className="text-sm text-ink-muted">{t(M.from, { v: fmt.money(c.from) })}</span>
            </Link>
          ))}
        </div>
      </section>

      {data.offers.length > 0 && (
        <section className="flex flex-col gap-3 px-5 pb-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-semibold">{t(M.offers)}</h2>
            <Link href={`/app/${unit.slug}/services?offer=1`} className="text-sm text-ink-muted underline-offset-4 hover:underline">
              {t(M.seeAll)}
            </Link>
          </div>
          <div className="-mx-5 flex snap-x scroll-px-5 gap-3 overflow-x-auto px-5 pb-1">
            {data.offers.flatMap((o) =>
              o.serviceIds.map((sid) => {
                const s = data.services.find((x) => x.id === sid);
                if (!s?.offer) return null;
                return (
                  <Link key={`${o.id}${sid}`} href={`/app/${unit.slug}/service/${sid}`} className="flex w-64 shrink-0 snap-start flex-col gap-2 rounded-md bg-ink p-4 text-surface-0" data-anim>
                    <span className="bv-label text-surface-0/70">
                      {o.type === "percent" ? `−${o.value}%` : `− ${fmt.money(o.value)}`} · {o.weekdays.length === 7 ? t(["todos os dias", "every day"]) : o.weekdays.map((d) => fmt.weekdayName(d)).join(", ")}
                    </span>
                    <span className="text-lg font-semibold">{tx(s.name)}</span>
                    <span>
                      <span className="text-xl font-semibold">{fmt.money(s.offer.price)}</span> <span className="text-sm text-surface-0/60 line-through">{fmt.money(s.price)}</span>
                    </span>
                    <span className="text-xs text-surface-0/70">{t(M.endsIn, { n: o.daysLeft })}</span>
                  </Link>
                );
              }),
            )}
          </div>
        </section>
      )}

      {data.homeReviews.length > 0 && (
        <div className="border-t border-hairline p-5">
          <AutoCarousel label={t(M.reviews)} title={<h2 className="text-xl font-semibold">{t(M.reviews)}</h2>}>
            {data.homeReviews.map((r) => (
              <figure key={r.id} className="flex h-full w-72 flex-col gap-2 rounded-md border border-hairline p-4">
                <div className="flex items-center gap-3">
                  <Avatar name={r.clientName} />
                  <div className="flex flex-col">
                    <span className="font-medium">{r.clientName}</span>
                    <span className="text-xs text-ink-muted">
                      {tx(r.serviceName)} · {t(M.with, { name: r.proName })}
                    </span>
                  </div>
                </div>
                <Stars value={5} />
                <blockquote className="text-sm">{tx(r.text)}</blockquote>
                <figcaption className="mt-auto text-xs text-ink-muted">{fmt.day(r.at)}</figcaption>
              </figure>
            ))}
          </AutoCarousel>
        </div>
      )}

      {shownPros.length > 0 && (
        <div className="border-t border-hairline p-5">
          <AutoCarousel label={t(M.team)} title={<h2 className="text-xl font-semibold">{t(M.team)}</h2>} interval={3500}>
            {shownPros.map((p) => (
              <Link key={p.id} href={`/app/${unit.slug}/pro/${p.id}`} className="flex h-full w-32 flex-col items-center gap-2 rounded-md border border-hairline p-3 text-center hover:border-ink">
                <Avatar name={p.name} inverted className="size-14 text-sm" />
                <span className="text-sm font-medium">{p.name}</span>
                <span className="text-xs text-ink-muted">{p.rating ? `${fmt.num(p.rating, 1)} ★` : "—"}</span>
              </Link>
            ))}
          </AutoCarousel>
        </div>
      )}

      <section className="flex flex-col gap-2 border-t border-hairline p-5 text-sm">
        <h2 className="text-xl font-semibold">{t(M.house)}</h2>
        <ul className="bv-slash-list">
          <li>{unit.address}</li>
          <li>{t(M.daysHours, { days: openDays.map((d) => fmt.weekdayName(d)).join(", "), h: firstOpen ? `${fmt.hour(firstOpen.start)}–${fmt.hour(firstOpen.end)}` : "" })}</li>
          <li>
            <Link href={`/app/${unit.slug}/chat`} className="inline-flex items-center gap-1.5 underline-offset-4 hover:underline">
              <MessageCircle className="size-4" /> {t(M.whatsapp, { n: unit.whatsapp })}
            </Link>
          </li>
        </ul>
        <p className="mt-4 font-mono text-xs text-ink-muted">
          bvstudio.app/{unit.slug} ·{" "}
          <Link href="/app/terms" className="underline-offset-4 hover:underline">
            {t(M.terms)}
          </Link>
        </p>
      </section>
    </div>
  );
}
