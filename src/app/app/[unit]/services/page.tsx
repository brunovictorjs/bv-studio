"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { CatalogTabs, FavoriteButton, Thumb } from "@/components/client/catalog";
import { useUnitSlug } from "@/components/client/shared";
import { Empty, SkeletonBlock } from "@/components/kit";
import { Stagger } from "@/components/motion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useT, type Messages } from "@/i18n";
import { useQ } from "@/lib/client/hooks";
import { matches } from "@/lib/domain/text";
import { cn } from "@/lib/utils";

const M = {
  search: ["Buscar escova, unhas, sobrancelha…", "Search blowout, nails, brows…"],
  all: ["Todos · {n}", "All · {n}"],
  count: ["{n} serviços", "{n} services"],
  sort: ["Ordenar", "Sort"],
  popular: ["Mais procurados", "Most popular"],
  cheaper: ["Menor preço", "Lowest price"],
  newest: ["Novidades", "New"],
  isNew: ["Novo", "New"],
  offerOnly: ["Em oferta", "On offer"],
  empty: ["Nenhum serviço encontrado.", "No services found."],
} satisfies Messages;

export default function ServicesPage() {
  return (
    <Suspense>
      <Services />
    </Suspense>
  );
}

function Services() {
  const { t, tx, fmt } = useT();
  const unit = useUnitSlug();
  const params = useSearchParams();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState(params.get("cat") ?? "all");
  const [offerOnly, setOfferOnly] = useState(params.get("offer") === "1");
  const [sort, setSort] = useState<"popular" | "cheaper" | "newest">("popular");
  const { data } = useQ("unitCatalog", { unitId: unit?.id }, "client", { enabled: !!unit });
  if (!unit) return null;
  const list = (data?.services ?? [])
    .filter((s) => (cat === "all" || s.categoryId === cat) && (!offerOnly || s.offer) && matches(`${tx(s.name)} ${tx(s.summary)}`, q))
    .sort((a, b) => (sort === "popular" ? b.sold - a.sold : sort === "cheaper" ? (a.offer?.price ?? a.price) - (b.offer?.price ?? b.price) : Number(b.isNew) - Number(a.isNew)));
  return (
    <div className="flex flex-col">
      <CatalogTabs slug={unit.slug} />
      <div className="flex flex-col gap-3 p-4">
        <label className="flex h-11 items-center gap-2 rounded-sm border border-input px-3">
          <Search className="size-4 text-ink-muted" />
          <input type="search" className="flex-1 bg-transparent outline-none" placeholder={t(M.search)} aria-label={t(M.search)} value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1" role="radiogroup" aria-label="Categorias">
          {[{ id: "all", label: t(M.all, { n: data?.services.length ?? 0 }) }, ...(data?.categories ?? []).map((c) => ({ id: c.id, label: tx(c.name) }))].map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={cat === c.id}
              onClick={() => setCat(c.id)}
              className={cn("h-9 shrink-0 rounded-sm border px-3 text-sm", cat === c.id ? "border-ink bg-ink text-surface-0" : "border-hairline")}
            >
              {c.label}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={offerOnly}
            onClick={() => setOfferOnly(!offerOnly)}
            className={cn("h-9 shrink-0 rounded-sm border border-dashed px-3 text-sm", offerOnly ? "border-ink bg-ink text-surface-0" : "border-line-strong")}
          >
            {t(M.offerOnly)}
          </button>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-ink-muted">{t(M.count, { n: list.length })}</span>
          <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
            <SelectTrigger className="w-44" aria-label={t(M.sort)}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="popular">{t(M.popular)}</SelectItem>
              <SelectItem value="cheaper">{t(M.cheaper)}</SelectItem>
              <SelectItem value="newest">{t(M.newest)}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {!data ? (
          <SkeletonBlock className="h-80" />
        ) : list.length === 0 ? (
          <Empty>{t(M.empty)}</Empty>
        ) : (
          <Stagger deps={[cat, offerOnly, sort, q]} className="grid grid-cols-2 gap-3">
            {list.map((s) => (
              <Link key={s.id} href={`/app/${unit.slug}/service/${s.id}`} data-anim className="flex flex-col gap-2">
                <Thumb label={tx(data.categories.find((c) => c.id === s.categoryId)?.name ?? "")}>
                  <div className="absolute left-2 top-2 flex gap-1">
                    {s.offer && (
                      <span className="rounded-sm bg-ink px-1.5 py-0.5 font-mono text-[11px] text-surface-0">
                        {s.offer.type === "percent" ? `−${s.offer.value}%` : `−${fmt.money(s.offer.value)}`}
                      </span>
                    )}
                    {s.isNew && <span className="rounded-sm border border-ink bg-surface-0 px-1.5 py-0.5 text-[11px] uppercase">{t(M.isNew)}</span>}
                  </div>
                  {s.allowFavorites && <FavoriteButton kind="services" id={s.id} className="absolute right-1 top-1" />}
                </Thumb>
                <span className="font-medium leading-tight">{tx(s.name)}</span>
                <span className="text-xs text-ink-muted">{fmt.dur(s.durationMin)}</span>
                <span className="flex items-baseline gap-1.5">
                  <span className="font-semibold">{fmt.money(s.offer?.price ?? s.price)}</span>
                  {s.offer && <span className="text-xs text-ink-muted line-through">{fmt.money(s.price)}</span>}
                </span>
                <span className="text-xs text-ink-muted">{s.ratingCount ? `★ ${fmt.num(s.rating, 1)} · ${s.ratingCount}` : "—"}</span>
              </Link>
            ))}
          </Stagger>
        )}
      </div>
    </div>
  );
}
