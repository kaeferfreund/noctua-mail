import type { SQLQueryBindings } from "bun:sqlite";
import { z } from "zod";
import { getOutreachDb } from "../db";
import { TRACKING_EVENT_TYPES, type MessageTrackingSummary, type OutreachOverview, type SendStats, type SendSummary, type TrackingEvent, type TrackingEventsResponse } from "../types";
import { DAY_MS, trackingIpExpiryCutoff, truncateTrackingIp } from "./ip";
import type { SendFilter } from "./index";

export const EMPTY_SEND_STATS: SendStats = { recipients: 0, queued: 0, sent: 0, failed: 0, skipped: 0, opened: 0, clicked: 0,
  bounced: 0, unsubscribed: 0, complained: 0, machineOpens: 0 };

function sendFilter(accountId: string, filter: SendFilter) {
  const where = ["s.accountId = ?", "s.kind <> 'test'"];
  const args: SQLQueryBindings[] = [accountId];
  for (const key of ["campaignId", "sequenceId", "sequenceStepId", "contactId"] as const) {
    if (filter[key] !== undefined) {
      where.push(`s.${key} = ?`);
      args.push(filter[key]);
    }
  }
  if (filter.since !== undefined) {
    where.push("COALESCE(s.sentAt, s.queuedAt) >= ?");
    args.push(filter.since);
  }
  if (filter.kinds) {
    where.push(filter.kinds.length ? `s.kind IN (${filter.kinds.map(() => "?").join(",")})` : "0");
    args.push(...filter.kinds);
  }
  return { where, args };
}

type EventRow = Omit<TrackingEvent, "machine" | "ipTruncated"> & {
  machine: number; ipTruncated: number; ipRetentionDays: number | null;
};
const eventUrl = `COALESCE(e.url, (SELECT link.url FROM tracking_links link
  WHERE link.token = e.linkToken AND link.accountId = e.accountId AND link.sendId = e.sendId AND link.kind = 'click'))`;
const eventColumns = `e.id, e.sendId, e.contactId, e.type, e.at, e.ip, e.ipTruncated, e.country, e.region, e.city,
  e.userAgent, e.clientName, e.clientOs, e.clientType, e.machine, ${eventUrl} AS url, a.ipRetentionDays`;
const eventForSend = "e.accountId = s.accountId AND e.sendId = s.id";

function asEvent({ ipRetentionDays, ...row }: EventRow, now: number): TrackingEvent {
  const { ip, machine, ipTruncated, ...event } = row;
  if (ip !== null && ipTruncated === 0 && event.at <= trackingIpExpiryCutoff(now, ipRetentionDays)) {
    return { ...event, ip: truncateTrackingIp(ip), machine: machine === 1, ipTruncated: true };
  }
  return { ...event, ip, machine: machine === 1, ipTruncated: ipTruncated === 1 };
}

type MessageRow = Pick<MessageTrackingSummary, "sendId" | "kind" | "messageId" | "recipients" | "subject" | "sentAt"> & {
  trackOpens: number; trackClicks: number;
};
type MessageCounts = Pick<MessageTrackingSummary, "opens" | "machineOpens" | "clicks" | "firstOpenedAt" | "lastOpenedAt" | "lastClickedAt"> & {
  bounced: number;
};

export async function getMessageTracking(accountId: string, selector: { messageId?: string; sendId?: string }): Promise<MessageTrackingSummary | null> {
  const messageId = selector.messageId?.trim().replace(/^<|>$/g, "").trim();
  const sendId = selector.sendId?.trim();
  if (!sendId && !messageId) return null;
  const db = await getOutreachDb();
  const row = db.prepare(`SELECT s.id AS sendId, s.kind, s.messageId, s.recipients, s.subject, s.sentAt, s.trackOpens, s.trackClicks
    FROM sends s WHERE s.accountId = ? AND s.kind <> 'test' AND ${sendId ? "s.id = ?" : "s.messageId IN (?, ?)"}
    ORDER BY s.queuedAt DESC, s.id DESC LIMIT 1`)
    .get(accountId, ...(sendId ? [sendId] : [`<${messageId}>`, messageId!])) as MessageRow | null;
  if (!row) return null;

  const counts = db.prepare(`SELECT
    COUNT(*) FILTER (WHERE type = 'open' AND machine = 0) AS opens,
    COUNT(*) FILTER (WHERE type = 'open' AND machine = 1) AS machineOpens,
    COUNT(*) FILTER (WHERE type = 'click' AND machine = 0) AS clicks,
    MIN(at) FILTER (WHERE type = 'open' AND machine = 0) AS firstOpenedAt,
    MAX(at) FILTER (WHERE type = 'open' AND machine = 0) AS lastOpenedAt,
    MAX(at) FILTER (WHERE type = 'click' AND machine = 0) AS lastClickedAt,
    COUNT(*) FILTER (WHERE type = 'bounce' AND machine = 0) AS bounced
    FROM tracking_events WHERE accountId = ? AND sendId = ?`).get(accountId, row.sendId) as MessageCounts;
  const last = db.prepare(`SELECT ${eventColumns} FROM tracking_events e
    LEFT JOIN account_settings a ON a.accountId = e.accountId
    WHERE e.accountId = ? AND e.sendId = ? AND e.machine = 0 AND e.type IN ('open', 'click')
    ORDER BY e.at DESC, e.id DESC LIMIT 1`).get(accountId, row.sendId) as EventRow | null;
  return { ...row, ...counts, trackOpens: Boolean(row.trackOpens), trackClicks: Boolean(row.trackClicks),
    bounced: counts.bounced > 0, lastEvent: last ? asEvent(last, Date.now()) : null };
}

export async function getSendStats(accountId: string, filter: SendFilter): Promise<SendStats> {
  const { where, args } = sendFilter(accountId, filter);
  const db = await getOutreachDb();
  return db.prepare(`SELECT
    COUNT(*) AS recipients,
    COUNT(*) FILTER (WHERE s.status IN ('queued', 'sending')) AS queued,
    COUNT(*) FILTER (WHERE s.status = 'sent') AS sent,
    COUNT(*) FILTER (WHERE s.status = 'failed') AS failed,
    COUNT(*) FILTER (WHERE s.status = 'skipped') AS skipped,
    COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM tracking_events e WHERE ${eventForSend} AND e.type = 'open' AND e.machine = 0)) AS opened,
    COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM tracking_events e WHERE ${eventForSend} AND e.type = 'click' AND e.machine = 0)) AS clicked,
    COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM tracking_events e WHERE ${eventForSend} AND e.type = 'bounce' AND e.machine = 0)) AS bounced,
    COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM tracking_events e WHERE ${eventForSend} AND e.type = 'unsubscribe' AND e.machine = 0)) AS unsubscribed,
    COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM tracking_events e WHERE ${eventForSend} AND e.type = 'complaint' AND e.machine = 0)) AS complained,
    COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM tracking_events e WHERE ${eventForSend} AND e.type = 'open' AND e.machine = 1)) AS machineOpens
    FROM sends s WHERE ${where.join(" AND ")}`).get(...args) as SendStats;
}

const sendCursor = z.tuple([z.number().int(), z.string().min(1).max(256)]);

function decodeSendCursor(cursor: string) {
  if (cursor.length > 512) return null;
  try {
    const parsed = sendCursor.safeParse(JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function listSendSummaries(accountId: string, filter: SendFilter, page: { limit: number; cursor?: string | null }): Promise<{ items: SendSummary[]; nextCursor: string | null }> {
  const { where, args } = sendFilter(accountId, filter);
  const db = await getOutreachDb();
  const limit = Number.isSafeInteger(page.limit) ? Math.min(Math.max(page.limit, 1), 200) : 50;
  if (page.cursor) {
    const cursor = decodeSendCursor(page.cursor);
    if (!cursor) return { items: [], nextCursor: null };
    where.push("(s.queuedAt, s.id) < (?, ?)");
    args.push(...cursor);
  }
  const rows = db.prepare(`WITH page AS (
    SELECT s.* FROM sends s WHERE ${where.join(" AND ")} ORDER BY s.queuedAt DESC, s.id DESC LIMIT ?
  )
  SELECT s.id AS sendId, s.queuedAt, s.kind, s.contactId, s.recipients, s.subject, s.status, s.error,
    s.sentAt, s.campaignId, s.sequenceId,
    (SELECT COUNT(*) FROM tracking_events e WHERE ${eventForSend} AND e.machine = 0 AND e.type = 'open') AS opens,
    (SELECT COUNT(*) FROM tracking_events e WHERE ${eventForSend} AND e.machine = 0 AND e.type = 'click') AS clicks,
    EXISTS (SELECT 1 FROM tracking_events e WHERE ${eventForSend} AND e.machine = 0 AND e.type = 'bounce') AS bounced,
    EXISTS (SELECT 1 FROM tracking_events e WHERE ${eventForSend} AND e.machine = 0 AND e.type = 'unsubscribe') AS unsubscribed
  FROM page s ORDER BY s.queuedAt DESC, s.id DESC`)
    .all(...args, limit + 1) as Array<Omit<SendSummary, "bounced" | "unsubscribed"> & { queuedAt: number; bounced: number; unsubscribed: number }>;
  const last = rows[limit - 1];
  const nextCursor = rows.length > limit ? Buffer.from(JSON.stringify([last.queuedAt, last.sendId])).toString("base64url") : null;
  return {
    items: rows.slice(0, limit).map(({ queuedAt: _queuedAt, bounced, unsubscribed, ...item }) =>
      ({ ...item, bounced: Boolean(bounced), unsubscribed: Boolean(unsubscribed) })),
    nextCursor
  };
}

export async function listLinkStats(accountId: string, filter: SendFilter): Promise<Array<{ url: string; clicks: number; uniqueClicks: number }>> {
  const { where, args } = sendFilter(accountId, filter);
  const db = await getOutreachDb();
  return db.prepare(`WITH targets AS (
    SELECT DISTINCT l.accountId, l.sendId, l.url
    FROM sends s JOIN tracking_links l ON l.accountId = s.accountId AND l.sendId = s.id AND l.kind = 'click' AND l.url IS NOT NULL
    WHERE ${where.join(" AND ")}
  )
  SELECT l.url, COUNT(e.id) AS clicks, COUNT(DISTINCT e.sendId) AS uniqueClicks
  FROM targets l LEFT JOIN tracking_events e ON e.accountId = l.accountId AND e.sendId = l.sendId
    AND e.type = 'click' AND e.machine = 0 AND ${eventUrl} = l.url
  GROUP BY l.url ORDER BY clicks DESC, l.url`).all(...args) as Array<{ url: string; clicks: number; uniqueClicks: number }>;
}

export const trackingEventFilters = {
  sendId: z.string().trim().min(1).max(256).optional(),
  contactId: z.string().trim().min(1).max(256).optional(),
  campaignId: z.string().trim().min(1).max(256).optional(),
  sequenceId: z.string().trim().min(1).max(256).optional(),
  type: z.enum(TRACKING_EVENT_TYPES).optional(),
  includeMachine: z.boolean().optional(),
  limit: z.number().int().min(1).max(200).optional(),
  before: z.number().int().positive().optional()
};
const eventFilterSchema = z.object(trackingEventFilters);

export async function listTrackingEvents(accountId: string, filter: z.infer<typeof eventFilterSchema>): Promise<TrackingEventsResponse> {
  const where = ["e.accountId = ?", "(e.sendId IS NULL OR (s.id IS NOT NULL AND s.kind <> 'test'))"];
  const args: SQLQueryBindings[] = [accountId];
  for (const key of ["sendId", "contactId", "type"] as const) {
    if (filter[key] !== undefined) {
      where.push(`e.${key} = ?`);
      args.push(filter[key]);
    }
  }
  for (const key of ["campaignId", "sequenceId"] as const) {
    if (filter[key] !== undefined) {
      where.push(`s.${key} = ?`);
      args.push(filter[key]);
    }
  }
  if (!filter.includeMachine) where.push("e.machine = 0");
  if (filter.before !== undefined) {
    where.push("(e.at, e.id) < (SELECT at, id FROM tracking_events WHERE accountId = ? AND id = ?)");
    args.push(accountId, filter.before);
  }
  const limit = filter.limit ?? 50;
  const db = await getOutreachDb();
  const rows = db.prepare(`SELECT ${eventColumns} FROM tracking_events e
    LEFT JOIN account_settings a ON a.accountId = e.accountId
    LEFT JOIN sends s ON s.accountId = e.accountId AND s.id = e.sendId
    WHERE ${where.join(" AND ")} ORDER BY e.at DESC, e.id DESC LIMIT ?`).all(...args, limit + 1) as EventRow[];
  const now = Date.now();
  return { ok: true, events: rows.slice(0, limit).map(row => asEvent(row, now)), nextBefore: rows.length > limit ? rows[limit - 1].id : null };
}

export async function getOutreachOverview(accountId: string, now = Date.now()): Promise<OutreachOverview> {
  const db = await getOutreachDb();
  const counts = db.prepare(`SELECT
    (SELECT COUNT(*) FROM contacts WHERE accountId = $accountId) AS contacts,
    (SELECT COUNT(*) FROM contacts WHERE accountId = $accountId AND emailConsent = 'subscribed') AS subscribed,
    (SELECT COUNT(*) FROM lists WHERE accountId = $accountId AND archivedAt IS NULL) AS lists,
    (SELECT COUNT(*) FROM campaigns WHERE accountId = $accountId) AS campaigns,
    (SELECT COUNT(*) FROM sequences WHERE accountId = $accountId AND status = 'live') AS sequencesLive`)
    .get({ $accountId: accountId }) as Omit<OutreachOverview, "ok" | "last30Days">;
  return { ok: true, ...counts, last30Days: await getSendStats(accountId, { since: now - 30 * DAY_MS }) };
}
