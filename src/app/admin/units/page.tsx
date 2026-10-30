"use client";

import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { RoleGate, setAdminUnit } from "@/components/admin/shell";
import { Chip, PageHeader, Panel, StatusBadge } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useT, type Messages } from "@/i18n";
import { C } from "@/i18n/common";
import { useDb, useQ } from "@/lib/client/hooks";
import { matches } from "@/lib/domain/text";

const M = {
  eyebrow: ["Negócio · só administradores", "Business · admins only"],
  title: ["Unidades", "Locations"],
  description: [
    "Cada unidade tem endereço, horário, agenda, equipe, número de WhatsApp com IA e faturamento próprios. Serviços, produtos e categorias podem estar em mais de uma.",
    "Each location has its own address, hours, agenda, team, AI WhatsApp number and revenue. Services, products and categories can be in more than one.",
  ],
  new: ["Nova unidade", "New location"],
  search: ["Buscar por nome, endereço ou bairro", "Search by name, address or district"],
  active: ["Ativas", "Active"],
  inactive: ["Desligadas", "Turned off"],
  all: ["Todas", "All"],
  audience: ["Público", "Audience"],
  female: ["Feminino", "Women"],
  male: ["Masculino", "Men"],
  unisex: ["Unissex", "Unisex"],
  wa: ["WhatsApp", "WhatsApp"],
  connected: ["Conectado", "Connected"],
  disconnected: ["Desconectado", "Disconnected"],
  summary: ["{n} unidades · {o} abertas agora · {w} WhatsApp conectados", "{n} locations · {o} open now · {w} WhatsApp connected"],
  addrHours: ["Endereço e horário", "Address and hours"],
  waAi: ["WhatsApp com IA", "AI WhatsApp"],
  team: ["Equipe", "Team"],
  rev7: ["Faturamento · 7 dias", "Revenue · 7 days"],
  today: ["Hoje", "Today"],
  fwd: ["Encaminhadas", "Forwarded"],
  teamLine: ["{p} profissionais · {d} balconista", "{p} professionals · {d} front desk"],
  chairsLine: ["{c} cadeiras · {s} serviços", "{c} chairs · {s} services"],
  todayN: ["{n} atendimentos", "{n} services"],
  open: ["Aberta", "Open"],
  closedNow: ["Fechada agora", "Closed now"],
  off: ["Desligada", "Off"],
  configure: ["Configurar", "Configure"],
  agenda: ["Agenda", "Agenda"],
  chats: ["Conversas", "Chats"],
  split: ["Como as unidades se dividem", "How locations are split"],
  splitHint: ["O que é de cada uma e o que pode ser compartilhado.", "What belongs to each one and what can be shared."],
  only: ["Só de uma unidade", "One location only"],
  onlyBody: [
    "Profissionais, balconistas, horário de funcionamento, fechamentos, agenda da equipe, cadeiras, endereço, número do WhatsApp, pedidos, caixa, ofertas e exceções de comissão.",
    "Professionals, front desk, opening hours, closures, team schedule, chairs, address, WhatsApp number, orders, register, offers and commission exceptions.",
  ],
  many: ["Pode estar em várias", "Can be in several"],
  manyBody: ["Serviços, produtos e categorias. O preço pode mudar por unidade.", "Services, products and categories. Price can vary by location."],
  every: ["Vale para todas", "Applies to all"],
  everyBody: [
    "Conta do cliente, favoritos, pagamento (Stripe), políticas legais, comissões padrão e usuários administradores.",
    "Client account, favorites, payment (Stripe), legal policies, default commissions and admin users.",
  ],
} satisfies Messages;

export default function UnitsPage() {
  return (
    <RoleGate roles={["admin"]}>
      <Units />
    </RoleGate>
  );
}

function Units() {
  const { t, tx, fmt } = useT();
  const db = useDb();
  const { data } = useQ("unitsOverview", {}, "staff");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("active");
  const [aud, setAud] = useState("all");
  const [wa, setWa] = useState("all");
  if (!db) return null;
  const stat = (id: string) => data?.find((x) => x.id === id);
  const rows = db.units.filter(
    (u) =>
      (status === "all" || (status === "active" ? u.active : !u.active)) &&
      (aud === "all" || u.audience === aud) &&
      (wa === "all" || (wa === "on" ? u.whatsappConnected : !u.whatsappConnected)) &&
      matches(`${tx(u.name)} ${u.address} ${u.district}`, q),
  );
  const daysLabel = (days: number[]) => {
    if (!days.length) return "—";
    return days.length === 7 ? t(["Todos os dias", "Every day"]) : days.map((d) => fmt.weekdayName(d)).join(", ");
  };
  const sel = (value: string, onChange: (v: string) => void, opts: [string, string][], label: string) => (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {opts.map(([v, l]) => (
            <SelectItem key={v} value={v}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <>
      <PageHeader
        eyebrow={t(M.eyebrow)}
        title={t(M.title)}
        description={t(M.description)}
        actions={
          <Button asChild>
            <Link href="/admin/units/new">
              <Plus /> {t(M.new)}
            </Link>
          </Button>
        }
      />
      <section className="flex flex-wrap items-end gap-3" data-anim>
        <label className="flex h-10 min-w-72 items-center gap-2 rounded-sm border border-input px-3">
          <Search className="size-4 text-ink-muted" />
          <input type="search" className="flex-1 bg-transparent outline-none" placeholder={t(M.search)} aria-label={t(M.search)} value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        {sel(status, setStatus, [["active", t(M.active)], ["inactive", t(M.inactive)], ["all", t(M.all)]], t(C.status))}
        {sel(aud, setAud, [["all", t(C.all)], ["female", t(M.female)], ["male", t(M.male)], ["unisex", t(M.unisex)]], t(M.audience))}
        {sel(wa, setWa, [["all", t(C.all)], ["on", t(M.connected)], ["off", t(M.disconnected)]], t(M.wa))}
      </section>
      <Panel
        title={t(M.summary, {
          n: rows.length,
          o: data?.filter((x) => x.openNow).length ?? 0,
          w: db.units.filter((u) => u.whatsappConnected).length,
        })}
      >
        <div className="overflow-x-auto">
          <Table className="min-w-[1100px]">
            <TableHeader>
              <TableRow>
                <TableHead>{t(C.unit)}</TableHead>
                <TableHead>{t(M.addrHours)}</TableHead>
                <TableHead>{t(M.waAi)}</TableHead>
                <TableHead>{t(M.team)}</TableHead>
                <TableHead className="text-right">{t(M.rev7)}</TableHead>
                <TableHead>{t(M.today)}</TableHead>
                <TableHead>{t(M.fwd)}</TableHead>
                <TableHead>{t(C.status)}</TableHead>
                <TableHead>
                  <span className="sr-only">{t(C.actions)}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((u) => {
                const s = stat(u.id);
                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span className="flex size-9 items-center justify-center rounded-sm bg-ink font-mono text-surface-0">{tx(u.name).slice(0, 1)}</span>
                        <div className="flex flex-col">
                          <span className="font-medium">{tx(u.name)}</span>
                          <span className="text-xs text-ink-muted">
                            {tx(u.kind)} · /{u.slug}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className="block">{u.address}</span>
                      <span className="text-xs text-ink-muted">{s ? daysLabel(s.openDays) : ""}</span>
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className="block font-mono">{u.whatsapp}</span>
                      <span className="text-xs text-ink-muted">{u.whatsappConnected ? t(M.connected) : t(M.disconnected)}</span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {s && (
                        <>
                          <span className="block">{t(M.teamLine, { p: s.pros, d: s.desks })}</span>
                          <span className="text-xs text-ink-muted">{t(M.chairsLine, { c: u.chairs, s: s.services })}</span>
                        </>
                      )}
                    </TableCell>
                    <TableCell className="tabular text-right">{s ? fmt.money(s.revenue7) : "—"}</TableCell>
                    <TableCell className="text-sm">{s ? t(M.todayN, { n: s.today }) : ""}</TableCell>
                    <TableCell>{s && s.forwarded > 0 ? <Chip active>{s.forwarded}</Chip> : <span className="text-ink-muted">0</span>}</TableCell>
                    <TableCell>
                      <StatusBadge state={!u.active ? "cancelled" : s?.openNow ? "in_service" : "completed"}>
                        {!u.active ? t(M.off) : s?.openNow ? t(M.open) : t(M.closedNow)}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-end gap-1 text-sm">
                        <Link href={`/admin/units/${u.id}`} className="underline-offset-4 hover:underline">
                          {t(M.configure)}
                        </Link>
                        <Link href="/admin/agenda" onClick={() => setAdminUnit(u.id)} className="text-ink-muted underline-offset-4 hover:underline">
                          {t(M.agenda)}
                        </Link>
                        <Link href="/admin/conversations" onClick={() => setAdminUnit(u.id)} className="text-ink-muted underline-offset-4 hover:underline">
                          {t(M.chats)}
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Panel>
      <Panel title={t(M.split)} description={t(M.splitHint)}>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            [M.only, M.onlyBody],
            [M.many, M.manyBody],
            [M.every, M.everyBody],
          ].map(([h, b], i) => (
            <div key={i} className="flex flex-col gap-2 border-t border-ink pt-3">
              <span className="font-mono text-xs text-ink-muted">0{i + 1}</span>
              <span className="bv-label text-ink">{t(h)}</span>
              <p className="text-sm text-ink-muted">{t(b)}</p>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}
