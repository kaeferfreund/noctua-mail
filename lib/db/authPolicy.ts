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
    importLegacyProfileFields(db);
    db.exec(installationDdl);
    db.exec(migrationsDdl);
    db.exec("INSERT OR IGNORE INTO auth_control_plane_installation(id,version) VALUES(1,1)");
    db.prepare("INSERT OR IGNORE INTO noctua_auth_migrations(id) VALUES(?)").run(installationMigration);
  }).immediate();
}

/** Historical development columns stay inert after this one-time, explicit-ID import. */
function importLegacyProfileFields(db: Database) {
  const columns = new Set((db.prepare("PRAGMA table_info(users)").all() as {name:string}[]).map(row=>row.name));
  if (!columns.has("name") && !columns.has("disabledAt")) return;
  db.exec(migrationsDdl);
  if (db.prepare("SELECT 1 FROM noctua_auth_migrations WHERE id='legacy-profile-v1'").get()) return;
  if (columns.has("name")) db.exec(`UPDATE auth_user SET name=(SELECT p.name FROM users p WHERE p.id=auth_user.id)
    WHERE EXISTS(SELECT 1 FROM users p WHERE p.id=auth_user.id AND length(trim(p.name))>0)`);
  if (columns.has("disabledAt")) db.exec(`UPDATE auth_user SET banned=1,banExpires=NULL
    WHERE EXISTS(SELECT 1 FROM users p WHERE p.id=auth_user.id AND p.disabledAt IS NOT NULL)`);
  db.exec("INSERT INTO noctua_auth_migrations(id) VALUES('legacy-profile-v1')");
}

/** Noctua proof cleanup runs on its own master handle after library signOut. */
export async function deleteSessionProofState(sessionId:string) {
  return withDbWriteRetry("deleteSessionProofState", async()=>{
    const db=await getDb();
    db.transaction(()=>{
      db.prepare("DELETE FROM auth_pending_challenges WHERE sourceSessionId=?").run(sessionId);
      db.prepare("DELETE FROM auth_reauth_grants WHERE sessionId=?").run(sessionId);
      db.prepare("DELETE FROM auth_session_security WHERE sessionId=?").run(sessionId);
    }).immediate();
  });
}
