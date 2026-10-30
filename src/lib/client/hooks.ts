"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ERRORS } from "@/i18n/common";
import { interpolate, useT } from "@/i18n";
import { ApiError, callAction, runQuery, type Actor } from "./api";
import { store, useStore } from "./store";
import type { DB, User } from "@/lib/domain/types";
import type { Q } from "./q";

export function useDb(): DB | null {
  return useStore((s) => s.db);
}

export function useSession() {
  return useStore((s) => s.session);
}

export function useStaff(): User | null {
  return useStore((s) => s.db?.users.find((u) => u.id === s.session.staffId) ?? null);
}

export function usePro(): User | null {
  return useStore((s) => s.db?.users.find((u) => u.id === s.session.proId) ?? null);
}

export function useClient(): User | null {
  return useStore((s) => s.db?.users.find((u) => u.id === s.session.clientId) ?? null);
}

export function useErrorText() {
  const { t } = useT();
  return useCallback(
    (err: unknown) => {
      if (err instanceof ApiError) {
        const msg = ERRORS[err.code];
        const params = { ...err.params };
        delete params.list;
        return msg ? t(msg, params) : t(ERRORS.unexpected);
      }
      return t(ERRORS.unexpected);
    },
    [t],
  );
}

/**
 * Server-computed view of the browser database. Re-runs when the database
 * changes (rev) or the input changes; keeps the previous data while loading.
 */
export function useQuery<R>(name: string, input: unknown, actor: Actor, opts: { enabled?: boolean } = {}) {
  const rev = useStore((s) => s.rev);
  const locale = useStore((s) => s.locale);
  const ready = useStore((s) => s.ready);
  const key = JSON.stringify(input);
  // identifies one fetch: input + database revision + language
  const fetchId = `${name}|${key}|${rev}|${locale}`;
  const [state, setState] = useState<{ data: R | null; error: ApiError | null; key: string; fetchId: string }>({
    data: null,
    error: null,
    key: "",
    fetchId: "",
  });
  const enabled = opts.enabled !== false && ready;
  const seq = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    const my = ++seq.current;
    runQuery<R>(name, JSON.parse(key), actor)
      .then((data) => {
        if (my === seq.current) setState({ data, error: null, key, fetchId });
      })
      .catch((error: ApiError) => {
        if (my === seq.current) setState((s) => ({ data: s.key === key ? s.data : null, error, key, fetchId }));
      });
  }, [name, key, actor, fetchId, enabled]);

  return { data: state.data, error: state.error, loading: !enabled || state.fetchId !== fetchId, stale: state.key !== key };
}

/** Wraps a server action with pending state and error toasts. */
export function useAction(actor: Actor) {
  const errorText = useErrorText();
  const [pending, setPending] = useState<string | null>(null);
  const run = useCallback(
    async <R = unknown>(
      name: string,
      input: unknown,
      opts: { success?: string; silentError?: boolean; onError?: (e: ApiError) => void } = {},
    ): Promise<R | undefined> => {
      setPending(name);
      try {
        const r = await callAction<R>(name, input, actor);
        if (opts.success) toast.success(opts.success);
        return r;
      } catch (e) {
        const err = e instanceof ApiError ? e : new ApiError("unexpected");
        opts.onError?.(err);
        if (!opts.silentError) toast.error(errorText(err));
        return undefined;
      } finally {
        setPending(null);
      }
    },
    [actor, errorText],
  );
  return { run, pending, busy: pending !== null };
}

export function conflictList(err: ApiError): { id: string; code: string; client: string; start: string }[] {
  try {
    return JSON.parse(String(err.params.list ?? "[]"));
  } catch {
    return [];
  }
}

export { store, interpolate };

/** Ticks every `ms` so clocks and "há N min" labels stay fresh. */
export function useNow(ms = 30000) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((x) => x + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

/** Typed shortcut over useQuery for the registered server queries. */
export function useQ<K extends keyof Q>(name: K, input: unknown, actor: Actor, opts?: { enabled?: boolean }) {
  return useQuery<Q[K]>(name, input, actor, opts);
}

/** Wall clock in ms that re-renders every `ms` (keeps render pure). */
export function useClock(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}
