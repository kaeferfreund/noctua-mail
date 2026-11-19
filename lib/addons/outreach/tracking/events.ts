import { OUTREACH_DEFAULT_IP_RETENTION_DAYS } from "../config";
import { getOutreachDb } from "../db";
import { classifyTrackingClient } from "./classify";
import { DAY_MS, lookupTrackingLocation, normalizeTrackingIp, truncateTrackingIp } from "./ip";
import { isRecentOpen, OPEN_DEDUP_MS, recentOpenDigest, rememberRecentOpen } from "./recentOpens";
import type { NewTrackingEvent } from "./index";

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

    const settings = db.prepare("SELECT ipRetentionDays FROM account_settings WHERE accountId = ?")
      .get(event.accountId) as { ipRetentionDays: number } | null;
    const truncate = Boolean(fullIp && (settings?.ipRetentionDays === 0 ||
      now - at >= (settings?.ipRetentionDays ?? OUTREACH_DEFAULT_IP_RETENTION_DAYS) * DAY_MS));
    const ip = truncate && fullIp ? truncateTrackingIp(fullIp) : fullIp;
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
      country, region, city, userAgent, clientName, clientOs, clientType, machine, url, detail)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(event.accountId, event.sendId, event.contactId ?? send?.contactId ?? null, event.type, at, ip, Number(truncate),
        location.country, location.region, location.city, userAgent, client.clientName, client.clientOs, client.clientType,
        machine, event.url ?? null, details);
    return digest;
  }).immediate();
  if (digest) rememberRecentOpen(db, digest, at, now);
}

const RETENTION_BATCH_SIZE = 500;

export async function runTrackingRetention(now = Date.now()): Promise<number> {
  const db = await getOutreachDb();
  // Account discovery is global because the scheduler supplies no mailbox. The
  // expiry scan and each write use the discovered accountId.
  const accounts = db.prepare("SELECT DISTINCT accountId FROM tracking_events").all() as { accountId: string }[];
  const settings = db.prepare("SELECT ipRetentionDays FROM account_settings WHERE accountId = ?");
  const expired = db.prepare(`SELECT id, ip FROM tracking_events
    WHERE accountId = ? AND ipTruncated = 0 AND ip IS NOT NULL AND at <= ?
    ORDER BY at, id LIMIT ?`);
  const update = db.prepare("UPDATE tracking_events SET ip = ?, ipTruncated = 1 WHERE accountId = ? AND id = ? AND ipTruncated = 0");
  let changed = 0;
  for (const { accountId } of accounts) {
    changed += db.transaction(() => {
      const row = settings.get(accountId) as { ipRetentionDays: number } | null;
      const before = now - (row?.ipRetentionDays ?? OUTREACH_DEFAULT_IP_RETENTION_DAYS) * DAY_MS;
      const batch = expired.all(accountId, before, RETENTION_BATCH_SIZE) as { id: number; ip: string }[];
      let truncated = 0;
      for (const event of batch) truncated += update.run(truncateTrackingIp(event.ip), accountId, event.id).changes;
      return truncated;
    }).immediate();
  }
  return changed;
}
