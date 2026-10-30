"use client";

import { ChevronLeft, Plus, X } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { RoleGate } from "@/components/admin/shell";
import { cleanPair, LTextInput, toPair } from "@/components/content";
import { Field, Panel, PhotoPlaceholder, ToggleRow } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useT, type Messages } from "@/i18n";
import { C } from "@/i18n/common";
import { useAction, useDb } from "@/lib/client/hooks";
import { parseMoney } from "@/lib/domain/text";
import type { Product } from "@/lib/domain/types";

const M = {
  back: ["Produtos", "Products"],
  newTitle: ["Novo produto", "New product"],
  saveProduct: ["Salvar produto", "Save product"],
  data: ["Dados do produto", "Product details"],
  type: ["Tipo", "Type"],
  salePrice: ["Preço de venda", "Sale price"],
  detail: ["Detalhe do card", "Card detail"],
  badge: ["Selo (opcional)", "Badge (optional)"],
  badgePh: ["Ex.: Mais vendido", "E.g. Best seller"],
  description: ["Descrição", "Description"],
  photos: ["Fotos", "Photos"],
  photosHint: ["{n} de 8", "{n} of 8"],
  cover: ["Capa", "Cover"],
  upload: ["Enviar", "Upload"],
  sale: ["Venda", "Selling"],
  available: ["Disponível", "Available"],
  availableHint: ["Desligue quando acabar.", "Turn off when it runs out."],
  online: ["Vender pelo site", "Sell online"],
  onlineHint: ["O cliente compra e retira no balcão.", "The client buys and picks up at the desk."],
  staff: ["Profissionais podem lançar", "Professionals can add it"],
  staffHint: ["Entra como extra no atendimento e paga comissão de produto.", "Goes in as an extra during the service and pays product commission."],
  units: ["Unidades", "Locations"],
  soldIn: ["vendido em {a} de {b} unidades", "sold in {a} of {b} locations"],
  priceHere: ["Preço aqui", "Price here"],
  basePh: ["{v} (base)", "{v} (base)"],
  unitsHint: [
    "Preço vazio usa o de venda. Sem controle de estoque: a disponibilidade vale para todas as unidades marcadas.",
    "An empty price uses the sale price. No stock control: availability applies to every selected location.",
  ],
  saved: ["Produto salvo.", "Product saved."],
  invalid: ["Confira o preço.", "Check the price."],
  removeUnit: ["Tirar de {u}", "Remove from {u}"],
} satisfies Messages;

type Draft = Omit<Product, "id" | "soldOnline" | "soldByStaff"> & { id: string | null };

export default function ProductEditorPage() {
  return (
    <RoleGate roles={["admin"]}>
      <ProductEditor />
    </RoleGate>
  );
}

function ProductEditor() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t, tx, fmt } = useT();
  const db = useDb();
  const { run, busy } = useAction("staff");
  const existing = db?.products.find((p) => p.id === id);
  const [d, setD] = useState<Draft>(() =>
    existing
      ? { ...structuredClone(existing), id: existing.id }
      : {
          id: null,
          name: { pt: "", en: "" },
          categoryId: db?.categories.find((c) => c.kind === "product")?.id ?? "",
          price: 0,
          detail: { pt: "", en: "" },
          badge: null,
          description: { pt: "", en: "" },
          media: 1,
          available: true,
          sellOnline: true,
          staffCanAdd: true,
          units: [],
        },
  );
  const [price, setPrice] = useState(() => (existing ? (existing.price / 100).toFixed(2).replace(".", ",") : ""));
  if (!db) return null;
  const patch = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));
  const missing = db.units.filter((u) => !d.units.some((l) => l.unitId === u.id));

  const save = async () => {
    const cents = parseMoney(price);
    if (cents == null) return (await import("sonner")).toast.error(t(M.invalid));
    const badge = d.badge ? cleanPair(toPair(d.badge)) : null;
    const r = await run<{ id: string }>(
      "product.save",
      {
        ...d,
        name: cleanPair(toPair(d.name)),
        detail: cleanPair(toPair(d.detail)),
        description: cleanPair(toPair(d.description)),
        badge: badge && badge.pt ? badge : null,
        price: cents,
      },
      { success: t(M.saved) },
    );
    if (r && !d.id) {
      router.replace(`/admin/products/${r.id}`);
      patch({ id: r.id });
    }
  };

  return (
    <>
      <Link href="/admin/products" className="flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ChevronLeft className="size-4" /> {t(M.back)}
      </Link>
      <header className="flex flex-wrap items-end justify-between gap-4" data-anim>
        <h1 className="text-3xl font-semibold tracking-[-0.02em]">{tx(d.name) || t(M.newTitle)}</h1>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/admin/products">{t(C.cancel)}</Link>
          </Button>
          <Button disabled={busy} onClick={save}>
            {t(M.saveProduct)}
          </Button>
        </div>
      </header>
      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div className="flex flex-col gap-6">
          <Panel title={t(M.data)} bodyClassName="flex flex-col gap-4">
            <Field label={t(C.name)}>
              <LTextInput value={d.name} onChange={(v) => patch({ name: v })} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t(M.type)}>
                <Select value={d.categoryId} onValueChange={(v) => patch({ categoryId: v })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {db.categories
                      .filter((c) => c.kind === "product")
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {tx(c.name)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t(M.salePrice)} htmlFor="price">
                <Input id="price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t(M.detail)}>
                <LTextInput value={d.detail} onChange={(v) => patch({ detail: v })} />
              </Field>
              <Field label={t(M.badge)}>
                <LTextInput value={d.badge ?? ""} placeholder={t(M.badgePh)} onChange={(v) => patch({ badge: v })} />
              </Field>
            </div>
            <Field label={t(M.description)}>
              <LTextInput multiline rows={5} value={d.description} onChange={(v) => patch({ description: v })} />
            </Field>
          </Panel>
          <Panel title={t(M.photos)} description={t(M.photosHint, { n: d.media })}>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {Array.from({ length: d.media }).map((_, i) => (
                <PhotoPlaceholder key={i} className="aspect-square" label={i === 0 ? t(M.cover) : `0${i + 1}`}>
                  <button type="button" aria-label={t(C.remove)} onClick={() => patch({ media: d.media - 1 })} className="absolute right-1 top-1 rounded-sm bg-card p-1">
                    <X className="size-3" />
                  </button>
                </PhotoPlaceholder>
              ))}
              {d.media < 8 && (
                <button
                  type="button"
                  onClick={() => patch({ media: d.media + 1 })}
                  className="flex aspect-square flex-col items-center justify-center gap-1 rounded-md border border-dashed border-line-strong text-sm text-ink-muted hover:text-ink"
                >
                  <Plus className="size-5" /> {t(M.upload)}
                </button>
              )}
            </div>
          </Panel>
        </div>
        <div className="flex flex-col gap-6">
          <Panel title={t(M.sale)}>
            <ToggleRow title={t(M.available)} description={t(M.availableHint)} checked={d.available} onChange={(v) => patch({ available: v })} />
            <ToggleRow title={t(M.online)} description={t(M.onlineHint)} checked={d.sellOnline} onChange={(v) => patch({ sellOnline: v })} />
            <ToggleRow title={t(M.staff)} description={t(M.staffHint)} checked={d.staffCanAdd} onChange={(v) => patch({ staffCanAdd: v })} />
          </Panel>
          <Panel title={t(M.units)} description={t(M.soldIn, { a: d.units.length, b: db.units.length })}>
            <div className="mb-4 flex flex-wrap gap-2">
              {missing.map((u) => (
                <Button key={u.id} size="sm" variant="outline" onClick={() => patch({ units: [...d.units, { unitId: u.id, price: null }] })}>
                  <Plus /> {tx(u.name)}
                </Button>
              ))}
            </div>
            <div className="flex flex-col gap-3">
              {d.units.map((link, idx) => {
                const unit = db.units.find((u) => u.id === link.unitId);
                return (
                  <div key={link.unitId} className="flex items-end gap-3 rounded-sm border border-hairline p-3">
                    <span className="flex-1 pb-2 font-medium">{tx(unit?.name)}</span>
                    <Field label={t(M.priceHere)} className="w-40">
                      <Input
                        inputMode="decimal"
                        placeholder={t(M.basePh, { v: fmt.money(parseMoney(price) ?? 0) })}
                        value={link.price != null ? (link.price / 100).toFixed(2).replace(".", ",") : ""}
                        onChange={(e) => {
                          const v = e.target.value.trim() ? parseMoney(e.target.value) : null;
                          patch({ units: d.units.map((u, i) => (i === idx ? { ...u, price: v } : u)) });
                        }}
                      />
                    </Field>
                    <Button variant="ghost" size="icon" aria-label={t(M.removeUnit, { u: tx(unit?.name) })} onClick={() => patch({ units: d.units.filter((_, i) => i !== idx) })}>
                      <X />
                    </Button>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-ink-muted">{t(M.unitsHint)}</p>
          </Panel>
        </div>
      </div>
    </>
  );
}
