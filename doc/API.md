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
assigning/setting the existing value is a no-op. PATCH accepts at least one known field.
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

## MCP tools

HTTP MCP activation remains HTTP 503 `{ok:false,code:"auth_integration_pending"}` in this
base until feat/team-auth Slice 3 lands. The executor implements these tools with explicit
input/output schemas. Scopes remain reserved. Account binding and live mailbox role are
checked at each tool invocation; optional accountId may only repeat the token mailbox.
`list_accounts` returns that mailbox with `accessRole`. Token-creator identity comes from
`tokenRecord.createdByUserId`; activity actor is `mcp:<tokenId>`.

| Tool | Input (accountId optional on every tool) | Output |
| --- | --- | --- |
| `list_mailbox_members` | `{}` | `{ok,members}` |
| `get_thread_collaboration` | `{threadId? ,messageId?}` | `{ok,threadId,state,comments,activity}` |
| `set_thread_status` | `{threadId?,messageId?,status}` | `{ok,state}` |
| `assign_thread` | `{threadId?,messageId?,assigneeUserId}` | `{ok,state}` |
| `add_internal_comment` | `{threadId?,messageId?,body}` | `{ok,comment,state}` |
| `list_thread_activity` | `{threadId?,messageId?,limit?}` | `{ok,activity}` |

Thread tools require threadId or a stored row/RFC Message-ID; threadId takes precedence.
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
