"use client";

import { ChevronLeft, Plus, Search, X } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ConflictList, HoursEditor } from "@/components/admin/hours-editor";
import { RoleGate } from "@/components/admin/shell";
import { cleanPair, LTextInput, toPair } from "@/components/content";
import { Avatar, Chip, Field, Panel, Row, Segmented, ToggleRow } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useT, type Messages } from "@/i18n";
import { C, ROLE } from "@/i18n/common";
import { conflictList, useAction, useDb } from "@/lib/client/hooks";
import type { ApiError } from "@/lib/client/api";
import { productPriceAt, servicePriceAt } from "@/lib/domain/rules";
import { matches, parseMoney } from "@/lib/domain/text";
import { nowLocal } from "@/lib/domain/time";
import type { Unit } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

const M = {
  back: ["Unidades", "Locations"],
  newTitle: ["Nova unidade", "New location"],
  unsaved: ["Alterações não salvas", "Unsaved changes"],
  saveUnit: ["Salvar unidade", "Save location"],
  sData: ["Dados e local", "Details and place"],
  sHours: ["Horário e fechamentos", "Hours and closures"],
  sCatalog: ["Catálogo da unidade", "Location catalog"],
  sTeam: ["Equipe", "Team"],
  sWa: ["WhatsApp e IA", "WhatsApp and AI"],
  ident: ["Identificação", "Identification"],
  unitName: ["Nome da unidade", "Location name"],
  slug: ["Endereço no site", "Site address"],
  kind: ["Descrição curta", "Short description"],
  audience: ["Público", "Audience"],
  female: ["Feminino", "Women"],
  male: ["Masculino", "Men"],
  unisex: ["Unissex", "Unisex"],
  tagline: ["Frase da capa", "Cover line"],
  phone: ["Telefone da recepção", "Front desk phone"],
  instagram: ["Instagram", "Instagram"],
  active: ["Unidade ativa", "Location active"],
  activeHint: ["Desligada, some do site e a IA para de responder neste número.", "When off, it disappears from the site and the AI stops replying on this number."],
  where: ["Onde fica", "Where it is"],
  address: ["Endereço", "Address"],
  zip: ["CEP", "ZIP"],
  district: ["Bairro", "District"],
  city: ["Cidade/UF", "City/State"],
  coords: ["Coordenadas", "Coordinates"],
  coordsHint: ["No Google Maps, clique com o botão direito no local e copie \"latitude, longitude\".", "In Google Maps, right-click the place and copy \"latitude, longitude\"."],
  opening: ["Horário de funcionamento", "Opening hours"],
  openingHint: ["Vale só para esta unidade. A agenda da equipe é recortada por ele.", "Applies to this location only. The team schedule is clipped by it."],
  chairs: ["Cadeiras", "Chairs"],
  tolerance: ["Tolerância de atraso (min)", "Late tolerance (min)"],
  toleranceHint: ["Depois disso, o pedido vira falta.", "After that, the order becomes a no-show."],
  hold: ["Segurar horário enquanto paga (min)", "Hold time while paying (min)"],
  closures: ["Fechamentos previstos", "Planned closures"],
  addClosure: ["Adicionar fechamento", "Add closure"],
  label: ["Motivo", "Reason"],
  catalogHint: ["Marque o que é vendido aqui. O mesmo serviço pode estar nas duas unidades com preço diferente.", "Check what's sold here. The same service can be in several locations with different prices."],
  services: ["Serviços", "Services"],
  products: ["Produtos", "Products"],
  inHere: ["Nesta unidade", "Here"],
  outside: ["Fora dela", "Not here"],
  basePrice: ["Preço base", "Base price"],
  priceHere: ["Preço aqui", "Price here"],
  alsoIn: ["Também em", "Also in"],
  usesBase: ["usa o base", "uses base"],
  searchCat: ["Buscar serviço ou produto", "Search services or products"],
  teamHint: [
    "Cada profissional trabalha em uma unidade só. Para transferir, remarque ou cancele os atendimentos futuros dele aqui; o sistema avisa se houver algum.",
    "Each professional works at one location only. To transfer, reschedule or cancel their future bookings first; the system warns if there are any.",
  ],
  transfer: ["Transferir para…", "Transfer to…"],
  transferred: ["Transferido.", "Transferred."],
  addPerson: ["Adicionar pessoa", "Add person"],
  waConnected: ["Conectado", "Connected"],
  waDisconnected: ["Desconectado", "Disconnected"],
  waNumber: ["Número da unidade", "Location number"],
  waInstance: ["Instância", "Instance"],
  waToday: ["Hoje", "Today"],
  waTodayVal: ["{n} conversas · {f} encaminhadas", "{n} chats · {f} forwarded"],
  waHint: [
    "A IA só fala dos serviços, produtos, horários e pedidos desta unidade. Token e ID da instância ficam guardados no servidor e nunca aparecem aqui.",
    "The AI only talks about this location's services, products, hours and orders. Instance token and ID stay on the server and never show up here.",
  ],
  configureAi: ["Configurar assistente", "Configure assistant"],
  reconnect: ["Reconectar (QR)", "Reconnect (QR)"],
  disconnect: ["Desconectar", "Disconnect"],
  saved: ["Unidade salva.", "Location saved."],
  saveFirst: ["Salve a unidade antes de montar o catálogo e a equipe.", "Save the location before setting up its catalog and team."],
  conflictTitle: ["Há clientes marcados", "There are booked clients"],
} satisfies Messages;

const blank = (): Omit<Unit, "id" | "whatsappConnected" | "whatsappInstance" | "ai"> => ({
  slug: "",
  name: { pt: "", en: "" },
  kind: { pt: "", en: "" },
  audience: "unisex",
  tagline: { pt: "", en: "" },
  phone: "",
  whatsapp: "",
  instagram: "",
  address: "",
  district: "",
  city: "",
  zip: "",
  coords: "",
  active: true,
  chairs: 3,
  hours: [0, 1, 2, 3, 4, 5, 6].map((d) => ({ open: d !== 0, start: "09:00", end: "19:00", breakStart: "12:30", breakEnd: "13:30" })),
  closures: [],
  lateToleranceMin: 90,
  holdMinutes: 10,
});

export default function UnitEditorPage() {
  return (
    <RoleGate roles={["admin"]}>
      <UnitEditor />
    </RoleGate>
  );
}

function UnitEditor() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t, tx, fmt } = useT();
  const db = useDb();
  const { run, busy } = useAction("staff");
  const existing = db?.units.find((u) => u.id === id);
  const [d, setD] = useState(() => (existing ? structuredClone(existing) : { ...blank(), id: null as string | null }));
  const [dirty, setDirty] = useState(false);
  const [conflicts, setConflicts] = useState<ReturnType<typeof conflictList>>([]);
  const [catTab, setCatTab] = useState<"service" | "product">("service");
  const [catFilter, setCatFilter] = useState<"in" | "out" | "all">("all");
  const [catQ, setCatQ] = useState("");
  if (!db) return null;
  const patch = (p: Partial<typeof d>) => {
    setD((x) => ({ ...x, ...p }));
    setDirty(true);
  };
  const unitId = existing?.id ?? null;

  const save = async () => {
    setConflicts([]);
    const r = await run<{ id: string }>(
      "unit.save",
      {
        ...d,
        id: unitId,
        name: cleanPair(toPair(d.name)),
        kind: cleanPair(toPair(d.kind)),
        tagline: cleanPair(toPair(d.tagline)),
        slug: d.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      },
      { success: t(M.saved), onError: (e: ApiError) => setConflicts(conflictList(e)) },
    );
    if (r) {
      setDirty(false);
      if (!unitId) router.replace(`/admin/units/${r.id}`);
    }
  };

  const team = unitId ? db.users.filter((u) => u.unitId === unitId && (u.roles.includes("professional") || u.roles.includes("desk")) && u.status !== "disabled") : [];
  const items =
    catTab === "service"
      ? db.services
          .filter((s) => s.status !== "archived")
          .map((s) => ({ id: s.id, name: tx(s.name), cat: s.categoryId, base: s.price, link: s.units.find((u) => u.unitId === unitId), others: s.units.filter((u) => u.unitId !== unitId), price: unitId ? servicePriceAt(s, unitId) : s.price }))
      : db.products.map((p) => ({ id: p.id, name: tx(p.name), cat: p.categoryId, base: p.price, link: p.units.find((u) => u.unitId === unitId), others: p.units.filter((u) => u.unitId !== unitId), price: unitId ? productPriceAt(p, unitId) : p.price }));
  const shown = items.filter((i) => matches(i.name, catQ) && (catFilter === "all" || (catFilter === "in" ? !!i.link : !i.link)));
  const convToday = unitId ? db.conversations.filter((c) => c.unitId === unitId && c.updatedAt.slice(0, 10) === nowLocal().slice(0, 10)) : [];

  const sections = [
    ["data", M.sData],
    ["hours", M.sHours],
    ["catalog", M.sCatalog],
    ["team", M.sTeam],
    ["wa", M.sWa],
  ] as const;

  return (
    <>
      <Link href="/admin/units" className="flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ChevronLeft className="size-4" /> {t(M.back)}
      </Link>
      <header className="flex flex-wrap items-end justify-between gap-4" data-anim>
        <div className="flex flex-col gap-1">
          {dirty && <span className="bv-label">{t(M.unsaved)}</span>}
          <h1 className="text-3xl font-semibold tracking-[-0.02em]">{tx(d.name) || t(M.newTitle)}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={!dirty} onClick={() => (setD(existing ? structuredClone(existing) : { ...blank(), id: null }), setDirty(false))}>
            {t(C.discard)}
          </Button>
          <Button disabled={busy} onClick={save}>
            {t(M.saveUnit)}
          </Button>
        </div>
      </header>
      <nav className="sticky top-11 z-20 -mx-1 flex gap-1 overflow-x-auto border-b border-hairline bg-surface-0/95 px-1 py-2 backdrop-blur" aria-label={t(M.sData)}>
        {sections.map(([anchor, label]) => (
          <a key={anchor} href={`#${anchor}`} className="whitespace-nowrap rounded-sm px-3 py-1.5 text-sm text-ink-muted hover:bg-muted hover:text-ink">
            {t(label)}
          </a>
        ))}
      </nav>
      {conflicts.length > 0 && (
        <div className="rounded-md border border-dashed border-ink p-4" role="alert">
          <span className="font-medium">{t(M.conflictTitle)}</span>
          <ConflictList items={conflicts} />
        </div>
      )}

      <div id="data" className="grid scroll-mt-28 gap-6 xl:grid-cols-2">
        <Panel title={t(M.ident)} bodyClassName="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t(M.unitName)}>
              <LTextInput value={d.name} onChange={(v) => patch({ name: v })} />
            </Field>
            <Field label={t(M.slug)} hint={`${db.settings.company.domain}/${d.slug || "…"}`}>
              <Input value={d.slug} onChange={(e) => patch({ slug: e.target.value })} className="mt-7" />
            </Field>
          </div>
          <Field label={t(M.kind)}>
            <LTextInput value={d.kind} onChange={(v) => patch({ kind: v })} />
          </Field>
          <Field label={t(M.audience)}>
            <Segmented
              label={t(M.audience)}
              value={d.audience}
              onChange={(v) => patch({ audience: v })}
              options={[
                { value: "female", label: t(M.female) },
                { value: "male", label: t(M.male) },
                { value: "unisex", label: t(M.unisex) },
              ]}
            />
          </Field>
          <Field label={t(M.tagline)}>
            <LTextInput value={d.tagline} onChange={(v) => patch({ tagline: v })} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t(M.phone)}>
              <Input type="tel" value={d.phone} onChange={(e) => patch({ phone: e.target.value })} />
            </Field>
            <Field label={t(M.instagram)}>
              <Input value={d.instagram} onChange={(e) => patch({ instagram: e.target.value })} />
            </Field>
          </div>
          <ToggleRow title={t(M.active)} description={t(M.activeHint)} checked={d.active} onChange={(v) => patch({ active: v })} />
        </Panel>
        <Panel title={t(M.where)} bodyClassName="flex flex-col gap-4">
          <Field label={t(M.address)}>
            <Input value={d.address} onChange={(e) => patch({ address: e.target.value })} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t(M.zip)}>
              <Input value={d.zip} onChange={(e) => patch({ zip: e.target.value })} />
            </Field>
            <Field label={t(M.district)}>
              <Input value={d.district} onChange={(e) => patch({ district: e.target.value })} />
            </Field>
            <Field label={t(M.city)}>
              <Input value={d.city} onChange={(e) => patch({ city: e.target.value })} />
            </Field>
          </div>
          <Field label={t(M.coords)} hint={t(M.coordsHint)}>
            <Input value={d.coords} onChange={(e) => patch({ coords: e.target.value })} className="font-mono" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t(M.chairs)}>
              <Input type="number" min={1} value={d.chairs} onChange={(e) => patch({ chairs: Math.max(1, Number(e.target.value)) })} />
            </Field>
            <Field label={t(M.tolerance)} hint={t(M.toleranceHint)}>
              <Input type="number" min={0} value={d.lateToleranceMin} onChange={(e) => patch({ lateToleranceMin: Number(e.target.value) })} />
            </Field>
            <Field label={t(M.hold)}>
              <Input type="number" min={5} value={d.holdMinutes} onChange={(e) => patch({ holdMinutes: Number(e.target.value) })} />
            </Field>
          </div>
        </Panel>
      </div>

      <div id="hours" className="scroll-mt-28">
        <Panel title={t(M.opening)} description={t(M.openingHint)}>
          <HoursEditor value={d.hours} onChange={(hours) => patch({ hours })} />
          <div className="mt-6 flex flex-col gap-3">
            <span className="bv-label">{t(M.closures)}</span>
            {d.closures.map((c, i) => (
              <div key={c.id} className="flex flex-wrap items-end gap-2">
                <Field label={t(C.from)}>
                  <Input type="date" value={c.start} onChange={(e) => patch({ closures: d.closures.map((x, k) => (k === i ? { ...x, start: e.target.value } : x)) })} />
                </Field>
                <Field label={t(C.to)}>
                  <Input type="date" value={c.end} onChange={(e) => patch({ closures: d.closures.map((x, k) => (k === i ? { ...x, end: e.target.value } : x)) })} />
                </Field>
                <Field label={t(M.label)} className="min-w-48 flex-1">
                  <Input value={tx(c.label)} onChange={(e) => patch({ closures: d.closures.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)) })} />
                </Field>
                <Button variant="ghost" size="icon" aria-label={t(C.remove)} onClick={() => patch({ closures: d.closures.filter((_, k) => k !== i) })}>
                  <X />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => {
                const today = nowLocal().slice(0, 10);
                patch({ closures: [...d.closures, { id: `cl-${Date.now()}`, start: today, end: today, label: "" }] });
              }}
            >
              <Plus /> {t(M.addClosure)}
            </Button>
          </div>
        </Panel>
      </div>

      <div id="catalog" className="scroll-mt-28">
        <Panel title={t(M.sCatalog)} description={t(M.catalogHint)}>
          {!unitId ? (
            <p className="text-ink-muted">{t(M.saveFirst)}</p>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Segmented
                  label={t(M.sCatalog)}
                  value={catTab}
                  onChange={setCatTab}
                  options={[
                    { value: "service", label: `${t(M.services)} · ${db.services.filter((s) => s.units.some((u) => u.unitId === unitId)).length}` },
                    { value: "product", label: `${t(M.products)} · ${db.products.filter((p) => p.units.some((u) => u.unitId === unitId)).length}` },
                  ]}
                />
                <Segmented
                  label={t(C.status)}
                  value={catFilter}
                  onChange={setCatFilter}
                  options={[
                    { value: "in", label: t(M.inHere) },
                    { value: "out", label: t(M.outside) },
                    { value: "all", label: t(C.all) },
                  ]}
                />
                <label className="flex h-10 min-w-56 flex-1 items-center gap-2 rounded-sm border border-input px-3">
                  <Search className="size-4 text-ink-muted" />
                  <input className="flex-1 bg-transparent outline-none" placeholder={t(M.searchCat)} aria-label={t(M.searchCat)} value={catQ} onChange={(e) => setCatQ(e.target.value)} />
                </label>
              </div>
              <div className="overflow-x-auto">
                <Table className="min-w-[720px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <span className="sr-only">{t(M.inHere)}</span>
                      </TableHead>
                      <TableHead>{catTab === "service" ? t(C.service) : t(C.product)}</TableHead>
                      <TableHead>{t(C.category)}</TableHead>
                      <TableHead className="text-right">{t(M.basePrice)}</TableHead>
                      <TableHead>{t(M.priceHere)}</TableHead>
                      <TableHead>{t(M.alsoIn)}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shown.map((i) => (
                      <TableRow key={i.id} className={cn(!i.link && "text-ink-muted")}>
                        <TableCell>
                          <Checkbox
                            checked={!!i.link}
                            aria-label={`${i.name} · ${t(M.inHere)}`}
                            onCheckedChange={(on) => run("unit.catalogToggle", { unitId, kind: catTab, refId: i.id, on: !!on })}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{i.name}</TableCell>
                        <TableCell>{tx(db.categories.find((c) => c.id === i.cat)?.name)}</TableCell>
                        <TableCell className="tabular text-right">{fmt.money(i.base)}</TableCell>
                        <TableCell>
                          {i.link ? (
                            <Input
                              className="h-8 w-28"
                              inputMode="decimal"
                              aria-label={`${t(M.priceHere)} · ${i.name}`}
                              placeholder={t(M.usesBase)}
                              defaultValue={i.link.price != null ? (i.link.price / 100).toFixed(2).replace(".", ",") : ""}
                              onBlur={(e) => {
                                const v = e.target.value.trim() ? parseMoney(e.target.value) : null;
                                if (v !== (i.link?.price ?? null)) void run("unit.catalogToggle", { unitId, kind: catTab, refId: i.id, on: true, price: v });
                              }}
                            />
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {i.others.length === 0
                              ? "—"
                              : i.others.map((o) => (
                                  <Chip key={o.unitId}>
                                    {tx(db.units.find((u) => u.id === o.unitId)?.name)}
                                    {o.price != null && ` · ${fmt.money(o.price)}`}
                                  </Chip>
                                ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </Panel>
      </div>

      <div id="team" className="grid scroll-mt-28 gap-6 xl:grid-cols-2">
        <Panel
          title={t(M.sTeam)}
          actions={
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/users?invite=1">
                <Plus /> {t(M.addPerson)}
              </Link>
            </Button>
          }
        >
          {!unitId ? (
            <p className="text-ink-muted">{t(M.saveFirst)}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-hairline">
              {team.map((u) => (
                <li key={u.id} className="flex flex-wrap items-center gap-3 py-3">
                  <Avatar name={`${u.firstName} ${u.lastName}`} />
                  <span className="flex flex-1 flex-col">
                    <span className="font-medium">
                      {u.firstName} {u.lastName}
                    </span>
                    <span className="text-xs text-ink-muted">
                      {u.roles
                        .filter((r) => r !== "client")
                        .map((r) => t(ROLE[r]))
                        .join(" · ")}
                    </span>
                  </span>
                  <Select
                    value=""
                    onValueChange={async (to) => {
                      setConflicts([]);
                      await run("user.transfer", { id: u.id, unitId: to }, { success: t(M.transferred), onError: (e) => setConflicts(conflictList(e)) });
                    }}
                  >
                    <SelectTrigger className="w-44" size="sm">
                      <SelectValue placeholder={t(M.transfer)} />
                    </SelectTrigger>
                    <SelectContent>
                      {db.units
                        .filter((x) => x.id !== unitId)
                        .map((x) => (
                          <SelectItem key={x.id} value={x.id}>
                            {tx(x.name)}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-ink-muted">{t(M.teamHint)}</p>
        </Panel>
        <div id="wa" className="scroll-mt-28">
          <Panel title={t(M.sWa)}>
            {existing ? (
              <>
                <Chip active={existing.whatsappConnected} className="mb-3">
                  ● {existing.whatsappConnected ? t(M.waConnected) : t(M.waDisconnected)}
                </Chip>
                <div className="flex flex-col divide-y divide-hairline text-sm">
                  <Row label={t(M.waNumber)} value={<span className="font-mono">{existing.whatsapp}</span>} />
                  <Row label={t(M.waInstance)} value={<span className="font-mono">Z-API · {existing.whatsappInstance}</span>} />
                  <Row label={t(M.waToday)} value={t(M.waTodayVal, { n: convToday.length, f: convToday.filter((c) => c.forwardedAt).length })} />
                </div>
                <p className="my-3 text-xs text-ink-muted">{t(M.waHint)}</p>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href="/admin/assistant">{t(M.configureAi)} →</Link>
                  </Button>
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => run("unit.whatsapp", { unitId: existing.id, connected: !existing.whatsappConnected })}>
                    {existing.whatsappConnected ? t(M.disconnect) : t(M.reconnect)}
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-ink-muted">{t(M.saveFirst)}</p>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
