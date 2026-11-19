/**
 * Tracking area (owner: tracking task). Public surface used by the other areas.
 */
import { outreachPublicOrigin } from "../config";
import { getOutreachDb } from "../db";
import type { TrackingEventType } from "../types";
import { rewriteTrackedHtml } from "./rewrite";

export { recordTrackingEvent, runTrackingRetention } from "./events";
export { EMPTY_SEND_STATS, getMessageTracking, getOutreachOverview, getSendStats, listLinkStats, listSendSummaries,
  listTrackingEvents, trackingEventFilters } from "./read";
export { prepareComposeTracking } from "./compose";
export { trackingOpenResponse, trackingClickResponse } from "./public";

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
  const origin = outreachPublicOrigin();
  if (!origin || (!input.trackOpens && !input.trackClicks)) return input.html;
  const db = await getOutreachDb();
  return db.transaction(() => rewriteTrackedHtml(db, input, origin)).immediate();
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

export type SendFilter = { campaignId?: string; sequenceId?: string; sequenceStepId?: string; contactId?: string; since?: number; kinds?: readonly string[] };
