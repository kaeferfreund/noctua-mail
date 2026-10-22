# Sender identities (slice 1)

Slice 1 implements configuration, personal preferences, delivery observations and
own-address recognition. Compose and transport still use the primary From until
slices 2/3 supply identity selection and authoritative send validation.

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
and two identity workers globally; other mailboxes queue. Retries coalesce into
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
personal overrides or credentials. Identity MCP CRUD is not shipped yet.

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
need the separate existing categories recompute action. This checkout cannot prove
collaboration assignment/comment/activity/sent_by/read-state preservation until
its changes are ported onto the integration result.

## Handoff to slices 2/3

Follow the source design `briefs/sender-identities-design.md` §§3.2–3.5, 4–7 and 9,
and the ownership handoff in [TEAM-INBOX §9](TEAM-INBOX.md#9-work-breakdown-branches).
This branch starts at team-auth `2458a09` and will be ported after integration of
thread-collaboration `133bddc`, mailbox-watcher `bd7eb5f`, and collab-ui `1d0f0ce`.
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
