"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { FavoriteButton, Thumb } from "@/components/client/catalog";
import { useAddToCart, useUnitSlug } from "@/components/client/shared";
import { Markdown } from "@/components/content";
import { Avatar, SkeletonBlock, Stars } from "@/components/kit";
import { BottomBar } from "@/components/mobile";
import { Button } from "@/components/ui/button";
import { useT, type Messages } from "@/i18n";
import { useQ } from "@/lib/client/hooks";
import { useStore } from "@/lib/client/store";

const M = {
  estimated: ["{d} estimadas", "{d} estimated"],
  reviews: ["{n} avaliações", "{n} reviews"],
  offerValid: ["{name} · vale para atendimentos de {days} até {end}.", "{name} · valid for services on {days} until {end}."],
  who: ["Quem faz", "Who does it"],
  svcReviews: ["Avaliações do serviço", "Service reviews"],
  with: ["com {name}", "with {name}"],
  total: ["Total", "Total"],
  pickTime: ["Escolher horário", "Pick a time"],
  photos: ["+{n} fotos", "+{n} photos"],
  noReviews: ["Ainda sem avaliações.", "No reviews yet."],
} satisfies Messages;

export default function ServiceDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t, tx, fmt } = useT();
  const unit = useUnitSlug();
  const { data, error } = useQ("serviceDetail", { unitId: unit?.id, serviceId: id }, "client", { enabled: !!unit });
  const { add, busy } = useAddToCart(unit?.id ?? "");
  const inCart = useStore((st) => !!st.db?.orders.find((o) => o.clientId === st.session.clientId && o.unitId === unit?.id && ["cart", "awaiting_payment"].includes(o.status) && o.payments.length === 0 && o.chosenMethod !== "cash" && o.items.some((i) => i.refId === id)));
  if (!unit) return null;
  if (error) return <p className="p-6 text-ink-muted">{t(["Serviço indisponível nesta unidade.", "Service unavailable at this location."])}</p>;
  if (!data) return <SkeletonBlock className="m-4 h-96" />;
  const s = data.card;
  return (
    <div className="flex flex-1 flex-col">
      <Thumb label={tx(s.name)} className="aspect-[16/11] rounded-none">
        {s.allowFavorites && <FavoriteButton kind="services" id={s.id} className="absolute right-3 top-3" />}
        {s.media > 1 && <span className="absolute bottom-3 right-3 rounded-sm bg-surface-0 px-2 py-1 font-mono text-xs">{t(M.photos, { n: s.media - 1 })}</span>}
      </Thumb>
      <div className="flex flex-col gap-5 p-5">
        <div className="flex flex-col gap-2" data-anim>
          {s.offer && (
            <span className="bv-label self-start rounded-sm bg-ink px-2 py-1 text-surface-0">
              {s.offer.type === "percent" ? `−${s.offer.value}%` : `− ${fmt.money(s.offer.value)}`} · {s.offer.weekdays.map((d) => fmt.weekdayName(d)).join(", ")}
            </span>
          )}
          <h1 className="text-3xl font-semibold tracking-[-0.02em]">{tx(s.name)}</h1>
          <span className="text-sm text-ink-muted">
            {t(M.estimated, { d: fmt.dur(s.durationMin) })} · ★ {s.ratingCount ? fmt.num(s.rating, 1) : "—"} · {t(M.reviews, { n: s.ratingCount })}
          </span>
          {s.offer && (
            <p className="rounded-md border border-dashed border-ink p-3 text-sm">
              {t(M.offerValid, { name: tx(s.offer.name), days: s.offer.weekdays.map((d) => fmt.weekdayName(d)).join(", "), end: fmt.numeric(s.offer.end) })}
            </p>
          )}
        </div>
        <Markdown source={tx(data.description)} className="text-sm" />
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{t(M.who)}</h2>
          <div className="flex flex-wrap gap-2">
            {data.pros.map((p) => (
              <Link key={p.id} href={`/app/${unit.slug}/pro/${p.id}`} className="flex items-center gap-2 rounded-md border border-hairline p-2 pr-4 hover:border-ink">
                <Avatar name={p.name} inverted />
                <span className="flex flex-col">
                  <span className="text-sm font-medium">{p.name.split(" ")[0]}</span>
                  <span className="text-xs text-ink-muted">★ {p.rating ? fmt.num(p.rating, 1) : "—"}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{t(M.svcReviews)}</h2>
          {data.reviews.length === 0 && <p className="text-sm text-ink-muted">{t(M.noReviews)}</p>}
          {data.reviews.map((r) => (
            <div key={r.id} className="flex flex-col gap-1 border-b border-hairline pb-3 last:border-b-0">
              <div className="flex items-center justify-between">
                <span className="font-medium">{r.clientName}</span>
                <Stars value={r.serviceRating} size={12} />
              </div>
              {tx(r.text) && <p className="text-sm">{tx(r.text)}</p>}
              <span className="text-xs text-ink-muted">
                {t(M.with, { name: r.proName })} · {fmt.day(r.at)}
              </span>
            </div>
          ))}
        </section>
      </div>
      <BottomBar withTabs>
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-xs text-ink-muted">{t(M.total)}</span>
            <span className="flex items-baseline gap-1.5">
              <span className="text-xl font-semibold">{fmt.money(s.offer?.price ?? s.price)}</span>
              {s.offer && <span className="text-sm text-ink-muted line-through">{fmt.money(s.price)}</span>}
            </span>
          </div>
          <Button
            size="lg"
            className="flex-1"
            disabled={busy}
            onClick={async () => {
              if (inCart) return router.push(`/app/${unit.slug}/book`);
              const r = await add("service", s.id);
              if (r) router.push(`/app/${unit.slug}/book`);
            }}
          >
            {t(M.pickTime)} →
          </Button>
        </div>
      </BottomBar>
    </div>
  );
}
