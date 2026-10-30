"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PageHeader } from "@/components/kit";
import { useT, type Messages } from "@/i18n";
import { useStaff } from "@/lib/client/hooks";
import { cn } from "@/lib/utils";

export const SETTINGS_M = {
  eyebrow: ["Negócio", "Business"],
  title: ["Configurações do negócio", "Business settings"],
  teamTitle: ["Horário e equipe", "Hours and team"],
  company: ["Dados da empresa", "Company details"],
  team: ["Agenda da equipe", "Team schedule"],
  payment: ["Pagamento e Stripe", "Payment and Stripe"],
  commissions: ["Comissões", "Commissions"],
  notifications: ["Notificações", "Notifications"],
  policies: ["Políticas", "Policies"],
} satisfies Messages;

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { t } = useT();
  const me = useStaff();
  const pathname = usePathname();
  const isAdmin = !!me?.roles.includes("admin");
  const tabs = (["company", "team", "payment", "commissions", "notifications", "policies"] as const).filter((k) => isAdmin || k === "team");
  return (
    <>
      <PageHeader eyebrow={t(SETTINGS_M.eyebrow)} title={t(isAdmin ? SETTINGS_M.title : SETTINGS_M.teamTitle)} />
      <nav className="flex gap-1 overflow-x-auto border-b border-hairline" aria-label={t(SETTINGS_M.title)} data-anim>
        {tabs.map((k) => {
          const href = `/admin/settings/${k}`;
          const active = pathname === href;
          return (
            <Link
              key={k}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn("-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm", active ? "border-ink font-medium" : "border-transparent text-ink-muted hover:text-ink")}
            >
              {t(SETTINGS_M[k])}
            </Link>
          );
        })}
      </nav>
      {children}
    </>
  );
}
