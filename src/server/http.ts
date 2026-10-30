import { gunzipSync } from "node:zlib";

/** Reads a JSON body that the browser may have gzipped (the demo database travels on every call). */
export async function readJson(request: Request): Promise<unknown> {
  const buf = Buffer.from(await request.arrayBuffer());
  const gz = request.headers.get("content-encoding") === "gzip" || (buf[0] === 0x1f && buf[1] === 0x8b);
  return JSON.parse((gz ? gunzipSync(buf) : buf).toString("utf8"));
}
