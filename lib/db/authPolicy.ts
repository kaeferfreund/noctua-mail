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
    ${advance("OLD.userId", oldCredentialChanged)}
    ${advance("NEW.userId", `(${newCredentialChanged}) AND (OLD.providerId IS NOT 'credential' OR OLD.userId IS NOT NEW.userId)`)}
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

/**
 * Startup only, after pinned library migrations and before betterAuth(). No
 * awaits/network/raw after-hook mirror writes. DDL, backfill and trigger upgrades
 * commit together. Runtime Noctua writes use their separate retrying connection.
 */
export function installAuthControlPlane(db: Database) {
  db.transaction(() => {
    const existingState = schemaSql(db, "table", "auth_security_state") !== undefined;
    const existingEpoch = schemaSql(db, "table", "auth_login_epoch") !== undefined;
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
    if (existingState && db.prepare(`SELECT id FROM auth_user WHERE NOT EXISTS
      (SELECT 1 FROM auth_security_state s WHERE s.userId=auth_user.id) LIMIT 1`).get()) {
      throw new Error("Missing auth security state at startup");
    }
    if (existingEpoch && !db.prepare(`SELECT id FROM auth_login_epoch WHERE id=1`).get()) {
      throw new Error("Missing auth login epoch at startup");
    }
    db.exec(`INSERT OR IGNORE INTO auth_login_epoch(id,generation) VALUES(1,0)`);
    ensureTableColumns(db, "mcp_tokens", [["securityGeneration", "INTEGER"]]);
    ensureTableColumns(db, "invite_codes", [["email", "TEXT"]]);
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_user_provisioning_active_email
      ON user_provisioning(normalizedEmail) WHERE state IN ('reserved','auth_created','cleanup_required')`);

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
  }).immediate();
}
