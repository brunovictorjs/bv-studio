"use client";

import { nowLocal } from "@/lib/domain/time";
import type { DB, ID, RequestCtx } from "@/lib/domain/types";
import { store } from "./store";

export class ApiError extends Error {
  constructor(
    public code: string,
    public params: Record<string, string | number> = {},
  ) {
    super(code);
  }
}

/** Gzips the body when the browser supports it — the database rides along on every call. */
async function encode(payload: unknown): Promise<{ body: BodyInit; headers: Record<string, string> }> {
  const json = JSON.stringify(payload);
  if (typeof CompressionStream !== "undefined") {
    const stream = new Blob([json]).stream().pipeThrough(new CompressionStream("gzip"));
    const body = await new Response(stream).arrayBuffer();
    return { body, headers: { "Content-Type": "application/json", "Content-Encoding": "gzip" } };
  }
  return { body: json, headers: { "Content-Type": "application/json" } };
}

async function post<T>(url: string, payload: unknown): Promise<T> {
  const { body, headers } = await encode(payload);
  const res = await fetch(url, { method: "POST", body, headers });
  const data = await res.json().catch(() => ({ error: { code: "unexpected" } }));
  if (!res.ok || data.error) throw new ApiError(data.error?.code ?? "unexpected", data.error?.params ?? {});
  return data as T;
}

export type Actor = "staff" | "client" | "pro";

function ctxFor(actor: Actor): RequestCtx {
  const s = store.get();
  return {
    now: nowLocal(),
    locale: s.locale,
    actorId: (actor === "staff" ? s.session.staffId : actor === "pro" ? s.session.proId : s.session.clientId) as ID | null,
  };
}

/** Runs a business action on the server and persists the returned database. */
export async function callAction<R = unknown>(name: string, input: unknown, actor: Actor): Promise<R> {
  const db = store.get().db;
  if (!db) throw new ApiError("not_ready");
  const res = await post<{ db: DB; result: R }>(`/api/actions/${name}`, { db, input, ctx: ctxFor(actor) });
  store.setDb(res.db);
  return res.result;
}

export async function runQuery<R = unknown>(name: string, input: unknown, actor: Actor): Promise<R> {
  const db = store.get().db;
  if (!db) throw new ApiError("not_ready");
  const res = await post<{ data: R }>(`/api/queries/${name}`, { db, input, ctx: ctxFor(actor) });
  return res.data;
}

export async function fetchSeed(): Promise<DB> {
  const res = await fetch("/api/seed", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ now: nowLocal() }),
  });
  if (!res.ok) throw new ApiError("seed_failed");
  return (await res.json()).db as DB;
}
