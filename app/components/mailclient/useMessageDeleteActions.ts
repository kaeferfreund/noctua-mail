"use client";

import { useTranslations } from "next-intl";

import type React from "react";
import { useCallback } from "react";
import {
  buildAccountMessageActionPath,
  buildAccountMessagesActionPath
} from "@/lib/accountApiPaths";
import type { Folder, Message } from "@/lib/data";
import type { DeleteConfirmAction, DeleteConfirmState } from "./types";
import type { LinkedCalendarEventDetail } from "./utils/deleteConfirm";
import type { SelectionStore } from "./messagelist/selectionStore";
import { nextMessageAfterRemoval, type ContinueAfterRemoval } from "./messagelist/successfulRemoval";
import { resolveCollapsedThreadSelectionTarget } from "./messagelist/listSelection";
import type { MoveMessagesToFolder, UndoMoveTarget } from "./useMessageMoveActions";
import {
  collectDeleteConfirmEventUids,
  summarizeDeleteCalendarAssociations
} from "./utils/deleteConfirm";
import {
  getMessageSubjectForNotice,
  pruneDetachedCrossFolderThreadMessages
} from "./utils/messageMutation";
import { decrementGroupMetaForMessages } from "./utils/messageHelpers";
import type { MessageGroupMeta } from "./messagelist/listModel";
import {
  findTrashFolderIdForAccount,
  isPermanentDeleteTarget as isPermanentDeleteTargetPure
} from "./utils/trashFolder";

const getThreadKey = (item: Message) => item.threadId ?? item.messageId ?? item.id;

export function resolveDeleteTargets(params: {
  message: Message;
  allowThreadDeletion: boolean;
  supportsThreads: boolean;
  collapsedThreads: Record<string, boolean>;
  threadScopeMessages: Message[];
  activeAccountId: string;
}): { targets: Message[]; kind: "thread" | "message" } {
  const threadId = getThreadKey(params.message);
  const threadItems = params.supportsThreads
    ? params.threadScopeMessages.filter(
        (item) =>
          item.accountId === params.activeAccountId && getThreadKey(item) === threadId
      )
    : [];
  // Threads absent from the map (e.g. topic-suggestion threads) render
  // collapsed by default, so missing entries count as collapsed here too.
  const isCollapsedThread =
    params.allowThreadDeletion &&
    params.supportsThreads &&
    (params.collapsedThreads[threadId] ?? true) &&
    threadItems.length > 1;
  return isCollapsedThread
    ? { targets: threadItems, kind: "thread" }
    : { targets: [params.message], kind: "message" };
}

type DeleteResponse = {
  action: "deleted" | "moved";
  trashFolderId?: string | null;
  messageId?: string;
  previousMessageId?: string;
};

type BulkDeleteResponse = {
  action: "deleted";
  deleted?: number;
  deletedIds?: string[];
};

type DeleteNoticeInput = {
  type: "success";
  title: string;
  description?: string;
  actionKind?: "undo";
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number | null;
};

type DeleteAssociationLookupResponse = {
  reminders?: Array<{
    id?: string;
    messageId?: string | null;
    eventUid?: string | null;
    isFuture?: boolean;
  }>;
  events?: Array<{
    id?: string;
    eventUid?: string | null;
    summary?: string | null;
    location?: string | null;
    allDay?: boolean;
    startTimezone?: string | null;
    isRecurring?: boolean;
    isMessageSpecificOccurrence?: boolean;
    occurrenceStartAtMs?: number;
    occurrenceEndAtMs?: number;
    isFuture?: boolean;
  }>;
};

type UseMessageDeleteActionsOptions = {
  continueAfterRemoval?: ContinueAfterRemoval;
  getNavigationRows?: () => Message[];
  activeAccountId: string;
  activeMessageId: string;
  supportsThreads: boolean;
  collapsedThreads: Record<string, boolean>;
  includeFlaggedGroup: boolean;
  searchScope: "folder" | "all";
  activeFolderId: string;
  includeThreadAcrossFoldersForList: boolean;
  folders: Folder[];
  messages: Message[];
  threadScopeMessages: Message[];
  visibleMessages: Array<{ message: Message; threadId: string }>;
  sortedMessages: Message[];
  isFlaggedMessage: (message: Message) => boolean;
  isTrashFolder: (folderId?: string | null) => boolean;
  moveMessagesToFolder: MoveMessagesToFolder;
  selectionStore: SelectionStore;
  lastSelectedIdRef: React.MutableRefObject<string | null>;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setGroupMeta: React.Dispatch<React.SetStateAction<MessageGroupMeta[]>>;
  shouldKeepMessageInResults?: (message: Message) => boolean;
  setPendingMessageActions: React.Dispatch<React.SetStateAction<Set<string>>>;
  setActiveMessageId: React.Dispatch<React.SetStateAction<string>>;
  setViewMessage: (message: Message | null) => void;
  refreshFolders: () => Promise<unknown>;
  apiFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  readErrorMessage: (res: Response) => Promise<string>;
  reportError: (message: string) => void;
  pushNotice: (input: DeleteNoticeInput) => void;
  confirmDelete: (input: DeleteConfirmState) => Promise<DeleteConfirmAction>;
  undoMoveOperation: (
    targets: UndoMoveTarget[],
    accountId: string,
    successTitle?: string
  ) => Promise<void>;
  noticeSuccessTimeout: number;
  onMessagesRemoved?: (messageIds: string[]) => void;
  markMessagesMutated?: () => void;
  markDeleteReconcileSuppression?: (targets: Message[]) => void;
};

export function useMessageDeleteActions({
  continueAfterRemoval,
  getNavigationRows,
  activeAccountId,
  activeMessageId,
  supportsThreads,
  collapsedThreads,
  includeFlaggedGroup,
  searchScope,
  activeFolderId,
  includeThreadAcrossFoldersForList,
  folders,
  messages,
  threadScopeMessages,
  visibleMessages,
  sortedMessages,
  isFlaggedMessage,
  isTrashFolder,
  moveMessagesToFolder,
  selectionStore,
  lastSelectedIdRef,
  setMessages,
  setGroupMeta,
  shouldKeepMessageInResults,
  setPendingMessageActions,
  setActiveMessageId,
  setViewMessage,
  refreshFolders,
  apiFetch,
  readErrorMessage,
  reportError,
  pushNotice,
  confirmDelete,
  undoMoveOperation,
  noticeSuccessTimeout,
  onMessagesRemoved,
  markMessagesMutated,
  markDeleteReconcileSuppression
}: UseMessageDeleteActionsOptions) {
  const tn = useTranslations("Notifications");
  const isPermanentDeleteTarget = useCallback(
    (target: Message, trashFolderId: string | null) =>
      isPermanentDeleteTargetPure(target, trashFolderId, isTrashFolder),
    [isTrashFolder]
  );

  const clearSelectionState = useCallback(() => {
    selectionStore.clearSelection();
    lastSelectedIdRef.current = null;
  }, [lastSelectedIdRef, selectionStore]);

  const findTrashFolderId = useCallback(
    () => findTrashFolderIdForAccount(folders, activeAccountId),
    [activeAccountId, folders]
  );

  const buildDeleteConfirmState = useCallback(
    async (
      targets: Message[],
      kind: DeleteConfirmState["kind"]
    ): Promise<DeleteConfirmState> => {
      const trashFolderId = findTrashFolderId();
      const permanentDeleteCount = targets.filter((target) =>
        isPermanentDeleteTarget(target, trashFolderId)
      ).length;
      const eventUids = collectDeleteConfirmEventUids(targets);
      let calendarLinkedMessageCount = 0;
      let calendarLinkedReminderCount = 0;
      let calendarLinkedReminderFutureCount = 0;
      let calendarLinkedReminderPastCount = 0;
      let calendarLinkedEventCount = 0;
      let calendarLinkedEventFutureCount = 0;
      let calendarLinkedEventPastCount = 0;
      let linkedReminderIds: string[] = [];
      let linkedEventIds: string[] = [];
      let linkedEvents: LinkedCalendarEventDetail[] = [];

      if (targets.length > 0) {
        try {
          const res = await apiFetch(
            buildAccountMessagesActionPath(activeAccountId, "delete/associations"),
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                messageIds: targets.map((target) => target.id),
                eventUids
              })
            }
          );
          if (res.ok) {
            const data = (await res.json()) as DeleteAssociationLookupResponse;
            const summary = summarizeDeleteCalendarAssociations(targets, {
              reminders: (data.reminders ?? []).flatMap((item) =>
                item.id
                  ? [
                      {
                        id: item.id,
                        messageId: item.messageId,
                        eventUid: item.eventUid,
                        isFuture: Boolean(item.isFuture)
                      }
                    ]
                  : []
              ),
              events: (data.events ?? []).flatMap((item) =>
                item.id
                  ? [
                      {
                        id: item.id,
                        eventUid: item.eventUid,
                        summary: item.summary,
                        location: item.location,
                        allDay: item.allDay,
                        startTimezone: item.startTimezone,
                        isRecurring: item.isRecurring,
                        isMessageSpecificOccurrence: item.isMessageSpecificOccurrence,
                        occurrenceStartAtMs: item.occurrenceStartAtMs,
                        occurrenceEndAtMs: item.occurrenceEndAtMs,
                        isFuture: Boolean(item.isFuture)
                      }
                    ]
                  : []
              )
            });
            calendarLinkedMessageCount = summary.linkedMessageCount;
            calendarLinkedReminderCount = summary.linkedReminderCount;
            calendarLinkedReminderFutureCount = summary.linkedReminderFutureCount;
            calendarLinkedReminderPastCount = summary.linkedReminderPastCount;
            calendarLinkedEventCount = summary.linkedEventCount;
            calendarLinkedEventFutureCount = summary.linkedEventFutureCount;
            calendarLinkedEventPastCount = summary.linkedEventPastCount;
            linkedEvents = summary.linkedEvents;
            linkedReminderIds = Array.from(
              new Set((data.reminders ?? []).flatMap((item) => (item.id ? [item.id] : [])))
            );
            linkedEventIds = Array.from(
              new Set((data.events ?? []).flatMap((item) => (item.id ? [item.id] : [])))
            );
          }
        } catch {
          // Ignore lookup failures and preserve the default delete flow.
        }
      }

      return {
        kind,
        messageCount: targets.length,
        moveToTrashCount: targets.length - permanentDeleteCount,
        permanentDeleteCount,
        calendarLinkedMessageCount,
        calendarLinkedReminderCount,
        calendarLinkedReminderFutureCount,
        calendarLinkedReminderPastCount,
        calendarLinkedEventCount,
        calendarLinkedEventFutureCount,
        calendarLinkedEventPastCount,
        linkedReminderIds,
        linkedEventIds,
        linkedEvents
      };
    },
    [activeAccountId, apiFetch, findTrashFolderId, isPermanentDeleteTarget]
  );

  const deleteLinkedCalendarAssociations = useCallback(
    async (deleteConfirm: DeleteConfirmState) => {
      if (deleteConfirm.linkedReminderIds.length === 0 && deleteConfirm.linkedEventIds.length === 0) {
        return;
      }
      const res = await apiFetch(
        buildAccountMessagesActionPath(activeAccountId, "delete/linked-calendar"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reminderIds: deleteConfirm.linkedReminderIds,
            eventIds: deleteConfirm.linkedEventIds
          })
        }
      );
      if (!res.ok) {
        const errorMessage = await readErrorMessage(res);
        throw new Error(errorMessage || tn("deleteCalendarFailed"));
      }
    },
    [activeAccountId, apiFetch, readErrorMessage, tn]
  );

  const deleteSingleMessagePermanently = useCallback(
    async (target: Message) => {
      const res = await apiFetch(buildAccountMessageActionPath(activeAccountId, target.id, "delete"), {
        method: "POST"
      });
      if (!res.ok) {
        const errorMessage = await readErrorMessage(res);
        throw new Error(errorMessage || tn("deleteFailed"));
      }
      const data = (await res.json()) as DeleteResponse;
      const movedMessageId = data.messageId ?? target.id;
      markMessagesMutated?.();
      // `removedFromList` is populated by the setMessages updater (reads
      // `prev`, the authoritative latest state) and consumed by the
      // setGroupMeta updater queued right after. Both updaters run in
      // order within the same React batch, so the closure is reliable
      // even when the surrounding handler is async.
      let removedFromList: Message[] = [];
      setMessages((prev) => {
        let next: Message[];
        if (data.action === "deleted" || !data.trashFolderId) {
          next = pruneDetachedCrossFolderThreadMessages(
            prev.filter((item) => item.id !== target.id),
            {
              searchScope,
              activeFolderId,
              includeThreadAcrossFoldersForList
            }
          );
        } else if (data.action === "moved") {
          if (!(searchScope === "all" && data.trashFolderId)) {
            next = pruneDetachedCrossFolderThreadMessages(
              prev.filter((item) => item.id !== target.id),
              {
                searchScope,
                activeFolderId,
                includeThreadAcrossFoldersForList
              }
            );
          } else {
            const remapped = prev.flatMap((item) => {
              if (item.id !== target.id) return [item];
              const updated = {
                ...item,
                id: movedMessageId,
                folderId: data.trashFolderId!,
                recent: false
              };
              const keep = shouldKeepMessageInResults
                ? shouldKeepMessageInResults(updated)
                : true;
              return keep ? [updated] : [];
            });
            next = pruneDetachedCrossFolderThreadMessages(remapped, {
              searchScope,
              activeFolderId,
              includeThreadAcrossFoldersForList
            });
          }
        } else {
          return prev;
        }
        // In the "scope=all + trash-move" branch above, a kept target is
        // remapped from `target.id` to `movedMessageId`. Resolve before
        // the membership check so a kept-but-renamed row isn't
        // misidentified as removed. Other branches don't remap, so the
        // resolver is a no-op there.
        const resolveId = (id: string) => (id === target.id ? movedMessageId : id);
        const nextIds = new Set(next.map((item) => item.id));
        removedFromList = prev.filter((item) => !nextIds.has(resolveId(item.id)));
        return next;
      });
      setGroupMeta((prev) =>
        removedFromList.length > 0
          ? decrementGroupMetaForMessages(prev, removedFromList)
          : prev
      );
      return data;
    },
    [
      activeAccountId,
      activeFolderId,
      apiFetch,
      includeThreadAcrossFoldersForList,
      markMessagesMutated,
      readErrorMessage,
      searchScope,
      setGroupMeta,
      setMessages,
      shouldKeepMessageInResults, tn
    ]
  );

  const deleteMessagesPermanently = useCallback(
    async (targets: Message[]) => {
      const uniqueIds = Array.from(new Set(targets.map((target) => target.id).filter(Boolean)));
      if (uniqueIds.length === 0) return [] as string[];
      if (uniqueIds.length === 1) {
        const single = targets[0];
        const result = await deleteSingleMessagePermanently(single);
        return result.action === "deleted" ? [single.id] : [];
      }
      const res = await apiFetch(buildAccountMessagesActionPath(activeAccountId, "delete/bulk"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageIds: uniqueIds })
      });
      if (!res.ok) {
        const errorMessage = await readErrorMessage(res);
        throw new Error(errorMessage || tn("deleteManyFailed"));
      }
      const data = (await res.json()) as BulkDeleteResponse;
      const deletedIds = new Set((data.deletedIds ?? []).filter(Boolean));
      markMessagesMutated?.();
      let removedFromList: Message[] = [];
      setMessages((prev) => {
        const next = pruneDetachedCrossFolderThreadMessages(
          prev.filter((item) => !deletedIds.has(item.id)),
          {
            searchScope,
            activeFolderId,
            includeThreadAcrossFoldersForList
          }
        );
        const nextIds = new Set(next.map((item) => item.id));
        removedFromList = prev.filter((item) => !nextIds.has(item.id));
        return next;
      });
      setGroupMeta((prev) =>
        removedFromList.length > 0
          ? decrementGroupMetaForMessages(prev, removedFromList)
          : prev
      );
      return uniqueIds.filter((id) => deletedIds.has(id));
    },
    [
      activeAccountId,
      activeFolderId,
      apiFetch,
      deleteSingleMessagePermanently,
      includeThreadAcrossFoldersForList,
      markMessagesMutated,
      readErrorMessage,
      searchScope,
      setGroupMeta,
      setMessages, tn
    ]
  );

  const pushDeleteNotice = useCallback(
    (
      movedToTrashCount: number,
      permanentlyDeletedCount: number,
      undoTargets: UndoMoveTarget[],
      singleSubject?: string
    ) => {
      if (movedToTrashCount > 0) {
        pushNotice({
          type: "success",
          title: tn("movedTrash", { count: movedToTrashCount }),
          description: permanentlyDeletedCount > 0
            ? tn("deletedPermanentDescription", { count: permanentlyDeletedCount }) : singleSubject,
          actionKind: undoTargets.length > 0 ? "undo" : undefined,
          onAction:
            undoTargets.length > 0
              ? () =>
                  void undoMoveOperation(
                    undoTargets,
                    activeAccountId,
                    tn("restored", { count: undoTargets.length })
                  )
              : undefined,
          durationMs: noticeSuccessTimeout
        });
        return;
      }
      if (permanentlyDeletedCount > 0) {
        pushNotice({
          type: "success",
          title: tn("deletedPermanent", { count: permanentlyDeletedCount }),
          description: permanentlyDeletedCount === 1 ? singleSubject : undefined
        });
      }
    },
    [activeAccountId, noticeSuccessTimeout, pushNotice, undoMoveOperation, tn]
  );

  const resolveDeleteNextActiveId = useCallback(
    (targetIds: Set<string>, threadIdForFallback?: string) => {
      if (!activeMessageId || !targetIds.has(activeMessageId)) {
        return { activeWasDeleted: false, nextActiveId: "" };
      }
      let nextActiveId = nextMessageAfterRemoval(
        visibleMessages.map(item => item.message), targetIds
      )?.id ?? "";
      if (threadIdForFallback && !nextActiveId) {
        const threadRoot = visibleMessages.find(
          (item) => item.threadId === threadIdForFallback
        )?.message.id;
        if (threadRoot && !targetIds.has(threadRoot)) {
          nextActiveId = threadRoot;
        }
      }
      if (!nextActiveId) {
        const fallback = sortedMessages.find((msg) => !targetIds.has(msg.id));
        if (fallback) nextActiveId = fallback.id;
      }
      if (nextActiveId && supportsThreads) {
        const visibleEntry = visibleMessages.find((item) => item.message.id === nextActiveId);
        const threadId = visibleEntry?.threadId;
        if (threadId && (collapsedThreads[threadId] ?? true)) {
          const threadMessages = threadScopeMessages.filter(
            (item) => getThreadKey(item) === threadId && !targetIds.has(item.id)
          );
          if (threadMessages.length > 1) {
            const flat = threadMessages.map((message) => ({ message, depth: 0 }));
            const target =
              threadMessages.find((message) => message.id === nextActiveId) ??
              threadMessages[0];
            const isFlaggedGroupForThread =
              includeFlaggedGroup && threadMessages.some((message) => isFlaggedMessage(message));
            const effective = resolveCollapsedThreadSelectionTarget({
              flat,
              target,
              isFlaggedMessage,
              options: { isFlaggedGroup: isFlaggedGroupForThread }
            });
            nextActiveId = effective.id;
          }
        }
      }
      return { activeWasDeleted: true, nextActiveId };
    },
    [
      activeMessageId,
      collapsedThreads,
      includeFlaggedGroup,
      isFlaggedMessage,
      sortedMessages,
      supportsThreads,
      threadScopeMessages,
      visibleMessages
    ]
  );

  const runDeleteTransaction = useCallback(
    async (
      targets: Message[],
      options: {
        errorMessage: string;
        threadIdForFallback?: string;
        clearSelectionWhenActiveRemains?: boolean;
      }
    ) => {
      if (targets.length === 0) return;
      // The renderer order at the start of the operation (see the continuation below).
      const navigationRows = getNavigationRows?.();
      markDeleteReconcileSuppression?.(targets);
      const targetIds = new Set(targets.map((item) => item.id));
      const { activeWasDeleted, nextActiveId } = resolveDeleteNextActiveId(
        targetIds,
        options.threadIdForFallback
      );
      const singleSubject =
        targets.length === 1 ? getMessageSubjectForNotice(targets[0], tn("noSubject")) : undefined;
      const undoTargets: UndoMoveTarget[] = [];
      let movedToTrashCount = 0;
      let permanentlyDeletedCount = 0;
      const removedIds: string[] = [];
      const trashFolderId = findTrashFolderId();
      const hardDeleteTargets = targets.filter((target) =>
        isPermanentDeleteTarget(target, trashFolderId)
      );
      const moveTargets = targets.filter(
        (target) => !isPermanentDeleteTarget(target, trashFolderId)
      );
      try {
        setPendingMessageActions((prev) => new Set([...prev, ...targets.map((t) => t.id)]));
        if (moveTargets.length > 0) {
          if (!trashFolderId) {
            reportError(tn("trashMissing"));
            return;
          }
          const moveResult = await moveMessagesToFolder(trashFolderId, {
            messageIds: moveTargets.map((target) => target.id),
            showNotice: false,
            clearSelectionOnSuccess: false,
            managePendingState: false,
            updateActiveMessage: false
          });
          if (!moveResult) return;
          movedToTrashCount += moveResult.ids.length;
          undoTargets.push(...moveResult.undoTargets);
          removedIds.push(...moveResult.ids);
        }
        if (hardDeleteTargets.length > 0) {
          const deletedIds = await deleteMessagesPermanently(hardDeleteTargets);
          permanentlyDeletedCount += deletedIds.length;
          removedIds.push(...deletedIds);
        }
        // Keep the operation's renderer order even if the move has already
        // removed its row; the continuation checks the latest reader selection.
        const continued = continueAfterRemoval?.(removedIds, navigationRows) ?? false;
        if (!continueAfterRemoval && activeWasDeleted) {
          if (nextActiveId) {
            const nextActiveMessage = messages.find((m) => m.id === nextActiveId) ?? null;
            setActiveMessageId(nextActiveId);
            setViewMessage(nextActiveMessage);
            selectionStore.setSelection(new Set([nextActiveId]), nextActiveId);
            lastSelectedIdRef.current = nextActiveId;
          } else {
            setActiveMessageId("");
            setViewMessage(null);
            selectionStore.clearSelection();
          }
        } else if (!continued && options.clearSelectionWhenActiveRemains) {
          clearSelectionState();
        }
        await refreshFolders();
        pushDeleteNotice(movedToTrashCount, permanentlyDeletedCount, undoTargets, singleSubject);
        if (onMessagesRemoved && removedIds.length > 0) {
          onMessagesRemoved(removedIds);
        }
      } catch (error) {
        if (error instanceof Error && error.message) {
          reportError(error.message);
        } else {
          reportError(options.errorMessage);
        }
      } finally {
        setPendingMessageActions((prev) => {
          const next = new Set(prev);
          targets.forEach((item) => next.delete(item.id));
          return next;
        });
      }
    },
    [
      continueAfterRemoval,
      getNavigationRows,
      clearSelectionState,
      deleteMessagesPermanently,
      findTrashFolderId,
      isPermanentDeleteTarget,
      lastSelectedIdRef,
      moveMessagesToFolder,
      messages,
      pushDeleteNotice,
      refreshFolders,
      reportError,
      resolveDeleteNextActiveId,
      selectionStore,
      setActiveMessageId,
      setViewMessage,
      setPendingMessageActions,
      onMessagesRemoved,
      markDeleteReconcileSuppression,
      tn
    ]
  );

  const handleDeleteMessage = useCallback(
    async (message: Message, options?: { allowThreadDeletion?: boolean }) => {
      const threadId = getThreadKey(message);
      const { targets, kind } = resolveDeleteTargets({
        message,
        allowThreadDeletion: options?.allowThreadDeletion ?? true,
        supportsThreads,
        collapsedThreads,
        threadScopeMessages,
        activeAccountId
      });
      const deleteConfirm = await buildDeleteConfirmState(targets, kind);
      const requiresDeleteConfirm =
        kind === "thread" ||
        deleteConfirm.calendarLinkedReminderCount > 0 ||
        deleteConfirm.calendarLinkedEventCount > 0;
      if (requiresDeleteConfirm) {
        const action = await confirmDelete(deleteConfirm);
        if (action === "cancel") return;
        if (action === "delete_linked_and_mail") {
          try {
            await deleteLinkedCalendarAssociations(deleteConfirm);
          } catch (error) {
            if (error instanceof Error && error.message) {
              reportError(error.message);
            } else {
              reportError(tn("deleteCalendarFailed"));
            }
            return;
          }
        }
      }
      await runDeleteTransaction(targets, {
        errorMessage: tn("deleteFailed"),
        threadIdForFallback: threadId
      });
    },
    [
      activeAccountId,
      buildDeleteConfirmState,
      collapsedThreads,
      confirmDelete,
      deleteLinkedCalendarAssociations,
      reportError,
      runDeleteTransaction,
      supportsThreads,
      threadScopeMessages, tn
    ]
  );

  const handleDeleteMessagesByIds = useCallback(
    async (messageIds: string[], options?: { selectedIds: string[] }) => {
      const uniqueIds = Array.from(new Set(messageIds));
      if (uniqueIds.length === 0) return;
      const targets = uniqueIds
        .map(
          (id) =>
            threadScopeMessages.find((item) => item.id === id) ??
            messages.find((item) => item.id === id)
        )
        .filter((message): message is Message => Boolean(message));
      const selectedIds = new Set(options?.selectedIds ?? uniqueIds);
      const hiddenTargets = targets.filter((target) => !selectedIds.has(target.id));
      const deleteConfirm = await buildDeleteConfirmState(
        targets,
        targets.length > 1 ? "messages" : "message"
      );
      if (hiddenTargets.length > 0) {
        deleteConfirm.hiddenMessageCount = hiddenTargets.length;
        deleteConfirm.collapsedThreadCount = new Set(hiddenTargets.map(getThreadKey)).size;
      }
      const requiresDeleteConfirm =
        hiddenTargets.length > 0 ||
        deleteConfirm.calendarLinkedReminderCount > 0 ||
        deleteConfirm.calendarLinkedEventCount > 0;
      if (requiresDeleteConfirm) {
        const action = await confirmDelete(deleteConfirm);
        if (action === "cancel") return;
        if (action === "delete_linked_and_mail") {
          try {
            await deleteLinkedCalendarAssociations(deleteConfirm);
          } catch (error) {
            if (error instanceof Error && error.message) {
              reportError(error.message);
            } else {
              reportError(tn("deleteCalendarFailed"));
            }
            return;
          }
        }
      }
      await runDeleteTransaction(targets, {
        errorMessage: tn("deleteManyFailed"),
        clearSelectionWhenActiveRemains: true
      });
    },
    [
      buildDeleteConfirmState,
      confirmDelete,
      deleteLinkedCalendarAssociations,
      messages,
      reportError,
      runDeleteTransaction,
      threadScopeMessages, tn
    ]
  );

  return {
    handleDeleteMessage,
    handleDeleteMessagesByIds
  };
}
