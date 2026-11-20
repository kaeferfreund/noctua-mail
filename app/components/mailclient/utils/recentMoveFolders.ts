/**
 * Recent move destinations, per signed-in user and mailbox. Only the current user's history is
 * kept in this browser: another user (also of the same shared mailbox) starts empty, and sign-out
 * removes it (`clearSignedOutBrowserState`). Without a known user nothing is read or stored.
 */
const RECENT_MOVE_FOLDERS_KEY = "noctua:recent-move-folders:v2";
/** Mailbox-only history from before it was bound to a user; never read, removed on first use. */
const LEGACY_RECENT_MOVE_FOLDERS_KEY = "noctua-recent-move-folders";
const MAX_RECENT = 10;

type StoredHistory = { userId: string; folders: Record<string, string[]> };

function storage() {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage;
    value.removeItem(LEGACY_RECENT_MOVE_FOLDERS_KEY);
    return value;
  } catch {
    return null;
  }
}

function readHistory(store: Storage, userId: string): Record<string, string[]> {
  try {
    const parsed = JSON.parse(store.getItem(RECENT_MOVE_FOLDERS_KEY) ?? "null") as StoredHistory | null;
    if (parsed?.userId !== userId || !parsed.folders || typeof parsed.folders !== "object") return {};
    return parsed.folders;
  } catch {
    return {};
  }
}

export function getRecentMoveFolderIds(userId: string | null | undefined, accountId: string): string[] {
  const store = storage();
  if (!store || !userId || !accountId) return [];
  const ids = readHistory(store, userId)[accountId];
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
}

export function recordRecentMoveFolder(userId: string | null | undefined, accountId: string, folderId: string) {
  const store = storage();
  if (!store || !userId || !accountId) return;
  const folders = readHistory(store, userId);
  const current = Array.isArray(folders[accountId]) ? folders[accountId] : [];
  folders[accountId] = [folderId, ...current.filter((id) => id !== folderId)].slice(0, MAX_RECENT);
  try {
    store.setItem(RECENT_MOVE_FOLDERS_KEY, JSON.stringify({ userId, folders } satisfies StoredHistory));
  } catch {
    // Storage full or unavailable: the history is a convenience only.
  }
}

/** Sign-out: removes the move history (and the legacy mailbox-only history) of this browser. */
export function clearRecentMoveFolders() {
  const store = storage();
  try {
    store?.removeItem(RECENT_MOVE_FOLDERS_KEY);
  } catch {
    // ignore
  }
}
