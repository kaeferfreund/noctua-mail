import type { Database } from "bun:sqlite";
import type { NoctuaAuth } from "./betterAuth";
import { PASSWORD_MIN, PASSWORD_MAX } from "./betterAuth";
import { AuthPolicyError, assertPurpose, consumeReauthGrant, issueReauthGrant, type ReauthPurpose } from "./authPolicy";
import { advanceSecurityGeneration, assertSecurityOperation, enrollmentState, finalizeAuthentication, finishSecurityOperation,
  readGeneration, readSessionSecurity, deleteSessionProofState, reserveSecurityOperation, discardPartialTotp,
  invalidateUserChallenges, deleteSessionProofStateRow, type SessionSecurity } from "./db/authPolicy";
import { withAuthProof, type AuthProofContext } from "./authPolicyContext";
import { withDbWriteRetry } from "./dbWriteRetry";
import { verifyEligibleImap } from "./imapLoginPolicy";
import { revokeAuthStreams } from "./authStreams";
import { createRateLimiter, getRequestIp, type RateLimiter } from "./rateLimit";

const proofAttempts = createRateLimiter({windowMs:60000,max:5});
export type ReauthInput = {purpose:ReauthPurpose;currentPassword?:string;totpCode?:string;backupCode?:string;proofMode?:"passkey"};
function badProof(): never { throw new AuthPolicyError("invalid_proof"); }
export function hasAppPassword(db: Database, userId: string) {
  return !!db.prepare(`SELECT password FROM auth_account WHERE userId=? AND providerId='credential' AND password IS NOT NULL`).get(userId)?.password;
}

export function strictFields(body: unknown, allowed: readonly string[]): asserts body is Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some(key => !allowed.includes(key))) throw new AuthPolicyError("invalid_request",400);
}
function validPassword(value: unknown): value is string { return typeof value === "string" && value.length >= 1 && value.length <= PASSWORD_MAX; }

/** Always run under the durable user slot; no credentials enter persisted operation metadata. */
async function verifyCurrentCredential(auth: NoctuaAuth, db: Database, source: SessionSecurity, request: Request, password: unknown) {
  if (!validPassword(password)) badProof();
  const credential = db.prepare(`SELECT password FROM auth_account WHERE userId=? AND providerId='credential' AND password IS NOT NULL`).get(source.userId);
  if (credential?.password) {
    if (!await (await auth.$context).password.verify({password,hash:credential.password})) badProof();
  } else await verifyEligibleImap(db, source.userId, password, request);
}

export async function reauthenticate(auth: NoctuaAuth, db: Database, source: SessionSecurity, request: Request, body: unknown, limiter: RateLimiter = proofAttempts) {
  strictFields(body,["purpose","currentPassword","totpCode","backupCode","proofMode"]);
  assertPurpose(body.purpose);
  const purpose = body.purpose;
  if (body.proofMode !== undefined && body.proofMode !== "passkey") throw new AuthPolicyError("invalid_request",400);
  for (const field of ["currentPassword","totpCode","backupCode"]) if (body[field] !== undefined && (!validPassword(body[field]))) throw new AuthPolicyError("invalid_request",400);
  if (body.totpCode && body.backupCode) throw new AuthPolicyError("invalid_request",400);
  if (limiter.isLimited(`user:${source.userId}`) || limiter.isLimited(`ip:${getRequestIp(request)}`)) throw new AuthPolicyError("proof_rate_limited",429);
  let recovery: {id:string;state:string;action:string} | undefined;
  const op = await reserveSecurityOperation(db, source.userId, "security.reauth").catch(async error => {
    if (!(error instanceof AuthPolicyError) || error.code !== "security_operation_pending" || purpose !== "totp.enroll") throw error;
    return withDbWriteRetry("claimAbandonedSetup", () => db.transaction(() => {
      const live=readSessionSecurity(db,source.sessionId);
      const intent=db.prepare(`SELECT id,state,action FROM admin_lifecycle_operations WHERE slot=?
        AND state IN ('totp_seed_issued','replacement_setup')`).get(`security:${source.userId}`) as typeof recovery;
      if (!intent || live.assurance !== "setup" || live.generation !== source.generation ||
        db.prepare(`SELECT twoFactorEnabled FROM auth_user WHERE id=?`).get(source.userId)?.twoFactorEnabled !== 0 ||
        db.prepare(`SELECT 1 FROM auth_two_factor WHERE userId=? AND verified=1`).get(source.userId)) throw error;
      db.prepare(`UPDATE admin_lifecycle_operations SET state='setup_reauth',updatedAt=? WHERE id=?`).run(Date.now(),intent.id);
      recovery=intent;
      return {id:intent.id,userId:source.userId,generation:source.generation,action:intent.action};
    }).immediate());
  });
  let recovered = false;
  const proof: AuthProofContext = { db, internal:true, op, source, authenticatedAt:source.authenticatedAt,method:source.method,createdSessionIds:[] };
  return withAuthProof(proof, async () => {
    try {
      readSessionSecurity(db, source.sessionId);
      const enrolled = enrollmentState(db, source.userId).complete;
      const hasPassword = hasAppPassword(db, source.userId);
      const setup = source.assurance === "setup" && !enrolled;
      if (purpose === "totp.enroll" && !setup) throw new AuthPolicyError("setup_required");
      if (purpose === "password.set" && hasPassword) throw new AuthPolicyError("password_already_set");
      if (purpose === "password.set" && setup && (!db.prepare(`SELECT 1 FROM user_provisioning WHERE userId=? AND kind IN ('signup','migration') AND state='complete'`).get(source.userId) ||
        db.prepare(`SELECT 1 FROM user_provisioning WHERE userId=? AND kind='recovery'`).get(source.userId) ||
        db.prepare(`SELECT 1 FROM noctua_auth_migrations WHERE id=?`).get(`mfa-enrolled:${source.userId}`))) throw new AuthPolicyError("onboarding_proof_required");
      if (purpose === "password.change" && !hasPassword) throw new AuthPolicyError("password_not_set");
      if (!setup && (source.assurance !== "mfa" || !enrolled)) throw new AuthPolicyError("mfa_required");
      if (setup && !["totp.enroll","password.set"].includes(purpose)) throw new AuthPolicyError("mfa_required");
      if (purpose === "admin.recovery") {
        if (!hasPassword || db.prepare(`SELECT role FROM auth_user WHERE id=?`).get(source.userId)?.role !== "admin") throw new AuthPolicyError("admin_required");
      }
      const uvOnly = body.proofMode === "passkey" && ["passkey.enroll","passkey.remove","passkey.rename"].includes(purpose);
      if (!uvOnly) await verifyCurrentCredential(auth, db, source, request, body.currentPassword);
      assertSecurityOperation(db, op);
      if (recovery) {
        await withDbWriteRetry("restartAbandonedSetup", () => db.transaction(() => {
          assertSecurityOperation(db,op);
          readSessionSecurity(db,source.sessionId);
          discardPartialTotp(db,source.userId);
          invalidateUserChallenges(db,source.userId);
          db.prepare(`DELETE FROM auth_reauth_grants WHERE userId=?`).run(source.userId);
          db.prepare(`UPDATE admin_lifecycle_operations SET state='reserved',updatedAt=? WHERE id=?`).run(Date.now(),op.id);
        }).immediate());
        recovered=true;
      }
      if (body.proofMode === "passkey") {
        if (setup || body.backupCode || body.totpCode) throw new AuthPolicyError("invalid_request",400);
        const result = await issueReauthGrant(db, op, source.sessionId, purpose, {state:"uv_pending"});
        return {ok:true,ceremonyRequired:true,...result};
      }
      if (!setup) {
        if (body.backupCode) {
          if (purpose !== "totp.replace") throw new AuthPolicyError("backup_proof_not_allowed");
          // Installed library encrypts and CAS-updates backupCodes; never compare/decrypt them here.
          await auth.api.verifyBackupCode({headers:request.headers,body:{code:body.backupCode as string,disableSession:true}});
        } else if (body.totpCode) await auth.api.verifyTOTP({headers:request.headers,body:{code:body.totpCode as string,trustDevice:false}});
        else throw new AuthPolicyError("factor_proof_required");
      } else if (body.backupCode || body.totpCode) throw new AuthPolicyError("invalid_request",400);
      assertSecurityOperation(db, op);
      readSessionSecurity(db, source.sessionId);
      return {ok:true,ceremonyRequired:false,...await issueReauthGrant(db, op, source.sessionId, purpose)};
    } finally {
      // Proof attempts do not mutate credentials. A consumed backup code stays consumed after a fault.
      const restoreState=recovery?.state;
      if (restoreState && !recovered) await withDbWriteRetry("restoreAbandonedSetup", () => db.prepare(`UPDATE admin_lifecycle_operations SET state=?,updatedAt=? WHERE id=? AND state='setup_reauth'`).run(restoreState,Date.now(),op.id));
      else await finishSecurityOperation(db, op);
    }
  });
}

export type SecurityAction = "password" | "backup-codes" | "totp-replace" | "passkey-remove" | "passkey-rename" | "sessions-revoke";
export async function mutateSecurity(auth: NoctuaAuth, db: Database, source: SessionSecurity, request: Request, body: unknown, action: SecurityAction): Promise<{body:Record<string,unknown>;headers:Headers}> {
  if (action === "passkey-rename" || action === "sessions-revoke") return manageSecurity(auth,db,source,request,body,action);
  strictFields(body, action === "password" ? ["currentPassword","newPassword"] : action === "passkey-remove" ? ["passkeyId"] : ["currentPassword"]);
  const purpose: ReauthPurpose = action === "password" ? (hasAppPassword(db,source.userId)?"password.change":"password.set") : action === "backup-codes" ? "backup.regenerate" : action === "passkey-remove" ? "passkey.remove" : "totp.replace";
  if (action === "password" && (typeof body.newPassword !== "string" || body.newPassword.length < PASSWORD_MIN || body.newPassword.length > PASSWORD_MAX)) throw new AuthPolicyError("invalid_password_length",400);
  if (action === "passkey-remove" && (typeof body.passkeyId !== "string" || !db.prepare(`SELECT 1 FROM auth_passkey WHERE id=? AND userId=?`).get(body.passkeyId,source.userId))) throw new AuthPolicyError("passkey_not_found",404);
  const op = await reserveSecurityOperation(db, source.userId, `security.${purpose}`);
  const proof: AuthProofContext = {db,internal:true,op,source,authenticatedAt:source.authenticatedAt,method:source.method,createdSessionIds:[]};
  let spent = false;
  let mutationStarted = false;
  return withAuthProof(proof, async () => {
    try {
      const consumed = await consumeReauthGrant(db,request.headers.get("x-noctua-reauth"),source,purpose,op);
      spent = true;
      if (action === "passkey-remove" && consumed.challengeId) {
        const key = db.prepare(`SELECT credentialID FROM auth_passkey WHERE id=? AND userId=?`).get(body.passkeyId as string,source.userId);
        if (consumed.challengeId === `passkey:${key?.credentialID}`) throw new AuthPolicyError("another_passkey_required");
      }
      if (purpose !== "password.set" && action !== "passkey-remove" && hasAppPassword(db,source.userId)) {
        await verifyCurrentCredential(auth,db,source,request,body.currentPassword);
      }
      const headers = new Headers();
      mutationStarted = true;
      if (action === "password") {
        const result = purpose === "password.change" ? await auth.api.changePassword({headers:request.headers,
          body:{currentPassword:validPassword(body.currentPassword)?body.currentPassword:"",newPassword:body.newPassword as string,revokeOtherSessions:true},returnHeaders:true}) :
          await auth.api.setPassword({headers:request.headers,body:{newPassword:body.newPassword as string},returnHeaders:true});
        for (const cookie of result.headers.getSetCookie()) headers.append("set-cookie",cookie);
        op.generation = readGeneration(db,source.userId); // Trigger committed alongside password/token consumption.
      } else {
        await withDbWriteRetry("beginFactorMutation", () => db.transaction(() => {
          assertSecurityOperation(db,op);
          op.generation = advanceSecurityGeneration(db,source.userId,source.sessionId);
        }).immediate());
        revokeAuthStreams({userId:source.userId});
      }
      let response: Record<string,unknown> = {ok:true};
      if (action === "backup-codes") {
        const result = await auth.api.generateBackupCodes({headers:request.headers,body:{password:validPassword(body.currentPassword)?body.currentPassword:undefined}});
        response.backupCodes = result.backupCodes;
      }
      if (action === "passkey-remove") {
        // Mandatory TOTP (and admin password) remain required by the live guard, independent of passkeys.
        await auth.api.deletePasskey({headers:request.headers,body:{id:body.passkeyId as string}});
      }
      if (action === "totp-replace") {
        const result = await auth.api.disableTwoFactor({headers:request.headers,body:{password:validPassword(body.currentPassword)?body.currentPassword:undefined},returnHeaders:true});
        for (const cookie of result.headers.getSetCookie()) headers.append("set-cookie",cookie);
        if (!proof.newSessionId) throw new AuthPolicyError("missing_result_session",503);
      }
      const sessionId = proof.newSessionId ?? source.sessionId;
      await withDbWriteRetry("revokeAfterSecurityMutation", () => db.transaction(() => {
        assertSecurityOperation(db,op);
        db.prepare(`DELETE FROM auth_session WHERE userId=? AND id<>?`).run(source.userId,sessionId);
        db.prepare(`DELETE FROM mcp_tokens WHERE createdByUserId=?`).run(source.userId);
        db.prepare(`DELETE FROM auth_reauth_grants WHERE userId=?`).run(source.userId);
        db.prepare(`DELETE FROM auth_pending_challenges WHERE userId=?`).run(source.userId);
      }).immediate());
      await finalizeAuthentication(db,op,{...source,sessionId,generation:op.generation,assurance:action === "totp-replace"?"setup":source.assurance});
      revokeAuthStreams({userId:source.userId});
      if (action === "totp-replace") {
        const continuation = await issueReauthGrant(db,op,sessionId,"totp.enroll",{challengeId:op.id});
        await withDbWriteRetry("continueTotpReplacement", () => db.prepare(`UPDATE admin_lifecycle_operations SET state='replacement_setup',updatedAt=? WHERE id=?`).run(Date.now(),op.id));
        response = {...response,...continuation,enrollmentRequired:true};
      } else await finishSecurityOperation(db,op);
      return {body:response,headers};
    } catch (error) {
      if (!spent || !mutationStarted) await finishSecurityOperation(db,op);
      // A spent grant and durable intent never become reusable after partial library writes.
      // Delete any rotated sessions; the generation/slot also blocks old bearers.
      if (spent && mutationStarted) {
        await withDbWriteRetry("quarantineFailedSecurityMutation", () => db.transaction(() => {
          for (const id of proof.createdSessionIds) db.prepare(`DELETE FROM auth_session WHERE id=?`).run(id);
          db.prepare(`DELETE FROM auth_session_security WHERE sessionId=?`).run(source.sessionId);
        }).immediate());
        revokeAuthStreams({userId:source.userId});
      }
      throw error;
    }
  });
}

/** These reviewed mutations commit entirely on the Noctua handle. No raw token enters the DTO. */
async function manageSecurity(auth: NoctuaAuth, db: Database, source: SessionSecurity, request: Request, body: unknown, action: "passkey-rename" | "sessions-revoke") {
  strictFields(body,action === "passkey-rename" ? ["passkeyId","name"] : ["sessionId","all"]);
  if (action === "passkey-rename") {
    if (typeof body.passkeyId !== "string" || typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 100 || /[\x00-\x1f\x7f]/.test(body.name)) throw new AuthPolicyError("invalid_request",400);
  } else if (!((body.all === true && body.sessionId === undefined) ||
    (body.all === undefined && typeof body.sessionId === "string" && body.sessionId.length > 0 && body.sessionId.length <= 128))) throw new AuthPolicyError("invalid_request",400);
  const purpose=action === "passkey-rename" ? "passkey.rename" : "sessions.revoke";
  const op=await reserveSecurityOperation(db,source.userId,`security.${purpose}`);
  try {
    await consumeReauthGrant(db,request.headers.get("x-noctua-reauth"),source,purpose,op);
    const revoked=await withDbWriteRetry("manageSecurity", () => db.transaction(() => {
      assertSecurityOperation(db,op);
      readSessionSecurity(db,source.sessionId);
      if (action === "passkey-rename") {
        if (db.prepare(`UPDATE auth_passkey SET name=? WHERE id=? AND userId=?`).run((body.name as string).trim(),body.passkeyId as string,source.userId).changes !== 1) throw new AuthPolicyError("passkey_not_found",404);
        return [] as string[];
      }
      const sessions=db.prepare(`SELECT id FROM auth_session WHERE userId=? AND ${body.all === true ? "id<>?" : "id=?"}`)
        .all(source.userId,body.all === true ? source.sessionId : body.sessionId as string) as {id:string}[];
      if (body.all !== true && !sessions.length) throw new AuthPolicyError("session_not_found",404);
      if (body.all === true) {
        const generation=advanceSecurityGeneration(db,source.userId,source.sessionId);
        db.prepare(`UPDATE auth_session_security SET generation=? WHERE sessionId=? AND userId=?`).run(generation,source.sessionId,source.userId);
      }
      invalidateUserChallenges(db,source.userId,true);
      for (const session of sessions) {
        deleteSessionProofStateRow(db,session.id);
        db.prepare(`DELETE FROM auth_session WHERE id=? AND userId=?`).run(session.id,source.userId);
      }
      return sessions.map(session=>session.id);
    }).immediate());
    for (const sessionId of revoked) revokeAuthStreams({sessionId});
    const headers=new Headers();
    if (revoked.includes(source.sessionId)) {
      const signedOut=await auth.api.signOut({headers:request.headers,returnHeaders:true});
      for (const cookie of signedOut.headers.getSetCookie()) headers.append("set-cookie",cookie);
    }
    return {body:{ok:true},headers};
  } finally { await finishSecurityOperation(db,op); }
}


/** Bodyless Noctua logout uses the same durable revocation boundary as raw sign-out. */
export async function signOutWithPolicy(auth: NoctuaAuth, db: Database, request: Request, source?: {sessionId:string;userId:string}) {
  if (!source) return auth.api.signOut({headers:request.headers,returnHeaders:true});
  const op=await reserveSecurityOperation(db,source.userId,"security.logout");
  try {
    await deleteSessionProofState(source.sessionId,source.userId,db);
    revokeAuthStreams({sessionId:source.sessionId});
    return await auth.api.signOut({headers:request.headers,returnHeaders:true});
  } finally {
    await finishSecurityOperation(db,op);
  }
}
