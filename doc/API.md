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

## Mailbox summaries and user events

`GET /api/me/mailboxes/summary` requires an active MFA session, without requiring a selected
mailbox. It returns `Cache-Control: no-store` and this contract (timestamps are Unix milliseconds):

```ts
{
  ok: true,
  mailboxes: [{
    accountId: string, name: string, email: string,
    accessRole: "viewer" | "editor" | "manager", isOwner: boolean, shared: boolean,
    unread: number | null, assignedToMe: number, unassignedOpen: number,
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
waiting, including threads with no state row. Deleted messages and state without live messages
do not contribute. Counts use one indexed collaboration query per shard. These are mailbox
badges and notifications; message browsing still selects one mailbox.

`GET /api/me/events` uses the same guard and returns `text/event-stream` with named events.
Each JSON data payload includes its event type:

```ts
{ type: "mailbox-summary", accountId: string, unread: number | null, assignedToMe: number, unassignedOpen: number }
{ type: "thread-collab", accountId: string, threadId: string, revision: number }
{ type: "mailboxes-changed" }
```

Watcher state/sync invalidations and committed collaboration mutations coalesce for 250 ms
per mailbox. A refresh sends current counts followed by each changed thread's greatest
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

The executor implements these tools with explicit input/output schemas. Scopes remain
reserved. Account binding and live mailbox role are
checked at each tool invocation; optional accountId may only repeat the token mailbox.
`list_accounts` enumerates accessible account metadata with `accessRole`. Token-creator identity comes from
`tokenRecord.createdByUserId`; activity actor is `mcp:<tokenId>`.

| Tool | Input (accountId optional on every tool) | Output |
| --- | --- | --- |
| `list_mailbox_members` | `{}` | `{ok,members}` |
| `list_mailbox_summary` | `{}` (no account override) | same `{ok,mailboxes,generatedAt}` contract as above, narrowed to the token mailbox |
| `get_thread_collaboration` | `{threadId? ,messageId?}` | `{ok,threadId,state,comments,activity}` |
| `set_thread_status` | `{threadId?,messageId?,status}` | `{ok,state}` |
| `assign_thread` | `{threadId?,messageId?,assigneeUserId}` | `{ok,state}` |
| `add_internal_comment` | `{threadId?,messageId?,body}` | `{ok,comment,state}` |
| `list_thread_activity` | `{threadId?,messageId?,limit?}` | `{ok,activity}` |

Thread tools require threadId or a stored row/RFC Message-ID; threadId takes precedence.
`list_mailbox_summary` requires viewer, derives the viewer from the live token creator, and
rechecks the token before returning. A mailbox-bound token cannot read counts from the
creator's other mailboxes, even when `list_accounts` exposes their metadata.
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

## Send responses

`POST /api/accounts/{accountId}/smtp/send`,
`POST /api/accounts/{accountId}/drafts/{draftId}/send`, and
`POST /api/accounts/{accountId}/calendar/events/{eventId}/respond` report SMTP acceptance
separately from Sent-copy persistence. These routes (and draft save) require editor and
same-origin JSON. Calendar `sendReply:false` updates participation without returning send fields.

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
