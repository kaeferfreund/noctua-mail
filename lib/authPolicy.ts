import { createHash, randomBytes } from "node:crypto";
import type { Database } from "bun:sqlite";
import { getDb } from "./db/connection";
import { AuthPolicyError, assertSecurityOperation, enrollmentState, readSessionSecurity, type SecurityOperation, type SessionSecurity } from "./db/authPolicy";
import { withDbWriteRetry } from "./dbWriteRetry";

export { AuthPolicyError } from "./db/authPolicy";
export const REAUTH_PURPOSES = ["totp.enroll", "totp.replace", "passkey.enroll", "password.set", "password.change", "backup.regenerate", "passkey.remove", "passkey.rename", "sessions.revoke", "admin.recovery", "mcp.create"] as const;
export type ReauthPurpose = typeof REAUTH_PURPOSES[number];
export const PROOF_MATRIX = {
  "totp.enroll": "password_setup", "totp.replace": "password_factor_or_backup",
  "passkey.enroll": "password_factor_or_uv", "password.set": "imap_factor_or_onboarding",
  "password.change": "password_factor", "backup.regenerate": "password_factor",
  "passkey.remove": "password_factor_or_uv", "passkey.rename": "password_factor_or_uv",
  "sessions.revoke": "password_factor", "admin.recovery": "admin_password_factor",
  "mcp.create": "password_factor"
} as const;
export const GRANT_TTL_MS = 300000;
export const hashProof = (token: string) => createHash("sha256").update(token).digest("hex");

/** Flag and the verified record must agree. */
export async function isMfaEnrollmentComplete(userId: string) { return enrollmentState(await getDb(), userId); }

export function assertPurpose(value: unknown): asserts value is ReauthPurpose {
  if (typeof value !== "string" || !(REAUTH_PURPOSES as readonly string[]).includes(value)) throw new AuthPolicyError("invalid_purpose", 400);
}

export function assertProofSession(db: Database, sessionId: string, allowSetup = false) {
  const source = readSessionSecurity(db, sessionId);
  if (!allowSetup && (source.assurance !== "mfa" || !enrollmentState(db, source.userId).complete)) throw new AuthPolicyError("mfa_required");
  return source;
}

export async function issueReauthGrant(db: Database, op: SecurityOperation, sessionId: string, purpose: ReauthPurpose,
  binding?: { challengeId?: string; state?: string }) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = Date.now() + GRANT_TTL_MS;
  await withDbWriteRetry("issueReauthGrant", () => db.transaction(() => {
    assertSecurityOperation(db, op);
    const source = readSessionSecurity(db, sessionId);
    if (source.userId !== op.userId) throw new AuthPolicyError("invalid_proof");
    db.prepare(`INSERT INTO auth_reauth_grants(tokenHash,userId,sessionId,purpose,generation,challengeId,state,expiresAt)
      VALUES(?,?,?,?,?,?,?,?)`).run(hashProof(token), op.userId, sessionId, purpose, op.generation, binding?.challengeId ?? null, binding?.state ?? "issued", expiresAt);
  }).immediate());
  return { grant: token, purpose, expiresAt };
}

export function readReauthGrant(db: Database, token: string | null, source: SessionSecurity, purpose: ReauthPurpose, state = "issued") {
  if (!token || token.length > 128) throw new AuthPolicyError("reauth_required");
  const grant = db.prepare(`SELECT * FROM auth_reauth_grants WHERE tokenHash=? AND userId=? AND sessionId=?
    AND purpose=? AND generation=? AND state=? AND expiresAt>?`).get(hashProof(token), source.userId, source.sessionId, purpose, source.generation, state, Date.now());
  if (!grant) throw new AuthPolicyError("invalid_proof");
  return grant as {tokenHash:string;challengeId:string|null;expiresAt:number};
}

/** Caller holds an immediate transaction: the grant is spent once, for this live session and generation. */
function spendReauthGrant(db: Database, token: string | null, source: SessionSecurity, purpose: ReauthPurpose) {
  readSessionSecurity(db, source.sessionId);
  const grant = readReauthGrant(db, token, source, purpose);
  if (db.prepare(`DELETE FROM auth_reauth_grants WHERE tokenHash=? AND state='issued'`).run(grant.tokenHash).changes !== 1) throw new AuthPolicyError("invalid_proof");
  return grant;
}

export async function consumeReauthGrant(db: Database, token: string | null, source: SessionSecurity, purpose: ReauthPurpose, op: SecurityOperation) {
  return withDbWriteRetry("consumeReauthGrant", () => db.transaction(() => {
    assertSecurityOperation(db, op);
    return spendReauthGrant(db, token, source, purpose);
  }).immediate());
}

/**
 * For actions that change no credential or security generation (MCP token creation): no security slot,
 * so the user's other requests and streams keep running. A later generation change still revokes the result.
 */
export async function consumeActionGrant(db: Database, token: string | null, source: SessionSecurity, purpose: ReauthPurpose) {
  return withDbWriteRetry("consumeActionGrant", () => db.transaction(() => spendReauthGrant(db, token, source, purpose)).immediate());
}
