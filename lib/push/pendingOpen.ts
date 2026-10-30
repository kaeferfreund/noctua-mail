/**
 * The notification target public/sw.js stores on `notificationclick`, before it focuses
 * or opens a window. The page takes it when it actually becomes alive
 * (app/hooks/usePendingNotificationOpen.ts). Names must equal public/sw.js
 * (serviceWorker.test.ts checks them).
 */
export const PENDING_OPEN_CACHE = "noctua-pending-open-v1";
export const PENDING_OPEN_URL = "/__noctua/pending-open";
/** An older tap is not opened any more: the user has moved on. */
export const PENDING_OPEN_MAX_AGE_MS = 2 * 60_000;

/** `at` is the worker's Date.now() of the tap and identifies it. */
export type PendingOpen = { url: string; at: number };

/** Reads and deletes the stored tap; deleted before anyone acts on it, so it opens once. */
export async function takePendingOpen(): Promise<PendingOpen | null> {
  if (typeof caches === "undefined") return null;
  try {
    const cache = await caches.open(PENDING_OPEN_CACHE);
    const response = await cache.match(PENDING_OPEN_URL);
    if (!response) return null;
    await cache.delete(PENDING_OPEN_URL);
    const value = (await response.json()) as Partial<PendingOpen> | null;
    return typeof value?.url === "string" && typeof value.at === "number" && Number.isFinite(value.at)
      ? { url: value.url, at: value.at }
      : null;
  } catch {
    return null;
  }
}
