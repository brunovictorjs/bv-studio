"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Markdown } from "@/components/content";
import { MobileHeader } from "@/components/mobile";
import { useT } from "@/i18n";
import { useDb } from "@/lib/client/hooks";

export default function TermsPage() {
  return (
    <Suspense>
      <Terms />
    </Suspense>
  );
}

function Terms() {
  const { t, tx, fmt } = useT();
  const db = useDb();
  const params = useSearchParams();
  const doc = params.get("doc") === "privacy" ? "privacy" : "terms";
  if (!db) return null;
  const p = db.settings.policies[doc];
  return (
    <div className="flex flex-1 flex-col">
      <MobileHeader title={doc === "terms" ? t(["Termos de serviço", "Terms of service"]) : t(["Política de privacidade", "Privacy policy"])} back={true} />
      <div className="flex flex-col gap-4 p-5">
        <span className="font-mono text-xs text-ink-muted">
          {t(["Versão {v} · publicada em {d}", "Version {v} · published {d}"], { v: p.version, d: `${fmt.numeric(p.publishedAt)}/${p.publishedAt.slice(0, 4)}` })}
        </span>
        <Markdown source={tx(p.published)} />
      </div>
    </div>
  );
}
