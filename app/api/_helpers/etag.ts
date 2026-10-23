/** Weak file validator shared by the private byte responses (attachments, message source). */
export function entityTagForStat(stat: { mtimeMs: number; size: number }) {
  return `"${stat.mtimeMs.toString(16)}-${stat.size.toString(16)}"`;
}

function etagOpaqueTag(value: string) {
  const trimmed = value.trim();
  const withoutWeak = /^[wW]\//.test(trimmed) ? trimmed.slice(2).trim() : trimmed;
  return withoutWeak;
}

/** If-None-Match uses weak comparison: `W/"tag"` matches `"tag"`. */
export function ifNoneMatchMatches(header: string | null, etag: string) {
  if (!header) return false;
  const expected = etagOpaqueTag(etag);
  if (!expected) return false;
  return header.split(",").some((part) => etagOpaqueTag(part) === expected);
}
