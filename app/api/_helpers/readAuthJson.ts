import { NextResponse } from "next/server";

/** Small self-service auth payloads, including their JSON whitespace, are capped in bytes. */
export const AUTH_JSON_BODY_LIMIT = 16 * 1024;

/**
 * Guards and auth reads run before the session check, so a body that stops
 * arriving (a stalled chunked upload) is abandoned instead of awaited.
 */
export const BODY_READ_TIMEOUT_MS = 10_000;

export class BodyReadTimeoutError extends Error {
  constructor() { super("Request body read timed out"); }
}

/**
 * Read at most `limit` body bytes. Returns null once the body is known to exceed
 * the limit (a larger declared Content-Length, or the first chunk that would
 * overflow), so a reject path never pulls the rest. Rejects with
 * BodyReadTimeoutError when the whole read does not finish within `timeoutMs`.
 * Both paths cancel the stream without awaiting it: a request stream's cancel
 * can wait for the client's next chunk, which a stalled client never sends.
 */
export async function readBoundedBody(request: Request, limit: number,
  timeoutMs = BODY_READ_TIMEOUT_MS): Promise<Uint8Array | null> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > limit) {
    void request.body?.cancel().catch(() => {});
    return null;
  }
  const bytes = new Uint8Array(limit);
  let length = 0;
  const reader = request.body?.getReader();
  if (reader) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new BodyReadTimeoutError()), timeoutMs);
    });
    deadline.catch(() => {});
    try {
      while (true) {
        const { done, value } = await Promise.race([reader.read(), deadline]);
        if (done) break;
        if (value.byteLength > limit - length) {
          // Check before copying: never retain an oversized chunk in the buffer.
          void reader.cancel().catch(() => {});
          return null;
        }
        bytes.set(value, length);
        length += value.byteLength;
      }
    } catch (error) {
      if (error instanceof BodyReadTimeoutError) void reader.cancel().catch(() => {});
      throw error;
    } finally {
      clearTimeout(timer);
      reader.releaseLock();
    }
  }
  return bytes.subarray(0, length);
}

/** Preserve JSON parse and body-timeout errors for each caller's existing error handling. */
export async function readAuthJson(request: Request): Promise<unknown> {
  const bytes = await readBoundedBody(request, AUTH_JSON_BODY_LIMIT);
  if (!bytes) {
    return NextResponse.json({ ok: false, code: "payload_too_large" }, {
      status: 413, headers: { "Cache-Control": "no-store" }
    });
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}
