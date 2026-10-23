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

## Slice 3 — Compose, settings and signatures

Compose loads a fresh, authenticated mailbox snapshot on account switch, compose
open, and sender settings/preferences changes. Initial login and settings module
warm-up do not eagerly fetch private composer preferences. It never caches private sender
preferences globally. Cross-window refresh receipts contain only account ID and a
nonce, so detached composers also refresh without storing private signature text in
localStorage. `lib/ui/senderSettings.ts` reads identities, sparse own prefs
and the authenticated profile/mailbox configuration. The existing pure
`resolveComposeIdentity` supplies saved draft preservation, personal/mailbox
fallbacks, self-sender priority and To/Cc/Bcc/X-Original-To/Delivered-To reply tiers.
Only enabled identities appear as selectable From choices; an unavailable saved
selection remains visible and blocks send/save until the person explicitly repairs
it. Viewer From/send controls are disabled. The labeled From row is shared by
inline, modal, mobile and detached compose.

The selected `identityId` travels through the draft hash, automatic/manual/handoff
save and direct send. Save/send responses reflect the effective ID without letting
an obsolete save overwrite a newer choice. Empty detached sessions also retain
account/identity and signature-initialization state in their handoff (so removing a
signature in an empty composer survives detach); saved sessions restore the draft's identity and
rendered body. Minimize/restore preserves the current session. Account resets cancel
initialization and persistence from the previous session.

`IdentitiesTabContent` lets managers create/edit display names, Reply-To and template
links, enable/disable identities and promote an enabled mailbox default. Email is
immutable after creation. Editors/viewers see the historical read-only list.
Identity mutations use POST/PATCH, never `/settings` arrays. The default cannot be
disabled until another identity is promoted. Own Default From and signatures save
only changed keys to `/prefs`; null restores inheritance and empty signature text
means none. Shared signature template/default saves use `/settings` with
`teamDefaults:true`, independently of own preferences. Saved identity changes also
refresh the account own-address presentation.

`lib/signatureTemplates.ts` validates and renders the four supported placeholders:
`{{user.name}}`, `{{user.email}}`, `{{identity.displayName}}`, `{{identity.email}}`.
The signed-in person's email is the fallback for an absent personal name. Job titles
are plain template text, because this contract has no user-title field. Substitution
is single-pass with normalized line endings, HTML escaping, and escaped Markdown.
The resolution order is own override (including empty), own explicit template/none,
identity template, mailbox template, none. Missing references produce a warning.
Personal overrides belong to the user/mailbox preference row; identity-specific
shared templates are linked from each identity.

The existing `computeComposeInitState`/`useComposeController.openCompose` path now
resolves identity and signature with the initial body. It inserts once for new,
reply/replyAll and forward, before quotes, in text/HTML/Markdown. Draft reopen leaves
the authored text intact. There is no signature insertion effect. The existing
Lexical initialization callback captures the serialized signature paragraph in the
tracking ref; this changes no body content. Format conversion and refresh do not
append another signature. Replacement removes only an exact unique tracked block.
An edited/ambiguous block is preserved unless the user confirms the explicit
replacement prompt; when its boundaries cannot be identified safely, confirmation
adds the new signature and keeps the edited text, as the prompt explains.

Slice-2 identity/SMTP errors appear inline beside From with a Review From link.
`identity_unavailable` and `draft_identity_changed` direct the person to choose/review
and save. SMTP copy distinguishes sender, recipients, content, temporary failure,
configuration, connection and delivery uncertainty. Existing accepted-send Sent-copy
and post-send warnings remain independent; a rejection never closes the composer.

Regression anchors:

- `compose identity selection` covers personal/mailbox defaults, all reply tiers,
  self From, forward and disabled/unknown saved identities.
- `sender compose initializer` covers new/reply/replyAll/forward × all three formats,
  single insertion before quotes, saved draft preservation, explicit none and own text.
- `signature templates` covers single-pass substitutions, HTML/Markdown escaping,
  fallback, UTF-8 bounds, unavailable templates and preservation of edited blocks.
- `compose From control` covers associated inline/modal labels, enabled choices,
  one-identity/mobile row, unavailable guidance and viewer gating.
- `sender identity settings` covers manager CRUD/default/enable state, editor/viewer
  read-only history, sparse own From/override saves, preview, none and inheritance.
- `sender identity compose integration` covers identity-only autosave,
  minimize/restore, edited-signature confirmation, normalized Lexical replacement,
  and detached captured account/identity. The existing cold conversion, send-race,
  account-switch, focus and accepted-warning tests retain their coverage.
- `inline sender rejection` covers both identity conflicts and every documented
  smtp_* code. `lib/ui/senderSettings.test.ts` verifies uncached reads and mailbox scope.
- `tests/browser/compose/qa-compose.spec.ts` adds the production settings/From/signature,
  saved-draft restore/send and phone From scenario. Use `playwright.compose.config.ts`;
  `seedSenderCompose.ts` reuses the enrolled synthetic two-person shell fixture.
  Alex saves shared templates and a personal override, restores/sends a saved draft,
  and Jo sends directly using Jo's profile. Distinct TEST-NET proxy clients and
  paced logins keep the real production auth limits intact.
- `lib/mail/resyncMessage.senderKey.test.ts` runs its existing real-IMAP cases in
  fresh Bun processes. Pool unit tests intentionally leave a shared connect mock
  installed; the added test files exposed this order dependency under seed 1337.
  The two-file randomized reproducer changed from 51 pass / 6 fail to 57 pass /
  zero fail across three repetitions. All original assertions and the 20-second
  case budget remain; no production IMAP/SMTP code changed.

Parallel-owner boundaries: this slice does not modify routes, DB/server code,
transport, `lib/drafts.ts` or `lib/mcpServer.ts`. MCP's call to the shared renderer
must be integrated by its owner; UI signature insertion does not append signatures
in raw send. The household mapping/display-name/Reply-To/default/signature/probe
choices from design §10 and Stage 4 provider/PWA acceptance remain open.

### Slice 3 verification (2026-10-23)

Bun 1.4.4; heavy gates ran sequentially with `nice -n 15`, worktree-local
TMPDIR and synthetic loopback fixtures. Timeouts, retries and original assertions
were preserved. The production server used 3880, with IMAP/SMTP/control on
3882/3883/3884; both owned processes were stopped after browser verification.

- `bun run typecheck`: zero errors in 1,189 files.
- Focused pure tests, three repetitions: 372 passed, zero failed, 1,323 assertions
  across 10 files (0.318s). Focused DOM including lazy-settings/cold-compose/send
  races, three repetitions: 210 passed, zero failed, 1,722 assertions across seven
  files (96.37s).
- `timeout 1800 bun run test:ci`: 2,790 server tests, zero failed, 11,480 parent
  assertions across 304 files (495.57s); then 450 DOM tests, zero failed, 2,675
  assertions across 55 files (68.84s). Real resync assertions also run in the
  isolated children and are not included in the parent's assertion counter.
- `timeout 2400 bun run test:stress`: seed 1337, rerun-each=3; 8,370 passed,
  zero failed, 34,440 parent assertions across 304 files (1406.89s).
  The earlier run had 8,364 passed / six failures in the two real-IMAP resync
  cases after the shared pool mock. The unchanged-seed two-file reproducer and
  complete rerun passed after fixture isolation; no transport code changed.
- `timeout 600 bun run lint`: the allowed baseline remains one pre-existing
  `useCalendarConflicts.ts:58` error and 25 warnings, with no new findings.
- `timeout 1200 bun run build`: exit zero; compiled in 20.7s, production
  TypeScript finished in 38.6s, and all 31 static pages generated.
- Production `playwright.compose.config.ts`: five passed, zero failed (1.4m),
  including all existing QA-001/002/008 cases and the added two-person scenario.
  The first browser attempt's four existing cases passed; the new case hit the
  real auth rate limit during setup. Per-scenario TEST-NET proxy clients and
  paced logins fixed the fixture without changing limits, assertions or retries.
- `git diff --check`: exit zero. New English copy and reused control labels are
  inventoried in `doc/SENDER-IDENTITIES-UI-STRINGS.json` (59 introduced strings,
  11 reused labels); placeholder tokens are not translation targets.

`MailClient.tsx` has exactly two localized hunks: the sender-settings account
refresh subscription (line 4331) and shared-template save wiring using
`teamDefaults:true` (line 5952). Imports and the notices render area are unchanged.
