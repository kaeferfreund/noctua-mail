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

/** The fragment without an invite code; unrelated fragments pass through unchanged. */
export function withoutInviteFragment(hash: string): string {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  if (!params.has(INVITE_FRAGMENT_KEY)) return hash;
  params.delete(INVITE_FRAGMENT_KEY);
  const rest = params.toString();
  return rest ? `#${rest}` : "";
}

/**
 * Reads the invite code of a scanned link once at app start and removes it from the
 * address bar and the current history entry, whether or not someone is signed in.
 */
export function takeInviteCodeFromLocation(): string | null {
  const code = inviteCodeFromFragment(window.location.hash);
  if (window.location.hash !== withoutInviteFragment(window.location.hash)) {
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}${withoutInviteFragment(window.location.hash)}`);
  }
  return code;
}

/** Only absolute http(s) URLs (e.g. a recovery link) are offered as a QR code. */
export function isWebUrl(value: string): boolean {
  try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; }
}
