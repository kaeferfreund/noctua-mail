"use client";

import { useLayoutEffect, useState } from "react";
import type { Folder, Message } from "@/lib/data";
import type { MessageGroupMeta } from "./messagelist/listModel";

/**
 * In-memory view of recently visited mailboxes for this tab: the first list page
 * per list URL and the folder list per mailbox. A revisit shows them at once while
 * the switch and the list read run as usual and replace them. Nothing is persisted;
 * the cache is cleared on a session change and pruned when a mailbox is no longer
 * granted. Entries are keyed by the page-1 list URL, which names the mailbox, folder
 * and view, and every read checks the mailbox id again.
 */

export type CachedListPage = {
  accountId: string;
  rows: Message[];
  groupMeta: MessageGroupMeta[];
  hasMore: boolean;
  total: number | null;
  loadedCount: number;
};

const LIST_ENTRY_LIMIT = 8;
const FOLDER_ENTRY_LIMIT = 8;

// Map iteration order is insertion order: re-inserting on use keeps the oldest first.
function touch<T>(map: Map<string, T>, key: string, value: T, limit: number) {
  map.delete(key);
  map.set(key, value);
  while (map.size > limit) map.delete(map.keys().next().value as string);
}

export class MailboxViewCache {
  private readonly lists = new Map<string, CachedListPage>();
  private readonly folders = new Map<string, Folder[]>();

  readList(url: string, accountId: string): CachedListPage | null {
    const entry = this.lists.get(url);
    if (!entry || !accountId || entry.accountId !== accountId) return null;
    touch(this.lists, url, entry, LIST_ENTRY_LIMIT);
    return entry;
  }

  writeList(url: string, entry: CachedListPage) {
    const rows = entry.rows.filter(row => row.accountId === entry.accountId);
    if (!entry.accountId || rows.length === 0) {
      this.lists.delete(url);
      return;
    }
    touch(this.lists, url, { ...entry, rows }, LIST_ENTRY_LIMIT);
  }

  dropList(url: string) {
    this.lists.delete(url);
  }

  readFolders(accountId: string): Folder[] | null {
    const entry = this.folders.get(accountId);
    if (!entry) return null;
    touch(this.folders, accountId, entry, FOLDER_ENTRY_LIMIT);
    return entry;
  }

  writeFolders(accountId: string, folders: Folder[]) {
    const own = folders.filter(folder => folder.accountId === accountId);
    if (!accountId || own.length === 0) return;
    touch(this.folders, accountId, own, FOLDER_ENTRY_LIMIT);
  }

  dropAccount(accountId: string) {
    this.folders.delete(accountId);
    for (const [url, entry] of this.lists) {
      if (entry.accountId === accountId) this.lists.delete(url);
    }
  }

  retainAccounts(accountIds: ReadonlySet<string>) {
    const known = new Set([...this.folders.keys(), ...[...this.lists.values()].map(entry => entry.accountId)]);
    for (const accountId of known) {
      if (!accountIds.has(accountId)) this.dropAccount(accountId);
    }
  }

  clear() {
    this.lists.clear();
    this.folders.clear();
  }
}

export type UseMailboxViewCacheParams = {
  // The signed-in user while the session is usable, otherwise null.
  sessionKey: string | null;
  accountIds: string[];
  activeAccountId: string;
  folders: Folder[];
};

export function useMailboxViewCache({ sessionKey, accountIds, activeAccountId, folders }: UseMailboxViewCacheParams) {
  const [cache] = useState(() => new MailboxViewCache());
  // Layout effects, declared before the list hook's: a new session or a revoked
  // mailbox is gone from the cache before anything in the same commit reads it.
  useLayoutEffect(() => {
    cache.clear();
  }, [cache, sessionKey]);
  const accountIdsKey = accountIds.join("\n");
  useLayoutEffect(() => {
    cache.retainAccounts(new Set(accountIdsKey ? accountIdsKey.split("\n") : []));
  }, [cache, accountIdsKey]);
  useLayoutEffect(() => {
    if (sessionKey && accountIdsKey.split("\n").includes(activeAccountId)) cache.writeFolders(activeAccountId, folders);
  }, [cache, sessionKey, accountIdsKey, activeAccountId, folders]);
  return cache;
}
