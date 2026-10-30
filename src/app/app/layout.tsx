"use client";

import { CalendarDays, Home, LayoutList, User } from "lucide-react";
import { usePathname } from "next/navigation";
import { useUnitSlug } from "@/components/client/shared";
import { DemoBar } from "@/components/demo-bar";
import { MobileShell } from "@/components/mobile";
import { PageTransition } from "@/components/motion";
import { RequireData } from "@/components/providers";
import { useT, type Messages } from "@/i18n";

const M = {
  home: ["Início", "Home"],
  services: ["Serviços", "Services"],
  agenda: ["Agenda", "Bookings"],
  profile: ["Perfil", "Profile"],
} satisfies Messages;

const NO_TABS = ["/app/sign-in", "/app/welcome"];

function Shell({ children }: { children: React.ReactNode }) {
  const { t } = useT();
  const unit = useUnitSlug();
  const pathname = usePathname();
  const slug = unit?.slug ?? "salao";
  const hideTabs = pathname === "/app" || NO_TABS.some((p) => pathname.startsWith(p)) || /\/(book|checkout|pay)/.test(pathname);
  return (
    <MobileShell
      tabs={
        hideTabs
          ? undefined
          : [
              { href: `/app/${slug}`, label: t(M.home), icon: Home, match: (p) => p === `/app/${slug}` },
              {
                href: `/app/${slug}/services`,
                label: t(M.services),
                icon: LayoutList,
                match: (p) => /\/app\/[^/]+\/(services|products|service|product|pro)/.test(p),
              },
              { href: "/app/orders", label: t(M.agenda), icon: CalendarDays, match: (p) => p.startsWith("/app/orders") },
              { href: "/app/profile", label: t(M.profile), icon: User, match: (p) => p.startsWith("/app/profile") || p.startsWith("/app/favorites") || p.startsWith("/app/terms") },
            ]
      }
    >
      <PageTransition className="flex flex-1 flex-col">{children}</PageTransition>
    </MobileShell>
  );
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireData>
      <DemoBar />
      <Shell>{children}</Shell>
    </RequireData>
  );
}
