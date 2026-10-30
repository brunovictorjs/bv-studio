"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { RoleGate } from "@/components/admin/shell";
import { Empty, PageHeader, Panel, StatusBadge } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useT, type Messages } from "@/i18n";
import { C } from "@/i18n/common";
import { useAction, useDb } from "@/lib/client/hooks";
import { offerState } from "@/lib/domain/rules";
import { nowLocal } from "@/lib/domain/time";

const M = {
  eyebrow: ["Catálogo", "Catalog"],
  title: ["Ofertas", "Offers"],
  description: ["Cada oferta vale para uma unidade só.", "Each offer applies to a single location."],
  new: ["Nova oferta", "New offer"],
  offer: ["Oferta", "Offer"],
  discount: ["Desconto", "Discount"],
  period: ["Período", "Period"],
  days: ["Dias", "Days"],
  uses: ["Usos", "Uses"],
  noLimit: ["sem limite", "no limit"],
  every: ["todos", "every day"],
  active: ["Ativa", "Active"],
  scheduled: ["Agendada", "Scheduled"],
  ended: ["Encerrada", "Ended"],
  end: ["Encerrar", "End"],
  endedOk: ["Oferta encerrada.", "Offer ended."],
} satisfies Messages;

export default function OffersPage() {
  return (
    <RoleGate roles={["admin"]}>
      <Offers />
    </RoleGate>
  );
}

function Offers() {
  const { t, tx, fmt } = useT();
  const db = useDb();
  const { run, busy } = useAction("staff");
  const [unit, setUnit] = useState("all");
  if (!db) return null;
  const today = nowLocal().slice(0, 10);
  const rows = db.offers.filter((o) => unit === "all" || o.unitId === unit).sort((a, b) => b.start.localeCompare(a.start));
  const days = (w: number[]) => (w.length === 7 ? t(M.every) : [...w].sort().map((d) => fmt.weekdayName(d)).join(", "));
  return (
    <>
      <PageHeader
        eyebrow={t(M.eyebrow)}
        title={t(M.title)}
        description={t(M.description)}
        actions={
          <>
            <Select value={unit} onValueChange={setUnit}>
              <SelectTrigger className="w-48" aria-label={t(C.unit)}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t(C.allUnits)}</SelectItem>
                {db.units.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {tx(u.name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button asChild>
              <Link href="/admin/offers/new">
                <Plus /> {t(M.new)}
              </Link>
            </Button>
          </>
        }
      />
      <Panel>
        {rows.length === 0 ? (
          <Empty>{t(C.noResults)}</Empty>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[980px]">
              <TableHeader>
                <TableRow>
                  <TableHead>{t(M.offer)}</TableHead>
                  <TableHead>{t(C.unit)}</TableHead>
                  <TableHead>{t(M.discount)}</TableHead>
                  <TableHead>{t(M.period)}</TableHead>
                  <TableHead>{t(M.days)}</TableHead>
                  <TableHead>{t(C.services)}</TableHead>
                  <TableHead>{t(M.uses)}</TableHead>
                  <TableHead>{t(C.status)}</TableHead>
                  <TableHead>
                    <span className="sr-only">{t(C.actions)}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((o) => {
                  const st = offerState(o, today);
                  return (
                    <TableRow key={o.id}>
                      <TableCell>
                        {st === "ended" ? (
                          <span className="font-medium text-ink-muted">{tx(o.name)}</span>
                        ) : (
                          <Link href={`/admin/offers/${o.id}`} className="font-medium underline-offset-4 hover:underline">
                            {tx(o.name)}
                          </Link>
                        )}
                      </TableCell>
                      <TableCell>{tx(db.units.find((u) => u.id === o.unitId)?.name)}</TableCell>
                      <TableCell className="tabular">{o.type === "percent" ? `−${o.value}%` : `− ${fmt.money(o.value)}`}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {fmt.numeric(o.start)} – {fmt.numeric(o.end)}
                      </TableCell>
                      <TableCell>{days(o.weekdays)}</TableCell>
                      <TableCell className="max-w-56">{o.serviceIds.map((id) => tx(db.services.find((s) => s.id === id)?.name)).join(", ")}</TableCell>
                      <TableCell className="tabular whitespace-nowrap">
                        {o.uses} / {o.usageLimit ?? t(M.noLimit)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge state={st === "active" ? "in_service" : st === "scheduled" ? "paid" : "completed"}>{t(M[st])}</StatusBadge>
                      </TableCell>
                      <TableCell className="text-right">
                        {st !== "ended" && (
                          <Button size="sm" variant="outline" disabled={busy} onClick={() => run("offer.end", { id: o.id }, { success: t(M.endedOk) })}>
                            {t(M.end)}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>
    </>
  );
}
