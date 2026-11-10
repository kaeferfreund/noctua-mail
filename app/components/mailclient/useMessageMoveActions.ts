"use client";

import { getFolderDisplayName } from "@/lib/i18n/folderNames";
import { useLocale, useTranslations } from "next-intl";

import type React from "react";
import { useCallback } from "react";
import { buildAccountMessagesActionPath } from "@/lib/accountApiPaths";
import type { Folder, Message } from "@/lib/data";
import type { SelectionStore } from "./messagelist/selectionStore";
import type { ThreadMoveRequest } from "./utils/messageMove";
import {
  applyFolderTransferCounts,
  getMessageSubjectForNotice,
  pruneDetachedCrossFolderThreadMessages,
  remapMessageReferenceIds
} from "./utils/messageMutation";
import { decrementGroupMetaForMessages } from "./utils/messageHelpers";
import type { MessageGroupMeta } from "./messagelist/listModel";
import {
  resolveEquivalentFolderId,
  type CanEditMailbox,
  type MailboxAction,
  type MailboxSkipReason,
  type MailboxSkipReport,
  type ReportMailboxSkips
} from "./domain/mailboxFanOut";

const NO_FOLDERS: Folder[] = [];
const messageKey = (message: Pick<Message, "id" | "accountId">) => `${message.accountId}\u0000${message.id}`;

export type UndoMoveTarget = {
  messageId: string;
  restoreFolderId: string;
  /**
   * RFC 5322 `Message-ID` header for the message at the time the undo target
   * was captured. Carried alongside the internal row id so notification dedup
   * can seed by header even after the message has been removed from local
   * state by the move that we're undoing.
   */
  headerMessageId?: string;
  /** Mailbox of the message; undo moves it back there (the domain view mixes mailboxes). */
  accountId?: string;
};

type MoveNoticeInput = {
  type: "success";
  title: string;
  description?: string;
  actionKind?: "undo";
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number | null;
};

type MoveApiResponse = {
  ok: boolean;
  queued?: boolean;
  destinationFolderId: string;
  destinationMailbox?: string;
  movedIds?: Array<{ previousId: string; nextId: string }>;
  undoTargets?: UndoMoveTarget[];
};

export type MoveMessagesResult = {
  ids: string[];
  undoTargets: UndoMoveTarget[];
  destinationFolderId: string;
  destinationName: string;
  singleSubject?: string;
};

export type MoveMessagesOptions = {
  messageIds?: string[];
  threadMove?: ThreadMoveRequest;
  showNotice?: boolean;
  clearSelectionOnSuccess?: boolean;
  managePendingState?: boolean;
  updateActiveMessage?: boolean;
  reportErrorOnFailure?: boolean;
  /**
   * Mailbox of each message, from the caller that holds the message. It wins over
   * the list lookup: a message shown only in the reader (a conversation across
   * mailboxes) is not in the list.
   */
  accountByMessageId?: ReadonlyMap<string, string>;
  /** Per-mailbox destinations (delete: each mailbox's trash), instead of mapping the destination by role. */
  destinationsByAccount?: ReadonlyMap<string, string>;
  /** The action named when messages are skipped (no permission, no matching folder). */
  skipAction?: MailboxAction;
  /** Collects skipped messages for the caller's own notice instead of reporting them here. */
  collectSkipped?: MailboxSkipReport["skipped"];
};

export type MoveMessagesToFolder = (
  destinationFolderId: string,
  options?: MoveMessagesOptions
) => Promise<MoveMessagesResult | null>;

type UseMessageMoveActionsOptions = {
  activeAccountId: string;
  activeMessageId: string;
  activeFolderId: string;
  searchScope: "folder" | "all";
  includeThreadAcrossFoldersForList: boolean;
  messages: Message[];
  selectionStore: SelectionStore;
  folderById: Map<string, Pick<Folder, "name" | "specialUse">>;
  /** Known folders of every listed mailbox (the active one's and, in the domain view, the others'). */
  folders?: Folder[];
  /** A mailbox's folders, read when not known yet (role mapping for other mailboxes). */
  getAccountFolders?: (accountId: string) => Promise<Folder[] | null>;
  canEditMailbox?: CanEditMailbox;
  reportMailboxSkips?: ReportMailboxSkips;
  lastSelectedIdRef: React.MutableRefObject<string | null>;
  setFolders: React.Dispatch<React.SetStateAction<Folder[]>>;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setGroupMeta: React.Dispatch<React.SetStateAction<MessageGroupMeta[]>>;
  shouldKeepMessageInResults?: (message: Message) => boolean;
  setPendingMessageActions: React.Dispatch<React.SetStateAction<Set<string>>>;
  setActiveMessageId: React.Dispatch<React.SetStateAction<string>>;
  setViewMessage: (message: Message | null) => void;
  apiFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  readErrorMessage: (res: Response) => Promise<string>;
  reportError: (message: string) => void;
  pushNotice: (input: MoveNoticeInput) => void;
  undoMoveOperation: (
    targets: UndoMoveTarget[],
    accountId: string,
    successTitle?: string
  ) => Promise<void>;
  noticeSuccessTimeout: number;
  onMoveComplete?: (messageIds: string[]) => void;
  markMessagesMutated?: () => void;
  applyDeleteReconcileSuppression?: (input: {
    targets?: Message[];
    messageIds?: Array<string | null | undefined>;
    fallbackFolderId?: string | null;
  }) => void;
};

export function shouldKeepMovedMessageVisible(params: {
  message: Message;
  searchScope: "folder" | "all";
  activeFolderId: string;
  shouldKeepMessageInResults?: (message: Message) => boolean;
}) {
  const {
    message,
    searchScope,
    activeFolderId,
    shouldKeepMessageInResults
  } = params;
  if (shouldKeepMessageInResults) {
    return shouldKeepMessageInResults(message);
  }
  return !(
    searchScope === "folder" &&
    activeFolderId &&
    message.folderId !== activeFolderId
  );
}

export function useMessageMoveActions({
  activeAccountId,
  activeMessageId,
  activeFolderId,
  searchScope,
  includeThreadAcrossFoldersForList,
  messages,
  selectionStore,
  folderById,
  folders = NO_FOLDERS,
  getAccountFolders,
  canEditMailbox,
  reportMailboxSkips,
  lastSelectedIdRef,
  setFolders,
  setMessages,
  setGroupMeta,
  shouldKeepMessageInResults,
  setPendingMessageActions,
  setActiveMessageId,
  setViewMessage,
  apiFetch,
  readErrorMessage,
  reportError,
  pushNotice,
  undoMoveOperation,
  noticeSuccessTimeout,
  onMoveComplete,
  markMessagesMutated,
  applyDeleteReconcileSuppression
}: UseMessageMoveActionsOptions) {
  const locale = useLocale();
  const tn = useTranslations("Notifications");

  const clearSelectionState = useCallback(() => {
    selectionStore.clearSelection();
    lastSelectedIdRef.current = null;
  }, [lastSelectedIdRef, selectionStore]);

  const moveMessagesToFolder = useCallback<MoveMessagesToFolder>(
    async (destinationFolderId, options) => {
      const selected = selectionStore.getIds();
      const ids =
        options?.messageIds && options.messageIds.length > 0
          ? options.messageIds
          : selected.size > 0
            ? Array.from(selected)
            : activeMessageId
              ? [activeMessageId]
              : [];
      const uniqueIds = Array.from(new Set(ids));
      const threadMove = options?.threadMove;
      if (uniqueIds.length === 0 && !threadMove) return null;
      const managePendingState = options?.managePendingState ?? true;
      const clearSelectionOnSuccess = options?.clearSelectionOnSuccess ?? true;
      const updateActiveMessage = options?.updateActiveMessage ?? true;
      const showNotice = options?.showNotice ?? true;
      const reportErrorOnFailure = options?.reportErrorOnFailure ?? true;
      const skipAction = options?.skipAction ?? "move";
      // Each message moves in its own mailbox (the domain view lists several):
      // to the destination itself in the destination's mailbox, to the folder of
      // the same role (trash, archive, …) in any other, or not at all when a
      // custom folder has no equivalent there.
      const destinationFolder = folders.find((folder) => folder.id === destinationFolderId);
      const destinationAccountId = destinationFolder?.accountId ?? activeAccountId;
      const messageById = new Map<string, Message>();
      messages.forEach((item) => {
        if (!messageById.has(item.id)) messageById.set(item.id, item);
      });
      const groups = new Map<string, { ids: string[]; threadMove?: ThreadMoveRequest }>();
      const groupFor = (accountId: string) => {
        const existing = groups.get(accountId);
        if (existing) return existing;
        const created: { ids: string[]; threadMove?: ThreadMoveRequest } = { ids: [] };
        groups.set(accountId, created);
        return created;
      };
      // A message whose mailbox is unknown here belongs to the active mailbox
      // (as before the domain view) — never to the destination's mailbox, which
      // would send its id to another mailbox's route.
      uniqueIds.forEach((id) => {
        const accountId = options?.accountByMessageId?.get(id) || messageById.get(id)?.accountId || activeAccountId;
        groupFor(accountId).ids.push(id);
      });
      if (threadMove) {
        groupFor(threadMove.accountId || activeAccountId).threadMove = threadMove;
      }
      const skipped: MailboxSkipReport["skipped"] = [];
      const skipGroup = (accountId: string, group: { ids: string[]; threadMove?: ThreadMoveRequest }, reason: MailboxSkipReason) => {
        const refs = group.ids.length > 0 ? group.ids : group.threadMove ? [group.threadMove.threadId] : [];
        refs.forEach((id) => skipped.push({ id, accountId, reason }));
      };
      const requestedCount = Array.from(groups.values()).reduce(
        (sum, group) => sum + (group.ids.length > 0 ? group.ids.length : group.threadMove ? 1 : 0),
        0
      );
      const allIds = uniqueIds;
      if (managePendingState) {
        setPendingMessageActions((prev) => new Set([...prev, ...allIds]));
      }

      type GroupResult = {
        accountId: string;
        destinationFolderId: string;
        destinationMailbox?: string;
        queued: boolean;
        movedPreviousIds: Set<string>;
        idRemap: Map<string, string>;
        undoTargets: UndoMoveTarget[];
      };

      const moveGroup = async (
        accountId: string,
        group: { ids: string[]; threadMove?: ThreadMoveRequest }
      ): Promise<GroupResult | null> => {
        if (canEditMailbox && !canEditMailbox(accountId)) {
          skipGroup(accountId, group, "permission");
          return null;
        }
        let groupDestinationId = options?.destinationsByAccount?.get(accountId) ?? null;
        if (!groupDestinationId) {
          if (accountId === destinationAccountId) {
            groupDestinationId = destinationFolderId;
          } else if (destinationFolder) {
            const accountFolders = (await getAccountFolders?.(accountId)) ?? [];
            groupDestinationId = resolveEquivalentFolderId({
              destination: destinationFolder,
              accountId,
              accountFolders
            });
          }
        }
        if (!groupDestinationId) {
          skipGroup(accountId, group, "noFolder");
          return null;
        }
        const idSet = new Set(group.ids);
        const sourceTargets = messages.filter((item) => item.accountId === accountId && idSet.has(item.id));
        const localUndoTargets: UndoMoveTarget[] = sourceTargets.map((item) => ({
          messageId: item.id,
          restoreFolderId: item.folderId,
          headerMessageId: item.messageId,
          accountId
        }));
        const headerMessageIdByRowId = new Map<string, string>();
        sourceTargets.forEach((item) => {
          if (item.messageId) headerMessageIdByRowId.set(item.id, item.messageId);
        });
        applyDeleteReconcileSuppression?.({
          targets: sourceTargets,
          messageIds: group.ids,
          fallbackFolderId: activeFolderId
        });
        const { accountId: _threadAccountId, ...threadMovePayload } = group.threadMove ?? { threadId: "" };
        const res = await apiFetch(buildAccountMessagesActionPath(accountId, "move"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messageIds: group.ids,
            destinationFolderId: groupDestinationId,
            threadMove: group.threadMove ? threadMovePayload : undefined
          })
        });
        if (!res.ok) {
          if (res.status === 403 && canEditMailbox) {
            skipGroup(accountId, group, "permission");
          } else if (reportErrorOnFailure) {
            reportError(await readErrorMessage(res));
          }
          return null;
        }
        const data = (await res.json()) as MoveApiResponse;
        const queued = Boolean(data.queued);
        const idRemap = new Map<string, string>();
        (data.movedIds ?? []).forEach((item) => {
          if (!item?.previousId || !item?.nextId) return;
          idRemap.set(item.previousId, item.nextId);
        });
        const movedPreviousIds = data.movedIds
          ? new Set(
              data.movedIds
                .map((item) => item?.previousId ?? "")
                .filter(Boolean)
            )
          : new Set(group.ids);
        if (movedPreviousIds.size === 0) return null;
        const resolveMovedId = (id: string) => idRemap.get(id) ?? id;
        const fallbackUndoTargets = localUndoTargets
          .filter((target) => movedPreviousIds.has(target.messageId))
          .map((target) => ({
            ...target,
            messageId: resolveMovedId(target.messageId)
          }));
        const responseUndoTargets = Array.isArray(data.undoTargets)
          ? data.undoTargets
              .filter(
                (target): target is UndoMoveTarget =>
                  Boolean(target?.messageId) && Boolean(target?.restoreFolderId)
              )
              .map((target) => {
                // Server returns the internal row id (the message's `previousId`
                // before the move). Use that to look up the header we captured
                // from local state before the move stripped these messages out.
                const headerMessageId =
                  target.headerMessageId ?? headerMessageIdByRowId.get(target.messageId);
                return {
                  ...target,
                  messageId: resolveMovedId(target.messageId),
                  accountId,
                  ...(headerMessageId ? { headerMessageId } : {})
                };
              })
          : [];
        const undoTargets =
          responseUndoTargets.length > 0 ? responseUndoTargets : fallbackUndoTargets;
        markMessagesMutated?.();
        setFolders((prev) =>
          applyFolderTransferCounts(
            prev,
            sourceTargets.map((message) => ({
              fromFolderId: message.folderId,
              toFolderId: data.destinationFolderId,
              unread: Boolean(message.unread ?? !message.seen)
            }))
          )
        );
        // `removedFromList` is populated by the setMessages updater
        // (reads `prev`, the authoritative latest state) and consumed by
        // the setGroupMeta updater queued right after. Both updaters
        // run in order within the same React batch, so the closure is
        // reliable even when the surrounding handler is async.
        let removedFromList: Message[] = [];
        setMessages((prev) => {
          let changed = false;
          // Keyed by mailbox and id: the same message (equal row id) can be
          // listed for two mailboxes of a domain, and only this one's moves.
          const nextByKey = new Map<string, Message>();
          prev.forEach((item) => {
            if (item.accountId !== accountId || !movedPreviousIds.has(item.id)) {
              nextByKey.set(messageKey(item), item);
              return;
            }
            const resolvedId = resolveMovedId(item.id);
            const updatedBase: Message = {
              ...item,
              id: resolvedId,
              folderId: data.destinationFolderId,
              mailboxPath: data.destinationMailbox ?? item.mailboxPath,
              imapUid: queued ? undefined : item.imapUid
            };
            const updated = remapMessageReferenceIds(updatedBase, item.id, resolvedId);
            const keep = shouldKeepMovedMessageVisible({
              message: updated,
              searchScope,
              activeFolderId,
              shouldKeepMessageInResults
            });
            changed = true;
            if (!keep) return;
            nextByKey.set(messageKey(updated), updated);
          });
          const nextMessages = changed ? Array.from(nextByKey.values()) : prev;
          const next = pruneDetachedCrossFolderThreadMessages(nextMessages, {
            searchScope,
            activeFolderId,
            includeThreadAcrossFoldersForList
          });
          // Moved messages get their id remapped via `resolveMovedId`, so
          // resolve each prev id to its post-move counterpart before
          // checking membership — otherwise a kept-but-renamed message
          // would be misidentified as removed.
          const nextKeys = new Set(next.map(messageKey));
          removedFromList = prev.filter((item) => {
            const id = item.accountId === accountId ? resolveMovedId(item.id) : item.id;
            return !nextKeys.has(messageKey({ accountId: item.accountId, id }));
          });
          return next;
        });
        setGroupMeta((prev) =>
          removedFromList.length > 0
            ? decrementGroupMetaForMessages(prev, removedFromList)
            : prev
        );
        return {
          accountId,
          destinationFolderId: data.destinationFolderId,
          destinationMailbox: data.destinationMailbox,
          queued,
          movedPreviousIds,
          idRemap,
          undoTargets
        };
      };

      try {
        const settled = await Promise.all(
          Array.from(groups.entries()).map(([accountId, group]) =>
            moveGroup(accountId, group).catch(() => {
              if (reportErrorOnFailure) reportError(tn("moveFailed"));
              return null;
            })
          )
        );
        const results = settled.filter((result): result is GroupResult => result !== null);
        // Skipped messages go to the caller, or into a notice after the success notice.
        const reportSkipped = () => {
          if (options?.collectSkipped) {
            options.collectSkipped.push(...skipped);
          } else if (reportMailboxSkips && skipped.length > 0) {
            reportMailboxSkips({ action: skipAction, total: requestedCount, skipped });
          }
        };
        const movedPreviousIds = new Set(results.flatMap((result) => Array.from(result.movedPreviousIds)));
        const movedCount = movedPreviousIds.size;
        if (movedCount === 0) {
          reportSkipped();
          return null;
        }
        const resolveMovedId = (id: string) => {
          for (const result of results) {
            const next = result.idRemap.get(id);
            if (next) return next;
          }
          return id;
        };
        const mappedUndoTargets = results.flatMap((result) => result.undoTargets);
        const activeResult = results.find((result) => result.movedPreviousIds.has(activeMessageId));
        if (updateActiveMessage && activeResult) {
          const resolvedActiveId = resolveMovedId(activeMessageId);
          const activeMessage = messages.find(
            (item) => item.id === activeMessageId && item.accountId === activeResult.accountId
          );
          const activeUpdated = activeMessage
            ? remapMessageReferenceIds(
                {
                  ...activeMessage,
                  id: resolvedActiveId,
                  folderId: activeResult.destinationFolderId,
                  mailboxPath: activeResult.destinationMailbox ?? activeMessage.mailboxPath,
                  imapUid: activeResult.queued ? undefined : activeMessage.imapUid
                },
                activeMessage.id,
                resolvedActiveId
              )
            : null;
          const activeStillVisible = activeUpdated
            ? shouldKeepMovedMessageVisible({
                message: activeUpdated,
                searchScope,
                activeFolderId,
                shouldKeepMessageInResults
              })
            : false;
          if (!activeStillVisible) {
            setActiveMessageId("");
            setViewMessage(null);
          } else if (resolvedActiveId !== activeMessageId) {
            setActiveMessageId(resolvedActiveId);
            setViewMessage(activeUpdated);
          }
        }
        if (clearSelectionOnSuccess && movedCount > 0) {
          clearSelectionState();
        }
        const destination = folderById.get(destinationFolderId);
        const destinationName = destination ? getFolderDisplayName(destination, locale) : tn("folder");
        const singleTarget =
          movedCount === 1
            ? messages.find((item) => movedPreviousIds.has(item.id)) ?? null
            : null;
        const singleSubject =
          movedCount === 1 ? getMessageSubjectForNotice(singleTarget, tn("noSubject")) : undefined;
        if (showNotice) {
          pushNotice({
            type: "success",
            title: tn(results.some((result) => result.queued) ? "movingBackground" : "moved", {
              count: movedCount,
              destination: destinationName
            }),
            description: singleSubject,
            actionKind: mappedUndoTargets.length > 0 ? "undo" : undefined,
            onAction:
              mappedUndoTargets.length > 0
                ? () =>
                    void undoMoveOperation(
                      mappedUndoTargets,
                      activeAccountId,
                      tn("moveUndone", { count: mappedUndoTargets.length })
                    )
                : undefined,
            durationMs: noticeSuccessTimeout
          });
        }
        reportSkipped();
        if (onMoveComplete) {
          onMoveComplete(
            Array.from(
              new Set([
                ...Array.from(movedPreviousIds),
                ...Array.from(movedPreviousIds).map((id) => resolveMovedId(id))
              ])
            )
          );
        }
        const resultIds = Array.from(movedPreviousIds);
        return {
          ids: resultIds,
          undoTargets: mappedUndoTargets,
          destinationFolderId: results.find((result) => result.accountId === destinationAccountId)?.destinationFolderId
            ?? results[0].destinationFolderId,
          destinationName,
          singleSubject
        };
      } catch {
        if (reportErrorOnFailure) {
          reportError(tn("moveFailed"));
        }
        return null;
      } finally {
        if (managePendingState) {
          setPendingMessageActions((prev) => {
            const next = new Set(prev);
            allIds.forEach((id) => next.delete(id));
            return next;
          });
        }
      }
    },
    [
      activeAccountId,
      activeFolderId,
      activeMessageId,
      apiFetch,
      canEditMailbox,
      clearSelectionState,
      folderById,
      folders,
      getAccountFolders,
      locale,
      messages,
      noticeSuccessTimeout,
      pushNotice,
      tn,
      readErrorMessage,
      reportError,
      reportMailboxSkips,
      searchScope,
      includeThreadAcrossFoldersForList,
      selectionStore,
      shouldKeepMessageInResults,
      setActiveMessageId,
      setViewMessage,
      setFolders,
      setMessages,
      setGroupMeta,
      setPendingMessageActions,
      undoMoveOperation,
      onMoveComplete,
      markMessagesMutated,
      applyDeleteReconcileSuppression
    ]
  );

  const handleMoveMessages = useCallback(
    (destinationFolderId: string, messageIds?: string[]) => {
      void moveMessagesToFolder(destinationFolderId, {
        messageIds,
        showNotice: true,
        clearSelectionOnSuccess: true,
        managePendingState: true,
        updateActiveMessage: true,
        reportErrorOnFailure: true
      });
    },
    [moveMessagesToFolder]
  );

  return {
    handleMoveMessages,
    moveMessagesToFolder
  };
}
