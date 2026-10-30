"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { RoleGate, UnitPicker, useAdminUnit } from "@/components/admin/shell";
import { Avatar, Empty, PageHeader, SkeletonBlock } from "@/components/kit";
import { Stagger } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useT, type Messages } from "@/i18n";
import { C, METHOD, STATUS } from "@/i18n/common";
import { useNow, useQ } from "@/lib/client/hooks";
import type { Q } from "@/lib/client/q";
import { addDays, nowLocal, toMinutes } from "@/lib/domain/time";
import { cn } from "@/lib/utils";

const M = {
  title: ["Agenda da unidade", "Location agenda"],
  hours: ["aberta das {a} às {b}", "open {a} to {b}"],
  breakH: ["intervalo {a} às {b}", "break {a} to {b}"],
  closedDay: ["Unidade fechada neste dia", "Location closed on this day"],
  prevDay: ["Dia anterior", "Previous day"],
  nextDay: ["Próximo dia", "Next day"],
  teamSchedule: ["Agenda da equipe", "Team schedule"],
  booked: ["Agendado", "Booked"],
  inChair: ["Na cadeira", "In the chair"],
  late: ["Atrasado e encaixe", "Late and fit-in"],
  done: ["Concluído", "Completed"],
  off: ["Fora do horário", "Outside hours"],
  appts: ["{n} atendimentos", "{n} services"],
  dayOff: ["folga", "day off"],
  agendaClosed: ["Folga · agenda fechada", "Day off · agenda closed"],
  fit: ["Encaixe sugerido {t}", "Suggested fit {t}"],
  lateBy: ["atrasado {n} min", "{n} min late"],
  lateDetail: ["Era {a} · encaixe {b} · vira falta às {c}", "Was {a} · fit at {b} · no-show at {c}"],
  started: ["começou {t}", "started {t}"],
  paidWith: ["Pago · {m}", "Paid · {m}"],
  payDesk: ["paga no balcão", "pays at the desk"],
  open: ["Abrir pedido", "Open order"],
  legend: ["Legenda", "Legend"],
} satisfies Messages;

const PX_PER_MIN = 1.4;
type Block = Q["agenda"]["pros"][number]["blocks"][number];

export default function AgendaPage() {
  return (
    <RoleGate roles={["admin", "desk"]}>
      <Agenda />
    </RoleGate>
  );
}

function Agenda() {
  const { t, tx, fmt } = useT();
  useNow(60000);
  const [unitId] = useAdminUnit({ allowAll: false });
  const today = nowLocal().slice(0, 10);
  const [date, setDate] = useState(today);
  const { data } = useQ("agenda", { unitId, date }, "staff");

  const start = data?.hours ? toMinutes(data.hours.start) : 9 * 60;
  const end = data?.hours ? toMinutes(data.hours.end) : 19 * 60;
  const height = (end - start) * PX_PER_MIN;
  const y = (time: string) => (toMinutes(time) - start) * PX_PER_MIN;
  const hours: number[] = [];
  for (let h = Math.ceil(start / 60) * 60; h < end; h += 60) hours.push(h);

  return (
    <>
      <PageHeader
        eyebrow={tx(data?.unitName ?? "")}
        title={t(M.title)}
        description={
          data?.hours
            ? `${fmt.dayLong(date)} · ${t(M.hours, { a: fmt.hour(data.hours.start), b: fmt.hour(data.hours.end) })}${
                data.hours.breakStart ? `, ${t(M.breakH, { a: fmt.hour(data.hours.breakStart), b: fmt.hour(data.hours.breakEnd!) })}` : ""
              }`
            : fmt.dayLong(date)
        }
        actions={
          <>
            <UnitPicker allowAll={false} />
            <div className="flex items-center gap-1 self-end">
              <Button variant="outline" size="icon" aria-label={t(M.prevDay)} onClick={() => setDate(addDays(date, -1))}>
                <ChevronLeft />
              </Button>
              <Button variant={date === today ? "default" : "outline"} onClick={() => setDate(today)}>
                {t(C.today)}
              </Button>
              <Button variant="outline" size="icon" aria-label={t(M.nextDay)} onClick={() => setDate(addDays(date, 1))}>
                <ChevronRight />
              </Button>
              <Link href="/admin/settings/team" className="ml-2 text-sm underline-offset-4 hover:underline">
                {t(M.teamSchedule)} →
              </Link>
            </div>
          </>
        }
      />
      <ul className="flex flex-wrap items-center gap-5 text-xs text-ink-muted" aria-label={t(M.legend)} data-anim>
        <li className="flex items-center gap-2">
          <span className="h-3 w-5 rounded-[2px] border border-ink" /> {t(M.booked)}
        </li>
        <li className="flex items-center gap-2">
          <span className="h-3 w-5 rounded-[2px] bg-ink" /> {t(M.inChair)}
        </li>
        <li className="flex items-center gap-2">
          <span className="bv-hatch-strong h-3 w-5 rounded-[2px] border border-dashed border-ink" /> {t(M.late)}
        </li>
        <li className="flex items-center gap-2">
          <span className="h-3 w-5 rounded-[2px] bg-surface-2" /> {t(M.done)}
        </li>
        <li className="flex items-center gap-2">
          <span className="bv-hatch h-3 w-5 rounded-[2px] border border-hairline" /> {t(M.off)}
        </li>
      </ul>

      {!data ? (
        <SkeletonBlock className="h-[600px]" />
      ) : !data.hours ? (
        <Empty>
          {t(M.closedDay)} {data.closure && `· ${tx(data.closure)}`}
        </Empty>
      ) : (
        <div className="overflow-x-auto rounded-md border border-hairline bg-card" data-anim>
          <div className="grid" style={{ gridTemplateColumns: `56px repeat(${data.pros.length}, minmax(180px, 1fr))`, minWidth: 56 + data.pros.length * 180 }}>
            <div className="sticky left-0 z-10 border-b border-r border-hairline bg-card" />
            {data.pros.map((p) => (
              <div key={p.id} className="flex items-center gap-3 border-b border-r border-hairline p-3 last:border-r-0">
                <Avatar name={p.name} inverted={!!p.hours} />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{p.name}</span>
                  <span className="text-xs text-ink-muted">{p.hours ? t(M.appts, { n: p.count }) : p.offLabel ? tx(p.offLabel).toLowerCase() : t(M.dayOff)}</span>
                </div>
              </div>
            ))}

            <div className="sticky left-0 z-10 border-r border-hairline bg-card font-mono text-[11px] text-ink-muted" style={{ height }}>
              <div className="relative h-full">
                {hours.map((h) => (
                  <span key={h} className="absolute right-2" style={{ top: (h - start) * PX_PER_MIN + 2 }}>
                    {fmt.hour(`${String(h / 60).padStart(2, "0")}:00`)}
                  </span>
                ))}
              </div>
            </div>

            {data.pros.map((p) => (
              <div key={p.id} className="relative border-r border-hairline last:border-r-0" style={{ height }}>
                {hours.map((h) => (
                  <div key={h} className="absolute inset-x-0 border-t border-hairline/60" style={{ top: (h - start) * PX_PER_MIN }} aria-hidden="true" />
                ))}
                {!p.hours ? (
                  <div className="bv-hatch absolute inset-0 flex items-center justify-center">
                    <span className="rounded-sm border border-hairline bg-card px-3 py-1 text-xs uppercase tracking-[0.1em] text-ink-muted">
                      {p.offLabel ? tx(p.offLabel) : t(M.agendaClosed)}
                    </span>
                  </div>
                ) : (
                  <>
                    {toMinutes(p.hours.start) > start && <div className="bv-hatch absolute inset-x-0 top-0" style={{ height: y(p.hours.start) }} />}
                    {toMinutes(p.hours.end) < end && <div className="bv-hatch absolute inset-x-0 bottom-0" style={{ top: y(p.hours.end) }} />}
                    {p.hours.breakStart && p.hours.breakEnd && (
                      <div
                        className="bv-hatch absolute inset-x-0 flex items-center justify-center text-[11px] uppercase tracking-[0.1em] text-ink-muted"
                        style={{ top: y(p.hours.breakStart), height: (toMinutes(p.hours.breakEnd) - toMinutes(p.hours.breakStart)) * PX_PER_MIN }}
                      >
                        {t(C.break)}
                      </div>
                    )}
                    <Stagger deps={[date, unitId]}>
                      {p.blocks.map((b) => (
                        <AgendaBlock key={b.orderId} b={b} top={y(b.start)} height={Math.max(28, (toMinutes(b.end) - toMinutes(b.start)) * PX_PER_MIN - 3)} />
                      ))}
                      {p.blocks
                        .filter((b) => b.late?.fitAt)
                        .map((b) => (
                          <div
                            key={`fit-${b.orderId}`}
                            data-anim
                            className="absolute inset-x-1.5 rounded-sm border border-dashed border-line-strong p-2 text-xs"
                            style={{ top: y(b.late!.fitAt!), height: Math.max(28, b.durationMin * PX_PER_MIN - 3) }}
                          >
                            <span className="block font-medium">{t(M.fit, { t: b.late!.fitAt! })}</span>
                            <span className="text-ink-muted">{b.client.split(" ")[0]}</span>
                          </div>
                        ))}
                    </Stagger>
                  </>
                )}
              </div>
            ))}
            {data.now && toMinutes(data.now) >= start && toMinutes(data.now) <= end && (
              <div className="pointer-events-none relative col-span-full h-0" aria-hidden="true">
                <div className="absolute inset-x-0 h-0.5 bg-ink" style={{ top: -(height - y(data.now)) }} />
                <span className="absolute left-1 rounded-sm bg-ink px-1.5 font-mono text-[11px] text-surface-0" style={{ top: -(height - y(data.now)) - 9 }}>
                  {data.now}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function AgendaBlock({ b, top, height }: { b: Block; top: number; height: number }) {
  const { t, tx, fmt } = useT();
  const style =
    b.state === "in_service"
      ? "border-2 border-ink bg-ink text-surface-0"
      : b.state === "late"
        ? "bv-hatch-strong border border-dashed border-ink bg-card"
        : b.state === "completed"
          ? "border border-transparent bg-surface-2 text-ink-muted"
          : b.state === "no_show"
            ? "border border-dashed border-line-strong text-ink-muted line-through"
            : b.state === "awaiting_payment"
              ? "border border-dashed border-ink bg-card"
              : "border border-ink bg-card";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-anim
          className={cn("absolute inset-x-1.5 overflow-hidden rounded-sm px-2 py-1 text-left text-xs", style)}
          style={{ top, height }}
        >
          <span className="block truncate font-medium">
            {b.start} · {b.client.split(" ").slice(0, 2).join(" ") || "—"}
          </span>
          {height > 40 && (
            <span className="block truncate opacity-80">
              {b.state === "late" ? t(M.lateBy, { n: b.late?.minutes ?? 0 }) : b.state === "in_service" ? t(STATUS.in_service) : b.services.map((s) => tx(s)).join(" + ")}
            </span>
          )}
          {height > 70 && <span className="block truncate font-mono opacity-70">{b.code}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 text-sm">
        <div className="flex flex-col gap-1.5">
          <span className="font-semibold">
            {b.client} · {t(STATUS[b.state] ?? ["", ""]).toLowerCase()}
          </span>
          <span className="font-mono text-xs text-ink-muted">
            {b.code} {b.phone && `· ${b.phone}`}
          </span>
          <span>
            {b.services.map((s) => tx(s)).join(" + ")} · {fmt.dur(b.durationMin)}
          </span>
          {b.late && <span>{t(M.lateDetail, { a: b.start, b: b.late.fitAt ?? "—", c: b.late.deadline })}</span>}
          {b.startedAt && <span>{t(M.started, { t: b.startedAt })}</span>}
          <span className="flex justify-between border-t border-hairline pt-1.5">
            <span>{b.paid && b.method ? t(M.paidWith, { m: t(METHOD[b.method]) }) : t(M.payDesk)}</span>
            <span className="font-semibold">{fmt.money(b.total)}</span>
          </span>
          <Button asChild size="sm" variant="outline" className="mt-1">
            <Link href={`/admin/orders/${b.orderId}`}>{t(M.open)} →</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
