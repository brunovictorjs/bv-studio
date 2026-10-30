"use client";

import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { RoleGate } from "@/components/admin/shell";
import { cleanPair, LTextInput, toPair } from "@/components/content";
import { Field, PageHeader, Panel, Segmented } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useT, type Messages } from "@/i18n";
import { C } from "@/i18n/common";
import { useAction, useDb } from "@/lib/client/hooks";
import type { Category, CategoryKind, LText } from "@/lib/domain/types";

const M = {
  eyebrow: ["Catálogo", "Catalog"],
  title: ["Categorias", "Categories"],
  description: ["A ordem aqui é a ordem dos chips no site de cada unidade.", "This order is the order of the chips on each location's site."],
  newCat: ["Nova categoria", "New category"],
  serviceCats: ["Categorias de serviço", "Service categories"],
  productTypes: ["Tipos de produto", "Product types"],
  add: ["Adicionar", "Add"],
  pos: ["{n}º", "#{n}"],
  items: ["{n} serviços", "{n} services"],
  pitems: ["{n} produtos", "{n} products"],
  empty: ["sem itens", "no items"],
  special: ["categoria especial", "special category"],
  up: ["Subir {c}", "Move {c} up"],
  down: ["Descer {c}", "Move {c} down"],
  rename: ["Editar {c}", "Edit {c}"],
  del: ["Apagar {c}", "Delete {c}"],
  hint: ["Só dá para apagar ou trocar o tipo de uma categoria sem itens.", "You can only delete or change the type of a category with no items."],
  kind: ["Tipo", "Type"],
  service: ["Serviço", "Service"],
  product: ["Produto", "Product"],
  saved: ["Categoria salva.", "Category saved."],
  deleted: ["Categoria apagada.", "Category deleted."],
} satisfies Messages;

export default function CategoriesPage() {
  return (
    <RoleGate roles={["admin"]}>
      <Categories />
    </RoleGate>
  );
}

function Categories() {
  const { t, tx } = useT();
  const db = useDb();
  const { run, busy } = useAction("staff");
  const [editing, setEditing] = useState<{ id: string | null; kind: CategoryKind; name: LText } | null>(null);
  if (!db) return null;

  const list = (kind: CategoryKind) => db.categories.filter((c) => c.kind === kind).sort((a, b) => a.order - b.order);
  const count = (c: Category) => (c.kind === "service" ? db.services.filter((s) => s.categoryId === c.id && s.status !== "archived").length : db.products.filter((p) => p.categoryId === c.id).length);
  const unitsOf = (c: Category) => {
    const ids = new Set(
      (c.kind === "service" ? db.services.filter((s) => s.categoryId === c.id).flatMap((s) => s.units) : db.products.filter((p) => p.categoryId === c.id).flatMap((p) => p.units)).map((u) => u.unitId),
    );
    return db.units.filter((u) => ids.has(u.id)).map((u) => tx(u.name)).join(` ${t(["e", "and"])} `);
  };

  const section = (kind: CategoryKind) => (
    <Panel
      title={t(kind === "service" ? M.serviceCats : M.productTypes)}
      actions={
        <Button size="sm" variant="outline" onClick={() => setEditing({ id: null, kind, name: { pt: "", en: "" } })}>
          <Plus /> {t(M.add)}
        </Button>
      }
    >
      <ol className="flex flex-col divide-y divide-hairline">
        {list(kind).map((c, i, arr) => {
          const n = count(c);
          const name = tx(c.name);
          return (
            <li key={c.id} className="flex items-center gap-3 py-3">
              <span className="font-mono text-ink-muted" aria-hidden="true">
                ⋮⋮
              </span>
              <div className="flex flex-1 flex-col">
                <span className="font-medium">{name}</span>
                <span className="text-sm text-ink-muted">
                  {t(M.pos, { n: i + 1 })} · {n ? t(kind === "service" ? M.items : M.pitems, { n }) : t(M.empty)}
                  {unitsOf(c) && ` · ${unitsOf(c)}`}
                  {c.special && ` · ${t(M.special)}`}
                </span>
              </div>
              <div className="flex gap-1">
                <Button size="icon-sm" variant="ghost" aria-label={t(M.up, { c: name })} disabled={i === 0 || busy} onClick={() => run("category.move", { id: c.id, dir: -1 })}>
                  <ArrowUp />
                </Button>
                <Button size="icon-sm" variant="ghost" aria-label={t(M.down, { c: name })} disabled={i === arr.length - 1 || busy} onClick={() => run("category.move", { id: c.id, dir: 1 })}>
                  <ArrowDown />
                </Button>
                <Button size="icon-sm" variant="ghost" aria-label={t(M.rename, { c: name })} onClick={() => setEditing({ id: c.id, kind: c.kind, name: c.name })}>
                  <Pencil />
                </Button>
                <Button size="icon-sm" variant="ghost" aria-label={t(M.del, { c: name })} disabled={n > 0 || busy} onClick={() => run("category.delete", { id: c.id }, { success: t(M.deleted) })}>
                  <Trash2 />
                </Button>
              </div>
            </li>
          );
        })}
      </ol>
    </Panel>
  );

  return (
    <>
      <PageHeader
        eyebrow={t(M.eyebrow)}
        title={t(M.title)}
        description={t(M.description)}
        actions={
          <Button onClick={() => setEditing({ id: null, kind: "service", name: { pt: "", en: "" } })}>
            <Plus /> {t(M.newCat)}
          </Button>
        }
      />
      <div className="grid gap-6 xl:grid-cols-2">
        {section("service")}
        {section("product")}
      </div>
      <p className="text-sm text-ink-muted" data-anim>
        {t(M.hint)}
      </p>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? t(C.edit) : t(M.newCat)}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="flex flex-col gap-4">
              <Field label={t(C.name)}>
                <LTextInput value={editing.name} onChange={(v) => setEditing({ ...editing, name: v })} />
              </Field>
              <Field label={t(M.kind)}>
                <Segmented
                  label={t(M.kind)}
                  value={editing.kind}
                  onChange={(v) => setEditing({ ...editing, kind: v })}
                  options={[
                    { value: "service", label: t(M.service) },
                    { value: "product", label: t(M.product) },
                  ]}
                />
              </Field>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              {t(C.cancel)}
            </Button>
            <Button
              disabled={busy}
              onClick={async () => {
                const r = await run("category.save", { id: editing!.id, kind: editing!.kind, name: cleanPair(toPair(editing!.name)) }, { success: t(M.saved) });
                if (r) setEditing(null);
              }}
            >
              {t(C.save)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
