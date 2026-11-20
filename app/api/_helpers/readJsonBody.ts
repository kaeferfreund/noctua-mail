import { NextResponse } from "next/server";
import { BodyReadTimeoutError, readBoundedBody } from "./readAuthJson";
import { REQUEST_BODY_TIMEOUT, REQUEST_BODY_TOO_LARGE } from "@/lib/requestBodyErrors";

const MIB = 1024 * 1024;

/** Byte caps for JSON request bodies of API routes. */
export const JSON_BODY_LIMITS = {
  /** Ordinary API payloads, including bulk id lists of a large selection. */
  default: 4 * MIB,
  /** Calendar files imported as text. */
  calendar: 16 * MIB,
  /** Drafts and sends carry attachments as base64 data URLs (about 25 MiB of files). */
  compose: 36 * MIB
} as const;

/** Total time a JSON body may take to arrive (not a stall timeout). */
export const JSON_BODY_TIMEOUT_MS = {
  default: 60_000,
  /** The largest compose body needs about 2.5 Mbit/s sustained. */
  compose: 120_000
} as const;

export type JsonBodyResult<T> = { ok: true; value: T | null } | { ok: false; response: NextResponse };

/**
 * The shared replacement for `request.json()` in API routes: reads at most
 * `limit` bytes within `timeoutMs`. An empty or malformed body gives
 * `value: null` (routes validate the shape and answer 400); an oversized body
 * gives a 413 response and a stalled one a 408 response, without buffering
 * the rest. Call it after the session and mailbox checks.
 */
export async function readJsonBody<T = unknown>(
  request: Request,
  { limit = JSON_BODY_LIMITS.default, timeoutMs = JSON_BODY_TIMEOUT_MS.default }: { limit?: number; timeoutMs?: number } = {}
): Promise<JsonBodyResult<T>> {
  let bytes: Uint8Array | null;
  try {
    bytes = await readBoundedBody(request, limit, timeoutMs);
  } catch (error) {
    if (error instanceof BodyReadTimeoutError) {
      return { ok: false, response: NextResponse.json(
        { ok: false, message: "Request body timed out", code: REQUEST_BODY_TIMEOUT },
        { status: 408 }
      ) };
    }
    // A body that was aborted or already consumed reads like an empty one.
    return { ok: true, value: null };
  }
  if (!bytes) {
    return { ok: false, response: NextResponse.json(
        { ok: false, message: "Request body too large", code: REQUEST_BODY_TOO_LARGE },
        { status: 413 }
      ) };
  }
  try {
    return { ok: true, value: JSON.parse(new TextDecoder().decode(bytes)) as T };
  } catch {
    return { ok: true, value: null };
  }
}
