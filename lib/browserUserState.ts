"use client";

import { clearCalendarReminderStorage } from "@/app/components/mailclient/utils/calendarReminders";
import { PENDING_OPEN_CACHE } from "@/lib/push/pendingOpen";

/** Reminder state of public/sw.js (must equal REMINDER_META_CACHE there; serviceWorker.test.ts checks it). */
export const REMINDER_META_CACHE = "noctua-reminder-meta-v1";

/**
 * Sign-out on a possibly shared browser: removes what this origin keeps about the
 * signed-out user outside the session — reminder cache, offline reminder edits and
 * delivered marks, the service worker's reminder state and a stored notification
 * target. Best effort: a missing storage API never blocks the sign-out.
 */
export async function clearSignedOutBrowserState() {
  clearCalendarReminderStorage();
  if (typeof caches === "undefined") return;
  await Promise.all([REMINDER_META_CACHE, PENDING_OPEN_CACHE].map(async (name) => {
    try {
      await caches.delete(name);
    } catch {
      // Cache storage unavailable (private mode, old browser): nothing kept there.
    }
  }));
}
