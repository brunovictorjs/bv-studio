"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FavoriteButton, Thumb } from "@/components/client/catalog";
import { useAddToCart, useUnitSlug } from "@/components/client/shared";
import { SkeletonBlock, Stars } from "@/components/kit";
import { BottomBar } from "@/components/mobile";
import { Button } from "@/components/ui/button";
import { useT, type Messages } from "@/i18n";
import { useQ } from "@/lib/client/hooks";
import { useStore } from "@/lib/client/store";

const M = {
  reviews: ["{n} avaliações", "{n} reviews"],
  pickup: [
    "Retirada no balcão do {unit}. Compre junto com um horário ou sozinho; mostre o código do pedido na recepção.",
    "Pick up at the {unit} front desk. Buy it with a booking or on its own; show your order code at reception.",
  ],
  reviewsTitle: ["Avaliações", "Reviews"],
  reviewHint: ["Quem compra pode avaliar depois de retirar.", "Buyers can review after picking it up."],
  related: ["Da mesma categoria", "Same category"],
  price: ["Preço", "Price"],
  add: ["Adicionar ao carrinho", "Add to cart"],
  inCart: ["No carrinho ({n}) · +1", "In cart ({n}) · +1"],
  unavailable: ["Indisponível", "Unavailable"],
  added: ["Adicionado ao carrinho.", "Added to cart."],
} satisfies Messages;

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const { t, tx, fmt } = useT();
  const unit = useUnitSlug();
  const { data } = useQ("productDetail", { unitId: unit?.id, productId: id }, "client", { enabled: !!unit });
  const { add, busy } = useAddToCart(unit?.id ?? "");
  const inCart = useStore((s) => s.db?.orders.find((o) => o.clientId === s.session.clientId && o.unitId === unit?.id && o.status === "cart")?.items.find((i) => i.refId === id)?.qty ?? 0);
  if (!unit) return null;
  if (!data) return <SkeletonBlock className="m-4 h-96" />;
  const p = data.product;
  return (
    <div className="flex flex-1 flex-col">
      <Thumb label={tx(p.detail)} className="aspect-square rounded-none">
        <FavoriteButton kind="products" id={p.id} className="absolute right-3 top-3" />
      </Thumb>
      <div className="flex flex-col gap-5 p-5">
        <div className="flex flex-col gap-2" data-anim>
          <span className="bv-label">
            {tx(p.badge ?? "")}
          </span>
          <h1 className="text-3xl font-semibold tracking-[-0.02em]">{tx(p.name)}</h1>
          <span className="text-sm text-ink-muted">
            {tx(p.detail)} · ★ {data.rating.count ? fmt.num(data.rating.avg, 1) : "—"} · {t(M.reviews, { n: data.rating.count })}
          </span>
        </div>
        <p className="rounded-md bg-muted p-3 text-sm">{t(M.pickup, { unit: tx(unit.name) })}</p>
        <p className="leading-relaxed">{tx(p.description)}</p>
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">{t(M.reviewsTitle)}</h2>
          {data.reviews.map((r) => (
            <div key={r.id} className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="font-medium">{r.clientName}</span>
                <Stars value={r.productRating ?? 5} size={12} />
              </div>
              {tx(r.text) && <p className="text-sm">{tx(r.text)}</p>}
            </div>
          ))}
          <p className="text-xs text-ink-muted">{t(M.reviewHint)}</p>
        </section>
        {data.related.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">{t(M.related)}</h2>
            <div className="grid grid-cols-2 gap-3">
              {data.related.map((r) => (
                <Link key={r.id} href={`/app/${unit.slug}/product/${r.id}`} className="flex flex-col gap-1">
                  <Thumb label={tx(r.name)} />
                  <span className="text-sm font-medium">{tx(r.name)}</span>
                  <span className="text-sm">{fmt.money(r.price)}</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
      <BottomBar withTabs>
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-xs text-ink-muted">{t(M.price)}</span>
            <span className="text-xl font-semibold">{fmt.money(p.price)}</span>
          </div>
          <Button size="lg" className="flex-1" disabled={!p.available || busy} onClick={() => add("product", p.id, t(M.added))}>
            {!p.available ? t(M.unavailable) : inCart ? t(M.inCart, { n: inCart }) : t(M.add)}
          </Button>
        </div>
      </BottomBar>
    </div>
  );
}
