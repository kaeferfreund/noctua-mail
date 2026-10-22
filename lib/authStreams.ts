import { getDb } from "./db/connection";
import { resolveAccountRoleRow } from "./db/accountAccess";
import { roleAtLeast } from "./accountRole";
import type { AccountRole } from "./data";

export type AuthStreamIdentity = {
  userId: string; sessionId: string; accountId?: string;
  generation: number; authenticatedAt: number; expiresAt: number; minRole?: AccountRole;
};
export type StreamRevocation = { userId?: string; sessionId?: string; accountId?: string };
type Entry = { identity: AuthStreamIdentity; close: () => void };
const key = Symbol.for("noctua.authStreams");
const globals = globalThis as typeof globalThis & { [key]?: Set<Entry> };
const streams = globals[key] ??= new Set<Entry>();

/** Call immediately before enqueue, with no intervening await after resolution. */
export async function assertStreamAuthorized(identity: AuthStreamIdentity): Promise<void> {
  const db = await getDb();
  db.transaction(() => {
  const now = Date.now();
  const row = db.prepare(`SELECT s.expiresAt,ss.authenticatedAt FROM auth_session s
    JOIN users p ON p.id=s.userId JOIN auth_user u ON u.id=p.id
    JOIN auth_session_security ss ON ss.sessionId=s.id AND ss.userId=s.userId
    JOIN auth_security_state st ON st.userId=s.userId
    WHERE s.id=? AND s.userId=? AND st.generation=? AND ss.generation=st.generation
      AND ss.assurance='mfa' AND ss.authenticatedAt=? AND u.twoFactorEnabled=1
      AND NOT (COALESCE(u.banned,0)=1 AND (u.banExpires IS NULL OR julianday(u.banExpires)>julianday('now')))
      AND (SELECT COUNT(*) FROM auth_two_factor WHERE userId=u.id)=1
      AND EXISTS (SELECT 1 FROM auth_two_factor WHERE userId=u.id AND verified=1 AND length(trim(secret))>0)
      AND (p.role<>'admin' OR EXISTS (SELECT 1 FROM auth_account WHERE userId=u.id AND providerId='credential' AND password IS NOT NULL))
      AND NOT EXISTS (SELECT 1 FROM admin_lifecycle_operations WHERE slot='security:' || u.id
        AND action NOT IN ('security.login','security.reauth','security.passkey.reauth','security.passkey.login'))
      AND NOT EXISTS (SELECT 1 FROM user_provisioning WHERE userId=u.id AND state NOT IN ('complete','cancelled'))`)
    .get(identity.sessionId, identity.userId, identity.generation, identity.authenticatedAt) as { expiresAt: string | number; authenticatedAt: number } | undefined;
  if (!row || !Number.isSafeInteger(identity.generation) || !Number.isSafeInteger(identity.authenticatedAt) || !Number.isFinite(identity.expiresAt) || !Number.isFinite(new Date(row.expiresAt).getTime()) || identity.expiresAt <= now || new Date(row.expiresAt).getTime() <= now ||
      row.authenticatedAt > now || row.authenticatedAt + 86_400_000 <= now ||
      (identity.accountId && !roleAtLeast(resolveAccountRoleRow(db, identity.userId, identity.accountId), identity.minRole ?? "viewer"))) {
    throw new Error("Stream authorization revoked");
  }
  }).deferred();
}

/** Publish only after committing the authoritative DB change. Cleanup failures cannot reopen access. */
export function revokeAuthStreams(match: StreamRevocation): void {
  for (const stream of [...streams]) {
    if (Object.entries(match).every(([key, value]) => stream.identity[key as keyof AuthStreamIdentity] === value)) stream.close();
  }
}
export function registerAuthStream(identity: AuthStreamIdentity, cleanup: () => void | Promise<void>) {
  let closed = false;
  let checking = false;
  const close = () => {
    if (closed) return;
    closed = true;
    clearInterval(liveness);
    clearTimeout(expiry);
    streams.delete(entry);
    // Stop delivery/timers synchronously even if resource disposal fails.
    try { void Promise.resolve(cleanup()).catch(() => {}); } catch { /* DB checks remain authoritative. */ }
  };
  const entry: Entry = { identity, close };
  const liveness = setInterval(() => {
    if (checking || closed) return;
    checking = true;
    void assertStreamAuthorized(identity).catch(close).finally(() => { checking = false; });
  }, 5_000);
  const expiry = setTimeout(close, Math.max(0, Math.min(identity.expiresAt, identity.authenticatedAt + 86_400_000) - Date.now()));
  liveness.unref?.(); expiry.unref?.();
  streams.add(entry);
  return { close, get closed() { return closed; } };
}
