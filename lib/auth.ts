import { NextResponse } from "next/server";
import { getAuth, setActiveAccountId } from "./betterAuth";
import { getDb } from "./db/connection";
import { getAccountById, getAccountsForUser, getUserById, listAccessibleAccountIdsForUser } from "./serverDb";
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
    // Entity headers describe the library JSON, not this route's attachment/stream.
    if (!["set-cookie", "content-type", "content-length"].includes(key.toLowerCase())) response.headers.set(key, value);
  });
  const existing = new Set(response.headers.getSetCookie());
  for (const cookie of headers.getSetCookie()) if (!existing.has(cookie)) response.headers.append("set-cookie", cookie);
  return response;
}

/** Route/helper tails explicitly carry the headers obtained by their guard. */
export async function withAuthResponse<T>(
  context: ActiveUserSession | { session: ActiveUserSession }, respond: () => T | Promise<T>
): Promise<T> {
  const session = "session" in context ? context.session : context;
  const response = await respond();
  return response instanceof Response ? forwardAuthHeaders(response, session.responseHeaders) : response;
}

function denied(status: number, code?: string, headers = new Headers()) {
  return forwardAuthHeaders(NextResponse.json({ ok: false, message: status === 401 ? "Unauthorized" : "MFA required", ...(code ? { code } : {}) }, { status }), headers);
}

export async function requireActiveUserSession(request?: Request | null, options: { allowRestricted?: boolean } = {}): Promise<ActiveUserSession | NextResponse> {
  if (!request) return denied(401);
  const auth = await getAuth();
  const { response: result, headers } = await auth.api.getSession({ headers: request.headers, returnHeaders: true });
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
  const enrollmentRequired = !mfa.complete || (user.role === "admin" && !user.hasPassword);
  const reauthRequired = security.assurance !== "mfa";
  const securityCode = mfa.inconsistent ? "mfa_state_inconsistent" : enrollmentRequired ? "mfa_enrollment_required" : "mfa_required";
  if (!options.allowRestricted && (enrollmentRequired || reauthRequired)) return denied(403, securityCode, headers);
  return { userId: user.id, sessionId: result.session.id, sessionToken: result.session.token,
    activeAccountId: result.session.activeAccountId ?? null, role: user.role, expiresAt,
    generation:security.generation, assurance:security.assurance, authenticatedAt:security.authenticatedAt, method:security.method,
    responseHeaders: headers, enrollmentRequired, reauthRequired,
    ...((enrollmentRequired || reauthRequired) ? { securityCode } : {}) };
}

export async function requireAccountAccessOr403(session: ActiveUserSession, accountId: string) {
  if ((await listAccessibleAccountIdsForUser(session.userId)).includes(accountId.trim())) return true;
  return forwardAuthHeaders(NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 }), session.responseHeaders);
}

export async function listSessionAccountIds(session: ActiveUserSession) {
  return new Set(await listAccessibleAccountIdsForUser(session.userId));
}

export type MailboxSelection = { mailboxState: "selected" | "none" | "unselected"; accountId: string | null; accounts: Awaited<ReturnType<typeof getAccountsForUser>> };

/** Persist a deterministic default, then recheck membership. Retry a revoked choice once. */
export async function ensureActiveAccountId(session: ActiveUserSession): Promise<MailboxSelection> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const accounts = (await getAccountsForUser(session.userId)).sort((a, b) =>
      (a.name || a.email).localeCompare(b.name || b.email, "en") ||
      a.email.trim().toLowerCase().localeCompare(b.email.trim().toLowerCase(), "en") || a.id.localeCompare(b.id, "en"));
    if (!accounts.length) {
      await setActiveAccountId(await getAuth(), session.sessionToken, null);
      session.activeAccountId = null;
      return { mailboxState: "none", accountId: null, accounts: [] };
    }
    const selected = accounts.find(a => a.id === session.activeAccountId) ?? accounts[0];
    const updated = await setActiveAccountId(await getAuth(), session.sessionToken, selected.id);
    const liveIds = await listAccessibleAccountIdsForUser(session.userId);
    if (updated && liveIds.includes(selected.id) && await getAccountById(selected.id)) {
      session.activeAccountId = selected.id;
      return { mailboxState: "selected", accountId: selected.id, accounts: accounts.filter(a => liveIds.includes(a.id)) };
    }
    session.activeAccountId = null;
  }
  await setActiveAccountId(await getAuth(), session.sessionToken, null);
  const accounts = await getAccountsForUser(session.userId);
  return { mailboxState: accounts.length ? "unselected" : "none", accountId: null, accounts };
}

/** MCP activation and the opaque generation-bound format belong to Slice 3. */
export async function requireMcpAccountContext(_request?: Request | null) {
  void _request;
  return NextResponse.json({ ok: false, code: "auth_integration_pending" }, { status: 503 });
}
