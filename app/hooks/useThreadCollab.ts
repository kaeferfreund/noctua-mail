"use client";
/**
 * Acceptance specification (named tests in useThreadCollab.dom.test.tsx):
 * Scope: the mounted cache key is (session, account, thread); stale sessions cannot publish. Test: "R6-scope: session/account/thread isolation".
 * Snapshots: GET supplies complete state/comments/activity; mutation success supplies partial state plus at most its written comment. Tests: "R5-completion: same-revision GET completes a partial mutation response with earlier collaborator notes", "R7-snapshots: earlier-started GET completes partial success with comments and activity".
 * Order: higher server revision always wins; lower always loses, regardless of timestamps or request order. Tests: "R6-order: higher revision wins regardless of request start", "R7-order: revisions beat opposing timestamps and request starts".
 * Equal complete GETs: latest request-start sequence wins regardless of content; earlier starts never regress it. Test: "R6-order: latest-started equal-revision GET wins (earlier resolves last)"; lifecycle tests: "R6-lifecycle: equal-revision complete GET must restore comments and activity when message presence changes", "R6-lifecycle: equal-revision complete GET must hide comments and activity when message presence changes", "R6-lifecycle-activity: equal-revision complete GET must restore activity even without comments".
 * Equal partial success: preserve complete lists and GET start sequence; merge only its written comment by id without contradicting a comment at that revision. Tests: "R6-partial: equal-revision success preserves complete lists and merges its comment (missing comment)", "R6-partial: equal-revision success preserves complete lists and merges its comment (conflicting comment)".
 * Partial completion: equal-revision GET must agree on state and comments written at that revision before completing unknown lists. Tests: "R6-completion: equal-revision GET cannot contradict its written comment (different)", "R6-completion: equal-revision GET cannot contradict partial state".
 * Rollback: failure undoes only its own optimistic snapshot at its base revision; an accepted GET/write takes ownership. Tests: "R6-rollback: only the owning optimistic snapshot rolls back (mutation owns)", "R6-rollback: only the owning optimistic snapshot rolls back (GET owns)".
 * Denial: 403 purges/blocks its session/account; any accepted successful read started after the applied denial immediately restores access, regardless of later pending/failed reads. A later-started 403 is a new denial; mutations cannot lift it. Tests: "R7-denial: newer successful read restores denial despite an even newer pending read", "R7-denial: newer successful read restores denial despite an even newer HTTP 500 read", "R7-denial: newer successful read restores denial despite an even newer network read", "R7-denial: denial then success then later 403 requires a new successful recovery".
 * Members: one channel per (session, account); complete collaboration GETs and standalone members GETs share read-start sequences, accepting only payloads started later than the accepted membership source; failures preserve membership and denied scopes reject it. Tests: "R7-members: late standalone members GET must not replace newer complete GET membership", "R7-members: late complete GET must not replace newer standalone members GET membership", "R7-members: newer standalone members GET failure keeps accepted membership (HTTP 500)", "R7-members: newer standalone members GET failure keeps accepted membership (network)".
 * Pending: one mutation per scope key; other keys run independently and their finalizers cannot clear this key. Test: "R5-pending: overlapping account mutations keep pending on the originating key after navigation".
 * Limits: post-commit refresh may fail, leaving partial lists; mutation remains committed and the next successful admissible read repairs them. Test: "R6-repair: failed post-commit refresh is repaired by the next successful read".
 */
import { useCallback, useEffect, useRef, useLayoutEffect, useState } from "react";
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
type CachedSnapshot = Snapshot & {
  // Ownership controls rollback only; request start order is not commit order.
  owner: number;
  serverSnapshot: Snapshot;
  complete: boolean;
  // Retained across equal-revision partial responses and optimistic ownership.
  completeStart: number | null;
};
function sameRecord(a: object, b: object): boolean {
  const left = a as Record<string, unknown>, right = b as Record<string, unknown>;
  return Object.keys(left).length === Object.keys(right).length &&
    Object.keys(left).every(key => JSON.stringify(left[key]) === JSON.stringify(right[key]));
}
// All read channels compare source starts, never response completion times.
function isLaterRead(start: number, accepted: number | null = 0) {
  return start > (accepted ?? 0);
}
type ReadChannel = "access" | "members";
function canAcceptSnapshot(next: CachedSnapshot, current?: CachedSnapshot) {
  if (!current) return true;
  const incoming = next.serverSnapshot, accepted = current.serverSnapshot;
  if (incoming.state.revision !== accepted.state.revision)
    return incoming.state.revision > accepted.state.revision;
  // Message presence can change visible lists without a collaboration write.
  // Only complete GET start order breaks revision ties, never rollback ownership.
  if (current.complete && next.complete)
    return next.completeStart === current.completeStart || isLaterRead(next.completeStart!, current.completeStart);
  if (!sameRecord(incoming.state, accepted.state)) return false;
  // A GET may complete unknown data after a partial mutation, but cannot
  // contradict a comment written by that mutation at this revision.
  if (!current.complete && next.complete) {
    const incomingComments = new Map(incoming.comments.map(comment => [comment.id, comment]));
    return accepted.comments.filter(comment => comment.revision === accepted.state.revision)
      .every(comment => {
        const other = incomingComments.get(comment.id);
        return other !== undefined && sameRecord(comment, other);
      });
  }
  return true;
}
type ApiFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type Options = {
  apiFetch?: ApiFetch;
  onUpdate?: (state: ThreadCollabState) => void;
  onCommit?: (accountId: string) => void;
  refreshVersion?: number;
  onReadDenied?: (accountId: string) => void;
  sessionKey?: string;
  currentUserId?: string | null;
};
const defaultFetch: ApiFetch = (...args) => fetch(...args);

/** Cache belongs to the mounted mail client, never to a module or another login. */
export function useThreadCollab(
  accountId: string,
  threadId?: string,
  options: Options = {},
) {
  const apiFetch = options.apiFetch ?? defaultFetch;
  const onCommit = useRef(options.onCommit);
  useLayoutEffect(() => { onCommit.current = options.onCommit; });
  const sessionKey = options.sessionKey;
  const onReadDenied = useRef(options.onReadDenied);
  useLayoutEffect(() => { onReadDenied.current = options.onReadDenied; });
  const sessionRef = useRef(sessionKey);
  useLayoutEffect(() => { sessionRef.current = sessionKey; });
  const [deniedScopes, setDeniedScopes] = useState(new Set<string>());
  const denied = useRef(new Set<string>());
  const onUpdate = useRef(options.onUpdate);
  useLayoutEffect(() => { onUpdate.current = options.onUpdate; });
  const cache = useRef(new Map<string, CachedSnapshot>());
  const [cachedEntries, setCachedEntries] = useState<ReadonlyMap<string, CachedSnapshot>>(new Map());
  const [cachedMembers, setCachedMembers] = useState<ReadonlyMap<string, CollabMember[]>>(new Map());
  const membersCache = useRef(new Map<string, CollabMember[]>());
  const key = JSON.stringify([sessionKey, accountId, threadId]);
  const memberScope = JSON.stringify([sessionKey, accountId]);
  const currentKey = useRef(key);
  useLayoutEffect(() => { currentKey.current = key; });
  const [entry, setEntry] = useState<{ key: string; data: Snapshot } | null>(
    null,
  );
  const [memberEntry, setMemberEntry] = useState<{
    scope: string;
    members: CollabMember[];
  } | null>(null);
  const [errorEntry, setError] = useState<{
    key: string;
    message: string;
  } | null>(null);
  const [pendingKeys, setPendingKeys] = useState(new Set<string>());
  const busy = useRef(new Set<string>());
  const snapshotSequence = useRef(0);
  const loadSequence = useRef(0);
  const scopeLoadSequence = useRef(new Map<string, number>());
  const acceptedReadStarts = useRef(new Map<string, Partial<Record<ReadChannel, number>>>());
  const acceptIfLatest = useCallback((scope: string, channel: ReadChannel, start: number) => {
    const accepted = acceptedReadStarts.current.get(scope) ?? {};
    if (!isLaterRead(start, accepted[channel])) return false;
    acceptedReadStarts.current.set(scope, { ...accepted, [channel]: start });
    return true;
  }, []);
  const mounted = useRef(true);
  const path = `/api/accounts/${encodeURIComponent(accountId)}/threads/${encodeURIComponent(threadId ?? "")}`;
  const publish = useCallback((data: CachedSnapshot, requestKey: string) => {
    const [requestSession, requestAccount] = JSON.parse(requestKey);
    if (!mounted.current || requestSession !== (sessionRef.current ?? null) || denied.current.has(JSON.stringify([requestSession, requestAccount]))) return;
    cache.current.set(requestKey, data);
    setCachedEntries(new Map(cache.current));
    onUpdate.current?.(data.state);
    if (currentKey.current === requestKey) setEntry({ key: requestKey, data });
  }, []);
  const accept = useCallback((data: CachedSnapshot, requestKey: string) => {
    if (canAcceptSnapshot(data, cache.current.get(requestKey))) publish(data, requestKey);
  }, [publish]);
  const acceptMembers = useCallback((members: CollabMember[], scope: string, sequence: number) => {
    if (!mounted.current || JSON.parse(scope)[0] !== (sessionRef.current ?? null) ||
      denied.current.has(scope) || !acceptIfLatest(scope, "members", sequence)) return;
    membersCache.current.set(scope, members);
    setCachedMembers(new Map(membersCache.current));
    setMemberEntry({ scope, members });
  }, [acceptIfLatest]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    // Complete thread reads already carry membership. The standalone channel
    // is needed only when the mailbox has no selected thread.
    if (!accountId || threadId) return;
    const sequence = ++loadSequence.current;
    const controller = new AbortController();
    void apiFetch(`/api/accounts/${encodeURIComponent(accountId)}/members`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (r) => {
        if (!r.ok) throw new Error("Could not load mailbox members.");
        const data = await r.json();
        if (!controller.signal.aborted)
          acceptMembers(data.members, memberScope, sequence);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [accountId, threadId, memberScope, apiFetch, acceptMembers]);
  const reload = useCallback(async () => {
    if (!accountId || !threadId) return;
    const owner = ++snapshotSequence.current;
    const sequence = ++loadSequence.current;
    scopeLoadSequence.current.set(memberScope, sequence);
    const response = await apiFetch(`${path}/collab`, { cache: "no-store" });
    const data = await response.json().catch(() => null);
    if (!mounted.current || sessionRef.current !== sessionKey) return;
    if (response.status === 403) {
      // Only accepted access decisions advance this channel. Pending/failed
      // requests cannot veto recovery, and an older success cannot undo a denial.
      if (!acceptIfLatest(memberScope, "access", sequence)) return;
      for (const cachedKey of cache.current.keys()) {
        const [cachedSession, cachedAccount] = JSON.parse(cachedKey);
        if (cachedSession === (sessionKey ?? null) && cachedAccount === accountId) cache.current.delete(cachedKey);
      }
      setCachedEntries(new Map(cache.current));
      membersCache.current.delete(memberScope);
      setCachedMembers(new Map(membersCache.current));
      denied.current.add(memberScope);
      if (mounted.current) {
        setDeniedScopes(new Set(denied.current));
        setEntry(current => current && JSON.parse(current.key)[1] === accountId ? null : current);
        setMemberEntry(current => current?.scope === memberScope ? null : current);
        onReadDenied.current?.(accountId);
      }
    }
    if (!response.ok || !data?.ok) {
      if (scopeLoadSequence.current.get(memberScope) !== sequence) return;
      throw new Error(data?.message ?? "Could not load collaboration.");
    }
    if (denied.current.has(memberScope) &&
      !isLaterRead(sequence, acceptedReadStarts.current.get(memberScope)?.access)) return;
    const next: CachedSnapshot = { ...data, owner, serverSnapshot: data, complete: true, completeStart: sequence };
    const acceptsSnapshot = currentKey.current === key && canAcceptSnapshot(next, cache.current.get(key));
    if (acceptsSnapshot) {
      acceptIfLatest(memberScope, "access", sequence);
      denied.current.delete(memberScope);
      setDeniedScopes(new Set(denied.current));
    }
    // Membership has account scope and its own ordering, independent of whether
    // this thread's snapshot wins revision/start order or is still selected.
    acceptMembers(data.members, memberScope, sequence);
    if (!acceptsSnapshot) return;
    accept(next, key);
    setError(null);
  }, [accountId, threadId, path, apiFetch, key, memberScope, accept, sessionKey, acceptIfLatest, acceptMembers]);
  const refreshVersion = options.refreshVersion;
  useEffect(() => {
    let active = true;
    void reload().catch((e) => {
      if (active) setError({ key, message: e.message });
    });
    return () => {
      active = false;
    };
  }, [key, reload, refreshVersion]);
  const mutate = useCallback(
    async (
      suffix: string,
      method: string,
      body: unknown,
      optimistic: (data: Snapshot) => Snapshot,
      deletedCommentId?: string,
    ) => {
      if (!threadId || busy.current.has(key) || denied.current.has(memberScope)) return false;
      const previous = cache.current.get(key);
      if (!previous) return false;
      busy.current.add(key);
      const owner = ++snapshotSequence.current;
      setPendingKeys(new Set(busy.current));
      setError(null);
      // The operation owns this optimistic snapshot until a newer GET/write wins.
      publish({ ...previous, ...optimistic(previous), owner }, key);
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
        const sameRevision = data.state.revision === next.serverSnapshot.state.revision;
        if (data.state.revision > next.serverSnapshot.state.revision ||
          (sameRevision && sameRecord(data.state, next.serverSnapshot.state))) {
          const comments = new Map(next.serverSnapshot.comments.map(comment => [comment.id, comment]));
          if (data.comment) {
            const existing = comments.get(data.comment.id);
            if (!existing || data.comment.revision > existing.revision)
              comments.set(data.comment.id, data.comment);
          }
          if (deletedCommentId && !sameRevision) comments.delete(deletedCommentId);
          const committed: Snapshot = { state: data.state, comments: [...comments.values()], activity: next.activity };
          accept({
            ...committed, owner, serverSnapshot: committed,
            // An idempotent late mutation must not downgrade a complete GET.
            complete: next.complete && sameRevision,
            completeStart: sameRevision ? next.completeStart : null,
          }, key);
        }
        // Reload activity after the committed mutation. A read failure must not roll it back.
        if (currentKey.current === key) await reload().catch(() => {});
        if (mounted.current && sessionRef.current === sessionKey) onCommit.current?.(accountId);
        return true;
      } catch (e) {
        // A failed operation may undo only the snapshot it still owns.
        if (cache.current.get(key)?.owner === owner &&
          cache.current.get(key)?.serverSnapshot.state.revision === previous.serverSnapshot.state.revision)
          publish({ ...previous, owner }, key);
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
          setPendingKeys(new Set(busy.current));
      }
    },
    [threadId, key, path, apiFetch, accept, publish, reload, memberScope, sessionKey, accountId],
  );
  const readDenied = deniedScopes.has(memberScope);
  const data = readDenied ? undefined : entry?.key === key ? entry.data : cachedEntries.get(key);
  return {
    readDenied,
    state: data?.state,
    comments: data?.comments ?? [],
    activity: data?.activity ?? [],
    members: readDenied ? [] :
      memberEntry?.scope === memberScope
        ? memberEntry.members
        : (cachedMembers.get(memberScope) ?? []),
    me: options.currentUserId ?? null,
    loading: Boolean(threadId && !data && errorEntry?.key !== key),
    pending: pendingKeys.has(key),
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
        id,
      ),
  };
}
export type ThreadCollabController = ReturnType<typeof useThreadCollab>;
