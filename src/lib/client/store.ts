"use client";

import { useSyncExternalStore } from "react";
import { nowLocal } from "@/lib/domain/time";
import type { DB, Locale, Session } from "@/lib/domain/types";

/**
 * Browser-side persistence. The whole demo database lives in localStorage so
 * every visitor always has data to explore and their changes survive reloads.
 */

const DB_KEY = "bv-scheduling:db";
const SESSION_KEY = "bv-scheduling:session";
const LOCALE_KEY = "bv-scheduling:locale";

export const DB_VERSION = 3;

interface State {
  db: DB | null;
  /** bumps on every write so cached queries know to refetch */
  rev: number;
  session: Session;
  locale: Locale;
  ready: boolean;
}

const DEFAULT_SESSION: Session = { staffId: "a-ana", clientId: "cl-mariana-lopes", proId: "p-rafael" };

let state: State = { db: null, rev: 0, session: DEFAULT_SESSION, locale: "pt", ready: false };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage full or blocked: the demo keeps working in memory
  }
}

export const store = {
  get: () => state,
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  /** Loads persisted state; returns false when a fresh seed is needed. */
  hydrate(): boolean {
    let db: DB | null = null;
    const raw = safeGet(DB_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as DB;
        // demo data is relative to "today": regenerate it once the day changes
        if (parsed.version === DB_VERSION && parsed.seededAt?.slice(0, 10) === nowLocal().slice(0, 10)) db = parsed;
      } catch {
        db = null;
      }
    }
    let session = DEFAULT_SESSION;
    try {
      session = { ...DEFAULT_SESSION, ...JSON.parse(safeGet(SESSION_KEY) ?? "{}") };
    } catch {
      /* default */
    }
    const savedLocale = safeGet(LOCALE_KEY);
    const locale: Locale =
      savedLocale === "en" || savedLocale === "pt"
        ? savedLocale
        : typeof navigator !== "undefined" && !navigator.language.toLowerCase().startsWith("pt")
          ? "en"
          : "pt";
    state = { ...state, db, session, locale, ready: !!db, rev: state.rev + 1 };
    emit();
    return !!db;
  },
  setDb(db: DB) {
    state = { ...state, db, rev: state.rev + 1, ready: true };
    safeSet(DB_KEY, JSON.stringify(db));
    emit();
  },
  setSession(patch: Partial<Session>) {
    state = { ...state, session: { ...state.session, ...patch }, rev: state.rev + 1 };
    safeSet(SESSION_KEY, JSON.stringify(state.session));
    emit();
  },
  setLocale(locale: Locale) {
    state = { ...state, locale };
    safeSet(LOCALE_KEY, locale);
    if (typeof document !== "undefined") document.documentElement.lang = locale === "pt" ? "pt-BR" : "en";
    emit();
  },
  reset() {
    try {
      localStorage.removeItem(DB_KEY);
      localStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
    state = { ...state, db: null, session: DEFAULT_SESSION, ready: false, rev: state.rev + 1 };
    emit();
  },
};

const serverState: State = { db: null, rev: 0, session: DEFAULT_SESSION, locale: "pt", ready: false };

export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.get()),
    () => selector(serverState),
  );
}
