"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Folder, Topic } from "@/lib/data";
import { buildAccountFoldersPath, buildAccountTopicsPath } from "@/lib/accountApiPaths";
import { useLatestRef } from "@/app/hooks/useLatestRef";

type ApiFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/**
 * A per-mailbox list (folders, topics) of the other mailboxes of the open
 * domain view, read through each mailbox's own route (the server checks read
 * access per mailbox) and kept while the domain view lists the mailbox.
 */
function useDomainMailboxResource<T>(params: {
  accountIds: readonly string[];
  apiFetch: ApiFetch;
  buildPath: (accountId: string) => string;
  parse: (data: unknown, accountId: string) => T[] | null;
}) {
  const { accountIds, apiFetch, buildPath, parse } = params;
  const [itemsByAccount, setItemsByAccount] = useState<ReadonlyMap<string, T[]>>(() => new Map());
  const pending = useRef(new Map<string, Promise<T[] | null>>());
  const known = useLatestRef(itemsByAccount);
  const accountKey = accountIds.join(",");

  const load = useCallback(
    (accountId: string): Promise<T[] | null> => {
      const running = pending.current.get(accountId);
      if (running) return running;
      const request = (async () => {
        try {
          const res = await apiFetch(buildPath(accountId));
          if (!res.ok) return null;
          const items = parse(await res.json(), accountId);
          if (!items) return null;
          setItemsByAccount((prev) => new Map(prev).set(accountId, items));
          return items;
        } catch {
          return null;
        } finally {
          pending.current.delete(accountId);
        }
      })();
      pending.current.set(accountId, request);
      return request;
    },
    [apiFetch, buildPath, parse]
  );

  // Each mailbox newly listed (domain view opened or switched) is read again.
  const listedBefore = useRef(new Set<string>());
  useEffect(() => {
    const wanted = new Set(accountKey ? accountKey.split(",") : []);
    wanted.forEach((accountId) => {
      if (!listedBefore.current.has(accountId)) void load(accountId);
    });
    listedBefore.current = wanted;
  }, [accountKey, load]);

  const listed = useMemo(() => {
    const wanted = new Set(accountKey ? accountKey.split(",") : []);
    return new Map(Array.from(itemsByAccount).filter(([accountId]) => wanted.has(accountId))) as ReadonlyMap<string, T[]>;
  }, [accountKey, itemsByAccount]);

  /** The mailbox's list, read now when it is not known yet (null when it cannot be read). */
  const ensure = useCallback(
    async (accountId: string) => known.current.get(accountId) ?? (await load(accountId)),
    [known, load]
  );

  return { itemsByAccount: listed, ensure, reload: load };
}

const parseFolders = (data: unknown, accountId: string) =>
  Array.isArray(data) ? (data as Folder[]).filter((folder) => folder.accountId === accountId) : null;

const parseTopics = (data: unknown) => {
  const payload = data as { ok?: boolean; topics?: unknown } | null;
  return payload?.ok && Array.isArray(payload.topics) ? (payload.topics as Topic[]) : null;
};

/**
 * Folder lists of the other mailboxes of the open domain view: an action on a
 * message of another mailbox uses that mailbox's trash, archive, spam folder
 * or a folder picked from its tree.
 */
export function useDomainMailboxFolders(params: { accountIds: readonly string[]; apiFetch: ApiFetch }) {
  const { itemsByAccount, ensure, reload } = useDomainMailboxResource({
    ...params,
    buildPath: buildAccountFoldersPath,
    parse: parseFolders
  });
  const allFolders = useMemo(() => Array.from(itemsByAccount.values()).flat(), [itemsByAccount]);
  return { foldersByAccount: itemsByAccount, allFolders, ensureFolders: ensure, reloadFolders: reload };
}

/** Topic catalogs of the other mailboxes of the open domain view (topics belong to one mailbox). */
export function useDomainMailboxTopics(params: { accountIds: readonly string[]; apiFetch: ApiFetch }) {
  const { itemsByAccount, reload } = useDomainMailboxResource({
    ...params,
    buildPath: buildAccountTopicsPath,
    parse: parseTopics
  });
  return { topicsByAccount: itemsByAccount, reloadTopics: reload };
}
