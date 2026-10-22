import { NextResponse } from "next/server";
import * as auth from "@/lib/auth";
import { getMailboxSummaries } from "@/lib/serverDb";

type SummarySession = {
  userId: string;
  accountId?: string | null;
  activeAccountId?: string | null;
  responseHeaders?: Headers;
};

/** feat/team-auth/collab-ui replace this seam with listAccessibleAccountsForUser. */
export async function summaryAccountIds(session: SummarySession): Promise<string[]> {
  const accountId = session.activeAccountId ?? session.accountId;
  return accountId ? [accountId] : [];
}

type Dependencies = {
  requireActiveUserSession: (request: Request) => SummarySession | Response | Promise<SummarySession | Response>;
  getMailboxSummaries: typeof getMailboxSummaries;
  summaryAccountIds?: typeof summaryAccountIds;
};

// Detect exports once: feat/team-auth removes the synchronous guard on merge.
// A namespace lookup keeps this module valid on either side of that merge.
export function mailboxSummarySessionGuard(exports: {
  requireActiveUserSession?: Dependencies["requireActiveUserSession"];
  requireSessionOr401?: Dependencies["requireActiveUserSession"];
}): Dependencies["requireActiveUserSession"] {
  const guard = exports.requireActiveUserSession ?? exports.requireSessionOr401;
  if (!guard) throw new Error("Mailbox summaries require an active session guard");
  return async request => await guard(request);
}
const requireActiveUserSession = mailboxSummarySessionGuard(auth);

export function createMailboxSummaryHandler(deps: Dependencies = { requireActiveUserSession, getMailboxSummaries }) {
  return async (request: Request) => {
    const session = await deps.requireActiveUserSession(request);
    if (session instanceof Response) return session;
    const ids = await (deps.summaryAccountIds ?? summaryAccountIds)(session);
    const accounts = ids.length ? await deps.getMailboxSummaries(ids) : [];
    const headers = new Headers(session.responseHeaders);
    headers.set("Cache-Control", "no-store");
    return NextResponse.json({ accounts }, { headers });
  };
}
