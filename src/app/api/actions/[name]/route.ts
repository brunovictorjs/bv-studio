import { actions, errorResponse, parseBody } from "@/server/registry";
import { readJson } from "@/server/http";

/**
 * POST /api/actions/:name
 * Body: { db, input, ctx } → { db, result }
 * The browser owns the data; the server owns the rules. Each call receives the
 * current database, validates and applies one business action, and returns
 * the new state for the browser to persist.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/actions/[name]">) {
  const { name } = await ctx.params;
  const handler = actions[name];
  if (!handler) return Response.json({ error: { code: "unknown_action", params: { name } } }, { status: 404 });
  try {
    const { db, input, ctx: reqCtx } = parseBody(await readJson(request));
    const result = handler(db, input, reqCtx);
    return Response.json({ db, result: result ?? null });
  } catch (err) {
    return errorResponse(err);
  }
}
