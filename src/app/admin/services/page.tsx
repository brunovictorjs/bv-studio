"use client";

import { MoreHorizontal, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { CatalogTabs } from "@/components/admin/catalog-tabs";
import { RoleGate } from "@/components/admin/shell";
import { Chip, Empty, PageHeader, Panel, StatusBadge } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useT, type Messages } from "@/i18n";
import { C } from "@/i18n/common";
import { useAction, useDb } from "@/lib/client/hooks";
import { advertisedOffer, servicePriceAt } from "@/lib/domain/rules";
import { matches } from "@/lib/domain/text";
import { nowLocal } from "@/lib/domain/time";

const M = {
  eyebrow: ["Catálogo", "Catalog"],
  title: ["Serviços", "Services"],
  new: ["Novo serviço", "New service"],
  search: ["Buscar serviço", "Search services"],
  active: ["Ativos", "Active"],
  drafts: ["Rascunhos", "Drafts"],
  archived: ["Arquivados", "Archived"],
  onlyOffer: ["Só em oferta", "On offer only"],
  allCats: ["Todas as categorias", "All categories"],
  photos: ["{n} fotos", "{n} photos"],
  noPhotos: ["sem fotos", "no photos"],
  inOffer: ["em oferta até {d}", "on offer until {d}"],
  sold: ["Vendidos", "Sold"],
  none: ["nenhuma ainda", "none yet"],
  varies: ["varia por unidade", "varies by location"],
  status_active: ["Ativo", "Active"],
  status_draft: ["Rascunho", "Draft"],
  status_archived: ["Arquivado", "Archived"],
  status_offer: ["Em oferta", "On offer"],
  edit: ["Editar", "Edit"],
  publish: ["Publicar", "Publish"],
  toDraft: ["Voltar para rascunho", "Back to draft"],
  archive: ["Arquivar", "Archive"],
  restore: ["Restaurar como rascunho", "Restore as draft"],
  more: ["Mais ações", "More actions"],
} satisfies Messages;

export default function ServicesPage() {
  return (
    <RoleGate roles={["admin"]}>
      <Services />
    </RoleGate>
  );
}

function Services() {
  const { t, tx, fmt } = useT();
  const db = useDb();
  const { run } = useAction("staff");
  const [q, setQ] = useState("");
  const [unit, setUnit] = useState("all");
  const [cat, setCat] = useState("all");
  const [status, setStatus] = useState<"active" | "draft" | "archived">("active");
  const [onlyOffer, setOnlyOffer] = useState(false);
  if (!db) return null;
  const today = nowLocal().slice(0, 10);
  const offerOf = (id: string) => db.units.map((u) => advertisedOffer(db, id, u.id, today)).find(Boolean) ?? null;
  const rows = db.services.filter(
    (s) =>
      s.status === status &&
      (unit === "all" || s.units.some((u) => u.unitId === unit)) &&
      (cat === "all" || s.categoryId === cat) &&
      (!onlyOffer || offerOf(s.id)) &&
      matches(tx(s.name), q),
  );
  const rating = (id: string) => {
    const r = db.reviews.filter((x) => x.serviceId === id);
    return r.length ? r.reduce((a, b) => a + b.serviceRating, 0) / r.length : null;
  };

  return (
    <>
      <PageHeader
        eyebrow={t(M.eyebrow)}
        title={t(M.title)}
        actions={
          <>
            <label className="flex h-10 min-w-60 items-center gap-2 rounded-sm border border-input px-3">
              <Search className="size-4 text-ink-muted" />
              <input type="search" className="flex-1 bg-transparent outline-none" placeholder={t(M.search)} aria-label={t(M.search)} value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
            <Button asChild>
              <Link href="/admin/services/new">
                <Plus /> {t(M.new)}
              </Link>
            </Button>
          </>
        }
      />
      <CatalogTabs />
      <section className="flex flex-wrap items-center gap-2" data-anim>
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
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="w-48" aria-label={t(C.category)}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t(M.allCats)}</SelectItem>
            {db.categories
              .filter((c) => c.kind === "service")
              .map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {tx(c.name)}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger className="w-40" aria-label={t(C.status)}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">{t(M.active)}</SelectItem>
            <SelectItem value="draft">{t(M.drafts)}</SelectItem>
            <SelectItem value="archived">{t(M.archived)}</SelectItem>
          </SelectContent>
        </Select>
        <label className="ml-2 flex items-center gap-2 text-sm">
          <Checkbox checked={onlyOffer} onCheckedChange={(v) => setOnlyOffer(!!v)} /> {t(M.onlyOffer)}
        </label>
      </section>
      <Panel>
        {rows.length === 0 ? (
          <Empty>{t(C.noResults)}</Empty>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[960px]">
              <TableHeader>
                <TableRow>
                  <TableHead>{t(C.service)}</TableHead>
                  <TableHead>{t(C.category)}</TableHead>
                  <TableHead>{t(C.units)}</TableHead>
                  <TableHead>{t(C.duration)}</TableHead>
                  <TableHead>{t(C.price)}</TableHead>
                  <TableHead className="text-right">{t(M.sold)}</TableHead>
                  <TableHead className="text-right">{t(C.rating)}</TableHead>
                  <TableHead>{t(C.status)}</TableHead>
                  <TableHead>
                    <span className="sr-only">{t(C.actions)}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((s) => {
                  const offer = offerOf(s.id);
                  const prices = [...new Set(s.units.map((u) => servicePriceAt(s, u.unitId)))].sort((a, b) => a - b);
                  const r = rating(s.id);
                  return (
                    <TableRow key={s.id}>
                      <TableCell>
                        <Link href={`/admin/services/${s.id}`} className="flex flex-col">
                          <span className="font-medium underline-offset-4 hover:underline">{tx(s.name)}</span>
                          <span className="text-xs text-ink-muted">
                            {s.media ? t(M.photos, { n: s.media }) : t(M.noPhotos)}
                            {offer && ` · ${t(M.inOffer, { d: fmt.numeric(offer.end) })}`}
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell>{tx(db.categories.find((c) => c.id === s.categoryId)?.name)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {s.units.length === 0 ? (
                            <span className="text-ink-muted">{t(M.none)}</span>
                          ) : (
                            s.units.map((u) => <Chip key={u.unitId}>{tx(db.units.find((x) => x.id === u.unitId)?.name)}</Chip>)
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{fmt.dur(s.durationMin)}</TableCell>
                      <TableCell className="tabular">
                        {prices.length > 1 ? (
                          <span className="flex flex-col">
                            {fmt.money(prices[0])}–{fmt.money(prices.at(-1)!)}
                            <span className="text-xs text-ink-muted">{t(M.varies)}</span>
                          </span>
                        ) : (
                          fmt.money(prices[0] ?? s.price)
                        )}
                      </TableCell>
                      <TableCell className="tabular text-right">{s.soldCount || "—"}</TableCell>
                      <TableCell className="tabular text-right">{r ? fmt.num(r, 1) : "—"}</TableCell>
                      <TableCell>
                        <StatusBadge state={offer ? "in_service" : s.status === "active" ? "paid" : "cart"}>
                          {t(offer ? M.status_offer : M[`status_${s.status}` as const])}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" aria-label={t(M.more)}>
                              <MoreHorizontal />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/admin/services/${s.id}`}>{t(M.edit)}</Link>
                            </DropdownMenuItem>
                            {s.status === "draft" && <DropdownMenuItem onSelect={() => run("service.setStatus", { id: s.id, status: "active" })}>{t(M.publish)}</DropdownMenuItem>}
                            {s.status === "active" && <DropdownMenuItem onSelect={() => run("service.setStatus", { id: s.id, status: "draft" })}>{t(M.toDraft)}</DropdownMenuItem>}
                            {s.status !== "archived" ? (
                              <DropdownMenuItem onSelect={() => run("service.setStatus", { id: s.id, status: "archived" })}>{t(M.archive)}</DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onSelect={() => run("service.setStatus", { id: s.id, status: "draft" })}>{t(M.restore)}</DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
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
