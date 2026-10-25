// LEGACY COPY — transition-only, test-only. Do not import from production code.
// Destination: tests/differential/legacyAccountPresentation.ts
// Source: verbatim from the base commit of perf/account-presentation-batching, origin/integration/stage e70c30b (round 9).
// Every function the batching may change is vendored here; only modules the batching must NOT change are imported (DB handles, row
// parsers, sender-identity rows, session guard, Better Auth session writer, watcher/teamFeatures env reads).
// Delete this file and its test once the differential suite has been green on stage for one release.
// lib/db internals are imported relatively on purpose: the vendored legacy code must bind to the same
// DB-layer modules as the production code, not to the barrel's mock-isolation wrappers.
import type { Database } from "bun:sqlite";
import { NextResponse } from "next/server";
import type { Account, AccountRole } from "@/lib/data";
import { getAccountDb, getDb } from "../../lib/db/connection";
import { mapAccountRow, mapUserRow, USER_ROW_SELECT, type StoredUserRow } from "../../lib/db/rowParsers";
import { listSenderIdentityRows } from "../../lib/db/senderIdentities";
import { getOwnAddresses } from "@/lib/ownAddresses";
import { teamFeaturesSupported } from "@/lib/teamFeatures";
import { getAuth, setActiveAccountId, SESSION_IDLE_TIMEOUT_SECONDS } from "@/lib/betterAuth";
import { requireActiveUserSession, withAuthResponse, type ActiveUserSession } from "@/lib/auth";
import { imapLoginAvailable } from "@/lib/imapLoginPolicy";
import type { UserMailboxSummary, MailboxSummaryResult } from "@/lib/mailboxSummary";
import type { WatcherState } from "../../lib/db/mailboxSummary";

export const LEGACY_BASE = "e70c30bf316cde3f3e266806b34687e311c74088";

// ---- lib/db/accountAccess.ts:4-13 ----
export function legacyResolveAccountRoleRow(db: any, userId: string, accountId: string): AccountRole | null {
  const row = db.query(`SELECT CASE WHEN a.ownerUserId=? THEN 'manager' ELSE ua.role END AS role
    FROM accounts a JOIN users p ON p.id=? JOIN auth_user u ON u.id=p.id
    LEFT JOIN user_accounts ua ON ua.accountId=a.id AND ua.userId=p.id
    WHERE a.id=? AND (a.ownerUserId=p.id OR ua.userId IS NOT NULL)
      AND NOT (COALESCE(u.banned,0)=1 AND (u.banExpires IS NULL OR julianday(u.banExpires)>julianday('now')))
      AND NOT EXISTS (SELECT 1 FROM user_provisioning WHERE userId=p.id AND state NOT IN ('complete','cancelled'))`)
    .get(userId, userId, accountId) as { role: AccountRole } | undefined;
  return row && ["viewer", "editor", "manager"].includes(row.role) ? row.role : null;
}

// ---- lib/db/accounts.ts:42-54, :80-86 ----
async function legacyGetAccountsForUser(userId: string) {
  const db = await getDb();
  const rows = db.prepare(`SELECT DISTINCT a.*
       FROM accounts a
       LEFT JOIN user_accounts ua ON ua.accountId = a.id
       WHERE ua.userId = ? OR a.ownerUserId = ?
       ORDER BY a.id ASC`).all(userId, userId) as any[];
  return rows.map((row) => { const account = mapAccountRow(row); return { ...account, ownAddresses: getOwnAddresses(account, listSenderIdentityRows(db, account.id)) }; }) as Account[];
}
async function legacyGetAccountById(accountId: string) {
  const db = await getDb();
  const row = db.prepare(`SELECT * FROM accounts WHERE id = ?`).get(accountId) as any;
  if (!row) return null;
  const account = mapAccountRow(row);
  return { ...account, ownAddresses: getOwnAddresses(account, listSenderIdentityRows(db, accountId)) };
}

// ---- lib/db/users.ts:38-44, :119-133 ----
async function legacyGetUsers() {
  const db = await getDb();
  return (db.prepare(`SELECT ${USER_ROW_SELECT} FROM users p JOIN auth_user u ON u.id=p.id ORDER BY p.createdAt ASC, p.id ASC`).all() as StoredUserRow[]).map(mapUserRow);
}
async function legacyListAccessibleAccountIdsForUser(userId: string) {
  const db = await getDb();
  const rows = db.prepare(`SELECT DISTINCT a.id as id
       FROM accounts a
       LEFT JOIN user_accounts ua ON ua.accountId = a.id
       WHERE ua.userId = ? OR a.ownerUserId = ?
       ORDER BY a.id ASC`).all(userId, userId) as Array<{ id?: string | null }>;
  return rows.map((row) => String(row.id ?? "").trim()).filter(Boolean);
}

// ---- lib/accountAccess.ts:11-38 ----
async function legacyResolveAccountRole(userId: string, accountId: string) { return legacyResolveAccountRoleRow(await getDb(), userId, accountId); }
export async function legacyListAccountMembers(accountId: string): Promise<Array<{ userId: string; email: string; name: string | null; role: AccountRole; isOwner: boolean; disabled: boolean }>> {
  const db = await getDb();
  const account = db.prepare("SELECT ownerUserId FROM accounts WHERE id=?").get(accountId) as { ownerUserId: string | null } | undefined;
  if (!account) return [];
  const links = db.prepare("SELECT userId,role FROM user_accounts WHERE accountId=?").all(accountId) as { userId: string; role: AccountRole }[];
  const roles = new Map(links.map(l => [l.userId, l.role]));
  if (account.ownerUserId) roles.set(account.ownerUserId, "manager");
  return (await legacyGetUsers()).filter(u => roles.has(u.id)).map(u => ({ userId: u.id, email: u.email,
    name: u.name ?? null, role: roles.get(u.id)!, isOwner: account.ownerUserId === u.id, disabled: u.disabled }))
    .sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email, "en") || a.email.trim().toLowerCase().localeCompare(b.email.trim().toLowerCase(), "en") || a.userId.localeCompare(b.userId, "en"));
}
export async function legacyListAccountMembersForRole(accountId: string, role: AccountRole) {
  const members = await legacyListAccountMembers(accountId);
  return role === "manager" ? members : members.filter(member => !member.disabled).map(({ disabled, ...member }) => { void disabled; return member; });
}
export async function legacyListAccessibleAccountsForUser(userId: string): Promise<Array<{ account: Account; role: AccountRole; isOwner: boolean; memberCount: number }>> {
  const result = [];
  for (const account of await legacyGetAccountsForUser(userId)) {
    const role = await legacyResolveAccountRole(userId, account.id);
    if (role) result.push({ account, role, isOwner: account.ownerUserId === userId, memberCount: (await legacyListAccountMembers(account.id)).length });
  }
  return result.sort((a, b) => (a.account.name || a.account.email).localeCompare(b.account.name || b.account.email, "en") ||
    a.account.email.trim().toLowerCase().localeCompare(b.account.email.trim().toLowerCase(), "en") || a.account.id.localeCompare(b.account.id, "en"));
}

// ---- lib/accountPresentation.ts:3-44 ----
export function legacySanitizeAccountForClient(account: Account, options: { role: AccountRole; viewerUserId: string; memberCount: number }): Account {
  const manager = options.role === "manager";
  return {
    ...account,
    accessRole: options.role,
    isOwner: account.ownerUserId === options.viewerUserId,
    shared: options.memberCount > 1,
    imap: { ...account.imap, host: manager ? account.imap.host : "", user: manager ? account.imap.user : "", password: "" },
    smtp: { ...account.smtp, host: manager ? account.smtp.host : "", user: manager ? account.smtp.user : "", password: "" },
    caldav: manager && account.caldav ? { ...account.caldav, password: "" } : undefined,
    deepl: account.deepl
      ? { enabled: account.deepl.enabled, targetLang: account.deepl.targetLang,
          ...(manager ? { apiKey: "", hasApiKey: Boolean(account.deepl.apiKey && account.deepl.apiKey.trim()) } : {}) }
      : undefined
  };
}
export async function legacySanitizeAccountsForClient(userId: string) {
  return (await legacyListAccessibleAccountsForUser(userId)).map(({ account, role, memberCount }) =>
    legacySanitizeAccountForClient(account, { role, viewerUserId: userId, memberCount }));
}

// ---- lib/auth.ts:110-132 ----
export async function legacyEnsureActiveAccountId(session: ActiveUserSession) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const accounts = (await legacyGetAccountsForUser(session.userId)).sort((a, b) =>
      (a.name || a.email).localeCompare(b.name || b.email, "en") ||
      a.email.trim().toLowerCase().localeCompare(b.email.trim().toLowerCase(), "en") || a.id.localeCompare(b.id, "en"));
    if (!accounts.length) {
      await setActiveAccountId(await getAuth(), session.sessionToken, null);
      session.activeAccountId = null;
      return { mailboxState: "none" as const, accountId: null, accounts: [] };
    }
    const selected = accounts.find(a => a.id === session.activeAccountId) ?? accounts[0];
    const updated = await setActiveAccountId(await getAuth(), session.sessionToken, selected.id);
    const liveIds = await legacyListAccessibleAccountIdsForUser(session.userId);
    if (updated && liveIds.includes(selected.id) && await legacyGetAccountById(selected.id)) {
      session.activeAccountId = selected.id;
      return { mailboxState: "selected" as const, accountId: selected.id, accounts: accounts.filter(a => liveIds.includes(a.id)) };
    }
    session.activeAccountId = null;
  }
  await setActiveAccountId(await getAuth(), session.sessionToken, null);
  const accounts = await legacyGetAccountsForUser(session.userId);
  return { mailboxState: accounts.length ? "unselected" as const : "none" as const, accountId: null, accounts };
}

// ---- app/api/auth/me/route.ts:7-24 (getUserById is outside the batching scope; imported via serverDb in the route) ----
export async function legacyMeGET(request: Request) {
  const { getUserById } = await import("@/lib/serverDb");
  const session = await requireActiveUserSession(request, { allowRestricted: true });
  if (session instanceof NextResponse) return session;
  return withAuthResponse(session, async () => {
    const user = await getUserById(session.userId);
    if (!user) return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    const restricted = session.enrollmentRequired || session.reauthRequired;
    const selection = restricted ? { mailboxState: "enrollment", accountId: null, accounts: [] } : await legacyEnsureActiveAccountId(session);
    return NextResponse.json({ ok: true,
      user: restricted ? { id: user.id, email: user.email, name: user.name, uiLocale: user.uiLocale } : user,
      accountId: selection.accountId, accounts: restricted ? [] : await legacySanitizeAccountsForClient(session.userId),
      exp: Math.floor(session.expiresAt / 1000), ttlSeconds: SESSION_IDLE_TIMEOUT_SECONDS,
      mailboxState: selection.mailboxState,
      security: { imapLoginAvailable: imapLoginAvailable(), hasPassword: user.hasPassword,
        enrollmentRequired: session.enrollmentRequired, reauthRequired: session.reauthRequired,
        ...(session.securityCode ? { code: session.securityCode } : {}) } });
  });
}

// ---- lib/db/mailboxSummary.ts:15-35 ----
async function legacyGetMailboxSummaries(accountIds: readonly string[]) {
  const summaries: Array<{ accountId: string; unreadInbox: number; lastSyncAt: number | null; watcherState: WatcherState }> = [];
  for (const accountId of new Set(accountIds)) {
    const db = await getAccountDb(accountId);
    const row = db.prepare(`
      SELECT COUNT(*) AS unreadInbox FROM messages
      WHERE accountId = ? AND unread = 1 AND COALESCE(deleted, 0) = 0
        AND folderId IN (SELECT id FROM folders WHERE accountId = ?
          AND (lower(specialUse) = '\\inbox' OR lower(id) = lower(?)))
    `).get(accountId, accountId, `${accountId}:INBOX`) as { unreadInbox: number };
    const state = db.prepare(`SELECT lastSyncAt, watcherState FROM mailbox_summary WHERE accountId = ?`)
      .get(accountId) as { lastSyncAt: number | null; watcherState: WatcherState } | undefined;
    summaries.push({ accountId, unreadInbox: row.unreadInbox, lastSyncAt: state?.lastSyncAt ?? null,
      watcherState: process.env.NOCTUA_MAILBOX_WATCHER === "1" && teamFeaturesSupported() ? state?.watcherState ?? "starting" : "disabled" });
  }
  return summaries;
}

// ---- lib/mailboxSummary.ts:17-61 ----
export function legacyAuthorizeMailboxSummary(db: Database, userId: string, summary: MailboxSummaryResult): MailboxSummaryResult {
  return { ...summary, mailboxes: summary.mailboxes.flatMap(mailbox => {
    const role = legacyResolveAccountRoleRow(db, userId, mailbox.accountId);
    return role ? [{ ...mailbox, accessRole: role }] : [];
  }) };
}
export const LEGACY_COLLAB_SUMMARY_SQL = `WITH live AS (
  SELECT threads.threadId, tc.assigneeUserId,
    (tc.status IS NULL OR tc.status IN ('open','in_progress','waiting')) AS isOpen
  FROM (SELECT DISTINCT threadId FROM messages INDEXED BY idx_messages_live_thread_summary
    WHERE accountId = ?1 AND COALESCE(deleted, 0) = 0) threads
  LEFT JOIN thread_collab_state tc ON tc.accountId = ?1 AND tc.threadId = threads.threadId
) SELECT
  (SELECT COUNT(*) FROM thread_collab_state tc
    WHERE tc.accountId = ?1 AND tc.assigneeUserId = ?2
      AND EXISTS (SELECT 1 FROM messages m INDEXED BY idx_messages_live_thread_summary WHERE m.accountId = tc.accountId
        AND m.threadId = tc.threadId AND COALESCE(m.deleted, 0) = 0)) AS assignedToMe,
  COUNT(CASE WHEN assigneeUserId IS NULL AND isOpen THEN 1 END) AS unassignedOpen,
  COUNT(CASE WHEN isOpen THEN 1 END) AS open
FROM live
`;
export async function legacyGetUserMailboxSummary(userId: string, scope?: readonly string[]): Promise<MailboxSummaryResult> {
  const accounts = (await legacyListAccessibleAccountsForUser(userId)).filter(({ account }) => !scope || scope.includes(account.id));
  const mailboxes: UserMailboxSummary[] = [];
  for (const { account, role, isOwner, memberCount } of accounts) {
    const db = await getAccountDb(account.id);
    const [summary] = await legacyGetMailboxSummaries([account.id]);
    const counts = db.prepare(LEGACY_COLLAB_SUMMARY_SQL).get(account.id, userId) as { assignedToMe: number; unassignedOpen: number; open: number };
    mailboxes.push({
      accountId: account.id, name: account.name, email: account.email, accessRole: role,
      isOwner, shared: memberCount > 1,
      unread: summary.lastSyncAt === null ? null : summary.unreadInbox,
      ...counts, watcher: { state: summary.watcherState, ...(summary.lastSyncAt === null ? {} : { lastEventAt: summary.lastSyncAt }) }
    });
  }
  const db = await getDb();
  return db.transaction(() => legacyAuthorizeMailboxSummary(db, userId, { ok: true, generatedAt: Date.now(), mailboxes })).deferred();
}

// ---- app/api/me/mailboxes/summary/route.ts:6-21 ----
export async function legacySummaryGET(request: Request) {
  const { assertStreamAuthorized } = await import("@/lib/authStreams");
  const session = await requireActiveUserSession(request);
  if (session instanceof Response) return session;
  return withAuthResponse(session, async () => {
    const summary = await legacyGetUserMailboxSummary(session.userId);
    let response: Response;
    try {
      await assertStreamAuthorized(session, db => {
        response = NextResponse.json(legacyAuthorizeMailboxSummary(db, session.userId, summary), { headers: { "Cache-Control": "no-store" } });
      });
    } catch {
      return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }
    return response!;
  });
}
