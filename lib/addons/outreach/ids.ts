import { randomBytes, randomUUID } from "crypto";

/** Row ids of the addon: `<prefix>_<uuid>` (prefixes: con, lst, tpl, cmp, seq, stp, enr, snd, tok). */
export function newOutreachId(prefix: string) {
  return `${prefix}_${randomUUID()}`;
}

/**
 * Public token of a `/t/*` link and secret of a subscribe API token: 160 random bits,
 * URL-safe. It is the only thing a recipient sees; it carries no data.
 */
export function newOutreachToken() {
  return randomBytes(20).toString("base64url");
}
