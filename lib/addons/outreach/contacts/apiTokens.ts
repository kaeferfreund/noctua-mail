import { createHash, timingSafeEqual } from "crypto";
import { getOutreachDb } from "../db";
import { newOutreachId, newOutreachToken } from "../ids";
import type { OutreachApiToken, SubscribeRequest, SubscribeResponse } from "../types";
import { subscribeToList } from "./consent";
import { ContactError } from "./input";
import { findContactByEmail, insertContact, requireList, updateContactFields } from "./records";

type TokenRow = Omit<OutreachApiToken, "listIds"> & { listIds: string };
type AuthenticatedToken = { accountId: string; id: string };
const safeFields = "id, name, listIds, createdAt, lastUsedAt, revokedAt";
const hash = (secret: string) => createHash("sha256").update(secret).digest();
const unknownHash = Buffer.alloc(32);

function tokenFromRow(row: TokenRow): OutreachApiToken {
  return { ...row, listIds: JSON.parse(row.listIds) };
}

export async function listApiTokens(accountId: string): Promise<OutreachApiToken[]> {
  const db = await getOutreachDb();
  const rows = db.query(`SELECT ${safeFields} FROM api_tokens WHERE accountId = ? ORDER BY createdAt DESC, id`)
    .all(accountId) as TokenRow[];
  return rows.map(tokenFromRow);
}

export async function createApiToken(accountId: string, userId: string, input: { name: string; listIds: string[] }, now = Date.now()) {
  const db = await getOutreachDb();
  const secret = newOutreachToken();
  const token = db.transaction(() => {
    for (const listId of input.listIds) requireList(db, accountId, listId);
    const row = db.query(`
      INSERT INTO api_tokens (id, accountId, name, tokenHash, listIds, createdAt, createdByUserId)
      VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING ${safeFields}
    `).get(newOutreachId("tok"), accountId, input.name, hash(secret).toString("hex"), JSON.stringify(input.listIds), now, userId) as TokenRow;
    return tokenFromRow(row);
  }).immediate();
  return { token, secret };
}

export async function revokeApiToken(accountId: string, tokenId: string, now = Date.now()) {
  const db = await getOutreachDb();
  const result = db.query("UPDATE api_tokens SET revokedAt = coalesce(revokedAt, ?) WHERE accountId = ? AND id = ?")
    .run(now, accountId, tokenId);
  if (!result.changes) throw new ContactError("API token not found", 404);
}

function unauthorized() {
  return new ContactError("Invalid bearer token", 401);
}

export async function authenticateSubscribeToken(header: string | null): Promise<AuthenticatedToken> {
  const secret = /^Bearer ([A-Za-z0-9_-]{27})$/i.exec(header ?? "")?.[1];
  if (!secret) throw unauthorized();
  const digest = hash(secret);
  const db = await getOutreachDb();
  // The digest is globally unique and resolves the token's account before we have a trusted account ID.
  const row = db.query(`
    SELECT t.id, t.accountId, t.tokenHash, t.revokedAt FROM api_tokens t
    JOIN account_settings a ON a.accountId = t.accountId WHERE t.tokenHash = ?
  `).get(digest.toString("hex")) as (AuthenticatedToken & { tokenHash: string; revokedAt: number | null }) | null;
  if (!timingSafeEqual(digest, row ? Buffer.from(row.tokenHash, "hex") : unknownHash) || !row || row.revokedAt !== null) {
    throw unauthorized();
  }
  return { id: row.id, accountId: row.accountId };
}

export async function subscribeWithApiToken({ accountId, id }: AuthenticatedToken, input: SubscribeRequest, now = Date.now()): Promise<SubscribeResponse> {
  const db = await getOutreachDb();
  const result = db.transaction(() => {
    const token = db.query(`
      SELECT t.listIds, a.enabled FROM api_tokens t JOIN account_settings a ON a.accountId = t.accountId
      WHERE t.accountId = ? AND t.id = ? AND t.revokedAt IS NULL
    `).get(accountId, id) as { listIds: string; enabled: number } | null;
    if (!token) throw unauthorized();
    if (token.enabled !== 1) throw new ContactError("The newsletter addon is not activated for this mailbox.", 409, "outreach_disabled");
    if (!(JSON.parse(token.listIds) as string[]).includes(input.listId)) throw new ContactError("List is outside the token scope", 403);
    const list = requireList(db, accountId, input.listId);
    if (list.optIn === "double") throw new ContactError("Double opt-in is not supported", 409, "double_opt_in_unsupported");
    const at = input.consentAt ?? now;
    if (at > now) throw new ContactError("consentAt cannot be in the future");
    const existing = findContactByEmail(db, accountId, input.email);
    const contact = existing ? updateContactFields(db, existing, input, now) : insertContact(db, accountId, input, "api", now);
    subscribeToList(db, contact, input.listId, {
      at, source: input.consentSource ?? "api", explicit: input.consentAt !== undefined
    }, now);
    db.query("UPDATE api_tokens SET lastUsedAt = ? WHERE accountId = ? AND id = ?").run(now, accountId, id);
    return { contactId: contact.id, created: !existing };
  }).immediate();
  return { ok: true, contactId: result.contactId, status: "subscribed", created: result.created };
}
