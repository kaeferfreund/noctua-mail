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
  leaseOwner TEXT,                              -- pid:uuid (job) or pid:uuid/manual:uuid (manual hold) while sending
  leaseStartedAt INTEGER,                       -- lease start; leases older than 10 min are interrupted
  sourceFingerprint TEXT,                       -- SHA-256 of source + parsed envelope; additive nullable column
  createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL
);
-- indexes: (status,nextAttemptAt), (accountId,draftId),
-- UNIQUE (accountId,draftId) WHERE status IN ('queued','sending')
```

`draftId` is the draft's account-local row id (stable across saves: it derives from the
preserved Message-ID). Sent receipts and quiet cancellations are pruned after 30 days. Failures
and cancellations
with a reason (revoked permissions, identity, security change, deleted/changed draft) stay visible
until dismissed or re-planned, including when the draft itself is gone. The Drafts toolbar has a
„Geplante Sendungen“ popover with the subject, reason and „Erneut planen“; cancelled drafts get a
neutral badge and reader hint.

The fingerprint includes the cached raw source, Message-ID, From and parsed To/Cc/Bcc. Both
preflight and the actual send load require placement in Drafts; the latter compares the exact
source/envelope to relay against the saved fingerprint. An external content/envelope change
cancels as `draft_changed`, leaving the draft for review. Leaving Drafts cancels as `draft_deleted`.
Legacy schedules without a fingerprint cannot be trusted and are cancelled visibly on their next
attempt; review and re-plan them. No existing schedule is silently bound to new content.

## Job

`instrumentation.ts` starts one `ScheduledSendScheduler` per server process
(`lib/scheduledSendJob.ts`). Each pass (on start, then every 15 s):

1. Rows left in `sending` by a process that no longer exists (or by an earlier incarnation of
   the same pid), and every lease older than 10 minutes (a reused pid, a hung holder), become
   `failed/interrupted` (manual holds: `failed/manual_interrupted`). They are never re-sent: the SMTP
   outcome of an interrupted attempt is unknown. Manual holds and cancel/plan requests apply the same age limit, so a stale lease
   never blocks a draft with 409; the failed row offers „Planung aufheben“.
2. Due rows (`queued`, `nextAttemptAt <= now`) are claimed with
   `UPDATE … SET status='sending', leaseOwner=? WHERE id=? AND status='queued'` inside
   `BEGIN IMMEDIATE`; only the claiming owner can settle a row. Overdue rows (server was down)
   go out on the first pass.
3. Per row (`lib/scheduledSend.ts`): account exists, the scheduling user still has editor+ on the
   mailbox (`resolveAccountRole`), the draft is still a sendable draft in the Drafts folder, then
   `sendDraftForAccount` with an opaque, branded job authorization. Its constructor is private
   to the attempt module; object literals, copies and serialized tokens are refused.
   `authorizeOutbound` checks the live claim, user role and sender identity synchronously
   right before SMTP.
   Sent copy, collaboration attribution and draft removal are those of a manual draft send.

Password changes/resets, revoke-all-sessions and other security-generation changes cancel
queued/failed schedules atomically through the existing auth generation trigger. A claimed
schedule keeps its lease to block concurrent sends, but is marked `security_revoked`; its final
SMTP authorization fails, and neither a retry nor an aborted manual operation can re-queue it.
An SMTP send already initiated before revocation cannot be recalled; a successful one is recorded
as sent. Normal logout or revoking one session does not cancel session-less schedules.

Outcomes: revoked role or unavailable identity → `cancelled` (draft kept); draft gone →
`cancelled/draft_missing`; invalid draft or explicit SMTP 5xx rejection → `failed`. Only failures
that provably happened before DATA are retried (after 1, 5 and 15 minutes, then
`failed/send_failed`): connect/DNS/TLS setup, connection or greeting timeout, authentication,
envelope (MAIL FROM/RCPT TO) and a refused DATA command (`smtpFailedBeforeData` in
`lib/mail/smtpError.ts`, from nodemailer's `code`, `originalCode`, `command` and `timeoutType`).
A dropped connection or socket timeout during/after DATA, an unclassified upstream error and
every failure of unknown phase become `failed/send_uncertain` („Prüfe den Gesendet-Ordner“).
Errors outside SMTP (database, draft source) stop before any send and are retried.

## Manual changes

Editing (draft save), discarding, „Jetzt senden“ (`POST …/drafts/{draftId}/send`) and compose
„Senden“ (`POST …/smtp/send` with the compose session's `draftId`) take the draft's queued
schedule out of the job's reach first (`holdDraftSchedules`: `queued` → `sending` under a manual
lease). The hold is closed only after the change succeeded (APPEND accepted, SMTP accepted, draft
deleted); a failed change re-queues it, a send whose SMTP outcome is uncertain fails it as
`send_uncertain`. While the job sends the draft they answer 409 `scheduled_send_busy`; the send
routes also answer 409 `scheduled_send_sent` once the schedule sent it, so compose never sends a
second copy and explains why. A successful manual send records `sent/sent_now`, including
when opening compose already cancelled the original schedule: a synthetic manual hold serializes
sends even without a queued schedule. The receipt blocks both manual sends and re-planning while
a Sent copy is pending or failed. A manual operation also re-checks its lease immediately before
SMTP/APPEND, so an expired/replaced hold cannot resume transmission. Opening a draft for editing
reads its schedule fresh from the server
(`GET …/drafts/scheduled?draftId=…`, which covers other tabs and members) and cancels it before
compose opens („Bearbeiten hebt die Planung auf“); a 404 while opening triggers a fresh read of
that draft. An undo toast cancels only its own
schedule id and never a replacement; if reloading the cancelled draft fails, a translated notice
directs the user to Drafts. The client re-reads the list when the Drafts folder or a draft opens.

## API

All routes require an MFA session and editor+ on the mailbox (viewers get 403), like sending.

- `GET /api/accounts/{accountId}/drafts/scheduled[?draftId=…]` → `{ok, scheduledSends:[{id,draftId,subject,sendAt,status,attempts,lastError,scheduledByUserId}]}`
  (open, sending, failed and reasoned cancelled rows of the mailbox or of one draft; shared mailboxes show every member's schedules).
- `POST /api/accounts/{accountId}/drafts/scheduled` `{draftId, sendAt}` → 201 `{ok, scheduledSend}`.
  Same-origin JSON, 30 per user and minute (429). `sendAt` must be an integer at least 60 seconds
  in the future, at most one year ahead (400 `send_at_past|send_at_too_soon|send_at_too_far|send_at_invalid`). The draft must pass the send
  preconditions (`\Draft` flag, recipient, cached source, valid sender identity) and sit in the
  Drafts folder; replaces an open schedule of the same draft. The dialog shows the existing
  time before replacing it; scheduling refusals use translated catalogue keys.
- `POST /api/accounts/{accountId}/drafts/scheduled/{scheduleId}/cancel` → `{ok, draftId}`; 404 when
  unknown or already dismissed, 409 while sending. Also dismisses a cancellation with a reason.

Log lines `[scheduled-send] scheduled|cancelled|attempt settled` carry ids, user and outcome,
never recipients or subjects.

## Deployment

The content snapshot requires one additive nullable `scheduled_sends.sourceFingerprint TEXT`
column. The existing security-generation trigger is updated during auth control-plane startup.
This is a master schema change: deploy
with the stopped-backup runbook in [FTS-V3-MIGRATION.md](FTS-V3-MIGRATION.md) §1–2.
