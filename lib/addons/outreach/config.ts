/**
 * Outreach addon (newsletter, sequences, open/click tracking).
 *
 * The addon is off unless `NOCTUA_ADDON_OUTREACH=1`. Off means: its routes answer 404,
 * no scheduler starts, no MCP tool is registered, no UI entry shows and outgoing mail is
 * byte-identical to a build without the addon. See doc/ADDON-OUTREACH.md.
 */
export function outreachAddonEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.NOCTUA_ADDON_OUTREACH === "1";
}

function parseOrigin(value: string | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Origin that recipients' mail clients reach for `/t/*` (pixel, click, unsubscribe).
 * `NOCTUA_OUTREACH_PUBLIC_URL` when set (recommended: a hostname the reverse proxy routes
 * only to `/t/*`), otherwise the canonical app origin. `null` when neither is a valid URL:
 * callers must then send untracked instead of failing the send.
 */
export function outreachPublicOrigin(env: Record<string, string | undefined> = process.env): string | null {
  return parseOrigin(env.NOCTUA_OUTREACH_PUBLIC_URL) ?? parseOrigin(env.BETTER_AUTH_URL);
}

/** Full IPs are kept this long before the retention pass truncates them; per mailbox override in settings. */
export const OUTREACH_DEFAULT_IP_RETENTION_DAYS = 90;
/** Default throttle for campaign and sequence sends of one mailbox. */
export const OUTREACH_DEFAULT_SEND_RATE_PER_MINUTE = 30;
