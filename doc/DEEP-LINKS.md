# Mail shell URLs

The shell uses readable query parameters on `/`. It already renders one App Router
page; adding catch-all route pages would duplicate bootstrap and authentication.
`lib/navigation/deepLinks.ts` owns parsing, canonical serialization, membership
preflight and message-link creation. `resolveMessage.ts` uses the existing
membership-authorized account detail route. `useDeepLinks.ts` owns transactions
from URLs and publication from UI state.

| Place | Parameter / example |
| --- | --- |
| Mailbox | `a=<base64url account id>` |
| Folder | `f=INBOX` (path relative to `a`, URL encoded) |
| Reader/thread | `m=<base64url message id>` |
| Search | `q=<user-entered query>&s=all` (`folder` is default) |
| Virtual view | `view=virtual:open`, `virtual:assigned-to-me`, `virtual:unassigned`, `virtual:focused`, `virtual:action-queue`, `virtual:invite-deck` |
| Grouping | `g=none/date/week/sender/domain/year/folder/event` (`date` omitted) |
| Filters | `filter=unread,flagged` (known badge keys only) |
| Search fields | `fields=subject,body` (all fields is default; empty is supported) |
| Mailbox settings | `settings=preferences` (also account, identities, signatures, categorization, calendar, topics, translation, mcp, recipient-aliases, members) |
| Administration | `admin=users/mailboxes/invites/audit` (admin permission still required) |
| Identity/security | `security=1` |
| Calendar sidebar | `calendar=1` |
| Status/calendar panel | `panel=calendar/process/exception/reminder/mail-check` |
| New message | `c=mailto%3A` (blank composer only in outgoing URLs) |

IDs matching `acc-` (account) or `imap-` (message) followed by exactly 24
lowercase hex digits are encoded as their 12 bytes in unpadded base64url (16
characters). The parameter supplies the prefix on decode. Every other ID uses
`~<raw id>` before URL encoding, including RFC Message-IDs, collision suffixes,
uppercase hex and IDs that already look like base64url. Malformed unmarked
compact IDs are ignored. The existing membership checks and authorized detail resolver still run
after decoding.

`f` contains the folder path after `<accountId>:` without repeating the account.
A relative path starting with `~` gains an extra `~` escape. Unrelated folder IDs
and folders without an account use `~:<full folder id>` so arbitrary folder IDs
also round trip. Spaces, umlauts, slashes and reserved characters use normal URL
query encoding.

Example before (130 characters, relative URL):

```text
/?accountId=acc-0357e6dc07a93be003c3321b&folderId=acc-0357e6dc07a93be003c3321b%3AINBOX&openMessageId=imap-4d2efbb6963d6825053ba2d5
```

After (47 characters, 64% shorter):

```text
/?a=A1fm3AepO-ADwzIb&f=INBOX&m=TS77tpY9aCUFO6LV
```

This opens that account's message. Copy link
always uses the message's own account, folder and local ID, including when the
menu is used in a detached reader. No subject, sender, recipient, draft body or
signature is serialized. Search queries are intentionally visible. Unrelated
query parameters and hashes are retained.

The durable identity is **(accountId, Message.id)**. `lib/messageIds.ts` derives
IMAP row IDs from a normalized Message-ID hash, or a metadata hash when absent;
these survive ordinary sync, shard storage and reload. Account-local duplicates
may have collision suffixes, and the existing detail route handles collision-base
and legacy RFC Message-ID lookups. A message deleted and later recreated with
changed identity cannot be guaranteed to resolve. Folder IDs are mailbox IDs
plus server paths and can change on folder rename. Thread IDs are not the URL
identity: resolving the message enters its existing thread reader.

Only the compact URL scheme is accepted. Mailto protocol handlers (installed PWA
and browser registration) emit `c=<encoded mailto URI>`. Prefill is applied once
to the existing composer, then the published URL carries only `c=mailto%3A`.
The calendar import page redirects to `/?panel=calendar`. The static service
worker emits compact `a`/`m` notification URLs and forwards that same URL in warm
`noctua:notification-open` messages. Notification RFC Message-IDs use the raw
marker and resolve through the authorized message route.

## History and loading

Mailbox, folder, view, message, settings, subsection and panel changes push.
Search typing replaces the current entry. When a cold mailbox discovers its first
default folder after initial sync, that enrichment also replaces its mailbox entry. Keyboard row navigation (j/k and arrow
keys) replaces, as does canonicalizing an initial URL. Scroll is absent
from URLs. Publication never calls the switch controller; URL restoration calls
it once, even when reselecting A must cancel an in-flight switch to B. It keeps
its existing write ordering and authorization. A destination token and abort
signal prevent an older detail response from reopening a superseded destination.

Loading phases are authenticate/bootstrap → membership → account switch → base
place → authorized detail → reader → canonical URL. An initial destination stays
pending through login. A 401 returns to login with that destination retained; a
403 refreshes membership and displays a denied notice; only 404 means missing.
Network/server errors display a retry notice and preserve the requested message
in the address bar so reload can retry. Deleted messages settle on the folder;
moved messages open their current folder with a notice. A forbidden account from
the URL is discarded before a detail request and falls back to the session's
currently authorized selection, or the normal mailbox gate when none exists.

`useMobileNavigation` still derives phone visibility and supplies header Back;
with URL management enabled it neither pushes nor consumes a second history
entry. Header Back invokes browser Back. Transient Sheets retain capture-phase
interception and navigation deferral in `useMobileOverlayHistory`. Settings and
status panels use the URL history owner, preventing duplicate pushes. Initial
message links establish one list predecessor when no marked message entry exists;
this does not rely on `history.length`. Forward re-resolves the message.

The reader opens from its detail response without waiting for inbox pagination.
Existing selection/collapse/scroll-by-message-ID behavior targets the linked row;
additional pages may load afterwards to select that row. Exact history-specific
list and reader pixel/semantic anchors, cancellation of delayed scroll restoration
on user gestures, calendar date/view/event state, sort/threading preferences,
unsaved settings, nested dialogs and draft contents are outside this change.
Native iOS/Android PWA installation/link capture and cancelled OS swipe gestures
require device testing; Chromium at 390 px verifies the web history contract.

## Focused verification

```sh
bun test lib/navigation
bun test --config=bunfig.dom.toml app/components/mailclient/useDeepLinks.dom.test.tsx \
  app/hooks/useMobileNavigation.dom.test.tsx app/components/shell/SettingsFrame.dom.test.tsx
QA_SHELL_USE_BUILD=1 QA_DEEP_LINKS_FIXTURE=1 QA_SHELL_SPEC=qa-deep-links.spec.ts \
  QA_SHELL_PORT=4110 QA_SHELL_FIXTURE_IMAP_PORT=4111 \
  QA_SHELL_FIXTURE_CONTROL_PORT=4112 QA_SHELL_FIXTURE_SMTP_PORT=4113 \
  bun scripts/runQaShellBrowserTests.ts
```

The QA runner owns isolated `.tmp/qa-shell-*` data and shuts down its recorded
processes. The optional deep-link fixture adds a second granted mailbox and a
private mailbox granted only to the other synthetic identity.
