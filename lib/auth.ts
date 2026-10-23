import { expireLegacyCookie } from "./authCookies";
import { mailboxErrorResponse } from "./mailboxFailure";
import type { AccountRole } from "./data";
import { NextResponse } from "next/server";
import { getAuth, setActiveAccountId } from "./betterAuth";
import { getDb } from "./db/connection";
import { getUserById, listAccessibleAccountIdsForUser } from "./serverDb";
import { readAccountSelectionCandidates } from "./db/accounts";
import { compareDisplayOrder } from "./accountPresentation";
import type { AccountAccessSnapshot } from "./accountAccess";
import { isMfaEnrollmentComplete } from "./authPolicy";

export const SESSION_TTL_SECONDS = 86400;
export type ActiveUserSession = {
  userId: string;
  sessionId: string;
  sessionToken: string;
  activeAccountId: string | null;
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
  const expiresAt = Math.min(new Date(result.session.expiresAt).getTime(), security.authenticatedAt + SESSION_TTL_SECONDS * 1000);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return denied(401, undefined, headers);
  const mfa = await isMfaEnrollmentComplete(user.id);
  const pendingSecurity = !!db.prepare(`SELECT 1 FROM admin_lifecycle_operations WHERE slot=?
    AND action NOT IN ('security.login','security.reauth','security.passkey.reauth','security.passkey.login')`).get(`security:${user.id}`);
  const enrollmentRequired = pendingSecurity || !mfa.complete || (user.role === "admin" && !user.hasPassword);
  const reauthRequired = security.assurance !== "mfa";
  const securityCode = pendingSecurity ? "security_operation_pending" : mfa.inconsistent ? "mfa_state_inconsistent" : enrollmentRequired ? "mfa_enrollment_required" : "mfa_required";
  if (!options.allowRestricted && (enrollmentRequired || reauthRequired)) return denied(403, securityCode, headers);
  return { userId: user.id, sessionId: result.session.id, sessionToken: result.session.token,
    activeAccountId: result.session.activeAccountId ?? null, role: user.role, expiresAt,
    generation:security.generation, assurance:security.assurance, authenticatedAt:security.authenticatedAt, method:security.method,
    responseHeaders: headers, enrollmentRequired, reauthRequired,
    ...((enrollmentRequired || reauthRequired) ? { securityCode } : {}) };
}

export async function requireAccountAccessOr403(session: ActiveUserSession, accountId: string) {
  const { resolveAccountRole } = await import("./accountAccess");
  if (await resolveAccountRole(session.userId, accountId.trim())) return true;
  return forwardAuthHeaders(NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 }), session.responseHeaders);
}

export async function listSessionAccountIds(session: ActiveUserSession) {
  return new Set(await listAccessibleAccountIdsForUser(session.userId));
}

/** `access` is this request's access read, taken after the last selection write; never reuse it elsewhere. */
export type MailboxSelection = { mailboxState: "selected" | "none" | "unselected"; accountId: string | null; access: AccountAccessSnapshot };

/**
 * Persist a deterministic default, then recheck membership on a fresh access read. Retry a revoked choice once.
 * The read after the write proves the selected mailbox still exists and is still a candidate, and supplies the
 * mailbox list, so grants, revocations and role changes committed during persistence are reflected.
 */
export async function ensureActiveAccountId(session: ActiveUserSession): Promise<MailboxSelection> {
  const { readAccountAccess } = await import("./accountAccess");
  const db = await getDb();
  const readAccess = () => readAccountAccess(db, session.userId, { identities: true });
  for (let attempt = 0; attempt < 2; attempt++) {
    const candidates = readAccountSelectionCandidates(db, session.userId).sort(compareDisplayOrder);
    if (!candidates.length) {
      await setActiveAccountId(await getAuth(), session.sessionToken, null);
      session.activeAccountId = null;
      return { mailboxState: "none", accountId: null, access: readAccess() };
    }
    const selected = candidates.find(a => a.id === session.activeAccountId) ?? candidates[0];
    const updated = await setActiveAccountId(await getAuth(), session.sessionToken, selected.id);
    const access = readAccess();
    if (updated && access.candidateIds.includes(selected.id)) {
      session.activeAccountId = selected.id;
      return { mailboxState: "selected", accountId: selected.id, access };
    }
    session.activeAccountId = null;
  }
  await setActiveAccountId(await getAuth(), session.sessionToken, null);
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
