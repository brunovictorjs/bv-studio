"use client";

import { Moon, RotateCcw, Sun } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { setLocale, useT, type Messages } from "@/i18n";
import { cn } from "@/lib/utils";
import { BrandMark } from "./brand";
import { resetDemo } from "./providers";

const M = {
  demo: ["demo", "demo"],
  panel: ["Painel", "Dashboard"],
  pro: ["Profissional", "Professional"],
  client: ["Cliente", "Client"],
  reset: ["Restaurar dados", "Reset data"],
  resetTitle: ["Restaurar os dados de demonstração?", "Reset the demo data?"],
  resetBody: [
    "Tudo o que você criou ou alterou neste navegador será apagado e a demo volta ao estado inicial, com datas a partir de hoje.",
    "Everything you created or changed in this browser will be erased and the demo goes back to its starting point, with dates from today.",
  ],
  resetDone: ["Dados restaurados.", "Data restored."],
  theme: ["Alternar tema", "Toggle theme"],
  lang: ["Idioma", "Language"],
  apps: ["Áreas da demo", "Demo areas"],
} satisfies Messages;

export function LocaleSwitch({ className }: { className?: string }) {
  const { locale, t } = useT();
  return (
    <div role="radiogroup" aria-label={t(M.lang)} className={cn("inline-flex rounded-sm border border-hairline p-0.5 font-mono text-xs", className)}>
      {(["pt", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          role="radio"
          aria-checked={locale === l}
          onClick={() => setLocale(l)}
          className={cn("h-7 rounded-sm px-2 uppercase", locale === l ? "bg-ink text-surface-0" : "text-ink-muted hover:text-ink")}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

export function ThemeSwitch() {
  const { t } = useT();
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const dark = !mounted || resolvedTheme === "dark";
  return (
    <Button variant="ghost" size="icon-sm" aria-label={t(M.theme)} onClick={() => setTheme(dark ? "light" : "dark")}>
      {dark ? <Sun /> : <Moon />}
    </Button>
  );
}

export function DemoBar({ className }: { className?: string }) {
  const { t } = useT();
  const pathname = usePathname();
  const links = [
    { href: "/admin", label: t(M.panel), active: pathname.startsWith("/admin") },
    { href: "/pro", label: t(M.pro), active: pathname.startsWith("/pro") },
    { href: "/app", label: t(M.client), active: pathname.startsWith("/app") },
  ];
  return (
    <div className={cn("sticky top-0 z-40 border-b border-hairline bg-surface-0/95 backdrop-blur", className)}>
      <div className="flex h-11 items-center gap-3 px-3 md:px-4">
        <Link href="/" className="flex items-center gap-2" aria-label="BV Studio">
          <BrandMark className="h-4" />
          <span className="hidden font-mono text-xs text-ink-muted sm:inline">{t(M.demo)}</span>
        </Link>
        <nav aria-label={t(M.apps)} className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={l.active ? "page" : undefined}
              className={cn(
                "whitespace-nowrap rounded-sm px-2.5 py-1 text-sm",
                l.active ? "bg-ink text-surface-0" : "text-ink-muted hover:bg-muted hover:text-ink",
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <LocaleSwitch />
        <ThemeSwitch />
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={t(M.reset)}>
              <RotateCcw />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t(M.resetTitle)}</AlertDialogTitle>
              <AlertDialogDescription>{t(M.resetBody)}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t(["Cancelar", "Cancel"])}</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  await resetDemo();
                  toast.success(t(M.resetDone));
                }}
              >
                {t(M.reset)}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
