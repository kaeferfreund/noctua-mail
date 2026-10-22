import { withDbWriteRetry } from "../dbWriteRetry";
import { getDb } from "./connection";
import type { Database } from "bun:sqlite";
import { ensureTableColumns } from "./schema";

// Better Auth owns its six model tables. These are Noctua's policy metadata;
// never manufacture a session/assurance record from a user-wide MFA flag.
const tables = [
  `CREATE TABLE IF NOT EXISTS auth_login_epoch (
    id INTEGER PRIMARY KEY CHECK(id=1), generation INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS auth_security_state (
    userId TEXT PRIMARY KEY REFERENCES auth_user(id) ON DELETE CASCADE,
    generation INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS auth_session_security (
    sessionId TEXT PRIMARY KEY REFERENCES auth_session(id) ON DELETE CASCADE,
    userId TEXT NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
    generation INTEGER NOT NULL,
    assurance TEXT NOT NULL CHECK(assurance IN ('setup','mfa')),
    authenticatedAt INTEGER NOT NULL, method TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS auth_pending_challenges (
    identifier TEXT PRIMARY KEY,
    userId TEXT REFERENCES auth_user(id) ON DELETE CASCADE,
    generation INTEGER, loginEpoch INTEGER, authenticatedAt INTEGER NOT NULL,
    kind TEXT NOT NULL, sourceSessionId TEXT, expiresAt INTEGER NOT NULL,
    CHECK((userId IS NOT NULL AND generation IS NOT NULL) OR
      (kind='passkey_login' AND loginEpoch IS NOT NULL))
  )`,
  `CREATE TABLE IF NOT EXISTS auth_reauth_grants (
    tokenHash TEXT PRIMARY KEY,
    userId TEXT NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
    sessionId TEXT NOT NULL REFERENCES auth_session(id) ON DELETE CASCADE,
    purpose TEXT NOT NULL, generation INTEGER NOT NULL, challengeId TEXT,
    state TEXT NOT NULL DEFAULT 'issued', expiresAt INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS user_provisioning (
    id TEXT PRIMARY KEY, userId TEXT NOT NULL, normalizedEmail TEXT NOT NULL,
    inviteCode TEXT, kind TEXT NOT NULL, state TEXT NOT NULL,
    createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS admin_lifecycle_operations (
    id TEXT PRIMARY KEY, slot TEXT UNIQUE, actorUserId TEXT NOT NULL,
    targetUserId TEXT NOT NULL, action TEXT NOT NULL, payload TEXT,
    state TEXT NOT NULL, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL
  )`
];

// Null-safe comparisons matter: adding/removing a password is a revocation too.
// Identity moves invalidate both principals, including credential -> OAuth moves.
const oldCredentialChanged = `OLD.providerId='credential' AND
  (OLD.password IS NOT NEW.password OR OLD.providerId IS NOT NEW.providerId OR
   OLD.userId IS NOT NEW.userId OR OLD.accountId IS NOT NEW.accountId)`;
const newCredentialChanged = `NEW.providerId='credential' AND
  (OLD.password IS NOT NEW.password OR OLD.providerId IS NOT NEW.providerId OR
   OLD.userId IS NOT NEW.userId OR OLD.accountId IS NOT NEW.accountId)`;
const credentialIdentityMoved = `OLD.userId IS NOT NEW.userId AND
  (OLD.providerId='credential' OR NEW.providerId='credential')`;

function advance(userId: string, when = "1") {
  return `
    SELECT CASE WHEN (${when}) AND NOT EXISTS
      (SELECT 1 FROM auth_security_state WHERE userId=${userId})
      THEN RAISE(ABORT,'Missing auth security state') END;
    UPDATE auth_security_state SET generation=generation+1 WHERE userId=${userId} AND (${when});`;
}

const triggers: Record<string, string> = {
  noctua_user_insert: `CREATE TRIGGER noctua_user_insert AFTER INSERT ON auth_user BEGIN
    INSERT INTO users(id,email,role,createdAt)
    VALUES(NEW.id,lower(trim(NEW.email)),CASE WHEN NEW.role='admin' THEN 'admin' ELSE 'user' END,
      CAST(round((julianday(NEW.createdAt)-2440587.5)*86400000) AS INTEGER))
    ON CONFLICT(id) DO UPDATE SET email=excluded.email,role=excluded.role;
    INSERT INTO auth_security_state(userId,generation) VALUES(NEW.id,0);
  END`,
  noctua_user_update: `CREATE TRIGGER noctua_user_update AFTER UPDATE OF email,role ON auth_user BEGIN
    UPDATE users SET email=lower(trim(NEW.email)),
      role=CASE WHEN NEW.role='admin' THEN 'admin' ELSE 'user' END WHERE id=NEW.id;
  END`,
  noctua_security_epoch: `CREATE TRIGGER noctua_security_epoch AFTER UPDATE OF generation ON auth_security_state
    WHEN OLD.generation IS NOT NEW.generation BEGIN
    SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM auth_login_epoch WHERE id=1)
      THEN RAISE(ABORT,'Missing auth login epoch') END;
    UPDATE auth_login_epoch SET generation=generation+1 WHERE id=1;
  END`,
  noctua_credential_insert: `CREATE TRIGGER noctua_credential_insert AFTER INSERT ON auth_account
    WHEN NEW.providerId='credential' AND NEW.password IS NOT NULL BEGIN
    ${advance("NEW.userId")}
  END`,
  noctua_credential_update: `CREATE TRIGGER noctua_credential_update AFTER UPDATE OF password,providerId,userId,accountId ON auth_account BEGIN
    ${advance("OLD.userId", `(${oldCredentialChanged}) OR (${credentialIdentityMoved})`)}
    ${advance("NEW.userId", `(${credentialIdentityMoved}) OR ((${newCredentialChanged}) AND OLD.providerId IS NOT 'credential')`)}
  END`,
  noctua_credential_delete: `CREATE TRIGGER noctua_credential_delete AFTER DELETE ON auth_account
    WHEN OLD.providerId='credential' AND EXISTS(SELECT 1 FROM auth_user WHERE id=OLD.userId) BEGIN
    ${advance("OLD.userId")}
  END`,
  noctua_user_ban: `CREATE TRIGGER noctua_user_ban AFTER UPDATE OF banned,banExpires ON auth_user
    WHEN OLD.banned IS NOT NEW.banned OR OLD.banExpires IS NOT NEW.banExpires BEGIN
    ${advance("NEW.id")}
  END`
};

function normalizedSql(sql: string) {
  return sql.replace(/IF NOT EXISTS\s+/gi, "").replace(/\s+/g, " ").trim().replace(/;$/, "");
}

function schemaSql(db: Database, type: string, name: string): string | undefined {
  return db.prepare(`SELECT sql FROM sqlite_master WHERE type=? AND name=?`).get(type, name)?.sql;
}

const installationDdl = `CREATE TABLE IF NOT EXISTS auth_control_plane_installation (
  id INTEGER PRIMARY KEY CHECK(id=1), version INTEGER NOT NULL CHECK(version=1)
)`;
const migrationsDdl = `CREATE TABLE IF NOT EXISTS noctua_auth_migrations (id TEXT PRIMARY KEY)`;
const installationMigration = "auth-control-plane-v1";
const provisioningIndexName = "idx_user_provisioning_active_email";
const provisioningPredicate = "state IN ('reserved','auth_created','cleanup_required')";
const provisioningIndexDdl = `CREATE UNIQUE INDEX ${provisioningIndexName}
  ON user_provisioning(normalizedEmail) WHERE ${provisioningPredicate}`;

function validateProvisioningIndex(db: Database) {
  const valid = () => {
    const index = db.prepare("PRAGMA index_list(user_provisioning)").all()
      .find((row: { name: string }) => row.name === provisioningIndexName);
    if (!index || index.unique !== 1 || index.partial !== 1) return false;
    const columns = db.prepare(`PRAGMA index_xinfo(${provisioningIndexName})`).all()
      .filter((row: { key: number }) => row.key === 1);
    const sql = schemaSql(db, "index", provisioningIndexName) ?? "";
    return columns.length === 1 && columns[0].name === "normalizedEmail" &&
      columns[0].coll === "BINARY" && columns[0].desc === 0 &&
      normalizedSql(sql.slice(sql.search(/\bWHERE\b/i))) === `WHERE ${provisioningPredicate}`;
  };
  if (!valid()) {
    // Inside the install transaction: duplicates abort startup and restore the
    // previous index, without deleting/reconciling any provisioning reservations.
    try {
      db.exec(`DROP INDEX IF EXISTS ${provisioningIndexName}`);
      db.exec(provisioningIndexDdl);
    } catch (cause) {
      throw new Error("Cannot repair auth provisioning uniqueness index at startup", { cause });
    }
  }
  if (!valid()) throw new Error("Malformed auth provisioning uniqueness index at startup");
}

/** Determine installation status before creating anything that could reset counters. */
function isInstalledControlPlane(db: Database) {
  const marker = schemaSql(db, "table", "auth_control_plane_installation");
  const ledger = schemaSql(db, "table", "noctua_auth_migrations");
  if (ledger && normalizedSql(ledger) !== normalizedSql(migrationsDdl)) {
    throw new Error("Malformed auth migration ledger at startup");
  }
  const recorded = ledger && db.prepare("SELECT id FROM noctua_auth_migrations WHERE id=?").get(installationMigration);
  if (marker && normalizedSql(marker) !== normalizedSql(installationDdl)) {
    throw new Error("Malformed auth control-plane installation marker at startup");
  }
  if (marker || recorded) {
    // Independent witnesses: dropping the marker table/row must not look like
    // a pre-marker development DB, and losing the ledger must fail closed too.
    if (!marker || !recorded || !db.prepare("SELECT id FROM auth_control_plane_installation WHERE id=1 AND version=1").get()) {
      throw new Error("Missing auth control-plane installation marker or migration record at startup");
    }
  }
  const expected = [
    ...tables.map(ddl => ["table", ddl.match(/EXISTS (\w+)/)![1]]),
    ...Object.keys(triggers).map(name => ["trigger", name]),
  ];
  const missing = expected.filter(([type, name]) => schemaSql(db, type, name) === undefined);
  const hasSidecars = missing.length !== expected.length || schemaSql(db, "index", provisioningIndexName) !== undefined;
  if ((marker || recorded || hasSidecars) && missing.length) {
    throw new Error(`Missing installed auth control-plane objects at startup: ${missing.map(([, name]) => name).join(", ")}`);
  }
  // 087279b/ad6db7a predate the marker. Adopt only a complete legacy plane;
  // table shapes, counters and index are validated below before both witnesses
  // are written in this same transaction. No existing counter is backfilled.
  if (!marker && hasSidecars && schemaSql(db, "index", provisioningIndexName) === undefined) {
    throw new Error(`Missing installed auth control-plane objects at startup: ${provisioningIndexName}`);
  }
  return Boolean(marker || recorded || hasSidecars);
}

/**
 * Startup only, after pinned library migrations and before betterAuth(). No
 * awaits/network/raw after-hook mirror writes. DDL, backfill and trigger upgrades
 * commit together. Runtime Noctua writes use their separate retrying connection.
 */
export function installAuthControlPlane(db: Database) {
  db.transaction(() => {
    const installed = isInstalledControlPlane(db);
    // Prepare against actual library models before installing any policy DDL.
    db.prepare(`SELECT id,email,role,createdAt,banned,banExpires FROM auth_user LIMIT 0`).all();
    db.prepare(`SELECT id,userId,accountId,providerId,password FROM auth_account LIMIT 0`).all();
    db.prepare(`SELECT id,userId FROM auth_session LIMIT 0`).all();
    for (const ddl of tables) {
      db.exec(ddl);
      const name = ddl.match(/EXISTS (\w+)/)![1];
      if (normalizedSql(schemaSql(db, "table", name) ?? "") !== normalizedSql(ddl)) {
        throw new Error(`Malformed auth control-plane table: ${name}`);
      }
    }
    // Initial adoption may backfill existing auth users. Once installed, missing
    // generations must never be reset to zero and revive an old bearer.
    if (installed && db.prepare(`SELECT id FROM auth_user WHERE NOT EXISTS
      (SELECT 1 FROM auth_security_state s WHERE s.userId=auth_user.id) LIMIT 1`).get()) {
      throw new Error("Missing auth security state at startup");
    }
    if (installed && !db.prepare(`SELECT id FROM auth_login_epoch WHERE id=1`).get()) {
      throw new Error("Missing auth login epoch at startup");
    }
    db.exec(`INSERT OR IGNORE INTO auth_login_epoch(id,generation) VALUES(1,0)`);
    ensureTableColumns(db, "mcp_tokens", [["securityGeneration", "INTEGER"]]);
    ensureTableColumns(db, "invite_codes", [["email", "TEXT"]]);
    validateProvisioningIndex(db);

    // Never choose a legacy ID by email. An explicit operator ID binding is the
    // only allowed import; even that must not bind two different identities.
    const ambiguous = db.prepare(`SELECT a.id FROM auth_user a WHERE
      EXISTS(SELECT 1 FROM users u WHERE lower(trim(u.email))=lower(trim(a.email)) AND u.id<>a.id)
      OR EXISTS(SELECT 1 FROM users u WHERE u.id=a.id AND lower(trim(u.email))<>lower(trim(a.email)))
      OR EXISTS(SELECT 1 FROM auth_user b WHERE b.id<>a.id AND lower(trim(b.email))=lower(trim(a.email)))
      OR julianday(a.createdAt) IS NULL LIMIT 1`).get();
    if (ambiguous) throw new Error(`Ambiguous auth profile backfill: ${ambiguous.id}`);
    db.exec(`INSERT INTO users(id,email,role,createdAt)
      SELECT id,lower(trim(email)),CASE WHEN role='admin' THEN 'admin' ELSE 'user' END,
        CAST(round((julianday(createdAt)-2440587.5)*86400000) AS INTEGER)
      FROM auth_user WHERE 1
      ON CONFLICT(id) DO UPDATE SET email=excluded.email,role=excluded.role`);
    db.exec(`INSERT OR IGNORE INTO auth_security_state(userId,generation) SELECT id,0 FROM auth_user`);
    for (const [name, ddl] of Object.entries(triggers)) {
      if (normalizedSql(schemaSql(db, "trigger", name) ?? "") !== normalizedSql(ddl)) {
        db.exec(`DROP TRIGGER IF EXISTS ${name}`);
        db.exec(ddl);
      }
      if (normalizedSql(schemaSql(db, "trigger", name) ?? "") !== normalizedSql(ddl)) {
        throw new Error(`Missing or malformed auth trigger: ${name}`);
      }
    }
    db.exec(migrationsDdl);
    // Upgrade the old global receipt without reapplying legacy fields to
    // identities already imported by that version. Unmapped profiles stay pending.
    if (db.prepare("SELECT 1 FROM noctua_auth_migrations WHERE id='legacy-profile-v1'").get()) {
      db.exec(`INSERT OR IGNORE INTO noctua_auth_migrations(id)
        SELECT 'legacy-profile-v1:' || a.id FROM auth_user a JOIN users p ON p.id=a.id`);
      db.exec("DELETE FROM noctua_auth_migrations WHERE id='legacy-profile-v1'");
    }
    const profiles = db.prepare(`SELECT a.id FROM auth_user a JOIN users p ON p.id=a.id`).all() as { id: string }[];
    for (const profile of profiles) importLegacyProfileFields(db, profile.id);
    db.exec(installationDdl);
    db.exec(migrationsDdl);
    db.exec("INSERT OR IGNORE INTO auth_control_plane_installation(id,version) VALUES(1,1)");
    db.prepare("INSERT OR IGNORE INTO noctua_auth_migrations(id) VALUES(?)").run(installationMigration);
  }).immediate();
}

/**
 * Transfer an explicitly bound legacy profile once. Slice 6 must call this on
 * the library connection INSIDE the adapter transaction that creates auth_user
 * with the reserved legacy ID. The nested transaction keeps fields + receipt
 * atomic; the enclosing adapter transaction also rolls back the identity bind.
 * No email lookup may choose the profile ID.
 */
export function importLegacyProfileFields(db: Database, userId: string): boolean {
  return db.transaction(() => {
    const columns = new Set((db.prepare("PRAGMA table_info(users)").all() as { name: string }[]).map(row => row.name));
    if (!columns.has("name") && !columns.has("disabledAt")) return false;
    const receipt = `legacy-profile-v1:${userId}`;
    if (db.prepare("SELECT 1 FROM noctua_auth_migrations WHERE id=?").get(receipt)) return false;
    const bound = db.prepare(`SELECT a.id FROM auth_user a JOIN users p ON p.id=a.id
      WHERE a.id=? AND lower(trim(a.email))=lower(trim(p.email))`).get(userId);
    if (!bound) throw new Error("Legacy profile transfer requires an explicit matching identity binding");
    if (columns.has("name")) db.prepare(`UPDATE auth_user SET name=(SELECT name FROM users WHERE id=?)
      WHERE id=? AND EXISTS(SELECT 1 FROM users WHERE id=? AND length(trim(name))>0)`).run(userId, userId, userId);
    if (columns.has("disabledAt")) db.prepare(`UPDATE auth_user SET banned=1,banExpires=NULL
      WHERE id=? AND EXISTS(SELECT 1 FROM users WHERE id=? AND disabledAt IS NOT NULL)`).run(userId, userId);
    db.prepare("INSERT INTO noctua_auth_migrations(id) VALUES(?)").run(receipt);
    return true;
  }).immediate();
}

/** Noctua proof cleanup runs on its own master handle after library signOut. */
export async function deleteSessionProofState(sessionId:string, userId?:string, database?:Database) {
  return withDbWriteRetry("deleteSessionProofState", async()=>{
    const db=database ?? await getDb();
    db.transaction(()=>{
      if (userId) invalidateUserChallenges(db,userId,true);
      db.prepare(`DELETE FROM auth_verification WHERE identifier IN
        (SELECT identifier FROM auth_pending_challenges WHERE sourceSessionId=?)`).run(sessionId);
      db.prepare("DELETE FROM auth_pending_challenges WHERE sourceSessionId=?").run(sessionId);
      db.prepare("DELETE FROM auth_reauth_grants WHERE sessionId=?").run(sessionId);
      db.prepare("DELETE FROM auth_session_security WHERE sessionId=?").run(sessionId);
    }).immediate();
  });
}

export type SessionSecurity = {
  sessionId: string; userId: string; generation: number; assurance: "setup" | "mfa";
  authenticatedAt: number; method: string;
};
export type SecurityOperation = { id: string; userId: string; generation: number; action: string };

export class AuthPolicyError extends Error {
  constructor(public code: string, public status = 403) { super(code); }
}

export function readGeneration(db: Database, userId: string): number {
  const row = db.prepare(`SELECT s.generation FROM auth_security_state s
    JOIN auth_user u ON u.id=s.userId JOIN users p ON p.id=u.id
    WHERE u.id=? AND (u.banned IS NULL OR u.banned=0 OR julianday(u.banExpires)<julianday('now'))
    AND NOT EXISTS(SELECT 1 FROM user_provisioning WHERE userId=u.id AND state NOT IN ('complete','cancelled'))`).get(userId);
  if (!row || !Number.isSafeInteger(row.generation)) throw new AuthPolicyError("Unauthorized", 401);
  return row.generation;
}

export function enrollmentState(db: Database, userId: string) {
  const row = db.prepare(`SELECT u.twoFactorEnabled,
    (SELECT COUNT(*) FROM auth_two_factor f WHERE f.userId=u.id) AS factors,
    (SELECT COUNT(*) FROM auth_two_factor f WHERE f.userId=u.id AND f.verified=1 AND length(trim(f.secret))>0) AS verified
    FROM auth_user u WHERE u.id=?`).get(userId);
  return { complete: row?.twoFactorEnabled === 1 && row.factors === 1 && row.verified === 1,
    inconsistent: !!row && ((row.twoFactorEnabled === 1) !== (row.verified === 1) || row.factors > 1) };
}

export function readSessionSecurity(db: Database, sessionId: string): SessionSecurity {
  const row = db.prepare(`SELECT p.* FROM auth_session_security p JOIN auth_session s ON s.id=p.sessionId
    WHERE p.sessionId=? AND p.userId=s.userId AND julianday(s.expiresAt)>julianday('now')`).get(sessionId) as SessionSecurity | null;
  if (!row || !Number.isSafeInteger(row.authenticatedAt) || !["setup","mfa"].includes(row.assurance) || row.generation !== readGeneration(db, row.userId) || row.authenticatedAt > Date.now() ||
    row.authenticatedAt + 86400000 <= Date.now()) throw new AuthPolicyError("Unauthorized", 401);
  return row;
}

export async function reserveSecurityOperation(db: Database, userId: string, action: string): Promise<SecurityOperation> {
  return withDbWriteRetry("reserveSecurityOperation", () => db.transaction(() => {
    const generation = readGeneration(db, userId);
    if (db.prepare("SELECT 1 FROM admin_lifecycle_operations WHERE slot=?").get(`security:${userId}`)) {
      throw new AuthPolicyError("security_operation_pending", 409);
    }
    const id = crypto.randomUUID();
    db.prepare(`INSERT INTO admin_lifecycle_operations(id,slot,actorUserId,targetUserId,action,state,createdAt,updatedAt)
      VALUES(?,?,?,?,?,'reserved',?,?)`).run(id, `security:${userId}`, userId, userId, action, Date.now(), Date.now());
    return { id, userId, generation, action };
  }).immediate());
}

export function assertSecurityOperation(db: Database, op: SecurityOperation) {
  const row = db.prepare(`SELECT id FROM admin_lifecycle_operations WHERE id=? AND slot=?`).get(op.id, `security:${op.userId}`);
  if (!row || readGeneration(db, op.userId) !== op.generation) throw new AuthPolicyError("security_state_changed", 409);
}

export async function finishSecurityOperation(db: Database, op: SecurityOperation) {
  await withDbWriteRetry("finishSecurityOperation", () => db.prepare(`UPDATE admin_lifecycle_operations SET slot=NULL,state='complete',updatedAt=? WHERE id=?`).run(Date.now(), op.id));
}

/** Invalidate library and Noctua challenges together. Epoch also cancels anonymous WebAuthn. */
export function invalidateUserChallenges(db: Database, userId: string, loginsOnly = false) {
  const scope = loginsOnly ? " AND kind IN ('two_factor','two_factor_imap','passkey_login')" : "";
  db.prepare(`DELETE FROM auth_verification WHERE identifier IN
    (SELECT identifier FROM auth_pending_challenges WHERE userId=?${scope}) OR identifier IN
    (SELECT '2fa-attempts-' || identifier FROM auth_pending_challenges WHERE userId=?${scope})`).run(userId,userId);
  db.prepare(`DELETE FROM auth_pending_challenges WHERE userId=?${scope}`).run(userId);
  const result = db.prepare(`UPDATE auth_login_epoch SET generation=generation+1 WHERE id=1`).run();
  if (!result.changes) throw new Error("Missing auth login epoch");
}

/** Caller holds the slot and an immediate transaction. Retention never implies assurance. */
export function advanceSecurityGeneration(db: Database, userId: string, keepSessionId?: string) {
  const result = db.prepare(`UPDATE auth_security_state SET generation=generation+1 WHERE userId=? RETURNING generation`).get(userId);
  if (!result) throw new Error("Missing auth security state");
  invalidateUserChallenges(db, userId);
  db.prepare(`DELETE FROM auth_reauth_grants WHERE userId=?`).run(userId);
  db.prepare(`DELETE FROM mcp_tokens WHERE createdByUserId=?`).run(userId);
  db.prepare(`DELETE FROM auth_session WHERE userId=? AND id IS NOT ?`).run(userId, keepSessionId ?? null);
  return result.generation as number;
}

/** Only the live returned session can be finalized, after all library writes commit. */
export async function finalizeAuthentication(db: Database, op: SecurityOperation, security: SessionSecurity, initialEnrollment = false, challenge?: {identifier:string;kind:string;generation:number|null;loginEpoch:number|null;userId:string|null}) {
  return withDbWriteRetry("finalizeAuthentication", () => db.transaction(() => {
    assertSecurityOperation(db, op);
    if (challenge) {
      if (!db.prepare(`SELECT 1 FROM auth_pending_challenges WHERE identifier=? AND kind=? AND userId IS ?
        AND generation IS ? AND loginEpoch IS ? AND expiresAt>?`).get(challenge.identifier,challenge.kind,challenge.userId,challenge.generation,challenge.loginEpoch,Date.now())) throw new AuthPolicyError("invalid_challenge");
      if (challenge.loginEpoch !== null && db.prepare(`SELECT generation FROM auth_login_epoch WHERE id=1`).get()?.generation !== challenge.loginEpoch) throw new AuthPolicyError("invalid_challenge");
    }
    const live = db.prepare(`SELECT userId FROM auth_session WHERE id=? AND julianday(expiresAt)>julianday('now')`).get(security.sessionId);
    if (live?.userId !== op.userId || security.userId !== op.userId || !Number.isSafeInteger(security.authenticatedAt) || security.authenticatedAt > Date.now() || security.authenticatedAt + 86400000 <= Date.now()) {
      throw new AuthPolicyError("Unauthorized", 401);
    }
    if (security.assurance === "mfa" && !enrollmentState(db, op.userId).complete) throw new AuthPolicyError("mfa_state_inconsistent");
    const generation = initialEnrollment ? advanceSecurityGeneration(db, op.userId, security.sessionId) : op.generation;
    db.prepare(`INSERT INTO auth_session_security(sessionId,userId,generation,assurance,authenticatedAt,method)
      VALUES(?,?,?,?,?,?) ON CONFLICT(sessionId) DO UPDATE SET generation=excluded.generation,
      assurance=excluded.assurance,authenticatedAt=excluded.authenticatedAt,method=excluded.method`)
      .run(security.sessionId, op.userId, generation, security.assurance, security.authenticatedAt, security.method);
    if (challenge) db.prepare(`DELETE FROM auth_pending_challenges WHERE identifier=?`).run(challenge.identifier);
    return generation;
  }).immediate());
}

/** Startup reconciliation is deliberately conservative: partial proof is never resumed. */
export async function reconcileSecurityOperations(db: Database, before = Date.now()) {
  return withDbWriteRetry("reconcileSecurityOperations", () => db.transaction(() => {
    const operations = db.prepare(`SELECT id,targetUserId FROM admin_lifecycle_operations WHERE slot LIKE 'security:%' AND createdAt<?`).all(before) as {id:string;targetUserId:string}[];
    for (const op of operations) {
      if (db.prepare(`SELECT 1 FROM auth_security_state WHERE userId=?`).get(op.targetUserId)) advanceSecurityGeneration(db, op.targetUserId);
      db.prepare(`UPDATE admin_lifecycle_operations SET slot=NULL,state='cancelled',updatedAt=? WHERE id=?`).run(Date.now(), op.id);
    }
    return operations.map(op => op.targetUserId);
  }).immediate());
}
