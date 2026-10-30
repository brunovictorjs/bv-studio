"use client";

import { Heart } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PhotoPlaceholder } from "@/components/kit";
import { useT } from "@/i18n";
import { useAction, useClient } from "@/lib/client/hooks";
import { cn } from "@/lib/utils";

export function CatalogTabs({ slug }: { slug: string }) {
  const { t } = useT();
  const pathname = usePathname();
  const tabs = [
    { href: `/app/${slug}/services`, label: t(["Serviços", "Services"]) },
    { href: `/app/${slug}/products`, label: t(["Produtos", "Products"]) },
  ];
  return (
    <nav className="flex border-b border-hairline px-4" aria-label={t(["Catálogo", "Catalog"])}>
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={pathname === tab.href ? "page" : undefined}
          className={cn("-mb-px flex-1 border-b-2 py-3 text-center text-sm", pathname === tab.href ? "border-ink font-medium" : "border-transparent text-ink-muted")}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

export function FavoriteButton({ kind, id, className }: { kind: "services" | "products" | "professionals"; id: string; className?: string }) {
  const { t } = useT();
  const client = useClient();
  const { run, busy } = useAction("client");
  const on = !!client?.favorites[kind].includes(id);
  if (!client) return null;
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? t(["Tirar dos favoritos", "Remove from favorites"]) : t(["Favoritar", "Add to favorites"])}
      disabled={busy}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void run("client.toggleFavorite", { kind, id });
      }}
      className={cn("flex size-10 items-center justify-center rounded-sm bg-surface-0/90", className)}
    >
      <Heart className={cn("size-5", on && "fill-current")} />
    </button>
  );
}

/** Image area: placeholder hatch with a mono label (the demo has no photos). */
export function Thumb({ label, className, children }: { label: string; className?: string; children?: React.ReactNode }) {
  return (
    <PhotoPlaceholder className={cn("aspect-[4/3]", className)}>
      <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-muted">{label}</span>
      {children}
    </PhotoPlaceholder>
  );
}
