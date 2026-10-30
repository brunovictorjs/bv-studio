"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FavoriteButton } from "@/components/client/catalog";
import { useUnitSlug } from "@/components/client/shared";
import { Avatar, SkeletonBlock, Stars } from "@/components/kit";
import { BottomBar } from "@/components/mobile";
import { Button } from "@/components/ui/button";
import { useT, type Messages } from "@/i18n";
import { useQ } from "@/lib/client/hooks";

const M = {
  since: ["No {unit} desde {y}", "At the {unit} since {y}"],
  rating: ["nota", "rating"],
  reviews: ["avaliações", "reviews"],
  served: ["atendimentos", "services"],
  does: ["Faz estes serviços", "Does these services"],
  book: ["Ver serviços de {name}", "See {name}'s services"],
} satisfies Messages;

export default function ProDetail() {
  const { id } = useParams<{ id: string }>();
  const { t, tx, fmt } = useT();
  const unit = useUnitSlug();
  const { data } = useQ("professionalDetail", { id }, "client");
  if (!unit) return null;
  if (!data) return <SkeletonBlock className="m-4 h-96" />;
  return (
    <div className="flex flex-1 flex-col">
      <section className="bv-gradient flex flex-col items-center gap-3 border-b border-hairline p-6 text-center">
        <div className="relative">
          <Avatar name={data.name} inverted className="size-24 text-xl" />
          <FavoriteButton kind="professionals" id={data.id} className="absolute -right-12 top-0 border border-hairline" />
        </div>
        <h1 className="text-2xl font-semibold">{data.name}</h1>
        <span className="text-sm text-ink-muted">{t(M.since, { unit: tx(unit.name), y: data.since.slice(0, 4) })}</span>
        <div className="grid w-full grid-cols-3 gap-px overflow-hidden rounded-md border border-hairline bg-hairline">
          {[
            [data.rating.count ? fmt.num(data.rating.avg, 1) : "—", t(M.rating)],
            [String(data.rating.count), t(M.reviews)],
            [String(data.served), t(M.served)],
          ].map(([v, l]) => (
            <div key={l} className="flex flex-col bg-surface-0 p-3">
              <span className="text-lg font-semibold">{v}</span>
              <span className="text-xs text-ink-muted">{l}</span>
            </div>
          ))}
        </div>
      </section>
      <div className="flex flex-col gap-5 p-5">
        {tx(data.about) && <p className="leading-relaxed">{tx(data.about)}</p>}
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">{t(M.does)}</h2>
          <div className="flex flex-wrap gap-2">
            {data.services.map((s) => (
              <Link key={s.id} href={`/app/${unit.slug}/service/${s.id}`} className="rounded-sm border border-hairline px-3 py-2 text-sm hover:border-ink">
                {tx(s.name)}
              </Link>
            ))}
          </div>
        </section>
        {data.reviews.map((r) => (
          <div key={r.id} className="flex flex-col gap-1 border-b border-hairline pb-3">
            <div className="flex items-center justify-between">
              <span className="font-medium">{r.clientName}</span>
              <Stars value={r.proRating ?? 5} size={12} />
            </div>
            <p className="text-sm">{tx(r.text)}</p>
            <span className="text-xs text-ink-muted">
              {tx(r.serviceName)} · {fmt.day(r.at)}
            </span>
          </div>
        ))}
      </div>
      <BottomBar withTabs>
        <Button asChild size="lg" className="w-full">
          <Link href={`/app/${unit.slug}/services`}>{t(M.book, { name: data.firstName })} →</Link>
        </Button>
      </BottomBar>
    </div>
  );
}
