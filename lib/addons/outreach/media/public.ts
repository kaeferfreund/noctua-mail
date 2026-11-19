import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { Readable } from "node:stream";
import { getOutreachDb, outreachDbExists } from "../db";
import { servesDeliveredMail } from "../tracking/public";
import type { OutreachImageType } from "../types";
import { imageExtensions, imageFilename } from "./format";
import { outreachImageFile, outreachMediaDir } from "./index";

export async function outreachImageResponse(request: Request, filename: string) {
  const notFound = () => new Response(request.method === "HEAD" ? null : "Not found", {
    status: 404, headers: { "Cache-Control": "no-store" }
  });
  const match = imageFilename.exec(filename);
  if (!match || !servesDeliveredMail() || !outreachDbExists()) return notFound();
  const [, hash, extension] = match;
  try {
    const db = await getOutreachDb();
    // Public capability lookup: the content hash identifies the same bytes in every mailbox.
    const row = db.query(
      "SELECT contentType, bytes FROM images WHERE hash = ? LIMIT 1"
    ).get(hash) as { contentType: OutreachImageType; bytes: number } | null;
    if (!row || extension !== imageExtensions[row.contentType]) return notFound();

    const file = await open(/* turbopackIgnore: true */ outreachImageFile(outreachMediaDir(), hash, row.contentType),
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    let streaming = false;
    try {
      const stat = await file.stat();
      if (!stat.isFile() || stat.size !== row.bytes) return notFound();
      const etag = `"${hash}"`;
      const headers = new Headers({
        "Content-Type": row.contentType,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Disposition": "inline",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Cross-Origin-Resource-Policy": "cross-origin",
        "ETag": etag
      });
      const cacheMatch = request.headers.get("if-none-match")?.split(",").some(value => {
        const tag = value.trim();
        return tag === "*" || tag.replace(/^W\//, "") === etag;
      });
      if (cacheMatch) return new Response(null, { status: 304, headers });
      headers.set("Content-Length", String(row.bytes));
      if (request.method === "HEAD" || stat.size === 0) return new Response(null, { headers });
      const stream = file.createReadStream({ start: 0, end: stat.size - 1, autoClose: true });
      try {
        const body = Readable.toWeb(stream, { strategy: {
          highWaterMark: stream.readableHighWaterMark,
          size: (chunk: Uint8Array) => chunk.byteLength
        } });
        // Node's stream/web and DOM typings differ for the same runtime stream.
        const response = new Response(body as unknown as ReadableStream<Uint8Array>, { headers });
        streaming = true;
        return response;
      } finally {
        if (!streaming) stream.destroy();
      }
    } finally {
      if (!streaming) await file.close();
    }
  } catch {
    return notFound();
  }
}
