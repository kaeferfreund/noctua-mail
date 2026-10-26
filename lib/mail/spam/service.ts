import type { LanguageModel } from "ai";
import { simpleParser } from "mailparser";
import {
  AccountNotFoundError,
  getAccountById,
  getAccounts,
  getFolders,
  getLatestSpamDecisionRow,
  getMessageById,
  getSenderProfile,
  hasSentToAddress,
  listSenderMailsNear,
  listUncheckedSpamMessages,
  markSenderProfileUserSpam,
  recordSenderProfileJunk,
  recordSenderProfileMail,
  recordSpamCheckFailure,
  resetTrustedSpamChecks,
  saveSpamVerdict
} from "@/lib/db";
import type { Message } from "@/lib/data";
import { resolveAccountRole, roleAtLeast } from "@/lib/accountAccess";
import { parseAddressEmails } from "@/lib/ownAddresses";
import { getSourcesDir } from "@/lib/runtimePaths";
import { getMessageSourceBuffer } from "@/lib/storage";
import { findInboxFolder, findSentFolder } from "@/lib/specialFolders";
import { moveMessageToJunk } from "@/app/api/_helpers/message/junkMove";
import { allowlistDecision, buildOwnIdentitySets, type SpamAllowlistContext } from "./allowlist";
import type { SpamTrustContext } from "./anomaly";
import { classifySpam, isRetryableSpamError, shouldMarkAsSpam } from "./classifySpam";
import { isSpamDetectionOn, resolveMailboxThreshold, type SpamConfig } from "./config";
import { findSpamExamples } from "./examples";
import { buildSpamInput, buildSpamInputFromMessage } from "./input";
import { readSourceHeads, storedMailArrival } from "./profileBuild";
import { getSpamLanguageModel, getSpamProviderOptions, spamModelUnavailableReason } from "./provider";
import {
  createSpamClaims,
  createSpamFailureLogger,
  createSpamQueue,
  pickSweepJobs,
  spamErrorLogFields,
  SPAM_MAX_ATTEMPTS,
  SPAM_QUEUE_CONCURRENCY,
  type SpamCheckJob
} from "./queue";
import { loadMailboxSpamSettings, loadSpamConfig } from "./settings";
import { mergeSenderProfiles, recipientCircleOf, senderMailFacts, spamSenderKey, type SenderProfile } from "./senderProfile";
import { loadStaticRules } from "./staticRules";
import type { SpamVerdict } from "./types";
import { addSpamUsage, EMPTY_SPAM_USAGE, spamCacheHitRate, spamUsageLogFields, type SpamTokenUsage } from "./usage";

/**
 * Wiring between sync and the classifier (doc/SPAM-DETECTION.md). After every
 * successful sync job the account's INBOX is swept for unchecked messages of
 * the last days; each one is queued once per process and classified in the
 * background, so IMAP sync never waits for the model. Failed attempts are
 * stored on the message row, so the attempt limit also holds across restarts.
 */
const SWEEP_WINDOW_MS = 3 * 24 * 60 * 60_000;
const SWEEP_LIMIT = 50;
const PROCESSED_TTL_MS = 24 * 60 * 60_000;
const PROCESSED_LIMIT = 20_000;
const IDENTITY_TTL_MS = 10 * 60_000;
/** Stored mails of the sender nearest to a checked one that the burst rule looks at. */
const BURST_CANDIDATES = 20;
/** "Als Spam" on a sender re-checks its trusted skips of this many days. */
const REVOKE_WINDOW_MS = 7 * 24 * 60 * 60_000;

/** What the service reaches outside the database; tests replace them (no model API, no IMAP). */
export type SpamServiceDeps = {
  languageModel: (config: SpamConfig) => LanguageModel | null;
  loadStaticRules: typeof loadStaticRules;
  /** The raw source bytes: the parser decodes each part by its MIME charset. */
  readSource: (accountId: string, messageId: string) => Promise<Buffer | null>;
  moveToJunk: typeof moveMessageToJunk;
  accountRole: typeof resolveAccountRole;
  sleep: (ms: number) => Promise<void>;
};

const DEFAULT_DEPS: SpamServiceDeps = {
  languageModel: getSpamLanguageModel,
  readSource: getMessageSourceBuffer,
  loadStaticRules,
  moveToJunk: moveMessageToJunk,
  accountRole: resolveAccountRole,
  sleep: (ms) => new Promise<void>((resolve) => setTimeout(resolve, ms))
};

type SpamServiceState = {
  queue: ReturnType<typeof createSpamQueue>;
  logFailure: ReturnType<typeof createSpamFailureLogger>;
  claims: ReturnType<typeof createSpamClaims>;
  identity?: { loadedAt: number; sets: ReturnType<typeof buildOwnIdentitySets>; accountIds: string[] };
  /** Model token usage per account since that account's last sweep summary. */
  usage: Map<string, SpamTokenUsage>;
  /** Model token usage per admin rescan job (rescan.ts), kept out of the sweep summaries. */
  rescanUsage?: Map<string, SpamTokenUsage>;
  deps?: SpamServiceDeps;
};

const runtime = globalThis as typeof globalThis & { __noctuaSpamService?: SpamServiceState };
const state: SpamServiceState = runtime.__noctuaSpamService ??= (() => {
  const logFailure = createSpamFailureLogger();
  return {
    logFailure,
    claims: createSpamClaims(PROCESSED_TTL_MS, PROCESSED_LIMIT),
    usage: new Map(),
    queue: createSpamQueue({
      check: (job) => checkMessage(job),
      isRetryable: isRetryableSpamError,
      onAttemptFailed: (job, failedAttempts, error) => error instanceof AccountNotFoundError
        ? undefined : recordSpamCheckFailure(job.accountId, job.messageId, failedAttempts),
      onFailure: (job, error) => logFailure(job.accountId, "classification failed; message left unmarked", spamErrorLogFields(error)),
      sleep: (ms) => deps().sleep(ms)
    })
  };
})();

const deps = () => state.deps ?? DEFAULT_DEPS;
const rescanUsage = () => state.rescanUsage ??= new Map();

/** Tests: replaces outside dependencies until the returned function restores them. */
export function replaceSpamServiceDeps(overrides: Partial<SpamServiceDeps>) {
  const previous = state.deps;
  const previousIdentity = state.identity;
  state.deps = { ...deps(), ...overrides };
  // Each synthetic household must discover its own mailboxes instead of a previous test's cached IDs.
  state.identity = undefined;
  return () => { state.deps = previous; state.identity = previousIdentity; };
}

/** Resolves once every queued check has finished. */
export function spamChecksIdle() {
  return state.queue.onIdle();
}

export function scheduleSpamSweep(accountId: string) {
  void runSpamSweep(accountId).catch((error) => state.logFailure(accountId, "sweep failed", { error: String(error) }));
}

/** One sweep of the account's INBOX; the checks it queues run in the background (spamChecksIdle). */
export async function runSpamSweep(accountId: string) {
  if (!isSpamDetectionOn(await loadSpamConfig(), await loadMailboxSpamSettings(accountId))) return;
  const inbox = findInboxFolder(await getFolders(accountId), accountId);
  if (!inbox) return;
  // Oldest first, so a backlog is worked off before it leaves the window.
  const candidates = await listUncheckedSpamMessages(accountId, inbox.id, Date.now() - SWEEP_WINDOW_MS, SWEEP_LIMIT * 4, SPAM_MAX_ATTEMPTS);
  const jobs = pickSweepJobs(accountId, candidates, state.queue, state.claims, SWEEP_LIMIT);
  state.queue.enqueue(jobs);
  if (jobs.length) void logSweepSummary(accountId, jobs.length);
}

/** One line per sweep that queued work, once the queue has drained: the account's model token usage. */
async function logSweepSummary(accountId: string, messages: number) {
  await state.queue.onIdle();
  const usage = state.usage.get(accountId) ?? EMPTY_SPAM_USAGE;
  state.usage.delete(accountId);
  console.info("[spam] sweep done", {
    accountId,
    messages,
    modelCalls: usage.calls,
    ...spamUsageLogFields(usage),
    cacheHitRate: Number(spamCacheHitRate(usage).toFixed(3))
  });
}

function recordUsage(job: SpamCheckJob, usage: SpamTokenUsage) {
  console.debug("[spam] model call", { accountId: job.accountId, ...spamUsageLogFields(usage) });
  const totals = job.rescanJobId ? rescanUsage() : state.usage;
  const key = job.rescanJobId ?? job.accountId;
  totals.set(key, addSpamUsage(totals.get(key) ?? EMPTY_SPAM_USAGE, usage));
}

/**
 * Admin rescan (rescan.ts): classifies the given INBOX rows through the
 * sweep's queue, so its concurrency, retries and attempt limit hold for both.
 * Only one batch of SPAM_QUEUE_CONCURRENCY jobs is queued at a time: sweeps
 * queued meanwhile run in between, and a cancel stops after the running
 * batch. Rows the sweep has queued already are waited for, not checked twice.
 * Never auto-moves. Resolves with the model usage of this rescan's checks.
 */
export async function runRescanSpamChecks(accountId: string, candidates: Array<{ id: string; failedAttempts?: number }>, options: {
  rescanJobId: string;
  staticOnly?: boolean;
  isCancelled: () => boolean;
  onProgress: (checked: number, usage: SpamTokenUsage) => void;
}) {
  const usage = () => rescanUsage().get(options.rescanJobId) ?? EMPTY_SPAM_USAGE;
  try {
    for (let start = 0; start < candidates.length && !options.isCancelled(); start += SPAM_QUEUE_CONCURRENCY) {
      const jobs: SpamCheckJob[] = candidates.slice(start, start + SPAM_QUEUE_CONCURRENCY).map((candidate) => ({
        accountId, messageId: candidate.id, failedAttempts: candidate.failedAttempts ?? 0, rescanJobId: options.rescanJobId, staticOnly: options.staticOnly
      }));
      jobs.forEach((job) => state.claims.claim(job));
      state.queue.enqueue(jobs);
      await Promise.all(jobs.map((job) => state.queue.settled(job)));
      options.onProgress(Math.min(candidates.length, start + jobs.length), usage());
    }
    return usage();
  } finally {
    rescanUsage().delete(options.rescanJobId);
  }
}

async function household() {
  if (state.identity && Date.now() - state.identity.loadedAt < IDENTITY_TTL_MS) return state.identity;
  const accounts = await getAccounts();
  const sets = buildOwnIdentitySets(accounts.flatMap((account) => [account.email, ...(account.ownAddresses ?? [])]));
  state.identity = { loadedAt: Date.now(), sets, accountIds: accounts.map((account) => account.id) };
  return state.identity;
}

async function householdIdentity() {
  return (await household()).sets;
}

/** The sender's profiles of every mailbox, merged (concept §3.4); a mailbox that fails to open is left out. */
async function loadHouseholdSenderProfile(senderKey: string, now: number) {
  const profiles = await Promise.all((await household()).accountIds.map((accountId) =>
    getSenderProfile(accountId, senderKey).catch(() => null)));
  return mergeSenderProfiles(profiles.filter((profile): profile is SenderProfile => profile !== null), now);
}

async function loadSpamInput(accountId: string, message: Message) {
  const source = await deps().readSource(accountId, message.id).catch(() => null);
  if (source) {
    try { return buildSpamInput(await simpleParser(source)); } catch { /* fall back to the stored row */ }
  }
  return buildSpamInputFromMessage({ ...message, replyTo: message.replyTo ?? null });
}

async function checkMessage(job: SpamCheckJob) {
  const config = await loadSpamConfig();
  const mailbox = await loadMailboxSpamSettings(job.accountId);
  if (!isSpamDetectionOn(config, mailbox)) return;
  const message = await getMessageById(job.accountId, job.messageId);
  // A sweep or rescan may have judged this row while this job waited in the queue.
  if (!message || message.spamVerdict !== undefined) return;
  const folders = await getFolders(job.accountId);
  // Moved meanwhile (Junk, Trash, Sent, Drafts …): only INBOX mail is checked.
  if (message.folderId !== findInboxFolder(folders, job.accountId)?.id) return;
  const input = await loadSpamInput(job.accountId, message);
  const sentFolder = findSentFolder(folders, job.accountId);
  const identity = await householdIdentity();
  const allowlist: SpamAllowlistContext = {
    ...identity,
    isCorrespondent: async (email) => sentFolder ? hasSentToAddress(job.accountId, sentFolder.id, email) : false,
    latestDecision: async (email) => allowlistDecision(await getLatestSpamDecisionRow(job.accountId, email),
      async (userId) => roleAtLeast(await deps().accountRole(userId, job.accountId), "manager"))
  };
  const trust: SpamTrustContext = {
    ownAddresses: identity.ownAddresses,
    loadProfile: loadHouseholdSenderProfile,
    loadRecent: (senderKey) => loadRecentSenderMails(job.accountId, message, senderKey, identity.ownAddresses),
    canaryKey: message.id
  };
  const decision = await classifySpam({
    input,
    allowlist,
    staticRules: await deps().loadStaticRules(),
    getExamples: () => findSpamExamples(job.accountId, { senderEmail: input.fromEmail, subject: input.subject }),
    model: job.staticOnly ? null : deps().languageModel(config),
    providerOptions: getSpamProviderOptions(config),
    onUsage: (usage) => recordUsage(job, usage),
    trust
  });
  if (!decision) {
    state.logFailure(job.accountId, "model unavailable; messages stay unchecked", { reason: spamModelUnavailableReason(config) });
    return;
  }
  if (decision.trust?.kind === "canary" && decision.trust.mismatch) {
    console.warn("[spam] canary mismatch", { accountId: job.accountId, messageId: message.id, verdict: decision.verdict, confidence: decision.confidence });
  }
  const marked = shouldMarkAsSpam(decision, resolveMailboxThreshold(config, mailbox));
  // "spam" is stored only when the mark applies; a spam verdict below the threshold is kept as "unsure".
  const verdict: SpamVerdict = marked ? "spam" : decision.verdict === "spam" ? "unsure" : decision.verdict;
  const saved = await saveSpamVerdict(job.accountId, message.id, { verdict, confidence: decision.confidence, reasons: decision.reasons }, { automatic: true });
  // Each message is saved once (spamCheckedAt), so it enters the profile once; only ham teaches the pattern (not spam, not unsure).
  if (saved && verdict === "ham") await learnSenderProfile(job.accountId, message.id, input, identity.ownAddresses);
  // The admin rescan only marks: its results are moved after the admin's review.
  if (saved && marked && mailbox.autoMove && !job.rescanJobId) await autoMoveToJunk(job.accountId, message);
}

/** The sender's mails stored closest to `message` with their arrival (burst rule; never the sender's Date header). */
async function loadRecentSenderMails(accountId: string, message: Message, senderKey: string, ownAddresses: ReadonlySet<string>) {
  const rows = await listSenderMailsNear(accountId, message.folderId, senderKey, message.id, BURST_CANDIDATES);
  const heads = await readSourceHeads(getSourcesDir(), accountId, rows.filter((row) => row.hasSource).map((row) => row.id));
  return rows.map((row) => ({ date: storedMailArrival(row, heads.get(row.id)), circle: recipientCircleOf(row.toAddr, row.ccAddr, senderKey, ownAddresses) }));
}

async function learnSenderProfile(accountId: string, messageId: string, input: Awaited<ReturnType<typeof loadSpamInput>>, ownAddresses: ReadonlySet<string>) {
  // Without a Received stamp the check time is the arrival: dateValue is the sender's Date header.
  const facts = senderMailFacts(input, { ownAddresses, arrivedAt: Date.now() });
  if (!facts) return;
  try {
    await recordSenderProfileMail(accountId, facts, messageId);
  } catch (error) {
    state.logFailure(accountId, "sender profile update failed", { error: String(error) });
  }
}

/**
 * "Als Spam" by a user (concept §4): the sender is never trusted again in any
 * mailbox, the marked mail counts into the sender's junk share, and its INBOX
 * mail of the last 7 days that was skipped as trusted is checked again. Never
 * throws: the user's action must not fail.
 */
export async function revokeSenderTrust(accountId: string, from: string, messageId?: string) {
  const senderKey = spamSenderKey(parseAddressEmails(from)[0]);
  if (!senderKey) return;
  try {
    const now = Date.now();
    await markSenderProfileUserSpam(accountId, senderKey, now, messageId);
    for (const id of (await household()).accountIds) {
      const inbox = findInboxFolder(await getFolders(id), id);
      if (!inbox) continue;
      const ids = await resetTrustedSpamChecks(id, inbox.id, senderKey, now - REVOKE_WINDOW_MS);
      if (ids.length) state.queue.enqueue(ids.map((messageId) => ({ accountId: id, messageId })));
    }
  } catch (error) {
    console.warn("[spam] failed to revoke sender trust", { accountId, error: String(error) });
  }
}

async function autoMoveToJunk(accountId: string, message: Message) {
  if (typeof message.imapUid !== "number" || !message.mailboxPath) return;
  try {
    const account = await getAccountById(accountId);
    if (!account) return;
    await deps().moveToJunk({ account, accountId, message: { ...message, imapUid: message.imapUid, mailboxPath: message.mailboxPath } });
  } catch (error) {
    // The mark stays; the move is not retried (the user can still use "Als Spam").
    state.logFailure(accountId, "auto-move to Junk failed", { error: String(error) });
    return;
  }
  const senderKey = spamSenderKey(parseAddressEmails(message.from)[0]);
  if (senderKey) {
    await recordSenderProfileJunk(accountId, senderKey, message.id)
      .catch((error) => state.logFailure(accountId, "sender junk count failed", { error: String(error) }));
  }
}
