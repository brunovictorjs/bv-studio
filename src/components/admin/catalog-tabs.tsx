"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/i18n";
import { useDb } from "@/lib/client/hooks";
import { cn } from "@/lib/utils";

export function CatalogTabs() {
  const { t } = useT();
  const db = useDb();
  const pathname = usePathname();
  const tabs = [
    { href: "/admin/services", label: t(["Serviços", "Services"]), n: db?.services.filter((s) => s.status !== "archived").length ?? 0 },
    { href: "/admin/products", label: t(["Produtos", "Products"]), n: db?.products.length ?? 0 },
  ];
  return (
    <nav className="flex gap-1 border-b border-hairline" aria-label={t(["Catálogo", "Catalog"])} data-anim>
      {tabs.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn("-mb-px border-b-2 px-4 py-2.5 text-sm", active ? "border-ink font-medium" : "border-transparent text-ink-muted hover:text-ink")}
          >
            {tab.label} · {tab.n}
          </Link>
        );
      })}
    </nav>
  );
}
