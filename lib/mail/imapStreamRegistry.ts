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
