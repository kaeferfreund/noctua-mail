import { NextResponse } from "next/server";
import { requireSessionOr401 } from "@/lib/auth";
import { getMailboxSummaries } from "@/lib/serverDb";

export function createMailboxSummaryHandler(deps = { requireSessionOr401, getMailboxSummaries }) {
  return async (request: Request) => {
    const session = deps.requireSessionOr401(request);
    if (session instanceof NextResponse) return session;
    // feat/team-auth will replace this with the caller's accessible mailbox ids.
    const accounts = await deps.getMailboxSummaries(session.accountId ? [session.accountId] : []);
    return NextResponse.json({ accounts }, { headers: { "Cache-Control": "no-store" } });
  };
}
