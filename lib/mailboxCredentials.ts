import type { Database } from "bun:sqlite";
import type { Account } from "./data";
import { getDb } from "./db/connection";
import { mapAccountRow, mergeAccount, persistAccountRow } from "./db/rowParsers";
import { resolveAccountRoleRow } from "./db/accountAccess";
import { roleAtLeast } from "./accountRole";
import { verifyImapCredentials } from "./mail/imapAuth";
import { verifySmtpCredentials } from "./mail/smtp";
import { withDbWriteRetry } from "./dbWriteRetry";
import { revokeAuthStreams } from "./authStreams";
import { currentAuthProof } from "./authPolicyContext";
import { reserveSecurityOperation, assertSecurityOperation, finishSecurityOperation } from "./db/authPolicy";
import { stripPersonalSettings } from "./accountPrefs";

export class MailboxCredentialError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export type MailboxPatch = Omit<Partial<Account>, "imap" | "smtp"> & {
  imap?: Partial<Account["imap"]>; smtp?: Partial<Account["smtp"]>; teamDefaults?: boolean;
};
export type CredentialActor = { userId: string; clientId?: string };
export type CredentialVerification = { imap: typeof verifyImapCredentials; smtp: typeof verifySmtpCredentials; authorize?: () => void };
const defaultVerification: CredentialVerification = { imap: verifyImapCredentials, smtp: verifySmtpCredentials };
const endpointKeys = ["host", "port", "secure", "user"] as const;
const normalized = (value: string) => value.trim().toLowerCase();

/** Sole repair/write-back service: relogin, PUT, POST-existing and optional IMAP login. */
export async function updateMailboxCredentials(accountId: string, patch: MailboxPatch, actor: CredentialActor,
  verification: CredentialVerification = defaultVerification, database?: Database): Promise<Account> {
  const db = database ?? await getDb();
  const originalRow = db.prepare("SELECT * FROM accounts WHERE id=?").get(accountId);
  if (!originalRow) throw new MailboxCredentialError("Account not found", 404);
  const original = mapAccountRow(originalRow);
  const assertActor = () => {
    if (!roleAtLeast(resolveAccountRoleRow(db, actor.userId, accountId), "manager")) throw new MailboxCredentialError("Insufficient mailbox role", 403);
  };
  assertActor(); verification.authorize?.();
  for (const key of ["id", "email", "dbPath", "ownerUserId"] as const) {
    if (key in patch && (patch as Record<string, unknown>)[key] !== (originalRow as Record<string, unknown>)[key]) throw new MailboxCredentialError(`${key} is immutable`);
  }
  for (const protocol of ["imap", "smtp"] as const) {
    const server = patch[protocol];
    if (server !== undefined && (!server || typeof server !== "object" || Array.isArray(server))) throw new MailboxCredentialError(`Invalid ${protocol} settings`);
    if (!server) continue;
    if (server.password !== undefined && typeof server.password !== "string") throw new MailboxCredentialError("Invalid password");
    for (const key of ["host", "user"] as const) if (key in server && (typeof server[key] !== "string" || !server[key]!.trim())) throw new MailboxCredentialError(`Invalid ${protocol}.${key}`);
    if ("port" in server && (!Number.isInteger(server.port) || server.port! < 1 || server.port! > 65535)) throw new MailboxCredentialError("Invalid port");
    if ("secure" in server && typeof server.secure !== "boolean") throw new MailboxCredentialError("Invalid secure flag");
    if (endpointKeys.some(k => k in server && server[k] !== original[protocol][k]) && !server.password?.trim()) throw new MailboxCredentialError(`Changing ${protocol} endpoint requires its password`);
  }
  const next = mergeAccount(original, { ...patch,
    ...(patch.caldav && !patch.caldav.password?.trim() ? { caldav: { ...patch.caldav, password: original.caldav?.password ?? "" } } : {}),
    settings: stripPersonalSettings(patch.settings, patch.teamDefaults === true) } as Partial<Account>);
  const imapChanged = JSON.stringify(next.imap) !== JSON.stringify(original.imap);
  const explicitSmtp = JSON.stringify(next.smtp) !== JSON.stringify(original.smtp);
  if (next.imap.password !== original.imap.password && !patch.smtp?.password?.trim() &&
      normalized(original.smtp.user) === normalized(original.imap.user) &&
      (!original.smtp.password || original.smtp.password === original.imap.password)) next.smtp.password = next.imap.password;
  // An owned personal address may be a login identity even while optional IMAP login is off.
  // Ownerless or differently addressed team mailboxes never acquire a personal identity here.
  const owner = original.ownerUserId ? db.prepare("SELECT id,email FROM auth_user WHERE id=?").get(original.ownerUserId) as { id: string; email: string } | undefined : undefined;
  const loginOwner = owner && normalized(original.email) === normalized(owner.email) &&
    [original.imap.user, next.imap.user].some(user => normalized(user) === normalized(owner.email)) ? owner.id : undefined;
  const identityChanged = ["imap", "smtp"].some(p => ["host", "user"].some(k =>
    next[p as "imap" | "smtp"][k as "host" | "user"] !== original[p as "imap" | "smtp"][k as "host" | "user"]));
  const assertIdentity = () => {
    const user = db.prepare("SELECT role FROM users WHERE id=?").get(actor.userId) as { role: string } | undefined;
    if (loginOwner && identityChanged && loginOwner !== actor.userId && user?.role !== "admin") throw new MailboxCredentialError("Only the owner or admin can change the login mailbox identity", 403);
  };
  assertIdentity();
  const credentialChanged = imapChanged || JSON.stringify(next.smtp) !== JSON.stringify(original.smtp);
  const inherited = currentAuthProof()?.op;
  const operation = loginOwner && credentialChanged ? (inherited?.userId === loginOwner ? inherited : await reserveSecurityOperation(db, loginOwner, "security.mailbox.credentials")) : undefined;
  try {
  if ((imapChanged || !!patch.imap?.password?.trim()) && !await verification.imap(next, next.imap.password, actor.clientId)) throw new MailboxCredentialError("Invalid IMAP credentials");
  if ((explicitSmtp || !!patch.smtp?.password?.trim()) && !await verification.smtp(next)) throw new MailboxCredentialError("Invalid SMTP credentials");
  await withDbWriteRetry("updateMailboxCredentials", () => db.transaction(() => {
    assertActor(); assertIdentity(); verification.authorize?.();
    if (operation) assertSecurityOperation(db, operation);
    const live = db.prepare("SELECT * FROM accounts WHERE id=?").get(accountId);
    const liveOwner = original.ownerUserId ? db.prepare("SELECT id,email FROM auth_user WHERE id=?").get(original.ownerUserId) : undefined;
    if (JSON.stringify(liveOwner) !== JSON.stringify(owner)) throw new MailboxCredentialError("Mailbox owner identity changed; retry repair", 409);
    // Network verification may race another repair or account update. Never overwrite the newly stored state.
    if (JSON.stringify(live) !== JSON.stringify(originalRow)) throw new MailboxCredentialError("Mailbox changed; retry repair", 409);
    persistAccountRow(db, next, (originalRow as { dbPath?: string }).dbPath);
    if (loginOwner && credentialChanged) {
      const result = db.prepare("UPDATE auth_security_state SET generation=generation+1 WHERE userId=?").run(loginOwner);
      if (!result.changes) throw new Error("Missing auth security state");
      db.prepare("DELETE FROM auth_pending_challenges WHERE userId=?").run(loginOwner);
      db.prepare("DELETE FROM auth_reauth_grants WHERE userId=?").run(loginOwner);
      db.prepare("DELETE FROM auth_session WHERE userId=?").run(loginOwner);
      db.prepare("DELETE FROM mcp_tokens WHERE createdByUserId=?").run(loginOwner);
    }
  }).immediate());
  if (loginOwner && credentialChanged) revokeAuthStreams({ userId: loginOwner });
  return next;
  } finally {
    if (operation && operation !== inherited) await finishSecurityOperation(db, operation);
  }
}
