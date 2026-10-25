import type { AccountSettings, AutoMarkReadMode, UserAccountPrefs } from "./data";

/**
 * Options of the personal "mark opened messages read" preference. `\Seen` is
 * shared IMAP state, so a message read here is read for every mailbox member.
 */
export const AUTO_MARK_READ_MODES = ["immediate", "after1s", "after3s", "never"] as const satisfies readonly AutoMarkReadMode[];

/** One second of dwell, so skimming with the arrow keys does not mark every message. */
export const DEFAULT_AUTO_MARK_READ_MODE: AutoMarkReadMode = "after1s";

const DELAY_MS: Record<AutoMarkReadMode, number | null> = {
  immediate: 0,
  after1s: 1000,
  after3s: 3000,
  never: null
};

function isAutoMarkReadMode(value: unknown): value is AutoMarkReadMode {
  return typeof value === "string" && (AUTO_MARK_READ_MODES as readonly string[]).includes(value);
}

/** Resolution order as for every personal preference: default < mailbox setting < user preference. */
export function resolveAutoMarkReadMode(
  settings: Pick<AccountSettings, "reading"> | undefined,
  prefs: Pick<UserAccountPrefs, "reading"> | undefined
): AutoMarkReadMode {
  const personal = prefs?.reading?.autoMarkRead;
  if (isAutoMarkReadMode(personal)) return personal;
  const mailbox = settings?.reading?.autoMarkRead;
  return isAutoMarkReadMode(mailbox) ? mailbox : DEFAULT_AUTO_MARK_READ_MODE;
}

/** Dwell before an opened message is marked read; `null` means never (manual only). */
export function autoMarkReadDelayMs(mode: AutoMarkReadMode): number | null {
  return DELAY_MS[mode];
}
