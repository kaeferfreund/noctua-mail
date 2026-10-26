/** Setup is temporary, even when ordinary requests slide the library expiry. */
export const SETUP_SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function effectiveSessionExpiry(session: { expiresAt: Date | string | number; createdAt: Date | string | number }, assurance: "setup" | "mfa") {
  const sliding = new Date(session.expiresAt).getTime();
  return assurance === "setup" ? Math.min(sliding, new Date(session.createdAt).getTime() + SETUP_SESSION_MAX_AGE_MS) : sliding;
}
