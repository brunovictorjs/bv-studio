"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Children, useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useT, type Messages } from "@/i18n";
import { cn } from "@/lib/utils";

const M = {
  prev: ["Anterior", "Previous"],
  next: ["Próximo", "Next"],
  goTo: ["Ir para o item {n} de {total}", "Go to item {n} of {total}"],
  pause: ["Pausar rolagem automática", "Pause auto-advance"],
  play: ["Retomar rolagem automática", "Resume auto-advance"],
} satisfies Messages;

/** After someone touches the carousel, wait this long before auto-advancing again. */
const RESUME_AFTER_MS = 8000;

/**
 * Horizontal carousel that advances on its own and on interaction (arrows,
 * dots, swipe/scroll, keyboard). Auto-advance pauses while hovered, focused or
 * recently touched, when the tab is hidden, and never runs with reduced motion.
 */
export function AutoCarousel({
  title,
  label,
  children,
  interval = 4500,
  className,
}: {
  title?: React.ReactNode;
  /** accessible name of the carousel */
  label: string;
  children: React.ReactNode;
  interval?: number;
  className?: string;
}) {
  const { t } = useT();
  const track = useRef<HTMLDivElement>(null);
  const hovering = useRef(false);
  const focused = useRef(false);
  const lastTouch = useRef(0);
  const [active, setActive] = useState(0);
  const [stopped, setStopped] = useState(false);
  const items = Children.toArray(children);
  const count = items.length;

  const slides = () => Array.from(track.current?.children ?? []) as HTMLElement[];
  const padLeft = () => (track.current ? parseFloat(getComputedStyle(track.current).paddingLeft) || 0 : 0);
  const atEnd = () => {
    const el = track.current;
    return !el || el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
  };

  const goTo = useCallback((i: number) => {
    const el = track.current;
    const target = slides()[i];
    if (!el || !target) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: target.offsetLeft - padLeft(), behavior: reduce ? "auto" : "smooth" });
  }, []);

  const step = useCallback(
    (dir: 1 | -1) => {
      if (dir === 1 && atEnd()) return goTo(0);
      if (dir === -1 && active === 0) return goTo(count - 1);
      goTo(Math.max(0, Math.min(count - 1, active + dir)));
    },
    [active, count, goTo],
  );

  const touched = () => {
    lastTouch.current = Date.now();
  };

  // keep the active dot in sync with the scroll position (swipe, trackpad, buttons)
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (atEnd()) return setActive(count - 1);
        const x = el.scrollLeft + padLeft();
        let best = 0;
        slides().forEach((s, i) => {
          if (Math.abs(s.offsetLeft - x) < Math.abs(slides()[best].offsetLeft - x)) best = i;
        });
        setActive(best);
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [count]);

  // auto-advance
  useEffect(() => {
    if (stopped || count < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      if (hovering.current || focused.current || document.hidden) return;
      if (Date.now() - lastTouch.current < RESUME_AFTER_MS) return;
      const el = track.current;
      if (!el || el.scrollWidth <= el.clientWidth) return;
      step(1);
    }, interval);
    return () => clearInterval(id);
  }, [stopped, count, interval, step]);

  if (count === 0) return null;
  const scrollable = count > 1;

  return (
    <section
      aria-roledescription="carousel"
      aria-label={label}
      className={cn("flex flex-col gap-3", className)}
      onMouseEnter={() => (hovering.current = true)}
      onMouseLeave={() => (hovering.current = false)}
      onFocusCapture={() => (focused.current = true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) focused.current = false;
      }}
    >
      <div className="flex items-center justify-between gap-3">
        {title}
        {scrollable && (
          <div className="flex gap-1">
            <Button variant="outline" size="icon-sm" aria-label={t(M.prev)} onClick={() => (touched(), step(-1))}>
              <ChevronLeft />
            </Button>
            <Button variant="outline" size="icon-sm" aria-label={t(M.next)} onClick={() => (touched(), step(1))}>
              <ChevronRight />
            </Button>
          </div>
        )}
      </div>
      <div
        ref={track}
        tabIndex={0}
        aria-live={stopped ? "polite" : "off"}
        onPointerDown={touched}
        onWheel={touched}
        onKeyDown={(e) => {
          if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
          e.preventDefault();
          touched();
          step(e.key === "ArrowRight" ? 1 : -1);
        }}
        className="relative -mx-5 flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none] focus-visible:outline-offset-[-2px] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((child, i) => (
          <div
            key={i}
            role="group"
            aria-roledescription="slide"
            aria-label={t(M.goTo, { n: i + 1, total: count })}
            className="shrink-0 snap-start"
          >
            {child}
          </div>
        ))}
      </div>
      {scrollable && (
        <div className="flex items-center justify-center gap-1">
          {items.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={t(M.goTo, { n: i + 1, total: count })}
              aria-current={i === active ? "true" : undefined}
              onClick={() => (touched(), goTo(i))}
              className="flex h-6 items-center px-0.5"
            >
              <span className={cn("block h-1 rounded-[2px] transition-all duration-300", i === active ? "w-5 bg-ink" : "w-2 bg-hairline")} />
            </button>
          ))}
          <button
            type="button"
            onClick={() => setStopped((s) => !s)}
            aria-label={stopped ? t(M.play) : t(M.pause)}
            className="ml-2 flex h-6 items-center font-mono text-[11px] text-ink-muted hover:text-ink"
          >
            {stopped ? "▶" : "❚❚"}
          </button>
        </div>
      )}
    </section>
  );
}
