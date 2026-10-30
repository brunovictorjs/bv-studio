"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export interface Tab {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  match?: (pathname: string) => boolean;
  badge?: number;
}

/** Phone-width column used by the professional app and the client site. */
export function MobileShell({ children, tabs, inverted, className }: { children: React.ReactNode; tabs?: Tab[]; inverted?: boolean; className?: string }) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-[calc(100dvh-2.75rem)] justify-center bg-surface-1 md:py-6">
      <div className={cn("relative flex w-full max-w-[430px] flex-col bg-surface-0 md:min-h-[860px] md:rounded-md md:border md:border-hairline", className)}>
        <div className={cn("flex flex-1 flex-col", tabs && "pb-20")}>{children}</div>
        {tabs && (
          <nav
            aria-label="Menu"
            className={cn(
              // fixed on phones; on wider screens it sticks to the bottom of the phone-width column
              "fixed inset-x-0 bottom-0 z-30 mx-auto flex h-[68px] max-w-[430px] border-t md:sticky md:mx-0 md:w-full md:rounded-b-md",
              inverted ? "border-ink bg-ink text-surface-0" : "border-hairline bg-surface-0",
            )}
          >
            {tabs.map((t) => {
              const active = t.match ? t.match(pathname) : pathname === t.href;
              const Icon = t.icon;
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex flex-1 flex-col items-center justify-center gap-1 text-[11px]",
                    active ? "font-semibold" : inverted ? "text-surface-0/60" : "text-ink-muted",
                  )}
                >
                  <Icon className="size-5" />
                  {t.label}
                  {!!t.badge && (
                    <span className={cn("absolute right-[calc(50%-20px)] top-2 min-w-4 rounded-sm px-1 text-center font-mono text-[10px]", inverted ? "bg-surface-0 text-ink" : "bg-ink text-surface-0")}>
                      {t.badge}
                    </span>
                  )}
                  {active && <span className={cn("absolute top-0 h-0.5 w-8", inverted ? "bg-surface-0" : "bg-ink")} />}
                </Link>
              );
            })}
          </nav>
        )}
      </div>
    </div>
  );
}

export function MobileHeader({ title, back, right, sub }: { title: React.ReactNode; back?: string | true; right?: React.ReactNode; sub?: React.ReactNode }) {
  const router = useRouter();
  return (
    <header className="sticky top-11 z-20 flex min-h-14 items-center gap-2 border-b border-hairline bg-surface-0/95 px-2 backdrop-blur">
      {back &&
        (back === true ? (
          <button type="button" onClick={() => router.back()} aria-label="Voltar · Back" className="flex size-11 items-center justify-center rounded-sm hover:bg-muted">
            <ChevronLeft className="size-5" />
          </button>
        ) : (
          <Link href={back} aria-label="Voltar · Back" className="flex size-11 items-center justify-center rounded-sm hover:bg-muted">
            <ChevronLeft className="size-5" />
          </Link>
        ))}
      <div className={cn("flex min-w-0 flex-1 flex-col", !back && "pl-2")}>
        <h1 className="truncate text-base font-semibold">{title}</h1>
        {sub && <span className="truncate text-xs text-ink-muted">{sub}</span>}
      </div>
      {right}
    </header>
  );
}

/** Sticky bottom action area (above the tab bar when there is one). */
export function BottomBar({ children, withTabs }: { children: React.ReactNode; withTabs?: boolean }) {
  return (
    <div className={cn("sticky z-20 mt-auto border-t border-hairline bg-surface-0/95 p-4 backdrop-blur", withTabs ? "bottom-[68px]" : "bottom-0")}>{children}</div>
  );
}
