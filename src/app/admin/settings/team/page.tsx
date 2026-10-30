"use client";

import { ChevronDown, Plus } from "lucide-react";
import { useState } from "react";
import { ConflictList, HoursEditor } from "@/components/admin/hours-editor";
import { RoleGate, UnitPicker, useAdminUnit } from "@/components/admin/shell";
import { Avatar, Chip, Field, Segmented } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useT, type Messages } from "@/i18n";
import { C } from "@/i18n/common";
import { conflictList, useAction, useDb } from "@/lib/client/hooks";
import { nowLocal } from "@/lib/domain/time";
import type { SchedulePeriod, User, WeekHours } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

const M = {
  intro: [
    "Por padrão cada profissional trabalha no horário da unidade. Dá para dar uma semana própria, fechar a agenda em um período (férias, consulta) ou abrir um turno extra.",
    "By default each professional works the location's hours. You can set their own week, close their agenda for a period (vacation, appointment) or open an extra shift.",
  ],
  unitHours: ["Horário da unidade", "Location hours"],
  ownHours: ["Horário próprio", "Own hours"],
  summaryUnit: ["Horário da unidade · {d} dias", "Location hours · {d} days"],
  summaryOwn: ["Horário próprio · {d} dias", "Own hours · {d} days"],
  periodsN: ["{n} período(s)", "{n} period(s)"],
  noPeriods: ["nenhum período", "no periods"],
  unsaved: ["Não salvo", "Not saved"],
  saveSchedule: ["Salvar horário", "Save schedule"],
  saved: ["Horário salvo.", "Schedule saved."],
  periods: ["Períodos", "Periods"],
  closeAgenda: ["Fechar agenda", "Close agenda"],
  extraShift: ["Turno extra", "Extra shift"],
  closed: ["Fechada", "Closed"],
  open: ["Aberta", "Open"],
  until: ["{a} até {b}", "{a} to {b}"],
  remove: ["Remover", "Remove"],
  conflictTitle: ["Há clientes marcados", "There are booked clients"],
  conflictBody: ["Remarque ou cancele antes de mudar a agenda.", "Reschedule or cancel them before changing the agenda."],
  newPeriod: ["Novo período", "New period"],
  type: ["Tipo", "Type"],
  start: ["Início", "Start"],
  end: ["Fim", "End"],
  reason: ["Motivo", "Reason"],
  reasonPh: ["Férias, consulta, turno de noivas…", "Vacation, appointment, bridal shift…"],
  savedPeriod: ["Período salvo.", "Period saved."],
  expand: ["Abrir agenda de {name}", "Open {name}'s schedule"],
} satisfies Messages;

export default function TeamPage() {
  return (
    <RoleGate roles={["admin", "desk"]}>
      <Team />
    </RoleGate>
  );
}

function Team() {
  const { t } = useT();
  const db = useDb();
  const [unitId] = useAdminUnit({ allowAll: false });
  const [open, setOpen] = useState<string | null>(null);
  if (!db) return null;
  const pros = db.users.filter((u) => u.roles.includes("professional") && u.unitId === unitId && u.status === "active");
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4" data-anim>
        <p className="max-w-3xl text-ink-muted">{t(M.intro)}</p>
        <UnitPicker allowAll={false} />
      </div>
      <div className="flex flex-col gap-3">
        {pros.map((p) => (
          <ProCard key={p.id} pro={p} open={open === p.id} onToggle={() => setOpen(open === p.id ? null : p.id)} />
        ))}
      </div>
    </>
  );
}

function ProCard({ pro, open, onToggle }: { pro: User; open: boolean; onToggle: () => void }) {
  const { t, tx, fmt } = useT();
  const db = useDb()!;
  const unit = db.units.find((u) => u.id === pro.unitId)!;
  const { run, busy } = useAction("staff");
  const [mode, setMode] = useState<"unit" | "own">(pro.schedule ? "own" : "unit");
  const [week, setWeek] = useState<WeekHours>(() => structuredClone(pro.schedule ?? unit.hours.map((d) => ({ open: d.open, start: d.start, end: d.end }))));
  const [dirty, setDirty] = useState(false);
  const [conflicts, setConflicts] = useState<ReturnType<typeof conflictList>>([]);
  const [periodOpen, setPeriodOpen] = useState<SchedulePeriod["type"] | null>(null);
  const days = (pro.schedule ?? unit.hours).filter((d, i) => d.open && unit.hours[i].open).length;
  const name = `${pro.firstName} ${pro.lastName}`;

  const saveSchedule = async () => {
    setConflicts([]);
    const r = await run("team.saveSchedule", { userId: pro.id, schedule: mode === "unit" ? null : week }, { success: t(M.saved), onError: (e) => setConflicts(conflictList(e)) });
    if (r) setDirty(false);
  };

  return (
    <section className="rounded-md border border-hairline bg-card" data-anim>
      <button type="button" onClick={onToggle} aria-expanded={open} aria-label={t(M.expand, { name })} className="flex w-full items-center gap-3 p-4 text-left">
        <Avatar name={name} />
        <span className="flex flex-1 flex-col">
          <span className="font-medium">{name}</span>
          <span className="text-sm text-ink-muted">
            {t(pro.schedule ? M.summaryOwn : M.summaryUnit, { d: days })} · {pro.periods.length ? t(M.periodsN, { n: pro.periods.length }) : t(M.noPeriods)}
          </span>
        </span>
        {dirty && <Chip className="border-dashed border-ink text-ink">{t(M.unsaved)}</Chip>}
        <ChevronDown className={cn("size-5 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="flex flex-col gap-6 border-t border-hairline p-4">
          <Segmented
            label={t(M.ownHours)}
            value={mode}
            onChange={(v) => {
              setMode(v);
              setDirty(true);
            }}
            options={[
              { value: "unit", label: t(M.unitHours) },
              { value: "own", label: t(M.ownHours) },
            ]}
          />
          {mode === "own" && (
            <HoursEditor
              mode="pro"
              unitWeek={unit.hours}
              value={week}
              onChange={(w) => {
                setWeek(w);
                setDirty(true);
              }}
            />
          )}
          {conflicts.length > 0 && (
            <div className="rounded-md border border-dashed border-ink p-4" role="alert">
              <span className="font-medium">{t(M.conflictTitle)}</span>
              <p className="text-sm text-ink-muted">{t(M.conflictBody)}</p>
              <ConflictList items={conflicts} />
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              disabled={!dirty}
              onClick={() => {
                setMode(pro.schedule ? "own" : "unit");
                setWeek(structuredClone(pro.schedule ?? unit.hours.map((d) => ({ open: d.open, start: d.start, end: d.end }))));
                setDirty(false);
                setConflicts([]);
              }}
            >
              {t(C.discard)}
            </Button>
            <Button disabled={busy || !dirty} onClick={saveSchedule}>
              {t(M.saveSchedule)}
            </Button>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-medium">{t(M.periods)}</h3>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setPeriodOpen("closed")}>
                  <Plus /> {t(M.closeAgenda)}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setPeriodOpen("extra")}>
                  <Plus /> {t(M.extraShift)}
                </Button>
              </div>
            </div>
            {pro.periods.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-sm border border-hairline p-3 text-sm">
                <Chip active={p.type === "extra"}>{t(p.type === "closed" ? M.closed : M.open)}</Chip>
                <span className="flex-1">
                  {t(M.until, { a: `${fmt.day(p.start)} ${p.start.slice(11)}`, b: `${fmt.day(p.end)} ${p.end.slice(11)}` })} · {tx(p.label)}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    setConflicts([]);
                    void run("team.removePeriod", { userId: pro.id, periodId: p.id }, { onError: (e) => setConflicts(conflictList(e)) });
                  }}
                >
                  {t(M.remove)}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
      <PeriodDialog
        type={periodOpen}
        onClose={() => setPeriodOpen(null)}
        onSave={async (p) => {
          setConflicts([]);
          const r = await run("team.addPeriod", { userId: pro.id, id: null, ...p }, { success: t(M.savedPeriod), onError: (e) => setConflicts(conflictList(e)) });
          if (r) setPeriodOpen(null);
          return !!r;
        }}
        busy={busy}
      />
    </section>
  );
}

function PeriodDialog({
  type,
  onClose,
  onSave,
  busy,
}: {
  type: SchedulePeriod["type"] | null;
  onClose: () => void;
  onSave: (p: { type: SchedulePeriod["type"]; start: string; end: string; label: string }) => Promise<boolean>;
  busy: boolean;
}) {
  const { t } = useT();
  const today = nowLocal().slice(0, 10);
  const [start, setStart] = useState(`${today}T09:00`);
  const [end, setEnd] = useState(`${today}T13:00`);
  const [label, setLabel] = useState("");
  return (
    <Dialog open={!!type} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{type === "extra" ? t(M.extraShift) : t(M.closeAgenda)}</DialogTitle>
          <DialogDescription>{t(M.newPeriod)}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t(M.start)}>
            <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label={t(M.end)}>
            <Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
          <Field label={t(M.reason)} className="sm:col-span-2">
            <Input value={label} placeholder={t(M.reasonPh)} onChange={(e) => setLabel(e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t(C.cancel)}
          </Button>
          <Button disabled={busy || !label.trim()} onClick={() => type && onSave({ type, start: start.slice(0, 16), end: end.slice(0, 16), label })}>
            {t(C.save)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
