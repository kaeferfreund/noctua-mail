import { enrichMessagesWithThreadCollab } from "@/app/api/_helpers/enrichMessagesWithThreadCollab";
import { withAuthResponse } from "@/lib/auth";
import { NextResponse } from "next/server";
import { enrichMessagesWithThreadTopics } from "@/app/api/_helpers/enrichMessagesWithThreadTopics";
import { rejectOverlongSearchQuery } from "@/app/api/_helpers/searchQueryLength";
import { ensureMessageSourceSizes, listMessages } from "@/lib/db";
import { normalizeMessageListSortBy } from "@/lib/messageListSort";
import { requireAccountAccessOr403, requireActiveUserSession } from "@/lib/auth";

type ListMessagesHandlerOptions = {
  defaultQuery?: string | null;
  accountId?: string | null;
};

export async function handleListMessagesRequest(
  request: Request,
  options?: ListMessagesHandlerOptions
) {
  const { searchParams } = new URL(request.url);
  // Cap the search input before any auth / DB work so pathological queries are
  // bounced without touching the account lookup.
  const query = searchParams.get("q") ?? options?.defaultQuery ?? null;
  const overlong = rejectOverlongSearchQuery(query);
  if (overlong) return overlong;
  const session = await requireActiveUserSession(request);
  if (session instanceof NextResponse) return session;
  return withAuthResponse(session, async () => {
    const accountId = options?.accountId ?? "";
    const folderId = searchParams.get("folderId");
    const fieldsParam = searchParams.get("fields");
    const fields = fieldsParam ? fieldsParam.split(",").filter(Boolean) : undefined;
    const badgesParam = searchParams.get("badges");
    const badges = badgesParam ? badgesParam.split(",").filter(Boolean) : undefined;
    const excludedFolderIdsParam = searchParams.get("excludeFolderIds");
    const excludedFolderIds = excludedFolderIdsParam
      ? excludedFolderIdsParam.split(",").map((value) => value.trim()).filter(Boolean)
      : undefined;
    const attachmentsOnly = searchParams.get("attachments") === "1";
    const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1);
    const pageSize = Math.max(1, Math.min(1000, Number(searchParams.get("pageSize") ?? 200) || 200));
    const groupBy = searchParams.get("groupBy") ?? "date";
    const sortBy = normalizeMessageListSortBy(searchParams.get("sortBy"));
    if (!accountId) {
      return NextResponse.json({ ok: false, message: "Missing accountId" }, { status: 400 });
    }
    const access = await requireAccountAccessOr403(session, accountId);
    if (access instanceof NextResponse) return access;
    // Rows synced before `sizeBytes` existed have no size and would sink to the
    // bottom of a size-ordered page, so fill them in before the first such query.
    // A failed pass only costs ranking accuracy, so the list still renders.
    if (sortBy === "size") {
      try {
        await ensureMessageSourceSizes(accountId);
      } catch (error) {
        console.error(`[messages] size backfill failed account=${accountId}`, error);
      }
    }
    const data = await listMessages({
      accountId,
      folderId,
      page,
      pageSize,
      query,
      groupBy,
      fields,
      badges,
      viewerUserId: session.userId,
      attachmentsOnly,
      excludedFolderIds,
      sortBy
    });
    await enrichMessagesWithThreadTopics(data.items, { accountId });
    await enrichMessagesWithThreadCollab(data.items, { accountId });
    return NextResponse.json({
      items: data.items,
      groups: data.groups,
      page,
      pageSize,
      total: data.total,
      hasMore: data.hasMore
    });
  });
}
