# Sender identities (slices 1–2)

Slice 1 implements configuration, personal preferences, delivery observations and
own-address recognition. Slice 2 implements authoritative sender selection and
validation for transport, drafts, calendar and MCP. Slice 3 supplies the compose,
settings and signature UI; older clients use the server default resolver.

## Types and serialization

```ts
type SenderIdentity = {
  id: string;
  accountId: string;
  email: string;             // immutable canonical addr-spec (ASCII/IDNA domain)
  displayName: string;       // may be empty
  replyTo?: string;          // omitted when unset, never JSON null on reads
  signatureId?: string;      // omitted when unset; same-mailbox template reference
  isDefault: boolean;
  enabled: boolean;
  createdBy: string | null;  // legacy seeds have null; retained after user deletion
  createdAt: number;         // epoch milliseconds
  updatedAt: number;
};
type RecomputeJob = {
  id: string;
  accountId: string;
  status: "queued" | "running" | "done" | "failed";
  startedAt: number;         // admission time, including time spent queued
  finishedAt?: number;       // terminal jobs only
  error?: string;            // failure detail
  pid?: number;              // present after worker spawn; operational, not stable
};
```

Read envelopes carry `recomputeJob: RecomputeJob | null`. Jobs are ephemeral,
shared across server processes in a runtime SQLite registry, and retained for
30 minutes after completion (cleanup runs on registry access). Null means no
retained job, not proof that a rebuild succeeded. Losing runtime storage loses
job history, not configuration. At most one identity job is active per mailbox
and two identity jobs admitted globally; their workers also share the durable
`NOCTUA_MAX_SYNC_WORKERS` budget and per-account leases with sync/watcher work.
Other mailboxes queue. Retries coalesce into
the active job and terminal retries have a one-second cooldown. A create during
an active scan requests one trailing scan in that slot, so new configuration is
not lost. A failed rebuild leaves the identity committed; a manager can retry.
The existing general thread-recompute action remains separate.

## REST configuration

All routes require a current authenticated session and live mailbox membership;
admin status alone grants no access. Mutations require same-origin JSON.

- `GET /api/accounts/:accountId/identities` (viewer+) returns
  `{ok:true,identities,defaultIdentityId?,effectiveDefaultIdentityId?,ownAddresses,warnings,recomputeJob}`.
  Identities include disabled entries, sorted default first, then email/id.
  Default IDs are omitted if unavailable. Warnings are strings for the requester's
  stale personal default; personal preference values are never another member's.
- `POST .../identities` (manager) accepts
  `{email,displayName,replyTo?,signatureId?,isDefault?,enabled?}` and returns
  `201 {ok:true,identity,recomputeJob}` after committing configuration. Defaults:
  `enabled:true`, `isDefault:false`, optional references unset; ID, attribution
  and timestamps are assigned by the server. No SMTP/provider probe is performed.
- `PATCH .../identities/:identityId` (manager) accepts sparse
  `{displayName?,replyTo?:string|null,signatureId?:string|null,isDefault?,enabled?}`
  and returns `200 {ok:true,identity}`. Omission preserves a field; null clears
  either optional reference. Email/id/mailbox/creation attribution are immutable.
  Promoting an enabled identity atomically replaces the mailbox default. No-op
  saves return 200 without an audit entry.
- `DELETE .../identities/:identityId` (manager) soft-disables and returns
  `200 {ok:true,identity}`. Historical addresses remain own. Promote another
  enabled identity before disabling/unsetting the default.
- `PUT .../identities` (manager) accepts exactly `{recompute:true}` and returns
  `202 {ok:true,recomputeJob}`. Poll
  `GET .../threads/recompute/status?jobId=...` (viewer+) for `{ok:true,job}`.
  Missing jobId is 400; unknown/expired jobs and jobs outside the authorized
  mailbox are 404 `{ok:false,message}`. Poll through queued/running, then refresh
  lists on done; failed jobs expose `error` and a manager retry control.

Email and Reply-To must each be a single valid addr-spec, at most 254 characters
before and after normalization; local parts are ASCII, at most 64 characters.
Domains normalize Unicode to IDNA; plus tags and dots remain significant.
Configuration rejects address lists, display syntax and controls. Display names
are 0–256 characters without controls. Reference IDs are 1–256 characters;
identity route IDs are bounded to 256. Unknown mutation keys are rejected.
Legacy primary seeds preserve an invalid pre-existing account address using a
trim/lowercase compatibility fallback; that does not relax API address validation.

Domain errors use `{ok:false,code,message}`: 400 `invalid_identity`,
`immutable_identity_field`, `invalid_preferences`; 404 `identity_not_found`
(including another mailbox's ID); 409 `identity_exists`,
`default_identity_required`, `signature_in_use`. Existing authentication,
assurance and role/access denials retain their established envelopes and may
omit `code` (401/403). A template cannot be removed until all identities unlink
it. Manager mutations write one atomic admin audit entry; no-op/rejected changes
write none. Personal signature text and credentials are excluded from that audit.

## Personal preferences and future settings consumers

`GET/PUT .../prefs` (viewer+, authenticated user's own row) keeps
`{ok:true,prefs}`. GET is sparse: absent keys mean inherit; it contains no null
deletion markers. PUT is sparse: omission preserves stored values, null deletes
a key and restores inheritance. Existing nested preferences keep deep merge.

```ts
type SenderPrefsRead = {
  defaultIdentityId?: string;   // 1–256 chars, empty invalid
  defaultSignatureId?: string;  // 0–256 chars; "" explicitly means none
  signatureOverride?: string;   // plain text; "" explicitly means none
};
type SenderPrefsPatch = { [K in keyof SenderPrefsRead]?: string | null };
```

A newly written default identity must be enabled in this mailbox, validated
inside the same immediate transaction as the preference write. Later disabling
it retains the stored choice, falls back to mailbox default and returns an
actionable warning, allowing re-enablement without rewriting everyone's prefs.
Signature overrides allow at most 8192 UTF-8 bytes and only these placeholders:
`{{user.name}}`, `{{user.email}}`, `{{identity.displayName}}`, `{{identity.email}}`.

The slices 2/3 signature-resolution contract is: own signatureOverride if present
(including empty = none), own explicit defaultSignatureId (empty = none), selected
identity.signatureId, mailbox settings.defaultSignatureId, then none. Skip missing
or deleted template references with a warning. Rendering, HTML escaping, preview
and insertion-once are not implemented by Slice 1.

Future controls must follow the existing role-aware settings frame/tab contract:
manager edits mailbox identities/default/templates; editor/viewer may inspect
identities and change their own prefs, while composing/sending requires editor+.
Read-only disabled identities are already visible to viewer mailbox members;
MCP's internal own-address context uses the same scope, never foreign identities,
personal overrides or credentials. Slice 2 adds the actor-aware identity MCP tools
documented below.

Save identities through POST/PATCH/DELETE and personal changes through PUT prefs,
separately from `/settings`; never post a whole identities array or personal
fields in account.settings/effectiveSettings. After identity saves, reload the
identity list, account ownAddresses and effective prefs. Refresh on account switch
and compose open; preserve an already-open composer's explicit choice and
revalidate it at send. Slice 3 must implement these UI refresh behaviors.

## Observations, recognition and rebuild scope

Messages expose `deliveredTo?:string[]`, `originalTo?:string[]`, and
`senderIdentityId?:string` through detail/list/related/MCP output. Recipient fields
capture only outer Delivered-To and X-Original-To, separately, normalized and
deduplicated in header order, capped at 32 each. RFC mailbox comments/quoted names/
groups are parsed without using display text as address evidence. Undefined means
not fetched; empty arrays mean examined and absent. Envelope-To and Received
text are not evidence. The draft marker is bounded to 256 characters and is
metadata, never authorization. Same-copy updates preserve observations across
storage row-ID changes, resync, move and copy; distinct folder/UID/account copies
never inherit another copy's metadata. Legacy cached source is parsed on explicit
reopen/resync, with no bulk source backfill.

Own addresses include primary plus every configured identity, including disabled
ones. Reply-To, login addresses, recipient aliases and foreign mailbox identities
are excluded. `from:me`/`with:me` match any own mailbox address; separate search
terms remain conjunctive. The pure resolver prioritizes enabled self From, then
To/Cc/Bcc/X-Original-To/Delivered-To for replies; ties prefer personal default,
mailbox default, header order, stable ID. New/forward uses personal then mailbox
default. Draft reopening preserves a saved unavailable selection.

The identity rebuild repairs canonical derived authors before summaries/signals,
keeps thread IDs and existing topic links, and never remaps threads. Calendar
participation refreshes lazily on an own-address-set change. Stored classifications
need the separate existing categories recompute action. Integration round 4 carries these changes with the collaboration snapshots and
shard-v2 writer guards; the combined regression gates verify the port.

## Handoff to slices 2/3

Follow the source design `briefs/sender-identities-design.md` §§3.2–3.5, 4–7 and 9,
and the ownership handoff in [TEAM-INBOX §9](TEAM-INBOX.md#9-work-breakdown-branches).
The original Slice 1 branch started at team-auth `2458a09`, with a handoff after
thread-collaboration `133bddc`, mailbox-watcher `bd7eb5f`, and collab-ui `1d0f0ce`.
Those dependencies are integrated in the Slice 2 base, round 4 `435ba5d`.
Keep collaboration's immediate writer transaction, messageRowIds, remap hooks and
stable thread IDs; add metadata snapshots inside that lock and never use a
Message-ID-only fallback as copy evidence. Preserve watcher UIDVALIDITY/folder/
summary behavior and union every query/output field. The integration tree's shared
worker semaphore/lease budget must also admit identity workers; retain per-account
coalescing while reusing that global budget (absent from this checkout). Re-run
collaboration cold reader/remap/send/filter tests and watcher summary/reset tests
on the port.

Slice 2 must define and publish, before claiming alias-send support:

- Direct-send effective identityId input/output, same-mailbox/enabled validation
  before network work, configured From/Reply-To and explicit SMTP envelope rules,
  managed Reply-To conflicts, SMTP permanent/transient/config-drift error codes.
- Draft-save/send identityId wire shapes, internal marker handling/removal,
  restored unknown/disabled identities, raw From/Sender/marker mismatch checks,
  no silent fallback and no second SMTP attempt after acceptance.
- RSVP attendee/organizer identity authorization, missing/stale attendee behavior,
  and consistent selected identity across calendar and transport.
- Actor-aware MCP identity CRUD/preferences/draft schemas, token-bound mailbox and
  live role checks, same-mailbox signature references and effective-ID responses.
- Integration with collaboration completeSend, shared Sent, sent_by attribution,
  accepted-but-Sent-warning and timeout contracts.

Slice 3 owns enabled-only From controls, unavailable draft state, identity dirty/
hash/autosave/detach behavior, settings saves and refresh, personal versus mailbox
defaults, shared signature resolution/rendering/preview and insertion exactly once
for all compose modes. Reuse the prior compose/settings owners' contracts; do not
add a second insertion effect. Stage 4 owns provider verification and go-live.

## Slice 2 — authoritative sending (done)

The server now supports configured sender identities across direct send, draft save/
send, calendar RSVP/new invitations, and MCP draft creation. Slice 3 supplies the
visible compose/settings controls; older compose clients can omit identityId and use
the server resolver. Configuration is an application allowlist, not proof of provider
send-as authorization. Stage 4 retains the provider probe/go-live gate.


Review round 2 closes the final-boundary gap: `lib/outboundAuthorization.ts` reuses
the live HTTP session/account and MCP token/role policies, then checks identity
availability/configuration in the final actor snapshot. Direct send, draft save/
send, RSVP (including local-only participation), MCP draft creation, own sender
preferences and identity create/update all recheck immediately before their first
effect. SMTP repeats the check after MIME composition; DB write retries recheck inside
the immediate transaction.
Post-acceptance Sent, attribution and cleanup remain independent of later access
revocation. Tests in `lib/outboundAuthorization.routes.test.ts` are named
`final boundary <path>: mid-request revocation, disabled user/identity, role downgrade and live credentials`
for `direct`, `draft-save`, `draft-send`, `calendar-respond`, `mcp-create-draft`,
`mcp-set-preferences`, `mcp-create-identity`, and `mcp-update-identity`. Each child
fixture verifies zero transport, APPEND, cleanup and persisted data changes after
revocation; sending paths also verify revocation during transport preparation and
accepted delivery surviving revocation. Viewer preferences and editing disabled
identities retain their documented permissions.

Every tagged SMTP failure now maps to a sanitized structured error, with
`smtp_upstream_error` (502) covering protocol failures and otherwise unknown errors.
The real `554 5.7.1 synthetic-provider-private-detail` greeting is exercised through
Nodemailer on direct, draft and RSVP routes in `verifySenderIdentity.ts`; responses
exclude provider text and preserve drafts. `lib/mail/smtpError.test.ts` covers all
Nodemailer error classes, unknown future codes and errors without a code.

Published contracts, with regression anchors:

- **Done: direct-send input/output and transport.** `POST .../smtp/send` accepts
  `identityId?`, returns effective `identityId`, rejects arbitrary `from/envelopeFrom`,
  resolves the current actor's defaults/in-account reply evidence, and validates before
  invitation/network work. Explicit unknown/foreign IDs are `identity_not_found`;
  disabled IDs are `identity_unavailable`. Canonical From, explicit SMTP MAIL FROM,
  configured Reply-To and `reply_to_managed` are shared across paths. Tests:
  `sender identity routes: validation before network, canonical envelope, draft preservation, RSVP, MCP live roles`
  (`lib/sendIdentity.routes.test.ts`, isolated fixture `verifySenderIdentity.ts` checks
  both the mocked raw-transport envelope and real SMTP sink envelope).
- **Done: SMTP rejection codes.** Shared tagged mapper distinguishes sender (including
  deferred RCPT/DATA ownership rejection), recipient, message, temporary, configuration
  and timeout errors. See `doc/API.md` for exact statuses/fields. Tests:
  `classifies MAIL sender without exposing provider detail`,
  `classifies deferred sender at RCPT without exposing provider detail`,
  `classifies deferred sender at DATA without exposing provider detail`,
  `classifies recipient without exposing provider detail`,
  `classifies message without exposing provider detail`, and
  `keeps 4xx transient and authentication config drift separate from permanent sender rejection`.
  The route fixture also proves partial RCPT acceptance sends exactly once.
- **Done: draft-save/send shapes and restoration.** Save accepts/returns `identityId`,
  `Message.senderIdentityId` stores the marker; missing IDs on edits preserve saved
  From. Disabled/unknown selections remain unavailable until explicitly repaired.
  Send validates one raw From, current name/Reply-To, matching marker/metadata, and
  Sender/Resent conflicts before SMTP. `draft_identity_changed` and
  `identity_unavailable` preserve draft and avoid cleanup/Sent/attribution. Marker is
  removed from wire/Sent, Bcc only from wire. Tests: route fixture above plus
  `draft identity validates raw headers and strips marker/Bcc only from outer headers`,
  every `draft rejects ...` case in `lib/draftIdentity.test.ts`, and
  `legacy known From resolves without marker, unknown/disabled/foreign identities never fall back`.
  Hidden payload/hash plumbing is covered by
  `identity-only changes mark the draft dirty and travel in the saved payload` and
  `plumbs an optional identity without generating a Reply-To override`, and
  `draft REST schema accepts the existing compose builder's attachment metadata`.
- **Done: RSVP attendee and invitation organizer authorization.** RSVP selects only
  the enabled identity for `event.myAttendeeEmail`; optional identityId cannot change
  that attendee. Missing/stale/disabled attendees return `identity_unavailable`.
  The reply's From/envelope/ICS attendee agree; new invitation ORGANIZER/self-attendee
  use the selected identity, while RSVP leaves an existing organizer unchanged.
  Tests: route fixture above and `lib/calendarReply.test.ts`/`lib/mail/sentInvite.test.ts`.
- **Done: actor-aware MCP schemas and authorization.** `list_sender_identities`,
  `create_sender_identity`, `update_sender_identity`, `get_sender_preferences`,
  `set_sender_preferences`, and `create_draft_message` publish input/output schemas.
  Draft creation uses creator prefs and returns identityId. Token mailbox binding,
  current manager/editor/viewer roles, same-mailbox identity/signature references,
  private own prefs and audited mutations use existing services. Errors are structured
  `{ok:false,code,message}` with `isError:true`; role denials retain MCP conventions.
  Tests: route fixture above (schema advertisement, manager create/update/disable/audit,
  own defaults, foreign references, editor/viewer downgrades and revocation) and
  `lib/mcpAuth.identities.test.ts`. No new MCP send tool was introduced.
- **Done: collaboration integration.** `completeSend` is untouched. Shared Sent,
  early sent_by actor attribution, reply flags, absolute deadline, cleanup/tombstone,
  and accepted-but-Sent-warning contracts are preserved. Identity appears in stored
  From; identity.createdBy never becomes the sending actor. Tests:
  `real IMAP/SMTP: direct, draft, calendar; lost APPEND acknowledgement, absolute deadline, stale folder, draft files and shared Sent`
  runs all 31 original fixture scenarios; the identity fixture additionally sends
  manager-created aliases as a different editor and checks the stored actor.

### Slice 3 handoff and integration round 5

Use `lib/sendIdentity.ts` for the server resolver contract, `lib/draftSchemas.ts` for
save shape, and `lib/draftIdentity.ts` for strict send checks. `buildRawMessage` and
`sendSmtpMessage` require a third resolved-sender argument; no Account impersonation
or primary-address fallback exists in transport. Routes use `serverSmtp` wrappers.
Explicit identity choice must travel through UI state, autosave, detached handoff and
builders; this slice adds optional builder/hash fields but no UI selection or settings.
Draft-send accepts no identity override. Refresh From/name/Reply-To by reviewing and
saving when `draft_identity_changed` is returned; never retry under a different sender.

The shared signature renderer/initializer has not landed in this base. Slice 3 must
implement it once for UI and call it once in MCP `createDraftMessage` before saving,
using the token creator's profile/prefs and resolved identity. No signature is appended
at raw send. Keep reopened shared-draft text and existing insertion tracking intact.
All remaining UI/signature work from the Slice 1 handoff remains owned by Slice 3.

For integration round 5: no changes were made to `lib/mail/completeSend.ts` or to
stored-message serialization/ingestion in `messageFromAppendedDraft`. `lib/drafts.ts`
changes are limited to imports/types, identity propagation in mode inputs, save-time
resolution/preservation and MIME marker, and send-time raw validation/envelope/header
stripping/effective-ID return. Merge the round-5 ingestion/address serialization changes
alongside these, preserving its senderKey/sourceSha256 additions. Do not replace the
new ingestion implementation with this branch's base implementation.

Household choices remain design §10: address/mailbox/alias mapping (including five
MonkeyDent areas versus four addresses), manager-owned brand/person display names,
Reply-To and mailbox/personal defaults, personal signature text/overrides, and the
controlled probe sink/forwarder-conversion plan. These choices affect initial defaults
and Stage 4 enablement; no live addresses or provider credentials were used here.

Round-2 `lib/drafts.ts` hunks only: authorization import; optional authorization
source on save/send parameters; save check after MIME build and before replacement/
APPEND; send check before the raw transport plus the same check passed to transport
for its final boundary. No ingestion/serialization edits; `completeSend.ts` remains
unchanged.

### Round-3 authorization boundary

`authorizeOutbound` prepares a live actor; its resolved promise is not permission
to perform a later effect. Each SMTP path passes a synchronous `assertCurrent`
callback to the transport. After all MIME/module preparation, the callback and
`transport.sendMail` run in one synchronous continuation, with no intervening
`await`. Draft APPEND repeats the assertion after asynchronous pool acquisition,
in the callback that immediately invokes `client.append`; replacement cleanup
likewise asserts immediately before the IMAP delete command.

Draft rows (including replacement attachment/FTS cleanup and MCP's AI flag) and
local-only RSVP participation consume authorization inside their immediate shard
write transaction. `prepareOutboundWrite` holds a master `BEGIN IMMEDIATE` lock
through that synchronous write, preventing another process from committing a
membership, session, user or identity revocation between check and write. Draft
DB retries prepare authorization again. APPEND precedes local replacement so a
denied APPEND preserves the old draft; a later denied local write also preserves
the existing local row. Series RSVP and occurrence-override cleanup share a
transaction. Successful SMTP acceptance still owns Sent, attribution, RSVP
persistence and draft-send cleanup independently of later revocation.

`lib/outboundAuthorization.routes.test.ts` runs isolated fixtures that queue
membership removal, user disablement, viewer downgrade and identity disablement
immediately after an assertion. Already queued revocations deny without SMTP,
APPEND, cleanup or local DB writes. Transport spies prove SMTP/APPEND initiation
precedes a revocation queued by the final synchronous assertion. Transaction
probes prove draft/RSVP writes hold both writer transactions, run before the
queued revocation, and reject revocation between async authorization and the
transaction. MCP stores its AI flag in the same guarded creation transaction.

### Round-2 verification (2026-10-23)

Bun 1.4.4; heavy gates ran sequentially with `nice -n 15`, worktree-local
TMPDIR and synthetic loopback fixtures only. No timeout, retry budget or existing
assertion was weakened.

- `bun run typecheck`: zero errors in 1,103 files.
- Focused route/transport/MCP/draft/calendar gates: 90 passed, zero failed,
  253 assertions across 12 files (37.42s). Includes all 31 real IMAP/SMTP send
  scenarios and private-greeting sanitization on direct, draft and RSVP paths.
- `timeout 1800 bun run test:ci`: 2,559 server tests, zero failed, 8,561 assertions,
  278 files (379.74s); then 366 DOM tests, zero failed, 2,134 assertions,
  40 files (35.66s).
- `timeout 2400 bun run test:stress`: seed 1337, rerun-each=3; final run 7,677
  passed, zero failed, 25,683 assertions, 278 files (1067.51s). All 24 executions
  of the new boundary tests and all three 31-scenario send-fixture runs passed.
- The initial stress run had 7,676 passed and one `SQLITE_BUSY` failure in Better
  Auth's adapter during fixture-session creation in `senderIdentityMetadata.test.ts`
  (25,677 assertions, 1082.59s). The same test's other two repetitions passed.
  Its isolated randomized retry passed 15 tests / 90 assertions (5.89s), followed
  by the complete successful stress rerun above, with unchanged code and limits.
- `timeout 600 bun run lint`: exit 1 at the stated baseline: one pre-existing
  `useCalendarConflicts.ts:58` error and 25 warnings; no changed-file findings.
- `timeout 1200 bun run build`: exit 0, including production TypeScript validation.
- `git diff --check`: exit 0. Protected paths and `completeSend.ts` are unchanged;
  the five localized `drafts.ts` hunks are listed above.

### Local write-guard timing contract (round 5)

Every guarded local write owns the shard writer before requesting the master
writer. Read-only planning may run under that shard lock: message upsert resolves
FTS deletion rowids there, using the same stable shard snapshot as the later DML.
Planning must not publish files, mutate SQL, or treat an earlier actor snapshot as
authority. It finishes before acquiring master. The final live assertion, first
effect, file installation and shard COMMIT remain in one synchronous continuation
under master IMMEDIATE exclusion. Master is released only after shard commit or
failure. Async staging and cleanup remain outside both locks. Caller-owned
transactions are rejected.

A failed master BEGIN is a short handshake collision. The shared retry helper
allows at most 16 jittered short waits (nominally 1, 2, 4, then 8 ms), followed by
the existing coarse 120/240/480/960 ms schedule. Its handshake wall budget is
2160 ms, the existing 1800 ms scheduled budget plus its maximum 20% jitter;
preparation time counts against it. At most 21 whole attempts can run. Each retry
rolls back the shard, releases both locks, and prepares fresh authorization.
Shard/DML/COMMIT BUSY errors retain the existing five-attempt coarse policy.
Neither the master/auth timeout (0 ms) nor shard timeout (15000 ms) changes.
Retry telemetry includes operation, acquisition/write phase, short/coarse policy,
attempt, delay and elapsed time.
Hot authorization and admission queries reuse compiled SQLite statements; every
invocation still executes against the current transaction, with fresh bindings.

The durable admission pump also avoids repeating queue inserts/owner renewals
while an existing ticket's owner has a healthy renewal margin, and skips
promotions that would leave priority unchanged. These hints never create tickets
or leases, grant admission, or raise priority. Missing tickets, actual promotions
and owners within five seconds of expiry use the original writer path and coarse
retry pacing; renewal, recovery and durable cleanup retain their authority.
Master-only lease writes keep all four coarse waits first. Only a failed master
acquisition that would otherwise exhaust can use the same bounded short recovery
burst, within the same 2160 ms budget. DML/COMMIT failures still exhaust at the
original five attempts. This avoids accelerating every normal worker admission
while recovering rare release, queue and scheduler collisions.

Worker admission can return false using a read-only eligibility hint when
capacity is full or another queue head is eligible. A hint never grants a lease.
Possible dead/expired-owner recovery or an owner within five seconds of expiry
uses the original writer transaction. All successful reservations, fairness
updates, spawn binding and durable release/cancel cleanup retain their original
writer-locked authority checks. A child already bound to its exact PID and a
scheduler already owned by the same live process still acquire that writer for
the authoritative check; they omit a redundant UPDATE while expiry is more than
five seconds away. Actual binding and renewal remain durable, with unchanged
15-second lease durations. No successful admission is granted by a read hint.
