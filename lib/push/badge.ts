import { pushSettingsIncludeAccount } from "./settings";
import type { PushDeviceSettings } from "./types";

// App icon badge (Badging API). Supported by installed PWAs on iOS 16.4+,
// Chromium desktop and some Android launchers; a no-op everywhere else.

type BadgeNavigator = {
  setAppBadge?: (count?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

function currentNavigator(): BadgeNavigator | null {
  return typeof navigator === "undefined" ? null : (navigator as BadgeNavigator);
}

/** Shows `count` on the app icon; zero or an invalid count clears it. */
export function setAppBadge(count: number, nav: BadgeNavigator | null = currentNavigator()): void {
  if (!nav?.setAppBadge) return;
  const value = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  // Rejects when the document is not allowed to badge (e.g. not installed).
  const done = value > 0 ? nav.setAppBadge(value) : (nav.clearAppBadge?.() ?? nav.setAppBadge(0));
  done.catch(() => {});
}

/**
 * Unread inbox total; mailboxes not synced yet count as 0. With this device's
 * push settings it matches the server's push badge: only the selected
 * mailboxes, and no badge at all when the device turned it off.
 */
export function unreadBadgeCount(
  mailboxes: ReadonlyArray<{ accountId: string; unread: number | null }>,
  settings: PushDeviceSettings | null = null
): number {
  if (settings && !settings.badge) return 0;
  return mailboxes
    .filter((mailbox) => !settings || pushSettingsIncludeAccount(settings, mailbox.accountId))
    .reduce((total, mailbox) => total + (mailbox.unread ?? 0), 0);
}
