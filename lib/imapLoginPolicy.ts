import type { Database } from "bun:sqlite";
import type { Account } from "./data";
import { mapAccountRow } from "./db/rowParsers";
import { readGeneration, AuthPolicyError } from "./db/authPolicy";
import { verifyImapCredentials } from "./mail/imapAuth";
import { updateMailboxCredentials } from "./mailboxCredentials";
import { createFailureLimiter, getRequestIp } from "./rateLimit";
import { getRequestClientId } from "../app/api/_helpers/clientId";
import { parseIpv6 } from "./net/urlSafety";

/**
 * Only failed IMAP verifications count. Per source (IPv4 address, IPv6 /64)
 * they stop password guessing from one client; the user-wide budget is a high
 * emergency brake against guessing spread over many sources. The emergency
 * brake never applies to a source that already signed in successfully as this
 * user, so anonymous failures cannot lock the real user out of a known device
 * or network (CF-12). Sign-in and re-authentication of a signed-in session use
 * separate buckets.
 */
const sourceFailures = createFailureLimiter({ windowMs: 60_000, max: 5 });
const userFailures = createFailureLimiter({ windowMs: 15 * 60_000, max: 50 });

/**
 * Rate-limit bucket of a client address: one IPv6 /64 (a client usually holds
 * the whole prefix and can rotate addresses in it), IPv4-mapped IPv6 as IPv4,
 * anything else as given.
 */
export function loginSourceBucket(ip: string): string {
  const value = ip.trim().replace(/^\[(.*)\]$/, "$1");
  if (!value.includes(":")) return value;
  const bytes = parseIpv6(value);
  if (!bytes) return value;
  if (bytes.slice(0, 10).every((byte) => byte === 0) && bytes[10] === 0xff && bytes[11] === 0xff) {
    return bytes.slice(12).join(".");
  }
  const prefix = [0, 2, 4, 6].map((index) => ((bytes[index] << 8) | bytes[index + 1]).toString(16));
  return `${prefix.join(":")}::/64`;
}

const KNOWN_SOURCE_TTL_MS = 30 * 24 * 60 * 60_000;
const KNOWN_SOURCES_PER_USER = 16;
const KNOWN_SOURCE_USERS = 10_000;
/** userId → source bucket → expiry. Only a correct password adds entries. */
const knownSources = new Map<string, Map<string, number>>();

function isKnownSource(userId: string, bucket: string, now = Date.now()) {
  const expiresAt = knownSources.get(userId)?.get(bucket);
  return expiresAt !== undefined && expiresAt > now;
}

function rememberSource(userId: string, bucket: string, now = Date.now()) {
  const sources = knownSources.get(userId) ?? new Map<string, number>();
  knownSources.delete(userId);
  sources.delete(bucket);
  for (const [key, expiresAt] of sources) if (expiresAt <= now) sources.delete(key);
  while (sources.size >= KNOWN_SOURCES_PER_USER) sources.delete(sources.keys().next().value!);
  sources.set(bucket, now + KNOWN_SOURCE_TTL_MS);
  knownSources.set(userId, sources);
  while (knownSources.size > KNOWN_SOURCE_USERS) knownSources.delete(knownSources.keys().next().value!);
}
export type ImapVerificationScope = "sign-in" | "reauth";
export function imapLoginAvailable(env: NodeJS.ProcessEnv = process.env) {
  return (env.NOCTUA_IMAP_LOGIN_HOSTS ?? "").split(",").some(host => host.trim());
}
const normalized = (value: string) => value.trim().toLowerCase();

/** No request-supplied endpoint and no first-link fallback. Recheck after network and at write commit. */
export function eligibleImapLoginMailbox(db: Database, userId: string): Account {
  const hosts = new Set((process.env.NOCTUA_IMAP_LOGIN_HOSTS ?? "").split(",").map(normalized).filter(Boolean));
  if (!hosts.size) throw new AuthPolicyError("invalid_credentials", 401);
  readGeneration(db, userId);
  const user = db.prepare(`SELECT u.email FROM auth_user u JOIN users p ON p.id=u.id WHERE u.id=?`).get(userId);
  if (!user) throw new AuthPolicyError("invalid_credentials", 401);
  const candidates = db.prepare(`SELECT a.* FROM accounts a WHERE ownerUserId=?`).all(userId).map(mapAccountRow).filter(account => {
    const members = db.prepare(`SELECT COUNT(DISTINCT userId) n FROM
      (SELECT userId FROM user_accounts WHERE accountId=? UNION SELECT ownerUserId FROM accounts WHERE id=? AND ownerUserId IS NOT NULL)`).get(account.id, account.id).n;
    return normalized(account.email) === normalized(user.email) && normalized(account.imap.user) === normalized(user.email) &&
      account.imap.secure === true && hosts.has(normalized(account.imap.host)) && members <= 1;
  });
  if (candidates.length !== 1) throw new AuthPolicyError("invalid_credentials", 401);
  return candidates[0];
}

export async function verifyEligibleImap(db: Database, userId: string, password: string, request: Request,
  writeBack = false, verify = verifyImapCredentials, scope: ImapVerificationScope = "sign-in") {
  if (!password || password.length > 256) throw new AuthPolicyError("invalid_credentials", 401);
  const account = eligibleImapLoginMailbox(db, userId);
  const ip = getRequestIp(request);
  const checkSnapshot = () => {
    if (JSON.stringify(eligibleImapLoginMailbox(db, userId)) !== JSON.stringify(account)) throw new AuthPolicyError("invalid_credentials", 401);
  };
  const source = loginSourceBucket(ip);
  const sourceKey = `${scope}:ip:${source}`;
  const userKey = `${scope}:user:${userId}`;
  const limitedVerify: typeof verify = async (...args) => {
    if (sourceFailures.isBlocked(sourceKey)) throw new AuthPolicyError("invalid_credentials", 401);
    if (userFailures.isBlocked(userKey) && !isKnownSource(userId, source)) throw new AuthPolicyError("invalid_credentials", 401);
    // Only "ok" accepts: "invalid" and "unreachable" are truthy strings. Both keep the generic
    // answer and count against the budgets as before, so sign-in reveals no IMAP login mailbox.
    const check = await verify(...args);
    if (check !== "ok") {
      sourceFailures.recordFailure(sourceKey);
      userFailures.recordFailure(userKey);
      throw new AuthPolicyError("invalid_credentials", 401);
    }
    checkSnapshot();
    rememberSource(userId, source);
    return check;
  };
  if (writeBack) await updateMailboxCredentials(account.id, { imap: { password } },
    { userId, clientId: getRequestClientId(request) }, { imap: limitedVerify,
      smtp: async () => { throw new Error("IMAP login cannot change SMTP endpoint"); },
      authorize: checkSnapshot
    }, db);
  else await limitedVerify(account, password, getRequestClientId(request));
  return true;
}
