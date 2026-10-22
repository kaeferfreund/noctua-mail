# Sender identities (slice 1)

Slice 1 adds mailbox identity configuration, personal defaults, observed delivery
recipients and own-address recognition. Compose and transport still use the primary
From until slices 2/3 integrate identity selection and authoritative send validation.

All routes require a current authenticated session and mailbox membership. Admin
status alone grants no mailbox access. Mutations require same-origin JSON requests.

- `GET /api/accounts/:accountId/identities` (viewer+) returns
  `{ok:true,identities,defaultIdentityId,effectiveDefaultIdentityId,ownAddresses,warnings,recomputeJob}`.
  Identities include disabled entries, sorted default first, then email/id.
- `POST .../identities` (manager) accepts
  `{email,displayName,replyTo?,signatureId?,isDefault?,enabled?}` and returns
  `201 {ok:true,identity,recomputeJob}`. It starts a derived-signal rebuild after
  committing configuration. `recomputeJob` reports running/done/failed; poll the
  existing `GET .../threads/recompute/status?jobId=...` endpoint. A worker failure
  leaves the identity committed. `PUT .../identities` with `{recompute:true}`
  (manager) retries this rebuild and returns `202 {ok:true,recomputeJob}`.
  This rebuild keeps thread IDs and stored thread links. Classification can also
  be refreshed through the existing categories recompute endpoint; calendar
  participation refreshes when the shard observes a changed own-address set.
- `PATCH .../identities/:identityId` (manager) accepts a sparse
  `{displayName?,replyTo?:string|null,signatureId?:string|null,isDefault?,enabled?}`.
  `null` removes optional references. Promotion atomically replaces the mailbox
  default. Email/id/mailbox/creation attribution are immutable.
- `DELETE .../identities/:identityId` (manager) disables the identity and returns
  `{ok:true,identity}`. Historical addresses are retained. Promote another enabled
  identity before disabling the default. PATCH uses the same success shape.

Unknown mutation keys are rejected. Errors use `{ok:false,code,message}`:
400 `invalid_identity`, `immutable_identity_field`, `invalid_preferences`;
403 role/access denial; 404 `identity_not_found` (also for another mailbox's id);
409 `identity_exists`, `default_identity_required`, `signature_in_use`.
Existing authentication/assurance failures retain their established response shape.
A referenced signature template cannot be removed until all identities unlink it.
Manager identity changes write one atomic admin audit entry; no-ops write none.

`GET/PUT .../prefs` (viewer+, own row only) supports the sparse keys
`defaultIdentityId?:string|null` and `signatureOverride?:string|null`.
Omission preserves the stored value; null deletes the override. An empty identity
ID is invalid. The identity must be enabled in this mailbox when written.
A subsequently disabled identity remains stored, but selection falls back to the
mailbox default with an actionable warning. Signature text is plain text, limited
to 8192 UTF-8 bytes; empty explicitly means none. Allowed template placeholders:
`{{user.name}}`, `{{user.email}}`, `{{identity.displayName}}`, `{{identity.email}}`.
Personal fields never become mailbox settings. Rendering/insertion is slice 3.

Messages expose `deliveredTo?:string[]`, `originalTo?:string[]` and
`senderIdentityId?:string` through detail/list/MCP output. The first two capture
outer `Delivered-To` and `X-Original-To` headers separately, in deduplicated header
order, capped at 32 addresses per field. Undefined means not fetched; empty means
examined and absent. `Envelope-To` and Received text are not recipient evidence.
Envelope-only updates retain stored metadata for the same mailbox copy. Legacy
cached source is parsed on individual reopen/resync, with no bulk mail backfill.
The draft identity marker is metadata, never authorization.

Own addresses comprise the primary account address and all configured identities,
including disabled ones. Reply-To, user login addresses, recipient aliases and
other mailboxes' identities are excluded. The pure compose resolver prioritizes
self From, then To/Cc/Bcc/X-Original-To/Delivered-To for replies; ties prefer the
personal default, mailbox default, header order, then stable id. New/forward uses
personal then mailbox default. Draft reopening preserves its saved selection.

Integration handoff: this slice starts from team-auth `2458a09`. It preserves the
existing upsert/thread behavior and adds only metadata, exact own-author matching,
and a non-remapping recompute mode. When merging thread-collaboration `133bddc`,
retain its upsert remap hook and collaboration tables. Slices 2/3 own all SMTP,
draft-send, RSVP identity authorization, MCP identity tools and compose/settings UI.
