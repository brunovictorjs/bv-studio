"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Fades the page content in on every route change. */
export function PageTransition({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  useGSAP(
    () => {
      if (reduced() || !ref.current) return;
      gsap.fromTo(ref.current, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.45, ease: "power2.out" });
      const items = ref.current.querySelectorAll("[data-anim]");
      if (items.length)
        gsap.fromTo(items, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: "power2.out", stagger: 0.05, delay: 0.05 });
    },
    { dependencies: [pathname], scope: ref },
  );
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

/** Staggers `[data-anim]` children whenever `deps` change (lists that load later). */
export function Stagger({ children, deps = [], className, as: Tag = "div" }: { children: React.ReactNode; deps?: unknown[]; className?: string; as?: "div" | "ul" | "section" }) {
  const ref = useRef<HTMLElement>(null);
  useGSAP(
    () => {
      if (reduced() || !ref.current) return;
      const items = ref.current.querySelectorAll(":scope > [data-anim], :scope > * > [data-anim]");
      if (items.length) gsap.fromTo(items, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.035, ease: "power2.out" });
    },
    { dependencies: deps, scope: ref },
  );
  return (
    <Tag ref={ref as never} className={className}>
      {children}
    </Tag>
  );
}

/** Counts up to `value` (used on KPI numbers). */
export function CountUp({ value, format, className }: { value: number; format: (n: number) => string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(0);
  const fmtRef = useRef(format);
  const animating = useRef(false);
  useEffect(() => {
    fmtRef.current = format;
  });
  const [text, setText] = useState(() => format(value));
  useEffect(() => {
    const format = fmtRef.current;
    if (reduced()) {
      setText(format(value));
      prev.current = value;
      return;
    }
    const obj = { n: prev.current };
    animating.current = true;
    const tween = gsap.to(obj, {
      n: value,
      duration: 0.9,
      ease: "power2.out",
      onUpdate: () => setText(fmtRef.current(Math.round(obj.n))),
      onComplete: () => {
        animating.current = false;
        setText(fmtRef.current(value));
      },
    });
    prev.current = value;
    return () => {
      tween.kill();
      animating.current = false;
    };
  }, [value]);
  // locale/currency changed without a new value
  const finalText = format(value);
  useEffect(() => {
    if (!animating.current) setText(finalText);
  }, [finalText]);
  return (
    <span ref={ref} className={cn("tabular", className)}>
      {text}
    </span>
  );
}

/** Bars that grow from the baseline. */
export function GrowBars({ children, deps = [], className }: { children: React.ReactNode; deps?: unknown[]; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      if (reduced() || !ref.current) return;
      gsap.fromTo(
        ref.current.querySelectorAll("[data-bar]"),
        { scaleY: 0, transformOrigin: "bottom" },
        { scaleY: 1, duration: 0.6, ease: "power3.out", stagger: 0.04 },
      );
    },
    { dependencies: deps, scope: ref },
  );
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

export { gsap, useGSAP };
