import type { Account } from "./data";
import { z } from "zod";
import { randomUUID } from "crypto";
import { getDb } from "./db/connection";
import { persistAccountRow } from "./db/rowParsers";
import { withDbWriteRetry } from "./dbWriteRetry";
import { verifyImapCredentials } from "./mail/imapAuth";
import { verifySmtpCredentials } from "./mail/smtp";
import { accountIdFromEmail } from "./accountId";
import { teamFeaturesSupported } from "./teamFeatures";
import { MailboxCredentialError, type CredentialVerification } from "./mailboxCredentials";
const server = z.object({ host: z.string().trim().min(1).max(253), port: z.number().int().min(1).max(65535), secure: z.boolean(), user: z.string().trim().min(1).max(320), password: z.string().min(1).max(4096) }).strict();
export const newMailboxSchema = z.object({ name: z.string().trim().min(1).max(256), email: z.string().trim().toLowerCase().pipe(z.email()), avatar: z.string().max(2048).default(""), imap: server, smtp: server }).strict();
/** Admin-created shared mailboxes never gain ownership or login eligibility implicitly. */
export async function createAdminMailbox(actorUserId: string, body: unknown, clientId?: string,
  verification: CredentialVerification = { imap: verifyImapCredentials, smtp: verifySmtpCredentials }): Promise<Account> {
  if (!teamFeaturesSupported()) throw new MailboxCredentialError("Team features unavailable", 503);
  const parsed = newMailboxSchema.safeParse(body);
  if (!parsed.success) throw new MailboxCredentialError("Invalid mailbox");
  const account = { ...parsed.data, id: accountIdFromEmail(parsed.data.email) };
  const db = await getDb();
  if (db.prepare("SELECT id FROM accounts WHERE id=? OR lower(trim(email))=?").get(account.id, account.email)) throw new MailboxCredentialError("Mailbox already exists", 409);
  if (!await verification.imap(account, account.imap.password, clientId) || !await verification.smtp(account)) throw new MailboxCredentialError("Invalid mailbox credentials");
  await withDbWriteRetry("createAdminMailbox", () => db.transaction(() => {
    const actor = db.prepare(`SELECT u.id FROM auth_user u JOIN users p ON p.id=u.id WHERE u.id=? AND p.role='admin'
      AND NOT (COALESCE(u.banned,0)=1 AND (u.banExpires IS NULL OR julianday(u.banExpires)>julianday('now')))` ).get(actorUserId);
    if (!actor) throw new MailboxCredentialError("Forbidden", 403);
    if (db.prepare("SELECT id FROM accounts WHERE id=? OR lower(trim(email))=?").get(account.id, account.email)) throw new MailboxCredentialError("Mailbox already exists", 409);
    persistAccountRow(db, account);
    db.prepare("INSERT INTO admin_audit(id,actorUserId,action,targetAccountId,createdAt) VALUES (?,?,'account.create',?,?)").run(randomUUID(), actorUserId, account.id, Date.now());
  }).immediate());
  return account;
}
