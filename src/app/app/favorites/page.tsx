"use client";

import Link from "next/link";
import { useState } from "react";
import { FavoriteButton } from "@/components/client/catalog";
import { SignInGate } from "@/components/client/shared";
import { Avatar, Empty, Segmented } from "@/components/kit";
import { MobileHeader } from "@/components/mobile";
import { Button } from "@/components/ui/button";
import { useT, type Messages } from "@/i18n";
import { useClient, useDb } from "@/lib/client/hooks";
import { productPriceAt, servicePriceAt } from "@/lib/domain/rules";

const M = {
  title: ["Favoritos", "Favorites"],
  services: ["Serviços · {n}", "Services · {n}"],
  products: ["Produtos · {n}", "Products · {n}"],
  pros: ["Profissionais · {n}", "Professionals · {n}"],
  book: ["Agendar", "Book"],
  see: ["Ver", "See"],
  empty: ["Toque no coração de um serviço, produto ou profissional para guardar aqui.", "Tap the heart on a service, product or professional to save it here."],
} satisfies Messages;

export default function FavoritesPage() {
  return (
    <SignInGate>
      <Favorites />
    </SignInGate>
  );
}

function Favorites() {
  const { t, tx, fmt } = useT();
  const db = useDb();
  const me = useClient();
  const [tab, setTab] = useState<"services" | "products" | "professionals">("services");
  if (!db || !me) return null;
  const f = me.favorites;
  const unitFor = (unitIds: string[]) => db.units.find((u) => u.id === me.preferredUnitId && unitIds.includes(u.id)) ?? db.units.find((u) => unitIds.includes(u.id));
  const rows =
    tab === "services"
      ? f.services
          .map((id) => db.services.find((s) => s.id === id))
          .filter(Boolean)
          .map((s) => {
            const unit = unitFor(s!.units.map((l) => l.unitId));
            return { id: s!.id, title: tx(s!.name), sub: `${fmt.dur(s!.durationMin)} · ${fmt.money(unit ? servicePriceAt(s!, unit.id) : s!.price)} · ${tx(unit?.name)}`, href: unit ? `/app/${unit.slug}/service/${s!.id}` : "/app", cta: t(M.book) };
          })
      : tab === "products"
        ? f.products
            .map((id) => db.products.find((p) => p.id === id))
            .filter(Boolean)
            .map((p) => {
              const unit = unitFor(p!.units.map((l) => l.unitId));
              return { id: p!.id, title: tx(p!.name), sub: `${tx(p!.detail)} · ${fmt.money(unit ? productPriceAt(p!, unit.id) : p!.price)}`, href: unit ? `/app/${unit.slug}/product/${p!.id}` : "/app", cta: t(M.see) };
            })
        : f.professionals
            .map((id) => db.users.find((u) => u.id === id))
            .filter(Boolean)
            .map((u) => {
              const unit = db.units.find((x) => x.id === u!.unitId);
              return { id: u!.id, title: `${u!.firstName} ${u!.lastName}`, sub: tx(unit?.name), href: unit ? `/app/${unit.slug}/pro/${u!.id}` : "/app", cta: t(M.see) };
            });
  return (
    <div className="flex flex-1 flex-col">
      <MobileHeader title={t(M.title)} back="/app/profile" />
      <div className="flex flex-col gap-4 p-4">
        <Segmented
          size="sm"
          label={t(M.title)}
          value={tab}
          onChange={setTab}
          options={[
            { value: "services", label: t(M.services, { n: f.services.length }) },
            { value: "products", label: t(M.products, { n: f.products.length }) },
            { value: "professionals", label: t(M.pros, { n: f.professionals.length }) },
          ]}
        />
        {rows.length === 0 ? (
          <Empty>{t(M.empty)}</Empty>
        ) : (
          <ul className="flex flex-col divide-y divide-hairline rounded-md border border-hairline">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center gap-3 p-3">
                {tab === "professionals" && <Avatar name={r.title} />}
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium">{r.title}</span>
                  <span className="truncate text-xs text-ink-muted">{r.sub}</span>
                </div>
                <FavoriteButton kind={tab} id={r.id} />
                <Button asChild size="sm" variant="outline">
                  <Link href={r.href}>{r.cta}</Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
