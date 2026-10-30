"use client";

import {
  BarChart3,
  CalendarDays,
  ChevronsUpDown,
  LayoutList,
  Menu,
  MessageCircle,
  Receipt,
  Scissors,
  Settings,
  Sparkles,
  Star,
  Store,
  Tag as TagIcon,
  TrendingUp,
  Users,
  Building2,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { Avatar } from "@/components/kit";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ROLE } from "@/i18n/common";
import { useT, type Messages, type Msg } from "@/i18n";
import { store, useStore } from "@/lib/client/store";
import { useDb, useStaff } from "@/lib/client/hooks";
import type { Role, User } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

export const NAV_M = {
  panel: ["Painel", "Panel"],
  overview: ["Visão geral", "Overview"],
  sales: ["Vendas", "Sales"],
  operation: ["Operação", "Operations"],
  desk: ["Balcão", "Front desk"],
  orders: ["Pedidos", "Orders"],
  agenda: ["Agenda", "Agenda"],
  conversations: ["Conversas IA", "AI chats"],
  reviews: ["Avaliações", "Reviews"],
  catalog: ["Catálogo", "Catalog"],
  services: ["Serviços e produtos", "Services & products"],
  categories: ["Categorias", "Categories"],
  offers: ["Ofertas", "Offers"],
  people: ["Pessoas e negócio", "People & business"],
  users: ["Usuários", "Users"],
  units: ["Unidades", "Locations"],
  assistant: ["Assistente IA", "AI assistant"],
  settings: ["Configurações", "Settings"],
  teamHours: ["Horário e equipe", "Hours & team"],
  menu: ["Menu", "Menu"],
  switchUser: ["Trocar usuário da demo", "Switch demo user"],
  actingAs: ["Você está como", "You're acting as"],
  workUnit: ["Sua unidade de trabalho", "Your work location"],
  consolidated: ["Consolidado · {n} unidades", "Consolidated · {n} locations"],
  noAccess: ["Esta área é só para administradores.", "This area is for admins only."],
  noAccessHint: ["Troque o usuário da demo no menu para ver como um administrador.", "Switch the demo user in the menu to see it as an admin."],
} satisfies Messages;

interface NavItem {
  href: string;
  label: Msg;
  icon: React.ComponentType<{ className?: string }>;
  heading?: Msg;
  roles: Role[];
  badge?: number;
}

/** Unit filter shared by the admin screens. Desk users are pinned to their own unit. */
const UNIT_KEY = "bv-scheduling:admin-unit";
let unitValue: string | null = null;
const unitListeners = new Set<() => void>();
function readUnit() {
  if (unitValue == null) {
    try {
      unitValue = localStorage.getItem(UNIT_KEY) ?? "all";
    } catch {
      unitValue = "all";
    }
  }
  return unitValue;
}
export function setAdminUnit(v: string) {
  unitValue = v;
  try {
    localStorage.setItem(UNIT_KEY, v);
  } catch {
    /* ignore */
  }
  unitListeners.forEach((l) => l());
}

export function useAdminUnit(opts: { allowAll?: boolean } = {}): [string, (v: string) => void] {
  const allowAll = opts.allowAll !== false;
  const staff = useStaff();
  const db = useDb();
  const v = useSyncExternalStore(
    (l) => {
      unitListeners.add(l);
      return () => unitListeners.delete(l);
    },
    readUnit,
    () => "all",
  );
  if (staff && !staff.roles.includes("admin") && staff.unitId) return [staff.unitId, () => {}];
  if (!allowAll && (v === "all" || !db?.units.some((u) => u.id === v))) return [db?.units[0]?.id ?? "all", setAdminUnit];
  return [v, setAdminUnit];
}

export function UnitPicker({ allowAll = true, label, className }: { allowAll?: boolean; label?: string; className?: string }) {
  const { t, tx } = useT();
  const db = useDb();
  const staff = useStaff();
  const [unit, setUnit] = useAdminUnit({ allowAll });
  if (!db) return null;
  const isAdmin = staff?.roles.includes("admin");
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && <span className="text-sm font-medium">{label}</span>}
      <Select value={unit} onValueChange={setUnit} disabled={!isAdmin}>
        <SelectTrigger className="w-full min-w-56" aria-label={label ?? "Unidade"}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {allowAll && (
            <SelectItem value="all">
              <span className="font-mono text-ink-muted">∑</span> {t(["Todas as unidades", "All locations"])}
            </SelectItem>
          )}
          {db.units.map((u) => (
            <SelectItem key={u.id} value={u.id}>
              <span className="font-mono text-ink-muted">{tx(u.name).slice(0, 1)}</span> {tx(u.name)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function useNav(): NavItem[] {
  const forwarded = useStore((s) => {
    const staff = s.db?.users.find((u) => u.id === s.session.staffId);
    return (
      s.db?.conversations.filter((c) => c.status === "forwarded" && (staff?.roles.includes("admin") || c.unitId === staff?.unitId)).length ?? 0
    );
  });
  const A: Role[] = ["admin"];
  const AD: Role[] = ["admin", "desk"];
  return [
    { href: "/admin", label: NAV_M.overview, icon: BarChart3, heading: NAV_M.panel, roles: A },
    { href: "/admin/sales", label: NAV_M.sales, icon: TrendingUp, roles: A },
    { href: "/admin/desk", label: NAV_M.desk, icon: Store, heading: NAV_M.operation, roles: AD },
    { href: "/admin/orders", label: NAV_M.orders, icon: Receipt, roles: AD },
    { href: "/admin/agenda", label: NAV_M.agenda, icon: CalendarDays, roles: AD },
    { href: "/admin/conversations", label: NAV_M.conversations, icon: MessageCircle, roles: AD, badge: forwarded },
    { href: "/admin/reviews", label: NAV_M.reviews, icon: Star, roles: AD },
    { href: "/admin/services", label: NAV_M.services, icon: Scissors, heading: NAV_M.catalog, roles: A },
    { href: "/admin/categories", label: NAV_M.categories, icon: LayoutList, roles: A },
    { href: "/admin/offers", label: NAV_M.offers, icon: TagIcon, roles: A },
    { href: "/admin/users", label: NAV_M.users, icon: Users, heading: NAV_M.people, roles: A },
    { href: "/admin/units", label: NAV_M.units, icon: Building2, roles: A },
    { href: "/admin/assistant", label: NAV_M.assistant, icon: Sparkles, roles: A },
    { href: "/admin/settings/company", label: NAV_M.settings, icon: Settings, roles: A },
    { href: "/admin/settings/team", label: NAV_M.teamHours, icon: Settings, heading: NAV_M.people, roles: ["desk"] },
  ];
}

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  if (href.startsWith("/admin/services")) return pathname.startsWith("/admin/services") || pathname.startsWith("/admin/products");
  if (href.startsWith("/admin/settings")) return pathname.startsWith("/admin/settings");
  return pathname.startsWith(href);
}

function StaffSwitcher({ compact }: { compact?: boolean }) {
  const { t, tx } = useT();
  const db = useDb();
  const me = useStaff();
  if (!db || !me) return null;
  const staff = db.users.filter((u) => (u.roles.includes("admin") || u.roles.includes("desk")) && u.status === "active");
  const unitName = (u: User) => (u.unitId ? tx(db.units.find((x) => x.id === u.unitId)?.name) : t(["Todas as unidades", "All locations"]));
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-sm p-2 text-left hover:bg-muted"
          aria-label={t(NAV_M.switchUser)}
        >
          <Avatar name={`${me.firstName} ${me.lastName}`} />
          {!compact && (
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium">
                {me.firstName} {me.lastName}
              </span>
              <span className="truncate text-xs text-ink-muted">
                {me.roles
                  .filter((r) => r !== "client")
                  .map((r) => t(ROLE[r]))
                  .join(" · ")}
              </span>
            </span>
          )}
          <ChevronsUpDown className="size-4 text-ink-muted" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel className="bv-label">{t(NAV_M.switchUser)}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {staff.map((u) => (
          <DropdownMenuItem
            key={u.id}
            onSelect={() => store.setSession({ staffId: u.id })}
            className={cn("flex items-center gap-3", u.id === me.id && "bg-muted")}
          >
            <Avatar name={`${u.firstName} ${u.lastName}`} className="size-8" />
            <span className="flex flex-col">
              <span className="text-sm">
                {u.firstName} {u.lastName}
              </span>
              <span className="text-xs text-ink-muted">
                {u.roles
                  .filter((r) => r !== "client")
                  .map((r) => t(ROLE[r]))
                  .join(" · ")}{" "}
                · {unitName(u)}
              </span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const { t, tx } = useT();
  const pathname = usePathname();
  const me = useStaff();
  const db = useDb();
  const items = useNav().filter((i) => me && i.roles.some((r) => me.roles.includes(r)));
  const isAdmin = me?.roles.includes("admin");
  const headings = new Map<string, Msg>();
  items.reduce<Msg | undefined>((last, it) => {
    if (it.heading && it.heading !== last) headings.set(it.href, it.heading);
    return it.heading ?? last;
  }, undefined);
  return (
    <div className="flex h-full flex-col gap-4">
      <div className="px-2 pt-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-lg font-semibold">BV Studio</span>
          <span className="bv-label">{isAdmin ? t(NAV_M.consolidated, { n: db?.units.length ?? 0 }) : tx(db?.units.find((u) => u.id === me?.unitId)?.name)}</span>
          {!isAdmin && <span className="text-xs text-ink-muted">{t(NAV_M.workUnit)}</span>}
        </div>
      </div>
      <nav aria-label={t(NAV_M.menu)} className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-1">
        {items.map((it) => {
          const heading = headings.get(it.href);
          const active = isActive(pathname, it.href);
          const Icon = it.icon;
          return (
            <div key={it.href}>
              {heading && <div className="bv-label px-2 pb-1.5 pt-4">{t(heading)}</div>}
              <Link
                href={it.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-10 items-center gap-3 rounded-sm px-2 text-sm transition-colors",
                  active ? "bg-ink text-surface-0" : "text-ink hover:bg-muted",
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span className="flex-1 truncate">{t(it.label)}</span>
                {!!it.badge && (
                  <span
                    className={cn(
                      "min-w-5 rounded-sm px-1.5 text-center font-mono text-xs",
                      active ? "bg-surface-0 text-ink" : "bg-ink text-surface-0",
                    )}
                  >
                    {it.badge}
                  </span>
                )}
              </Link>
            </div>
          );
        })}
      </nav>
      <div className="border-t border-hairline pt-2">
        <span className="bv-label px-2">{t(NAV_M.actingAs)}</span>
        <StaffSwitcher />
      </div>
    </div>
  );
}

export function AdminSidebar() {
  return (
    <aside className="sticky top-11 hidden h-[calc(100dvh-2.75rem)] w-64 shrink-0 border-r border-hairline bg-sidebar p-3 lg:block">
      <SidebarBody />
    </aside>
  );
}

export function AdminMobileNav() {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="lg:hidden">
          <Menu /> {t(NAV_M.menu)}
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 bg-sidebar p-3">
        <SheetTitle className="sr-only">{t(NAV_M.menu)}</SheetTitle>
        <SidebarBody onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}

/** Renders children only for allowed roles; otherwise explains how to switch user. */
export function RoleGate({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const { t } = useT();
  const me = useStaff();
  if (!me) return null;
  if (!me.roles.some((r) => roles.includes(r)))
    return (
      <div className="flex flex-col gap-2 rounded-md border border-dashed border-hairline p-10 text-center">
        <p className="text-lg font-medium">{t(NAV_M.noAccess)}</p>
        <p className="text-ink-muted">{t(NAV_M.noAccessHint)}</p>
      </div>
    );
  return <>{children}</>;
}
