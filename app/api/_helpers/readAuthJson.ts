import { NextResponse } from "next/server";

/** Small self-service auth payloads, including their JSON whitespace, are capped in bytes. */
export const AUTH_JSON_BODY_LIMIT = 16 * 1024;

/**
 * Read at most `limit` body bytes. Returns null once the body is known to exceed
 * the limit (a larger declared Content-Length, or the first chunk that would
 * overflow) after cancelling the stream, so a reject path never pulls the rest.
 */
export async function readBoundedBody(request: Request, limit: number): Promise<Uint8Array | null> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > limit) {
    await request.body?.cancel().catch(() => {});
    return null;
  }
  const bytes = new Uint8Array(limit);
  let length = 0;
  const reader = request.body?.getReader();
  if (reader) {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value.byteLength > limit - length) {
          // Check before copying: never retain an oversized chunk in the buffer.
          await reader.cancel().catch(() => {});
          return null;
        }
        bytes.set(value, length);
        length += value.byteLength;
      }
    } finally {
      reader.releaseLock();
    }
  }
  return bytes.subarray(0, length);
}

/** Preserve JSON parse errors for each caller's existing error handling. */
export async function readAuthJson(request: Request): Promise<unknown> {
  const bytes = await readBoundedBody(request, AUTH_JSON_BODY_LIMIT);
  if (!bytes) {
    return NextResponse.json({ ok: false, code: "payload_too_large" }, {
      status: 413, headers: { "Cache-Control": "no-store" }
    });
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}
