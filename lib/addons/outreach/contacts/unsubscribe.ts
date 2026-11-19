import type { Database } from "bun:sqlite";
import { outreachPublicOrigin } from "../config";
import { getOutreachDb } from "../db";
import { newOutreachToken } from "../ids";
import { recordTrackingEvent } from "../tracking";
import { notifyContactUnmailable, unsubscribeGlobally } from "./consent";
import { findContact } from "./records";

export async function createUnsubscribeUrls(accountId: string, target: { sendId: string; contactId: string; listId?: string | null }): Promise<{ url: string; oneClickUrl: string } | null> {
  const origin = outreachPublicOrigin();
  if (!origin) return null;
  const db = await getOutreachDb();
  const token = db.transaction(() => {
    // A retry of the same send gets the token of its earlier attempt.
    const reused = db.query(`SELECT l.token FROM tracking_links l JOIN sends s ON s.accountId = l.accountId AND s.id = l.sendId
      WHERE l.accountId = ?1 AND l.sendId = ?2 AND l.kind = 'unsubscribe' AND l.listId IS ?3
        AND (s.kind = 'test' OR (s.contactId = ?4 AND l.contactId = ?4))
      ORDER BY l.createdAt, l.token LIMIT 1`).get(accountId, target.sendId, target.listId ?? null, target.contactId) as { token: string } | null;
    if (reused) return reused.token;
    const token = newOutreachToken();
    // Test mail may be sent to a different address from the profile used to render it.
    const inserted = db.query(`INSERT INTO tracking_links (token, accountId, sendId, contactId, listId, kind, createdAt)
      SELECT ?1, s.accountId, s.id, CASE WHEN s.kind = 'test' THEN NULL ELSE c.id END, ?2, 'unsubscribe', ?3 FROM sends s
      LEFT JOIN contacts c ON c.accountId = s.accountId AND c.id = ?4
      WHERE s.accountId = ?5 AND s.id = ?6 AND (s.kind = 'test' OR s.contactId = c.id)`)
      .run(token, target.listId ?? null, Date.now(), target.contactId, accountId, target.sendId);
    return inserted.changes ? token : null;
  }).immediate();
  if (!token) return null;
  const url = `${origin}/t/u/${token}`;
  return { url, oneClickUrl: url };
}

type UnsubscribeLink = { accountId: string; sendId: string; contactId: string | null; organizationName: string };

function findUnsubscribeLink(db: Database, token: string): UnsubscribeLink | null {
  if (!/^[A-Za-z0-9_-]{27}$/.test(token)) return null;
  // The globally unique token resolves the mailbox. The joins must stay within it.
  return db.query(`
    SELECT l.accountId, l.sendId, c.id AS contactId, coalesce(a.organizationName, '') AS organizationName
    FROM tracking_links l LEFT JOIN contacts c ON c.accountId = l.accountId AND c.id = l.contactId
    LEFT JOIN account_settings a ON a.accountId = l.accountId
    WHERE l.token = ? AND l.kind = 'unsubscribe'
  `).get(token) as UnsubscribeLink | null;
}

export async function getUnsubscribeOrganization(token: string): Promise<string> {
  return findUnsubscribeLink(await getOutreachDb(), token)?.organizationName ?? "";
}

export async function unsubscribeByToken(token: string, request: { ip?: string | null; userAgent?: string | null },
  at = Date.now(), recordEvent = recordTrackingEvent): Promise<void> {
  const db = await getOutreachDb();
  const result = db.transaction(() => {
    const link = findUnsubscribeLink(db, token);
    if (!link?.contactId) return null;
    const contact = findContact(db, link.accountId, link.contactId);
    if (!contact || !unsubscribeGlobally(db, contact, at)) return null;
    return { accountId: link.accountId, sendId: link.sendId, contactId: contact.id };
  }).immediate();
  if (!result) return;
  const { accountId, contactId, sendId } = result;
  try {
    await recordEvent({ accountId, contactId, sendId, type: "unsubscribe", at, ...request });
  } catch {
    console.warn("Outreach failed to record an unsubscribe event");
  }
  await notifyContactUnmailable(accountId, contactId);
}
