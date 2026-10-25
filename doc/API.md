# Collaboration API

All examples use synthetic data. Browser routes require a live, MFA-assured session and
current membership of the requested mailbox. Reads require viewer; writes require editor
or manager. Writes require a configured same-origin Origin (or Referer) and
`Content-Type: application/json` for JSON writes. Comment DELETE requires an empty body
and the same-origin check, with no Content-Type requirement. Responses retain session
refresh/deletion headers. A body-supplied accountId or userId never supplies authorization.

## REST

Base: `/api/accounts/{accountId}/threads/{threadId}`. Encode threadId with
`encodeURIComponent`, for example `<request@example.test>` becomes
`%3Crequest%40example.test%3E`.

| Method | Path | Body | Success |
| --- | --- | --- | --- |
| GET | `{base}/collab` | — | `{ok:true,state,comments,activity,members}` |
| PATCH | `{base}/collab` | `{status?,assigneeUserId?}` | `{ok:true,state}` |
| POST | `{base}/comments` | `{body}` | HTTP 201 `{ok:true,comment,state}` |
| DELETE | `{base}/comments/{commentId}` | none | `{ok:true,state}` |
| GET | `{base}/activity?limit=100` | — | `{ok:true,activity}` |
| GET | `/api/accounts/{accountId}/members` | — | `{ok:true,members}` |

Status is `open`, `in_progress`, `waiting`, or `closed`. Every transition is allowed;
assigning/setting the existing value preserves content and advances the thread revision.
PATCH accepts at least one known field.
`assigneeUserId:null` unassigns; a string must identify an enabled current mailbox member.
Comments are Markdown source of 1–20000 characters, with at least one non-whitespace character.
Only the author or a manager may soft-delete a comment; repeat deletion is idempotent.
Members contain only `{userId,name,email,role,isOwner,disabled}`; ownership resolves to
manager and `name` is nullable. Managers see disabled members; viewers and editors see only
enabled members. Non-members are excluded. Activity is newest first, default limit 100, valid integer range 1–500.

For example:

```http
PATCH /api/accounts/shared-demo/threads/%3Crequest%40example.test%3E/collab
Origin: http://localhost:3000
Content-Type: application/json

{"status":"waiting","assigneeUserId":"synthetic-user-a"}
```

Errors are `{ok:false,message}`: 400 for invalid fields/status/assignee/comment/limit,
malformed JSON or thread encoding; 401 for no live session; 403 for missing membership,
insufficient role or another author's comment. Mutations of threads without live messages
return 404. A never-known read thread returns the default open/unassigned state and empty lists.
A thread with no remaining live messages but retained collaboration state returns that historical
state, with empty comments and activity.
Same-origin rejection is HTTP 403 `{ok:false,code:"invalid_origin"}`; wrong media type is
415 `{ok:false,code:"json_required"}`. A nonempty comment DELETE body returns
400 `{ok:false,code:"unexpected_body"}`.

## IMAP folder events

`GET /api/accounts/{accountId}/imap/stream` emits `folder:update` with an array of
`{id, uidNext?, unseen?, exists?}`. `unseen` is the unread **count** from IMAP
STATUS (UNSEEN); SELECT/EXAMINE's UNSEEN response is a first-unseen sequence
number and must never populate this field. `exists` is the total message count.
Initial connection, EXISTS and flag changes refresh watched-folder counts with
STATUS; background polling uses STATUS for other folders. Omitted counts leave
the client's known values unchanged. Field names and count semantics are unchanged;
the initial event previously violated this contract. After local sync completes,
these counts agree with `GET /api/accounts/{accountId}/folders` for synced folders.

## Mailbox summaries and user events

`GET /api/me/mailboxes/summary` requires an active MFA session, without requiring a selected
mailbox. It returns `Cache-Control: no-store` and this contract (timestamps are Unix milliseconds):

```ts
{
  ok: true,
  mailboxes: [{
    accountId: string, name: string, email: string,
    accessRole: "viewer" | "editor" | "manager", isOwner: boolean, shared: boolean,
    unread: number | null, assignedToMe: number, unassignedOpen: number, open: number,
    watcher: {
      state: "disabled" | "starting" | "idling" | "backoff" | "auth_failed" | "stopped",
      lastEventAt?: number
    }
  }],
  generatedAt: number
}
```

Only accessible mailboxes are enumerated, through `listAccessibleAccountsForUser`. An admin
without mailbox membership gets an empty list. Viewer and manager use the same counts.
`unread` counts live unread INBOX messages in the watcher-maintained shard; it is null until
the first recorded successful sync. `watcher.lastEventAt` is that sync's timestamp, omitted
when unknown. `shared` follows the account DTO's member-count definition. Collaboration
counts are distinct live threads across mailbox folders: `assignedToMe` includes every status
assigned to the session user; `unassignedOpen` has no assignee and status open, in_progress or
waiting, including threads with no state row. `open` counts the same statuses across all live
threads regardless of assignee, matching the whole-mailbox Open view (§7.2). Both counts are
computed by the same SQL statement over the same distinct live threads. Deleted messages and state without live messages
do not contribute. Counts use one indexed collaboration query per shard. These are mailbox
badges and notifications; message browsing still selects one mailbox.

`GET /api/me/events` uses the same guard and returns `text/event-stream` with named events.
Each JSON data payload includes its event type:

```ts
{ type: "mailbox-summary", accountId: string, unread: number | null, assignedToMe: number, unassignedOpen: number, open: number, watcher: { state: "disabled" | "starting" | "idling" | "backoff" | "auth_failed" | "stopped", lastEventAt?: number } }
{ type: "thread-collab", accountId: string, threadId: string, revision: number }
{ type: "mailboxes-changed" }
```

Watcher state/sync invalidations and committed collaboration mutations coalesce for 250 ms
per mailbox, including watcher-only state transitions. `watcher` has the same semantics as
the summary response and replaces the previous watcher object (including an omitted timestamp).
`open` and the event `watcher` object are additive fields. Older event payloads lacking either
field require one coordinated canonical read; current complete events apply without a GET.
A refresh sends current counts and watcher metadata followed by each changed thread's greatest
committed revision in that burst. Revisions belong to `(accountId,threadId)` and match REST
state/comment revisions; **mailbox-summary has no thread revision** because its counts can
combine multiple threads. Membership changes send `mailboxes-changed`: refetch the summary
and discard inaccessible mailboxes/caches. A revoked mailbox produces no further counts or
thread events; other accessible mailboxes continue on the same stream. Logout, ban, session
revocation, expiry and auth liveness failure close the stream. Every enqueue, including the
15-second comment heartbeat, rechecks authorization synchronously in the final DB snapshot.
Aborting/cancelling removes subscriptions and timers. Session refresh cookies are forwarded.
As with the existing IMAP stream there is no additional per-session stream limit.

This is a process-local live invalidation channel with no replay/event IDs. Fetch a complete
summary on connect/reconnect and on `mailboxes-changed`; refresh a thread when its revision
advances. The transitional `/api/accounts/summary` route was removed.

## MCP tools

The executor implements these tools with explicit input/output schemas. Each token
covers a fixed set of mailboxes, including shared mailboxes. Optional `accountId`
selects any covered mailbox; omission selects `mcp_tokens.accountId` (the primary).
Mailbox membership and role are read live at every invocation. Losing membership
in one mailbox does not disable the token's other mailboxes. `list_accounts` returns
only covered mailboxes with a current membership and `accessRole`; it derives the
creator from the stored token, never client-supplied identity metadata.

`GET /api/accounts/{accountId}/mcp-tokens` returns `tokens` plus selectable `mailboxes`
from the creator's accessible own/shared mailboxes. Managers see all tokens covering
that mailbox; editors see their own. Token rows list only `accountIds` the requester can
access plus `hiddenMailboxCount` for the others; the primary `accountId` is not returned. `POST` accepts `{label, ttlSeconds?, accountIds?, mode?}`.
`accountIds` must be a nonempty set of current memberships including the route mailbox
(the primary); omission means primary only. `mode` defaults to `drafts`:

| Mode | Stored scopes | Allowed operations |
| --- | --- | --- |
| `read` — Nur lesen | `["read"]` | list, search, check new mail, get |
| `drafts` — Lesen und Entwürfe anlegen (kein Senden) | `["read","drafts"]` | read, create and edit drafts, flags/todo/topics, thread status/assignment/comments |
| `full` — Vollzugriff (auch senden) | `["read","drafts","manage","send"]` | all current tools including sender identity/preferences management; send permission reserved |

Scopes only narrow mailbox roles. Sender identity writes still require manager;
personal sender preference writes require `manage` plus viewer membership.
The central `tools/call` gate denies unclassified tools and returns an MCP tool error
`Token has no <scope> permission` for calls outside the mode. `tools/list` advertises only
the tools the token's live stored scopes allow (invalid scopes: none). There is **no MCP send tool**.
`authorizeOutbound({tokenId}, ...)` requires `send` by default and rechecks it at the
final effect; draft saves explicitly require `drafts`, identity/preferences writes `manage`.
The HTTP web send authorization is unchanged.

Sets/modes cannot be edited after creation. A token appears in every covered mailbox's
MCP tab; deleting it there revokes it everywhere (the confirmation names the other covered
mailboxes, or counts those the user cannot access). Deleting a mailbox removes its mapping,
promotes the remaining mailbox with the creator's highest live role (ties by ID) if the
primary was deleted, and deletes tokens with no mailbox left. Token deletion also removes mapping rows. The master-only
`mcp_token_accounts(tokenId,accountId)` has a composite primary key; no shard changes.
Existing tokens need no backfill: an empty mapping means primary only and `scopes=NULL`
means `read` + `drafts`, without `manage` or `send`. Invalid scope JSON grants no permissions.
Token-creator activity attribution remains `mcp:<tokenId>`.

| Tool | Input (accountId optional on every tool) | Output |
| --- | --- | --- |
| `list_mailbox_members` | `{}` | `{ok,members}` |
| `list_mailbox_summary` | `{accountId?}` | same `{ok,mailboxes,generatedAt}` contract as above, narrowed to the selected covered mailbox |
| `get_thread_collaboration` | `{threadId? ,messageId?}` | `{ok,threadId,state,comments,activity}` |
| `set_thread_status` | `{threadId?,messageId?,status}` | `{ok,state}` |
| `assign_thread` | `{threadId?,messageId?,assigneeUserId}` | `{ok,state}` |
| `add_internal_comment` | `{threadId?,messageId?,body}` | `{ok,comment,state}` |
| `list_thread_activity` | `{threadId?,messageId?,limit?}` | `{ok,activity}` |

Thread tools require threadId or a stored row/RFC Message-ID; threadId takes precedence.
`list_mailbox_summary` requires viewer, derives the viewer from the live token creator, and
rechecks the token before returning. It reads the selected covered mailbox only
(default: primary), and cannot read counts from an uncovered mailbox.
Assignment accepts `"me"` for the token creator or null to unassign. Read tools require viewer;
status, assignment and comment tools require editor. Existing draft/topic/flag mutation tools
also enforce editor. Viewer mutation calls return an MCP tool error containing
`Insufficient mailbox role`. Revoking membership removes access immediately; role downgrades
apply without issuing a new token. Token validity/generation/MFA activation stays owned by
feat/team-auth.

`search_messages` (standard, related, thread-related) and `list_messages_by_folder` return
`collab:{status,assigneeUserId,commentCount,updatedAt}`. Supported collaboration badges are
`assigned-to-me`, `unassigned`, `open` (anything except closed), `closed`, `in-progress`, `waiting`.
Assigned-to-me uses the token creator. For example:

```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"assign_thread","arguments":{"threadId":"<request@example.test>","assigneeUserId":"me"}}}
```

### MCP draft tools

Drafts are edited in place; clients never need to create a second version and delete the
old one. The tool descriptions say so, so AI clients stop proposing that workaround.

| Tool | Scope / role | Input | Structured success |
| --- | --- | --- | --- |
| `list_draft_messages` | `read` / viewer | `{accountId?,page?,pageSize?}` | `{ok:true,folderId,drafts:[{draftId,subject,to,cc,updatedAt,editable}],total,hasMore,page,pageSize}` |
| `get_draft_message` | `read` / viewer | `{accountId?,draftId}` | `{ok:true,draft:{draftId,identityId,from,to,cc,bcc,subject,composeFormat,text,html,markdown,inReplyTo,references,forwardedMessageId,attachments:[{id,filename,contentType,size,inline}],updatedAt}}` |
| `create_draft_message` | `drafts` / editor | see [MCP sender tools](#mcp-sender-tools) | `{ok:true,mode,referenceMessageId,identityId,draftId,message}` |
| `update_draft_message` | `drafts` / editor | `{accountId?,draftId,identityId?,to?,cc?,bcc?,subject?,text?,markdown?,html?,composeFormat?,appendBody?}` | `{ok:true,mode,identityId,draftId,previousDraftId,draftIdChanged,message}` |

- Only messages in the mailbox's Drafts folder with the IMAP `\Draft` flag count as drafts
  (the draft-send guard); any other id returns `{ok:false,code:"invalid_draft"}` with
  "is not a draft", an unknown id "Draft not found". `editable:false` in the listing marks
  Drafts-folder messages without the flag. `search_messages` with badge `draft` also finds drafts.
- `get_draft_message` returns `text` (text/plain part; for Markdown drafts the Markdown source,
  repeated in `markdown`) and `html` as stored. Inline images in `html` point at attachment
  URLs. Attachment bytes are never returned.
- `update_draft_message` is partial: omitted fields keep the stored value; `to`/`cc`/`bcc`
  replace the whole field (empty string clears it). `text`/`html`/`markdown` replace the whole
  body with the same rules as `create_draft_message` (format follows the richest field unless
  `composeFormat` is given; Markdown keeps its source as text/plain; HTML without `text` gets a
  derived text/plain part). `appendBody` adds a plain-text paragraph after the authored text and
  before a quoted original, in the draft's format; it cannot be combined with the body fields.
  Reply/forward headers, the calendar invite and all attachments are kept; an
  attachment that is not available locally fails the update (409) instead of being dropped.
  `identityId` is optional and keeps the draft's sender; a disabled sender fails like the save
  route (`identity_unavailable`).
- The save rewrites the IMAP message (APPEND + delete of the old UID) through
  `saveDraftForAccount` with the live `drafts` scope and editor re-check, `clientId:mcp:<tokenId>`
  and the AI-modified marker, like `create_draft_message`. The Message-ID is preserved, so the
  draft id usually stays the same; if it changes, `draftIdChanged` is true and clients must
  continue with the returned `draftId`. No MCP tool has a separate rate limit.

```json
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_draft_message","arguments":{"draftId":"imap-0123456789abcdef"}}}
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"update_draft_message","arguments":{"draftId":"imap-0123456789abcdef","appendBody":"Bitte bestätigen Sie den Termin bis Freitag."}}}
{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"update_draft_message","arguments":{"draftId":"imap-0123456789abcdef","cc":"praxis@example.test","subject":"Terminbestätigung"}}}
```

## Send responses

`POST /api/accounts/{accountId}/smtp/send`,
`POST /api/accounts/{accountId}/drafts/{draftId}/send`, and
`POST /api/accounts/{accountId}/calendar/events/{eventId}/respond` report SMTP acceptance
separately from Sent-copy persistence. These routes (and draft save) require editor and
same-origin JSON. Calendar `sendReply:false` updates participation without returning send fields.
Scheduled sends of saved drafts (`…/drafts/scheduled`) are described in
[SCHEDULED-SEND.md](SCHEDULED-SEND.md).

Successful SMTP acceptance always returns HTTP 200 with `ok:true` and these fields:

```json
{
  "ok":true,
  "messageId":"<synthetic-outbound@example.test>",
  "sentCopy":"appended",
  "sentFolderId":"shared-demo:Sent",
  "sentMessageUid":42,
  "sentCopyWarning":null,
  "postSendWarning":null
}
```

`sentCopy` is:

- `appended`: Sent APPEND succeeded and the message was ingested into the account shard.
- `failed`: delivery succeeded but saving, locating or ingesting the Sent copy failed,
  or the absolute post-send IMAP deadline expired (including flags or draft cleanup).
- `no-sent-folder`: delivery succeeded but fresh LIST found no suitable Sent folder.

For example, a Sent-copy failure is still a delivered message:

```json
{"ok":true,"messageId":"<synthetic-outbound@example.test>","sentCopy":"failed","sentFolderId":"shared-demo:Sent","sentMessageUid":null,"sentCopyWarning":"Email sent, but saving or indexing the Sent copy failed. Do not send it again.","postSendWarning":null}
```

Clients must visibly display sentCopyWarning and postSendWarning and must not retry SMTP
for either warning. The collab-ui integration owns rendering those warnings. SMTP rejection
continues to return an error response (`ok:false`) through the existing SMTP error handler.
A successful calendar delivery followed by failed calendar persistence returns ok:true,
the send fields, and a postSendWarning; event/participation may then be absent.
Direct send retains inviteScheduled/inviteEventId/inviteWarning; successful calendar updates
retain event/participation/inviteProcessing.

The server prefers SPECIAL-USE `\Sent`, re-LISTs when its cached Sent folder is missing or APPEND reports a missing folder,
and limits name fallback to exact top-level or INBOX-child Sent names (never Outbox or
substring matches). A failed APPEND is retried once using a fresh pooled connection.
Accepted APPEND without APPENDUID uses UID SEARCH Message-ID and never APPENDs again.
Before retrying an ambiguous APPEND, it UID SEARCHes the Message-ID on a fresh connection
and ingests any existing copy. Post-send IMAP work has an absolute deadline controlled by
`NOCTUA_POST_SEND_TIMEOUT_MS` (default 30000 ms), including draft IMAP cleanup. Expiry closes
the active connection and returns accepted delivery with `sentCopy:"failed"` and warnings.
Attribution is recorded immediately after SMTP acceptance, before IMAP work.
SMTP is never retried after success. Draft wire copies strip Bcc while their Sent copies retain it.
Replies/forwards record reply activity with the authenticated actor before updating
`\Answered`/`$Forwarded` server-side. Every outbound Message-ID, including new mail, gets shard
`sent_by(accountId,messageId,userId,sentAt)` attribution. Sending never changes thread status.

## Integration seams

`lib/threadCollab.ts` exports temporary resolveAccountRole/roleAtLeast/listAccountMembers;
`app/api/_helpers/threadCollabContext.ts` adapts them to the async session guard. Replace
these with feat/team-auth's account-access/context helpers when Slice 3 lands; the members
route is team-auth-owned at integration. Do not activate
HTTP MCP until that branch supplies its token checks. feat/collab-ui consumes the routes,
collaboration enrichment, shared Sent state, and post-send warnings.

## Personal UI language

`GET /api/auth/me` adds `user.uiLocale: "de" | "en" | null` to both full and
restricted identities. Existing identity/security fields and the four-state
`mailboxState` contract are unchanged. Null selects automatic locale resolution.

`PUT /api/auth/preferences` accepts exactly `{"uiLocale":"de"}`, `{"uiLocale":"en"}`
or `{"uiLocale":null}` and returns `{ok:true,uiLocale:"de"|"en"|null}` with
`Cache-Control: no-store`. It requires the signed-in user's live MFA-assured
session, even without a selected mailbox, and the shared same-origin JSON checks.
Unknown fields (including userId), invalid locales and malformed JSON return 400
`invalid_request`. Missing session returns 401; restricted assurance returns 403.
Origin/media-type failures retain the existing helper's `invalid_origin` (403)
and `json_required` (400) conventions. Auth refresh/deletion headers are forwarded.
The endpoint only writes the current session user's Noctua `users.uiLocale`;
Better Auth identity/security tables are untouched. Like switch-account, this
preference mutation adds no audit event.

A successful write also synchronizes the validated `noctua-ui-locale` cookie
(Path=/, SameSite=Lax, one year; Automatic/null deletes it). Anonymous auth screens
use this device cookie directly. Resolution is personal preference → device
cookie → quality-weighted Accept-Language with regional variants → German.
See [I18N.md](I18N.md) for message and formatting conventions.

## Self-service auth JSON body limit

The following endpoints accept at most **16 KiB (16,384 bytes)** of JSON body,
including whitespace and UTF-8 encoding bytes (`AUTH_JSON_BODY_LIMIT` in
`app/api/_helpers/readAuthJson.ts`):

- `PUT /api/auth/preferences`
- `POST /api/auth/switch-account`
- `POST /api/auth/reauth`
- `POST /api/auth/totp/replace`
- `POST /api/auth/security/password`
- `POST /api/auth/security/backup-codes`
- `POST /api/auth/security/sessions/revoke`
- `POST /api/auth/security/passkeys/rename`
- `POST /api/auth/security/passkeys/remove`

After the existing origin/media-type and session checks, oversized bodies return
HTTP 413 `{ok:false,code:"payload_too_large"}` with `Cache-Control: no-store`
and forwarded auth response headers. The shared reader bounds its JSON buffer
and cancels the body stream when the limit is exceeded, including requests
without Content-Length. Bodies exactly at the limit use the existing validation,
proof and audit behaviour. Other endpoints retain their existing contracts.

## Sender identity send contracts (slice 2)

All send and draft-save routes require an active MFA session and current **editor+**
membership of the route mailbox. These checks precede identity validation. MCP uses
its token creator's current membership at every tool call. Mailbox owners, transport
credentials, shared Sent location and `sent_by.userId` retain their existing meanings;
`sent_by.userId` is the person pressing Send, including another person's shared draft.

Authorization is repeated at the **final boundary**, immediately before the first
SMTP connection/send, draft replacement/APPEND, calendar participation write, or
MCP preference/identity write. The shared `lib/outboundAuthorization.ts` helper
re-resolves session/token liveness, security generation, enabled user and current
mailbox membership/minimum role. A selected sending/default identity must still be
enabled in the same mailbox; a changed From/name/Reply-To configuration requires
review (`draft_identity_changed`). MIME composition and module loading cannot reuse
an earlier authorization decision: transports recheck after preparation. DB write
retries repeat the check inside the write transaction. Revocation/downgrade returns the existing 401/403 shapes;
identity invalidation returns 409, with zero outbound or mailbox mutations.
Viewer plus token `manage` remains sufficient for own MCP preferences; manager identity management with `manage` can
edit/re-enable disabled identities. Local-only RSVP (`sendReply:false`) also checks
before its first calendar write. After SMTP acceptance, Sent persistence, `sent_by`
and cleanup proceed independently of later revocation and retain success/warnings.

- `POST /api/accounts/{accountId}/smtp/send` accepts optional `identityId` alongside
  its existing compose fields. `from` and `envelopeFrom` are rejected. Explicit IDs
  must belong to this mailbox and be enabled. Omission selects using the requester's
  preferences and an in-mailbox source identified by `inReplyTo`; forwards use normal
  defaults. The response includes the effective `identityId` and all existing send/
  invitation fields. Resolution occurs before invitation construction and network IO.
- `POST .../drafts/save` accepts optional `identityId` and returns
  `{ok:true,identityId,draftId,message}`. The request schema rejects unknown fields.
  Existing compose attachment metadata (`id`, `size`, `url`, `loadStatus`) remains
  accepted alongside the MIME/dataUrl fields.
  New drafts use the actor's defaults; edits without an ID preserve the saved identity,
  including returning an error for an unavailable identity. An explicit enabled ID
  lets the editor repair the draft. `message.senderIdentityId` records the selection.
- `POST .../drafts/{draftId}/send` keeps its existing send behavior with no sender
  override. The saved draft supplies the identity; switching requires saving first.
  Success includes `identityId` plus the existing send fields. The server inspects
  raw outer headers and parsed metadata: exactly one valid From, canonical display
  name and configured Reply-To, no conflicting Sender or Resent headers, and agreement
  between the optional marker, From address and metadata. Legacy drafts without a
  marker resolve only by a matching From in this mailbox, never the current default.
- `POST .../calendar/events/{eventId}/respond` accepts optional `identityId` only if
  it matches the enabled identity for the saved `myAttendeeEmail`. Missing, stale or
  disabled attendee identities fail without sending or changing participation.
  Successful replies include `identityId`; `sendReply:false` keeps its existing local
  participation behavior and omits send/identity fields. RSVP preserves the organizer.
  New invitations use the selected identity for ORGANIZER and self-attendee matching.

All MIME composition uses the resolved identity's display name/email for From and
an explicit SMTP `envelope.from` of that email. Envelope recipients include To/Cc/Bcc.
Reply-To is emitted only when configured and different from From. The legacy direct
`replyTo` request field may be absent, empty, or exactly the configured address;
other values return 400 `reply_to_managed`. Received Reply-To remains a reply-recipient
hint, never an outgoing override. The draft-only `X-Noctua-Identity-Id` header is a
lookup hint, not permission; it is stripped from both wire and Sent copies. Bcc is
stripped from wire while retained in local draft/Sent. Approved From/Reply-To,
Message-ID, threading, body and attachments remain consistent between copies.

Identity errors return `{ok:false,code,message}`: 400 `invalid_identity` for malformed
IDs/payloads or arbitrary From, 404 `identity_not_found` for unknown/foreign explicit
IDs, 409 `identity_unavailable` for disabled identities or an unknown saved/attendee
identity, and 409 `draft_identity_changed` when saved headers need review/resave.
These failures preserve drafts and perform no SMTP, Sent APPEND, cleanup or attribution.
An unavailable explicit choice never falls back. Authentication/access responses keep
existing 401/403 conventions. Draft structural errors retain their existing statuses.

Tagged SMTP transport errors use the same mapper on direct/draft/calendar routes:

| HTTP | Code | Meaning / extra fields |
| --- | --- | --- |
| 422 | `smtp_sender_rejected` | Permanent MAIL FROM rejection or explicit sender-ownership denial deferred to RCPT/DATA. `rejectedAddress` is the validated identity; `smtpResponseCode` is numeric. |
| 422 | `smtp_recipient_rejected` | Permanent RCPT rejection, with bounded `rejectedRecipients` and `smtpResponseCode`. |
| 422 | `smtp_message_rejected` | Other permanent DATA/message rejection, with `smtpResponseCode`. |
| 502 | `smtp_temporary_failure` | SMTP 4xx; retry later, with `smtpResponseCode`. |
| 502 | `smtp_configuration_error` | SMTP authentication/configuration drift; a manager must review settings. |
| 502 | `smtp_connection_failed` | Connection/TLS/DNS/socket failure (`ECONNECTION`, `ESOCKET`, `EDNS`, `ETLS` and system connection errors). |
| 502 | `smtp_upstream_error` | Protocol/greeting rejection (`EPROTOCOL`) and every otherwise unclassified tagged SMTP failure, including `EENVELOPE`/`EMESSAGE` without a classifiable response. Fixed sanitized message; no raw provider detail. |
| 504 | `smtp_connection_timeout`, `smtp_greeting_timeout`, `smtp_server_timeout` | Existing timeout stages and delivery-uncertainty guidance. |

Responses never expose raw provider transcripts, credentials or message bodies.
Partial recipient acceptance keeps the existing successful-send behavior. No identity
fallback, global auto-disable, or second SMTP attempt follows acceptance. Existing
`sentCopy`, `sentCopyWarning`, `postSendWarning` and absolute post-send deadlines remain
unchanged; accepted delivery with a Sent failure must never prompt a resend.

### MCP sender tools

Every tool publishes input/output schemas. Optional `accountId` can only repeat the
token mailbox. Identity mutations reuse REST services, manager authorization, signature
reference validation and audit attribution (`clientId:mcp:<tokenId>`). There is no MCP
send tool; clients create drafts and use the existing application send paths.

| Tool | Input | Structured success / minimum role |
| --- | --- | --- |
| `list_sender_identities` | `{accountId?}` | `{ok:true,identities,defaultIdentityId?,effectiveDefaultIdentityId?,ownAddresses,warnings,recomputeJob}`; viewer |
| `create_sender_identity` | `{accountId?,email,displayName,replyTo?,signatureId?,isDefault?,enabled?}` | `{ok:true,identity,recomputeJob}`; manager |
| `update_sender_identity` | `{accountId?,identityId,patch:{displayName?,replyTo?:string\|null,signatureId?:string\|null,isDefault?,enabled?}}` | `{ok:true,identity}`; manager; disable using `enabled:false` |
| `get_sender_preferences` | `{accountId?}` | `{ok:true,prefs:{defaultIdentityId?,defaultSignatureId?,signatureOverride?}}`; viewer, creator's own sparse row |
| `set_sender_preferences` | `{accountId?,patch:{defaultIdentityId?:string\|null,defaultSignatureId?:string\|null,signatureOverride?:string\|null}}` | Same own sparse subset after merge; viewer; null restores inheritance, empty signature means none |
| `create_draft_message` | Existing new/reply/forward/body/attachment/reference fields plus `identityId?` | `{ok:true,mode,referenceMessageId,identityId,draftId,message}`; editor |
| `update_draft_message` | `{accountId?,draftId,identityId?,…}`, see [MCP draft tools](#mcp-draft-tools) | `{ok:true,mode,identityId,draftId,previousDraftId,draftIdChanged,message}`; editor |

Unknown mutation keys are rejected. Signature references must be in this mailbox;
personal defaults cannot reference foreign/disabled identities. Another user's prefs
are never returned. Expected domain errors carry `isError:true` and structured
`{ok:false,code,message}` in a declared `ok`-discriminated output schema. Authorization
errors retain existing MCP tool-error conventions. The SDK requires an object schema
root, so the published schema carries the discriminated variants under `anyOf`, with
the same variants checked by Zod. Signature rendering/insertion for MCP is the single
remaining Slice 3 hook, shared with the forthcoming compose initializer.
