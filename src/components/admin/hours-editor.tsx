"use client";

import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useT, type Messages } from "@/i18n";
import type { DayHours, WeekHours } from "@/lib/domain/types";

const M = {
  day: ["Dia", "Day"],
  open: ["Aberto", "Open"],
  works: ["Trabalha", "Works"],
  start: ["Abre", "Opens"],
  end: ["Fecha", "Closes"],
  startPro: ["Início", "Start"],
  endPro: ["Fim", "End"],
  break: ["Intervalo", "Break"],
  noBreak: ["sem intervalo", "no break"],
  closed: ["Fechado", "Closed"],
  dayOff: ["Folga", "Day off"],
  unit: ["Unidade", "Location"],
  unitClosed: ["unidade fechada", "location closed"],
} satisfies Messages;

/** Monday-first week editor. `unitWeek` shows the unit's window next to a professional's own hours. */
export function HoursEditor({
  value,
  onChange,
  mode = "unit",
  unitWeek,
}: {
  value: WeekHours;
  onChange: (w: WeekHours) => void;
  mode?: "unit" | "pro";
  unitWeek?: WeekHours;
}) {
  const { t, fmt } = useT();
  const order = [1, 2, 3, 4, 5, 6, 0];
  const set = (i: number, patch: Partial<DayHours>) => onChange(value.map((d, k) => (k === i ? { ...d, ...patch } : d)));
  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[620px]">
        <TableHeader>
          <TableRow>
            <TableHead>{t(M.day)}</TableHead>
            <TableHead>{t(mode === "unit" ? M.open : M.works)}</TableHead>
            <TableHead>{t(mode === "unit" ? M.start : M.startPro)}</TableHead>
            <TableHead>{t(mode === "unit" ? M.end : M.endPro)}</TableHead>
            <TableHead>{mode === "unit" ? t(M.break) : t(M.unit)}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {order.map((i) => {
            const d = value[i];
            const u = unitWeek?.[i];
            const unitClosed = mode === "pro" && u && !u.open;
            return (
              <TableRow key={i}>
                <TableCell className="font-medium capitalize">{fmt.weekdayName(i, true)}</TableCell>
                <TableCell>
                  <Switch checked={d.open && !unitClosed} disabled={!!unitClosed} onCheckedChange={(v) => set(i, { open: v })} aria-label={`${t(mode === "unit" ? M.open : M.works)} · ${fmt.weekdayName(i, true)}`} />
                </TableCell>
                {d.open && !unitClosed ? (
                  <>
                    <TableCell>
                      <Input type="time" className="w-28" value={d.start} onChange={(e) => set(i, { start: e.target.value })} aria-label={t(M.start)} />
                    </TableCell>
                    <TableCell>
                      <Input type="time" className="w-28" value={d.end} onChange={(e) => set(i, { end: e.target.value })} aria-label={t(M.end)} />
                    </TableCell>
                    <TableCell>
                      {mode === "unit" ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="time"
                            className="w-28"
                            value={d.breakStart ?? ""}
                            onChange={(e) => set(i, { breakStart: e.target.value || null })}
                            aria-label={t(M.break)}
                          />
                          <span className="text-ink-muted">–</span>
                          <Input type="time" className="w-28" value={d.breakEnd ?? ""} onChange={(e) => set(i, { breakEnd: e.target.value || null })} aria-label={t(M.break)} />
                        </div>
                      ) : (
                        <span className="font-mono text-xs text-ink-muted">
                          {u?.open ? `${u.start}–${u.end}${u.breakStart ? ` · ${u.breakStart}–${u.breakEnd}` : ""}` : t(M.unitClosed)}
                        </span>
                      )}
                    </TableCell>
                  </>
                ) : (
                  <TableCell colSpan={3} className="text-ink-muted">
                    {unitClosed ? t(M.unitClosed) : t(mode === "unit" ? M.closed : M.dayOff)}
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export function ConflictList({ items }: { items: { id: string; code: string; client: string; start: string }[] }) {
  const { fmt } = useT();
  if (!items.length) return null;
  return (
    <ul className="mt-2 flex flex-col gap-1 text-sm">
      {items.map((c) => (
        <li key={c.id}>
          <a href={`/admin/orders/${c.id}`} className="font-mono underline-offset-4 hover:underline">
            {c.code}
          </a>{" "}
          · {c.client} · {fmt.dayWeek(c.start)} {c.start.slice(11)}
        </li>
      ))}
    </ul>
  );
}
