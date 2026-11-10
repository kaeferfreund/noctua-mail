import { retryAutoReadOnce } from "@/lib/autoMarkRead";
import { useCallback, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import type React from "react";
import { buildAccountFoldersPath, buildAccountMessageActionPath, buildAccountMessagesActionPath } from "@/lib/accountApiPaths";
import type { Folder, Message } from "@/lib/data";
import { applyFlagsToMessage, isFlaggedMessage, hasTodoFlag, hasDoneFlag, getUnsubscribeCapability } from "./utils/messageHelpers";
import {
  computeOptimisticMovedMessage,
  getMessageSubjectForNotice,
  resolveMoveViewTransition
} from "./utils/messageMutation";
import { TODO_FLAG, DONE_FLAG } from "@/lib/messageFlags";
import { applyFolderStreamUpdates } from "./folderStreamUpdates";
import { NOTICE_TIMEOUTS } from "./constants";
import type { UndoMoveTarget } from "./useMessageMoveActions";

import type { ContinueAfterRemoval } from "./messagelist/successfulRemoval";
import {
  groupByAccount,
  type CanEditMailbox,
  type MailboxAction,
  type MailboxSkipReport,
  type ReportMailboxSkips
} from "./domain/mailboxFanOut";

/** Result of a command on one message: done, skipped for lack of permission, or failed (reported). */
export type MessageCommandOutcome = "done" | "denied" | "failed";
/** `quietDenied`: a bulk caller collects denied messages for one notice of its own. */
export type MessageCommandOptions = { quietDenied?: boolean };

/** The action a flag change is named by in a notice about skipped messages. */
export function flagMutationAction(payload: { value: boolean; flag?: string; keyword?: string }): MailboxAction {
  if (payload.flag === "seen") return payload.value ? "markRead" : "markUnread";
  if (payload.flag === "answered") return payload.value ? "answered" : "unanswered";
  if (payload.keyword === TODO_FLAG) return payload.value ? "todo" : "untodo";
  if (payload.keyword === DONE_FLAG) return "done";
  return payload.value ? "flag" : "unflag";
}

type UseMessageMutationsProps = {
  continueAfterRemoval?: ContinueAfterRemoval;
  getNavigationRows?: () => Message[];
  activeAccountId: string;
  searchScope: "folder" | "all";
  viewMessage: Message | null;
  hasFilteredSearchCriteria: boolean;
  apiFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  readErrorMessage: (res: Response) => Promise<string>;
  reportError: (message: string, meta?: { requestPath?: string; status?: number }) => void;
  pushNotice: (notice: any) => void;
  updateMessagesWithCurrentResultPrune: (
    updater: (message: Message) => Message | null,
    options?: { source?: string }
  ) => void;
  setViewMessage: (msg: Message | null) => void;
  setActiveMessageId: (id: string) => void;
  setFolders: React.Dispatch<React.SetStateAction<any[]>>;
  setPendingMessageActions: React.Dispatch<React.SetStateAction<Set<string>>>;
  evictMessageCaches: (messageIds: string[]) => void;
  shouldKeepMessageInCurrentResults: (message: Message) => boolean;
  undoMoveOperation: (targets: UndoMoveTarget[], accountId: string, successTitle?: string) => void;
  confirmUnsubscribe: (sender: string, listId?: string) => Promise<boolean>;
  applyMoveReconcileSuppression: (messages: Message[]) => void;
  setActiveTopicSuggestionMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  updateThreadCacheWithFlags: (messageId: string, flags: string[]) => void;
  updateThreadCacheWithCategory: (
    messageId: string,
    category: string | null,
    categoryScore: number | null,
    categorySignals: string[]
  ) => void;
  queueFilteredSearchRefresh: (hasCriteria: boolean) => void;
  canEditMailbox?: CanEditMailbox;
  reportMailboxSkips?: ReportMailboxSkips;
};

type SystemFlag = "seen" | "answered" | "flagged" | "draft" | "deleted";
type MoveReconcileParams = {
  movedMessageId: string;
  destinationFolderId?: string | null;
  destinationMailbox?: string;
  flags?: string[];
  source: string;
  successTitle: string;
  undoSuccessMessage: string;
  // The renderer order when the command started.
  navigationRows?: Message[];
};

export function useMessageMutations({
  continueAfterRemoval,
  getNavigationRows,
  activeAccountId,
  searchScope,
  viewMessage,
  hasFilteredSearchCriteria,
  apiFetch,
  readErrorMessage,
  reportError,
  pushNotice,
  updateMessagesWithCurrentResultPrune,
  setViewMessage,
  setActiveMessageId,
  setFolders,
  setPendingMessageActions,
  evictMessageCaches,
  shouldKeepMessageInCurrentResults,
  undoMoveOperation,
  confirmUnsubscribe,
  applyMoveReconcileSuppression,
  setActiveTopicSuggestionMessages,
  updateThreadCacheWithFlags,
  updateThreadCacheWithCategory,
  queueFilteredSearchRefresh,
  canEditMailbox,
  reportMailboxSkips
}: UseMessageMutationsProps) {
  const viewMessageId = viewMessage?.id;
  const folderRefreshGeneration = useRef(0);
  useEffect(() => () => { folderRefreshGeneration.current += 1; }, [activeAccountId]);

  const tn = useTranslations("Notifications");

  // Permission handling shared by every command: a mailbox the user may not
  // change is skipped up front, a 403 from its route the same way, and the
  // skip is named in a notice (or left to a bulk caller collecting them).
  const reportDenied = useCallback((
    message: Pick<Message, "id" | "accountId">,
    action: MailboxAction,
    quiet?: boolean
  ) => {
    if (!quiet) {
      reportMailboxSkips?.({
        action,
        total: 1,
        skipped: [{ id: message.id, accountId: message.accountId || activeAccountId, reason: "permission" }]
      });
    }
  }, [activeAccountId, reportMailboxSkips]);
  const deniedUpFront = useCallback((
    message: Pick<Message, "id" | "accountId">,
    action: MailboxAction,
    quiet?: boolean
  ) => {
    if (!canEditMailbox || canEditMailbox(message.accountId || activeAccountId)) return false;
    reportDenied(message, action, quiet);
    return true;
  }, [activeAccountId, canEditMailbox, reportDenied]);
  const deniedByServer = useCallback((
    res: Response,
    message: Pick<Message, "id" | "accountId">,
    action: MailboxAction,
    quiet?: boolean
  ) => {
    if (res.status !== 403 || !reportMailboxSkips) return false;
    reportDenied(message, action, quiet);
    return true;
  }, [reportDenied, reportMailboxSkips]);

  const reconcileMessageFlags = useCallback((
    message: Message,
    flags: string[],
    source: string
  ) => {
    const updatedMessage = applyFlagsToMessage(message, flags);
    const shouldKeepUpdatedMessage = shouldKeepMessageInCurrentResults(updatedMessage);
    updateMessagesWithCurrentResultPrune(
      (item) => (item.id === message.id ? applyFlagsToMessage(item, flags) : item),
      { source }
    );
    setActiveTopicSuggestionMessages((prev) => {
      if (!prev.some((item) => item.id === message.id)) return prev;
      return prev.map((item) =>
        item.id === message.id ? applyFlagsToMessage(item, flags) : item
      );
    });
    updateThreadCacheWithFlags(message.id, flags);
    if (viewMessageId === message.id && !shouldKeepUpdatedMessage) {
      setViewMessage(null);
      setActiveMessageId("");
    }
    return updatedMessage;
  }, [
    setActiveMessageId,
    setActiveTopicSuggestionMessages,
    setViewMessage,
    shouldKeepMessageInCurrentResults,
    updateMessagesWithCurrentResultPrune,
    updateThreadCacheWithFlags,
    viewMessageId
  ]);

  const reportResponseError = useCallback(async (res: Response) => {
    const message = await readErrorMessage(res);
    let requestPath: string | undefined;
    try {
      if (res.url) {
        const url = new URL(res.url);
        requestPath = `${url.pathname}${url.search}`;
      }
    } catch {
      // ignore
    }
    reportError(message, { requestPath, status: res.status });
  }, [readErrorMessage, reportError]);

  // Commands go to the message's own mailbox: a conversation or the domain view can
  // show messages of other mailboxes next to the active one's.
  const requestMessageFlagMutation = useCallback(async (
    message: Pick<Message, "id" | "accountId">,
    payload: { value: boolean; flag?: SystemFlag; keyword?: string },
    shouldRetry?: () => boolean
  ) => {
    const request = async () => {
      const response = await apiFetch(buildAccountMessageActionPath(message.accountId || activeAccountId, message.id, "flags"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw response;
      return response;
    };
    try {
      const res = shouldRetry ? await retryAutoReadOnce(request, shouldRetry) : await request();
      if (!res) return null;
      const data = (await res.json()) as { flags?: string[] };
      return data.flags ?? [];
    } catch (error) {
      if (!(error instanceof Response)) throw error;
      if (!deniedByServer(error, message, flagMutationAction(payload))) await reportResponseError(error);
      return null;
    }
  }, [activeAccountId, apiFetch, deniedByServer, reportResponseError]);

  // One request per mailbox. Mailboxes the user may not change are skipped up
  // front, a 403 the same way; one notice names them, the rest is applied.
  const requestBulkFlagMutation = useCallback(async (
    messages: Array<Pick<Message, "id" | "accountId">>,
    payload: { value: boolean; flag?: SystemFlag; keyword?: string }
  ) => {
    const results: Array<{ messageId: string; flags: string[]; accountId?: string }> = [];
    const skipped: MailboxSkipReport["skipped"] = [];
    let failed = false;
    for (const [accountId, accountMessages] of groupByAccount(messages, activeAccountId)) {
      const messageIds = accountMessages.map((message) => message.id);
      if (canEditMailbox && !canEditMailbox(accountId)) {
        messageIds.forEach((id) => skipped.push({ id, accountId, reason: "permission" }));
        continue;
      }
      const res = await apiFetch(buildAccountMessagesActionPath(accountId, "flags/bulk"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, messageIds })
      });
      if (!res.ok) {
        if (res.status === 403 && reportMailboxSkips) {
          messageIds.forEach((id) => skipped.push({ id, accountId, reason: "permission" }));
          continue;
        }
        await reportResponseError(res);
        failed = true;
        continue;
      }
      const data = (await res.json()) as {
        results?: Array<{ messageId: string; flags: string[] }>;
        skipped?: Array<{ messageId: string; reason: string }>;
      };
      if (data.skipped && data.skipped.length > 0) {
        pushNotice({
          type: "warning",
          title: tn("skipped", { count: data.skipped.length }),
          description: data.skipped[0]?.reason
        });
      }
      results.push(...(data.results ?? []).map((result) => ({ ...result, accountId })));
    }
    if (skipped.length > 0) {
      reportMailboxSkips?.({ action: flagMutationAction(payload), total: messages.length, skipped });
    }
    return failed && results.length === 0 ? null : results;
  }, [activeAccountId, apiFetch, canEditMailbox, pushNotice, reportMailboxSkips, reportResponseError, tn]);

  const reconcileMoveMutation = useCallback((
    message: Message,
    params: MoveReconcileParams
  ) => {
    const {
      movedMessageId,
      destinationFolderId,
      destinationMailbox,
      flags,
      source,
      successTitle,
      undoSuccessMessage
    } = params;
    evictMessageCaches(Array.from(new Set([message.id, movedMessageId])));

    const optimisticParams = {
      movedMessageId,
      destinationFolderId,
      destinationMailbox,
      flags,
      searchScope
    };
    const movedMessage = computeOptimisticMovedMessage(message, optimisticParams);

    updateMessagesWithCurrentResultPrune((item) => {
      if (item.id !== message.id || item.accountId !== message.accountId) return item;
      return computeOptimisticMovedMessage(item, optimisticParams);
    }, { source });

    const transition = resolveMoveViewTransition(
      viewMessage,
      message.id,
      movedMessage,
      shouldKeepMessageInCurrentResults
    );
    // A selection can finish rendering while the HTTP command is in flight.
    // Let the shared continuation inspect the current reader, rather than the
    // view captured when this request started.
    if (continueAfterRemoval && (!movedMessage || !shouldKeepMessageInCurrentResults(movedMessage))) {
      continueAfterRemoval([message.id], params.navigationRows);
    } else if (transition.kind === "clear") {
      setViewMessage(null);
      setActiveMessageId("");
    } else if (transition.kind === "retarget") {
      setViewMessage(transition.nextViewMessage);
      setActiveMessageId(transition.nextActiveMessageId);
    }

    const undoTarget: UndoMoveTarget = {
      messageId: movedMessageId,
      restoreFolderId: message.folderId
    };
    pushNotice({
      type: "success",
      title: successTitle,
      description: getMessageSubjectForNotice(message, tn("noSubject")),
      actionKind: destinationFolderId ? "undo" : undefined,
      onAction:
        destinationFolderId
          ? () => undoMoveOperation([undoTarget], message.accountId || activeAccountId, undoSuccessMessage)
          : undefined,
      durationMs: NOTICE_TIMEOUTS.success
    });
  }, [
    activeAccountId,
    continueAfterRemoval,
    evictMessageCaches,
    pushNotice,
    searchScope,
    setActiveMessageId,
    setViewMessage,
    shouldKeepMessageInCurrentResults,
    undoMoveOperation,
    updateMessagesWithCurrentResultPrune,
    viewMessage,
    tn
  ]);

  // Explicit JSON keeps bodyless commands valid when the browser/Next transport
  // presents an empty request stream to requireMutationSameOrigin.
  const requestMessageCommand = useCallback((message: Pick<Message, "id" | "accountId">, action: string) =>
    apiFetch(buildAccountMessageActionPath(message.accountId || activeAccountId, message.id, action), {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "{}"
    }), [activeAccountId, apiFetch]);

  const handleArchiveMessage = useCallback(async (message: Message, options?: MessageCommandOptions): Promise<MessageCommandOutcome> => {
    if (deniedUpFront(message, "archive", options?.quietDenied)) return "denied";
    try {
      const navigationRows = getNavigationRows?.();
      applyMoveReconcileSuppression([message]);
      const res = await requestMessageCommand(message, "archive");
      if (!res.ok) {
        if (deniedByServer(res, message, "archive", options?.quietDenied)) return "denied";
        reportError(await readErrorMessage(res));
        return "failed";
      }
      const data = (await res.json()) as {
        action: "moved";
        archiveFolderId?: string | null;
        archiveMailbox?: string;
        flags?: string[];
        previousMessageId?: string;
        messageId?: string;
      };
      reconcileMoveMutation(message, {
        movedMessageId: data.messageId ?? message.id,
        destinationFolderId: data.archiveFolderId,
        destinationMailbox: data.archiveMailbox,
        flags: data.flags,
        source: "archive-message",
        navigationRows,
        successTitle: tn("archived"),
        undoSuccessMessage: tn("archiveUndone")
      });
      return "done";
    } catch {
      reportError(tn("archiveFailed"));
      return "failed";
    }
  }, [
    deniedByServer,
    deniedUpFront,
    requestMessageCommand,
    applyMoveReconcileSuppression,
    getNavigationRows,
    readErrorMessage,
    reconcileMoveMutation,
    reportError,
    tn
  ]);

  const handleUnsubscribe = useCallback(
    async (message: Message) => {
      const capability = getUnsubscribeCapability(message);
      if (!capability) return;

      // For one-click, show a confirmation dialog
      if (capability === "one-click") {
        // Parse List-Id from the stored header string
        let listId: string | undefined;
        if (message.listUnsubscribe) {
          const lines = message.listUnsubscribe.split("\\n");
          for (const line of lines) {
            if (line.startsWith("List-Id:")) {
              listId = line.substring("List-Id:".length).trim();
              break;
            }
          }
        }
        const confirmed = await confirmUnsubscribe(message.from, listId);
        if (!confirmed) return;
      }

      setPendingMessageActions((prev) => new Set(prev).add(message.id));
      try {
        const res = await requestMessageCommand(message, "unsubscribe");

        if (!res.ok) {
          const errMsg = await readErrorMessage(res);
          reportError(errMsg || "Failed to unsubscribe");
          return;
        }

        const data = (await res.json()) as {
          ok: boolean;
          method: "one-click" | "browser" | "mailto";
          url?: string;
        };

        if (data.method === "one-click") {
          pushNotice({
            type: "success",
            title: tn("unsubscribed"),
            description: tn("unsubscribeSent"),
            durationMs: NOTICE_TIMEOUTS.success
          });
        } else if (data.method === "browser" && data.url) {
          window.open(data.url, "_blank", "noopener,noreferrer");
        } else if (data.method === "mailto" && data.url) {
          window.location.href = data.url;
        }
      } catch (error) {
        reportError(error instanceof Error ? error.message : "Unsubscribe failed");
      } finally {
        setPendingMessageActions((prev) => {
          const next = new Set(prev);
          next.delete(message.id);
          return next;
        });
      }
    },
    [requestMessageCommand, readErrorMessage, reportError, pushNotice, confirmUnsubscribe, setPendingMessageActions, tn]
  );

  const handleMarkSpam = useCallback(async (message: Message, options?: MessageCommandOptions): Promise<MessageCommandOutcome> => {
    if (deniedUpFront(message, "spam", options?.quietDenied)) return "denied";
    setPendingMessageActions((prev) => new Set(prev).add(message.id));
    try {
      const navigationRows = getNavigationRows?.();
      applyMoveReconcileSuppression([message]);
      const res = await requestMessageCommand(message, "spam");
      if (!res.ok) {
        if (deniedByServer(res, message, "spam", options?.quietDenied)) return "denied";
        reportError(await readErrorMessage(res));
        return "failed";
      }
      const data = (await res.json()) as {
        action: "moved";
        junkFolderId?: string | null;
        junkMailbox?: string;
        flags?: string[];
        previousMessageId?: string;
        messageId?: string;
      };
      reconcileMoveMutation(message, {
        movedMessageId: data.messageId ?? message.id,
        destinationFolderId: data.junkFolderId,
        destinationMailbox: data.junkMailbox,
        flags: data.flags,
        source: "mark-spam",
        navigationRows,
        successTitle: tn("markedSpam"),
        undoSuccessMessage: tn("spamUndone")
      });
      return "done";
    } catch {
      reportError(tn("spamFailed"));
      return "failed";
    } finally {
      setPendingMessageActions((prev) => {
        const next = new Set(prev);
        next.delete(message.id);
        return next;
      });
    }
  }, [
    deniedByServer,
    deniedUpFront,
    requestMessageCommand,
    applyMoveReconcileSuppression,
    getNavigationRows,
    readErrorMessage,
    reconcileMoveMutation,
    reportError,
    setPendingMessageActions,
    tn
  ]);

  const handleMarkNotSpam = useCallback(async (message: Message, options?: MessageCommandOptions): Promise<MessageCommandOutcome> => {
    if (deniedUpFront(message, "notSpam", options?.quietDenied)) return "denied";
    setPendingMessageActions((prev) => new Set(prev).add(message.id));
    try {
      const navigationRows = getNavigationRows?.();
      applyMoveReconcileSuppression([message]);
      const res = await requestMessageCommand(message, "not-spam");
      if (!res.ok) {
        if (deniedByServer(res, message, "notSpam", options?.quietDenied)) return "denied";
        reportError(await readErrorMessage(res));
        return "failed";
      }
      const data = (await res.json()) as {
        action: "moved";
        inboxFolderId?: string | null;
        inboxMailbox?: string;
        flags?: string[];
        previousMessageId?: string;
        messageId?: string;
      };
      reconcileMoveMutation(message, {
        movedMessageId: data.messageId ?? message.id,
        destinationFolderId: data.inboxFolderId,
        destinationMailbox: data.inboxMailbox,
        flags: data.flags,
        source: "mark-not-spam",
        navigationRows,
        successTitle: tn("markedNotSpam"),
        undoSuccessMessage: tn("notSpamUndone")
      });
      return "done";
    } catch {
      reportError(tn("notSpamFailed"));
      return "failed";
    } finally {
      setPendingMessageActions((prev) => {
        const next = new Set(prev);
        next.delete(message.id);
        return next;
      });
    }
  }, [
    deniedByServer,
    deniedUpFront,
    requestMessageCommand,
    applyMoveReconcileSuppression,
    getNavigationRows,
    readErrorMessage,
    reconcileMoveMutation,
    reportError,
    setPendingMessageActions,
    tn
  ]);

  // A folder:update can arrive before the mutation response. Never add a
  // local delta to that absolute count: read committed folder counts after a
  // seen transition instead, also covering answered/bulk and watcher-off mode.
  const applyFlagsResults = useCallback((
    pairs: Array<{ message: Message; nextFlags: string[] }>,
    source: string
  ) => {
    const changedFolders = new Set<string>();
    for (const { message, nextFlags } of pairs) {
      const updatedMessage = reconcileMessageFlags(message, nextFlags, source);
      if (Boolean(message.seen) !== Boolean(updatedMessage.seen)) changedFolders.add(message.folderId);
    }
    if (changedFolders.size === 0) return;
    const generation = ++folderRefreshGeneration.current;
    void (async () => {
      try {
        const response = await apiFetch(buildAccountFoldersPath(activeAccountId));
        if (!response.ok) { await reportResponseError(response); return; }
        const folders = await response.json() as Folder[];
        if (generation !== folderRefreshGeneration.current) return;
        const updates = folders.map(folder => ({
          id: folder.id, unseen: folder.unreadCount, exists: folder.count
        }));
        setFolders(previous => applyFolderStreamUpdates(previous, updates));
      } catch {
        reportError("Failed to refresh folders.");
      }
    })();
  }, [activeAccountId, apiFetch, reconcileMessageFlags, reportError, reportResponseError, setFolders]);

  const updateFlagState = useCallback(async (
    message: Message,
    flag: SystemFlag,
    value: boolean,
    shouldRetry?: () => boolean
  ) => {
    // Auto-read (shouldRetry) is gated by role elsewhere and never notifies.
    if (!shouldRetry && deniedUpFront(message, flagMutationAction({ flag, value }))) return;
    try {
      const flags = await requestMessageFlagMutation(message, { flag, value }, shouldRetry);
      if (!flags) return;
      applyFlagsResults([{ message, nextFlags: flags }], "update-flag-state");
      queueFilteredSearchRefresh(hasFilteredSearchCriteria);
    } catch {
      reportError(tn("flagFailed"));
    }
  }, [
    applyFlagsResults, deniedUpFront, hasFilteredSearchCriteria, queueFilteredSearchRefresh, reportError,
    requestMessageFlagMutation, tn
  ]);

  const updateKeywordFlag = useCallback(async (
    message: Message,
    keyword: string,
    value: boolean
  ) => {
    if (deniedUpFront(message, flagMutationAction({ keyword, value }))) return;
    try {
      const flags = await requestMessageFlagMutation(message, { keyword, value });
      if (!flags) return;
      applyFlagsResults([{ message, nextFlags: flags }], "update-keyword-flag");
      queueFilteredSearchRefresh(hasFilteredSearchCriteria);
    } catch {
      reportError(tn("keywordFailed"));
    }
  }, [
    applyFlagsResults, deniedUpFront, hasFilteredSearchCriteria, queueFilteredSearchRefresh, reportError,
    requestMessageFlagMutation, tn
  ]);

  const applyBulkFlagResults = useCallback((
    messages: Message[],
    results: Array<{ messageId: string; flags: string[]; accountId?: string }>,
    source: string
  ) => {
    // Keyed by mailbox too: the same message can be listed for two mailboxes.
    const key = (accountId: string | undefined, messageId: string) => `${accountId || activeAccountId}\u0000${messageId}`;
    const flagsByMessageId = new Map(results.map((r) => [key(r.accountId, r.messageId), r.flags]));
    const pairs = messages
      .map((message) => {
        const nextFlags = flagsByMessageId.get(key(message.accountId, message.id));
        return nextFlags ? { message, nextFlags } : null;
      })
      .filter((pair): pair is { message: Message; nextFlags: string[] } => pair !== null);
    applyFlagsResults(pairs, source);
  }, [activeAccountId, applyFlagsResults]);

  const updateFlagStateBulk = useCallback(async (
    messages: Message[],
    flag: SystemFlag,
    value: boolean
  ) => {
    if (messages.length === 0) return;
    try {
      const results = await requestBulkFlagMutation(messages, { flag, value });
      if (!results) return;
      applyBulkFlagResults(messages, results, "update-flag-state-bulk");
      queueFilteredSearchRefresh(hasFilteredSearchCriteria);
    } catch {
      reportError(tn("flagFailed"));
    }
  }, [
    applyBulkFlagResults, hasFilteredSearchCriteria, queueFilteredSearchRefresh, reportError,
    requestBulkFlagMutation, tn
  ]);

  const updateKeywordFlagBulk = useCallback(async (
    messages: Message[],
    keyword: string,
    value: boolean
  ) => {
    if (messages.length === 0) return;
    try {
      const results = await requestBulkFlagMutation(messages, { keyword, value });
      if (!results) return;
      applyBulkFlagResults(messages, results, "update-keyword-flag-bulk");
      queueFilteredSearchRefresh(hasFilteredSearchCriteria);
    } catch {
      reportError(tn("keywordFailed"));
    }
  }, [
    applyBulkFlagResults, hasFilteredSearchCriteria, queueFilteredSearchRefresh, reportError,
    requestBulkFlagMutation, tn
  ]);

  const handleSetCategory = useCallback(async (
    message: Message,
    category: "newsletter" | "notification" | "transactional" | null
  ) => {
    setPendingMessageActions((prev) => new Set(prev).add(message.id));
    try {
      const res = await apiFetch(buildAccountMessageActionPath(message.accountId || activeAccountId, message.id, "category"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category })
      });
      if (!res.ok) {
        reportError(await readErrorMessage(res));
        return;
      }

      const data = (await res.json()) as {
        ok: boolean;
        message?: Message;
        previousCategory?: string | null;
        nextCategory?: string | null;
      };
      const updated = data.message;
      if (!updated) return;

      const shouldKeepUpdatedMessage = shouldKeepMessageInCurrentResults(updated);
      const applyCategoryPatch = (item: Message): Message => ({
        ...item,
        category: updated.category ?? null,
        categoryScore:
          typeof updated.categoryScore === "number" ? updated.categoryScore : null,
        categorySignals: updated.categorySignals ?? []
      });
      updateMessagesWithCurrentResultPrune(
        (item) => (item.id === message.id ? applyCategoryPatch(item) : item),
        { source: "set-category" }
      );
      setActiveTopicSuggestionMessages((prev) => {
        if (!prev.some((item) => item.id === message.id)) return prev;
        return prev.map((item) =>
          item.id === message.id ? applyCategoryPatch(item) : item
        );
      });
      updateThreadCacheWithCategory(
        message.id,
        updated.category ?? null,
        typeof updated.categoryScore === "number" ? updated.categoryScore : null,
        updated.categorySignals ?? []
      );
      if (viewMessageId === message.id && !shouldKeepUpdatedMessage) {
        setViewMessage(null);
        setActiveMessageId("");
      }
      queueFilteredSearchRefresh(hasFilteredSearchCriteria);
      pushNotice({
        type: "success",
        title: category ? tn("categoryUpdated") : tn("categoryRemoved"),
        description: getMessageSubjectForNotice(message, tn("noSubject"))
      });
    } catch {
      reportError(tn("categoryFailed"));
    } finally {
      setPendingMessageActions((prev) => {
        const next = new Set(prev);
        next.delete(message.id);
        return next;
      });
    }
  }, [
    activeAccountId,
    apiFetch,
    hasFilteredSearchCriteria,
    pushNotice,
    queueFilteredSearchRefresh,
    readErrorMessage,
    reportError,
    setActiveMessageId,
    setActiveTopicSuggestionMessages,
    setPendingMessageActions,
    setViewMessage,
    shouldKeepMessageInCurrentResults,
    updateMessagesWithCurrentResultPrune,
    updateThreadCacheWithCategory,
    viewMessageId,
    tn
  ]);

  const transitionTodoState = useCallback(async (
    msg: Message,
    fromKeyword: string,
    toKeyword: string
  ): Promise<void> => {
    const removeFlags = await requestMessageFlagMutation(msg, {
      keyword: fromKeyword,
      value: false
    });
    if (!removeFlags) return;

    const finalFlags = await requestMessageFlagMutation(msg, {
      keyword: toKeyword,
      value: true
    });
    if (!finalFlags) return;

    reconcileMessageFlags(msg, finalFlags, "transition-todo-state");
  }, [
    reconcileMessageFlags,
    requestMessageFlagMutation
  ]);

  const clearTodoFlag = useCallback(async (message: Message) => {
    await updateKeywordFlag(message, TODO_FLAG, false);
  }, [updateKeywordFlag]);

  const toggleTodoFlag = useCallback(async (
    message: Message,
    collapsedThreadMessages?: Message[],
    clickedBadge?: "todo" | "done"
  ) => {
    if (deniedUpFront(message, hasTodoFlag(message) ? "done" : "todo")) return;
    try {
      if (collapsedThreadMessages && collapsedThreadMessages.length > 0 && clickedBadge) {
        if (clickedBadge === "todo") {
          const todoMessages = collapsedThreadMessages.filter((m) => hasTodoFlag(m));
          if (todoMessages.length > 0) {
            await Promise.all(
              todoMessages.map((m) => transitionTodoState(m, TODO_FLAG, DONE_FLAG))
            );
            queueFilteredSearchRefresh(hasFilteredSearchCriteria);
          }
        } else if (clickedBadge === "done") {
          const doneMessages = collapsedThreadMessages.filter((m) => hasDoneFlag(m));
          if (doneMessages.length > 0) {
            await Promise.all(
              doneMessages.map((m) => transitionTodoState(m, DONE_FLAG, TODO_FLAG))
            );
            queueFilteredSearchRefresh(hasFilteredSearchCriteria);
          }
        }
        return;
      }

      const hasTodo = hasTodoFlag(message);
      const hasDone = hasDoneFlag(message);

      let finalFlags = message.flags ?? [];

      if (hasTodo) {
        const removeFlags = await requestMessageFlagMutation(message, {
          keyword: TODO_FLAG,
          value: false
        });
        if (!removeFlags) return;

        const addFlags = await requestMessageFlagMutation(message, {
          keyword: DONE_FLAG,
          value: true
        });
        if (!addFlags) return;
        finalFlags = addFlags;
      } else if (hasDone) {
        const removeFlags = await requestMessageFlagMutation(message, {
          keyword: DONE_FLAG,
          value: false
        });
        if (!removeFlags) return;

        const addFlags = await requestMessageFlagMutation(message, {
          keyword: TODO_FLAG,
          value: true
        });
        if (!addFlags) return;
        finalFlags = addFlags;
      } else {
        const flags = await requestMessageFlagMutation(message, {
          keyword: TODO_FLAG,
          value: true
        });
        if (!flags) return;
        finalFlags = flags;
      }

      reconcileMessageFlags(message, finalFlags, "toggle-todo-flag");
      queueFilteredSearchRefresh(hasFilteredSearchCriteria);
    } catch {
      reportError(tn("todoFailed"));
    }
  }, [
    deniedUpFront, hasFilteredSearchCriteria, queueFilteredSearchRefresh, reconcileMessageFlags, reportError,
    requestMessageFlagMutation, transitionTodoState, tn
  ]);

  const toggleFlaggedFlag = useCallback(async (
    message: Message,
    collapsedThreadMessages?: Message[]
  ) => {
    if (collapsedThreadMessages && collapsedThreadMessages.length > 0) {
      const flaggedMessages = collapsedThreadMessages.filter((m) => isFlaggedMessage(m));
      if (flaggedMessages.length > 0) {
        await Promise.all(
          flaggedMessages.map((m) => updateFlagState(m, "flagged", false))
        );
      }
      return;
    }
    await updateFlagState(message, "flagged", !isFlaggedMessage(message));
  }, [updateFlagState]);

  return {
    handleArchiveMessage,
    handleUnsubscribe,
    handleMarkSpam,
    handleMarkNotSpam,
    updateFlagState,
    updateFlagStateBulk,
    updateKeywordFlag,
    updateKeywordFlagBulk,
    handleSetCategory,
    transitionTodoState,
    clearTodoFlag,
    toggleTodoFlag,
    toggleFlaggedFlag
  };
}
