"use client";

import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { CatalogTabs } from "@/components/admin/catalog-tabs";
import { RoleGate } from "@/components/admin/shell";
import { Chip, Empty, PageHeader, Panel } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useT, type Messages } from "@/i18n";
import { C } from "@/i18n/common";
import { useAction, useDb } from "@/lib/client/hooks";
import { matches } from "@/lib/domain/text";

const M = {
  eyebrow: ["Catálogo", "Catalog"],
  title: ["Produtos", "Products"],
  new: ["Novo produto", "New product"],
  search: ["Buscar produto", "Search products"],
  allTypes: ["Todos os tipos", "All types"],
  availAll: ["Disponíveis e em falta", "Available and out of stock"],
  avail: ["Só disponíveis", "Available only"],
  out: ["Só em falta", "Out of stock only"],
  summary: ["{n} produtos · {s} vendidos", "{n} products · {s} sold"],
  type: ["Tipo", "Type"],
  site: ["Pelo site", "Online"],
  team: ["Pela equipe", "By staff"],
  available: ["Disponível", "Available"],
  photos: ["{n} fotos", "{n} photos"],
  outOfStock: ["em falta", "out of stock"],
  hint: [
    "Produto não tem duração nem estoque: quando acabar, desligue Disponível. Só as vendas lançadas pela equipe pagam comissão de produtos.",
    "Products have no duration or stock count: when one runs out, turn Available off. Only sales added by staff pay product commission.",
  ],
} satisfies Messages;

export default function ProductsPage() {
  return (
    <RoleGate roles={["admin"]}>
      <Products />
    </RoleGate>
  );
}

function Products() {
  const { t, tx, fmt } = useT();
  const db = useDb();
  const { run } = useAction("staff");
  const [q, setQ] = useState("");
  const [unit, setUnit] = useState("all");
  const [type, setType] = useState("all");
  const [avail, setAvail] = useState("all");
  if (!db) return null;
  const rows = db.products.filter(
    (p) =>
      (unit === "all" || p.units.some((u) => u.unitId === unit)) &&
      (type === "all" || p.categoryId === type) &&
      (avail === "all" || (avail === "on" ? p.available : !p.available)) &&
      matches(tx(p.name), q),
  );
  const sold = rows.reduce((s, p) => s + p.soldOnline + p.soldByStaff, 0);
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
              <Link href="/admin/products/new">
                <Plus /> {t(M.new)}
              </Link>
            </Button>
          </>
        }
      />
      <CatalogTabs />
      <section className="flex flex-wrap gap-2" data-anim>
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
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-44" aria-label={t(M.type)}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t(M.allTypes)}</SelectItem>
            {db.categories
              .filter((c) => c.kind === "product")
              .map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {tx(c.name)}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Select value={avail} onValueChange={setAvail}>
          <SelectTrigger className="w-56" aria-label={t(M.available)}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t(M.availAll)}</SelectItem>
            <SelectItem value="on">{t(M.avail)}</SelectItem>
            <SelectItem value="off">{t(M.out)}</SelectItem>
          </SelectContent>
        </Select>
      </section>
      <Panel title={t(M.summary, { n: rows.length, s: sold })}>
        {rows.length === 0 ? (
          <Empty>{t(C.noResults)}</Empty>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[860px]">
              <TableHeader>
                <TableRow>
                  <TableHead>{t(C.product)}</TableHead>
                  <TableHead>{t(M.type)}</TableHead>
                  <TableHead>{t(C.units)}</TableHead>
                  <TableHead>{t(C.price)}</TableHead>
                  <TableHead className="text-right">{t(M.site)}</TableHead>
                  <TableHead className="text-right">{t(M.team)}</TableHead>
                  <TableHead>{t(M.available)}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link href={`/admin/products/${p.id}`} className="flex flex-col">
                        <span className="font-medium underline-offset-4 hover:underline">{tx(p.name)}</span>
                        <span className="text-xs text-ink-muted">
                          {tx(p.detail)} · {t(M.photos, { n: p.media })}
                          {p.badge && ` · ${tx(p.badge)}`}
                          {!p.available && ` · ${t(M.outOfStock)}`}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell>{tx(db.categories.find((c) => c.id === p.categoryId)?.name)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {p.units.map((u) => (
                          <Chip key={u.unitId}>{tx(db.units.find((x) => x.id === u.unitId)?.name)}</Chip>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="tabular">{fmt.money(p.price)}</TableCell>
                    <TableCell className="tabular text-right">{p.soldOnline}</TableCell>
                    <TableCell className="tabular text-right">{p.soldByStaff}</TableCell>
                    <TableCell>
                      <Switch checked={p.available} aria-label={`${t(M.available)} · ${tx(p.name)}`} onCheckedChange={(v) => run("product.toggle", { id: p.id, available: v })} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <p className="mt-4 text-sm text-ink-muted">{t(M.hint)}</p>
      </Panel>
    </>
  );
}
