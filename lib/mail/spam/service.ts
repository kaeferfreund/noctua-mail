import { simpleParser } from "mailparser";
import {
  getAccountById,
  getAccounts,
  getFolders,
  getLatestSpamDecision,
  getMessageById,
  hasSentToAddress,
  listUncheckedSpamMessageIds,
  saveSpamVerdict
} from "@/lib/db";
import type { Message } from "@/lib/data";
import { getMessageSource } from "@/lib/storage";
import { findInboxFolder, findSentFolder } from "@/lib/specialFolders";
import { moveMessageToJunk } from "@/app/api/_helpers/message/junkMove";
import { buildOwnIdentitySets, type SpamAllowlistContext } from "./allowlist";
import { classifySpam, shouldMarkAsSpam } from "./classifySpam";
import { isSpamDetectionOn, resolveMailboxThreshold } from "./config";
import { findSpamExamples } from "./examples";
import { buildSpamInput, buildSpamInputFromMessage } from "./input";
import { getSpamLanguageModel, getSpamProviderOptions, spamModelUnavailableReason } from "./provider";
import { createSpamClaims, createSpamFailureLogger, createSpamQueue, pickSweepJobs, type SpamCheckJob } from "./queue";
import { loadMailboxSpamSettings, loadSpamConfig } from "./settings";
import { loadStaticRules } from "./staticRules";
import type { SpamVerdict } from "./types";

/**
 * Wiring between sync and the classifier (doc/SPAM-DETECTION.md). After every
 * successful sync job the account's INBOX is swept for unchecked messages of
 * the last days; each one is queued once per process and classified in the
 * background, so IMAP sync never waits for the model.
 */
const SWEEP_WINDOW_MS = 3 * 24 * 60 * 60_000;
const SWEEP_LIMIT = 50;
const PROCESSED_TTL_MS = 24 * 60 * 60_000;
const PROCESSED_LIMIT = 20_000;
const IDENTITY_TTL_MS = 10 * 60_000;

type SpamServiceState = {
  queue: ReturnType<typeof createSpamQueue>;
  logFailure: ReturnType<typeof createSpamFailureLogger>;
  claims: ReturnType<typeof createSpamClaims>;
  identity?: { loadedAt: number; sets: ReturnType<typeof buildOwnIdentitySets> };
};

const runtime = globalThis as typeof globalThis & { __noctuaSpamService?: SpamServiceState };
const state: SpamServiceState = runtime.__noctuaSpamService ??= (() => {
  const logFailure = createSpamFailureLogger();
  return {
    logFailure,
    claims: createSpamClaims(PROCESSED_TTL_MS, PROCESSED_LIMIT),
    queue: createSpamQueue({
      check: (job) => checkMessage(job),
      onFailure: (job, error) => logFailure(job.accountId, "classification failed; message left unmarked", { error: String(error) })
    })
  };
})();

export function scheduleSpamSweep(accountId: string) {
  void sweep(accountId).catch((error) => state.logFailure(accountId, "sweep failed", { error: String(error) }));
}

async function sweep(accountId: string) {
  if (!isSpamDetectionOn(await loadSpamConfig(), await loadMailboxSpamSettings(accountId))) return;
  const inbox = findInboxFolder(await getFolders(accountId), accountId);
  if (!inbox) return;
  // Oldest first, so a backlog is worked off before it leaves the window.
  const ids = await listUncheckedSpamMessageIds(accountId, inbox.id, Date.now() - SWEEP_WINDOW_MS, SWEEP_LIMIT * 4);
  state.queue.enqueue(pickSweepJobs(accountId, ids, state.queue, state.claims, SWEEP_LIMIT));
}

async function householdIdentity() {
  if (state.identity && Date.now() - state.identity.loadedAt < IDENTITY_TTL_MS) return state.identity.sets;
  const accounts = await getAccounts();
  const sets = buildOwnIdentitySets(accounts.flatMap((account) => [account.email, ...(account.ownAddresses ?? [])]));
  state.identity = { loadedAt: Date.now(), sets };
  return sets;
}

async function loadSpamInput(accountId: string, message: Message) {
  const source = await getMessageSource(accountId, message.id).catch(() => null);
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
  if (!message) return;
  const folders = await getFolders(job.accountId);
  // Moved meanwhile (Junk, Trash, Sent, Drafts …): only INBOX mail is checked.
  if (message.folderId !== findInboxFolder(folders, job.accountId)?.id) return;
  const input = await loadSpamInput(job.accountId, message);
  const sentFolder = findSentFolder(folders, job.accountId);
  const allowlist: SpamAllowlistContext = {
    ...await householdIdentity(),
    isCorrespondent: async (email) => sentFolder ? hasSentToAddress(job.accountId, sentFolder.id, email) : false,
    latestDecision: (email) => getLatestSpamDecision(job.accountId, email)
  };
  const decision = await classifySpam({
    input,
    allowlist,
    staticRules: await loadStaticRules(),
    getExamples: () => findSpamExamples(job.accountId, { senderEmail: input.fromEmail, subject: input.subject }),
    model: getSpamLanguageModel(config),
    providerOptions: getSpamProviderOptions(config)
  });
  if (!decision) {
    state.logFailure(job.accountId, "model unavailable; messages stay unchecked", { reason: spamModelUnavailableReason(config) });
    return;
  }
  const marked = shouldMarkAsSpam(decision, resolveMailboxThreshold(config, mailbox));
  // "spam" is stored only when the mark applies; a spam verdict below the threshold is kept as "unsure".
  const verdict: SpamVerdict = marked ? "spam" : decision.verdict === "spam" ? "unsure" : decision.verdict;
  const saved = await saveSpamVerdict(job.accountId, message.id, { verdict, confidence: decision.confidence, reasons: decision.reasons }, { automatic: true });
  if (saved && marked && mailbox.autoMove) await autoMoveToJunk(job.accountId, message);
}

async function autoMoveToJunk(accountId: string, message: Message) {
  if (typeof message.imapUid !== "number" || !message.mailboxPath) return;
  try {
    const account = await getAccountById(accountId);
    if (!account) return;
    await moveMessageToJunk({ account, accountId, message: { ...message, imapUid: message.imapUid, mailboxPath: message.mailboxPath } });
  } catch (error) {
    // The mark stays; the move is not retried (the user can still use "Als Spam").
    state.logFailure(accountId, "auto-move to Junk failed", { error: String(error) });
  }
}
