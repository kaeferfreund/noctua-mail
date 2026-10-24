# Installed app (PWA) and push notifications

Noctua can be installed as an app on phones and desktops. Push notifications
for new mail need an installed app on iPhone/iPad and HTTPS everywhere.

## Installing

**iPhone / iPad (iOS / iPadOS 16.4 or newer)**
1. Open the Noctua address in Safari (or any iOS browser that offers
   “Add to Home Screen”).
2. Share button → **Zum Home-Bildschirm** / **Add to Home Screen** → Add.
3. Start Noctua from the home-screen icon and sign in again: the installed app
   keeps its own cookies, separate from the browser.

Only the installed app can receive notifications on iOS; Safari tabs expose no
push support (`pushSupported()` is false there, `isIosSafari()` true and
`isStandalone()` false — the settings page shows the install hint for that
case).

**Android (Chrome, Edge, Samsung Internet)**
Menu → **App installieren** / **Install app** (or the install banner). Push
also works in a normal browser tab, but the installed app gets its own window,
icon badge (launcher-dependent) and notification channel.

**Desktop (Chrome, Edge)**
Install icon in the address bar. Firefox and Safari on macOS deliver push in
the browser without installing.

## What notifications need

- **Server**: VAPID keys in `NOCTUA_VAPID_PUBLIC_KEY`, `NOCTUA_VAPID_PRIVATE_KEY`
  and `NOCTUA_VAPID_SUBJECT`. Without them push is disabled and the settings
  show “nicht eingerichtet”.
- **Device**: permission granted in the browser/OS, enabled under Persönliche
  Einstellungen → Benachrichtigungen (per device). iOS additionally needs
  notifications allowed for the home-screen app in Settings → Mitteilungen;
  Focus modes can silence them.
- **Network**: the browser's push service (Apple, Google, Mozilla) must be
  reachable from the device and from the Noctua server.

## Service worker behaviour (`public/sw.js`)

- `push`: `new-mail` shows one notification per mailbox (tag `mail:<accountId>`,
  newer pushes replace older ones and alert again), sender first (layout in
  doc/PUSH-NOTIFICATIONS.md, “Notification layout”). `test`
  shows “Noctua: Benachrichtigungen aktiv”. A numeric `badge` sets the app icon
  badge; `badge` pushes only do that. Malformed payloads show nothing. Link
  targets outside the app origin are replaced with `/`.
- `notificationclick`: focuses the main mail window (detached windows only as a
  fallback) and posts `noctua:notification-open`, which MailClient resolves as a
  deep link; with no window open it opens the link.
- `pushsubscriptionchange`: subscribes again with the previous VAPID key (or the
  one from `/api/push/vapid-public-key`), registers the new endpoint and removes
  the old one. The new device entry starts with default settings.

## App icon badge

While the app is open, MailClient sets the icon badge to the unread inbox total
of all mailboxes from the mailbox summary feed (`lib/push/badge.ts`); signing out
clears it. While it is closed, pushes carry the badge. The Badging API works in
installed apps on iOS 16.4+, Chromium desktop and some Android launchers.

## iOS details

- `appleWebApp` metadata in `app/layout.tsx` marks the app as home-screen
  capable with the opaque `default` status bar. A translucent status bar or
  `viewport-fit=cover` would need safe-area insets throughout the shell first.
- The touch icon (`app/apple-icon.tsx`) uses opaque, full-bleed art
  (`public/icons/apple-touch-180.png`) because iOS paints transparency black.
  `build-scripts/generate_push_icons.sh` regenerates it and the monochrome
  notification badge `public/icons/icon-96-mono.png` from `base.svg`.
- Safari may revoke a subscription after pushes that show no notification, so
  the server should keep badge-only pushes rare.
