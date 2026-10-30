import type { DB, ID, Order, RequestCtx, Unit, User } from "@/lib/domain/types";

/** Error with a translatable code; the browser maps `code` to `errors.<code>`. */
export class DomainError extends Error {
  constructor(
    public code: string,
    public params: Record<string, string | number> = {},
    public status = 400,
  ) {
    super(code);
  }
}

export const fail = (code: string, params?: Record<string, string | number>): never => {
  throw new DomainError(code, params);
};

export function must<T>(value: T | undefined | null, code = "not_found"): T {
  if (value == null) throw new DomainError(code, {}, 404);
  return value;
}

export const getUnit = (db: DB, id: ID): Unit => must(db.units.find((u) => u.id === id), "unit_not_found");
export const getUser = (db: DB, id: ID): User => must(db.users.find((u) => u.id === id), "user_not_found");
export const getOrder = (db: DB, id: ID): Order => must(db.orders.find((o) => o.id === id), "order_not_found");

export function actor(db: DB, ctx: RequestCtx): User {
  if (!ctx.actorId) throw new DomainError("not_signed_in", {}, 401);
  return getUser(db, ctx.actorId);
}

export function requireRole(db: DB, ctx: RequestCtx, ...roles: User["roles"]): User {
  const u = actor(db, ctx);
  if (!u.roles.some((r) => roles.includes(r))) throw new DomainError("forbidden", {}, 403);
  return u;
}

/** Staff that can act on a unit: admins anywhere, desk/pros only on their own unit. */
export function requireUnitStaff(db: DB, ctx: RequestCtx, unitId: ID): User {
  const u = requireRole(db, ctx, "admin", "desk", "professional");
  if (!u.roles.includes("admin") && u.unitId !== unitId) throw new DomainError("forbidden_unit", {}, 403);
  return u;
}

export const fullName = (u: Pick<User, "firstName" | "lastName">) => `${u.firstName} ${u.lastName}`.trim();

export type ActionFn<I = unknown, R = unknown> = (db: DB, input: I, ctx: RequestCtx) => R;
export type QueryFn<I = unknown, R = unknown> = (db: DB, input: I, ctx: RequestCtx) => R;
