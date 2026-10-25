/**
 * Shapes of the admin's "Posteingang jetzt prüfen" (doc/SPAM-DETECTION.md,
 * rescan.ts), shared by the routes and the admin UI. No server imports.
 */
export const SPAM_RESCAN_PERIODS = ["30d", "12m", "all"] as const;
export type SpamRescanPeriod = (typeof SPAM_RESCAN_PERIODS)[number];

/** At most this many mails go to the model per rescan; another run continues with the rest (checked rows are skipped). */
export const SPAM_RESCAN_MODEL_MAX = 2_000;
/** Stored preview items per rescan; more are counted, not listed. */
export const SPAM_RESCAN_ITEM_LIMIT = 5_000;

const DAY_MS = 24 * 60 * 60_000;

/** The range by `dateValue` (the sender's Date header, as the sweep's window); null: the whole INBOX. */
export function spamRescanSince(period: SpamRescanPeriod, now = Date.now()) {
  return period === "30d" ? now - 30 * DAY_MS : period === "12m" ? now - 365 * DAY_MS : null;
}

export const isSpamRescanPeriod = (value: unknown): value is SpamRescanPeriod =>
  typeof value === "string" && (SPAM_RESCAN_PERIODS as readonly string[]).includes(value);

/** running: scan; ready: preview available; moving: the reviewed selection is being moved. */
export type SpamRescanStatus = "running" | "ready" | "moving" | "cancelled" | "failed";
export type SpamRescanPhase = "server-flag" | "classifier" | "moving";
export type SpamRescanStage = "server-flag" | "classifier";
/** pending: selected for the running move; gone: no longer in the INBOX; changed: kept because the mail changed since the scan. */
export type SpamRescanMoveStatus = "pending" | "moved" | "gone" | "changed" | "error";
/** Why the model step did not run although it was requested. */
export type SpamRescanModelBlock = "detection-off" | "mailbox-off" | "missing-key" | "unsupported-provider";

export type SpamRescanCounts = {
  /** INBOX rows in the range. */
  inboxRows?: number;
  /** Server-flagged INBOX mail in the range, and how many of them the conservative rules select. */
  serverFlagged?: number;
  serverFlagSelected?: number;
  /** Server-flagged mail kept by an exclusion, per first exclusion (serverFlagBackfill.ts). */
  serverFlagExcluded?: Record<string, number>;
  /** Unchecked rows handed to the classifier and how many of them reached the model. */
  modelChecked?: number;
  modelCalls?: number;
  modelBlocked?: SpamRescanModelBlock;
  /** INBOX mail in the range marked „Verdächtig“ after the classifier step. */
  classifierMarked?: number;
  items?: number;
  /** More hits than SPAM_RESCAN_ITEM_LIMIT: the rest is not listed. */
  truncated?: boolean;
  moved?: number;
  gone?: number;
  changed?: number;
  errors?: number;
};

export type SpamRescanJob = {
  id: string;
  accountId: string;
  status: SpamRescanStatus;
  period: SpamRescanPeriod;
  withModel: boolean;
  modelLimit: number;
  phase: SpamRescanPhase | null;
  processed: number;
  total: number;
  counts: SpamRescanCounts;
  /** interrupted: a restart or shutdown stopped it; cancelled-by-user is status "cancelled" without error. */
  error: "interrupted" | "failed" | null;
  createdByUserId: string;
  createdAt: number;
  updatedAt: number;
  finishedAt: number | null;
};

export type SpamRescanItem = {
  /** Message row id. */
  id: string;
  from: string;
  subject: string;
  date: string;
  dateValue: number;
  stage: SpamRescanStage;
  /** server-flag: empty; classifier: the stored reasons (German, from the model or the rules). */
  reasons: string[];
  /** server-flag: the SpamAssassin score; classifier: the confidence. */
  score: number | null;
  moveStatus: SpamRescanMoveStatus | null;
};

/** What the dialog shows before the start (GET …/spam-rescan?period=). */
export type SpamRescanPreview = {
  period: SpamRescanPeriod;
  inboxRows: number;
  /** Unchecked rows in the range: an upper bound of the model calls (allowlist and rules decide some without it). */
  unchecked: number;
  /** What a start sends to the model at most: min(unchecked, SPAM_RESCAN_MODEL_MAX). */
  modelLimit: number;
  modelBlocked: SpamRescanModelBlock | null;
  hasJunkFolder: boolean;
};

/** One running job in the activity panel (GET /api/admin/spam-rescan). */
export type SpamRescanActivity = Pick<SpamRescanJob, "id" | "accountId" | "status" | "phase" | "processed" | "total" | "updatedAt"> & {
  /** The mailbox's name or address (the admin may not be a member of it). */
  mailbox: string;
};

/** The browser event the admin dialog fires after a start, cancel or move, so the activity panel refreshes at once. */
export const SPAM_RESCAN_EVENT = "noctua:spam-rescan";
