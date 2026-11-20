import type { AccountSettings } from "@/lib/data";

/** Default watched folder sessions per IMAP stream (INBOX plus recent folders). */
export const DEFAULT_IMAP_STREAM_MAX_IDLE = 3;
/** Default interval for polling unwatched folders on a stream. */
export const DEFAULT_IMAP_STREAM_POLL_MS = 900_000; // 15 minutes
const MAX_IDLE_RANGE = { min: 1, max: 8 } as const;
const POLL_MS_RANGE = { min: 60_000, max: 24 * 60 * 60 * 1000 } as const;

function clampSetting(value: unknown, range: { min: number; max: number }, fallback: number) {
  const number = typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : NaN;
  if (!(number > 0)) return fallback;
  return Math.min(range.max, Math.max(range.min, number));
}

/**
 * Connection and polling budget of one IMAP stream. Server-owned: the mailbox
 * settings decide, never request parameters, and both stay inside fixed bounds so
 * a stream cannot open many upstream sessions or poll the mail server rapidly.
 */
export function resolveImapStreamBudget(sync: AccountSettings["sync"] | undefined) {
  return {
    maxIdleSessions: clampSetting(sync?.maxIdleSessions, MAX_IDLE_RANGE, DEFAULT_IMAP_STREAM_MAX_IDLE),
    pollIntervalMs: clampSetting(sync?.backgroundPollIntervalMs || sync?.pollIntervalMs,
      POLL_MS_RANGE, DEFAULT_IMAP_STREAM_POLL_MS)
  };
}
