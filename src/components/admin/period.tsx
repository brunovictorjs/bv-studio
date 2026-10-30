"use client";

import { useState } from "react";
import { Field, Segmented } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT, type Messages } from "@/i18n";
import { C } from "@/i18n/common";
import { addDays, addMonths, nowLocal, startOfMonth } from "@/lib/domain/time";

const M = {
  quick: ["Período rápido", "Quick range"],
  today: ["Hoje", "Today"],
  week: ["Últimos 7 dias", "Last 7 days"],
  month: ["Este mês", "This month"],
  lastMonth: ["Mês passado", "Last month"],
  apply: ["Aplicar", "Apply"],
} satisfies Messages;

export type Period = { from: string; to: string };
type Preset = "today" | "week" | "month" | "lastMonth" | "custom";

export function presetRange(p: Exclude<Preset, "custom">): Period {
  const today = nowLocal().slice(0, 10);
  if (p === "today") return { from: today, to: today };
  if (p === "week") return { from: addDays(today, -6), to: today };
  if (p === "month") return { from: startOfMonth(today), to: today };
  const first = addMonths(today, -1);
  return { from: first, to: addDays(startOfMonth(today), -1) };
}

export function PeriodPicker({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  const { t } = useT();
  const [draft, setDraft] = useState(value);
  const [preset, setPreset] = useState<Preset>("week");
  const choose = (p: Preset) => {
    setPreset(p);
    if (p === "custom") return;
    const r = presetRange(p);
    setDraft(r);
    onChange(r);
  };
  return (
    <div className="flex flex-wrap items-end gap-3" data-anim>
      <Segmented
        label={t(M.quick)}
        value={preset}
        onChange={choose}
        options={[
          { value: "today", label: t(M.today) },
          { value: "week", label: t(M.week) },
          { value: "month", label: t(M.month) },
          { value: "lastMonth", label: t(M.lastMonth) },
        ]}
      />
      <Field label={t(C.startDate)}>
        <Input type="date" value={draft.from} onChange={(e) => (setPreset("custom"), setDraft({ ...draft, from: e.target.value }))} className="w-40" />
      </Field>
      <Field label={t(C.endDate)}>
        <Input type="date" value={draft.to} onChange={(e) => (setPreset("custom"), setDraft({ ...draft, to: e.target.value }))} className="w-40" />
      </Field>
      <Button variant="outline" onClick={() => draft.from && draft.to && draft.from <= draft.to && onChange(draft)}>
        {t(M.apply)}
      </Button>
    </div>
  );
}

export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
