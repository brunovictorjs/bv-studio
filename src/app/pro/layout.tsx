"use client";

import { CalendarDays, CircleUser, QrCode, TrendingUp } from "lucide-react";
import { DemoBar } from "@/components/demo-bar";
import { MobileShell } from "@/components/mobile";
import { PageTransition } from "@/components/motion";
import { RequireData } from "@/components/providers";
import { useT, type Messages } from "@/i18n";
import { useStore } from "@/lib/client/store";

const M = {
  agenda: ["Agenda", "Agenda"],
  checkin: ["Conferir", "Check in"],
  earnings: ["Ganhos", "Earnings"],
  profile: ["Perfil", "Profile"],
} satisfies Messages;

function Shell({ children }: { children: React.ReactNode }) {
  const { t } = useT();
  const unread = useStore((s) => s.db?.notices.filter((n) => n.userId === s.session.proId && !n.read).length ?? 0);
  return (
    <MobileShell
      inverted
      tabs={[
        { href: "/pro", label: t(M.agenda), icon: CalendarDays, match: (p) => p === "/pro" || p.startsWith("/pro/service") || p.startsWith("/pro/walkin") || p.startsWith("/pro/notices"), badge: unread },
        { href: "/pro/check-in", label: t(M.checkin), icon: QrCode },
        { href: "/pro/earnings", label: t(M.earnings), icon: TrendingUp },
        { href: "/pro/profile", label: t(M.profile), icon: CircleUser },
      ]}
    >
      <PageTransition className="flex flex-1 flex-col">{children}</PageTransition>
    </MobileShell>
  );
}

export default function ProLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireData>
      <DemoBar />
      <Shell>{children}</Shell>
    </RequireData>
  );
}
