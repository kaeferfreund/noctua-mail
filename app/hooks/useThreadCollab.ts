"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  CollabMember,
  ThreadCollabState,
  ThreadComment,
  ThreadActivity,
  ThreadCollabPatch,
} from "@/app/components/collab/types";

type Snapshot = {
  state: ThreadCollabState;
  comments: ThreadComment[];
  activity: ThreadActivity[];
};
type Options = {
  apiFetch?: typeof fetch;
  onUpdate?: (state: ThreadCollabState) => void;
  onCommit?: () => void;
  sessionKey?: string;
};
const defaultFetch: typeof fetch = (...args) => fetch(...args);

/** Cache belongs to the mounted mail client, never to a module or another login. */
export function useThreadCollab(
  accountId: string,
  threadId?: string,
  options: Options = {},
) {
  const apiFetch = options.apiFetch ?? defaultFetch;
  const onCommit = useRef(options.onCommit);
  onCommit.current = options.onCommit;
  const sessionKey = options.sessionKey;
  const onUpdate = useRef(options.onUpdate);
  onUpdate.current = options.onUpdate;
  const cache = useRef(new Map<string, Snapshot>());
  const membersCache = useRef(new Map<string, CollabMember[]>());
  const key = JSON.stringify([sessionKey, accountId, threadId]);
  const memberScope = JSON.stringify([sessionKey, accountId]);
  const currentKey = useRef(key);
  currentKey.current = key;
  const [entry, setEntry] = useState<{ key: string; data: Snapshot } | null>(
    null,
  );
  const [memberEntry, setMemberEntry] = useState<{
    scope: string;
    members: CollabMember[];
  } | null>(null);
  const [meEntry, setMe] = useState<{
    sessionKey?: string;
    id: string | null;
  } | null>(null);
  const [errorEntry, setError] = useState<{
    key: string;
    message: string;
  } | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const busy = useRef(new Set<string>());
  const generation = useRef(0);
  const loadSequence = useRef(0);
  const mounted = useRef(true);
  const path = `/api/accounts/${encodeURIComponent(accountId)}/threads/${encodeURIComponent(threadId ?? "")}`;
  const accept = useCallback((data: Snapshot, requestKey: string) => {
    cache.current.set(requestKey, data);
    if (!mounted.current || currentKey.current !== requestKey) return;
    setEntry({ key: requestKey, data });
    onUpdate.current?.(data.state);
  }, []);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void apiFetch("/api/auth/me", {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (r) => {
        if (!r.ok) {
          if (!controller.signal.aborted) setMe({ sessionKey, id: null });
          return;
        }
        const data = await r.json();
        if (!controller.signal.aborted)
          setMe({ sessionKey, id: data.user?.id ?? null });
      })
      .catch(() => {});
    return () => controller.abort();
  }, [apiFetch, accountId, sessionKey]);
  useEffect(() => {
    if (!accountId) return;
    const controller = new AbortController();
    void apiFetch(`/api/accounts/${encodeURIComponent(accountId)}/members`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (r) => {
        if (!r.ok) throw new Error("Could not load mailbox members.");
        const data = await r.json();
        if (!controller.signal.aborted) {
          membersCache.current.set(memberScope, data.members);
          setMemberEntry({ scope: memberScope, members: data.members });
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [accountId, memberScope, apiFetch]);
  const reload = useCallback(async () => {
    if (!accountId || !threadId) return;
    const version = generation.current;
    const sequence = ++loadSequence.current;
    const response = await apiFetch(`${path}/collab`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok || !data.ok)
      throw new Error(data.message ?? "Could not load collaboration.");
    if (
      currentKey.current !== key ||
      generation.current !== version ||
      loadSequence.current !== sequence ||
      !mounted.current
    )
      return;
    membersCache.current.set(memberScope, data.members);
    setMemberEntry({ scope: memberScope, members: data.members });
    accept(data, key);
    setError(null);
  }, [accountId, threadId, path, apiFetch, key, memberScope, accept]);
  useEffect(() => {
    let active = true;
    void reload().catch((e) => {
      if (active) setError({ key, message: e.message });
    });
    return () => {
      active = false;
    };
  }, [key, reload]);
  const mutate = useCallback(
    async (
      suffix: string,
      method: string,
      body?: unknown,
      optimistic?: (data: Snapshot) => Snapshot,
    ) => {
      if (!threadId || busy.current.has(key)) return false;
      const previous = cache.current.get(key);
      if (!previous) return false;
      busy.current.add(key);
      generation.current++;
      setPendingKey(key);
      setError(null);
      if (optimistic) accept(optimistic(previous), key);
      try {
        const response = await apiFetch(`${path}/${suffix}`, {
          method,
          ...(body === undefined
            ? {}
            : {
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
              }),
        });
        const data = await response.json();
        if (!response.ok || !data.ok)
          throw new Error(data.message ?? "Could not save collaboration.");
        const next = cache.current.get(key) ?? previous;
        accept(
          {
            ...next,
            state: data.state,
            comments: data.comment
              ? [...previous.comments, data.comment]
              : next.comments,
          },
          key,
        );
        // Reload activity after the committed mutation. A read failure must not roll it back.
        if (currentKey.current === key) await reload().catch(() => {});
        if (mounted.current && currentKey.current === key) onCommit.current?.();
        return true;
      } catch (e) {
        accept(previous, key);
        if (mounted.current && currentKey.current === key)
          setError({
            key,
            message:
              e instanceof Error ? e.message : "Could not save collaboration.",
          });
        return false;
      } finally {
        busy.current.delete(key);
        if (mounted.current)
          setPendingKey((current) => (current === key ? null : current));
      }
    },
    [threadId, key, path, apiFetch, accept, reload],
  );
  const data = entry?.key === key ? entry.data : cache.current.get(key);
  return {
    state: data?.state,
    comments: data?.comments ?? [],
    activity: data?.activity ?? [],
    members:
      memberEntry?.scope === memberScope
        ? memberEntry.members
        : (membersCache.current.get(memberScope) ?? []),
    me: meEntry?.sessionKey === sessionKey ? (meEntry?.id ?? null) : null,
    loading: Boolean(threadId && !data && errorEntry?.key !== key),
    pending: pendingKey === key,
    error: errorEntry?.key === key ? errorEntry.message : null,
    reload,
    update: (patch: ThreadCollabPatch) =>
      mutate("collab", "PATCH", patch, (previous) => ({
        ...previous,
        state: { ...previous.state, ...patch, updatedAt: Date.now() },
      })),
    addNote: (body: string) =>
      mutate("comments", "POST", { body }, (previous) => ({
        ...previous,
        state: {
          ...previous.state,
          commentCount: previous.state.commentCount + 1,
        },
      })),
    deleteNote: (id: string) =>
      mutate(
        `comments/${encodeURIComponent(id)}`,
        "DELETE",
        undefined,
        (previous) => ({
          ...previous,
          comments: previous.comments.filter((c) => c.id !== id),
          state: {
            ...previous.state,
            commentCount: Math.max(0, previous.state.commentCount - 1),
          },
        }),
      ),
  };
}
export type ThreadCollabController = ReturnType<typeof useThreadCollab>;
