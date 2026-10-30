import { errorResponse, parseBody, queries } from "@/server/registry";
import { readJson } from "@/server/http";

/**
 * POST /api/queries/:name
 * Body: { db, input, ctx } → { data }
 * Read-only computations (reports, availability, agenda) over the browser's data.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/queries/[name]">) {
  const { name } = await ctx.params;
  const handler = queries[name];
  if (!handler) return Response.json({ error: { code: "unknown_query", params: { name } } }, { status: 404 });
  try {
    const { db, input, ctx: reqCtx } = parseBody(await readJson(request));
    return Response.json({ data: handler(db, input, reqCtx) ?? null });
  } catch (err) {
    return errorResponse(err);
  }
}
