"use client";

import { Download, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { downloadCsv } from "@/components/admin/period";
import { RoleGate } from "@/components/admin/shell";
import { Empty, Field, PageHeader, Pager, Panel, StatusBadge } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useT, type Messages } from "@/i18n";
import { C, METHOD, STATUS } from "@/i18n/common";
import { useDb, useQ, useStaff } from "@/lib/client/hooks";
import { addDays, nowLocal } from "@/lib/domain/time";
import { cn } from "@/lib/utils";

const M = {
  eyebrow: ["Operação", "Operations"],
  title: ["Pedidos", "Orders"],
  search: ["Código, cliente ou telefone", "Code, client or phone"],
  origin: ["Origem", "Source"],
  siteWalkin: ["Site e avulso", "Site and walk-in"],
  site: ["Site", "Site"],
  walkin: ["Avulso", "Walk-in"],
  summary: ["{n} pedidos · {v}", "{n} orders · {v}"],
  items: ["Itens", "Items"],
  time: ["Horário", "Time"],
  pickup: ["retirada", "pickup"],
  filterStatus: ["Filtrar por situação", "Filter by status"],
} satisfies Messages;

const STATUSES = ["all", "cart", "awaiting_payment", "paid", "in_service", "completed", "cancelled", "no_show"] as const;

export default function OrdersPage() {
  return (
    <RoleGate roles={["admin", "desk"]}>
      <Orders />
    </RoleGate>
  );
}

function Orders() {
  const { t, tx, fmt } = useT();
  const db = useDb();
  const me = useStaff();
  const today = nowLocal().slice(0, 10);
  const isAdmin = !!me?.roles.includes("admin");
  const [f, setF] = useState({
    q: "",
    from: addDays(today, -7),
    to: addDays(today, 14),
    unitId: "all",
    proId: "all",
    serviceId: "all",
    method: "all",
    origin: "all",
    status: "all",
    page: 1,
  });
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, page: 1, ...patch }));
  const { data } = useQ("ordersList", f, "staff");
  const unitIds = isAdmin ? (f.unitId === "all" ? db?.units.map((u) => u.id) : [f.unitId]) : [me?.unitId];
  const pros = db?.users.filter((u) => u.roles.includes("professional") && unitIds?.includes(u.unitId ?? "")) ?? [];
  const services = db?.services.filter((s) => s.units.some((l) => unitIds?.includes(l.unitId))) ?? [];
  const unitName = (id: string) => tx(db?.units.find((u) => u.id === id)?.name);

  const exportCsv = () =>
    data &&
    downloadCsv(`pedidos-${f.from}-${f.to}.csv`, [
      [t(C.code), t(C.unit), t(C.client), t(M.items), t(C.professional), t(M.time), t(C.payment), t(C.status), t(C.total)],
      ...data.rows.map((r) => [
        r.code,
        unitName(r.unitId),
        r.client,
        r.items.map((i) => tx(i)).join(" + "),
        r.pro ?? "",
        r.start ?? "",
        r.methods.map((m) => t(METHOD[m])).join(" + "),
        t(STATUS[r.state] ?? STATUS[r.status]),
        r.total / 100,
      ]),
    ]);

  const select = (label: string, value: string, onChange: (v: string) => void, options: { value: string; label: string }[], w = "w-44") => (
    <Field label={label}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className={w}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );

  return (
    <>
      <PageHeader
        eyebrow={t(M.eyebrow)}
        title={t(M.title)}
        actions={
          <>
            <label className="flex h-10 min-w-64 items-center gap-2 rounded-sm border border-input px-3">
              <Search className="size-4 text-ink-muted" />
              <input type="search" className="flex-1 bg-transparent outline-none" placeholder={t(M.search)} aria-label={t(M.search)} value={f.q} onChange={(e) => set({ q: e.target.value })} />
            </label>
            <Button variant="outline" onClick={exportCsv}>
              <Download /> {t(C.exportCsv)}
            </Button>
          </>
        }
      />
      <section className="flex flex-wrap items-end gap-3 rounded-md border border-hairline bg-card p-4" data-anim>
        <Field label={t(C.from)}>
          <Input type="date" value={f.from} onChange={(e) => set({ from: e.target.value })} className="w-40" />
        </Field>
        <Field label={t(C.to)}>
          <Input type="date" value={f.to} onChange={(e) => set({ to: e.target.value })} className="w-40" />
        </Field>
        {isAdmin &&
          select(t(C.unit), f.unitId, (v) => set({ unitId: v, proId: "all", serviceId: "all" }), [
            { value: "all", label: t(C.all) },
            ...(db?.units.map((u) => ({ value: u.id, label: tx(u.name) })) ?? []),
          ])}
        {select(t(C.professional), f.proId, (v) => set({ proId: v }), [{ value: "all", label: t(C.all) }, ...pros.map((p) => ({ value: p.id, label: `${p.firstName} ${p.lastName}` }))])}
        {select(t(C.service), f.serviceId, (v) => set({ serviceId: v }), [{ value: "all", label: t(C.all) }, ...services.map((s) => ({ value: s.id, label: tx(s.name) }))])}
        {select(t(C.payment), f.method, (v) => set({ method: v }), [
          { value: "all", label: t(C.all) },
          { value: "pix", label: "Pix" },
          { value: "card", label: t(METHOD.card) },
          { value: "counter", label: t(["Recebido no balcão", "Collected at the desk"]) },
        ])}
        {select(t(M.origin), f.origin, (v) => set({ origin: v }), [
          { value: "all", label: t(M.siteWalkin) },
          { value: "site", label: t(M.site) },
          { value: "walkin", label: t(M.walkin) },
        ])}
      </section>

      <Panel
        title={data ? t(M.summary, { n: data.total, v: fmt.money(data.sum) }) : t(C.loading)}
        bodyClassName="flex flex-col gap-4"
      >
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t(M.filterStatus)}>
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={f.status === s}
              onClick={() => set({ status: s })}
              className={cn(
                "h-8 rounded-sm border px-3 text-sm",
                f.status === s ? "border-ink bg-ink text-surface-0" : "border-hairline text-ink-muted hover:text-ink",
              )}
            >
              {s === "all" ? t(C.all) : t(STATUS[s])} · {data?.counts[s] ?? 0}
            </button>
          ))}
        </div>
        {data && data.rows.length === 0 ? (
          <Empty>{t(C.noResults)}</Empty>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[1000px]">
              <TableHeader>
                <TableRow>
                  <TableHead>{t(C.code)}</TableHead>
                  <TableHead>{t(C.unit)}</TableHead>
                  <TableHead>{t(C.client)}</TableHead>
                  <TableHead>{t(M.items)}</TableHead>
                  <TableHead>{t(C.professional)}</TableHead>
                  <TableHead>{t(M.time)}</TableHead>
                  <TableHead>{t(C.payment)}</TableHead>
                  <TableHead>{t(C.status)}</TableHead>
                  <TableHead className="text-right">{t(C.total)}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Link href={`/admin/orders/${r.id}`} className="font-mono font-medium underline-offset-4 hover:underline">
                        {r.code}
                      </Link>
                    </TableCell>
                    <TableCell>{unitName(r.unitId)}</TableCell>
                    <TableCell>
                      {r.client || "—"} {r.walkin && <span className="text-ink-muted">· {t(C.walkin)}</span>}
                    </TableCell>
                    <TableCell className="max-w-56 truncate">
                      {r.items.map((i) => tx(i)).join(" · ")} {r.pickup && <span className="text-ink-muted">· {t(M.pickup)}</span>}
                    </TableCell>
                    <TableCell>{r.pro ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">{r.start ? fmt.when(r.start) : r.pickup ? t(M.pickup) : "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {r.methods.length ? r.methods.map((m) => t(METHOD[m])).join(" + ") : r.chosenMethod ? t(METHOD[r.chosenMethod]) : "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge state={r.state} />
                    </TableCell>
                    <TableCell className="tabular text-right">{fmt.money(r.total, { decimals: "always" })}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {data && <Pager page={data.page} pages={data.pages} total={data.total} pageSize={20} onPage={(p) => setF((x) => ({ ...x, page: p }))} />}
      </Panel>
    </>
  );
}
