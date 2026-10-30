"use client";

import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { C, STATUS } from "@/i18n/common";
import { useT } from "@/i18n";
import { initials as toInitials } from "@/lib/domain/text";
import { cn } from "@/lib/utils";
import { CountUp } from "./motion";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-4", className)} data-anim>
      <div className="flex min-w-0 flex-col gap-1.5">
        {eyebrow && <span className="bv-label">{eyebrow}</span>}
        <h1 className="text-3xl font-semibold leading-tight tracking-[-0.02em] md:text-4xl">{title}</h1>
        {description && <p className="max-w-2xl text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Panel({
  title,
  tag,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: React.ReactNode;
  tag?: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("rounded-md border border-hairline bg-card p-5 md:p-6", className)} data-anim>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            {tag && <span className="bv-tag">&lt;{tag} /&gt;</span>}
            {title && <h2 className="text-xl font-medium">{title}</h2>}
            {description && <p className="text-sm text-ink-muted">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function Stat({
  label,
  value,
  format,
  display,
  hint,
  inverted,
  className,
}: {
  label: React.ReactNode;
  value?: number;
  format?: (n: number) => string;
  display?: React.ReactNode;
  hint?: React.ReactNode;
  inverted?: boolean;
  className?: string;
}) {
  return (
    <div
      data-anim
      className={cn(
        "flex flex-col gap-1.5 rounded-md border p-5",
        inverted ? "border-ink bg-ink text-surface-0" : "border-hairline bg-card",
        className,
      )}
    >
      <span className={cn("bv-label", inverted && "text-surface-0/70")}>{label}</span>
      <span className="text-3xl font-semibold leading-none tracking-[-0.02em]">
        {display ?? (value != null && format ? <CountUp value={value} format={format} /> : value)}
      </span>
      {hint && <span className={cn("text-sm", inverted ? "text-surface-0/70" : "text-ink-muted")}>{hint}</span>}
    </div>
  );
}

/** Monochrome status pill: states differ by fill, outline and dash, never by hue. */
export function StatusBadge({ state, className, children }: { state: string; className?: string; children?: React.ReactNode }) {
  const { t } = useT();
  const style: Record<string, string> = {
    cart: "border-dashed border-line-strong text-ink-muted",
    awaiting_payment: "border-dashed border-ink text-ink",
    paid: "border-ink text-ink",
    pickup: "border-ink text-ink",
    late: "border-dashed border-ink bg-surface-2 text-ink bv-hatch-strong",
    in_service: "border-ink bg-ink text-surface-0",
    completed: "border-transparent bg-surface-2 text-ink-muted",
    cancelled: "border-transparent text-ink-muted line-through",
    no_show: "border-dashed border-line-strong text-ink-muted line-through",
  };
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center whitespace-nowrap rounded-sm border px-2 text-[11px] font-medium uppercase tracking-[0.08em]",
        style[state] ?? "border-hairline",
        className,
      )}
    >
      {children ?? (STATUS[state] ? t(STATUS[state]) : state)}
    </span>
  );
}

export function Chip({ children, className, active }: { children: React.ReactNode; className?: string; active?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center whitespace-nowrap rounded-sm border px-2 text-[11px] font-medium uppercase tracking-[0.08em]",
        active ? "border-ink bg-ink text-surface-0" : "border-hairline text-ink-muted",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Avatar({ name, className, inverted }: { name: string; className?: string; inverted?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-full font-mono text-xs",
        inverted ? "bg-ink text-surface-0" : "border border-line-strong text-ink",
        className,
      )}
    >
      {toInitials(name)}
    </span>
  );
}

export function Stars({ value, className, size = 14 }: { value: number; className?: string; size?: number }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} role="img" aria-label={`${value} / 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} width={size} height={size} strokeWidth={1.5} className={n <= Math.round(value) ? "fill-current" : "opacity-40"} />
      ))}
    </span>
  );
}

export function StarInput({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n}`}
          onClick={() => onChange(n)}
          className="flex size-11 items-center justify-center rounded-sm hover:bg-muted"
        >
          <Star width={26} height={26} strokeWidth={1.25} className={n <= value ? "fill-current" : "text-line-strong"} />
        </button>
      ))}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
  className,
  htmlFor,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {label}
      </Label>
      {children}
      {hint && <span className="text-xs text-ink-muted">{hint}</span>}
    </div>
  );
}

export function ToggleRow({
  title,
  description,
  checked,
  onChange,
  disabled,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4 border-b border-hairline py-3 last:border-b-0">
      <label htmlFor={id} className="flex flex-col gap-0.5">
        <span className="font-medium">{title}</span>
        {description && <span className="text-sm text-ink-muted">{description}</span>}
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}

/** Segmented control (single choice) built from real buttons. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
  size = "default",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode; disabled?: boolean }[];
  label: string;
  className?: string;
  size?: "default" | "sm";
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex flex-wrap gap-1 rounded-sm border border-hairline p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-sm px-3 text-sm transition-colors disabled:opacity-40",
            size === "sm" ? "h-7" : "h-8",
            value === o.value ? "bg-ink text-surface-0" : "text-ink-muted hover:bg-muted hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Pager({ page, pages, total, pageSize, onPage }: { page: number; pages: number; total: number; pageSize: number; onPage: (p: number) => void }) {
  const { t } = useT();
  const a = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const b = Math.min(total, page * pageSize);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-4 text-sm text-ink-muted">
      <span className="font-mono">{t(C.ofTotal, { a, b, total })}</span>
      <div className="flex gap-1">
        <Button variant="outline" size="icon-sm" aria-label={t(C.prev)} disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft />
        </Button>
        <Button variant="outline" size="icon-sm" aria-label={t(C.next)} disabled={page >= pages} onClick={() => onPage(page + 1)}>
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}

export function Empty({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-md border border-dashed border-hairline p-8 text-center text-ink-muted", className)}>{children}</div>;
}

/** Key/value row used in summaries and receipts. */
export function Row({ label, value, strong, muted, className }: { label: React.ReactNode; value: React.ReactNode; strong?: boolean; muted?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4 py-1.5", muted && "text-ink-muted", strong && "font-semibold", className)}>
      <span>{label}</span>
      <span className="tabular text-right">{value}</span>
    </div>
  );
}

/** "/" list — the bar of the logo as bullet. */
export function SlashList({ items, className }: { items: React.ReactNode[]; className?: string }) {
  return (
    <ul className={cn("bv-slash-list", className)}>
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  );
}

export function Delta({ value, suffix = "%", inverse }: { value: number | null; suffix?: string; inverse?: boolean }) {
  const { fmt } = useT();
  if (value == null) return <span className="text-ink-muted">—</span>;
  const up = value >= 0;
  return (
    <span className={cn("tabular", (inverse ? !up : up) ? "text-ink" : "text-ink-muted")}>
      {up ? "▲" : "▼"} {suffix === "%" ? fmt.pct(Math.abs(value)) : `${Math.abs(value)}${suffix}`}
    </span>
  );
}

export function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

/** Placeholder for a photo: the demo has no real images, so it shows hatch + label. */
export function PhotoPlaceholder({ label, className, children }: { label?: string; className?: string; children?: React.ReactNode }) {
  return (
    <div className={cn("bv-hatch relative flex items-center justify-center overflow-hidden rounded-md bg-surface-2", className)} aria-hidden={!label}>
      {label && <span className="font-mono text-xs text-ink-muted">{label}</span>}
      {children}
    </div>
  );
}
