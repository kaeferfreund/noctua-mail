export type StreamOwner = { key: string; userId: string; sessionId: string };

export function isStreamKey(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{16,64}$/.test(value);
}

type StreamControl = {
  removeFolder: (folderId: string) => void | Promise<void>;
  // Browser streams opened with a client key accept folder switches from the same session.
  owner?: StreamOwner;
  setActiveFolder?: (folderId: string | null, seq: number) => void | Promise<void>;
};

const streamsByAccount = new Map<string, Set<StreamControl>>();

/**
 * Concurrent live streams. Each one holds its own IMAP connections (watched folders plus a
 * poller) outside the sync worker budget, so admission is capped per user and mailbox, per user,
 * per mailbox and for the whole process. A refused browser falls back to polling.
 */
export const IMAP_STREAM_LIMITS = { perUserMailbox: 3, perUser: 6, perMailbox: 8, total: 48 } as const;
export type ImapStreamLimits = { [K in keyof typeof IMAP_STREAM_LIMITS]: number };

const admitted = { total: 0, byUser: new Map<string, number>(), byMailbox: new Map<string, number>(),
  byUserMailbox: new Map<string, number>() };

function adjust(map: Map<string, number>, key: string, delta: number) {
  const next = (map.get(key) ?? 0) + delta;
  if (next > 0) map.set(key, next);
  else map.delete(key);
}

/** Reserves a stream slot before any upstream connection; null when a limit is reached. */
export function reserveStreamSlot(accountId: string, userId: string, limits: ImapStreamLimits = IMAP_STREAM_LIMITS) {
  const userMailbox = JSON.stringify([userId, accountId]);
  if (admitted.total >= limits.total
    || (admitted.byUser.get(userId) ?? 0) >= limits.perUser
    || (admitted.byMailbox.get(accountId) ?? 0) >= limits.perMailbox
    || (admitted.byUserMailbox.get(userMailbox) ?? 0) >= limits.perUserMailbox) return null;
  admitted.total++;
  adjust(admitted.byUser, userId, 1);
  adjust(admitted.byMailbox, accountId, 1);
  adjust(admitted.byUserMailbox, userMailbox, 1);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    admitted.total--;
    adjust(admitted.byUser, userId, -1);
    adjust(admitted.byMailbox, accountId, -1);
    adjust(admitted.byUserMailbox, userMailbox, -1);
  };
}

export function registerStream(accountId: string, control: StreamControl) {
  const existing = streamsByAccount.get(accountId) ?? new Set<StreamControl>();
  existing.add(control);
  streamsByAccount.set(accountId, existing);
  return () => {
    const bucket = streamsByAccount.get(accountId);
    if (!bucket) return;
    bucket.delete(control);
    if (bucket.size === 0) {
      streamsByAccount.delete(accountId);
    }
  };
}

export async function notifyFolderDeleted(accountId: string, folderId: string) {
  const bucket = streamsByAccount.get(accountId);
  if (!bucket || bucket.size === 0) return;
  await Promise.all(
    Array.from(bucket.values()).map(async (control) => {
      await control.removeFolder(folderId);
    })
  );
}

/** False when no live stream of this session and account carries the key. */
export function switchStreamFolder(
  accountId: string,
  owner: StreamOwner,
  folderId: string | null,
  seq: number
) {
  const control = Array.from(streamsByAccount.get(accountId) ?? []).find((entry) =>
    entry.owner?.key === owner.key &&
    entry.owner.userId === owner.userId &&
    entry.owner.sessionId === owner.sessionId
  );
  if (!control?.setActiveFolder) return false;
  void control.setActiveFolder(folderId, seq);
  return true;
}
