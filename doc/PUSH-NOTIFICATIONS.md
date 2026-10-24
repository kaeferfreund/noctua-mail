# Push notifications (Web Push)

New INBOX mail is announced on the user's devices through the standard Web
Push protocol (RFC 8030, VAPID RFC 8292, payload encryption RFC 8291), so it
also reaches a closed browser tab or the installed PWA on a locked phone.
Each browser profile or home-screen app that opts in is one *device*
(subscription) with its own settings.

Code: server in `lib/push/` (`types.ts` shared contract, `settings.ts`
validation and quiet hours, `subscriptions.ts` storage, `server.ts` VAPID
config, endpoint allowlist and the `web-push` transport, `send.ts` sending
rules), routes in `app/api/push/`, the hook in `lib/syncJobs.ts`. Client:
`lib/push/client.ts` and the settings panel (Persönliche Einstellungen →
Benachrichtigungen), service worker `public/sw.js`, platform helpers
`lib/push/platform.ts` and `lib/push/badge.ts`.

## Configuration

Push is off unless `NOCTUA_VAPID_PUBLIC_KEY`, `NOCTUA_VAPID_PRIVATE_KEY` and
`NOCTUA_VAPID_SUBJECT` (a `mailto:` address or `https:` URL) are all set and
valid; an incomplete or malformed set logs one warning and keeps push off.
While off, `GET /api/push/vapid-public-key` answers 404, subscribing and the
test push answer 503, and the settings panel shows "nicht eingerichtet".
Listing, changing and removing existing devices keep working.

`bun scripts/push-vapid-keys.ts [mailto:…]` prints a fresh pair and writes
nothing. Keep the pair stable: new keys invalidate every existing
subscription (devices have to opt in again). Env table: doc/DEPLOYMENT.md.

## HTTP API

All routes need a signed-in session (any member; no mailbox role) and answer
with `Cache-Control: no-store`. Mutations require the same origin; bodies are
JSON, at most 16 KB.

| Route | Body | Result |
|---|---|---|
| `GET /api/push/vapid-public-key` | – | `{ ok, publicKey }` (base64url) · 404 when push is off |
| `GET /api/push/subscriptions` | – | `{ ok, subscriptions: [{ id, endpointHash, userAgent, settings, createdAt, lastSeenAt }] }`, own devices only, never the endpoint |
| `POST /api/push/subscriptions` | `{ subscription: PushSubscriptionJSON, settings?, userAgent? }` | `{ ok, id, settings }`; upsert by endpoint |
| `PUT /api/push/subscriptions/:id` | `{ settings }` | `{ ok, settings }` |
| `DELETE /api/push/subscriptions/:id` | – | `{ ok }` |
| `DELETE /api/push/subscriptions` | `{ endpoint }` | `{ ok }`, the caller's own endpoint (after `unsubscribe()`) |
| `POST /api/push/test` | `{ id? }` | `{ ok, sent, failed }`: a `test` push to that device or to all own devices |

Errors: 400 invalid body, 401 not signed in, 403 foreign origin, 404 unknown
id or not one's own, 413 body too large, 503 push off.

Rules of `POST /api/push/subscriptions`:

- The endpoint must be `https:` on a browser push service:
  `*.googleapis.com` (Chrome, Edge, Android), `*.push.services.mozilla.com`
  (Firefox), `*.push.apple.com` (Safari, iOS), `*.notify.windows.com`
  (legacy Edge). Anything else is rejected, because the server sends requests
  to that URL (SSRF guard). `keys.p256dh` must be a 65-byte P-256 point and
  `keys.auth` 16 bytes, both base64url.
- A re-POST by the same user refreshes keys, `userAgent` and `lastSeenAt`,
  resets the failure count and keeps the stored settings unless new ones are
  given. `userAgent` defaults to the request's User-Agent (max 512 chars).
- The endpoint belongs to the browser. When a different user signs in on that
  browser and subscribes, the previous row is replaced by a new one (new id,
  default or given settings).
- A user keeps at most 20 devices; a new one evicts the least recently seen.

## Settings (per device)

```ts
{ accountIds: "all" | string[];   // mailboxes to notify about
  includeSubject: boolean;         // false → only the sender is shown
  quietHours: { from: "HH:MM", to: "HH:MM", timeZone: string } | null;
  badge: boolean; }                // include the unread count
```

Default `{ accountIds: "all", includeSubject: true, quietHours: null, badge: true }`.
The server validates strictly: all four keys, nothing else; at most 200
account ids; `HH:MM` 00:00–23:59 with `from ≠ to`; an IANA time zone. Account
ids are not checked against access when saving; at send time only mailboxes
the user can access right now are honoured, so `"all"` follows membership
changes. Quiet hours: `from` inclusive, `to` exclusive, a window with
`from > to` spans midnight, evaluated in the given time zone. Mail arriving
during quiet hours is not announced later.

Storage: master table `push_subscriptions` (`id`, `userId`, unique
`endpoint`, `p256dh`, `auth`, `userAgent`, `settings` JSON, `createdAt`,
`lastSeenAt`, `lastSentAt`, `failures`), additive migration in
`initMasterSchema`, index on `userId`.

## Sending rules

1. **Trigger.** Every successful sync job (any mode; this includes the IMAP
   IDLE watcher's repair and new-mail syncs) calls `notifyPushAfterSync` in
   the server process, next to the spam sweep. It is fire-and-forget: errors
   are logged as `[push] …` and never reach the sync job or its queue.
2. **What is new.** Per mailbox the server keeps an in-memory high-water mark
   of the INBOX `imapUid`, read over mail of the last 7 days. The first check
   after a process start only sets the mark (no notification for existing
   mail, so mail that arrives while the server is down is not announced).
   When the newest mail disappears or UIDVALIDITY resets (the maximum drops),
   the mark is reset without notifying. The mark is kept even while nobody has
   a device, so the first mail after subscribing is announced.
3. **Filter.** Announced is mail that is still in the INBOX, unread, not
   deleted, not a draft, not older than 7 days (Date header) and not marked as
   spam (`spamVerdict = "spam"`).
4. **Spam verdict.** With spam detection on for the mailbox, an unchecked
   message waits for its verdict (re-checked every 5 s) for at most 60 s, then
   it is announced anyway (e.g. when the model is unavailable).
5. **Recipients.** Every device whose settings include the mailbox. At send
   time the server re-reads the device, its settings and quiet hours, and the
   user's live access (`resolveAccountRoleRows`, so revoked, banned and
   still-provisioning users get nothing).
6. **Collapse.** At most one push per (device, mailbox) per 30 s. The first
   mail goes out at once; mail arriving within the window is collected and sent
   when the window ends as one push with `count` = number of messages and the
   newest one's sender/subject/link. Just before sending the collected mail is
   re-read: what was read, moved, deleted or marked as spam meanwhile is
   dropped, and nothing is sent when nothing is left. Pushes carry an RFC 8030
   `Topic` per mailbox, so a push service keeps only the latest undelivered one
   for an offline device.
7. **Delivery.** `web-push` with urgency `high`, TTL 12 h (test push: 5 min),
   queue concurrency 4, 10 s timeout per push. 404/410 from the push service
   deletes the device; any other failure (status, network, timeout) counts in
   `failures`, a success resets it, and the device is deleted after 5 failures
   in a row.

The server never sends `type: "badge"` pushes: browsers require a visible
notification for every push (`userVisibleOnly`), and Safari/iOS revoke
subscriptions that receive pushes without one. Badges travel in `new-mail`
pushes and are updated by the open app.

## Payload

JSON, encrypted by `web-push` (aes128gcm). Texts are trimmed to 200
characters.

```ts
type PushPayload =
  | { type: "new-mail"; accountId: string; accountName: string; count: number;
      messageId: string; threadId: string | null; from: string; subject: string | null;
      url: string; badge?: number; sentAt: number }
  | { type: "test"; url: string; sentAt: number }
  | { type: "badge"; badge: number; sentAt: number };
```

- `from` is the sender's display name, else the address.
- `subject` is `null` when the device has `includeSubject: false`.
- `url` is the app-relative deep link of the newest message
  (`serializeDeepLink`, doc/DEEP-LINKS.md), e.g. `/?a=…&f=INBOX&m=…`; the
  service worker resolves it against its own origin.
- `badge` (only when the device has `badge: true`) is the number of unread
  INBOX messages across the mailboxes the device notifies about and the user
  can access.

## iOS notes

- Web Push on iPhone/iPad needs iOS/iPadOS 16.4 or later and works only for
  the app added to the home screen ("Zum Home-Bildschirm"), not in a Safari
  tab. Permission can only be requested from a user gesture inside the
  installed app.
- Each home-screen installation is its own device; removing the app from the
  home screen ends its subscription (the push service then answers 410 and the
  server deletes the row).
- Safari's push service is `web.push.apple.com`; the VAPID subject must be a
  valid `mailto:` or `https:` contact or Apple rejects the pushes (403).
- Every push must show a notification (see above).

## Privacy and limits

- Notification texts (sender, subject) pass through the browser vendor's push
  service encrypted end-to-end; the service sees only size and timing. With
  `includeSubject: false` the subject is not part of the payload at all.
- Signing out removes the device on the server: before `POST /api/auth/logout`
  the client sends `DELETE /api/push/subscriptions` for its current endpoint
  (best effort, errors are ignored). The browser subscription itself stays, so
  a shared device shows nothing for the signed-out user until a signed-in user
  registers it again in the notification settings. Turning notifications off removes both the
  server row and the browser subscription. A device of a user without any
  access receives nothing.
- The high-water marks and collapse windows live in process memory; a restart
  only means the first sync per mailbox sets a new baseline.
