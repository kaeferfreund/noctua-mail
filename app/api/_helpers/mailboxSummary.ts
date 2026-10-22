import { NextResponse } from "next/server";
import { requireActiveUserSession } from "@/lib/auth";
import { resolveAccountRole } from "@/lib/accountAccess";
import { getMailboxSummaries } from "@/lib/serverDb";

type SummarySession = {
  userId: string;
  activeAccountId?: string | null;
  responseHeaders?: Headers;
};

/** Transitional selected-account route still rechecks current membership. */
export async function summaryAccountIds(session: SummarySession): Promise<string[]> {
  const accountId = session.activeAccountId;
  return accountId && await resolveAccountRole(session.userId, accountId) ? [accountId] : [];
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
