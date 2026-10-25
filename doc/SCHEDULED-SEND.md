# Scheduled send („Senden planen“)

A saved draft can be sent later. Compose offers „Senden planen …“ in the menu next to
„Senden“ (modal, inline card, phone and detached window). The dialog computes its presets
in the browser's time zone and sends only the resulting UTC instant to the server:

| Preset | Time |
| --- | --- |
| „Heute früh“ / „Morgen früh“ | 08:00 today while still ahead, otherwise tomorrow |
| „Diesen Nachmittag“ / „Morgen Nachmittag“ | 13:00 today while still ahead, otherwise tomorrow |
| „Montag morgen“ | 08:00 next Monday (today when it is Monday before 08:00) |
| „Benutzerdefinierte Zeit“ | date + time in 15-minute steps, from the next quarter hour |

Wall-clock math lives in `lib/scheduleSendTime.ts`. A time that does not exist because of a
DST gap is neither offered nor accepted; an ambiguous fall-back time resolves to its first
(summer-time) instant. „Planen“ saves the draft exactly like „Speichern“, creates the schedule
and closes compose with a toast „Senden geplant für 25. Okt., 08:00“ and „Rückgängig“
(cancels the schedule and reopens the draft).

Drafts with an event invitation cannot be scheduled: the draft send path relays the stored
draft, which carries the invitation metadata but no calendar invitation.

## Storage

One master table, created additively by `initMasterSchema` (`lib/db/schema.ts`):

```sql
CREATE TABLE scheduled_sends (
  id TEXT PRIMARY KEY, accountId TEXT NOT NULL, userId TEXT NOT NULL, draftId TEXT NOT NULL,
  sendAt INTEGER NOT NULL,                      -- UTC epoch ms chosen by the user
  status TEXT NOT NULL CHECK(status IN ('queued','sending','sent','failed','cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0, nextAttemptAt INTEGER NOT NULL,
  lastError TEXT,                               -- reason code, never upstream text
  leaseOwner TEXT,                              -- pid:uuid of the claiming process while sending
  createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL
);
-- indexes: (status,nextAttemptAt), (accountId,draftId),
-- UNIQUE (accountId,draftId) WHERE status IN ('queued','sending')
```

`draftId` is the draft's account-local row id (stable across saves: it derives from the
preserved Message-ID). Settled rows (`sent`, `cancelled`) are pruned after 30 days; `failed`
rows stay visible until the draft is edited, discarded or sent.

## Job

`instrumentation.ts` starts one `ScheduledSendScheduler` per server process
(`lib/scheduledSendJob.ts`). Each pass (on start, then every 15 s):

1. Rows left in `sending` by a process that no longer exists (or by an earlier incarnation of
   the same pid) become `failed/interrupted`. They are never re-sent: the SMTP outcome of an
   interrupted attempt is unknown.
2. Due rows (`queued`, `nextAttemptAt <= now`) are claimed with
   `UPDATE … SET status='sending', leaseOwner=? WHERE id=? AND status='queued'` inside
   `BEGIN IMMEDIATE`; only the claiming owner can settle a row. Overdue rows (server was down)
   go out on the first pass.
3. Per row (`lib/scheduledSend.ts`): account exists, the scheduling user still has editor+ on the
   mailbox (`resolveAccountRole`), the draft is still a sendable draft in the Drafts folder, then
   `sendDraftForAccount` with `authorization: { scheduledByUserId }`. `authorizeOutbound`
   re-checks the user's live role and the sender identity synchronously right before SMTP.
   Sent copy, collaboration attribution and draft removal are those of a manual draft send.

Outcomes: revoked role or unavailable identity → `cancelled` (draft kept); draft gone →
`cancelled/draft_missing`; invalid draft or SMTP 5xx rejection → `failed`; SMTP server timeout
mid-transaction → `failed/send_uncertain` (no automatic resend); other errors retry after 1, 5
and 15 minutes, then `failed/send_failed`.

## Manual changes

Editing (draft save), discarding and „Jetzt senden“ (`POST …/drafts/{draftId}/send`) first close
the draft's open schedule; while its scheduled send is running they answer 409. Opening a
scheduled draft for editing cancels the schedule before compose opens („Bearbeiten hebt die
Planung auf“).

## API

All routes require an MFA session and editor+ on the mailbox (viewers get 403), like sending.

- `GET /api/accounts/{accountId}/drafts/scheduled` → `{ok, scheduledSends:[{id,draftId,sendAt,status,attempts,lastError,scheduledByUserId}]}`
  (open, sending and failed rows of the mailbox; shared mailboxes show every member's schedules).
- `POST /api/accounts/{accountId}/drafts/scheduled` `{draftId, sendAt}` → 201 `{ok, scheduledSend}`.
  Same-origin JSON, 30 per user and minute (429). `sendAt` must be a future integer at most one
  year ahead (400 `send_at_past|send_at_too_far|send_at_invalid`). The draft must pass the send
  preconditions (`\Draft` flag, recipient, cached source, valid sender identity) and sit in the
  Drafts folder; replaces an open schedule of the same draft.
- `POST /api/accounts/{accountId}/drafts/scheduled/{scheduleId}/cancel` → `{ok, draftId}`; 404 when
  unknown or settled, 409 while sending.

Log lines `[scheduled-send] scheduled|cancelled|attempt settled` carry ids, user and outcome,
never recipients or subjects.

## Deployment

The table is additive (no change to existing tables), but it is a master schema change: deploy
with the stopped-backup runbook in [FTS-V3-MIGRATION.md](FTS-V3-MIGRATION.md) §1–2.
