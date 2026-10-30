"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { CatalogTabs, FavoriteButton, Thumb } from "@/components/client/catalog";
import { useAddToCart, useUnitSlug } from "@/components/client/shared";
import { Empty, SkeletonBlock } from "@/components/kit";
import { Stagger } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { useT, type Messages } from "@/i18n";
import { useClient, useQ } from "@/lib/client/hooks";
import { useStore } from "@/lib/client/store";
import { matches } from "@/lib/domain/text";

const M = {
  search: ["Buscar sérum, óleo, máscara…", "Search serum, oil, mask…"],
  pickup: [
    "Você retira os produtos no balcão do {unit}. Se comprar junto com um serviço, a balconista entrega no dia do atendimento.",
    "You pick up products at the {unit} front desk. If you buy them with a service, the desk hands them over on the day.",
  ],
  add: ["Adicionar", "Add"],
  inCart: ["No carrinho · +1", "In cart · +1"],
  unavailable: ["Indisponível", "Unavailable"],
  added: ["Adicionado ao carrinho.", "Added to cart."],
  empty: ["Nenhum produto encontrado.", "No products found."],
} satisfies Messages;

export default function ProductsPage() {
  const { t, tx, fmt } = useT();
  const unit = useUnitSlug();
  const client = useClient();
  const [q, setQ] = useState("");
  const { data } = useQ("unitCatalog", { unitId: unit?.id }, "client", { enabled: !!unit });
  const { add, busy } = useAddToCart(unit?.id ?? "");
  const cartKey = useStore((s) => s.db?.orders.find((o) => o.clientId === s.session.clientId && o.unitId === unit?.id && o.status === "cart")?.items.map((i) => i.refId).join(",") ?? "");
  const cartIds = cartKey.split(",");
  if (!unit) return null;
  const list = (data?.products ?? []).filter((p) => matches(tx(p.name), q)).sort((a, b) => Number(b.available) - Number(a.available));
  return (
    <div className="flex flex-col">
      <CatalogTabs slug={unit.slug} />
      <div className="flex flex-col gap-3 p-4">
        <label className="flex h-11 items-center gap-2 rounded-sm border border-input px-3">
          <Search className="size-4 text-ink-muted" />
          <input type="search" className="flex-1 bg-transparent outline-none" placeholder={t(M.search)} aria-label={t(M.search)} value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <p className="rounded-md bg-muted p-3 text-sm text-ink-muted">{t(M.pickup, { unit: tx(unit.name) })}</p>
        {!data ? (
          <SkeletonBlock className="h-80" />
        ) : list.length === 0 ? (
          <Empty>{t(M.empty)}</Empty>
        ) : (
          <Stagger deps={[q]} className="grid grid-cols-2 gap-3">
            {list.map((p) => (
              <div key={p.id} data-anim className="flex flex-col gap-2">
                <Link href={`/app/${unit.slug}/product/${p.id}`} className="flex flex-col gap-2">
                  <Thumb label={tx(p.detail)} className={p.available ? "" : "opacity-60"}>
                    {p.badge && <span className="absolute left-2 top-2 rounded-sm bg-ink px-1.5 py-0.5 text-[11px] uppercase text-surface-0">{tx(p.badge)}</span>}
                    {client && <FavoriteButton kind="products" id={p.id} className="absolute right-1 top-1" />}
                  </Thumb>
                  <span className="font-medium leading-tight">{tx(p.name)}</span>
                  <span className="flex items-baseline justify-between">
                    <span className="font-semibold">{fmt.money(p.price)}</span>
                    {p.rating ? <span className="text-xs text-ink-muted">★ {fmt.num(p.rating, 1)}</span> : null}
                  </span>
                </Link>
                <Button
                  size="sm"
                  variant={cartIds.includes(p.id) ? "default" : "outline"}
                  disabled={!p.available || busy}
                  onClick={() => add("product", p.id, t(M.added))}
                >
                  {!p.available ? t(M.unavailable) : cartIds.includes(p.id) ? t(M.inCart) : t(M.add)}
                </Button>
              </div>
            ))}
          </Stagger>
        )}
      </div>
    </div>
  );
}
