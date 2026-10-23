"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildAccountApiPath,
  buildAccountMessageActionPath,
  buildAccountMessagePath,
  buildAccountMessageSourcePath
} from "@/lib/accountApiPaths";
import type { Message } from "@/lib/data";
import { mergeLocalOnlyMessageState } from "@/lib/messageLocalState";
import { isMessageContentUnloaded, needsMessageContentHydration } from "@/lib/ui/messageView";
import {
  evictMessagesFromThreadCacheMap,
  mergeThreadWindowItems,
  withLoadedMessageBody,
  updateThreadCacheMapWithCategory,
  updateThreadCacheMapWithFlags,
  updateThreadCacheWithMessageMap,
  upsertThreadInCache
} from "./utils/threadContentCache";
import { MESSAGE_BODY_CACHE_LIMIT, THREAD_CACHE_LIMIT } from "./constants";

type ApiFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const THREAD_LOAD_FAILURE_MESSAGE = "Failed to load message content.";

/** Paging state of the bounded reader window of one cached thread. */
export type ThreadWindowState = {
  anchorId: string | null;
  total: number;
  hasOlder: boolean;
  olderCursor: string | null;
  hasNewer: boolean;
  newerCursor: string | null;
  /** Header rows of parents outside the loaded rows (reply references only). */
  placeholders: Message[];
  loading: "older" | "newer" | null;
  error: string | null;
};

type ThreadWindowResponse = {
  items?: Message[];
  placeholders?: Message[];
  window?: Omit<ThreadWindowState, "placeholders" | "loading" | "error">;
};

export type ThreadReadRequest = {
  /** Requests with the same key share one in-flight read; a new key aborts the previous one. */
  key: string;
  threadId: string;
  anchorMessageId: string;
  /** Bounded header window over the thread; otherwise headers for `messageIds` only. */
  windowed: boolean;
  messageIds: string[];
  excludeFolderIds: string[];
  groupBy: string;
  threadDateSource: string;
};

export type ThreadPageRequest = Pick<
  ThreadReadRequest,
  "threadId" | "excludeFolderIds" | "groupBy" | "threadDateSource"
> & { direction: "older" | "newer" };

const bodyCacheKey = (message: Pick<Message, "accountId" | "id">) =>
  `${message.accountId}:${message.id}`;

export type UseThreadContentParams = {
  activeAccountId: string;
  apiFetch: ApiFetch;
  readErrorMessage: (res: Response) => Promise<string>;
  reportError: (message: string) => void;
  updateMessagesWithCurrentResultPrune: (
    updater: (message: Message) => Message | null,
    options?: { source?: string }
  ) => void;
  messageById: Map<string, Message>;
  threadMessagesRef: { current: Message[] };
};

export function useThreadContent({
  activeAccountId,
  apiFetch,
  readErrorMessage,
  reportError,
  updateMessagesWithCurrentResultPrune,
  messageById,
  threadMessagesRef
}: UseThreadContentParams) {
  const [threadRelatedMessages, setThreadRelatedMessages] = useState<Message[]>([]);
  const [threadContentById, setThreadContentById] = useState<Record<string, Message[]>>({});
  const [threadEvictVersion, setThreadEvictVersion] = useState(0);
  const [threadContentLoading, setThreadContentLoading] = useState<string | null>(null);
  const [threadContentErrorById, setThreadContentErrorById] = useState<Record<string, string>>(
    {}
  );
  const [loadingSource, setLoadingSource] = useState<Record<string, boolean>>({});
  const [messageContentLoading, setMessageContentLoading] = useState<Record<string, boolean>>({});
  const [messageContentErrorById, setMessageContentErrorById] = useState<Record<string, string>>(
    {}
  );
  const [threadWindowById, setThreadWindowById] = useState<Record<string, ThreadWindowState>>({});
  // Bodies read per message on expand, kept apart from the header rows of the
  // thread cache and overlaid when a card renders (`withLoadedMessageBody`).
  const [messageBodyById, setMessageBodyById] = useState<Record<string, Message>>({});

  const threadContentByIdRef = useRef(threadContentById);
  const threadCacheOrderRef = useRef<string[]>([]);
  const loadingSourceRef = useRef<Record<string, boolean>>({});
  const messageContentLoadingRef = useRef<Record<string, boolean>>({});
  const sourceFetchRef = useRef<Map<string, Promise<string | null>>>(new Map());
  const autoHydrationInFlightRef = useRef<Map<string, Promise<Message | null>>>(new Map());
  const autoHydrationAttemptAtRef = useRef<Record<string, number>>({});
  const messageBodyByIdRef = useRef(messageBodyById);
  const messageBodyOrderRef = useRef<string[]>([]);
  const bodyFetchInFlightRef = useRef<Map<string, Promise<Message | null>>>(new Map());
  const threadWindowByIdRef = useRef(threadWindowById);
  const threadReadRef = useRef<{
    key: string;
    threadId: string;
    controller: AbortController;
    promise: Promise<void>;
  } | null>(null);
  const threadPageControllersRef = useRef<Map<string, AbortController>>(new Map());
  // Bumped on account reset so reads started for the previous scope cannot write back.
  const scopeVersionRef = useRef(0);

  useEffect(() => {
    threadContentByIdRef.current = threadContentById;
  }, [threadContentById]);

  useEffect(() => {
    loadingSourceRef.current = loadingSource;
  }, [loadingSource]);

  useEffect(() => {
    messageContentLoadingRef.current = messageContentLoading;
  }, [messageContentLoading]);

  useEffect(() => {
    messageBodyByIdRef.current = messageBodyById;
  }, [messageBodyById]);

  useEffect(() => {
    threadWindowByIdRef.current = threadWindowById;
  }, [threadWindowById]);

  const upsertThreadCache = useCallback((threadId: string, items: Message[]) => {
    setThreadContentById((prev) => {
      const result = upsertThreadInCache(
        prev,
        threadCacheOrderRef.current,
        threadId,
        items,
        THREAD_CACHE_LIMIT
      );
      threadCacheOrderRef.current = result.order;
      return result.next;
    });
  }, []);

  const clearThreadContentError = useCallback((threadId: string) => {
    setThreadContentErrorById((prev) => {
      if (!(threadId in prev)) return prev;
      const next = { ...prev };
      delete next[threadId];
      return next;
    });
  }, []);

  const setThreadContentError = useCallback(
    (threadId: string, message = "Failed to load message content.") => {
      setThreadContentErrorById((prev) =>
        prev[threadId] === message ? prev : { ...prev, [threadId]: message }
      );
    },
    []
  );

  const setMessageContentLoadingState = useCallback((messageId: string, loading: boolean) => {
    setMessageContentLoading((prev) => {
      const isLoading = Boolean(prev[messageId]);
      if (loading && isLoading) return prev;
      if (!loading && !isLoading) return prev;
      const next = { ...prev };
      if (loading) {
        next[messageId] = true;
      } else {
        delete next[messageId];
      }
      return next;
    });
  }, []);

  const setMessageContentError = useCallback((messageId: string, message: string | null) => {
    setMessageContentErrorById((prev) => {
      if (message === null) {
        if (!(messageId in prev)) return prev;
        const next = { ...prev };
        delete next[messageId];
        return next;
      }
      return prev[messageId] === message ? prev : { ...prev, [messageId]: message };
    });
  }, []);

  const storeMessageBody = useCallback((message: Message) => {
    const key = bodyCacheKey(message);
    const result = upsertThreadInCache(
      messageBodyByIdRef.current,
      messageBodyOrderRef.current,
      key,
      message,
      MESSAGE_BODY_CACHE_LIMIT
    );
    messageBodyByIdRef.current = result.next;
    messageBodyOrderRef.current = result.order;
    setMessageBodyById(result.next);
  }, []);

  /** Patch a loaded body in place (e.g. after an attachment was removed). */
  const updateMessageBody = useCallback(
    (message: Pick<Message, "accountId" | "id">, updater: (body: Message) => Message) => {
      const key = bodyCacheKey(message);
      const current = messageBodyByIdRef.current[key];
      if (!current) return;
      const next = { ...messageBodyByIdRef.current, [key]: updater(current) };
      messageBodyByIdRef.current = next;
      setMessageBodyById(next);
    },
    []
  );

  const dropMessageBodies = useCallback((keys: string[]) => {
    if (keys.length === 0) return;
    const drop = new Set(keys);
    const current = messageBodyByIdRef.current;
    if (!keys.some((key) => key in current)) return;
    const next = { ...current };
    drop.forEach((key) => delete next[key]);
    messageBodyByIdRef.current = next;
    messageBodyOrderRef.current = messageBodyOrderRef.current.filter((key) => !drop.has(key));
    setMessageBodyById(next);
  }, []);

  /** The newest known copy of a message with its loaded body overlaid. */
  const resolveKnownMessage = useCallback(
    (message: Message) => {
      const threadId = message.threadId ?? message.messageId ?? message.id;
      const base =
        threadContentByIdRef.current[threadId]?.find((item) => item.id === message.id) ??
        messageById.get(message.id) ??
        message;
      const known = isMessageContentUnloaded(message) ? base : message;
      return withLoadedMessageBody(known, messageBodyByIdRef.current[bodyCacheKey(message)]);
    },
    [messageById]
  );

  const updateThreadCacheWithMessage = useCallback((message: Message) => {
    const threadId = message.threadId ?? message.messageId ?? message.id;
    if (!threadId) return;
    setThreadContentById((prev) => updateThreadCacheWithMessageMap(prev, message));
  }, []);

  const evictMessagesFromThreadCache = useCallback((messageIds: string[]) => {
    if (messageIds.length === 0) return;
    const evicted = new Set(messageIds);
    dropMessageBodies(
      Object.entries(messageBodyByIdRef.current)
        .filter(([, body]) => evicted.has(body.id))
        .map(([key]) => key)
    );
    setThreadContentById((prev) => {
      const { next, changed } = evictMessagesFromThreadCacheMap(prev, messageIds);
      if (!changed) return prev;
      threadCacheOrderRef.current = threadCacheOrderRef.current.filter((id) => id in next);
      return next;
    });
  }, [dropMessageBodies]);

  const evictThreadCache = useCallback(
    (threadId?: string | null) => {
      if (!threadId) return;
      // Bodies of the thread may have changed (draft saved, resynced); re-read on expand.
      dropMessageBodies(
        Object.entries(messageBodyByIdRef.current)
          .filter(([, body]) => body.threadId === threadId)
          .map(([key]) => key)
      );
      setThreadWindowById((prev) => {
        if (!(threadId in prev)) return prev;
        const next = { ...prev };
        delete next[threadId];
        return next;
      });
      setThreadContentById((prev) => {
        if (!(threadId in prev)) return prev;
        const next = { ...prev };
        delete next[threadId];
        threadCacheOrderRef.current = threadCacheOrderRef.current.filter((id) => id !== threadId);
        return next;
      });
      setThreadEvictVersion((v) => v + 1);
      clearThreadContentError(threadId);
    },
    [clearThreadContentError, dropMessageBodies]
  );

  const updateThreadCacheWithFlags = useCallback((messageId: string, flags: string[]) => {
    setThreadContentById((prev) => updateThreadCacheMapWithFlags(prev, messageId, flags));
  }, []);

  const updateThreadCacheWithCategory = useCallback(
    (
      messageId: string,
      category: Message["category"],
      categoryScore: Message["categoryScore"],
      categorySignals: Message["categorySignals"]
    ) => {
      setThreadContentById((prev) =>
        updateThreadCacheMapWithCategory(prev, messageId, category, categoryScore, categorySignals)
      );
    },
    []
  );

  const hydrateMessageFromServer = useCallback(
    async (message: Message, options?: { silent?: boolean }) => {
      const canResync =
        message.mailboxPath &&
        typeof message.imapUid === "number" &&
        !Number.isNaN(message.imapUid);

      if (canResync) {
        try {
          const res = await apiFetch(
            buildAccountMessageActionPath(message.accountId, message.id, "resync"),
            { method: "POST" }
          );
          if (!res.ok) {
            if (!options?.silent) {
              reportError(await readErrorMessage(res));
            }
            return null;
          }
        } catch {
          if (!options?.silent) {
            reportError("Re-sync failed due to a network error.");
          }
          return null;
        }
      }

      try {
        const detailRes = await apiFetch(
          buildAccountMessagePath(message.accountId, message.id),
          { cache: "no-store" }
        );
        if (!detailRes.ok) return null;
        const detail = (await detailRes.json()) as { ok?: boolean; message?: Message };
        const hydrated = detail?.ok ? detail.message : null;
        if (!hydrated?.id) return null;
        const mergedHydrated = mergeLocalOnlyMessageState(
          hydrated,
          messageById.get(message.id) ??
            threadMessagesRef.current.find((item: Message) => item.id === message.id) ??
            message
        );

        updateMessagesWithCurrentResultPrune(
          (item) => {
            if (item.id !== mergedHydrated.id) return item;
            return {
              ...mergedHydrated,
              // Message detail responses do not include list grouping metadata; preserve the existing group key
              // so the row remains in the same visible group after hydration.
              groupKey: item.groupKey ?? mergedHydrated.groupKey
            };
          },
          { source: "hydrate-message-from-server" }
        );
        storeMessageBody(mergedHydrated);
        return mergedHydrated;
      } catch {
        return null;
      }
    },
    [
      apiFetch,
      messageById,
      readErrorMessage,
      reportError,
      storeMessageBody,
      threadMessagesRef,
      updateMessagesWithCurrentResultPrune
    ]
  );

  const fetchSource = useCallback(
    async (messageId: string) => {
      const existing = sourceFetchRef.current.get(messageId);
      if (existing) {
        console.info("[noctua] fetch source reuse", { messageId });
        return existing;
      }
      console.info("[noctua] fetch source start", { messageId });
      setLoadingSource((prev) => ({ ...prev, [messageId]: true }));
      const promise = (async () => {
        const loadSource = async () => {
          const res = await apiFetch(
            buildAccountMessageSourcePath(activeAccountId, messageId)
          );
          if (!res.ok) {
            const errorMessage = await readErrorMessage(res);
            return { source: null as string | null, status: res.status, errorMessage };
          }
          const data = (await res.json()) as { source?: string };
          return { source: data.source ?? "", status: res.status, errorMessage: "" };
        };

        try {
          let result = await loadSource();
          if (!result.source && result.status === 404) {
            const message =
              messageById.get(messageId) ?? threadMessagesRef.current.find((item: Message) => item.id === messageId);
            if (message && !message.hasSource) {
              await hydrateMessageFromServer(message, { silent: true });
              result = await loadSource();
            }
          }
          if (result.source !== null) {
            console.info("[noctua] fetch source ok", { messageId, size: result.source.length });
            return result.source;
          }
          console.warn("[noctua] fetch source failed", {
            messageId,
            status: result.status,
            errorMessage: result.errorMessage
          });
          reportError(result.errorMessage || "Failed to load source.");
          return null;
        } catch (error) {
          console.warn("[noctua] fetch source exception", { messageId, error });
          reportError("Failed to load source.");
          return null;
        } finally {
          sourceFetchRef.current.delete(messageId);
          setLoadingSource((prev) => {
            const next = { ...prev };
            delete next[messageId];
            return next;
          });
        }
      })();
      sourceFetchRef.current.set(messageId, promise);
      return promise;
    },
    // apiFetch/readErrorMessage/reportError are stable props (wrapped in useCallback by the caller)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeAccountId, hydrateMessageFromServer, messageById, threadMessagesRef]
  );

  const hydrateMessageOnOpenIfNeeded = useCallback(
    (message: Message) => {
      if (!needsMessageContentHydration(message)) return null;

      const key = `${message.accountId}:${message.id}`;
      const now = Date.now();
      const lastAttempt = autoHydrationAttemptAtRef.current[key] ?? 0;
      if (now - lastAttempt < 30_000) {
        return null;
      }
      const inFlight = autoHydrationInFlightRef.current.get(key);
      if (inFlight) {
        return inFlight;
      }
      autoHydrationAttemptAtRef.current[key] = now;
      const promise = hydrateMessageFromServer(message, { silent: true }).finally(() => {
        autoHydrationInFlightRef.current.delete(key);
      });
      autoHydrationInFlightRef.current.set(key, promise);
      return promise;
    },
    [hydrateMessageFromServer]
  );

  /**
   * Read one message's stored content from the local detail route. IMAP is
   * only involved when the server reports the content as not stored.
   */
  const loadMessageBody = useCallback(
    (message: Message): Promise<Message | null> => {
      const key = bodyCacheKey(message);
      const inFlight = bodyFetchInFlightRef.current.get(key);
      if (inFlight) return inFlight;
      const scopeVersion = scopeVersionRef.current;
      const isCurrentScope = () => scopeVersionRef.current === scopeVersion;
      setMessageContentLoadingState(message.id, true);
      setMessageContentError(message.id, null);
      const promise = (async () => {
        try {
          const res = await apiFetch(buildAccountMessagePath(message.accountId, message.id), {
            cache: "no-store"
          });
          if (!isCurrentScope()) return null;
          if (!res.ok) {
            setMessageContentError(message.id, THREAD_LOAD_FAILURE_MESSAGE);
            return null;
          }
          const detail = (await res.json()) as { ok?: boolean; message?: Message };
          if (!isCurrentScope()) return null;
          if (!detail?.ok || !detail.message?.id) {
            setMessageContentError(message.id, THREAD_LOAD_FAILURE_MESSAGE);
            return null;
          }
          const loaded = withLoadedMessageBody(message, detail.message);
          storeMessageBody(detail.message);
          if (needsMessageContentHydration(loaded)) {
            const hydrated = await hydrateMessageOnOpenIfNeeded(loaded);
            if (hydrated) return withLoadedMessageBody(message, hydrated);
          }
          return loaded;
        } catch {
          if (isCurrentScope()) setMessageContentError(message.id, THREAD_LOAD_FAILURE_MESSAGE);
          return null;
        } finally {
          bodyFetchInFlightRef.current.delete(key);
          if (isCurrentScope()) setMessageContentLoadingState(message.id, false);
        }
      })();
      bodyFetchInFlightRef.current.set(key, promise);
      return promise;
    },
    [
      apiFetch,
      hydrateMessageOnOpenIfNeeded,
      setMessageContentError,
      setMessageContentLoadingState,
      storeMessageBody
    ]
  );

  /**
   * Make sure `message` carries its content: read the body when only headers
   * are loaded, resync when the server reported it missing (`manual` skips the
   * automatic-resync throttle). Returns the message with content, or null.
   */
  const ensureMessageContent = useCallback(
    async (message: Message, options?: { manual?: boolean }): Promise<Message | null> => {
      const resolved = resolveKnownMessage(message);
      if (isMessageContentUnloaded(resolved)) {
        return loadMessageBody(resolved);
      }
      if (!needsMessageContentHydration(resolved)) return resolved;
      if (messageContentLoadingRef.current[message.id]) return null;

      if (!options?.manual) {
        const hydrationPromise = hydrateMessageOnOpenIfNeeded(resolved);
        if (!hydrationPromise) return null;
        setMessageContentLoadingState(message.id, true);
        try {
          return (await hydrationPromise) ?? null;
        } finally {
          setMessageContentLoadingState(message.id, false);
        }
      }

      setMessageContentLoadingState(message.id, true);
      try {
        return (await hydrateMessageFromServer(resolved)) ?? null;
      } finally {
        setMessageContentLoadingState(message.id, false);
      }
    },
    [
      hydrateMessageFromServer,
      hydrateMessageOnOpenIfNeeded,
      loadMessageBody,
      resolveKnownMessage,
      setMessageContentLoadingState
    ]
  );

  /**
   * Read the header window (or the selected rows when threads are off) of the
   * active conversation. Latest wins: a read for another key aborts the
   * previous one, and only the current read writes the cache or clears its
   * own loading state.
   */
  const loadThreadContent = useCallback(
    (request: ThreadReadRequest) => {
      const current = threadReadRef.current;
      if (current?.key === request.key) return current.promise;
      current?.controller.abort();
      const controller = new AbortController();
      const { threadId } = request;
      const entry = { key: request.key, threadId, controller, promise: Promise.resolve() };
      threadReadRef.current = entry;
      const isCurrent = () => threadReadRef.current === entry && !controller.signal.aborted;
      setThreadContentLoading(threadId);
      clearThreadContentError(threadId);
      entry.promise = (async () => {
        try {
          const res = await apiFetch(buildAccountApiPath(activeAccountId, "/thread/related"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              threadIds: request.windowed ? [threadId] : [],
              messageIds: request.windowed ? [] : request.messageIds,
              groupBy: request.groupBy,
              threadDateSource: request.threadDateSource,
              projection: "headers",
              excludeFolderIds: request.excludeFolderIds,
              ...(request.windowed ? { window: { anchorMessageId: request.anchorMessageId } } : {})
            }),
            signal: controller.signal
          });
          if (!isCurrent()) return;
          if (!res.ok) {
            setThreadContentError(threadId, THREAD_LOAD_FAILURE_MESSAGE);
            return;
          }
          const data = (await res.json()) as ThreadWindowResponse;
          if (!isCurrent()) return;
          const items = Array.isArray(data?.items) ? data.items : [];
          upsertThreadCache(threadId, items);
          if (request.windowed && data.window) {
            const windowInfo = data.window;
            setThreadWindowById((prev) => ({
              ...prev,
              [threadId]: {
                ...windowInfo,
                placeholders: Array.isArray(data.placeholders) ? data.placeholders : [],
                loading: null,
                error: null
              }
            }));
          }
        } catch {
          if (isCurrent()) setThreadContentError(threadId, THREAD_LOAD_FAILURE_MESSAGE);
        } finally {
          if (threadReadRef.current === entry) {
            threadReadRef.current = null;
            setThreadContentLoading((loading) => (loading === threadId ? null : loading));
          }
        }
      })();
      return entry.promise;
    },
    [activeAccountId, apiFetch, clearThreadContentError, setThreadContentError, upsertThreadCache]
  );

  /** Abort the active conversation read, e.g. when no message is selected any more. */
  const abortThreadContent = useCallback(() => {
    const current = threadReadRef.current;
    if (!current) return;
    current.controller.abort();
    threadReadRef.current = null;
    setThreadContentLoading((loading) => (loading === current.threadId ? null : loading));
  }, []);

  /** Load the next older page, or the gap before the newest message, of a windowed thread. */
  const loadThreadPage = useCallback(
    async (request: ThreadPageRequest) => {
      const { threadId, direction } = request;
      const state = threadWindowByIdRef.current[threadId];
      const cursor = direction === "older" ? state?.olderCursor : state?.newerCursor;
      if (!state || !cursor || state.loading) return;
      const controller = new AbortController();
      threadPageControllersRef.current.get(threadId)?.abort();
      threadPageControllersRef.current.set(threadId, controller);
      const isCurrent = () =>
        threadPageControllersRef.current.get(threadId) === controller && !controller.signal.aborted;
      const patchWindow = (patch: Partial<ThreadWindowState>) =>
        setThreadWindowById((prev) =>
          prev[threadId] ? { ...prev, [threadId]: { ...prev[threadId], ...patch } } : prev
        );
      patchWindow({ loading: direction, error: null });
      try {
        const res = await apiFetch(buildAccountApiPath(activeAccountId, "/thread/related"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            threadIds: [threadId],
            groupBy: request.groupBy,
            threadDateSource: request.threadDateSource,
            projection: "headers",
            excludeFolderIds: request.excludeFolderIds,
            window: { cursor }
          }),
          signal: controller.signal
        });
        if (!isCurrent()) return;
        if (!res.ok) {
          patchWindow({ loading: null, error: THREAD_LOAD_FAILURE_MESSAGE });
          return;
        }
        const data = (await res.json()) as ThreadWindowResponse;
        if (!isCurrent()) return;
        const items = Array.isArray(data?.items) ? data.items : [];
        upsertThreadCache(threadId, mergeThreadWindowItems(threadContentByIdRef.current[threadId], items));
        setThreadWindowById((prev) => {
          const previous = prev[threadId];
          if (!previous) return prev;
          const loadedIds = new Set(items.map((item) => item.id));
          const placeholders = [
            ...previous.placeholders.filter((item) => !loadedIds.has(item.id)),
            ...(Array.isArray(data.placeholders) ? data.placeholders : [])
          ];
          return {
            ...prev,
            [threadId]: {
              ...previous,
              total: data.window?.total ?? previous.total,
              ...(direction === "older"
                ? {
                    hasOlder: Boolean(data.window?.hasOlder),
                    olderCursor: data.window?.olderCursor ?? null
                  }
                : {
                    hasNewer: Boolean(data.window?.hasNewer),
                    newerCursor: data.window?.newerCursor ?? null
                  }),
              placeholders,
              loading: null,
              error: null
            }
          };
        });
      } catch {
        if (isCurrent()) patchWindow({ loading: null, error: THREAD_LOAD_FAILURE_MESSAGE });
      } finally {
        if (threadPageControllersRef.current.get(threadId) === controller) {
          threadPageControllersRef.current.delete(threadId);
        }
      }
    },
    [activeAccountId, apiFetch, upsertThreadCache]
  );

  const resetThreadCache = useCallback(() => {
    scopeVersionRef.current += 1;
    threadReadRef.current?.controller.abort();
    threadReadRef.current = null;
    threadPageControllersRef.current.forEach((controller) => controller.abort());
    threadPageControllersRef.current.clear();
    bodyFetchInFlightRef.current.clear();
    setThreadContentById({});
    setThreadContentErrorById({});
    threadCacheOrderRef.current = [];
    setThreadContentLoading(null);
    setThreadWindowById({});
    messageBodyByIdRef.current = {};
    messageBodyOrderRef.current = [];
    setMessageBodyById({});
    setMessageContentLoading({});
    setMessageContentErrorById({});
  }, []);

  useEffect(
    () => () => {
      threadReadRef.current?.controller.abort();
      threadPageControllersRef.current.forEach((controller) => controller.abort());
    },
    []
  );

  return {
    // State
    threadRelatedMessages,
    setThreadRelatedMessages,
    threadContentById,
    setThreadContentById,
    threadEvictVersion,
    threadContentLoading,
    setThreadContentLoading,
    threadContentErrorById,
    loadingSource,
    setLoadingSource,
    messageContentLoading,
    setMessageContentLoading,
    messageContentErrorById,
    threadWindowById,
    messageBodyById,
    // Refs
    threadContentByIdRef,
    loadingSourceRef,
    messageContentLoadingRef,
    sourceFetchRef,
    autoHydrationAttemptAtRef,
    // Actions
    upsertThreadCache,
    clearThreadContentError,
    setThreadContentError,
    setMessageContentLoadingState,
    updateThreadCacheWithMessage,
    evictMessagesFromThreadCache,
    evictThreadCache,
    resetThreadCache,
    updateThreadCacheWithFlags,
    updateThreadCacheWithCategory,
    hydrateMessageFromServer,
    fetchSource,
    hydrateMessageOnOpenIfNeeded,
    ensureMessageContent,
    loadMessageBody,
    updateMessageBody,
    loadThreadContent,
    abortThreadContent,
    loadThreadPage
  };
}
