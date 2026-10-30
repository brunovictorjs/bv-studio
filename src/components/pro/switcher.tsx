"use client";

import { ChevronsUpDown } from "lucide-react";
import { Avatar } from "@/components/kit";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useT } from "@/i18n";
import { useDb, usePro } from "@/lib/client/hooks";
import { store } from "@/lib/client/store";

/** Lets the demo viewer act as any professional. */
export function ProSwitcher({ sub }: { sub?: React.ReactNode }) {
  const { t, tx } = useT();
  const db = useDb();
  const me = usePro();
  if (!db || !me) return null;
  const pros = db.users.filter((u) => u.roles.includes("professional") && u.status === "active");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="flex min-w-0 flex-1 items-center gap-3 rounded-sm p-1 text-left hover:bg-muted" aria-label={t(["Trocar profissional da demo", "Switch demo professional"])}>
          <Avatar name={`${me.firstName} ${me.lastName}`} inverted className="size-11" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-semibold">
              {me.firstName} {me.lastName}
            </span>
            <span className="truncate text-xs text-ink-muted">{sub}</span>
          </span>
          <ChevronsUpDown className="size-4 text-ink-muted" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel className="bv-label">{t(["Ver como", "View as"])}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {pros.map((p) => (
          <DropdownMenuItem key={p.id} onSelect={() => store.setSession({ proId: p.id })} className="flex items-center gap-3">
            <Avatar name={`${p.firstName} ${p.lastName}`} className="size-8" />
            <span className="flex flex-col">
              <span>
                {p.firstName} {p.lastName}
              </span>
              <span className="text-xs text-ink-muted">{tx(db.units.find((u) => u.id === p.unitId)?.name)}</span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
