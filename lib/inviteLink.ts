// The sign-up link carries the one-time invite code in the URL fragment: browsers
// never send the fragment to the server, so the code stays out of access logs and
// Referer headers. The login screen reads it once and removes it from the address bar.
const INVITE_FRAGMENT_KEY = "invite";

export function inviteSignupUrl(origin: string, code: string): string {
  return `${new URL("/", origin).href}#${new URLSearchParams({ [INVITE_FRAGMENT_KEY]: code })}`;
}

export function inviteCodeFromFragment(hash: string): string | null {
  const code = new URLSearchParams(hash.replace(/^#/, "")).get(INVITE_FRAGMENT_KEY)?.trim();
  return code || null;
}

/** Only absolute http(s) URLs (e.g. a recovery link) are offered as a QR code. */
export function isWebUrl(value: string): boolean {
  try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; }
}
