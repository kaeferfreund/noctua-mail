import { gzipSync } from "node:zlib";
import { NextResponse } from "next/server";

/**
 * JSON responses for the large list/detail reads, gzip-compressed when the
 * client accepts it.
 *
 * Next's `compress` option does not reach App Router route-handler responses
 * under Bun, so large API JSON (a 300-thread first page is ~860 KB) would
 * otherwise go out uncompressed. A reverse proxy that compresses on its own
 * (Caddy `encode`) leaves an already-encoded response alone.
 *
 * Only for JSON that carries no secrets or tokens; never for streams or
 * binary bodies.
 */

/** Below this size gzip saves too little to be worth the CPU and header bytes. */
export const COMPRESSED_JSON_MIN_BYTES = 8 * 1024;
/** Level 5: ~17x smaller on a large first page at ~3.5 ms CPU (level 6 gains <1 %). */
const GZIP_LEVEL = 5;

/** True when the Accept-Encoding header allows gzip (RFC 9110 §12.5.3, q=0 means "not acceptable"). */
export function acceptsGzip(header: string | null) {
  if (!header) return false;
  let gzipQuality: number | null = null;
  let wildcardQuality: number | null = null;
  for (const part of header.split(",")) {
    const [rawCoding, ...params] = part.split(";");
    const coding = rawCoding?.trim().toLowerCase();
    if (!coding) continue;
    let quality = 1;
    for (const param of params) {
      const [name, value] = param.split("=");
      if (name?.trim().toLowerCase() !== "q") continue;
      const parsed = Number(value?.trim());
      quality = Number.isFinite(parsed) ? parsed : 0;
    }
    if (coding === "gzip" || coding === "x-gzip") gzipQuality = Math.max(gzipQuality ?? 0, quality);
    else if (coding === "*") wildcardQuality = quality;
  }
  return (gzipQuality ?? wildcardQuality ?? 0) > 0;
}

/**
 * Same as `NextResponse.json(body, init)`, but a body of at least
 * `COMPRESSED_JSON_MIN_BYTES` is sent gzip-compressed when the request
 * accepts it. Headers from `init` (Cache-Control etc.) are kept.
 */
export function compressedJsonResponse(request: Request, body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("content-type", "application/json");
  headers.append("vary", "Accept-Encoding");
  const json = new TextEncoder().encode(JSON.stringify(body));
  if (json.byteLength < COMPRESSED_JSON_MIN_BYTES || !acceptsGzip(request.headers.get("accept-encoding"))) {
    return new NextResponse(json, { ...init, headers });
  }
  headers.set("content-encoding", "gzip");
  return new NextResponse(gzipSync(json, { level: GZIP_LEVEL }), { ...init, headers });
}
