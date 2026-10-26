Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
# Collaboration API
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
All examples use synthetic data. Browser routes require a live, MFA-assured session and
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
current membership of the requested mailbox. Reads require viewer; writes require editor
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
or manager. Writes require a configured same-origin Origin (or Referer) and
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
`Content-Type: application/json` for JSON writes. Comment DELETE requires an empty body
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
and the same-origin check, with no Content-Type requirement. Responses retain session
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
refresh/deletion headers. A body-supplied accountId or userId never supplies authorization.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
## REST
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
Base: `/api/accounts/{accountId}/threads/{threadId}`. Encode threadId with
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
`encodeURIComponent`, for example `<request@example.test>` becomes
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
`%3Crequest%40example.test%3E`.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
| Method | Path | Body | Success |
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
| --- | --- | --- | --- |
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
| GET | `{base}/collab` | — | `{ok:true,state,comments,activity,members}` |
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
| PATCH | `{base}/collab` | `{status?,assigneeUserId?}` | `{ok:true,state}` |
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
| POST | `{base}/comments` | `{body}` | HTTP 201 `{ok:true,comment,state}` |
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
| DELETE | `{base}/comments/{commentId}` | none | `{ok:true,state}` |
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
| GET | `{base}/activity?limit=100` | — | `{ok:true,activity}` |
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
| GET | `/api/accounts/{accountId}/members` | — | `{ok:true,members}` |
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
Status is `open`, `in_progress`, `waiting`, or `closed`. Every transition is allowed;
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
assigning/setting the existing value preserves content and advances the thread revision.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
PATCH accepts at least one known field.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
`assigneeUserId:null` unassigns; a string must identify an enabled current mailbox member.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
Comments are Markdown source of 1–20000 characters, with at least one non-whitespace character.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
Only the author or a manager may soft-delete a comment; repeat deletion is idempotent.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
Members contain only `{userId,name,email,role,isOwner,disabled}`; ownership resolves to
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
manager and `name` is nullable. Managers see disabled members; viewers and editors see only
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
enabled members. Non-members are excluded. Activity is newest first, default limit 100, valid integer range 1–500.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
For example:
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
```http
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
PATCH /api/accounts/shared-demo/threads/%3Crequest%40example.test%3E/collab
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
Origin: http://localhost:3000
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
Content-Type: application/json
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
{"status":"waiting","assigneeUserId":"synthetic-user-a"}
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
```
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
Errors are `{ok:false,message}`: 400 for invalid fields/status/assignee/comment/limit,
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
malformed JSON or thread encoding; 401 for no live session; 403 for missing membership,
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
insufficient role or another author's comment. Mutations of threads without live messages
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
return 404. A never-known read thread returns the default open/unassigned state and empty lists.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
A thread with no remaining live messages but retained collaboration state returns that historical
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
state, with empty comments and activity.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
Same-origin rejection is HTTP 403 `{ok:false,code:"invalid_origin"}`; wrong media type is
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
415 `{ok:false,code:"json_required"}`. A nonempty comment DELETE body returns
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
400 `{ok:false,code:"unexpected_body"}`.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
## IMAP folder events
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
`GET /api/accounts/{accountId}/imap/stream` emits `folder:update` with an array of
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
`{id, uidNext?, unseen?, exists?}`. `unseen` is the unread **count** from IMAP
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
STATUS (UNSEEN); SELECT/EXAMINE's UNSEEN response is a first-unseen sequence
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
number and must never populate this field. `exists` is the total message count.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
Initial connection, EXISTS and flag changes refresh watched-folder counts with
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
STATUS; background polling uses STATUS for other folders. Omitted counts leave
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
the client's known values unchanged. Field names and count semantics are unchanged;
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
the initial event previously violated this contract. After local sync completes,
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
these counts agree with `GET /api/accounts/{accountId}/folders` for synced folders.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
## Mailbox summaries and user events
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
`GET /api/me/mailboxes/summary` requires an active MFA session, without requiring a selected
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
mailbox. It returns `Cache-Control: no-store` and this contract (timestamps are Unix milliseconds):
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
```ts
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
{
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
  ok: true,
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
  mailboxes: [{
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
    accountId: string, name: string, email: string,
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
    accessRole: "viewer" | "editor" | "manager", isOwner: boolean, shared: boolean,
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
    unread: number | null, assignedToMe: number, unassignedOpen: number, open: number,
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
    watcher: {
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
      state: "disabled" | "starting" | "idling" | "backoff" | "auth_failed" | "stopped",
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
      lastEventAt?: number
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
    }
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
  }],
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
  generatedAt: number
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
}
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
```
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
Only accessible mailboxes are enumerated, through `listAccessibleAccountsForUser`. An admin
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
without mailbox membership gets an empty list. Viewer and manager use the same counts.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
`unread` counts live unread INBOX messages in the watcher-maintained shard; it is null until
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
the first recorded successful sync. `watcher.lastEventAt` is that sync's timestamp, omitted
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
when unknown. `shared` follows the account DTO's member-count definition. Collaboration
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
counts are distinct live threads across mailbox folders: `assignedToMe` includes every status
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
assigned to the session user; `unassignedOpen` has no assignee and status open, in_progress or
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
waiting, including threads with no state row. `open` counts the same statuses across all live
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
threads regardless of assignee, matching the whole-mailbox Open view (§7.2). Both counts are
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
computed by the same SQL statement over the same distinct live threads. Deleted messages and state without live messages
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
do not contribute. Counts use one indexed collaboration query per shard. These are mailbox
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
badges and notifications; message browsing still selects one mailbox.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
`GET /api/me/events` uses the same guard and returns `text/event-stream` with named events.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
Each JSON data payload includes its event type:
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
```ts
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
{ type: "mailbox-summary", accountId: string, unread: number | null, assignedToMe: number, unassignedOpen: number, open: number, watcher: { state: "disabled" | "starting" | "idling" | "backoff" | "auth_failed" | "stopped", lastEventAt?: number } }
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
{ type: "thread-collab", accountId: string, threadId: string, revision: number }
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
{ type: "mailboxes-changed" }
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
```
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
Watcher state/sync invalidations and committed collaboration mutations coalesce for 250 ms
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
per mailbox, including watcher-only state transitions. `watcher` has the same semantics as
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
the summary response and replaces the previous watcher object (including an omitted timestamp).
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
`open` and the event `watcher` object are additive fields. Older event payloads lacking either
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
field require one coordinated canonical read; current complete events apply without a GET.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
A refresh sends current counts and watcher metadata followed by each changed thread's greatest
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
committed revision in that burst. Revisions belong to `(accountId,threadId)` and match REST
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
state/comment revisions; **mailbox-summary has no thread revision** because its counts can
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
combine multiple threads. Membership changes send `mailboxes-changed`: refetch the summary
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
and discard inaccessible mailboxes/caches. A revoked mailbox produces no further counts or
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
thread events; other accessible mailboxes continue on the same stream. Logout, ban, session
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
revocation, expiry and auth liveness failure close the stream. Every enqueue, including the
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
15-second comment heartbeat, rechecks authorization synchronously in the final DB snapshot.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
Aborting/cancelling removes subscriptions and timers. Session refresh cookies are forwarded.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
As with the existing IMAP stream there is no additional per-session stream limit.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
This is a process-local live invalidation channel with no replay/event IDs. Fetch a complete
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
summary on connect/reconnect and on `mailboxes-changed`; refresh a thread when its revision
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
advances. The transitional `/api/accounts/summary` route was removed.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
## MCP tools
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
The executor implements these tools with explicit input/output schemas. Each token
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
covers a fixed set of mailboxes, including shared mailboxes. Optional `accountId`
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
selects any covered mailbox; omission selects `mcp_tokens.accountId` (the primary).
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
Mailbox membership and role are read live at every invocation. Losing membership
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
in one mailbox does not disable the token's other mailboxes. `list_accounts` returns
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
only covered mailboxes with a current membership and `accessRole`; it derives the
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
creator from the stored token, never client-supplied identity metadata.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
`GET /api/accounts/{accountId}/mcp-tokens` returns `tokens` plus selectable `mailboxes`
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
from the creator's accessible own/shared mailboxes. Managers see all tokens covering
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
that mailbox; editors see their own. Token rows list only `accountIds` the requester can
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
access plus `hiddenMailboxCount` for the others; the primary `accountId` is not returned. `POST` accepts `{label, ttlSeconds?, accountIds?, mode?}`.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
`accountIds` must be a nonempty set of current memberships including the route mailbox
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
(the primary); omission means primary only. `mode` defaults to `drafts`:
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
| Mode | Stored scopes | Allowed operations |
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
| --- | --- | --- |
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
| `read` — Nur lesen | `["read"]` | list, search, check new mail, get |
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
| `drafts` — Lesen und Entwürfe anlegen (kein Senden) | `["read","drafts"]` | read, create and edit drafts, flags/todo/topics, thread status/assignment/comments |
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
| `full` — Vollzugriff (auch senden) | `["read","drafts","manage","send"]` | all current tools including sender identity/preferences management; send permission reserved |
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
Scopes only narrow mailbox roles. Sender identity writes still require manager;
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
personal sender preference writes require `manage` plus viewer membership.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
The central `tools/call` gate denies unclassified tools and returns an MCP tool error
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
`Token has no <scope> permission` for calls outside the mode. `tools/list` advertises only
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
the tools the token's live stored scopes allow (invalid scopes: none). There is **no MCP send tool**.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
`authorizeOutbound({tokenId}, ...)` requires `send` by default and rechecks it at the
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
final effect; draft saves explicitly require `drafts`, identity/preferences writes `manage`.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
The HTTP web send authorization is unchanged.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
Sets/modes cannot be edited after creation. A token appears in every covered mailbox's
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
MCP tab; deleting it there revokes it everywhere (the confirmation names the other covered
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
mailboxes, or counts those the user cannot access). Deleting a mailbox removes its mapping,
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
promotes the remaining mailbox with the creator's highest live role (ties by ID) if the
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
primary was deleted, and deletes tokens with no mailbox left. Token deletion also removes mapping rows. The master-only
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
`mcp_token_accounts(tokenId,accountId)` has a composite primary key; no shard changes.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
Existing tokens need no backfill: an empty mapping means primary only and `scopes=NULL`
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
means `read` + `drafts`, without `manage` or `send`. Invalid scope JSON grants no permissions.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
Token-creator activity attribution remains `mcp:<tokenId>`.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
| Tool | Input (accountId optional on every tool) | Output |
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
| --- | --- | --- |
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
| `list_mailbox_members` | `{}` | `{ok,members}` |
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
| `list_mailbox_summary` | `{accountId?}` | same `{ok,mailboxes,generatedAt}` contract as above, narrowed to the selected covered mailbox |
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
| `get_thread_collaboration` | `{threadId? ,messageId?}` | `{ok,threadId,state,comments,activity}` |
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
| `set_thread_status` | `{threadId?,messageId?,status}` | `{ok,state}` |
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
| `assign_thread` | `{threadId?,messageId?,assigneeUserId}` | `{ok,state}` |
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
| `add_internal_comment` | `{threadId?,messageId?,body}` | `{ok,comment,state}` |
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
| `list_thread_activity` | `{threadId?,messageId?,limit?}` | `{ok,activity}` |
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
Thread tools require threadId or a stored row/RFC Message-ID; threadId takes precedence.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
`list_mailbox_summary` requires viewer, derives the viewer from the live token creator, and
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
rechecks the token before returning. It reads the selected covered mailbox only
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
(default: primary), and cannot read counts from an uncovered mailbox.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
Assignment accepts `"me"` for the token creator or null to unassign. Read tools require viewer;
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
status, assignment and comment tools require editor. Existing draft/topic/flag mutation tools
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
also enforce editor. Viewer mutation calls return an MCP tool error containing
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
`Insufficient mailbox role`. Revoking membership removes access immediately; role downgrades
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
apply without issuing a new token. Token validity/generation/MFA activation stays owned by
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
feat/team-auth.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
`search_messages` (standard, related, thread-related) and `list_messages_by_folder` return
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
`collab:{status,assigneeUserId,commentCount,updatedAt}`. Supported collaboration badges are
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
`assigned-to-me`, `unassigned`, `open` (anything except closed), `closed`, `in-progress`, `waiting`.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
Assigned-to-me uses the token creator. For example:
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
```json
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"assign_thread","arguments":{"threadId":"<request@example.test>","assigneeUserId":"me"}}}
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
```
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
### MCP draft tools
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
Drafts are edited in place; clients never need to create a second version and delete the
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
old one. The tool descriptions say so, so AI clients stop proposing that workaround.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
| Tool | Scope / role | Input | Structured success |
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
| --- | --- | --- | --- |
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
| `list_draft_messages` | `read` / viewer | `{accountId?,page?,pageSize?}` | `{ok:true,folderId,drafts:[{draftId,subject,to,cc,updatedAt,editable}],total,hasMore,page,pageSize}` |
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
| `get_draft_message` | `read` / viewer | `{accountId?,draftId}` | `{ok:true,draft:{draftId,identityId,from,to,cc,bcc,subject,composeFormat,text,html,markdown,inReplyTo,references,forwardedMessageId,attachments:[{id,filename,contentType,size,inline}],updatedAt}}` |
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
| `create_draft_message` | `drafts` / editor | see [MCP sender tools](#mcp-sender-tools) | `{ok:true,mode,referenceMessageId,identityId,draftId,message}` |
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
| `update_draft_message` | `drafts` / editor | `{accountId?,draftId,identityId?,to?,cc?,bcc?,subject?,text?,markdown?,html?,composeFormat?,appendBody?}` | `{ok:true,mode,identityId,draftId,previousDraftId,draftIdChanged,message}` |
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
- Only messages in the mailbox's Drafts folder with the IMAP `\Draft` flag count as drafts
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
  (the draft-send guard); any other id returns `{ok:false,code:"invalid_draft"}` with
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
  "is not a draft", an unknown id "Draft not found". `editable:false` in the listing marks
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
  Drafts-folder messages without the flag. `search_messages` with badge `draft` also finds drafts.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
- `get_draft_message` returns `text` (text/plain part; for Markdown drafts the Markdown source,
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
  repeated in `markdown`) and `html` as stored. Inline images in `html` point at attachment
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
  URLs. Attachment bytes are never returned.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
- `update_draft_message` is partial: omitted fields keep the stored value; `to`/`cc`/`bcc`
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
  replace the whole field (empty string clears it). `text`/`html`/`markdown` replace the whole
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
  body with the same rules as `create_draft_message` (format follows the richest field unless
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
  `composeFormat` is given; Markdown keeps its source as text/plain; HTML without `text` gets a
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
  derived text/plain part). `appendBody` adds a plain-text paragraph after the authored text and
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
  before a quoted original, in the draft's format; it cannot be combined with the body fields.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
  Reply/forward headers, the calendar invite and all attachments are kept; an
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
  attachment that is not available locally fails the update (409) instead of being dropped.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
  `identityId` is optional and keeps the draft's sender; a disabled sender fails like the save
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
  route (`identity_unavailable`).
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
- The save rewrites the IMAP message (APPEND + delete of the old UID) through
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
  `saveDraftForAccount` with the live `drafts` scope and editor re-check, `clientId:mcp:<tokenId>`
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
  and the AI-modified marker, like `create_draft_message`. The Message-ID is preserved, so the
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
  draft id usually stays the same; if it changes, `draftIdChanged` is true and clients must
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
  continue with the returned `draftId`. No MCP tool has a separate rate limit.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
```json
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_draft_message","arguments":{"draftId":"imap-0123456789abcdef"}}}
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"update_draft_message","arguments":{"draftId":"imap-0123456789abcdef","appendBody":"Bitte bestätigen Sie den Termin bis Freitag."}}}
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"update_draft_message","arguments":{"draftId":"imap-0123456789abcdef","cc":"praxis@example.test","subject":"Terminbestätigung"}}}
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
```
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
## Send responses
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
`POST /api/accounts/{accountId}/smtp/send`,
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
`POST /api/accounts/{accountId}/drafts/{draftId}/send`, and
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
`POST /api/accounts/{accountId}/calendar/events/{eventId}/respond` report SMTP acceptance
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
separately from Sent-copy persistence. These routes (and draft save) require editor and
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
same-origin JSON. Calendar `sendReply:false` updates participation without returning send fields.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
Scheduled sends of saved drafts (`…/drafts/scheduled`) are described in
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
[SCHEDULED-SEND.md](SCHEDULED-SEND.md).
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
Successful SMTP acceptance always returns HTTP 200 with `ok:true` and these fields:
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
```json
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
{
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
  "ok":true,
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
  "messageId":"<synthetic-outbound@example.test>",
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
  "sentCopy":"appended",
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
  "sentFolderId":"shared-demo:Sent",
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
  "sentMessageUid":42,
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
  "sentCopyWarning":null,
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
  "postSendWarning":null
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
}
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
```
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
`sentCopy` is:
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
- `appended`: Sent APPEND succeeded and the message was ingested into the account shard.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
- `failed`: delivery succeeded but saving, locating or ingesting the Sent copy failed,
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
  or the absolute post-send IMAP deadline expired (including flags or draft cleanup).
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
- `no-sent-folder`: delivery succeeded but fresh LIST found no suitable Sent folder.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
For example, a Sent-copy failure is still a delivered message:
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
```json
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
{"ok":true,"messageId":"<synthetic-outbound@example.test>","sentCopy":"failed","sentFolderId":"shared-demo:Sent","sentMessageUid":null,"sentCopyWarning":"Email sent, but saving or indexing the Sent copy failed. Do not send it again.","postSendWarning":null}
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
```
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
Clients must visibly display sentCopyWarning and postSendWarning and must not retry SMTP
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
for either warning. The collab-ui integration owns rendering those warnings. SMTP rejection
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
continues to return an error response (`ok:false`) through the existing SMTP error handler.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
A successful calendar delivery followed by failed calendar persistence returns ok:true,
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
the send fields, and a postSendWarning; event/participation may then be absent.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
Direct send retains inviteScheduled/inviteEventId/inviteWarning; successful calendar updates
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
retain event/participation/inviteProcessing.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
The server prefers SPECIAL-USE `\Sent`, re-LISTs when its cached Sent folder is missing or APPEND reports a missing folder,
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
and limits name fallback to exact top-level or INBOX-child Sent names (never Outbox or
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
substring matches). A failed APPEND is retried once using a fresh pooled connection.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
Accepted APPEND without APPENDUID uses UID SEARCH Message-ID and never APPENDs again.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
Before retrying an ambiguous APPEND, it UID SEARCHes the Message-ID on a fresh connection
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
and ingests any existing copy. Post-send IMAP work has an absolute deadline controlled by
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
`NOCTUA_POST_SEND_TIMEOUT_MS` (default 30000 ms), including draft IMAP cleanup. Expiry closes
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
the active connection and returns accepted delivery with `sentCopy:"failed"` and warnings.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
Attribution is recorded immediately after SMTP acceptance, before IMAP work.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
SMTP is never retried after success. Draft wire copies strip Bcc while their Sent copies retain it.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
Replies/forwards record reply activity with the authenticated actor before updating
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
`\Answered`/`$Forwarded` server-side. Every outbound Message-ID, including new mail, gets shard
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
`sent_by(accountId,messageId,userId,sentAt)` attribution. Sending never changes thread status.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
## Integration seams
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
`lib/threadCollab.ts` exports temporary resolveAccountRole/roleAtLeast/listAccountMembers;
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
`app/api/_helpers/threadCollabContext.ts` adapts them to the async session guard. Replace
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
these with feat/team-auth's account-access/context helpers when Slice 3 lands; the members
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
route is team-auth-owned at integration. Do not activate
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
HTTP MCP until that branch supplies its token checks. feat/collab-ui consumes the routes,
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
collaboration enrichment, shared Sent state, and post-send warnings.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
## Personal UI language
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
`GET /api/auth/me` adds `user.uiLocale: "de" | "en" | null` to both full and
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
restricted identities. Existing identity/security fields and the four-state
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
`mailboxState` contract are unchanged. Null selects automatic locale resolution.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
`PUT /api/auth/preferences` accepts exactly `{"uiLocale":"de"}`, `{"uiLocale":"en"}`
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
or `{"uiLocale":null}` and returns `{ok:true,uiLocale:"de"|"en"|null}` with
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
`Cache-Control: no-store`. It requires the signed-in user's live MFA-assured
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
session, even without a selected mailbox, and the shared same-origin JSON checks.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
Unknown fields (including userId), invalid locales and malformed JSON return 400
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
`invalid_request`. Missing session returns 401; restricted assurance returns 403.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
Origin/media-type failures retain the existing helper's `invalid_origin` (403)
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
and `json_required` (400) conventions. Auth refresh/deletion headers are forwarded.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
The endpoint only writes the current session user's Noctua `users.uiLocale`;
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
Better Auth identity/security tables are untouched. Like switch-account, this
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
preference mutation adds no audit event.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
A successful write also synchronizes the validated `noctua-ui-locale` cookie
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
(Path=/, SameSite=Lax, one year; Automatic/null deletes it). Anonymous auth screens
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
use this device cookie directly. Resolution is personal preference → device
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
cookie → quality-weighted Accept-Language with regional variants → German.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
See [I18N.md](I18N.md) for message and formatting conventions.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
## Self-service auth JSON body limit
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
The following endpoints accept at most **16 KiB (16,384 bytes)** of JSON body,
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
including whitespace and UTF-8 encoding bytes (`AUTH_JSON_BODY_LIMIT` in
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
`app/api/_helpers/readAuthJson.ts`):
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
- `PUT /api/auth/preferences`
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
- `POST /api/auth/switch-account`
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
- `POST /api/auth/reauth`
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
- `POST /api/auth/totp/replace`
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
- `POST /api/auth/security/password`
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
- `POST /api/auth/security/backup-codes`
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
- `POST /api/auth/security/sessions/revoke`
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
- `POST /api/auth/security/passkeys/rename`
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
- `POST /api/auth/security/passkeys/remove`
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
After the existing origin/media-type and session checks, oversized bodies return
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
HTTP 413 `{ok:false,code:"payload_too_large"}` with `Cache-Control: no-store`
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
and forwarded auth response headers. The shared reader bounds its JSON buffer
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
and cancels the body stream when the limit is exceeded, including requests
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
without Content-Length. Bodies exactly at the limit use the existing validation,
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
proof and audit behaviour. Other endpoints retain their existing contracts.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
## Sender identity send contracts (slice 2)
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
All send and draft-save routes require an active MFA session and current **editor+**
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
membership of the route mailbox. These checks precede identity validation. MCP uses
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
its token creator's current membership at every tool call. Mailbox owners, transport
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
credentials, shared Sent location and `sent_by.userId` retain their existing meanings;
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
`sent_by.userId` is the person pressing Send, including another person's shared draft.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
Authorization is repeated at the **final boundary**, immediately before the first
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
SMTP connection/send, draft replacement/APPEND, calendar participation write, or
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
MCP preference/identity write. The shared `lib/outboundAuthorization.ts` helper
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
re-resolves session/token liveness, security generation, enabled user and current
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
mailbox membership/minimum role. A selected sending/default identity must still be
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
enabled in the same mailbox; a changed From/name/Reply-To configuration requires
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
review (`draft_identity_changed`). MIME composition and module loading cannot reuse
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
an earlier authorization decision: transports recheck after preparation. DB write
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
retries repeat the check inside the write transaction. Revocation/downgrade returns the existing 401/403 shapes;
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
identity invalidation returns 409, with zero outbound or mailbox mutations.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
Viewer plus token `manage` remains sufficient for own MCP preferences; manager identity management with `manage` can
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
edit/re-enable disabled identities. Local-only RSVP (`sendReply:false`) also checks
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
before its first calendar write. After SMTP acceptance, Sent persistence, `sent_by`
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
and cleanup proceed independently of later revocation and retain success/warnings.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
- `POST /api/accounts/{accountId}/smtp/send` accepts optional `identityId` alongside
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
  its existing compose fields. `from` and `envelopeFrom` are rejected. Explicit IDs
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
  must belong to this mailbox and be enabled. Omission selects using the requester's
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
  preferences and an in-mailbox source identified by `inReplyTo`; forwards use normal
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
  defaults. The response includes the effective `identityId` and all existing send/
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
  invitation fields. Resolution occurs before invitation construction and network IO.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
- `POST .../drafts/save` accepts optional `identityId` and returns
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
  `{ok:true,identityId,draftId,message}`. The request schema rejects unknown fields.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
  Existing compose attachment metadata (`id`, `size`, `url`, `loadStatus`) remains
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
  accepted alongside the MIME/dataUrl fields.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
  New drafts use the actor's defaults; edits without an ID preserve the saved identity,
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
  including returning an error for an unavailable identity. An explicit enabled ID
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
  lets the editor repair the draft. `message.senderIdentityId` records the selection.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
- `POST .../drafts/{draftId}/send` keeps its existing send behavior with no sender
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
  override. The saved draft supplies the identity; switching requires saving first.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
  Success includes `identityId` plus the existing send fields. The server inspects
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
  raw outer headers and parsed metadata: exactly one valid From, canonical display
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
  name and configured Reply-To, no conflicting Sender or Resent headers, and agreement
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
  between the optional marker, From address and metadata. Legacy drafts without a
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
  marker resolve only by a matching From in this mailbox, never the current default.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
- `POST .../calendar/events/{eventId}/respond` accepts optional `identityId` only if
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
  it matches the enabled identity for the saved `myAttendeeEmail`. Missing, stale or
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
  disabled attendee identities fail without sending or changing participation.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
  Successful replies include `identityId`; `sendReply:false` keeps its existing local
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
  participation behavior and omits send/identity fields. RSVP preserves the organizer.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
  New invitations use the selected identity for ORGANIZER and self-attendee matching.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
All MIME composition uses the resolved identity's display name/email for From and
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
an explicit SMTP `envelope.from` of that email. Envelope recipients include To/Cc/Bcc.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
Reply-To is emitted only when configured and different from From. The legacy direct
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
`replyTo` request field may be absent, empty, or exactly the configured address;
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
other values return 400 `reply_to_managed`. Received Reply-To remains a reply-recipient
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
hint, never an outgoing override. The draft-only `X-Noctua-Identity-Id` header is a
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
lookup hint, not permission; it is stripped from both wire and Sent copies. Bcc is
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
stripped from wire while retained in local draft/Sent. Approved From/Reply-To,
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
Message-ID, threading, body and attachments remain consistent between copies.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
Identity errors return `{ok:false,code,message}`: 400 `invalid_identity` for malformed
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
IDs/payloads or arbitrary From, 404 `identity_not_found` for unknown/foreign explicit
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
IDs, 409 `identity_unavailable` for disabled identities or an unknown saved/attendee
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
identity, and 409 `draft_identity_changed` when saved headers need review/resave.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
These failures preserve drafts and perform no SMTP, Sent APPEND, cleanup or attribution.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
An unavailable explicit choice never falls back. Authentication/access responses keep
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
existing 401/403 conventions. Draft structural errors retain their existing statuses.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
Tagged SMTP transport errors use the same mapper on direct/draft/calendar routes:
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
| HTTP | Code | Meaning / extra fields |
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
| --- | --- | --- |
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
| 422 | `smtp_sender_rejected` | Permanent MAIL FROM rejection or explicit sender-ownership denial deferred to RCPT/DATA. `rejectedAddress` is the validated identity; `smtpResponseCode` is numeric. |
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
| 422 | `smtp_recipient_rejected` | Permanent RCPT rejection, with bounded `rejectedRecipients` and `smtpResponseCode`. |
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
| 422 | `smtp_message_rejected` | Other permanent DATA/message rejection, with `smtpResponseCode`. |
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
| 502 | `smtp_temporary_failure` | SMTP 4xx; retry later, with `smtpResponseCode`. |
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
| 502 | `smtp_configuration_error` | SMTP authentication/configuration drift; a manager must review settings. |
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
| 502 | `smtp_connection_failed` | Connection/TLS/DNS/socket failure (`ECONNECTION`, `ESOCKET`, `EDNS`, `ETLS` and system connection errors). |
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
| 502 | `smtp_upstream_error` | Protocol/greeting rejection (`EPROTOCOL`) and every otherwise unclassified tagged SMTP failure, including `EENVELOPE`/`EMESSAGE` without a classifiable response. Fixed sanitized message; no raw provider detail. |
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
| 504 | `smtp_connection_timeout`, `smtp_greeting_timeout`, `smtp_server_timeout` | Existing timeout stages and delivery-uncertainty guidance. |
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
Responses never expose raw provider transcripts, credentials or message bodies.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
Partial recipient acceptance keeps the existing successful-send behavior. No identity
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
fallback, global auto-disable, or second SMTP attempt follows acceptance. Existing
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
`sentCopy`, `sentCopyWarning`, `postSendWarning` and absolute post-send deadlines remain
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
unchanged; accepted delivery with a Sent failure must never prompt a resend.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
### MCP sender tools
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
Every tool publishes input/output schemas. Optional `accountId` can only repeat the
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
token mailbox. Identity mutations reuse REST services, manager authorization, signature
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
reference validation and audit attribution (`clientId:mcp:<tokenId>`). There is no MCP
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
send tool; clients create drafts and use the existing application send paths.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
Signature template writes go through the same mailbox settings service as
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
`PUT /api/accounts/{accountId}/settings` (manager role, `signature_template_invalid`
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
for unsupported placeholders or bodies over 8 KiB, `signature_in_use`, conflict
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
detection, `account.update` audit); their token needs the `manage` scope.
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
| Tool | Input | Structured success / minimum role |
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
| --- | --- | --- |
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
| `list_sender_identities` | `{accountId?}` | `{ok:true,identities,defaultIdentityId?,effectiveDefaultIdentityId?,ownAddresses,warnings,recomputeJob}`; viewer |
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
| `create_sender_identity` | `{accountId?,email,displayName,replyTo?,signatureId?,isDefault?,enabled?}` | `{ok:true,identity,recomputeJob}`; manager |
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
| `update_sender_identity` | `{accountId?,identityId,patch:{displayName?,replyTo?:string\|null,signatureId?:string\|null,isDefault?,enabled?}}` | `{ok:true,identity}`; manager; disable using `enabled:false` |
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
| `get_sender_preferences` | `{accountId?}` | `{ok:true,prefs:{defaultIdentityId?,defaultSignatureId?,signatureOverride?}}`; viewer, creator's own sparse row |
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
| `set_sender_preferences` | `{accountId?,patch:{defaultIdentityId?:string\|null,defaultSignatureId?:string\|null,signatureOverride?:string\|null}}` | Same own sparse subset after merge; viewer; null restores inheritance, empty signature means none |
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
| `list_signature_templates` | `{accountId?}` | `{ok:true,signatures:[{id,name,body}],defaultSignatureId?}`; viewer |
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
| `save_signature_template` | `{accountId?,signatureId?,name,body}` | `{ok:true,signature,signatures,defaultSignatureId?}`; manager; without `signatureId` creates a template, otherwise replaces its name/body (`signature_not_found` if absent) |
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
| `delete_signature_template` | `{accountId?,signatureId}` | `{ok:true,signatures,defaultSignatureId?}`; manager; `signature_in_use` while an identity references it; clears the mailbox default if it pointed there |
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
| `set_default_signature_template` | `{accountId?,signatureId:string\|null}` | `{ok:true,signatures,defaultSignatureId?}`; manager; null or `""` means no mailbox default |
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
| `create_draft_message` | Existing new/reply/forward/body/attachment/reference fields plus `identityId?` | `{ok:true,mode,referenceMessageId,identityId,draftId,message}`; editor |
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
| `update_draft_message` | `{accountId?,draftId,identityId?,…}`, see [MCP draft tools](#mcp-draft-tools) | `{ok:true,mode,identityId,draftId,previousDraftId,draftIdChanged,message}`; editor |
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.

Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
Unknown mutation keys are rejected. Signature references must be in this mailbox;
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
personal defaults cannot reference foreign/disabled identities. Another user's prefs
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
are never returned. Expected domain errors carry `isError:true` and structured
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
`{ok:false,code,message}` in a declared `ok`-discriminated output schema. Authorization
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
errors retain existing MCP tool-error conventions. The SDK requires an object schema
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
root, so the published schema carries the discriminated variants under `anyOf`, with
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
the same variants checked by Zod. Signature rendering/insertion for MCP is the single
Signature-template write tools report a mailbox conflict (the row changed between read and
commit) as `mailbox_conflict`; retry the call. `account_not_found`, `forbidden` and
`mailbox_update_rejected` cover the remaining mailbox-service failures.
remaining Slice 3 hook, shared with the forthcoming compose initializer.
