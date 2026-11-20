/**
 * Raw RFC 822 source as carried on a Message: the exact wire bytes from IMAP
 * ingestion (Buffer), or text Noctua built itself (drafts, sent copies).
 * Byte consumers (MIME parsing, attachment extraction, APPEND, .eml export)
 * must use the bytes; only display and header-level text checks use the text.
 */
export type RawMessageSource = string | Buffer;

/** UTF-8 text view. Lossy for 8bit parts in other charsets; never write it back. */
export function rawMessageSourceText(source: RawMessageSource): string {
  return typeof source === "string" ? source : source.toString("utf8");
}

export function rawMessageSourceBytes(source: RawMessageSource): Buffer {
  return typeof source === "string" ? Buffer.from(source, "utf8") : source;
}
