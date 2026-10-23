import { getOwnAddresses } from "@/lib/ownAddresses";
import { requireJsonSameOrigin } from "@/app/api/_helpers/requestOrigin";
import { enrichMessagesWithThreadCollab } from "@/app/api/_helpers/enrichMessagesWithThreadCollab";
import { withAuthResponse } from "@/lib/auth";
import { NextResponse } from "next/server";
import { compressedJsonResponse } from "@/app/api/_helpers/compressedJson";
import {
  getAccountIdFromParams,
  requireAccountContext,
  type AccountRouteParams
} from "@/app/api/_helpers/accountContext";
import { enrichMessagesWithThreadTopics } from "@/app/api/_helpers/enrichMessagesWithThreadTopics";
import { listThreadMessages } from "@/lib/db";
import { normalizeThreadDateSource } from "@/lib/threadDate";
import type { Message } from "@/lib/data";

export async function POST(request: Request, { params }: AccountRouteParams) {
  const originError = requireJsonSameOrigin(request); if (originError) return originError;
  const payload = (await request.json()) as {
    accountId?: string;
    threadIds?: string[];
    messageIds?: string[];
    groupBy?: string;
    threadDateSource?: string;
    /** `headers` omits body/htmlBody (read per message from the detail route). */
    projection?: string;
    excludeFolderIds?: string[];
  };
  const accountId = await getAccountIdFromParams(params);
  const threadIds = Array.isArray(payload.threadIds)
    ? payload.threadIds.map((value) => value.trim()).filter(Boolean)
    : [];
  const messageIds = Array.isArray(payload.messageIds)
    ? payload.messageIds.map((value) => value.trim()).filter(Boolean)
    : [];
  const excludeFolderIds = Array.isArray(payload.excludeFolderIds)
    ? payload.excludeFolderIds
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean)
    : [];
  const projection = payload.projection === "headers" ? "headers" : "full";

  const context = await requireAccountContext(request, accountId, {
    minRole: "viewer",
    missingAccountMessage: "Missing accountId or threadIds/messageIds"
  });
  if (context instanceof NextResponse) return context;
  return withAuthResponse(context, async () => {
    if (threadIds.length === 0 && messageIds.length === 0) {
      return NextResponse.json(
        { ok: false, message: "Missing accountId or threadIds/messageIds" },
        { status: 400 }
      );
    }
    const groupBy = payload.groupBy ?? "date";
    const threadDateSource = normalizeThreadDateSource(payload.threadDateSource);
    const enrich = async (items: Message[]) => {
      await enrichMessagesWithThreadTopics(items, {
        accountId: context.accountId,
        accountEmail: getOwnAddresses(context.account),
        includeSuggestions: true
      });
      await enrichMessagesWithThreadCollab(items, { accountId: context.accountId });
    };

    const data = await listThreadMessages({
      accountId: context.accountId,
      threadIds,
      messageIds,
      groupBy,
      threadDateSource,
      projection,
      excludeFolderIds
    });
    await enrich(data.items);

    return compressedJsonResponse(request, { items: data.items });
  });
}
