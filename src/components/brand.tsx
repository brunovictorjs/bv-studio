import { cn } from "@/lib/utils";

/** The <BV /> logo. Drawn with a CSS mask so it always takes the ink color of the theme. */
export function BrandMark({ className, label = "BV" }: { className?: string; label?: string }) {
  return <span role="img" aria-label={label} className={cn("bv-logo h-6 text-ink", className)} />;
}

/** <rótulo /> — code-tag label above a title. */
export function Tag({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("bv-tag", className)}>
      &lt;{children} /&gt;
    </span>
  );
}

/** Two-digit mono numeral (01, 02…) */
export function Numeral({ n, className }: { n: number; className?: string }) {
  return <span className={cn("font-mono text-ink-muted tabular", className)}>{String(n).padStart(2, "0")}</span>;
}
