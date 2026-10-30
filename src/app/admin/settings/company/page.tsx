"use client";

import { useState } from "react";
import { RoleGate } from "@/components/admin/shell";
import { BrandMark } from "@/components/brand";
import { Field, Panel, Segmented } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT, type Messages } from "@/i18n";
import { useAction, useDb } from "@/lib/client/hooks";
import type { Settings } from "@/lib/domain/types";
import Link from "next/link";

const M = {
  save: ["Salvar alterações", "Save changes"],
  saved: ["Dados salvos.", "Details saved."],
  unsaved: ["alterações não salvas", "unsaved changes"],
  ident: ["Identificação", "Identification"],
  name: ["Nome fantasia", "Trade name"],
  legal: ["Razão social", "Legal name"],
  tax: ["CNPJ", "Tax ID"],
  cityReg: ["Inscrição municipal", "City registration"],
  email: ["E-mail público", "Public email"],
  insta: ["Instagram da marca", "Brand Instagram"],
  perUnit: ["Endereço, telefone, horário e frase da capa são de cada unidade:", "Address, phone, hours and cover line belong to each location:"],
  perUnitLink: ["configure em Unidades", "set them in Locations"],
  addresses: ["Endereços no site", "Site addresses"],
  domain: ["Domínio", "Domain"],
  pick: ["Escolha a unidade", "Pick a location"],
  addrHint: [
    "Cada unidade tem sua vitrine, catálogo, ofertas e avaliações. A IA manda o link da unidade certa para o cliente agendar.",
    "Each location has its own storefront, catalog, offers and reviews. The AI sends the right location link so the client can book.",
  ],
  brand: ["Marca", "Brand"],
  replaceLogo: ["Substituir logo", "Replace logo"],
  logoHint: ["PNG ou SVG com fundo transparente. Na demo, a marca é a do BV.", "PNG or SVG with a transparent background. In the demo, the brand is BV's."],
  currency: ["Moeda", "Currency"],
  auto: ["Pelo idioma", "By language"],
  currencyHint: ["\"Pelo idioma\" mostra R$ em português e US$ em inglês.", "\"By language\" shows R$ in Portuguese and US$ in English."],
  where: ["Onde esses dados aparecem", "Where this shows up"],
  whereBody: ["Rodapé do site, rodapé dos e-mails, comprovantes e a apresentação da assistente no WhatsApp.", "Site footer, email footer, receipts and the assistant's WhatsApp introduction."],
} satisfies Messages;

export default function CompanyPage() {
  return (
    <RoleGate roles={["admin"]}>
      <Company />
    </RoleGate>
  );
}

function Company() {
  const { t, tx } = useT();
  const db = useDb();
  const { run, busy } = useAction("staff");
  const [c, setC] = useState<Settings["company"] | null>(db ? { ...db.settings.company } : null);
  const [dirty, setDirty] = useState(false);
  if (!db || !c) return null;
  const set = (p: Partial<Settings["company"]>) => {
    setC({ ...c, ...p });
    setDirty(true);
  };
  const field = (k: keyof Settings["company"], label: string, type = "text") => (
    <Field label={label}>
      <Input type={type} value={c[k]} onChange={(e) => set({ [k]: e.target.value })} />
    </Field>
  );
  return (
    <>
      <div className="flex items-center justify-end gap-3" data-anim>
        {dirty && <span className="bv-label">{t(M.unsaved)}</span>}
        <Button disabled={busy || !dirty} onClick={() => run("settings.save", { section: "company", value: c }, { success: t(M.saved) }).then((r) => r && setDirty(false))}>
          {t(M.save)}
        </Button>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title={t(M.ident)} bodyClassName="grid gap-4 sm:grid-cols-2">
          {field("name", t(M.name))}
          {field("legalName", t(M.legal))}
          {field("taxId", t(M.tax))}
          {field("cityReg", t(M.cityReg))}
          {field("email", t(M.email), "email")}
          {field("instagram", t(M.insta))}
          <p className="text-sm text-ink-muted sm:col-span-2">
            {t(M.perUnit)}{" "}
            <Link href="/admin/units" className="text-ink underline-offset-4 hover:underline">
              {t(M.perUnitLink)}
            </Link>
            .
          </p>
        </Panel>
        <Panel title={t(M.addresses)} bodyClassName="flex flex-col gap-4">
          {field("domain", t(M.domain))}
          <ul className="flex flex-col divide-y divide-hairline rounded-sm border border-hairline font-mono text-sm">
            <li className="flex justify-between p-3">
              <span>{c.domain}</span>
              <span className="text-ink-muted">{t(M.pick)}</span>
            </li>
            {db.units.map((u) => (
              <li key={u.id} className="flex justify-between p-3">
                <span>/{u.slug}</span>
                <span className="text-ink-muted">{tx(u.name)}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-ink-muted">{t(M.addrHint)}</p>
        </Panel>
        <Panel title={t(M.brand)} bodyClassName="flex flex-col gap-4">
          <div className="bv-gradient flex items-center justify-center rounded-md border border-hairline p-10">
            <BrandMark className="h-12" />
          </div>
          <Button variant="outline" className="self-start" disabled>
            {t(M.replaceLogo)}
          </Button>
          <p className="text-xs text-ink-muted">{t(M.logoHint)}</p>
          <Field label={t(M.currency)} hint={t(M.currencyHint)}>
            <Segmented
              label={t(M.currency)}
              value={c.currency}
              onChange={(v) => set({ currency: v })}
              options={[
                { value: "auto", label: t(M.auto) },
                { value: "BRL", label: "BRL" },
                { value: "USD", label: "USD" },
                { value: "EUR", label: "EUR" },
              ]}
            />
          </Field>
        </Panel>
        <Panel title={t(M.where)}>
          <p className="text-ink-muted">{t(M.whereBody)}</p>
        </Panel>
      </div>
    </>
  );
}
