"use client";

import { ChevronLeft, Plus, X } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { RoleGate } from "@/components/admin/shell";
import { cleanPair, LTextInput, Markdown, toPair } from "@/components/content";
import { Field, Panel, PhotoPlaceholder, Segmented, ToggleRow } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useT, type Messages } from "@/i18n";
import { C } from "@/i18n/common";
import { useAction, useDb } from "@/lib/client/hooks";
import { parseMoney } from "@/lib/domain/text";
import { durationLabel, parseDuration } from "@/lib/domain/time";
import type { Service } from "@/lib/domain/types";

const M = {
  back: ["Serviços", "Services"],
  newTitle: ["Novo serviço", "New service"],
  unsaved: ["Alterações não salvas", "Unsaved changes"],
  saveDraft: ["Salvar rascunho", "Save draft"],
  savePublish: ["Salvar e publicar", "Save and publish"],
  description: ["Descrição detalhada", "Detailed description"],
  markdown: ["Markdown", "Markdown"],
  preview: ["Pré-visualizar", "Preview"],
  media: ["Fotos e vídeos", "Photos and videos"],
  mediaHint: ["{n} de 12 · na demo as fotos são ilustrativas", "{n} of 12 · photos are placeholders in the demo"],
  cover: ["Capa", "Cover"],
  upload: ["Enviar", "Upload"],
  data: ["Dados do serviço", "Service details"],
  basePrice: ["Preço base", "Base price"],
  durationHint: ["Ex.: 50 min, 1h, 2h30", "E.g. 50 min, 1h, 2h30"],
  summary: ["Resumo do card", "Card summary"],
  units: ["Unidades e quem executa", "Locations and who performs it"],
  soldIn: ["vendido em {a} de {b} unidades", "sold in {a} of {b} locations"],
  addUnit: ["Adicionar unidade", "Add location"],
  inAll: ["Em todas", "In all"],
  priceHere: ["Preço aqui", "Price here"],
  basePh: ["{v} (base)", "{v} (base)"],
  unitsHint: [
    "Cada unidade mostra só os profissionais dela. Publicar exige ao menos um profissional em cada unidade.",
    "Each location only lists its own professionals. Publishing requires at least one professional per location.",
  ],
  publication: ["Publicação", "Publishing"],
  isNew: ["Marcar como novidade", "Mark as new"],
  favorites: ["Aceita favoritos", "Accepts favorites"],
  saved: ["Serviço salvo.", "Service saved."],
  published: ["Serviço publicado.", "Service published."],
  removeUnit: ["Tirar de {u}", "Remove from {u}"],
  invalid: ["Confira preço e duração.", "Check price and duration."],
  noPros: ["Nenhum profissional nesta unidade.", "No professionals at this location."],
} satisfies Messages;

type Draft = Omit<Service, "id" | "soldCount" | "status"> & { id: string | null };

export default function ServiceEditorPage() {
  return (
    <RoleGate roles={["admin"]}>
      <ServiceEditor />
    </RoleGate>
  );
}

function ServiceEditor() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t, tx, fmt } = useT();
  const db = useDb();
  const { run, busy } = useAction("staff");
  const existing = db?.services.find((s) => s.id === id);
  const [d, setD] = useState<Draft>(() =>
    existing
      ? { ...structuredClone(existing), id: existing.id }
      : {
          id: null,
          name: { pt: "", en: "" },
          categoryId: db?.categories.find((c) => c.kind === "service")?.id ?? "",
          price: 0,
          durationMin: 30,
          summary: { pt: "", en: "" },
          description: { pt: "", en: "" },
          media: 0,
          isNew: true,
          allowFavorites: true,
          units: [],
        },
  );
  const [price, setPrice] = useState(() => (existing ? (existing.price / 100).toFixed(2).replace(".", ",") : ""));
  const [dur, setDur] = useState(() => (existing ? durationLabel(existing.durationMin) : "30 min"));
  const [mode, setMode] = useState<"md" | "preview">("md");
  const [dirty, setDirty] = useState(false);
  const [descLang, setDescLang] = useState<"pt" | "en">("pt");
  if (!db) return null;
  const patch = (p: Partial<Draft>) => {
    setD((x) => ({ ...x, ...p }));
    setDirty(true);
  };
  const desc = toPair(d.description);

  const save = async (publish: boolean) => {
    const priceCents = parseMoney(price);
    const minutes = parseDuration(dur);
    if (priceCents == null || !minutes) {
      (await import("sonner")).toast.error(t(M.invalid));
      return;
    }
    const r = await run<{ id: string }>(
      "service.save",
      {
        ...d,
        name: cleanPair(toPair(d.name)),
        summary: cleanPair(toPair(d.summary)),
        description: cleanPair(desc),
        price: priceCents,
        durationMin: minutes,
        publish,
      },
      { success: t(publish ? M.published : M.saved) },
    );
    if (r) {
      setDirty(false);
      if (!d.id) router.replace(`/admin/services/${r.id}`);
      setD((x) => ({ ...x, id: r.id }));
    }
  };

  const unitPros = (unitId: string) => db.users.filter((u) => u.roles.includes("professional") && u.unitId === unitId && u.status !== "disabled");
  const missingUnits = db.units.filter((u) => !d.units.some((l) => l.unitId === u.id));

  return (
    <>
      <Link href="/admin/services" className="flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ChevronLeft className="size-4" /> {t(M.back)}
      </Link>
      <header className="flex flex-wrap items-end justify-between gap-4" data-anim>
        <div className="flex flex-col gap-1">
          {dirty && <span className="bv-label">{t(M.unsaved)}</span>}
          <h1 className="text-3xl font-semibold tracking-[-0.02em]">{tx(d.name) || t(M.newTitle)}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={busy} onClick={() => save(false)}>
            {t(M.saveDraft)}
          </Button>
          <Button disabled={busy} onClick={() => save(true)}>
            {t(M.savePublish)}
          </Button>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div className="flex flex-col gap-6">
          <Panel
            title={t(M.description)}
            actions={
              <Segmented
                size="sm"
                label={t(M.description)}
                value={mode}
                onChange={setMode}
                options={[
                  { value: "md", label: t(M.markdown) },
                  { value: "preview", label: t(M.preview) },
                ]}
              />
            }
          >
            <div className="mb-2 flex gap-1 font-mono text-[11px]" role="radiogroup" aria-label="Idioma · Language">
              {(["pt", "en"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  role="radio"
                  aria-checked={descLang === l}
                  onClick={() => setDescLang(l)}
                  className={descLang === l ? "h-6 rounded-sm bg-ink px-2 uppercase text-surface-0" : "h-6 rounded-sm px-2 uppercase text-ink-muted"}
                >
                  {l}
                </button>
              ))}
            </div>
            {mode === "md" ? (
              <textarea
                aria-label={t(M.description)}
                className="min-h-72 w-full rounded-sm border border-input bg-transparent p-3 font-mono text-sm outline-none focus-visible:border-ink"
                value={desc[descLang]}
                onChange={(e) => patch({ description: { ...desc, [descLang]: e.target.value } })}
              />
            ) : (
              <div className="min-h-72 rounded-sm border border-hairline p-4">
                <Markdown source={desc[descLang] || desc.pt} />
              </div>
            )}
          </Panel>
          <Panel title={t(M.media)} description={t(M.mediaHint, { n: d.media })}>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {Array.from({ length: d.media }).map((_, i) => (
                <PhotoPlaceholder key={i} className="aspect-square" label={i === 0 ? t(M.cover) : `0${i + 1}`}>
                  <button
                    type="button"
                    aria-label={t(C.remove)}
                    onClick={() => patch({ media: d.media - 1 })}
                    className="absolute right-1 top-1 rounded-sm bg-card p-1"
                  >
                    <X className="size-3" />
                  </button>
                </PhotoPlaceholder>
              ))}
              {d.media < 12 && (
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
          <Panel title={t(M.data)} bodyClassName="flex flex-col gap-4">
            <Field label={t(C.name)} htmlFor="name">
              <LTextInput id="name" value={d.name} onChange={(v) => patch({ name: v })} />
            </Field>
            <Field label={t(C.category)}>
              <Select value={d.categoryId} onValueChange={(v) => patch({ categoryId: v })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {db.categories
                    .filter((c) => c.kind === "service")
                    .sort((a, b) => a.order - b.order)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {tx(c.name)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t(M.basePrice)} htmlFor="price">
                <Input id="price" inputMode="decimal" value={price} onChange={(e) => (setPrice(e.target.value), setDirty(true))} />
              </Field>
              <Field label={t(C.duration)} hint={t(M.durationHint)} htmlFor="dur">
                <Input id="dur" value={dur} onChange={(e) => (setDur(e.target.value), setDirty(true))} />
              </Field>
            </div>
            <Field label={t(M.summary)} hint={`${tx(d.summary).length}/160`} htmlFor="summary">
              <LTextInput id="summary" value={d.summary} maxLength={160} onChange={(v) => patch({ summary: v })} />
            </Field>
          </Panel>

          <Panel title={t(M.units)} description={t(M.soldIn, { a: d.units.length, b: db.units.length })}>
            <div className="mb-4 flex flex-wrap gap-2">
              {missingUnits.map((u) => (
                <Button key={u.id} size="sm" variant="outline" onClick={() => patch({ units: [...d.units, { unitId: u.id, price: null, professionalIds: [] }] })}>
                  <Plus /> {tx(u.name)}
                </Button>
              ))}
              {missingUnits.length > 1 && (
                <Button size="sm" variant="outline" onClick={() => patch({ units: [...d.units, ...missingUnits.map((u) => ({ unitId: u.id, price: null, professionalIds: [] }))] })}>
                  {t(M.inAll)}
                </Button>
              )}
            </div>
            <div className="flex flex-col gap-4">
              {d.units.map((link, idx) => {
                const unit = db.units.find((u) => u.id === link.unitId);
                const pros = unitPros(link.unitId);
                return (
                  <div key={link.unitId} className="flex flex-col gap-3 rounded-sm border border-hairline p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{tx(unit?.name)}</span>
                      <Button variant="ghost" size="icon-sm" aria-label={t(M.removeUnit, { u: tx(unit?.name) })} onClick={() => patch({ units: d.units.filter((_, i) => i !== idx) })}>
                        <X />
                      </Button>
                    </div>
                    <Field label={t(M.priceHere)}>
                      <Input
                        inputMode="decimal"
                        placeholder={t(M.basePh, { v: price ? fmt.money(parseMoney(price) ?? 0) : "—" })}
                        value={link.price != null ? (link.price / 100).toFixed(2).replace(".", ",") : ""}
                        onChange={(e) => {
                          const v = e.target.value.trim() ? parseMoney(e.target.value) : null;
                          patch({ units: d.units.map((u, i) => (i === idx ? { ...u, price: v } : u)) });
                        }}
                      />
                    </Field>
                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                      {pros.length === 0 && <span className="text-sm text-ink-muted">{t(M.noPros)}</span>}
                      {pros.map((p) => (
                        <label key={p.id} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={link.professionalIds.includes(p.id)}
                            onCheckedChange={(on) =>
                              patch({
                                units: d.units.map((u, i) =>
                                  i === idx ? { ...u, professionalIds: on ? [...u.professionalIds, p.id] : u.professionalIds.filter((x) => x !== p.id) } : u,
                                ),
                              })
                            }
                          />
                          {p.firstName} {p.lastName}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-ink-muted">{t(M.unitsHint)}</p>
          </Panel>

          <Panel title={t(M.publication)}>
            <ToggleRow title={t(M.isNew)} checked={d.isNew} onChange={(v) => patch({ isNew: v })} />
            <ToggleRow title={t(M.favorites)} checked={d.allowFavorites} onChange={(v) => patch({ allowFavorites: v })} />
          </Panel>
        </div>
      </div>
    </>
  );
}
