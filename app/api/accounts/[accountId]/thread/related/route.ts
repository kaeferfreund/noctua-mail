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
import { listThreadMessages, listThreadMessageWindow, ThreadWindowCursorError } from "@/lib/db";
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
    /** Bounded reader window over exactly one thread (headers only). */
    window?: {
      anchorMessageId?: string;
      cursor?: string;
      before?: number;
      after?: number;
      pageSize?: number;
      /** Only rows of this folder. */
      folderId?: string;
    };
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
  const windowRequest =
    payload.window && typeof payload.window === "object" ? payload.window : null;
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
    const enrich = async (items: Message[], includeSuggestions = true) => {
      await enrichMessagesWithThreadTopics(items, {
        accountId: context.accountId,
        accountEmail: getOwnAddresses(context.account),
        includeSuggestions
      });
      await enrichMessagesWithThreadCollab(items, { accountId: context.accountId });
    };

    if (windowRequest) {
      if (threadIds.length !== 1) {
        return NextResponse.json(
          { ok: false, message: "A thread window needs exactly one threadId" },
          { status: 400 }
        );
      }
      try {
        const data = await listThreadMessageWindow({
          accountId: context.accountId,
          threadId: threadIds[0],
          anchorMessageId:
            typeof windowRequest.anchorMessageId === "string" ? windowRequest.anchorMessageId : null,
          cursor: typeof windowRequest.cursor === "string" ? windowRequest.cursor : null,
          before: windowRequest.before,
          after: windowRequest.after,
          pageSize: windowRequest.pageSize,
          excludeFolderIds,
          folderId: typeof windowRequest.folderId === "string" ? windowRequest.folderId.trim() || null : null,
          groupBy,
          threadDateSource
        });
        // Every row of the window shares the thread's suggestions: only the anchor row
        // carries them, which keeps header rows small, and a cursor page reuses those.
        const firstWindow = typeof windowRequest.cursor !== "string" || !windowRequest.cursor;
        await enrich(data.items, firstWindow);
        for (const item of data.items) {
          if (item.id !== data.window.anchorId) delete item.topicSuggestions;
        }
        return compressedJsonResponse(request, data);
      } catch (error) {
        if (error instanceof ThreadWindowCursorError) {
          return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
        }
        throw error;
      }
    }

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
