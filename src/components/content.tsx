"use client";

import { Fragment, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { LText } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

/** Minimal markdown: ## / ### headings, - and 1. lists, > quotes, **bold**, *italic*. */
export function Markdown({ source, className }: { source: string; className?: string }) {
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, i) =>
      part.startsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part.startsWith("*") && part.length > 2 ? <em key={i}>{part.slice(1, -1)}</em> : <Fragment key={i}>{part}</Fragment>,
    );
  const lines = source.split("\n");
  const out: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const L = list.ordered ? "ol" : "ul";
    out.push(
      <L key={out.length} className={list.ordered ? "list-decimal pl-5" : "bv-slash-list"}>
        {list.items.map((it, i) => (
          <li key={i}>{inline(it)}</li>
        ))}
      </L>,
    );
    list = null;
  };
  for (const line of lines) {
    const l = line.trimEnd();
    const ul = l.match(/^[-*] (.*)/);
    const ol = l.match(/^\d+\. (.*)/);
    if (ul || ol) {
      const ordered = !!ol;
      if (!list || list.ordered !== ordered) {
        flush();
        list = { ordered, items: [] };
      }
      list.items.push((ul ?? ol)![1]);
      continue;
    }
    flush();
    if (!l) continue;
    if (l.startsWith("### ")) out.push(<h4 key={out.length} className="font-medium">{inline(l.slice(4))}</h4>);
    else if (l.startsWith("## ")) out.push(<h3 key={out.length} className="text-lg font-medium">{inline(l.slice(3))}</h3>);
    else if (l.startsWith("> ")) out.push(<blockquote key={out.length} className="border-l border-ink pl-3 text-ink-muted">{inline(l.slice(2))}</blockquote>);
    else out.push(<p key={out.length}>{inline(l)}</p>);
  }
  flush();
  return <div className={cn("flex flex-col gap-3 leading-relaxed", className)}>{out}</div>;
}

export function toPair(v: LText | null | undefined): { pt: string; en: string } {
  if (v == null) return { pt: "", en: "" };
  if (typeof v === "string") return { pt: v, en: v };
  return v;
}

/** Edits a bilingual field. English falls back to Portuguese when left empty. */
export function LTextInput({
  value,
  onChange,
  multiline,
  rows = 4,
  id,
  maxLength,
  placeholder,
}: {
  value: LText;
  onChange: (v: { pt: string; en: string }) => void;
  multiline?: boolean;
  rows?: number;
  id?: string;
  maxLength?: number;
  placeholder?: string;
}) {
  const [lang, setLang] = useState<"pt" | "en">("pt");
  const pair = toPair(value);
  const set = (text: string) => onChange({ ...pair, [lang]: text });
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-1 self-end font-mono text-[11px]" role="radiogroup" aria-label="Idioma do conteúdo · Content language">
        {(["pt", "en"] as const).map((l) => (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={lang === l}
            onClick={() => setLang(l)}
            className={cn("h-6 rounded-sm px-2 uppercase", lang === l ? "bg-ink text-surface-0" : "text-ink-muted hover:text-ink")}
          >
            {l}
          </button>
        ))}
      </div>
      {multiline ? (
        <Textarea id={id} rows={rows} value={pair[lang]} maxLength={maxLength} placeholder={placeholder} onChange={(e) => set(e.target.value)} className="font-mono text-sm" />
      ) : (
        <Input id={id} value={pair[lang]} maxLength={maxLength} placeholder={placeholder} onChange={(e) => set(e.target.value)} />
      )}
    </div>
  );
}

export function cleanPair(v: { pt: string; en: string }): { pt: string; en: string } {
  return { pt: v.pt.trim(), en: v.en.trim() || v.pt.trim() };
}
