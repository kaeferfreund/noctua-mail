"use client";

import { CALENDAR_REMINDER_PRINCIPAL_KEY, clearCalendarReminderStorage } from "@/app/components/mailclient/utils/calendarReminders";
import { clearRecentMoveFolders } from "@/app/components/mailclient/utils/recentMoveFolders";
import { PENDING_OPEN_CACHE } from "@/lib/push/pendingOpen";
import { closeDetachedWindows } from "@/lib/ui/openDetachedWindow";

/**
 * The signed-in user of this browser, shared by all its windows: the main window sets it at
 * sign-in and removes it at sign-out (the reminder storage binding). A change reaches other
 * windows as a `storage` event for this key.
 */
export const BROWSER_PRINCIPAL_STORAGE_KEY = CALENDAR_REMINDER_PRINCIPAL_KEY;

export function readBrowserPrincipal(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(BROWSER_PRINCIPAL_STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

/** Reminder state of public/sw.js (must equal REMINDER_META_CACHE there; serviceWorker.test.ts checks it). */
export const REMINDER_META_CACHE = "noctua-reminder-meta-v1";

/**
 * Sign-out on a possibly shared browser: removes what this origin keeps about the
 * signed-out user outside the session — reminder cache, offline reminder edits and
 * delivered marks, the service worker's reminder state and a stored notification
 * target, recent move destinations — and closes the detached windows this window
 * opened. Best effort: a missing storage API never blocks the sign-out.
 */
export async function clearSignedOutBrowserState() {
  clearCalendarReminderStorage();
  clearRecentMoveFolders();
  closeDetachedWindows();
  if (typeof caches === "undefined") return;
  await Promise.all([REMINDER_META_CACHE, PENDING_OPEN_CACHE].map(async (name) => {
    try {
      await caches.delete(name);
    } catch {
      // Cache storage unavailable (private mode, old browser): nothing kept there.
    }
  }));
}
