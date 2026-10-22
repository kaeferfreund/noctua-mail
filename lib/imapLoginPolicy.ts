import type { Database } from "bun:sqlite";
import type { Account } from "./data";
import { mapAccountRow } from "./db/rowParsers";
import { readGeneration, AuthPolicyError } from "./db/authPolicy";
import { verifyImapCredentials } from "./mail/imapAuth";
import { updateMailboxCredentials } from "./mailboxCredentials";
import { createRateLimiter, getRequestIp } from "./rateLimit";
import { getRequestClientId } from "../app/api/_helpers/clientId";

const attempts = createRateLimiter({ windowMs: 60000, max: 5 });
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
  writeBack = false, verify = verifyImapCredentials) {
  if (!password || password.length > 256) throw new AuthPolicyError("invalid_credentials", 401);
  const account = eligibleImapLoginMailbox(db, userId);
  const ip = getRequestIp(request);
  const checkSnapshot = () => {
    if (JSON.stringify(eligibleImapLoginMailbox(db, userId)) !== JSON.stringify(account)) throw new AuthPolicyError("invalid_credentials", 401);
  };
  const limitedVerify: typeof verify = async (...args) => {
    if (attempts.isLimited(`ip:${ip}`) || attempts.isLimited(`user:${userId}`)) throw new AuthPolicyError("invalid_credentials", 401);
    if (!await verify(...args)) throw new AuthPolicyError("invalid_credentials", 401);
    checkSnapshot();
    return true;
  };
  if (writeBack) await updateMailboxCredentials(account.id, { imap: { password } },
    { userId, clientId: getRequestClientId(request) }, { imap: limitedVerify,
      smtp: async () => { throw new Error("IMAP login cannot change SMTP endpoint"); },
      authorize: checkSnapshot
    }, db);
  else await limitedVerify(account, password, getRequestClientId(request));
  return true;
}
