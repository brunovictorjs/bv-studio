"use client";

import { ChevronLeft, Search } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { RoleGate } from "@/components/admin/shell";
import { cleanPair, LTextInput, toPair } from "@/components/content";
import { Field, Panel, Segmented } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useT, type Messages } from "@/i18n";
import { C } from "@/i18n/common";
import { useAction, useDb } from "@/lib/client/hooks";
import { discountFor, offerState, servicePriceAt } from "@/lib/domain/rules";
import { matches, parseMoney } from "@/lib/domain/text";
import { addDays, nowLocal } from "@/lib/domain/time";
import type { Offer } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

const M = {
  back: ["Ofertas", "Offers"],
  newTitle: ["Nova oferta", "New offer"],
  save: ["Salvar oferta", "Save offer"],
  unitHint: ["A oferta só vale e só aparece no site desta unidade.", "The offer only applies to and appears on this location's site."],
  type: ["Tipo de desconto", "Discount type"],
  percent: ["Percentual", "Percentage"],
  fixed: ["Valor fixo", "Fixed amount"],
  discount: ["Desconto", "Discount"],
  limit: ["Limite de usos", "Usage limit"],
  limitPh: ["sem limite", "no limit"],
  starts: ["Começa em", "Starts on"],
  ends: ["Termina em", "Ends on"],
  days: ["Dias válidos", "Valid days"],
  closedHint: ["Tracejados: dias em que a unidade fecha.", "Dashed: days the location is closed."],
  services: ["Serviços da unidade disponíveis", "Location services available"],
  count: ["{a} de {b} livres · {c} selecionado(s)", "{a} of {b} free · {c} selected"],
  servicesHint: ["Só aparecem serviços desta unidade que não estão em outra oferta ativa ou agendada.", "Only this location's services that aren't in another active or scheduled offer are available."],
  searchSvc: ["Buscar serviço pelo nome", "Search services by name"],
  allCats: ["Todas as categorias", "All categories"],
  onlySel: ["Só os selecionados", "Selected only"],
  priceHere: ["Preço aqui", "Price here"],
  withDiscount: ["Com desconto", "With discount"],
  taken: ["já em \"{o}\"", "already in \"{o}\""],
  select: ["Selecionar", "Select"],
  saved: ["Oferta salva.", "Offer saved."],
  invalidValue: ["Confira o valor do desconto.", "Check the discount value."],
} satisfies Messages;

export default function OfferEditorPage() {
  return (
    <RoleGate roles={["admin"]}>
      <OfferEditor />
    </RoleGate>
  );
}

function OfferEditor() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t, tx, fmt } = useT();
  const db = useDb();
  const { run, busy } = useAction("staff");
  const today = nowLocal().slice(0, 10);
  const existing = db?.offers.find((o) => o.id === id);
  const [d, setD] = useState<Omit<Offer, "uses" | "endedAt" | "id"> & { id: string | null }>(() =>
    existing
      ? { ...structuredClone(existing) }
      : {
          id: null,
          unitId: db?.units[0]?.id ?? "",
          name: { pt: "", en: "" },
          type: "percent",
          value: 15,
          usageLimit: null,
          start: today,
          end: addDays(today, 14),
          weekdays: [2, 3, 4],
          serviceIds: [],
        },
  );
  const [value, setValue] = useState(() => (existing ? (existing.type === "percent" ? String(existing.value) : (existing.value / 100).toFixed(2).replace(".", ",")) : "15"));
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [onlySel, setOnlySel] = useState(false);
  const patch = (p: Partial<typeof d>) => setD((x) => ({ ...x, ...p }));

  const taken = useMemo(() => {
    const m = new Map<string, Offer>();
    db?.offers.forEach((o) => {
      if (o.id === d.id || o.unitId !== d.unitId || offerState(o, today) === "ended" || o.start > d.end || o.end < d.start) return;
      o.serviceIds.forEach((s) => m.set(s, o));
    });
    return m;
  }, [db, d.id, d.unitId, d.start, d.end, today]);
  if (!db) return null;
  const unit = db.units.find((u) => u.id === d.unitId);
  const services = db.services.filter((s) => s.status === "active" && s.units.some((l) => l.unitId === d.unitId));
  const rows = services.filter((s) => matches(tx(s.name), q) && (cat === "all" || s.categoryId === cat) && (!onlySel || d.serviceIds.includes(s.id)));
  const numeric = d.type === "percent" ? Number(value.replace(",", ".")) : parseMoney(value) ?? 0;
  const preview = (price: number) => price - discountFor({ ...d, id: "", uses: 0, value: numeric }, price);

  const save = async () => {
    if (!numeric || numeric <= 0) return (await import("sonner")).toast.error(t(M.invalidValue));
    const r = await run<{ id: string }>("offer.save", { ...d, name: cleanPair(toPair(d.name)), value: numeric }, { success: t(M.saved) });
    if (r) router.push("/admin/offers");
  };

  return (
    <>
      <Link href="/admin/offers" className="flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ChevronLeft className="size-4" /> {t(M.back)}
      </Link>
      <header className="flex flex-wrap items-end justify-between gap-4" data-anim>
        <h1 className="text-3xl font-semibold tracking-[-0.02em]">{tx(d.name) || t(M.newTitle)}</h1>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/offers">{t(C.cancel)}</Link>
          </Button>
          <Button disabled={busy} onClick={save}>
            {t(M.save)}
          </Button>
        </div>
      </header>
      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <Panel bodyClassName="flex flex-col gap-4">
          <Field label={t(C.unit)} hint={t(M.unitHint)}>
            <Select value={d.unitId} onValueChange={(v) => patch({ unitId: v, serviceIds: [] })}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {db.units.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {tx(u.name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t(C.name)}>
            <LTextInput value={d.name} onChange={(v) => patch({ name: v })} />
          </Field>
          <Field label={t(M.type)}>
            <Segmented
              label={t(M.type)}
              value={d.type}
              onChange={(v) => patch({ type: v })}
              options={[
                { value: "percent", label: t(M.percent) },
                { value: "fixed", label: t(M.fixed) },
              ]}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`${t(M.discount)} ${d.type === "percent" ? "(%)" : ""}`}>
              <Input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
            </Field>
            <Field label={t(M.limit)}>
              <Input
                inputMode="numeric"
                placeholder={t(M.limitPh)}
                value={d.usageLimit ?? ""}
                onChange={(e) => patch({ usageLimit: e.target.value ? Math.max(1, Number(e.target.value.replace(/\D/g, ""))) : null })}
              />
            </Field>
            <Field label={t(M.starts)}>
              <Input type="date" value={d.start} onChange={(e) => patch({ start: e.target.value })} />
            </Field>
            <Field label={t(M.ends)}>
              <Input type="date" value={d.end} onChange={(e) => patch({ end: e.target.value })} />
            </Field>
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">{t(M.days)}</legend>
            <div className="flex flex-wrap gap-1.5">
              {[0, 1, 2, 3, 4, 5, 6].map((wd) => {
                const on = d.weekdays.includes(wd);
                const closed = !unit?.hours[wd]?.open;
                return (
                  <button
                    key={wd}
                    type="button"
                    aria-pressed={on}
                    onClick={() => patch({ weekdays: on ? d.weekdays.filter((x) => x !== wd) : [...d.weekdays, wd] })}
                    className={cn(
                      "h-10 min-w-12 rounded-sm border px-2 text-sm",
                      on ? "border-ink bg-ink text-surface-0" : "border-hairline",
                      closed && "border-dashed text-ink-muted",
                    )}
                  >
                    {fmt.weekdayName(wd)}
                  </button>
                );
              })}
            </div>
            <span className="text-xs text-ink-muted">{t(M.closedHint)}</span>
          </fieldset>
        </Panel>
        <Panel
          title={t(M.services)}
          description={t(M.count, { a: services.filter((s) => !taken.has(s.id)).length, b: services.length, c: d.serviceIds.length })}
        >
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <label className="flex h-10 min-w-56 flex-1 items-center gap-2 rounded-sm border border-input px-3">
              <Search className="size-4 text-ink-muted" />
              <input type="search" className="flex-1 bg-transparent outline-none" placeholder={t(M.searchSvc)} aria-label={t(M.searchSvc)} value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
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
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={onlySel} onCheckedChange={(v) => setOnlySel(!!v)} /> {t(M.onlySel)}
            </label>
          </div>
          <div className="overflow-x-auto">
            <Table className="min-w-[620px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <span className="sr-only">{t(M.select)}</span>
                  </TableHead>
                  <TableHead>{t(C.service)}</TableHead>
                  <TableHead>{t(C.category)}</TableHead>
                  <TableHead className="text-right">{t(M.priceHere)}</TableHead>
                  <TableHead className="text-right">{t(M.withDiscount)}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((s) => {
                  const on = d.serviceIds.includes(s.id);
                  const blocked = taken.get(s.id);
                  const price = servicePriceAt(s, d.unitId);
                  return (
                    <TableRow key={s.id} className={cn(on && "bg-muted", blocked && "text-ink-muted")}>
                      <TableCell>
                        <Checkbox
                          checked={on}
                          disabled={!!blocked}
                          aria-label={tx(s.name)}
                          onCheckedChange={(v) => patch({ serviceIds: v ? [...d.serviceIds, s.id] : d.serviceIds.filter((x) => x !== s.id) })}
                        />
                      </TableCell>
                      <TableCell className={cn(on && "font-medium")}>{tx(s.name)}</TableCell>
                      <TableCell>{tx(db.categories.find((c) => c.id === s.categoryId)?.name)}</TableCell>
                      <TableCell className="tabular text-right">{fmt.money(price)}</TableCell>
                      <TableCell className="tabular text-right">{blocked ? t(M.taken, { o: tx(blocked.name) }) : fmt.money(preview(price))}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <p className="mt-3 text-xs text-ink-muted">{t(M.servicesHint)}</p>
        </Panel>
      </div>
    </>
  );
}
