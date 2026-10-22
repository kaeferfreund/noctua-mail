/** Offline, explicitly reviewed identity import. No mailbox credential is an app password. */
import type { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { NoctuaAuth } from "./betterAuth";
import { importLegacyProfileFields } from "./db/authPolicy";
import { recordAdminAuditRow } from "./db/adminAudit";
import { insertUserAccountLinkRow } from "./db/users";

const id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const person = z.object({
  userId: id,
  legacyUserId: id.nullable(), // null means the old account-ID-only session had no profile
  email: z.email().max(320).transform(value => value.trim().toLowerCase()),
  name: z.string().trim().min(1).max(256).optional(),
  role: z.enum(["admin", "user"]),
  createdAt: z.number().int().nonnegative().max(8640000000000000),
  passwordProvenance: z.enum(["user-chosen", "recovery"]),
}).strict();
export const migrationManifest = z.object({
  version: z.literal(1),
  users: z.array(person),
  memberships: z.array(z.object({ userId: id, accountId: id, role: z.enum(["viewer", "editor", "manager"]) }).strict()),
}).strict();
export type TeamAuthMigrationManifest = z.input<typeof migrationManifest>;

function reject(): never { throw new Error("Migration refused: inspect the reviewed IDs, personal addresses, provenance and mapping; no identities were imported."); }

/** Bound imported Argon2 work factors; reject arbitrary/temporary/unsupported credential formats. */
function chosenHash(value: unknown) {
  if (typeof value !== "string") return reject();
  const match = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/.exec(value);
  if (!match || +match[1] < 8192 || +match[1] > 262144 || +match[2] < 1 || +match[2] > 10 || +match[3] < 1 || +match[3] > 16 ||
    Buffer.from(match[4], "base64").length < 16 || Buffer.from(match[4], "base64").length > 64 ||
    Buffer.from(match[5], "base64").length < 32 || Buffer.from(match[5], "base64").length > 64) return reject();
  return value;
}

/** Pass the dedicated auth handle: all adapter writes and Noctua receipts share ONE transaction. */
export async function migrateTeamAuth(auth: NoctuaAuth, db: Database, input: unknown) {
  const parsed = migrationManifest.safeParse(input);
  if (!parsed.success) return reject();
  const manifest = parsed.data;
  const digest = createHash("sha256").update(JSON.stringify(manifest)).digest("hex");
  const receipt = `team-auth-import-v1:${digest}`;
  const context = await auth.$context;
  return context.adapter.transaction(async adapter => {
    if (db.prepare(`SELECT 1 FROM noctua_auth_migrations WHERE id=?`).get(receipt)) return { status: "already_complete", imported: 0, userIds: manifest.users.map(user => user.userId) };
    if (db.prepare(`SELECT 1 FROM noctua_auth_migrations WHERE id LIKE 'team-auth-import-v1:%'`).get()) return reject();
    const legacy = db.prepare(`SELECT * FROM users`).all() as Record<string, any>[];
    const ids = new Set(manifest.users.map(user => user.userId));
    const emails = new Set(manifest.users.map(user => user.email));
    if (ids.size !== manifest.users.length || emails.size !== manifest.users.length) return reject();
    // Reject ambiguous source profiles even when a manifest attempts to omit one.
    if (db.prepare(`SELECT 1 FROM users GROUP BY lower(trim(email)) HAVING count(*)>1`).get()) return reject();
    for (const row of legacy) if (!manifest.users.some(user => user.legacyUserId === row.id) && !db.prepare(`SELECT 1 FROM auth_user WHERE id=?`).get(row.id)) return reject();
    const prepared = manifest.users.map(user => {
      const row = legacy.find(row => row.id === user.legacyUserId);
      if ((user.legacyUserId !== null && (!row || user.legacyUserId !== user.userId || String(row.email).trim().toLowerCase() !== user.email || row.role !== user.role || row.createdAt !== user.createdAt)) ||
        (user.legacyUserId === null && legacy.some(row => row.id === user.userId || String(row.email).trim().toLowerCase() === user.email)) ||
        db.prepare(`SELECT 1 FROM auth_user WHERE id=? OR lower(trim(email))=?`).get(user.userId, user.email) ||
        db.prepare(`SELECT 1 FROM user_provisioning WHERE userId=? AND state NOT IN ('complete','cancelled')`).get(user.userId)) return reject();
      if (db.prepare(`SELECT 1 FROM accounts a WHERE lower(trim(a.email))=? AND (a.ownerUserId IS NULL OR a.ownerUserId<>? OR EXISTS(SELECT 1 FROM user_accounts ua WHERE ua.accountId=a.id AND ua.userId<>?))`).get(user.email,user.userId,user.userId)) return reject();
      const name = user.name ?? (typeof row?.name === "string" ? row.name.trim() : "");
      if (!name || name.length > 256) return reject();
      const password = user.passwordProvenance === "user-chosen" ? chosenHash(row?.passwordHash) : null;
      if (password && (row?.mustChangePassword || row?.temporaryPassword || row?.passwordIsTemporary)) return reject();
      return { ...user, name, password };
    });
    const links = new Set<string>();
    for (const link of manifest.memberships) {
      const key = `${link.userId}:${link.accountId}`;
      if (links.has(key) || !ids.has(link.userId) || !db.prepare(`SELECT 1 FROM accounts WHERE id=?`).get(link.accountId) ||
        db.prepare(`SELECT 1 FROM user_accounts WHERE userId=? AND accountId=? AND role<>?`).get(link.userId,link.accountId,link.role)) return reject();
      links.add(key);
    }
    for (const user of prepared) {
      const now = new Date(), createdAt = new Date(user.createdAt);
      await adapter.create({model:"user",forceAllowId:true,data:{id:user.userId,email:user.email,name:user.name,role:user.role,emailVerified:false,createdAt,updatedAt:now,banned:false,banExpires:null,twoFactorEnabled:false}});
      // Reuse the existing per-user receipt so startup cannot reapply stale name/ban fields.
      importLegacyProfileFields(db,user.userId);
      await adapter.update({model:"user",where:[{field:"id",value:user.userId}],update:{name:user.name}});
      if (user.password) await adapter.create({model:"account",forceAllowId:true,data:{id:crypto.randomUUID(),accountId:user.userId,userId:user.userId,providerId:"credential",password:user.password,createdAt,updatedAt:now}});
      const opId = `migration:${user.userId}`;
      db.prepare(`INSERT INTO user_provisioning(id,userId,normalizedEmail,kind,state,createdAt,updatedAt) VALUES(?,?,?,'migration','complete',?,?)`).run(opId,user.userId,user.email,Date.now(),Date.now());
      recordAdminAuditRow(db,{actorUserId:"operator",action:"user.create",targetUserId:user.userId,payload:{operationId:opId,source:"migration",passwordImported:!!user.password}});
    }
    for (const link of manifest.memberships) insertUserAccountLinkRow(db,link.userId,link.accountId,link.role);
    // One cutover barrier, never repeated on a second run (which must preserve new sessions/tokens).
    db.exec(`UPDATE auth_security_state SET generation=generation+1;
      UPDATE auth_login_epoch SET generation=generation+1 WHERE id=1;
      DELETE FROM auth_session; DELETE FROM mcp_tokens; DELETE FROM auth_reauth_grants;
      DELETE FROM auth_pending_challenges; DELETE FROM auth_verification;`);
    db.prepare(`INSERT INTO noctua_auth_migrations(id) VALUES(?)`).run(receipt);
    return {status:"complete",imported:prepared.length,userIds:prepared.map(user=>user.userId)};
  });
}
