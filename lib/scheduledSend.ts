import { SCHEDULED_SEND_MIN_AHEAD_MS } from "./scheduleSendTime";
import { scheduledDraftFingerprint } from "./scheduledSendFingerprint";
import type { Account } from "@/lib/data";
import { DraftSendError, loadSendableDraft, sendDraftForAccount } from "@/lib/drafts";
import { OutboundAuthorizationError } from "@/lib/outboundAuthorization";
import { SenderIdentityError } from "@/lib/senderIdentityError";
import { getSmtpHttpError, isSmtpUpstreamFailure, smtpFailedBeforeData } from "@/lib/mail/smtpError";
import { findDraftsFolder } from "@/lib/specialFolders";
import { extractComposeInviteDraftFromSource } from "@/lib/composeInviteMetadata";
import { getAccountById, getFolders } from "@/lib/serverDb";
import { resolveAccountRole, roleAtLeast } from "@/lib/accountAccess";
import type { ScheduledSend, ScheduledSendReason } from "./db/scheduledSends";
import type { ScheduledSendView } from "@/lib/scheduledSendView";

// The constructor stays in the job's attempt module. A plain object or serialized token
// cannot opt into session-less outbound authorization, even through an untyped caller.
const jobAuthorizationBrand: unique symbol = Symbol("scheduled-send-job");
export type ScheduledSendAuthorization = {
  readonly scheduledByUserId: string;
  readonly scheduleId: string;
  readonly leaseOwner: string;
  readonly [jobAuthorizationBrand]: true;
};
const jobAuthorizations = new WeakSet<object>();
export function isScheduledSendAuthorization(value: unknown): value is ScheduledSendAuthorization {
  return typeof value === "object" && value !== null && jobAuthorizations.has(value);
}
function jobAuthorization(row: ScheduledSend): ScheduledSendAuthorization {
  if (row.status !== "sending" || !row.leaseOwner || row.leaseOwner.includes("/")) {
    throw new DraftSendError(409, "No active scheduler claim.", "scheduled_send_claim_lost");
  }
  const token: ScheduledSendAuthorization = Object.freeze({ scheduledByUserId: row.userId,
    scheduleId: row.id, leaseOwner: row.leaseOwner, [jobAuthorizationBrand]: true as const });
  jobAuthorizations.add(token);
  return token;
}

/** The latest accepted send time, measured from the request. */
export const SCHEDULED_SEND_MAX_AHEAD_MS = 365 * 24 * 60 * 60_000;
/** Delays before the 2nd, 3rd and 4th attempt; the 4th failure is final. */
export const SCHEDULED_SEND_RETRY_DELAYS_MS = [60_000, 5 * 60_000, 15 * 60_000] as const;
/** Sending needs the same mailbox role as the manual send routes. */
export const SCHEDULED_SEND_MIN_ROLE = "editor" as const;

/** Client view of a row (lib/scheduledSendView.ts); the lease owner stays server-side. */
export function presentScheduledSend(row: ScheduledSend): ScheduledSendView {
  return { id: row.id, draftId: row.draftId, sendAt: row.sendAt, status: row.status, attempts: row.attempts,
    lastError: row.lastError, scheduledByUserId: row.userId };
}

export function validateScheduledSendAt(sendAt: unknown, now = Date.now()): { ok: true; sendAt: number } | { ok: false; reason: "invalid" | "past" | "too_soon" | "too_far" } {
  if (typeof sendAt !== "number" || !Number.isSafeInteger(sendAt)) return { ok: false, reason: "invalid" };
  if (sendAt <= now) return { ok: false, reason: "past" };
  if (sendAt < now + SCHEDULED_SEND_MIN_AHEAD_MS) return { ok: false, reason: "too_soon" };
  if (sendAt > now + SCHEDULED_SEND_MAX_AHEAD_MS) return { ok: false, reason: "too_far" };
  return { ok: true, sendAt };
}

/**
 * Send preconditions plus the folder placement: only a draft that still sits in the
 * Drafts folder is sent by its schedule (a draft moved to Trash must not go out), and
 * no event-invitation draft (the draft send path relays no invitation).
 */
export async function assertSchedulableDraft(accountId: string, draftId: string) {
  const { draft, rawSource, identity } = await loadSendableDraft(accountId, draftId);
  const draftsFolder = findDraftsFolder(await getFolders(accountId), accountId);
  if (!draftsFolder || draft.folderId !== draftsFolder.id) throw new DraftSendError(409, "Only drafts in the Drafts folder can be scheduled.", "scheduled_send_draft_deleted");
  // A stored draft carries invitation metadata only; sending it would drop the calendar invitation.
  if (extractComposeInviteDraftFromSource(rawSource)) throw new DraftSendError(409, "Drafts with an event invitation cannot be scheduled.", "scheduled_send_invite");
  return { draft, identity, sourceFingerprint: scheduledDraftFingerprint(draft, rawSource) };
}

export type ScheduledSendOutcome =
  | { status: "sent" | "failed" | "cancelled"; reason: ScheduledSendReason | null }
  | { status: "queued"; reason: ScheduledSendReason; nextAttemptAt: number };

export type ScheduledSendDeps = {
  now: () => number;
  getAccount: (accountId: string) => Promise<Account | null>;
  resolveRole: typeof resolveAccountRole;
  assertDraft: typeof assertSchedulableDraft;
  send: typeof sendDraftForAccount;
};

export const defaultScheduledSendDeps: ScheduledSendDeps = {
  now: () => Date.now(),
  getAccount: getAccountById,
  resolveRole: resolveAccountRole,
  assertDraft: assertSchedulableDraft,
  send: sendDraftForAccount
};

function retryOrFail(row: ScheduledSend, now: number): ScheduledSendOutcome {
  const delay = SCHEDULED_SEND_RETRY_DELAYS_MS[row.attempts - 1];
  return delay === undefined
    ? { status: "failed", reason: "send_failed" }
    : { status: "queued", reason: "send_failed", nextAttemptAt: now + delay };
}

/** Permanent and possibly-delivered failures never retry; only failures before DATA (or before SMTP) do. */
export function classifyScheduledSendError(error: unknown, row: ScheduledSend, now: number): ScheduledSendOutcome {
  if (error instanceof OutboundAuthorizationError) return { status: "cancelled", reason: "permission_revoked" };
  if (error instanceof SenderIdentityError) return { status: "cancelled", reason: "identity_unavailable" };
  if (error instanceof DraftSendError) {
    if (error.code === "scheduled_send_claim_lost") return { status: "cancelled", reason: "interrupted" };
    if (error.code === "scheduled_send_security_revoked") return { status: "cancelled", reason: "security_revoked" };
    if (error.code === "scheduled_send_draft_deleted") return { status: "cancelled", reason: "draft_deleted" };
    if (error.code === "scheduled_send_draft_changed") return { status: "cancelled", reason: "draft_changed" };
    return error.status === 404 ? { status: "cancelled", reason: "draft_missing" } : { status: "failed", reason: "draft_invalid" };
  }
  if (isSmtpUpstreamFailure(error)) {
    // An explicit 5xx rejection (envelope or message) is final, never retried.
    if (getSmtpHttpError(error)?.status === 422) return { status: "failed", reason: "smtp_rejected" };
    // Only a failure provably before DATA can be retried; anything later or of unknown phase
    // (dropped connection, socket timeout, unclassified upstream error) may have been delivered.
    return smtpFailedBeforeData(error) ? retryOrFail(row, now) : { status: "failed", reason: "send_uncertain" };
  }
  // Not an SMTP transport failure: the attempt stopped before SMTP (DB, folders, draft source).
  return retryOrFail(row, now);
}

/**
 * One attempt for a row this process has claimed (`status='sending'`). The scheduling
 * user's live role is checked first and again, with the sender identity, synchronously
 * before SMTP inside `sendDraftForAccount` (`authorizeOutbound` with `scheduledByUserId`).
 */
export async function attemptScheduledSend(row: ScheduledSend, deps: ScheduledSendDeps = defaultScheduledSendDeps): Promise<ScheduledSendOutcome> {
  try {
    const account = await deps.getAccount(row.accountId);
    if (!account) return { status: "cancelled", reason: "account_missing" };
    if (!roleAtLeast(await deps.resolveRole(row.userId, row.accountId), SCHEDULED_SEND_MIN_ROLE)) {
      return { status: "cancelled", reason: "permission_revoked" };
    }
    await deps.assertDraft(row.accountId, row.draftId);
    await deps.send({
      account,
      accountId: row.accountId,
      clientId: "scheduled-send",
      draftId: row.draftId,
      actor: { userId: row.userId, clientId: "scheduled-send" },
      scheduledFingerprint: row.sourceFingerprint,
      authorization: jobAuthorization(row)
    });
    return { status: "sent", reason: null };
  } catch (error) {
    const outcome = classifyScheduledSendError(error, row, deps.now());
    console.warn("[scheduled-send] attempt failed", {
      scheduleId: row.id, accountId: row.accountId, attempt: row.attempts, outcome: outcome.status, reason: outcome.reason,
      error: error instanceof Error ? error.name : typeof error
    });
    return outcome;
  }
}
