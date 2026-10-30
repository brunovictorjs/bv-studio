"use client";

import { ClientTopBar, useUnitSlug } from "@/components/client/shared";
import { Empty } from "@/components/kit";
import { useT } from "@/i18n";

export default function UnitLayout({ children }: { children: React.ReactNode }) {
  const unit = useUnitSlug();
  const { t } = useT();
  if (!unit) return <Empty className="m-6">{t(["Unidade não encontrada.", "Location not found."])}</Empty>;
  return (
    <>
      <ClientTopBar unit={unit} />
      {children}
    </>
  );
}
