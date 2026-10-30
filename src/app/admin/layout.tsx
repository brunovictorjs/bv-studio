"use client";

import { AdminMobileNav, AdminSidebar } from "@/components/admin/shell";
import { DemoBar } from "@/components/demo-bar";
import { PageTransition } from "@/components/motion";
import { RequireData } from "@/components/providers";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireData>
      <DemoBar />
      <div className="flex min-h-[calc(100dvh-2.75rem)]">
        <AdminSidebar />
        <main className="min-w-0 flex-1">
          <div className="border-b border-hairline px-4 py-2 lg:hidden">
            <AdminMobileNav />
          </div>
          <PageTransition className="mx-auto flex max-w-[1400px] flex-col gap-6 px-4 py-6 md:px-8 md:py-8">{children}</PageTransition>
        </main>
      </div>
    </RequireData>
  );
}
