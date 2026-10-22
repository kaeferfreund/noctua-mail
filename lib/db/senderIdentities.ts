import { recordAdminAuditRow } from "./adminAudit";
import type { AdminAuditAction } from "../data";
import type { Database } from "bun:sqlite";
import { randomUUID } from "crypto";
import type { SenderIdentity } from "../data";
import { normalizeIdentityEmail, getOwnAddresses } from "../ownAddresses";
import { getDb } from "./connection";

type IdentityRow = Omit<SenderIdentity, "enabled" | "isDefault"> & { enabled: number; isDefault: number };
export function listSenderIdentityRows(db: Database, accountId: string): SenderIdentity[] {
  return (db.prepare(`SELECT * FROM sender_identities WHERE accountId=?
    ORDER BY isDefault DESC, email COLLATE NOCASE, id`).all(accountId) as IdentityRow[])
    .map(row => ({ ...row, enabled: !!row.enabled, isDefault: !!row.isDefault,
      replyTo: row.replyTo ?? undefined, signatureId: row.signatureId ?? undefined }));
}
export async function listSenderIdentities(accountId: string): Promise<SenderIdentity[]> {
  return listSenderIdentityRows(await getDb(), accountId);
}
export async function getAccountOwnAddresses(accountId: string): Promise<string[]> {
  const db = await getDb();
  const account = db.prepare("SELECT id,email FROM accounts WHERE id=?").get(accountId) as { id: string; email: string } | undefined;
  return account ? getOwnAddresses(account, listSenderIdentityRows(db, accountId)) : [];
}
/** Caller holds the master write transaction; never overwrite manager configuration. */
export function seedSenderIdentityRow(db: Database, account: { id: string; email: string; name: string }, createdBy: string | null = null) {
  if (db.prepare("SELECT 1 FROM sender_identities WHERE accountId=? LIMIT 1").get(account.id)) return;
  const now = Date.now();
  db.prepare(`INSERT INTO sender_identities
    (id,accountId,email,displayName,isDefault,enabled,createdBy,createdAt,updatedAt)
    VALUES(?,?,?,?,1,1,?,?,?)`).run(randomUUID(), account.id,
      normalizeIdentityEmail(account.email) ?? account.email.trim().toLowerCase(), account.name, createdBy, now, now);
}

export function getIdentitySignatureIds(db: Database, accountId: string): string[] {
  const row = db.prepare("SELECT settings FROM accounts WHERE id=?").get(accountId) as { settings: string | null } | undefined;
  const settings = row?.settings ? JSON.parse(row.settings) : {};
  return (settings.signatures ?? []).map((signature: { id: string }) => signature.id);
}

/** Caller owns the immediate transaction, including validation and authorization. */
export function persistSenderIdentityMutation(db: Database, next: SenderIdentity, previous: SenderIdentity | undefined,
  identities: SenderIdentity[], changedFields: readonly string[], actor: { userId: string; clientId?: string }) {
  const oldDefaultId = identities.find(identity => identity.isDefault)?.id;
  const now = Date.now();
  if (next.isDefault) db.prepare("UPDATE sender_identities SET isDefault=0,updatedAt=? WHERE accountId=? AND isDefault=1 AND id<>?").run(now, next.accountId, next.id);
  next.updatedAt = now;
  db.prepare(`INSERT INTO sender_identities
    (id,accountId,email,displayName,replyTo,signatureId,isDefault,enabled,createdBy,createdAt,updatedAt)
    VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET displayName=excluded.displayName,
    replyTo=excluded.replyTo,signatureId=excluded.signatureId,isDefault=excluded.isDefault,
    enabled=excluded.enabled,updatedAt=excluded.updatedAt`).run(next.id, next.accountId, next.email, next.displayName,
      next.replyTo ?? null, next.signatureId ?? null, +next.isDefault, +next.enabled, next.createdBy, next.createdAt, now);
  const action: AdminAuditAction = !previous ? "identity.create" : previous.isDefault !== next.isDefault ? "identity.default_changed"
    : previous.enabled !== next.enabled ? next.enabled ? "identity.enable" : "identity.disable" : "identity.update";
  recordAdminAuditRow(db, { actorUserId: actor.userId, targetAccountId: next.accountId, action,
    payload: { identityId: next.id, email: next.email, changedFields, oldDefaultId,
      newDefaultId: next.isDefault ? next.id : oldDefaultId, clientId: actor.clientId } });
}
