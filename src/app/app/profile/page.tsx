"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { SignInGate } from "@/components/client/shared";
import { Avatar, SkeletonBlock } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { useT, type Messages } from "@/i18n";
import { useDb, useQ } from "@/lib/client/hooks";
import { store } from "@/lib/client/store";

const M = {
  edit: ["Editar", "Edit"],
  served: ["atendimentos", "services"],
  favorites: ["favoritos", "favorites"],
  reviews: ["avaliações", "reviews"],
  orders: ["Meus pedidos", "My orders"],
  favs: ["Favoritos", "Favorites"],
  unit: ["Unidade preferida", "Preferred location"],
  about: ["Sobre você", "About you"],
  terms: ["Termos de serviço", "Terms of service"],
  privacy: ["Política de privacidade", "Privacy policy"],
  chat: ["Falar com a assistente", "Talk to the assistant"],
  signOut: ["Sair da conta", "Sign out"],
  version: ["BV Studio · versão 1.0.0 · desenvolvido por Bruno Victor", "BV Studio · version 1.0.0 · built by Bruno Victor"],
} satisfies Messages;

export default function ProfilePage() {
  return (
    <SignInGate>
      <Profile />
    </SignInGate>
  );
}

function Profile() {
  const { t, tx } = useT();
  const router = useRouter();
  const db = useDb();
  const { data } = useQ("clientProfile", {}, "client");
  if (!data || !db) return <SkeletonBlock className="m-4 h-96" />;
  const u = data.user;
  const unit = db.units.find((x) => x.id === u.preferredUnitId) ?? db.units[0];
  const links: [string, string, string?][] = [
    ["/app/orders", t(M.orders)],
    ["/app/favorites", t(M.favs)],
    ["/app", t(M.unit), tx(unit.name)],
    ["/app/profile/edit", t(M.about)],
    [`/app/${unit.slug}/chat`, t(M.chat)],
    ["/app/terms", t(M.terms)],
    ["/app/terms?doc=privacy", t(M.privacy)],
  ];
  return (
    <div className="flex flex-col gap-5 p-4">
      <div className="flex items-center gap-4" data-anim>
        <Avatar name={`${u.firstName} ${u.lastName}`} inverted className="size-16 text-lg" />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-xl font-semibold">
            {u.firstName} {u.lastName}
          </span>
          <span className="truncate text-sm text-ink-muted">{u.email}</span>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/app/profile/edit">{t(M.edit)}</Link>
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-md border border-hairline bg-hairline" data-anim>
        {[
          [data.orders, t(M.served)],
          [data.favorites, t(M.favorites)],
          [data.reviews, t(M.reviews)],
        ].map(([n, l]) => (
          <div key={String(l)} className="flex flex-col bg-surface-0 p-3">
            <span className="text-2xl font-semibold">{n}</span>
            <span className="text-xs text-ink-muted">{l}</span>
          </div>
        ))}
      </div>
      <nav className="flex flex-col divide-y divide-hairline rounded-md border border-hairline" data-anim>
        {links.map(([href, label, value]) => (
          <Link key={href + label} href={href} className="flex min-h-12 items-center justify-between gap-3 px-4 hover:bg-muted">
            <span>{label}</span>
            <span className="flex items-center gap-2 text-sm text-ink-muted">
              {value} <span aria-hidden="true">›</span>
            </span>
          </Link>
        ))}
      </nav>
      <Button
        variant="outline"
        onClick={() => {
          store.setSession({ clientId: null });
          router.push("/app/sign-in");
        }}
      >
        {t(M.signOut)}
      </Button>
      <p className="text-center font-mono text-xs text-ink-muted">{t(M.version)}</p>
    </div>
  );
}
