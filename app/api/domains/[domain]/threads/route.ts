import { NextResponse } from "next/server";
import { requireActiveUserSession, withAuthResponse } from "@/lib/auth";
import { compressedJsonResponse } from "@/app/api/_helpers/compressedJson";
import { rejectOverlongSearchQuery } from "@/app/api/_helpers/searchQueryLength";
import { errorResponse } from "@/app/api/_helpers/response";
import { enrichMessagesWithThreadTopics } from "@/app/api/_helpers/enrichMessagesWithThreadTopics";
import { enrichMessagesWithThreadCollab } from "@/app/api/_helpers/enrichMessagesWithThreadCollab";
import { clampThreadListPageSize, slimThreadListItem } from "@/app/api/_helpers/threadList";
import { listDomainThreads, listReadableDomainAccounts } from "@/lib/domainConversations";
import { normalizeDomainKey, parseDomainFolderRole } from "@/lib/domainView";
import { getOwnAddresses } from "@/lib/ownAddresses";
import { normalizeThreadDateSource } from "@/lib/threadDate";

type DomainRouteParams = { params: Promise<Record<string, string | string[] | undefined>> };

/**
 * Combined thread list of the mailboxes of one domain („Sammler“). Only
 * mailboxes the signed-in user may open take part; a domain without any
 * answers 404, like an unknown one.
 */
export async function GET(request: Request, { params }: DomainRouteParams) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const overlong = rejectOverlongSearchQuery(query);
  if (overlong) return overlong;
  const raw = (await params).domain;
  const domain = normalizeDomainKey(typeof raw === "string" ? decodeURIComponent(raw) : null);
  if (!domain) return errorResponse("Invalid domain", 400);
  const session = await requireActiveUserSession(request);
  if (session instanceof Response) return session;
  return withAuthResponse(session, async () => {
    const accounts = await listReadableDomainAccounts(session.userId, domain);
    if (accounts.length === 0) return NextResponse.json({ ok: false, message: "Not found" }, { status: 404 });
    const role = parseDomainFolderRole(searchParams.get("role"));
    const data = await listDomainThreads({
      accounts,
      role,
      page: Number(searchParams.get("page") ?? "1") || 1,
      pageSize: clampThreadListPageSize(searchParams.get("pageSize")),
      groupBy: searchParams.get("groupBy") ?? "date",
      threadDateSource: normalizeThreadDateSource(searchParams.get("threadDateSource")),
      query,
      fields: searchParams.get("fields")?.split(",").filter(Boolean) ?? [],
      viewerUserId: session.userId
    });
    for (const account of accounts) {
      const items = data.items.filter((item) => item.accountId === account.id);
      if (items.length === 0) continue;
      await enrichMessagesWithThreadTopics(items, {
        accountId: account.id,
        accountEmail: getOwnAddresses(account),
        includeSuggestions: false
      });
      await enrichMessagesWithThreadCollab(items, { accountId: account.id });
    }
    return compressedJsonResponse(request, {
      domain,
      role,
      accounts: accounts.map((account) => account.id),
      folders: data.folders,
      items: data.items.map(slimThreadListItem),
      groups: data.groups,
      total: data.total,
      baseCount: data.baseCount,
      hasMore: data.hasMore
    });
  });
}
