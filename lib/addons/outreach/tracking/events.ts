import { setImmediate } from "node:timers/promises";
import { getOutreachDb } from "../db";
import { classifyTrackingClient } from "./classify";
import { lookupTrackingLocation, normalizeTrackingIp, trackingIpExpiryCutoff, truncateTrackingIp } from "./ip";
import { isRecentOpen, OPEN_DEDUP_MS, recentOpenDigest, rememberRecentOpen } from "./recentOpens";
import type { NewTrackingEvent } from "./index";

/** Stored opens per send, and separately stored clicks per send: one kind never crowds out the other. */
const MAX_ENGAGEMENT_EVENTS_PER_SEND = 2_000;
/**
 * One client (address as stored) and one click link get a fraction of a kind's send budget, so a
 * single link holder cannot use up the history every other recipient of the send records into.
 */
const MAX_ENGAGEMENT_EVENTS_PER_SOURCE = 200;

export async function recordTrackingEvent(event: NewTrackingEvent): Promise<void> {
  const at = event.at ?? Date.now();
  const fullIp = normalizeTrackingIp(event.ip);
  const userAgent = event.userAgent?.slice(0, 1024) || null;
  const location = await lookupTrackingLocation(fullIp);
  const details = event.detail ? JSON.stringify(event.detail) : null;
  const db = await getOutreachDb();
  const now = Date.now();
  const digest = db.transaction(() => {
    const send = event.sendId ? db.prepare("SELECT sentAt, status, contactId FROM sends WHERE accountId = ? AND id = ?")
      .get(event.accountId, event.sendId) as { sentAt: number | null; status: string; contactId: string | null } | null : null;
    if (event.sendId && !send) return;

    const publicEvent = event.type === "open" || event.type === "click";
    let contactId = event.contactId ?? send?.contactId ?? null;
    let linkToken: string | null = null;
    if (event.linkToken !== undefined) {
      if (!publicEvent || !event.sendId) return;
      const link = db.prepare("SELECT contactId FROM tracking_links WHERE token = ? AND accountId = ? AND sendId = ? AND kind = ?")
        .get(event.linkToken, event.accountId, event.sendId, event.type) as { contactId: string | null } | null;
      if (!link) return;
      contactId = link.contactId ?? send?.contactId ?? null;
      linkToken = event.linkToken;
    }
    const contactExists = db.prepare("SELECT 1 FROM contacts WHERE accountId = ? AND id = ?");
    if (event.contactId && !contactExists.get(event.accountId, event.contactId)) return;
    if (contactId && contactId !== event.contactId && !contactExists.get(event.accountId, contactId)) return;

    if (publicEvent && event.sendId && db.prepare(`SELECT 1 FROM tracking_events
      WHERE accountId = ? AND sendId = ? AND type = ? LIMIT 1 OFFSET ?`)
      .get(event.accountId, event.sendId, event.type, MAX_ENGAGEMENT_EVENTS_PER_SEND - 1)) return;

    // Existing callers can still provide a click URL. Resolve it against the send's links.
    if (event.type === "click" && !linkToken && event.sendId && event.url) {
      const link = db.prepare("SELECT token FROM tracking_links WHERE accountId = ? AND sendId = ? AND kind = 'click' AND url = ? LIMIT 1")
        .get(event.accountId, event.sendId, event.url) as { token: string } | null;
      linkToken = link?.token ?? null;
    }

    const settings = db.prepare("SELECT enabled, ipRetentionDays FROM account_settings WHERE accountId = ?")
      .get(event.accountId) as { enabled: number; ipRetentionDays: number } | null;
    // Opens and clicks are recorded only while the owning mailbox has the addon switched on.
    // Links of mail sent earlier keep working (public.ts); they just stop collecting activity.
    if (publicEvent && !settings?.enabled) return;
    const truncate = Boolean(fullIp && at <= trackingIpExpiryCutoff(now, settings?.ipRetentionDays));
    const ip = truncate && fullIp ? truncateTrackingIp(fullIp) : fullIp;
    if (publicEvent && event.sendId) {
      const sourceOffset = MAX_ENGAGEMENT_EVENTS_PER_SOURCE - 1;
      if (db.prepare(`SELECT 1 FROM tracking_events WHERE accountId = ? AND sendId = ? AND type = ? AND ip IS ?
        LIMIT 1 OFFSET ?`).get(event.accountId, event.sendId, event.type, ip, sourceOffset)) return;
      if (event.type === "click" && linkToken && db.prepare(`SELECT 1 FROM tracking_events
        WHERE accountId = ? AND sendId = ? AND type = 'click' AND linkToken = ? LIMIT 1 OFFSET ?`)
        .get(event.accountId, event.sendId, linkToken, sourceOffset)) return;
    }
    const client = classifyTrackingClient(userAgent, event.type, at, send?.sentAt ?? (send?.status === "sending" ? at : null), event.detail?.requestMethod);
    const machine = Number(client.machine);

    let digest: string | undefined;
    if (event.type === "open" && event.sendId) {
      // A HEAD or preflight must not suppress a later human open.
      if (truncate && fullIp) {
        digest = recentOpenDigest(event.accountId, event.sendId, fullIp, userAgent, machine);
        if (isRecentOpen(db, digest, at, now)) return;
      }
      if (db.prepare(`SELECT 1 FROM tracking_events WHERE accountId = ? AND sendId = ? AND type = 'open'
        AND ip IS ? AND ipTruncated = 0 AND userAgent IS ? AND machine = ? AND at > ? AND at < ? LIMIT 1`)
        .get(event.accountId, event.sendId, fullIp, userAgent, machine, at - OPEN_DEDUP_MS, at + OPEN_DEDUP_MS)) return;
    }

    db.prepare(`INSERT INTO tracking_events (accountId, sendId, contactId, type, at, ip, ipTruncated,
      country, region, city, userAgent, clientName, clientOs, clientType, machine, url, detail, linkToken)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(event.accountId, event.sendId, contactId, event.type, at, ip, Number(truncate),
        location.country, location.region, location.city, userAgent, client.clientName, client.clientOs, client.clientType,
        machine, event.type === "click" ? null : event.url ?? null, details, event.type === "click" ? linkToken : null);
    return digest;
  }).immediate();
  if (digest) rememberRecentOpen(db, digest, at, now);
}

const RETENTION_BATCH_SIZE = 500;
const RETENTION_MAX_BATCHES_PER_ACCOUNT = 20;

export async function runTrackingRetention(now = Date.now()): Promise<number> {
  const db = await getOutreachDb();
  // Account discovery is global because the scheduler supplies no mailbox. The
  // expiry scan and each write use the discovered accountId.
  const accounts = db.prepare("SELECT DISTINCT accountId FROM tracking_events WHERE ipTruncated = 0 AND ip IS NOT NULL").all() as { accountId: string }[];
  const settings = db.prepare("SELECT ipRetentionDays FROM account_settings WHERE accountId = ?");
  const expired = db.prepare(`SELECT id, ip FROM tracking_events
    WHERE accountId = ? AND ipTruncated = 0 AND ip IS NOT NULL AND at <= ?
    ORDER BY at, id LIMIT ?`);
  const update = db.prepare("UPDATE tracking_events SET ip = ?, ipTruncated = 1 WHERE accountId = ? AND id = ? AND ipTruncated = 0");
  let changed = 0;
  let started = false;
  for (const { accountId } of accounts) {
    const truncateBatch = db.transaction(() => {
      const row = settings.get(accountId) as { ipRetentionDays: number } | null;
      const before = trackingIpExpiryCutoff(now, row?.ipRetentionDays);
      const batch = expired.all(accountId, before, RETENTION_BATCH_SIZE) as { id: number; ip: string }[];
      for (const event of batch) changed += update.run(truncateTrackingIp(event.ip), accountId, event.id).changes;
      return batch.length;
    });
    for (let batch = 0; batch < RETENTION_MAX_BATCHES_PER_ACCOUNT; batch++) {
      if (started) await setImmediate();
      started = true;
      if (truncateBatch.immediate() < RETENTION_BATCH_SIZE) break;
    }
  }
  return changed;
}
