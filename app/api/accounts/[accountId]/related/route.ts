import { enrichMessagesWithThreadCollab } from "@/app/api/_helpers/enrichMessagesWithThreadCollab";
import { getOwnAddresses } from "@/lib/ownAddresses";
import { withAuthResponse } from "@/lib/auth";
import { NextResponse } from "next/server";
import { compressedJsonResponse } from "@/app/api/_helpers/compressedJson";
import { getAccountIdFromParams, requireAccountContext, type AccountRouteParams } from "@/app/api/_helpers/accountContext";
import { enrichMessagesWithThreadTopics } from "@/app/api/_helpers/enrichMessagesWithThreadTopics";
import { listRelatedMessages } from "@/lib/db";

export async function GET(request: Request, { params }: AccountRouteParams) {
  const { searchParams } = new URL(request.url);
  const accountId = await getAccountIdFromParams(params);
  const relatedId = searchParams.get("relatedId");
  if (!accountId || !relatedId) {
    return NextResponse.json(
      { ok: false, message: "Missing accountId or relatedId" },
      { status: 400 }
    );
  }
  const context = await requireAccountContext(request, accountId, {
    minRole: "viewer",
    missingAccountMessage: "Missing accountId or relatedId"
  });
  if (context instanceof NextResponse) return context;
  return withAuthResponse(context, async () => {
    const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
    const pageSize = Math.max(1, Math.min(1000, Number(searchParams.get("pageSize") ?? "300") || 300));
    const groupBy = searchParams.get("groupBy") ?? "date";
    const badges = searchParams.get("badges")?.split(",").filter(Boolean);
    const excludedFolderIdsParam = searchParams.get("excludeFolderIds");
    const excludedFolderIds = excludedFolderIdsParam
      ? excludedFolderIdsParam.split(",").map((value) => value.trim()).filter(Boolean)
      : undefined;
    const attachmentsOnly = searchParams.get("attachments") === "1";

    const data = await listRelatedMessages({
      accountId: context.accountId,
      relatedId,
      page,
      pageSize,
      groupBy,
      badges,
      viewerUserId: context.session.userId,
      attachmentsOnly,
      excludedFolderIds
    });
    await enrichMessagesWithThreadTopics(data.items, {
      accountId: context.accountId,
      accountEmail: getOwnAddresses(context.account),
      includeSuggestions: true
    });

    await enrichMessagesWithThreadCollab(data.items, { accountId: context.accountId });

    return compressedJsonResponse(request, {
      items: data.items,
      groups: data.groups,
      total: data.total,
      baseCount: data.baseCount,
      hasMore: data.hasMore,
      relatedSubject: data.relatedSubject
    });
  });
}
