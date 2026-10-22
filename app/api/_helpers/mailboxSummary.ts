import { NextResponse } from "next/server";
// feat/team-auth: import requireActiveUserSession directly when its async guard lands.
import { requireSessionOr401 as requireActiveUserSession } from "@/lib/auth";
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
