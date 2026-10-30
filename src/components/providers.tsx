"use client";

import { ThemeProvider } from "next-themes";
import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { fetchSeed } from "@/lib/client/api";
import { store, useStore } from "@/lib/client/store";
import { BrandMark } from "./brand";

let seeding: Promise<void> | null = null;
let seedFailed = false;

function seed() {
  seeding ??= fetchSeed()
    .then((db) => store.setDb(db))
    .catch(() => {
      seedFailed = true;
    })
    .finally(() => {
      seeding = null;
    });
  return seeding;
}

/** Throws away the browser data and generates a fresh demo relative to now. */
export async function resetDemo() {
  store.reset();
  await seed();
}

/** Loads the browser database on boot, seeding demo data on the first visit. */
function DataLoader() {
  const locale = useStore((s) => s.locale);
  useEffect(() => {
    if (!store.hydrate()) void seed();
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale === "pt" ? "pt-BR" : "en";
  }, [locale]);
  return null;
}

/** Gate for the app areas: shows a branded loader until the data is there. */
export function RequireData({ children }: { children: React.ReactNode }) {
  const ready = useStore((s) => s.ready);
  const locale = useStore((s) => s.locale);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (ready) return;
    const id = setInterval(() => setFailed(seedFailed), 1000);
    return () => clearInterval(id);
  }, [ready]);
  if (ready) return <>{children}</>;
  return (
    <div className="bv-gradient flex min-h-dvh flex-col items-center justify-center gap-6 text-ink" role="status" aria-live="polite">
      <BrandMark className="h-10 animate-pulse" />
      <p className="font-mono text-sm text-ink-muted">
        {failed
          ? locale === "pt"
            ? "Não deu para carregar a demo. Recarregue a página."
            : "Couldn't load the demo. Reload the page."
          : locale === "pt"
            ? "preparando os dados da demonstração…"
            : "preparing demo data…"}
      </p>
    </div>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
      <TooltipProvider delayDuration={200}>
        <DataLoader />
        {children}
        <Toaster position="top-center" />
      </TooltipProvider>
    </ThemeProvider>
  );
}
