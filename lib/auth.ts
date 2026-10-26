import { expireLegacyCookie } from "./authCookies";
import { mailboxErrorResponse } from "./mailboxFailure";
import type { AccountRole } from "./data";
import type { Database } from "bun:sqlite";
import { NextResponse } from "next/server";
import { compareAndSetActiveAccountId, getAuth } from "./betterAuth";
import { getDb } from "./db/connection";
import { getUserById } from "./serverDb";
import { readAccountSelectionCandidates } from "./db/accounts";
import { compareDisplayOrder } from "./accountPresentation";
import type { AccountAccessSnapshot } from "./accountAccess";
import { isMfaEnrollmentComplete } from "./authPolicy";

export const SETUP_SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type ActiveUserSession = {
  userId: string;
  sessionId: string;
  sessionToken: string;
  activeAccountId: string | null;
  /** `auth_session.updatedAt` as read by this request's getSession (epoch ms; NaN if unreadable). */
  sessionUpdatedAt: number;
  role: "admin" | "user";
  expiresAt: number;
  generation: number;
  assurance: "setup" | "mfa";
  authenticatedAt: number;
  method: string;
  responseHeaders: Headers;
  enrollmentRequired: boolean;
  reauthRequired: boolean;
  securityCode?: string;
};

/** Append each cookie separately: Headers.set would lose earlier refresh/deletion cookies. */
export function forwardAuthHeaders<T extends Response>(response: T, headers: Headers): T {
  headers.forEach((value, key) => {
    const name = key.toLowerCase();
    // Entity headers describe the library JSON, not this route's attachment/stream.
    if (["set-cookie", "content-type", "content-length"].includes(name)) return;
    // A route that set its own caching policy (private attachment cache, 304 revalidation) keeps it;
    // the library's no-store only applies where the route stayed silent.
    if (name === "cache-control" && response.headers.has("cache-control")) return;
    response.headers.set(key, value);
  });
  const existing = new Set(response.headers.getSetCookie());
  for (const cookie of headers.getSetCookie()) if (!existing.has(cookie)) response.headers.append("set-cookie", cookie);
  return response;
}

/** Route/helper tails explicitly carry the headers obtained by their guard. */
export async function withAuthResponse<T>(
  context: ActiveUserSession | { session: ActiveUserSession; accountId?: string; role?: AccountRole }, respond: () => T | Promise<T>
): Promise<T> {
  const session = "session" in context ? context.session : context;
  try {
    const response = await respond();
    return response instanceof Response ? forwardAuthHeaders(response, session.responseHeaders) : response;
  } catch (error) {
    if ("session" in context && context.accountId) {
      const response = await mailboxErrorResponse(error, context.accountId, context.role);
      if (response) return forwardAuthHeaders(response, session.responseHeaders) as T;
    }
    throw error;
  }
}

function denied(status: number, code?: string, headers = new Headers()) {
  return forwardAuthHeaders(NextResponse.json({ ok: false, message: status === 401 ? "Unauthorized" : "MFA required", ...(code ? { code } : {}) }, { status }), headers);
}

export async function requireActiveUserSession(request?: Request | null, options: { allowRestricted?: boolean } = {}): Promise<ActiveUserSession | NextResponse> {
  if (!request) return denied(401);
  const auth = await getAuth();
  const { response: result, headers } = await auth.api.getSession({ headers: request.headers, returnHeaders: true });
  expireLegacyCookie(request, headers);
  if (!result) return denied(401, undefined, headers);
  const db = await getDb();
  const user = await getUserById(result.user.id);
  if (!user || user.disabled) return denied(401, undefined, headers);
  if (db.prepare("SELECT 1 FROM user_provisioning WHERE userId=? AND state NOT IN ('complete','cancelled')").get(user.id)) return denied(401, undefined, headers);
  const security = db.prepare(`SELECT s.userId,s.generation,s.assurance,s.authenticatedAt,s.method, u.generation AS currentGeneration
    FROM auth_session_security s JOIN auth_security_state u ON u.userId=s.userId WHERE s.sessionId=?`).get(result.session.id) as
    { userId: string; generation: number; currentGeneration: number; assurance: "setup" | "mfa"; authenticatedAt: number; method: string } | undefined;
  // Even restricted access requires a bound, live sidecar; Slice 4 issues/finalizes it.
  if (!security || !["setup", "mfa"].includes(security.assurance) || security.userId !== user.id || security.generation !== security.currentGeneration ||
    !Number.isSafeInteger(security.authenticatedAt) || security.authenticatedAt > Date.now()) return denied(401, undefined, headers);
  // Setup cannot be kept alive indefinitely by repeatedly opening enrollment.
  // Use creation, not authenticatedAt/updatedAt, which can change during setup.
  const createdAt = new Date(result.session.createdAt).getTime();
  const expiresAt = security.assurance === "setup"
    ? Math.min(new Date(result.session.expiresAt).getTime(), createdAt + SETUP_SESSION_MAX_AGE_MS)
    : new Date(result.session.expiresAt).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return denied(401, undefined, headers);
  const mfa = await isMfaEnrollmentComplete(user.id);
  const pendingSecurity = !!db.prepare(`SELECT 1 FROM admin_lifecycle_operations WHERE slot=?
    AND action NOT IN ('security.login','security.reauth','security.passkey.reauth','security.passkey.login')`).get(`security:${user.id}`);
  const enrollmentRequired = pendingSecurity || !mfa.complete || (user.role === "admin" && !user.hasPassword);
  const reauthRequired = security.assurance !== "mfa";
  const securityCode = pendingSecurity ? "security_operation_pending" : mfa.inconsistent ? "mfa_state_inconsistent" : enrollmentRequired ? "mfa_enrollment_required" : "mfa_required";
  if (!options.allowRestricted && (enrollmentRequired || reauthRequired)) return denied(403, securityCode, headers);
  return { userId: user.id, sessionId: result.session.id, sessionToken: result.session.token,
    activeAccountId: result.session.activeAccountId ?? null, sessionUpdatedAt: new Date(result.session.updatedAt).getTime(), role: user.role, expiresAt,
    generation:security.generation, assurance:security.assurance, authenticatedAt:security.authenticatedAt, method:security.method,
    responseHeaders: headers, enrollmentRequired, reauthRequired,
    ...((enrollmentRequired || reauthRequired) ? { securityCode } : {}) };
}

export async function requireAccountAccessOr403(session: ActiveUserSession, accountId: string) {
  const { resolveAccountRole } = await import("./accountAccess");
  if (await resolveAccountRole(session.userId, accountId.trim())) return true;
  return forwardAuthHeaders(NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 }), session.responseHeaders);
}

/** `access` is this request's access read, taken after the last selection write; never reuse it elsewhere. */
export type MailboxSelection = { mailboxState: "selected" | "none" | "unselected"; accountId: string | null; access: AccountAccessSnapshot };

/** The selection write also refreshes "Last active"; it is skipped while nothing changes and this is not exceeded. */
export const SESSION_ACTIVITY_WRITE_INTERVAL_MS = 5 * 60_000;

/** This exact session still exists, is unexpired and bound to the current security generation (a read, no write lock). */
function isSessionLive(db: Database, session: ActiveUserSession) {
  return !!db.query(`SELECT 1 FROM auth_session s
    JOIN auth_session_security ss ON ss.sessionId=s.id AND ss.userId=s.userId
    JOIN auth_security_state st ON st.userId=s.userId
    WHERE s.id=? AND s.token=? AND s.userId=? AND ss.generation=? AND st.generation=ss.generation
      AND julianday(s.expiresAt)>=julianday('now')`).get(session.sessionId, session.sessionToken, session.userId, session.generation);
}

/** Clears the selection only while it is still `accountId` (compare-and-set): a switch committed since then stays. */
export async function clearActiveAccountIdIfStill(session: ActiveUserSession, accountId: string) {
  return compareAndSetActiveAccountId(await getDb(), session.sessionToken, accountId, null);
}

/**
 * Persist a deterministic default, then recheck membership on a fresh access read. Retry a revoked choice once.
 * The read after the write proves the selected mailbox still exists and is still a candidate, and supplies the
 * mailbox list, so grants, revocations and role changes committed during persistence are reflected.
 * Every write is a compare-and-set on the selection this request last saw: a switch-account committed after
 * getSession is adopted (it passed its own membership check, and is rechecked here), never written over.
 */
export async function ensureActiveAccountId(session: ActiveUserSession): Promise<MailboxSelection> {
  const { readAccountAccess } = await import("./accountAccess");
  const db = await getDb();
  const readAccess = () => readAccountAccess(db, session.userId, { identities: true });
  // Stored selection and activity as of this request's getSession, advanced by every write attempt below.
  let stored = { accountId: session.activeAccountId, updatedAt: session.sessionUpdatedAt };
  /**
   * Writes only on a change or stale activity. Returns the selection now stored (this request's or a concurrent
   * switch's) and the liveness, which is read on every attempt, written or not.
   */
  const persist = async (accountId: string | null) => {
    const age = Date.now() - stored.updatedAt;
    if (accountId !== stored.accountId || !(age >= 0 && age < SESSION_ACTIVITY_WRITE_INTERVAL_MS)) {
      const result = await compareAndSetActiveAccountId(db, session.sessionToken, stored.accountId, accountId);
      if (!result) return { live: false, accountId: null };
      stored = { accountId: result.accountId, updatedAt: result.updatedAt };
    }
    return { live: isSessionLive(db, session), accountId: stored.accountId };
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    const candidates = readAccountSelectionCandidates(db, session.userId).sort(compareDisplayOrder);
    if (!candidates.length) {
      await persist(null);
      session.activeAccountId = null;
      return { mailboxState: "none", accountId: null, access: readAccess() };
    }
    const selected = candidates.find(a => a.id === session.activeAccountId) ?? candidates[0];
    const { live, accountId } = await persist(selected.id);
    const access = readAccess();
    if (live && accountId && access.candidateIds.includes(accountId)) {
      session.activeAccountId = accountId;
      return { mailboxState: "selected", accountId, access };
    }
    session.activeAccountId = null;
  }
  await persist(null);
  const access = readAccess();
  return { mailboxState: access.candidateIds.length ? "unselected" : "none", accountId: null, access };
}

/** Bearer-only: browser cookies are never an MCP fallback. */
export async function requireMcpAccountContext(request?: Request | null) {
  const bearer = request?.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
  const { validateMcpToken } = await import("./mcpAuth");
  const context = bearer ? await validateMcpToken(bearer) : null;
  return context ?? NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
}
