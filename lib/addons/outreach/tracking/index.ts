/**
 * Tracking area (owner: tracking task). Public surface used by the other areas.
 * The signatures are the contract; the bodies below are placeholders of the base branch.
 */
import type { MessageTrackingSummary, SendStats, SendSummary, TrackingEventType } from "../types";

export type TrackedHtmlInput = {
  accountId: string;
  /** Row in `sends` this mail belongs to; it must exist before the call. */
  sendId: string;
  html: string;
  trackOpens: boolean;
  trackClicks: boolean;
  contactId?: string | null;
  /** Links that must stay untouched (the unsubscribe URLs). `mailto:`, `tel:`, `#…` and `/t/*` links are never rewritten. */
  keepUrls?: readonly string[];
};

/**
 * The wire version of a mail body: every eligible `<a href>` goes through `/t/c/<token>` and
 * one open pixel `/t/o/<token>.gif` is appended. Returns the input unchanged when tracking is
 * not possible (no public origin, both switches off). Never throws for malformed HTML.
 */
export async function prepareTrackedHtml(input: TrackedHtmlInput): Promise<string> {
  return input.html;
}

export type NewTrackingEvent = {
  accountId: string;
  sendId: string | null;
  contactId?: string | null;
  type: TrackingEventType;
  at?: number;
  /** Raw request data for open/click/unsubscribe; classification and geo lookup happen inside. */
  ip?: string | null;
  userAgent?: string | null;
  url?: string | null;
  detail?: Record<string, unknown>;
};

/** Stores one event. Used by the public routes and by the other areas (bounce, complaint, delivered, unsubscribe). */
export async function recordTrackingEvent(event: NewTrackingEvent): Promise<void> {
  void event;
}

/** Reader status of one sent message, by RFC Message-ID (with or without angle brackets) or send id. */
export async function getMessageTracking(accountId: string, selector: { messageId?: string; sendId?: string }): Promise<MessageTrackingSummary | null> {
  void accountId; void selector;
  return null;
}

export type SendFilter = { campaignId?: string; sequenceId?: string; sequenceStepId?: string; contactId?: string; since?: number; kinds?: readonly string[] };

export const EMPTY_SEND_STATS: SendStats = { recipients: 0, queued: 0, sent: 0, failed: 0, skipped: 0, opened: 0, clicked: 0,
  bounced: 0, unsubscribed: 0, complained: 0, machineOpens: 0 };

/** Aggregate over the sends that match the filter (`kind = 'test'` is always excluded). */
export async function getSendStats(accountId: string, filter: SendFilter): Promise<SendStats> {
  void accountId; void filter;
  return { ...EMPTY_SEND_STATS };
}

/** Sends with their per-send counters, newest first. `cursor` is the opaque value of the previous page. */
export async function listSendSummaries(accountId: string, filter: SendFilter, page: { limit: number; cursor?: string | null }): Promise<{ items: SendSummary[]; nextCursor: string | null }> {
  void accountId; void filter; void page;
  return { items: [], nextCursor: null };
}

/** Clicks per target URL of a campaign or sequence. */
export async function listLinkStats(accountId: string, filter: SendFilter): Promise<Array<{ url: string; clicks: number; uniqueClicks: number }>> {
  void accountId; void filter;
  return [];
}

/** Truncates IPs older than each mailbox's retention; called hourly by the scheduler. Returns the number of changed events. */
export async function runTrackingRetention(now = Date.now()): Promise<number> {
  void now;
  return 0;
}
