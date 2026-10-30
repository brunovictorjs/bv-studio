"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { GrowBars } from "./motion";

export interface Bar {
  key: string;
  label: string;
  value: number;
  /** shown in the tooltip */
  detail: string;
  muted?: boolean;
  /** closed day / holiday: drawn as a hatched stub */
  stub?: string;
  highlight?: boolean;
}

/**
 * Single-series bar chart (no legend: the figure title names the series).
 * Monochrome per the BV system; each bar has a hover/focus tooltip.
 */
export function BarChart({ bars, height = 200, ariaLabel, className }: { bars: Bar[]; height?: number; ariaLabel: string; className?: string }) {
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <GrowBars deps={[bars.map((b) => b.value).join(",")]} className="relative">
        <div
          role="list"
          aria-label={ariaLabel}
          className="grid items-end gap-[2px] border-b border-hairline"
          style={{ gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))`, height }}
        >
          {bars.map((b) => {
            const h = b.stub ? 2 : Math.max(2, (b.value / max) * (height - 24));
            const active = hover === b.key;
            return (
              <div
                key={b.key}
                role="listitem"
                tabIndex={0}
                aria-label={`${b.label}: ${b.stub ?? b.detail}`}
                onMouseEnter={() => setHover(b.key)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(b.key)}
                onBlur={() => setHover(null)}
                className="relative flex h-full cursor-default items-end justify-center px-[2px] outline-none"
              >
                {active && (
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-sm border border-hairline bg-popover px-2 py-1 text-xs">
                    <div className="font-medium">{b.label}</div>
                    <div className="tabular text-ink-muted">{b.stub ?? b.detail}</div>
                  </div>
                )}
                {b.stub ? (
                  <div className="bv-hatch flex h-full w-full items-end justify-center">
                    <span className="mb-2 font-mono text-[10px] text-ink-muted [writing-mode:vertical-rl] rotate-180">{b.stub}</span>
                  </div>
                ) : (
                  <div
                    data-bar
                    className={cn(
                      "w-full max-w-14 rounded-t-[4px] transition-colors",
                      b.highlight ? "bg-ink" : b.muted ? "bg-hairline" : "bg-line-strong",
                      active && "bg-ink",
                    )}
                    style={{ height: h }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </GrowBars>
      <div className="grid gap-[2px] text-center font-mono text-[11px] text-ink-muted" style={{ gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))` }}>
        {bars.map((b) => (
          <span key={b.key} className="truncate">
            {b.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Part-to-whole as one stacked bar with lightness steps + texture, labeled in a list. */
export function ShareBar({ parts, ariaLabel }: { parts: { key: string; label: string; value: string; pct: number }[]; ariaLabel: string }) {
  const fills = ["bg-ink", "bg-line-strong bv-hatch", "bg-ink-muted", "bg-hairline"];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex h-8 w-full gap-[2px] overflow-hidden rounded-[4px]" role="img" aria-label={ariaLabel}>
        {parts
          .filter((p) => p.pct > 0)
          .map((p, i) => (
            <div key={p.key} className={cn("h-full", fills[i % fills.length])} style={{ width: `${p.pct}%` }} title={`${p.label} · ${p.pct}%`} />
          ))}
      </div>
      <ul className="flex flex-col gap-2 text-sm">
        {parts.map((p, i) => (
          <li key={p.key} className="flex items-center gap-3">
            <span className={cn("size-3 shrink-0 rounded-[2px] border border-hairline", fills[i % fills.length])} aria-hidden="true" />
            <span className="flex-1">{p.label}</span>
            <span className="tabular font-medium">
              {p.value} · {p.pct}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Horizontal meter (0–100). */
export function Meter({ pct, className }: { pct: number; className?: string }) {
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-[2px] bg-hairline", className)} aria-hidden="true">
      <div className="h-full bg-ink" style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}
