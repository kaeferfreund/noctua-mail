import { NextResponse } from "next/server";

/** Small self-service auth payloads, including their JSON whitespace, are capped in bytes. */
export const AUTH_JSON_BODY_LIMIT = 16 * 1024;

/** Preserve JSON parse errors for each caller's existing error handling. */
export async function readAuthJson(request: Request): Promise<unknown> {
  const bytes = new Uint8Array(AUTH_JSON_BODY_LIMIT);
  let length = 0;
  const reader = request.body?.getReader();
  if (reader) {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value.byteLength > AUTH_JSON_BODY_LIMIT - length) {
          // Check before copying: never retain an oversized chunk in the JSON buffer.
          await reader.cancel().catch(() => {});
          return NextResponse.json({ ok: false, code: "payload_too_large" }, {
            status: 413, headers: { "Cache-Control": "no-store" }
          });
        }
        bytes.set(value, length);
        length += value.byteLength;
      }
    } finally {
      reader.releaseLock();
    }
  }
  return JSON.parse(new TextDecoder().decode(bytes.subarray(0, length)));
}
