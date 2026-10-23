"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type React from "react";
import type { Message } from "@/lib/data";
import type { MessageGroupMeta } from "./messagelist/listModel";
import { computeGroupMeta } from "./utils/messageHelpers";
import {
  mergeCollapsedGroupsWithMeta,
  mergeCollapsedThreadsWithMessages
} from "./messagelist/listState";
import { mergeLoadedMessageCount, resolveLoadedMessageCount } from "./utils/listCount";
import { logListDebug, summarizeMessageForListDebug } from "./messagelist/listDebug";
import type { SearchBadgesState } from "./useSearchState";
import { buildMessageListQueryUrl } from "./messageListQueryUrl";
import type { ThreadDateSource } from "@/lib/threadDate";
import type { MessageListSortBy } from "@/lib/messageListSort";
import type { MailboxViewCache } from "./mailboxViewCache";

type ApiFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const LIST_DEBUG_SAMPLE_LIMIT = 12;

export type UseMessageDataParams = {
  messagesKey: string;
  activeAccountId: string;
  searchScope: "folder" | "all";
  activeFolderId: string;
  isRelatedSearch: boolean;
  relatedQueryId: string;
  selectedSearchFields: string[];
  searchBadges: SearchBadgesState;
  effectiveSearchBadges: string[];
  currentSearchExcludedFolderIds: string[];
  supportsThreads: boolean;
  groupBy: string;
  threadDateSource: ThreadDateSource;
  sortBy: MessageListSortBy;
  query: string;
  authState: "loading" | "ok" | "unauth";
  apiFetch: ApiFetch;
  readErrorMessage: (res: Response) => Promise<string>;
  reportError: (message: string) => void;
  setRelatedContext: (ctx: { id: string; subject?: string } | null) => void;
  relatedContext: { id: string; subject?: string } | null;
  setCollapsedGroups: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setCollapsedThreads: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  currentKeyRef: React.MutableRefObject<string>;
  // Recently visited lists: a revisit shows the cached first page while it is re-read.
  viewCache?: MailboxViewCache;
};

export function useMessageData({
  messagesKey,
  activeAccountId,
  searchScope,
  activeFolderId,
  isRelatedSearch,
  relatedQueryId,
  selectedSearchFields,
  searchBadges,
  effectiveSearchBadges,
  currentSearchExcludedFolderIds,
  supportsThreads,
  groupBy,
  threadDateSource,
  sortBy,
  query,
  authState,
  apiFetch,
  readErrorMessage,
  reportError,
  setRelatedContext,
  relatedContext,
  setCollapsedGroups,
  setCollapsedThreads,
  currentKeyRef,
  viewCache
}: UseMessageDataParams) {
  const [authoritativeRevision, setAuthoritativeRevision] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [groupMeta, setGroupMeta] = useState<MessageGroupMeta[]>([]);
  const [messagesPage, setMessagesPage] = useState(1);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [loadedMessageCount, setLoadedMessageCount] = useState(0);
  const [totalMessages, setTotalMessages] = useState<number | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [refreshingMessages, setRefreshingMessages] = useState(false);
  const [messageListError, setMessageListError] = useState<string | null>(null);

  const filteredSearchRefreshTimerRef = useRef<number | null>(null);
  const lastRequestRef = useRef<{ key: string; page: number } | null>(null);
  const messageMutationVersionRef = useRef(0);
  const listReplacementLogFingerprintRef = useRef("");
  // The page load in flight. A load for a superseded key is aborted, so it never
  // holds back the first page of the new key.
  const inFlightLoadRef = useRef<{ key: string; controller: AbortController } | null>(null);
  // Page 1 of another mailbox's inbox, requested while the switch to it persists the
  // selection and reads its folders. Only that mailbox's first page-1 load may take it,
  // and only with a byte-identical URL; any other outcome aborts it.
  // The key whose first page is on screen from a successful read; cleared by errors.
  const shownPageKeyRef = useRef<string | null>(null);
  const firstPagePrefetchRef = useRef<{
    accountId: string;
    url: string;
    response: Promise<Response>;
    controller: AbortController;
    timer: number;
  } | null>(null);
  // Size of the last first page read for the key on screen; a list paged further is
  // cached as its first page only.
  const firstPageSizeRef = useRef<{ key: string; itemCount: number; loadedCount: number } | null>(null);
  // A new key's first load reads page 1 even if it runs before the page reset renders.
  const firstLoadKeyRef = useRef<string | null>(null);

  // Cleanup filteredSearchRefreshTimer and the page load on unmount
  useEffect(() => {
    return () => {
      if (filteredSearchRefreshTimerRef.current !== null) {
        window.clearTimeout(filteredSearchRefreshTimerRef.current);
        filteredSearchRefreshTimerRef.current = null;
      }
      inFlightLoadRef.current?.controller.abort();
      inFlightLoadRef.current = null;
      const prefetch = firstPagePrefetchRef.current;
      firstPagePrefetchRef.current = null;
      if (prefetch) {
        window.clearTimeout(prefetch.timer);
        prefetch.controller.abort();
      }
    };
  }, []);

  const logListReplacement = (
    source: string,
    prevMessages: Message[],
    nextMessages: Message[]
  ) => {
    const prevScoped = prevMessages.filter((msg) => msg.accountId === activeAccountId);
    const nextScoped = nextMessages.filter((msg) => msg.accountId === activeAccountId);
    const nextIds = new Set(nextScoped.map((msg) => msg.id));
    const removed = prevScoped.filter((msg) => !nextIds.has(msg.id));
    const foreign = nextMessages.filter((msg) => msg.accountId !== activeAccountId);
    if (removed.length === 0 && foreign.length === 0) return;
    const removedSample = removed
      .slice(0, LIST_DEBUG_SAMPLE_LIMIT)
      .map((msg) => summarizeMessageForListDebug(msg));
    const foreignSample = foreign
      .slice(0, LIST_DEBUG_SAMPLE_LIMIT)
      .map((msg) => summarizeMessageForListDebug(msg));
    const fingerprint = [
      source,
      activeAccountId,
      activeFolderId,
      searchScope,
      removed.length,
      foreign.length,
      removedSample.map((msg) => msg?.id ?? "").join(",")
    ].join("|");
    if (listReplacementLogFingerprintRef.current === fingerprint) return;
    listReplacementLogFingerprintRef.current = fingerprint;
    logListDebug("warn", "list replacement changed membership", {
      source,
      activeAccountId,
      activeFolderId,
      searchScope,
      previousCount: prevScoped.length,
      nextCount: nextScoped.length,
      removedCount: removed.length,
      foreignCount: foreign.length,
      removedSample,
      foreignSample
    });
  };

  const buildQueryUrl = (page: number) =>
    buildMessageListQueryUrl({
      accountId: activeAccountId,
      page,
      groupBy,
      searchScope,
      activeFolderId,
      currentSearchExcludedFolderIds,
      supportsThreads,
      threadDateSource,
      sortBy,
      isRelatedSearch,
      relatedQueryId,
      query,
      selectedSearchFields,
      searchBadges: { attachments: searchBadges.attachments },
      effectiveSearchBadges
    });

  // Free-text and related searches are not cached: every query is a new key and
  // would push the visited mailboxes out.
  const cacheableView = Boolean(viewCache) && !query.trim();
  const firstPageUrl = buildQueryUrl(1);

  // Reset list state when the query key changes; a list visited earlier starts from
  // its cached first page and the page-1 load below re-reads it. A layout effect, so
  // the new key never paints the previous key's rows or an empty list first.
  useLayoutEffect(() => {
    if (filteredSearchRefreshTimerRef.current !== null) {
      window.clearTimeout(filteredSearchRefreshTimerRef.current);
      filteredSearchRefreshTimerRef.current = null;
    }
    const cached = cacheableView ? viewCache?.readList(firstPageUrl, activeAccountId) ?? null : null;
    setMessages(cached?.rows ?? []);
    setMessagesPage(1);
    setHasMoreMessages(cached?.hasMore ?? true);
    setLoadedMessageCount(cached?.loadedCount ?? 0);
    setTotalMessages(cached?.total ?? null);
    lastRequestRef.current = null;
    firstLoadKeyRef.current = messagesKey;
    // Nothing for the new key is on screen from a read yet.
    shownPageKeyRef.current = null;
    setGroupMeta(cached?.groupMeta ?? []);
    setMessageListError(null);
    if (cached) {
      setCollapsedGroups((prev) => mergeCollapsedGroupsWithMeta(prev, cached.groupMeta));
      setCollapsedThreads((prev) => mergeCollapsedThreadsWithMessages(prev, cached.rows));
    }
    const superseded = inFlightLoadRef.current;
    if (superseded && superseded.key !== messagesKey) {
      superseded.controller.abort();
      inFlightLoadRef.current = null;
      setLoadingMessages(false);
    }
    // Only a key change resets the list; the URL and cache inputs are derived from the same render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messagesKey]);

  // The first page on screen, with local changes (read state, deletions, moves), is
  // what a revisit shows. Only a list confirmed by a read for this key is written; an
  // emptied list drops the entry, so a revisit loads as usual.
  useEffect(() => {
    if (!viewCache || !cacheableView || shownPageKeyRef.current !== messagesKey) return;
    const firstPage = firstPageSizeRef.current?.key === messagesKey ? firstPageSizeRef.current : null;
    if (messagesPage > 1 && !firstPage) return;
    const pagedFurther = messagesPage > 1 && firstPage !== null;
    viewCache.writeList(firstPageUrl, {
      accountId: activeAccountId,
      rows: pagedFurther ? messages.slice(0, firstPage.itemCount) : messages,
      groupMeta,
      hasMore: pagedFurther || hasMoreMessages,
      total: totalMessages,
      loadedCount: pagedFurther ? firstPage.loadedCount : loadedMessageCount
    });
  }, [viewCache, cacheableView, messagesKey, firstPageUrl, activeAccountId, messages, groupMeta, hasMoreMessages,
    totalMessages, loadedMessageCount, messagesPage]);

  // The server denied the mailbox: nothing it showed stays on screen or in the cache.
  const dropDeniedList = (status: number, showsList: boolean) => {
    if (status !== 401 && status !== 403) return;
    viewCache?.dropAccount(activeAccountId);
    if (!showsList) return;
    setMessages([]);
    setGroupMeta([]);
    setLoadedMessageCount(0);
    setTotalMessages(null);
  };

  const dropFirstPagePrefetch = useCallback(() => {
    const prefetch = firstPagePrefetchRef.current;
    if (!prefetch) return;
    firstPagePrefetchRef.current = null;
    window.clearTimeout(prefetch.timer);
    prefetch.controller.abort();
  }, []);

  // The plain inbox view carries over to the next mailbox unchanged (a switch resets
  // search, badges and scope), so its page-1 URL is known before the switch commits.
  // Other views are not predicted; the list then loads after the commit as before.
  const buildInboxFirstPageUrl = (accountId: string) =>
    buildMessageListQueryUrl({
      accountId,
      page: 1,
      groupBy,
      searchScope: "folder",
      activeFolderId: `${accountId}:INBOX`,
      currentSearchExcludedFolderIds: [],
      supportsThreads,
      threadDateSource,
      sortBy,
      isRelatedSearch: false,
      relatedQueryId: "",
      query: "",
      selectedSearchFields,
      searchBadges: { attachments: false },
      effectiveSearchBadges: []
    });
  const plainInboxView =
    searchScope === "folder" &&
    !isRelatedSearch &&
    !query.trim() &&
    !searchBadges.attachments &&
    effectiveSearchBadges.length === 0 &&
    Boolean(activeAccountId) &&
    activeFolderId === `${activeAccountId}:INBOX`;
  const prefetchInputsRef = useRef({ activeAccountId, apiFetch, plainInboxView, buildInboxFirstPageUrl });
  useLayoutEffect(() => {
    prefetchInputsRef.current = { activeAccountId, apiFetch, plainInboxView, buildInboxFirstPageUrl };
  });
  const prefetchFirstPage = useCallback((accountId: string) => {
    dropFirstPagePrefetch();
    const inputs = prefetchInputsRef.current;
    if (!inputs.plainInboxView || !accountId || accountId === inputs.activeAccountId) return;
    const url = inputs.buildInboxFirstPageUrl(accountId);
    const controller = new AbortController();
    const response = inputs.apiFetch(url, { signal: controller.signal });
    // A prefetch that is dropped before anyone awaits it must not surface as unhandled.
    response.catch(() => {});
    const timer = window.setTimeout(() => {
      if (firstPagePrefetchRef.current?.controller === controller) dropFirstPagePrefetch();
    }, 10_000);
    firstPagePrefetchRef.current = { accountId, url, response, controller, timer };
  }, [dropFirstPagePrefetch]);

  const takeFirstPagePrefetch = (url: string) => {
    const prefetch = firstPagePrefetchRef.current;
    if (!prefetch || prefetch.accountId !== activeAccountId) return null;
    if (prefetch.url !== url) {
      dropFirstPagePrefetch();
      return null;
    }
    firstPagePrefetchRef.current = null;
    window.clearTimeout(prefetch.timer);
    return prefetch;
  };

  // Paginated message load effect.
  useEffect(() => {
    const loadMessages = async () => {
      if (!activeAccountId) return;
      if (searchScope === "folder" && !isRelatedSearch && !activeFolderId) return;
      const page = firstLoadKeyRef.current === messagesKey ? 1 : messagesPage;
      // A first page is always read: a cached first page may say there is no more.
      if (inFlightLoadRef.current || (!hasMoreMessages && page > 1)) return;
      if (
        lastRequestRef.current?.key === messagesKey &&
        lastRequestRef.current?.page === page
      ) {
        return;
      }
      const requestKey = messagesKey;
      const requestMutationVersion = messageMutationVersionRef.current;
      const load = { key: requestKey, controller: new AbortController() };
      inFlightLoadRef.current = load;
      lastRequestRef.current = { key: requestKey, page };
      if (page === 1) firstLoadKeyRef.current = null;
      try {
        setLoadingMessages(true);
        const url = buildQueryUrl(page);
        const prefetched = page === 1 ? takeFirstPagePrefetch(url) : null;
        if (prefetched) {
          load.controller.signal.addEventListener("abort", () => prefetched.controller.abort(), { once: true });
        }
        const messagesRes = await (prefetched?.response ?? apiFetch(url, { signal: load.controller.signal }));
        if (load.controller.signal.aborted) return;
        if (messagesRes.ok) {
          const data = (await messagesRes.json()) as {
            items: Message[];
            hasMore: boolean;
            groups?: { key: string; label: string; count: number }[];
            total?: number;
            baseCount?: number;
            relatedSubject?: string;
          };
          const items = Array.isArray(data?.items) ? data.items.filter(Boolean) : [];
          const foreignItems = items.filter((item) => item.accountId !== activeAccountId);
          if (foreignItems.length > 0) {
            logListDebug("error", "list API returned foreign-account rows", {
              source: "loadMessages",
              activeAccountId,
              foreignCount: foreignItems.length,
              sample: foreignItems
                .slice(0, LIST_DEBUG_SAMPLE_LIMIT)
                .map((item) => summarizeMessageForListDebug(item))
            });
          }
          if (currentKeyRef.current !== requestKey) return;
          if (messageMutationVersionRef.current !== requestMutationVersion) {
            lastRequestRef.current = null;
            return;
          }
          if (isRelatedSearch) {
            setRelatedContext({ id: relatedQueryId, subject: data.relatedSubject });
          } else if (relatedContext) {
            setRelatedContext(null);
          }
          setAuthoritativeRevision(value => value + 1);
          setMessages((prev) => {
            if (page === 1) {
              logListReplacement("loadMessages-page1", prev, items);
              return items;
            }
            const prevIds = new Set(prev.map((msg) => msg.id));
            const duplicateIncoming = items.filter((msg) => prevIds.has(msg.id));
            if (duplicateIncoming.length > 0) {
              logListDebug("warn", "paged list append contains duplicate ids", {
                source: "loadMessages-append",
                activeAccountId,
                duplicateCount: duplicateIncoming.length,
                sample: duplicateIncoming
                  .slice(0, LIST_DEBUG_SAMPLE_LIMIT)
                  .map((item) => summarizeMessageForListDebug(item))
              });
            }
            return [...prev, ...items];
          });
          setLoadedMessageCount((prev) =>
            mergeLoadedMessageCount({
              page,
              previousCount: prev,
              itemCount: items.length,
              baseCount: data?.baseCount
            })
          );
          setHasMoreMessages(Boolean(data?.hasMore));
          setTotalMessages(typeof data?.total === "number" ? data.total : null);
          if (page === 1) {
            shownPageKeyRef.current = requestKey;
            firstPageSizeRef.current = {
              key: requestKey,
              itemCount: items.length,
              loadedCount: resolveLoadedMessageCount(items.length, data?.baseCount)
            };
            const nextMeta = Array.isArray(data?.groups)
              ? data.groups
              : computeGroupMeta(items);
            setGroupMeta(nextMeta);
            setCollapsedGroups((prev) => mergeCollapsedGroupsWithMeta(prev, nextMeta));
            setCollapsedThreads((prev) => mergeCollapsedThreadsWithMessages(prev, items));
          }
          setMessageListError(null);
        } else {
          shownPageKeyRef.current = null;
          dropDeniedList(messagesRes.status, true);
          const errorMessage = await readErrorMessage(messagesRes);
          reportError(errorMessage);
          setMessageListError(errorMessage || "Failed to load messages.");
        }
      } catch {
        if (load.controller.signal.aborted) return;
        shownPageKeyRef.current = null;
        lastRequestRef.current = null;
        reportError("Failed to load messages.");
        setMessageListError("Failed to load messages.");
      } finally {
        // Only the current load owns the flag; a superseded one was released on abort.
        if (inFlightLoadRef.current === load) {
          inFlightLoadRef.current = null;
          setLoadingMessages(false);
        }
      }
    };

    loadMessages();
    // Dep array intentionally omits query/searchScope/etc. — messagesKey encodes all those values;
    // the reset effect above handles key changes and triggers a fresh page-1 load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAccountId, hasMoreMessages, loadingMessages, messagesKey, messagesPage, authState]);

  // skipIfCurrent: the caller knows the server data behind the list did not change
  // (a "new" sync that wrote nothing); a first page already on screen is kept.
  const refreshMailboxData = async (options?: { skipIfCurrent?: boolean }): Promise<boolean> => {
    if (searchScope === "folder" && !isRelatedSearch && !activeFolderId) {
      return false;
    }
    if (options?.skipIfCurrent && shownPageKeyRef.current === messagesKey) {
      return true;
    }
    setRefreshingMessages(true);
    const requestKey = messagesKey;
    const requestMutationVersion = messageMutationVersionRef.current;
    try {
      const messageRes = await apiFetch(buildQueryUrl(1));
      if (!messageRes.ok) {
        shownPageKeyRef.current = null;
        dropDeniedList(messageRes.status, currentKeyRef.current === requestKey);
        const message = await readErrorMessage(messageRes);
        reportError(message || "Failed to refresh mailbox data.");
        setMessageListError(message || "Failed to load messages.");
        return false;
      }
      const messageData = (await messageRes.json()) as {
        items: Message[];
        hasMore: boolean;
        groups?: { key: string; label: string; count: number }[];
        total?: number;
        baseCount?: number;
        relatedSubject?: string;
      };
      const nextMessages = Array.isArray(messageData?.items)
        ? messageData.items.filter(Boolean)
        : [];
      const foreignItems = nextMessages.filter((item) => item.accountId !== activeAccountId);
      if (foreignItems.length > 0) {
        logListDebug("error", "refresh returned foreign-account rows", {
          source: "refreshMailboxData",
          activeAccountId,
          foreignCount: foreignItems.length,
          sample: foreignItems
            .slice(0, LIST_DEBUG_SAMPLE_LIMIT)
            .map((item) => summarizeMessageForListDebug(item))
        });
      }
      if (currentKeyRef.current !== requestKey) {
        return false;
      }
      if (messageMutationVersionRef.current !== requestMutationVersion) {
        return false;
      }
      shownPageKeyRef.current = requestKey;
      firstPageSizeRef.current = {
        key: requestKey,
        itemCount: nextMessages.length,
        loadedCount: resolveLoadedMessageCount(nextMessages.length, messageData?.baseCount)
      };
      setAuthoritativeRevision(value => value + 1);
      setMessages((prev) => {
        logListReplacement("refreshMailboxData", prev, nextMessages);
        return nextMessages;
      });
      setLoadedMessageCount(
        resolveLoadedMessageCount(nextMessages.length, messageData?.baseCount)
      );
      setMessagesPage(1);
      setHasMoreMessages(Boolean(messageData?.hasMore));
      setTotalMessages(typeof messageData?.total === "number" ? messageData.total : null);
      const nextMeta = Array.isArray(messageData?.groups)
        ? messageData.groups
        : computeGroupMeta(nextMessages);
      if (isRelatedSearch) {
        setRelatedContext({ id: relatedQueryId, subject: messageData.relatedSubject });
      } else if (relatedContext) {
        setRelatedContext(null);
      }
      setGroupMeta(nextMeta);
      setCollapsedGroups((prev) => mergeCollapsedGroupsWithMeta(prev, nextMeta));
      setCollapsedThreads((prev) => mergeCollapsedThreadsWithMessages(prev, nextMessages));
      setMessageListError(null);
      return true;
    } finally {
      setRefreshingMessages(false);
    }
  };

  const queueFilteredSearchRefresh = (hasFilteredSearchCriteria: boolean) => {
    if (!hasFilteredSearchCriteria) return;
    if (filteredSearchRefreshTimerRef.current !== null) return;
    filteredSearchRefreshTimerRef.current = window.setTimeout(() => {
      filteredSearchRefreshTimerRef.current = null;
      void refreshMailboxData();
    }, 120);
  };

  const markMessagesMutated = useCallback(() => {
    messageMutationVersionRef.current += 1;
  }, []);

  return {
    authoritativeRevision,
    messages,
    setMessages,
    groupMeta,
    setGroupMeta,
    messagesPage,
    setMessagesPage,
    hasMoreMessages,
    setHasMoreMessages,
    loadedMessageCount,
    totalMessages,
    setTotalMessages,
    loadingMessages,
    refreshingMessages,
    messageListError,
    setMessageListError,
    refreshMailboxData,
    queueFilteredSearchRefresh,
    messageMutationVersionRef,
    currentKeyRef,
    markMessagesMutated,
    prefetchFirstPage,
    dropFirstPagePrefetch
  };
}
