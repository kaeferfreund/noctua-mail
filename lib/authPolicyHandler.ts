import type { Database } from "bun:sqlite";
import type { BetterAuthOptions, BetterAuthPlugin } from "better-auth";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { currentAuthProof, withAuthProof, type AuthProofContext, type PendingChallenge } from "./authPolicyContext";
import { AuthPolicyError, advanceSecurityGeneration, assertSecurityOperation, enrollmentState, finalizeAuthentication,
  finishSecurityOperation, deleteSessionProofState, readGeneration, readSessionSecurity, reserveSecurityOperation } from "./db/authPolicy";
import { assertProofSession, hashProof, issueReauthGrant, readReauthGrant, type ReauthPurpose } from "./authPolicy";
import { withDbWriteRetry } from "./dbWriteRetry";
import { revokeAuthStreams } from "./authStreams";
import { hasResetDelivery, resetCallback } from "./authRecoveryContext";
import { requireJsonSameOrigin } from "../app/api/_helpers/requestOrigin";

export const RAW_DISABLED_PATHS = [
  "/change-password", "/update-user", "/change-email", "/delete-user", "/request-password-reset", "/set-password",
  "/two-factor/disable", "/two-factor/get-totp-uri", "/two-factor/generate-backup-codes",
  "/two-factor/send-otp", "/two-factor/verify-otp", "/passkey/delete-passkey", "/passkey/update-passkey",
  "/revoke-session", "/revoke-sessions", "/revoke-other-sessions",
  ...["create-user", "set-role", "update-user", "ban-user", "unban-user", "remove-user", "set-user-password",
    "revoke-user-session", "revoke-user-sessions", "impersonate-user", "stop-impersonating"].map(path => `/admin/${path}`)
];
const publicPaths = new Set(["/ok", "/get-session", "/sign-out", "/sign-in/email", "/sign-in/imap",
  "/two-factor/enable", "/two-factor/verify-totp", "/two-factor/verify-backup-code",
  "/passkey/generate-register-options", "/passkey/verify-registration",
  "/passkey/generate-authenticate-options", "/passkey/verify-authentication", "/reset-password/:token", "/reset-password"]);

type MiddlewareContext = Parameters<Parameters<typeof createAuthMiddleware>[0]>[0];
function failure(code: string, status = 403): never { throw new AuthPolicyError(code, status); }
function asApiError(error: unknown): never {
  if (error instanceof AuthPolicyError) throw new APIError(error.status === 401 ? "UNAUTHORIZED" : error.status === 409 ? "CONFLICT" : error.status === 400 ? "BAD_REQUEST" : "FORBIDDEN", { code: error.code, message: error.code });
  throw error;
}

async function loadSource(ctx: MiddlewareContext, proof: AuthProofContext, allowSetup = false) {
  const result = await getSessionFromCtx(ctx);
  if (!result) failure("Unauthorized", 401);
  const source = assertProofSession(proof.db, result.session.id, allowSetup);
  proof.source = source;
  proof.authenticatedAt = source.authenticatedAt;
  return source;
}

async function takeSlot(proof: AuthProofContext, userId: string, action: string) {
  proof.op = await reserveSecurityOperation(proof.db, userId, action);
}

function totpSnapshot(proof: AuthProofContext) {
  return JSON.stringify({user:proof.db.prepare(`SELECT twoFactorEnabled FROM auth_user WHERE id=?`).get(proof.source!.userId),
    factors:proof.db.prepare(`SELECT * FROM auth_two_factor WHERE userId=? ORDER BY id`).all(proof.source!.userId)});
}

function checkChallenge(proof: AuthProofContext, identifier: string | false | null) {
  if (!identifier) failure("invalid_challenge");
  const challenge = proof.db.prepare(`SELECT * FROM auth_pending_challenges WHERE identifier=? AND expiresAt>?`).get(identifier, Date.now()) as PendingChallenge | null;
  const library = proof.db.prepare(`SELECT value FROM auth_verification WHERE identifier=? AND julianday(expiresAt)>julianday('now')`).get(identifier);
  if (!challenge || !library) failure("invalid_challenge");
  if (challenge.userId && challenge.generation !== readGeneration(proof.db, challenge.userId)) failure("invalid_challenge");
  if (challenge.kind.startsWith("two_factor") && library.value !== challenge.userId) failure("invalid_challenge");
  if (challenge.loginEpoch !== null && proof.db.prepare(`SELECT generation FROM auth_login_epoch WHERE id=1`).get()?.generation !== challenge.loginEpoch) failure("invalid_challenge");
  proof.challenge = challenge;
  proof.challengeId = challenge.identifier;
  proof.authenticatedAt = challenge.authenticatedAt;
  return challenge;
}

async function preparePolicy(ctx: MiddlewareContext, proof: AuthProofContext) {
  const path = ctx.path;
  if (!path || !publicPaths.has(path)) failure("auth_endpoint_disabled");
  if (ctx.body?.trustDevice === true || ctx.body?.createSession === true || ctx.body?.disableSession !== undefined) failure("unsafe_auth_option", 400);
  const db = proof.db;
  if (path === "/reset-password/:token") {
    if (ctx.query?.callbackURL !== resetCallback(ctx.context.options.baseURL as string)) failure("invalid_callback",400);
    return;
  }
  if (path === "/reset-password") {
    const body=ctx.body;
    if (!body || typeof body.token!=="string" || !/^[A-Za-z0-9_-]{1,128}$/.test(body.token) || typeof body.newPassword!=="string" || body.newPassword.length<10 || body.newPassword.length>256) failure("invalid_request",400);
    const token=db.prepare(`SELECT value FROM auth_verification WHERE identifier=? AND julianday(expiresAt)>julianday('now')`).get(`reset-password:${body.token}`);
    if (!token) failure("INVALID_TOKEN",400);
    await takeSlot(proof,token.value,"security.password.reset");
    await withDbWriteRetry("recordResetCleanupIntent",()=>db.prepare(`UPDATE admin_lifecycle_operations SET payload=?,updatedAt=? WHERE id=?`).run(JSON.stringify({generationBeforeReset:proof.op!.generation}),Date.now(),proof.op!.id));
    proof.destructive=true;
    return;
  }
  if (path === "/sign-out") {
    const source = await getSessionFromCtx(ctx);
    if (source) {
      await takeSlot(proof,source.user.id,"security.logout");
      // Revoke metadata/challenges atomically before the library cookie/session write.
      await deleteSessionProofState(source.session.id,source.user.id,db);
      revokeAuthStreams({sessionId:source.session.id});
    }
    return;
  }
  if (path === "/sign-in/email" || path === "/sign-in/imap") {
    const email = typeof ctx.body?.email === "string" ? ctx.body.email.trim().toLowerCase() : "";
    if (email.length > 320 || typeof ctx.body?.password !== "string" || ctx.body.password.length > 256) failure("invalid_credentials", 401);
    const user = db.prepare(`SELECT id FROM auth_user WHERE lower(trim(email))=?`).get(email);
    if (!user) return; // Stock equalized password path; custom IMAP also refuses before network.
    try { await takeSlot(proof, user.id, "security.login"); }
    catch (error) {
      if (path === "/sign-in/imap" && error instanceof AuthPolicyError && error.status === 401) {
        throw new APIError("UNAUTHORIZED",{code:"INVALID_EMAIL_OR_PASSWORD",message:"Invalid email or password"});
      }
      throw error;
    }
    proof.method = path === "/sign-in/imap" ? "imap" : "password";
    proof.authenticatedAt = Date.now(); // Captured under slot BEFORE the credential verifier.
    return;
  }
  if (path === "/two-factor/enable") {
    if (ctx.body?.method && ctx.body.method !== "totp") failure("totp_required");
    const source = await loadSource(ctx, proof, true);
    if (enrollmentState(db, source.userId).complete) failure("factor_already_enrolled");
    const grant = readReauthGrant(db, ctx.headers?.get("x-noctua-reauth") ?? null, source, "totp.enroll");
    let operation;
    // A replacement continuation is the only way to reuse its reserved slot.
    if (grant.challengeId) {
      const intent = db.prepare(`SELECT * FROM admin_lifecycle_operations WHERE id=? AND slot=? AND state='replacement_setup'`).get(grant.challengeId, `security:${source.userId}`);
      if (!intent) failure("invalid_proof");
      operation = { id: intent.id, userId: source.userId, generation: source.generation, action: intent.action };
    } else {
      await takeSlot(proof, source.userId, "security.totp.enroll");
      operation = proof.op!;
    }
    proof.totpBefore = totpSnapshot(proof);
    await withDbWriteRetry("reserveTotpGrant", () => db.transaction(() => {
      assertSecurityOperation(db, operation);
      if (db.prepare(`UPDATE auth_reauth_grants SET state='reserved' WHERE tokenHash=? AND state='issued'`).run(grant.tokenHash).changes !== 1) failure("invalid_proof");
      db.prepare(`UPDATE admin_lifecycle_operations SET state='totp_enabling',updatedAt=? WHERE id=?`).run(Date.now(),operation.id);
    }).immediate());
    proof.op = operation;
    proof.grantHash = grant.tokenHash;
    proof.kind = "totp_setup";
    proof.destructive = true;
    return;
  }
  if (path === "/two-factor/verify-totp" || path === "/two-factor/verify-backup-code") {
    const session = await getSessionFromCtx(ctx);
    if (session) {
      const source = await loadSource(ctx, proof, true);
      // Authenticated raw verification is ONLY seed activation with a reserved enrollment grant.
      if (path !== "/two-factor/verify-totp" || enrollmentState(db, source.userId).complete) failure("reauth_required");
      const grant = readReauthGrant(db, ctx.headers?.get("x-noctua-reauth") ?? null, source, "totp.enroll", "reserved");
      const challenge = checkChallenge(proof, `totp:${source.sessionId}`);
      if (challenge.kind !== "totp_setup" || challenge.sourceSessionId !== source.sessionId || grant.challengeId !== challenge.identifier) failure("invalid_proof");
      const intent = db.prepare(`SELECT * FROM admin_lifecycle_operations WHERE slot=? AND state='totp_seed_issued'`).get(`security:${source.userId}`);
      if (!intent) failure("invalid_proof");
      const operation = { id: intent.id, userId: source.userId, generation: source.generation, action: intent.action };
      await withDbWriteRetry("beginTotpActivation", () => db.transaction(() => {
        assertSecurityOperation(db,operation);
        if (db.prepare(`UPDATE admin_lifecycle_operations SET state='totp_activating',updatedAt=? WHERE id=? AND state='totp_seed_issued'`).run(Date.now(),intent.id).changes !== 1) failure("security_operation_pending",409);
      }).immediate());
      proof.op = operation;
      proof.grantHash = grant.tokenHash;
      proof.kind = "totp_setup";
      proof.destructive = true;
      return;
    }
    const cookie = ctx.context.createAuthCookie("two_factor");
    const challenge = checkChallenge(proof, await ctx.getSignedCookie(cookie.name, ctx.context.secret));
    if (!["two_factor","two_factor_imap"].includes(challenge.kind) || !challenge.userId) failure("invalid_challenge");
    await takeSlot(proof, challenge.userId, "security.login");
    if (proof.op!.generation !== challenge.generation) failure("invalid_challenge");
    proof.method = path.endsWith("backup-code") ? "backup" : challenge.kind === "two_factor_imap" ? "imap_totp" : "password_totp";
    return;
  }
  if (path === "/passkey/generate-register-options") {
    const source = await loadSource(ctx, proof);
    const grant = readReauthGrant(db, ctx.headers?.get("x-noctua-reauth") ?? null, source, "passkey.enroll");
    await takeSlot(proof, source.userId, "security.passkey.enroll");
    proof.grantHash = grant.tokenHash;
    proof.kind = "passkey_register";
    await withDbWriteRetry("reservePasskeyGrant", () => db.transaction(() => {
      assertSecurityOperation(db, proof.op!);
      if (db.prepare(`UPDATE auth_reauth_grants SET state='reserved' WHERE tokenHash=? AND state='issued'`).run(grant.tokenHash).changes !== 1) failure("invalid_proof");
    }).immediate());
    return;
  }
  if (path === "/passkey/generate-authenticate-options") {
    const token = ctx.headers?.get("x-noctua-reauth");
    if (token) {
      const source = await loadSource(ctx, proof);
      const intent = db.prepare(`SELECT * FROM auth_reauth_grants WHERE tokenHash=? AND userId=? AND sessionId=?
        AND generation=? AND state='uv_pending' AND expiresAt>?`).get(hashProof(token), source.userId, source.sessionId, source.generation, Date.now());
      if (!intent) failure("invalid_proof");
      await takeSlot(proof, source.userId, "security.passkey.reauth");
      proof.kind = "passkey_reauth"; proof.grantHash = intent.tokenHash; proof.purpose = intent.purpose as ReauthPurpose;
    } else {
      // Even with a cookie, ordinary options are login. A revoked epoch cancels them globally.
      proof.kind = "passkey_login";
      const epoch = db.prepare(`SELECT generation FROM auth_login_epoch WHERE id=1`).get();
      if (!epoch) failure("invalid_challenge");
      proof.loginEpoch = epoch.generation;
    }
    return;
  }
  if (path === "/passkey/verify-registration" || path === "/passkey/verify-authentication") {
    const cookie = ctx.context.createAuthCookie("better-auth-passkey");
    const challenge = checkChallenge(proof, await ctx.getSignedCookie(cookie.name, ctx.context.secret));
    proof.kind = challenge.kind;
    if (path.endsWith("verify-registration")) {
      if (challenge.kind !== "passkey_register") failure("invalid_challenge");
      const source = await loadSource(ctx, proof);
      if (challenge.sourceSessionId !== source.sessionId || challenge.userId !== source.userId) failure("invalid_proof");
      const grant = readReauthGrant(db, ctx.headers?.get("x-noctua-reauth") ?? null, source, "passkey.enroll", "reserved");
      if (grant.challengeId !== challenge.identifier) failure("invalid_proof");
      if (db.prepare(`SELECT 1 FROM auth_passkey WHERE credentialID=?`).get(ctx.body?.response?.id ?? "")) failure("credential_already_registered");
      proof.grantHash = grant.tokenHash;
      await takeSlot(proof, source.userId, "security.passkey.enroll");
      proof.destructive = true;
    } else {
      if (!["passkey_login", "passkey_reauth"].includes(challenge.kind)) failure("invalid_challenge");
      const credential = db.prepare(`SELECT userId FROM auth_passkey WHERE credentialID=?`).get(ctx.body?.response?.id ?? "");
      if (!credential) failure("invalid_credentials", 401);
      if (challenge.kind === "passkey_reauth") {
        const source = await loadSource(ctx, proof);
        if (challenge.sourceSessionId !== source.sessionId || credential.userId !== source.userId) failure("invalid_proof");
        const token = ctx.headers?.get("x-noctua-reauth");
        const grant = token && db.prepare(`SELECT * FROM auth_reauth_grants WHERE tokenHash=? AND sessionId=? AND userId=? AND generation=?
          AND challengeId=? AND state='uv_reserved' AND expiresAt>?`).get(hashProof(token), source.sessionId, source.userId, source.generation, challenge.identifier, Date.now());
        if (!grant) failure("invalid_proof");
        proof.grantHash = grant.tokenHash; proof.purpose = grant.purpose as ReauthPurpose;
      }
      await takeSlot(proof, credential.userId, "security.passkey.login");

      proof.verifiedCredentialId = ctx.body.response.id;
      if (challenge.userId && (challenge.userId !== credential.userId || challenge.generation !== proof.op!.generation)) failure("invalid_challenge");
    }
  }
}

/** These hooks collect metadata only; they never finalize on the library adapter connection. */
export function authPolicyDatabaseHooks(): NonNullable<BetterAuthOptions["databaseHooks"]> {
  return {
    user: { create: { before: async user => {
      const creation = currentAuthProof()?.creation;
      if (!creation) return;
      if (user.email !== creation.email || user.role !== creation.role) failure("invalid_creation_scope");
      return { data: { ...user, id: creation.userId } };
    } } },
    verification: { create: { before: async value => {
      const proof = currentAuthProof();
      if (!proof || proof.internal) return;
      const isTwoFactor = value.identifier.startsWith("2fa-") && !value.identifier.startsWith("2fa-attempts-");
      const isPasskey = !!proof.kind?.startsWith("passkey_");
      if (!isTwoFactor && !isPasskey) return;
      if (isTwoFactor && (!proof.op || value.value !== proof.op.userId)) failure("missing_proof_context");
      if (!proof.op && proof.loginEpoch === undefined) failure("missing_proof_context");
      const kind = isTwoFactor ? (proof.method === "imap" ? "two_factor_imap" : "two_factor") : proof.kind!;
      await withDbWriteRetry("registerAuthChallenge", () => proof.db.transaction(() => {
        if (proof.op) assertSecurityOperation(proof.db, proof.op);
        proof.db.prepare(`INSERT INTO auth_pending_challenges(identifier,userId,generation,loginEpoch,authenticatedAt,kind,sourceSessionId,expiresAt)
          VALUES(?,?,?,?,?,?,?,?)`).run(value.identifier, proof.op?.userId ?? null, proof.op?.generation ?? null,
            proof.loginEpoch ?? null, proof.authenticatedAt, kind, proof.source?.sessionId ?? null, new Date(value.expiresAt).getTime());
        if (proof.grantHash) proof.db.prepare(`UPDATE auth_reauth_grants SET challengeId=?,state=? WHERE tokenHash=?`)
          .run(value.identifier, kind === "passkey_reauth" ? "uv_reserved" : "reserved", proof.grantHash);
      }).immediate());
      proof.challengeId = value.identifier;
    } } },
    session: { create: { after: async session => {
      const proof = currentAuthProof();
      if (proof) { proof.createdSessionIds.push(session.id); proof.newSessionId = session.id; }
    } } }
  };
}

export function authPolicyPlugin(): BetterAuthPlugin {
  return {
    id: "noctua-auth-policy",
    hooks: {
      before: [{ matcher: () => true, handler: createAuthMiddleware(async ctx => {
        // Reviewed server APIs are scoped by Noctua wrappers; disabledPaths protects HTTP only.
        if (!ctx.request) {
          if (ctx.path === "/request-password-reset" && (!hasResetDelivery() || ctx.body?.redirectTo!==resetCallback(ctx.context.options.baseURL as string))) {
            throw new APIError("FORBIDDEN", {code:"recovery_authority_required",message:"recovery_authority_required"});
          }
          if (ctx.path === "/admin/create-user" && !currentAuthProof()?.creation && !await getSessionFromCtx(ctx)) {
            throw new APIError("FORBIDDEN", {code:"provisioning_required",message:"provisioning_required"});
          }
          return;
        }
        const proof = currentAuthProof();
        if (!proof || proof.internal) throw new APIError("FORBIDDEN", {code:"missing_proof_context", message:"missing_proof_context"});
        try { await preparePolicy(ctx, proof); } catch (error) { asApiError(error); }
      }) }],
      after: [{ matcher: () => true, handler: createAuthMiddleware(async ctx => {
        const proof = currentAuthProof();
        if (proof && ctx.context.newSession) proof.newSessionId = ctx.context.newSession.session.id;
      }) }]
    }
  };
}

/** Called by UV callbacks. The callback can run inside an adapter transaction: NO master writes. */
export function recordVerifiedPasskey(userId: string | undefined, uv: boolean, registration: boolean, passkeyId?: string) {
  if (!uv) throw new APIError("FORBIDDEN", {code:"passkey_uv_required",message:"Passkey user verification required"});
  const proof = currentAuthProof();
  if (!proof) return; // Trusted server API; never creates Noctua assurance by itself.
  const expected = registration ? proof.source?.userId : proof.op?.userId;
  if (!expected || (userId && userId !== expected)) failure("invalid_proof");
  proof.verifiedUV = true;
  proof.destructive = true; // A successful callback is followed by library credential/session writes.

  if (passkeyId) proof.createdPasskeyId = passkeyId;
}

async function finalizePolicy(proof: AuthProofContext, path: string, response: Response) {
  const { db, op } = proof;
  if (path === "/reset-password" && op) {
    op.generation=readGeneration(db,op.userId);
    await finishSecurityOperation(db,op);
    revokeAuthStreams({userId:op.userId});
    return response;
  }
  if (proof.kind === "passkey_login" && path.endsWith("generate-authenticate-options")) return response;
  if (!op) return response;
  assertSecurityOperation(db, op);
  if (proof.challenge && (proof.challenge.expiresAt <= Date.now() || !db.prepare(`SELECT 1 FROM auth_pending_challenges
    WHERE identifier=? AND kind=? AND userId IS ? AND generation IS ? AND loginEpoch IS ? AND expiresAt>?`)
    .get(proof.challenge.identifier,proof.challenge.kind,proof.challenge.userId,proof.challenge.generation,proof.challenge.loginEpoch,Date.now()))) failure("invalid_challenge");
  if (proof.challenge?.loginEpoch !== null && proof.challenge?.loginEpoch !== undefined &&
    db.prepare(`SELECT generation FROM auth_login_epoch WHERE id=1`).get()?.generation !== proof.challenge.loginEpoch) failure("invalid_challenge");
  if (path === "/two-factor/enable") {
    const identifier = `totp:${proof.source!.sessionId}`;
    await withDbWriteRetry("registerTotpSetup", () => db.transaction(() => {
      assertSecurityOperation(db, op);
      db.prepare(`INSERT INTO auth_pending_challenges(identifier,userId,generation,authenticatedAt,kind,sourceSessionId,expiresAt)
        VALUES(?,?,?,?,'totp_setup',?,?)`).run(identifier, op.userId, op.generation, proof.authenticatedAt, proof.source!.sessionId, Date.now()+300000);
      // Use a registry-only marker for setup. No seed is stored in the registry.
      db.prepare(`INSERT INTO auth_verification(id,identifier,value,expiresAt,createdAt,updatedAt) VALUES(?,?,?,?,?,?)`)
        .run(crypto.randomUUID(), identifier, op.userId, new Date(Date.now()+300000).toISOString(), new Date().toISOString(), new Date().toISOString());
      db.prepare(`UPDATE auth_reauth_grants SET challengeId=? WHERE tokenHash=? AND state='reserved'`).run(identifier, proof.grantHash!);
      db.prepare(`UPDATE admin_lifecycle_operations SET state='totp_seed_issued',updatedAt=? WHERE id=?`).run(Date.now(), op.id);
    }).immediate());

    return response;
  }
  if (path === "/passkey/verify-registration") {
    if (!proof.verifiedUV) failure("passkey_uv_required");
    await withDbWriteRetry("finalizePasskeyRegistration", () => db.transaction(() => {
      assertSecurityOperation(db, op);
      readSessionSecurity(db, proof.source!.sessionId);
      if (!db.prepare(`SELECT 1 FROM auth_pending_challenges WHERE identifier=? AND expiresAt>?`).get(proof.challengeId!,Date.now())) failure("invalid_challenge");
      if (db.prepare(`DELETE FROM auth_reauth_grants WHERE tokenHash=? AND challengeId=? AND state='reserved' AND expiresAt>?`)
        .run(proof.grantHash!, proof.challengeId!, Date.now()).changes !== 1) failure("invalid_proof");
      db.prepare(`DELETE FROM auth_pending_challenges WHERE identifier=?`).run(proof.challengeId!);
    }).immediate());
  } else if (proof.newSessionId && db.prepare(`SELECT id FROM auth_session WHERE id=?`).get(proof.newSessionId)) {
    const passkey = path === "/passkey/verify-authentication";
    if (passkey && !proof.verifiedUV) failure("passkey_uv_required");
    const initial = proof.kind === "totp_setup" && path === "/two-factor/verify-totp";
    const assurance = initial || (passkey && enrollmentState(db, op.userId).complete) || path.startsWith("/two-factor/verify-") ? "mfa" : "setup";
    const source = proof.kind === "passkey_reauth" ? proof.source : undefined;
    await finalizeAuthentication(db, op, { sessionId: proof.newSessionId, userId: op.userId, generation: op.generation,
      assurance: source?.assurance ?? assurance, authenticatedAt: proof.authenticatedAt,
      method: source?.method ?? (passkey ? "passkey_uv" : initial ? "password_totp" : proof.method) }, initial, proof.challenge);
    if (initial) revokeAuthStreams({userId:op.userId});
    if (proof.kind === "passkey_reauth") {
      // The cookie and grant go back in the SAME response, bound to the rotated session.
      const result = await issueReauthGrant(db, op, proof.newSessionId, proof.purpose!, proof.purpose === "passkey.remove" ? {challengeId:`passkey:${proof.verifiedCredentialId}`} : undefined);
      await withDbWriteRetry("retireReauthSource", () => db.transaction(() => {
        db.prepare(`DELETE FROM auth_session WHERE id=?`).run(proof.source!.sessionId);
        db.prepare(`DELETE FROM auth_reauth_grants WHERE tokenHash=?`).run(proof.grantHash!);
      }).immediate());
      revokeAuthStreams({sessionId:proof.source!.sessionId});
      const body = await response.json();
      response = Response.json({...body, ok:true, ...result}, {status:response.status,headers:response.headers});
    }
    if (proof.challengeId) await withDbWriteRetry("consumeAuthChallenge", () => db.prepare(`DELETE FROM auth_pending_challenges WHERE identifier=?`).run(proof.challengeId!));
  }
  await finishSecurityOperation(db, op);
  return response;
}

export function wrapAuthPolicyHandler(handler: (request: Request) => Promise<Response>, database: () => Promise<Database>) {
  return async (request: Request): Promise<Response> => {
    const proof: AuthProofContext = { db: await database(), request, authenticatedAt:Date.now(), method:"password", createdSessionIds:[] };
    return withAuthProof(proof, async () => {
      const path = new URL(request.url).pathname.replace(/^\/api\/ba/, "");
      const reset=path === "/reset-password" || path.startsWith("/reset-password/");
      const protect=(response:Response)=>{
        response.headers.set("cache-control","no-store");
        if (reset) response.headers.set("referrer-policy","no-referrer");
        return response;
      };
      try {
        if (reset && path === "/reset-password") {
          const origin=requireJsonSameOrigin(request);if(origin) return protect(origin);
          const body=await request.clone().json();
          if (new URL(request.url).search || !body || Array.isArray(body) || Object.keys(body).sort().join(",")!=="newPassword,token") return protect(Response.json({ok:false,code:"invalid_request"},{status:400}));
        }
        const response = await handler(request);
        if (!response.ok) {
          const code = (await response.clone().json().catch(() => ({}))).code;
          // In the pinned library INVALID_PASSWORD precedes every enable write. Also
          // require an identical DB snapshot before releasing its destructive intent.
          if (path === "/two-factor/enable" && proof.totpBefore !== undefined &&
              code === "INVALID_PASSWORD" &&
              proof.totpBefore === totpSnapshot(proof)) proof.destructive = false;
          await cleanupFailedPolicy(proof,code === "INVALID_CODE");
          return protect(response);
        }
        const finalized = await finalizePolicy(proof, path, response);
        finalized.headers.set("cache-control", "no-store");
        return protect(finalized);
      } catch (error) {
        await cleanupFailedPolicy(proof);
        if (error instanceof AuthPolicyError) return protect(Response.json({ok:false,code:error.code,message:error.status===401?"Unauthorized":error.code},{status:error.status}));
        // Do not echo library/network exceptions, credentials or callback data.
        return protect(Response.json({ok:false,code:error instanceof SyntaxError?"invalid_request":"security_operation_failed"},{status:error instanceof SyntaxError?400:503}));
      }
    });
  };
}

async function cleanupFailedPolicy(proof: AuthProofContext, invalidCode = false) {
  if (!proof.op) return;
  let retryTotp = false;
  await withDbWriteRetry("cleanupFailedAuthPolicy", () => proof.db.transaction(() => {
    for (const id of proof.createdSessionIds) proof.db.prepare(`DELETE FROM auth_session WHERE id=?`).run(id);
    if (proof.createdPasskeyId) proof.db.prepare(`DELETE FROM auth_passkey WHERE credentialID=? AND userId=?`).run(proof.createdPasskeyId, proof.op!.userId);
    // An incorrect TOTP has no activation writes. Keep its one-use seed capability for another code attempt.
    retryTotp = !!(invalidCode && proof.kind === "totp_setup" && proof.challenge && !proof.createdSessionIds.length &&
      proof.db.prepare(`SELECT twoFactorEnabled FROM auth_user WHERE id=?`).get(proof.op!.userId)?.twoFactorEnabled === 0);
    if (proof.grantHash && !retryTotp) proof.db.prepare(`DELETE FROM auth_reauth_grants WHERE tokenHash=?`).run(proof.grantHash);
    if (retryTotp) proof.db.prepare(`UPDATE admin_lifecycle_operations SET state='totp_seed_issued',updatedAt=? WHERE id=?`).run(Date.now(),proof.op!.id);
    else if (proof.destructive) proof.db.prepare(`UPDATE admin_lifecycle_operations SET state='interrupted',action=?,updatedAt=? WHERE id=?`).run(proof.op!.action==="security.password.reset"?proof.op!.action:"security.interrupted",Date.now(),proof.op!.id);
  }).immediate());
  if (!proof.destructive) await finishSecurityOperation(proof.db, proof.op);
  else if (!retryTotp) revokeAuthStreams({userId:proof.op.userId});
}
