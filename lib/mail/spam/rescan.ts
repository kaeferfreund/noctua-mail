import { randomUUID } from "crypto";
import { moveMessageToJunk } from "@/app/api/_helpers/message/junkMove";
import {
  addSpamRescanItems,
  beginSpamRescanMove,
  countSpamRescanRows,
  createSpamRescanJob,
  finishSpamRescanMove,
  getFolders,
  getLatestSpamRescanJob,
  getMessageById,
  getSpamRescanJob,
  listActiveSpamRescanJobs,
  listMarkedSpamMessages,
  listSpamRescanItems,
  listUncheckedSpamMessages,
  reconcileInterruptedSpamRescans,
  setSpamRescanItemMoveStatus,
  updateSpamRescanJob,
  type NewSpamRescanItem,
  type StoredSpamRescanItem,
  type StoredSpamRescanJob
} from "@/lib/db";
import { listAccessibleAccountsForUser } from "@/lib/accountAccess";
import type { Message } from "@/lib/data";
import { isNonJunkKeyword } from "@/lib/messageFlags";
import { getSourcesDir } from "@/lib/runtimePaths";
import { trackBackgroundWork } from "@/lib/server/backgroundWork";
import { findInboxFolder, findJunkFolder } from "@/lib/specialFolders";
import { applySpamItems, type SpamApplyResult, type SpamEvalRecord } from "./apply";
import { isSpamDetectionOn } from "./config";
import type { SpamExampleSource } from "./examples";
import { spamModelUnavailableReason } from "./provider";
import { SPAM_MAX_ATTEMPTS } from "./queue";
import {
  SPAM_RESCAN_ITEM_LIMIT,
  SPAM_RESCAN_MODEL_MAX,
  spamRescanSince,
  type SpamRescanActivity,
  type SpamRescanCounts,
  type SpamRescanModelBlock,
  type SpamRescanMoveStatus,
  type SpamRescanPeriod,
  type SpamRescanPhase,
  type SpamRescanPreview
} from "./rescanTypes";
import { loadAppServerFlagContext } from "./serverFlagApp";
import { scanServerFlaggedInbox } from "./serverFlagBackfill";
import { loadMailboxSpamSettings, loadSpamConfig } from "./settings";
import { moveMessageToJunkAsSpam } from "./spamMove";
import { loadStaticRules, type StaticRules } from "./staticRules";
import type { SpamTokenUsage } from "./usage";

/**
 * „Posteingang jetzt prüfen“ (doc/SPAM-DETECTION.md): an admin-started check
 * of a mailbox's existing INBOX in the server process. Stage A selects
 * server-flagged mail with the conservative rules of serverFlagBackfill.ts
 * (no model). Stage B, when requested, runs the regular classifier on the
 * unchecked rows of the range through the sweep's queue (its concurrency,
 * retries and the mailbox's threshold), at most `modelLimit` of them, and
 * lists the INBOX mail of the range marked „Verdächtig“. The scan never moves
 * anything: the admin reviews the stored list and moves a selection in a
 * separate step with the code path of „Als Spam“.
 */
export const SPAM_RESCAN_SOURCE = "rescan" satisfies SpamExampleSource;
export { SpamRescanBusyError } from "@/lib/db";
const PROGRESS_INTERVAL_MS = 500;
const OLDEST = Number.MIN_SAFE_INTEGER;

export class SpamRescanInputError extends Error {
  constructor(public code: "invalid_period" | "invalid_model_limit" | "model_unavailable" | "no_inbox" | "invalid_selection" | "not_movable") {
    super(code);
    this.name = "SpamRescanInputError";
  }
}

export type SpamRescanDeps = {
  /** Stage B; the default loads the spam service (AI SDK) lazily, like the sync hook. */
  runChecks: (accountId: string, candidates: Array<{ id: string; failedAttempts?: number }>, options: {
    rescanJobId: string; isCancelled: () => boolean; onProgress: (checked: number, usage: SpamTokenUsage) => void;
  }) => Promise<SpamTokenUsage>;
  /** The IMAP move with the local relocation (junkMove.ts); the example is recorded around it. */
  moveToJunk: typeof moveMessageToJunk;
  loadStaticRules: () => Promise<StaticRules>;
};

const DEFAULT_DEPS: SpamRescanDeps = {
  runChecks: async (...args) => (await import("./service")).runRescanSpamChecks(...args),
  moveToJunk: moveMessageToJunk,
  loadStaticRules: () => loadStaticRules()
};

type CancelReason = "user" | "shutdown";
type RescanRuntime = {
  /** This server process; a job row left active by another one was interrupted. */
  instance: string;
  cancels: Map<string, CancelReason>;
  /** Background work per job (tests wait for it). */
  running: Map<string, Promise<void>>;
  deps?: SpamRescanDeps;
};
const host = globalThis as typeof globalThis & { __noctuaSpamRescan?: RescanRuntime };
const runtime: RescanRuntime = host.__noctuaSpamRescan ??= { instance: randomUUID(), cancels: new Map(), running: new Map() };
const deps = () => runtime.deps ?? DEFAULT_DEPS;

/** Tests: replaces the model step, the IMAP move and the rules until the returned function restores them. */
export function replaceSpamRescanDeps(overrides: Partial<SpamRescanDeps>) {
  const previous = runtime.deps;
  runtime.deps = { ...deps(), ...overrides };
  return () => { runtime.deps = previous; };
}

/** Tests: resolves once the background work of every started scan or move has finished. */
export async function spamRescansIdle() {
  while (runtime.running.size) await Promise.allSettled([...runtime.running.values()]);
}

/** Jobs another process left running are interrupted (restart): cheap read first, a write only when one exists. */
async function reconcile() {
  const active = await listActiveSpamRescanJobs();
  if (active.some((job) => !runtime.running.has(job.id))) await reconcileInterruptedSpamRescans(runtime.instance);
}

/** Why Stage B cannot run: the switches the sweep obeys (global, then the mailbox's), then the model itself. */
async function modelBlock(accountId: string): Promise<SpamRescanModelBlock | null> {
  const config = await loadSpamConfig();
  if (!config.enabled) return "detection-off";
  if (!isSpamDetectionOn(config, await loadMailboxSpamSettings(accountId))) return "mailbox-off";
  return spamModelUnavailableReason(config);
}

/** The counts the admin sees before the start; reads only the shard's rows (no sources, no model). */
export async function previewSpamRescan(accountId: string, period: SpamRescanPeriod): Promise<SpamRescanPreview> {
  const folders = await getFolders(accountId);
  const inbox = findInboxFolder(folders, accountId);
  const counts = inbox ? await countSpamRescanRows(accountId, inbox.id, spamRescanSince(period) ?? OLDEST, SPAM_MAX_ATTEMPTS) : { rows: 0, unchecked: 0 };
  return {
    period, inboxRows: counts.rows, unchecked: counts.unchecked, modelLimit: Math.min(counts.unchecked, SPAM_RESCAN_MODEL_MAX),
    modelBlocked: await modelBlock(accountId), hasJunkFolder: !!findJunkFolder(folders, accountId)
  };
}

/** The mailbox's latest job with its preview list (null: never run, or replaced by account deletion). */
export async function loadSpamRescanState(accountId: string) {
  await reconcile();
  const job = await getLatestSpamRescanJob(accountId);
  return { job: job ? publicJob(job) : null, items: job ? (await listSpamRescanItems(job.id)).map(publicItem) : [] };
}

/**
 * Mailboxes an admin may check: only those they are a member of (owner or any
 * role), never every mailbox of the household (user decision 2026-10-25).
 */
export async function listSpamRescanMailboxes(userId: string) {
  return (await listAccessibleAccountsForUser(userId)).map(({ account }) => ({ accountId: account.id, email: account.email }));
}

/** Running scans and moves of the user's own mailboxes, for the activity panel. */
export async function listSpamRescanActivity(userId: string): Promise<SpamRescanActivity[]> {
  await reconcile();
  const jobs = await listActiveSpamRescanJobs();
  if (!jobs.length) return [];
  const names = new Map((await listAccessibleAccountsForUser(userId)).map(({ account }) => [account.id, account.name || account.email]));
  return jobs.filter((job) => names.has(job.accountId)).map((job) => ({
    id: job.id, accountId: job.accountId, mailbox: names.get(job.accountId)!, status: job.status, phase: job.phase,
    processed: job.processed, total: job.total, updatedAt: job.updatedAt
  }));
}

function publicJob({ sinceDateValue: _since, ...job }: StoredSpamRescanJob) {
  return job;
}

function publicItem({ rfcMessageId: _rfc, ...item }: StoredSpamRescanItem) {
  return item;
}

function track(jobId: string, work: Promise<void>) {
  const done = work.finally(() => {
    runtime.cancels.delete(jobId);
    runtime.running.delete(jobId);
  });
  runtime.running.set(jobId, done);
  trackBackgroundWork(`spam-rescan:${jobId}`, done, () => { if (!runtime.cancels.has(jobId)) runtime.cancels.set(jobId, "shutdown"); });
}

function progressWriter(jobId: string) {
  let lastAt = 0;
  let lastPhase: SpamRescanPhase | null = null;
  return (phase: SpamRescanPhase, processed: number, total: number, force = false) => {
    const now = Date.now();
    if (!force && phase === lastPhase && now - lastAt < PROGRESS_INTERVAL_MS && processed < total) return;
    lastAt = now;
    lastPhase = phase;
    void updateSpamRescanJob(jobId, { phase, processed, total }, ["running", "moving"])
      .catch((error) => console.warn("[spam] rescan progress update failed", { jobId, error: String(error) }));
  };
}

/**
 * Starts a scan in the background. `modelLimit` is the count the admin saw
 * (preview.modelLimit): Stage B never sends more mails to the model, and
 * never more than SPAM_RESCAN_MODEL_MAX. Throws SpamRescanBusyError while the
 * mailbox has a running job.
 */
export async function startSpamRescan(input: { accountId: string; period: SpamRescanPeriod; withModel: boolean; modelLimit: number; userId: string }) {
  if (!Number.isInteger(input.modelLimit) || input.modelLimit < 0) throw new SpamRescanInputError("invalid_model_limit");
  await reconcile();
  const preview = await previewSpamRescan(input.accountId, input.period);
  const inbox = findInboxFolder(await getFolders(input.accountId), input.accountId);
  if (!inbox) throw new SpamRescanInputError("no_inbox");
  if (input.withModel && preview.modelBlocked) throw new SpamRescanInputError("model_unavailable");
  const modelLimit = input.withModel ? Math.min(input.modelLimit, SPAM_RESCAN_MODEL_MAX) : 0;
  const id = randomUUID();
  const sinceDateValue = spamRescanSince(input.period);
  await createSpamRescanJob({ id, accountId: input.accountId, period: input.period, sinceDateValue, withModel: input.withModel, modelLimit,
    ownerInstance: runtime.instance, userId: input.userId, counts: { inboxRows: preview.inboxRows } });
  const job = (await getSpamRescanJob(id))!;
  track(id, runScan(job, inbox.id).catch(async (error) => {
    console.warn("[spam] rescan failed", { accountId: job.accountId, jobId: id, error: error instanceof Error ? error.name : "Error" });
    await updateSpamRescanJob(id, { status: "failed", phase: null, error: "failed", finishedAt: Date.now() }, ["running"]).catch(() => {});
  }));
  return publicJob(job);
}

/** Stops the mailbox's running scan or move after the current batch or message. */
export async function cancelSpamRescan(accountId: string) {
  const job = await getLatestSpamRescanJob(accountId);
  if (!job || (job.status !== "running" && job.status !== "moving") || !runtime.running.has(job.id)) return false;
  runtime.cancels.set(job.id, "user");
  return true;
}

const serverFlagItem = (item: Awaited<ReturnType<typeof scanServerFlaggedInbox>>["items"][number]): NewSpamRescanItem => ({
  id: item.id, rfcMessageId: item.messageId, from: item.from, subject: item.subject, date: item.date, dateValue: item.dateValue,
  stage: "server-flag", reasons: [], score: item.score
});

function storedStrings(value: string | null) {
  try {
    const parsed = JSON.parse(value ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
  } catch { return []; }
}

async function runScan(job: StoredSpamRescanJob, inboxId: string) {
  const { accountId } = job;
  const since = job.sinceDateValue ?? OLDEST;
  const isCancelled = () => runtime.cancels.has(job.id);
  const progress = progressWriter(job.id);
  const counts: SpamRescanCounts = { ...job.counts };
  let listed = 0;
  const listedIds = new Set<string>();
  const list = async (items: NewSpamRescanItem[]) => {
    const fresh = items.filter((item) => !listedIds.has(item.id));
    const room = Math.max(0, SPAM_RESCAN_ITEM_LIMIT - listed);
    if (fresh.length > room) counts.truncated = true;
    fresh.forEach((item) => listedIds.add(item.id));
    await addSpamRescanItems(job.id, fresh.slice(0, room));
    listed += Math.min(room, fresh.length);
  };
  const finish = async () => {
    const reason = runtime.cancels.get(job.id);
    counts.items = listed;
    await updateSpamRescanJob(job.id, {
      status: reason ? "cancelled" : "ready", phase: null, counts, error: reason === "shutdown" ? "interrupted" : null, finishedAt: Date.now()
    }, ["running"]);
    // Counts only, never senders or subjects.
    const { serverFlagExcluded: _excluded, ...logged } = counts;
    console.info("[spam] rescan done", { accountId, jobId: job.id, cancelled: reason ?? null, ...logged });
  };

  // Stage A: server-flagged mail, the conservative rules of the server-flag backfill.
  progress("server-flag", 0, counts.inboxRows ?? 0, true);
  const { shards, household } = await loadAppServerFlagContext(await deps().loadStaticRules());
  const shard = shards.get(accountId);
  if (!shard) throw new Error("mailbox shard not found");
  const scan = await scanServerFlaggedInbox({
    accountId, db: shard.db, folders: shard.folders, sourcesDir: getSourcesDir(), household, since: job.sinceDateValue,
    onProgress: (read, total) => progress("server-flag", read, total), isCancelled
  });
  if (scan.cancelled) return finish();
  const selected = scan.items.filter((item) => item.decision === "move");
  counts.serverFlagged = scan.flagged;
  counts.serverFlagSelected = selected.length;
  counts.serverFlagExcluded = Object.fromEntries(Object.entries(scan.counts).filter(([decision]) => decision !== "move")) as Record<string, number>;
  await list(selected.map(serverFlagItem));

  // Stage B: the regular classifier on unchecked rows of the range (newest first), never more than the admin saw.
  if (job.withModel && !isCancelled()) {
    const blocked = await modelBlock(accountId);
    if (blocked) counts.modelBlocked = blocked;
    else if (job.modelLimit > 0) {
      const candidates = (await listUncheckedSpamMessages(accountId, inboxId, since, job.modelLimit + listedIds.size, SPAM_MAX_ATTEMPTS, { newestFirst: true }))
        .filter((candidate) => !listedIds.has(candidate.id)).slice(0, job.modelLimit);
      progress("classifier", 0, candidates.length, true);
      counts.modelChecked = 0;
      const usage = await deps().runChecks(accountId, candidates, {
        rescanJobId: job.id, isCancelled,
        onProgress: (checked) => { counts.modelChecked = checked; progress("classifier", checked, candidates.length); }
      });
      counts.modelCalls = usage.calls;
    }
    // Flagged, answered or $NotJunk mail stays, as in Stage A and the move's re-check.
    const marked = (await listMarkedSpamMessages(accountId, inboxId, since, SPAM_RESCAN_ITEM_LIMIT + listedIds.size + 1))
      .filter((row) => !listedIds.has(row.id)
        && !keptInInbox({ flags: storedStrings(row.flags), flagged: row.flagged === 1, answered: row.answered === 1, spamVerdict: "spam" }));
    counts.classifierMarked = marked.length;
    await list(marked.map((row) => ({
      id: row.id, rfcMessageId: row.messageId, from: row.fromAddr ?? "", subject: (row.subject ?? "").slice(0, 200), date: row.date,
      dateValue: row.dateValue, stage: "classifier", reasons: storedStrings(row.spamReasons).slice(0, 5), score: row.spamConfidence
    })));
  }
  return finish();
}

/**
 * What keeps a mail in the INBOX although it is listed or marked: flagged,
 * answered or `$NotJunk` (as in serverFlagBackfill.ts), or a verdict other
 * than spam (a user's „Kein Spam“ on the mark, or the classifier disagreeing).
 */
export function keptInInbox(message: Pick<Message, "flags" | "flagged" | "answered" | "spamVerdict">) {
  const flags = (message.flags ?? []).map((flag) => flag.toLowerCase());
  return !!message.flagged || !!message.answered || flags.includes("\\flagged") || flags.includes("\\answered")
    || (message.flags ?? []).some(isNonJunkKeyword) || (message.spamVerdict !== undefined && message.spamVerdict !== null && message.spamVerdict !== "spam");
}

const MOVE_STATUS: Record<SpamApplyResult, SpamRescanMoveStatus> = {
  moved: "moved", "would-move": "pending", missing: "gone", "not-in-inbox": "gone", changed: "changed", error: "error"
};

/**
 * Moves the admin's selection of a finished scan in the background, one
 * message after another, with the steps of „Als Spam“ (spamMove.ts; examples
 * with source `rescan`, dated at the mail's arrival). Mail no longer in the
 * INBOX, replaced under the same row id or changed since the scan stays and
 * is reported. Returns the number of selected items (0: nothing to move), or
 * null when the job is not the mailbox's.
 */
export async function startSpamRescanMove(input: { accountId: string; jobId: string; ids: unknown; userId: string }) {
  if (!Array.isArray(input.ids) || !input.ids.length || input.ids.length > SPAM_RESCAN_ITEM_LIMIT || input.ids.some((id) => typeof id !== "string")) {
    throw new SpamRescanInputError("invalid_selection");
  }
  await reconcile();
  const job = await getSpamRescanJob(input.jobId);
  if (!job || job.accountId !== input.accountId) return null;
  const selected = await beginSpamRescanMove(job.id, [...new Set(input.ids as string[])], input.userId, runtime.instance);
  if (selected === null) throw new SpamRescanInputError("not_movable");
  if (selected > 0) {
    track(job.id, runMove(job, input.userId).catch((error) => {
      console.warn("[spam] rescan move failed", { accountId: job.accountId, jobId: job.id, error: error instanceof Error ? error.name : "Error" });
    }));
  }
  return selected;
}

async function runMove(job: StoredSpamRescanJob, userId: string) {
  const { accountId } = job;
  const progress = progressWriter(job.id);
  let counts: SpamRescanCounts = job.counts;
  try {
    type MoveRecord = SpamEvalRecord & { item: StoredSpamRescanItem };
    const records: MoveRecord[] = (await listSpamRescanItems(job.id)).filter((item) => item.moveStatus === "pending").map((item) => ({
      accountId, id: item.id, label: "ham", decision: "spam", source: SPAM_RESCAN_SOURCE, confidence: item.score, subject: item.subject,
      fromEmail: null, mailboxPath: "INBOX", serverSpamFlag: item.stage === "server-flag", item
    }));
    const current = new Map<string, Message>();
    let processed = 0;
    progress("moving", 0, records.length, true);
    const results = await applySpamItems(records, {
      dryRun: false,
      log: () => {},
      isCancelled: () => runtime.cancels.has(job.id),
      lookup: async (record) => {
        const message = await getMessageById(accountId, record.id);
        // Gone, or a different mail under the same row id: never moved.
        if (!message || message.deleted || message.id !== record.id || (message.messageId ?? null) !== (record.item.rfcMessageId ?? null)) return null;
        current.set(record.id, message);
        return { mailboxPath: message.mailboxPath ?? null, changed: keptInInbox(message) };
      },
      move: async (record) => (await moveMessageToJunkAsSpam({
        accountId, message: current.get(record.id)!, source: SPAM_RESCAN_SOURCE, userId, datedAtArrival: true, moveToJunk: deps().moveToJunk
      })).junkMailbox,
      onResult: async (record, result) => {
        current.delete(record.id);
        await setSpamRescanItemMoveStatus(job.id, record.id, MOVE_STATUS[result]);
        progress("moving", processed += 1, records.length);
      }
    });
    counts = {
      ...counts,
      moved: (counts.moved ?? 0) + results.moved,
      gone: (counts.gone ?? 0) + results.missing + results["not-in-inbox"],
      changed: (counts.changed ?? 0) + results.changed,
      errors: results.error
    };
    console.info("[spam] rescan move done", { accountId, jobId: job.id, selected: records.length, moved: results.moved,
      gone: results.missing + results["not-in-inbox"], changed: results.changed, errors: results.error });
  } finally {
    await finishSpamRescanMove(job.id, counts, runtime.cancels.get(job.id) === "shutdown" ? "interrupted" : null);
  }
}
