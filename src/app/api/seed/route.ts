import { errorResponse } from "@/server/registry";
import { buildSeed } from "@/server/seed";

/** POST /api/seed { now } → { db } — fresh demo data relative to the browser's "now". */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { now?: string };
    const now = body.now && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(body.now) ? body.now : new Date().toISOString().slice(0, 16);
    return Response.json({ db: buildSeed(now) });
  } catch (err) {
    return errorResponse(err);
  }
}
