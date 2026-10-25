/**
 * Selection and sequential apply loop for `scripts/spam-apply.ts`: moves INBOX
 * messages the eval marked as spam into Junk (doc/SPAM-DETECTION.md). Pure —
 * the script injects the row lookup and the move, so tests need no IMAP or DB.
 */
export type SpamEvalDecision = "spam" | "ham" | "unsure";

/** One evaluated item as written by `scripts/spam-eval.ts --out`. */
export type SpamEvalRecord = {
  accountId: string;
  id: string;
  label: "spam" | "ham";
  decision: SpamEvalDecision;
  source: string;
  confidence: number | null;
  subject: string;
  fromEmail: string | null;
  mailboxPath: string | null;
  serverSpamFlag: boolean;
};

export type SpamApplyFilters = {
  label: SpamEvalRecord["label"];
  decision: SpamEvalDecision;
  accountId?: string | null;
};

/** changed: the lookup reports that the mail changed since it was selected (the rescan's re-check); it stays. */
export type SpamApplyResult = "moved" | "would-move" | "missing" | "not-in-inbox" | "changed" | "error";

export const isInboxPath = (mailboxPath: string | null | undefined) => (mailboxPath ?? "").toUpperCase() === "INBOX";

/** Accepts the eval output (`{ items: [...] }`) or a bare array; drops malformed entries. */
export function parseSpamEvalRecords(json: unknown): SpamEvalRecord[] {
  const list = Array.isArray(json) ? json : (json as { items?: unknown })?.items;
  if (!Array.isArray(list)) throw new Error("Input must be the JSON written by spam-eval --out ({ items: [...] })");
  return list.filter((entry): entry is SpamEvalRecord =>
    !!entry && typeof entry === "object" && typeof entry.accountId === "string" && typeof entry.id === "string"
    && typeof entry.label === "string" && typeof entry.decision === "string");
}

/** Items matching label, decision and (optionally) account; each message once. */
export function selectSpamApplyItems(records: SpamEvalRecord[], filters: SpamApplyFilters) {
  const seen = new Set<string>();
  return records.filter((record) => {
    if (record.label !== filters.label || record.decision !== filters.decision) return false;
    if (filters.accountId && record.accountId !== filters.accountId) return false;
    const key = `${record.accountId}\u0000${record.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Sequential on purpose (gentle with IMAP). `lookup` returns the current row
 * (null when it no longer exists); only rows still in the INBOX are moved.
 * A failed move is reported and the loop continues. `onResult` sees every
 * item's outcome (the rescan stores it); `isCancelled` stops before the next item.
 */
export async function applySpamItems<T extends SpamEvalRecord>(items: T[], deps: {
  dryRun: boolean;
  lookup: (item: T) => Promise<{ mailboxPath: string | null; changed?: boolean } | null>;
  move: (item: T) => Promise<string | void>;
  log?: (line: string) => void;
  onResult?: (item: T, result: SpamApplyResult) => Promise<void> | void;
  isCancelled?: () => boolean;
}) {
  const counts: Record<SpamApplyResult, number> = { moved: 0, "would-move": 0, missing: 0, "not-in-inbox": 0, changed: 0, error: 0 };
  const log = deps.log ?? console.log;
  for (const item of items) {
    if (deps.isCancelled?.()) break;
    let result: SpamApplyResult;
    let detail = "";
    try {
      const row = await deps.lookup(item);
      if (!row) result = "missing";
      else if (!isInboxPath(row.mailboxPath)) { result = "not-in-inbox"; detail = ` (${row.mailboxPath ?? "?"})`; }
      else if (row.changed) result = "changed";
      else if (deps.dryRun) result = "would-move";
      else { const target = await deps.move(item); result = "moved"; if (target) detail = ` → ${target}`; }
    } catch (error) {
      result = "error";
      detail = `: ${error instanceof Error ? error.message : String(error)}`;
    }
    counts[result] += 1;
    log(`${item.subject || "(kein Betreff)"} — ${item.fromEmail ?? "?"} — ${result}${detail}`);
    await deps.onResult?.(item, result);
  }
  return counts;
}
