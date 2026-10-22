# Sender identities for the Noctua team-inbox fork

Design, 2026-10-22. Implementation branch: `feat/sender-identities` (Stage 3, conditional go-live item 16). This document makes decisions for implementation; it does not claim that they exist today.

## 0. Evidence and scope of this research

`ROOT` is `/home/monkey/code/noctua-mail`. Unless marked otherwise, paths and line numbers refer to the read-only `ROOT/wt-integration-dryrun` checkout first observed at `a5d3a1b0c8dbc69684b41666934d7300456c71d3`. It had already advanced beyond the supplied `20be988` baseline when inspected. The other agent continued integrating during research (a later status read showed `684d680` and merge-in-progress paths), so treat these as observed source anchors, not line numbers of the final integration result. Concurrent integration and unrelated local edits were left alone. The collaboration send-path references explicitly marked **133bddc** were read with `git -C ROOT/repo show 133bddc:<path>`, not inferred from the integration checkout. Line ranges below identify evidence, not proposed line numbers.

Build on the existing analysis rather than repeat its upstream audit:

> “Team-level identities (manager-managed), `identityId` validated server-side in `smtp/send` and in draft-send”
>
> — `ROOT/briefs/requirements-fit-report.md:43`, item 16.

> “auto-apply the effective default for new/reply/forward (not when reopening a draft)”
>
> — `ROOT/briefs/requirements-fit-report.md:42`, item 15.

Those findings, including the fixed From, recipient-alias distinction, missing delivery headers and signature gap, are accepted inputs. This design supplies their implementation contract. It follows `doc/TEAM-INBOX.md:1049–1070` (§5.2 roles), `:1188–1204` (§6.3 send), `:1206–1215` (§6.4 prefs), `:1477–1486` (§7.5 settings), `:1576–1596` (§9 ownership), and `:1626–1628` (signature handoff).

Research only: no build, test suite, dev server, SMTP/IMAP probe, commit or tracked-file edit was performed. The only output is this file. Proposed checks and probes below belong to implementation/cut-over.

## 1. Goals and non-goals

Goals:

- A real mailbox can send as its manager-configured primary address and aliases through that mailbox's existing SMTP credentials. Every send path validates the chosen identity against the route's mailbox and the actor's current role.
- Replies normally use the address the customer wrote to; both household users can choose another enabled identity and sign with their own name. Shared mailbox configuration and personal defaults remain separate.
- Preserve drafts' chosen From, existing shared Sent, actor attribution and post-SMTP warning semantics. An identity is an address configuration, not a person or a new mailbox.
- Resolve the inventory before cut-over: approximately ten addresses across monkeydent.de (4), advoria.de (4), c2konzepte.de (1), rc-portal.com (1), eight shared work areas (MonkeyDent Dev/EK/Kontakt/Rechnung/Store; Advoria Accounting/Cargnel/Dev), and three personal mailboxes for the wife cannot safely be assumed to map one-to-one. Multiple work areas may be folders or aliases of one real mailbox. Record that mapping rather than creating duplicate IMAP accounts for aliases.

Non-goals: provisioning aliases/forwarders in netcup, discovering authorization through SMTP VRFY, arbitrary user-entered From addresses, separate credentials or Sent folders per identity, per-identity membership permissions, recipient-alias changes, mailbox-ID/email changes, cross-mailbox reply routing, HTML signature authoring, and a new transport stack. Use `lib/mail/**`, `lib/serverSmtp.ts` and `lib/serverImap.ts`.

## 2. Data model and additive migration

### 2.1 Identities belong in the master DB

Add `sender_identities` to `initMasterSchema` in `lib/db/schema.ts:707`, not the message shard. Identity configuration belongs beside `accounts`, `user_accounts`, `user_account_prefs` and `admin_audit` (`:709–779`). This allows atomic identity/default/audit changes, validates personal defaults without opening a shard, and serves settings even before first sync. Shards contain message observations, not authoritative send permissions. Runtime master path comes from `getMainDbPath()` (`lib/runtimePaths.ts:39`; normally `.data/db/main.db`); do not hard-code the design's older `mail.db` terminology.

Proposed public type in `lib/data.ts`:

```ts
type SenderIdentity = {
  id: string; accountId: string; email: string; displayName: string;
  replyTo?: string; signatureId?: string;
  isDefault: boolean; enabled: boolean;
  createdBy: string | null; // authenticated user ID; null only for legacy seed
  createdAt: number; updatedAt: number;
};
```

SQL contract:

```sql
CREATE TABLE IF NOT EXISTS sender_identities (
  id TEXT PRIMARY KEY,
  accountId TEXT NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE,
  displayName TEXT NOT NULL,
  replyTo TEXT,
  signatureId TEXT,
  isDefault INTEGER NOT NULL DEFAULT 0 CHECK(isDefault IN (0,1)),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  createdBy TEXT,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  CHECK(isDefault = 0 OR enabled = 1)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sender_identity_address
  ON sender_identities(accountId,email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sender_identity_default
  ON sender_identities(accountId) WHERE isDefault = 1;
```

`lib/db/senderIdentities.ts` owns SQL; `lib/senderIdentities.ts` owns validation, default resolution and role-independent domain operations. Export through `lib/db.ts` and `lib/serverDb.ts` using existing wrapper seams. No ORM or migration framework.

Invariants and lifecycle:

- Exactly one enabled mailbox default and at least one enabled identity per existing mailbox; the partial index guarantees at most one, the service guarantees at least one. Default promotion clears the previous flag and sets the new one in one immediate transaction. Reject unsetting/disabling the default with 409 until another enabled identity has been promoted.
- One normalized address per mailbox. Normalize trim/case using the same canonical address helper on server and client, with IDNA domain handling; preserve plus tags and dots. Validate exactly one addr-spec, not an address list or display-name syntax. Reject CR/LF/control characters. Bound email/replyTo to 254 characters, displayName to 256, IDs to 256. No wildcard or catch-all identity.
- `email`, `id`, `accountId`, `createdBy`, `createdAt` are immutable. Changing address means create the new identity and disable the old one; managers can edit displayName, replyTo, signatureId, enabled and the default. This keeps stored drafts' identity references meaningful.
- `replyTo` is one optional validated address. `signatureId` references an existing template in the same account's `settings.signatures`; it is a logical reference because signatures currently live in JSON (`lib/data.ts:83–88`). Removing a template referenced by an identity returns 409 `signature_in_use` until it is unlinked. Enforce this in the existing settings mutation service too.
- Disable instead of providing a physical identity DELETE endpoint. Retain disabled addresses for historical own-address recognition. Mailbox deletion explicitly deletes its identity rows in the existing master cleanup transaction. Do not add a cascading accounts FK without replacing the legacy DELETE/reinsert account-save path (`lib/db/accounts.ts:46–68`). Retain `createdBy` after user deletion, like audit attribution; it is not a cascading user FK.
- Add an idempotent migration seed for every account lacking identities: UUID id, email=`account.email`, displayName=`account.name`, enabled/default=true, null createdBy, current timestamps. Seed only when the account has no identity rows, never recreate a deliberately disabled address or overwrite manager edits. Create the primary row in the account-creation transaction for future accounts. Account display-name edits do not silently rename identities.
- Add table/index creation to `initMasterSchema`; wrap seed/default writes with `withDbWriteRetry` and synchronous `.transaction(...).immediate()`. Existing additive idiom is `CREATE ... IF NOT EXISTS` plus column inspection (`lib/db/schema.ts:101–138`, `:1253–1299`); reuse `ensureTableColumns` for shard additions, including old/shared shard files. Opening twice must preserve IDs/configuration. No table rebuild, message refetch or startup-wide message rewrite.

### 2.2 Personal defaults stay in `user_account_prefs`

Extend `UserAccountPrefs` (`lib/data.ts:454–468`), `lib/accountPrefs.ts:4–11`, and its row parser with:

```ts
defaultIdentityId?: string;
// Existing defaultSignatureId?: string: "" explicitly means no signature.
signatureOverride?: string; // personal plain-text template; "" explicitly means none
```

`defaultIdentityId` is not an `AccountSettings` value: the mailbox default comes only from `sender_identities.isDefault`. `PUT /api/accounts/[accountId]/prefs` keeps sparse deep-merge semantics: omitted unchanged, `null` deletes the override. `defaultIdentityId:""` is invalid; `null` means inherit. Accept a default only if it is enabled and belongs to this mailbox. Use `context.userId`, never a body user ID (`prefs/route.ts:7–19`). Personal signature text is bounded to 8 KiB and validated for supported placeholders.

Validate and merge identity prefs inside one master immediate transaction so a concurrent disable cannot create a newly invalid default. Existing preferences are already merged transactionally (`lib/db/userAccountPrefs.ts:53–81`); add a synchronous validation seam rather than nesting async transactions. An identity disabled later may leave a stale preference: ignore it at resolution, return an actionable warning to that user, and retain their stored choice for re-enablement. Do not rewrite every user's prefs. `GET prefs` still returns the sparse object.

Personal signature overrides are returned only to their owner. Shared drafts and sent messages naturally contain the already-rendered signature. Do not copy personal fields into `account.settings` or into `/settings` save payloads; extend `stripPersonalSettings` where necessary (`lib/accountPrefs.ts:12–16`).

### 2.3 Delivery-recipient observations belong in message shards

Extend `Message` (`lib/data.ts:114–143`) and `messages` with nullable JSON TEXT columns:

```ts
deliveredTo?: string[]; // all valid Delivered-To addresses, in header order
originalTo?: string[];  // all valid X-Original-To addresses, in header order
senderIdentityId?: string; // draft identity marker; not evidence of authorization
```

Use `NULL`/undefined for old or not-yet-fetched metadata and `[]` when headers were examined and none were present. Keep Delivered-To distinct from X-Original-To: a forward may expose both the final mailbox and the original alias. IMAP ENVELOPE does not reveal the original SMTP RCPT TO; these are observed headers, not a reconstructed envelope. Do not guess recipients from Received text.

Concrete ingest changes:

1. `lib/mail/imap/parser.ts:55–86` already unfolds repeated headers into a map. Add one delivery-header parser using those repeated values and mailbox address parsing; normalize and deduplicate per field, cap each array at 32 addresses and ignore malformed values. Parse only the outer message headers, never attached/quoted messages.
2. Populate both arrays in the header/envelope fallback constructor in `lib/mail/imap/sync.ts:367–408` and the full-source constructor at `:450–612`. Existing FETCHes request `headers:true` at `:897`, `:1101`, `:1382`; no extra network round-trip on new syncs. If a fallback truly lacks headers, leave metadata undefined.
3. Preserve through `sanitizeSyncedMessage` (`lib/mail/syncMessageSanitizer.ts:45`), resync (`lib/mail/resyncMessage.ts:52–57`), move/copy and `upsertMessages`. Add columns to INSERT/bindings (`lib/db/messages/upsert.ts:184–191`, `:496–538`) and existing-row metadata selection. Its INSERT OR REPLACE path must retain old arrays/identity marker when incoming metadata is undefined, using the existing size preservation pattern at `:457–465`; explicitly observed empty arrays may replace old values. Never merge different UID/folder collision copies' delivery headers.
4. Hydrate in `lib/db/messages/retrieval.ts:61–74` and every projected message mapper in `lib/db/messages/query.ts` (`:1585/:1749`, `:2006/:2081`, `:2529/:2605`, `:2825`). Add MCP message output fields. List/reply initialization needs this metadata without a separate source download.
5. For old mail, parse cached raw source when explicitly reopened/resynced; preserve existing metadata if a later envelope-only update lacks it. No mandatory bulk backfill. Old Bcc replies without suitable headers fall back to personal/mailbox defaults, with a selectable From. Offer the existing per-message resync when investigation is needed.

Cost: two small JSON values plus a nullable draft marker per message, bounded by 32 addresses per header type; typical rows add a few hundred bytes, not a second MIME copy. Parsing is linear in already-fetched headers. No index or FTS change is needed for default selection. An optional historical backfill would be O(cached messages) file reads and writes and must be separately scheduled, never startup work.

## 3. Send and reply behavior

### 3.1 One resolver, deterministic defaults

Add browser-safe `lib/ownAddresses.ts` with `getOwnAddresses(account, identities)` and exact parsed-address membership checks. Add a shared pure `resolveComposeIdentity` in `lib/senderIdentitySelection.ts`; callers supply identities, personal prefs and the source message. Keep DB loaders out of browser imports. Server loaders always retrieve live identities; never trust a client-provided set.

Own-address set = normalized account.email plus **all configured identity emails, including disabled ones**. Enabled identity set = selectable/authorized From addresses only. Neither `replyTo`, recipients' aliases/groups, authenticated user's login address nor identities of other mailboxes are automatically “us”. No process-lifetime cache: load once per request/sync batch and refresh clients on settings save/account switch/compose open. An already-open composer preserves its explicit choice; send revalidates it.

Order for opening a new composer:

1. Reopening an existing draft restores its stored identity/From, including an invalid or disabled selection shown as unavailable. Do not replace it with a default. A draft copied “as new” starts a new compose session instead.
2. Reply/replyAll: find enabled identities whose email matches recipients on the message being replied to. Ordered tiers: To, Cc, stored Bcc, X-Original-To, Delivered-To. Choose from the first tier with a match; within that tier prefer the user's default if present, then mailbox default, then first header occurrence (stable id tie-break). This keeps a visible alias in To ahead of the physical mailbox in Delivered-To. For a self-sent message, prefer its enabled From identity before the recipient tiers.
3. Otherwise choose the user's enabled per-mailbox default, else the enabled mailbox default. New/forward composes start here. Forwarding does not inherit the external sender's identity.

Changing From never changes active account, transport credentials, recipients or Sent destination. The choice is per compose session, marks the draft dirty, participates in the draft hash and travels through detach/minimize/restore. Selecting an identity does not change the user's saved default; Preferences does.

### 3.2 Header From, SMTP envelope and Reply-To

REST accepts `identityId`, never an arbitrary `from` or `envelopeFrom`. The server resolves it within `accountId` and produces `{name: identity.displayName, address: identity.email}`. Keep `account.name` as the sidebar label. Explicitly pass `envelope.from = identity.email` for direct and raw-draft sends; envelope recipients include To/Cc/Bcc. No user-configurable Return-Path, bounce identity or transport per alias. The provider may rewrite envelope/Return-Path; probe it before go-live (§8).

Add a resolved sender parameter to `buildRawMessage`/`sendSmtpMessage` in `lib/mail/smtp.ts` (same structure in **133bddc:33–67**, direct transport `:103–115`, raw transport `:135–154`). Require callers to resolve it, rather than retaining an unnoticed fixed-From fallback. Do not mutate `Account` to impersonate an identity: its id/email also control storage and calendar semantics. Build wire and Sent copies from the same resolved headers and explicit Message-ID; keep Bcc only in the local Sent/draft copy.

Reply-To is `identity.replyTo` when configured and different from the From address; otherwise omit it. The received message's Reply-To still controls the reply **recipient**, not the outgoing message's Reply-To. Replace the dead self-comparison in `buildSendPayload.ts:81–103`. The direct-send route's existing `replyTo` request field is no longer an override: tolerate only an exact configured value (or empty/absent), reject a conflicting supplied value with 400 `reply_to_managed`. This supports older clients without arbitrary Reply-To injection. All modes use the configured identity value.

Direct send at **133bddc:app/api/accounts/[accountId]/smtp/send/route.ts:30–60,139–168** resolves and validates `identityId` before invite construction or SMTP. New clients always send the ID; omission by an older API client invokes the same server default resolver using authenticated-user prefs and a source message resolved inside this account from `inReplyTo`, else defaults. Never trust a source from another mailbox. Respond with the effective identity ID so clients can show what was chosen.

### 3.3 Drafts, calendar and collaboration

- Add `identityId` to `SaveDraftInput`, `CreateDraftMessageInput`, REST draft-save validation, compose draft payloads/hashes and MCP `create_draft_message` (`lib/drafts.ts:45–78,204–243`; `lib/mcpServer.ts:754–796,1047–1079`). Pass authenticated actor/user context into draft creation so user defaults and signature rendering use the requester, not account owner.
- Save a canonical From and configured Reply-To plus a draft-only `X-Noctua-Identity-Id`. Parse that marker into `Message.senderIdentityId`; it is a lookup hint, not authorization. Legacy/external drafts lacking it resolve by exactly one valid From email within the same mailbox. Do not silently treat unknown From as the primary identity.
- At draft send, read and validate the raw outer headers as well as parsed metadata. Require one From address matching a live enabled identity; validate display name/Reply-To against current configuration and reject ambiguous/duplicate From, conflicting Sender/Resent sender headers, or marker/address disagreement. Configuration changes requiring header replacement return 409 `draft_identity_changed`: “Open this draft, review From, and save it again.” Unknown/disabled identity returns 409 `identity_unavailable`; preserve the draft. The existing `\Draft` guard remains (**133bddc:lib/drafts.ts:320–345**), but does not replace identity authorization.
- After validation, use the chosen address instead of `account.email` in the raw SMTP envelope (**133bddc:lib/drafts.ts:370–377**). Strip the internal identity marker alongside Bcc from the wire copy, preserve attachments/body/threading and the original Message-ID. The Sent copy must have the same approved From/Reply-To as the wire; a rejection causes no draft cleanup, Sent APPEND or sent_by row. Existing cleanup/tombstone behavior remains after success.
- Calendar RSVP must resolve the identity corresponding to `event.myAttendeeEmail` among enabled identities; otherwise show `identity_unavailable`, rather than answering as another address. Extend `lib/calendarParticipation.ts:39–66`, `lib/calendarReply.ts:87–90` and `calendar/events/[eventId]/respond/route.ts`. Allow optional `identityId` only when it matches the attendee being answered. New meeting invitations use the selected identity consistently in From, Reply-To and ICS ORGANIZER/self-attendee (`lib/mail/sentInvite.ts:64–109,164–181`). Do not change the organizer on an update of an existing event; retain the original identity or require deliberate recreation. Use a distinct resolved-sender argument rather than changing account.email.
- **No changes to shared Sent location or sent_by schema/semantics.** Call existing `completeSend` after SMTP exactly as before (**133bddc:lib/mail/completeSend.ts:27–40,45–99,106–130**). Its early `recordReplySent` writes `sent_by(accountId,messageId,userId,sentAt)` before potentially stalled IMAP work (**133bddc:lib/db/threadCollab.ts:314–335**). `userId` is the person pressing Send, even when they send someone else's shared draft. Identity is visible in the stored message From; do not replace actor attribution with identity.createdBy. Keep all sentCopy/postSendWarning fields, shared flags, deduplication and “never retry SMTP after acceptance” behavior.

### 3.4 All own-address consumers

These are implementation scope, not optional follow-ups. Extend parameters to carry the own-address set and update their callers; a single helper that only compose uses is insufficient.

| Existing site | Required change |
|---|---|
| `app/components/mailclient/composition/composeInitState.ts:145–177,300–310` | Self-sent detection and reply-all exclusion across all own identities; keep received Reply-To recipient behavior. |
| `lib/drafts.ts:122–139,141–200` | Server/MCP reply recipient selection and removal of all own recipients, not just first address/account.email. |
| `app/components/mailclient/messagelist/threadGroupUtils.ts:52–57,115–162,179–187,242–348` | From-user display, “other participant” and collapsed thread icon must all use the set. |
| `lib/mail/categorization/classifier.ts:36,179–185`; caller `lib/mail/imap/sync.ts:202–230` | Own-sender classification context includes identity emails; load once per sync batch. |
| `app/components/mailclient/syncNotificationFilter.ts:62,122,164–168`; caller `useSyncController.ts:932` | Suppress own outbound notifications for aliases as for the primary. Watcher/summary notification code after merge uses the same helper. |
| `lib/db/threads.ts:23–40,104–132,189–208,250–283` | Exclude own aliases in thread signals and latest-received-date SQL. Use exact normalized addresses and bound placeholder lists; remove substring `instr` matching. Preserve existing all-outgoing MAX fallback. |
| `lib/db/messages/utility.ts:113,203` | Own-author exclusion in address/recipient suggestions recognizes all configured identities. |
| `lib/topicSignals.ts:63–97`; `lib/topics/suggestions.ts:113–148`; `lib/topics/core.ts:334–380` | Replace single excluded account email in topic participant signals/stats/suggestions. Propagate through `message-topics/{suggest,explain}/route.ts`, `topics/{stats,[topicId]/suggestions}/route.ts`, MCP callers at `lib/mcpServer.ts:683,717` and thread rebuild callers. |
| `lib/calendarParticipation.ts:39–66`; `lib/calendarInviteProcessor.ts:95–102,182–203,227–251,337–349,503–594` | Match attendee among own addresses; retain the exact matched email in myAttendeeEmail. Pass the set through ingest/recompute/CalDAV merge (`lib/caldav/remoteMerge.ts:18–31`, `lib/caldav/sync.ts:131`). CalendarReply/sentInvite then use the authorized identity, as above. |

For database fromEmail, extract a bare address as well as an angle-bracket address (`upsert.ts:478–479` currently only fills the latter). Prefer a narrow additive `fromEmail IS NULL` repair using the existing address parser plus changed query tests over broad startup rewrites. Until repaired, the SQL fallback must compare an extracted normalized whole addr-spec: direct trimmed fromAddr for a bare mailbox, or the single address inside `<...>`; bind the own-address list to exact `IN` comparisons. Do not use `instr(fromAddr, ownAddress)` as a membership test. Persisted thread_signals must be rebuilt account-wide after adding a new identity, because old alias signals were previously “other”. Commit the identity first, then use the existing account recompute job; expose pending/failure with a retry action, never roll back an authorized identity because a shard rebuild failed. Disabled identities remain in the set, so disable does not require a signal rebuild. This same recompute path refreshes affected stored classification/calendar participation when requested.

Do not extend `lib/imapLoginPolicy.ts:26` to aliases: app login-mailbox eligibility still uses the strict personal owner/email/IMAP-user rule. Branding/sidebar labels, mailbox IDs and transport usernames remain based on Account.

### 3.5 Readable SMTP rejection

Extend `lib/mail/smtpError.ts:1–17,52–96` and `app/api/_helpers/smtpUpstreamError.ts:4–28`; routes for direct/draft/calendar use the same mapper. Keep upstream tagging so local validation errors cannot masquerade as provider responses. Pass the validated identity email as error context, not an untrusted request From.

For a permanent SMTP 5xx rejection (nodemailer EENVELOPE or EMESSAGE):

- MAIL FROM rejection, or an explicit sender-ownership rejection reported at RCPT/DATA: HTTP 422 `{ok:false,code:"smtp_sender_rejected",message:"The mail server rejected alias@example.test as a sender for this mailbox. Check its netcup alias configuration or choose another identity.",rejectedAddress:"alias@example.test",smtpResponseCode:553}`. Match sender-specific server text before generic RCPT classification, because servers can defer sender authorization to RCPT TO.
- Recipient-specific RCPT rejection: 422 `smtp_recipient_rejected`, with rejected recipient addresses. Other permanent DATA/message rejections: 422 `smtp_message_rejected`, not a fabricated sender error. Bound and sanitize any displayed provider detail; never echo credentials, a raw stack, full transcript or message body.
- SMTP 4xx transient failures remain upstream/service errors (502 `smtp_temporary_failure` with retry-later guidance), not permanent identity validation failures. Preserve existing connection/timeouts 502/504 and delivery-uncertainty wording.

UI keeps compose content and selected From, shows the rejected address and makes identity selection reachable. Never silently retry under a different identity, auto-disable it globally, or classify a post-acceptance Sent failure as sender rejection. Tests must distinguish MAIL, RCPT, DATA, partial recipient acceptance, generic local exceptions and timeouts. Existing partial-success recipient semantics must be preserved; no automatic resend to already accepted recipients.

## 4. Roles and audit

Extend the role matrix without changing recipient aliases' editor permissions:

| Capability | viewer | editor | manager |
|---|---|---|---|
| List identities/own-address metadata | yes | yes | yes |
| Select an enabled From; draft/send/RSVP | no | yes | yes |
| Set own mailbox defaults/signature override | yes | yes | yes |
| Create/edit/disable identities or change mailbox default | no | no | yes |
| Change team signature templates | no | no | yes |

Preferences are harmless for viewers but never grant sending. Admin status alone does not grant mail access (`TEAM-INBOX.md:115–116,1051–1070`). Use `requireAccountContextFromParams(...,{minRole})`, `withAuthResponse`, same-origin JSON guards and existing active-session/MFA checks. MCP checks the token creator's live membership on every call.

Each manager mutation writes `identity.create`, `identity.update`, `identity.disable`/`identity.enable`, or `identity.default_changed` into master `admin_audit` in the **same transaction** using `recordAdminAuditRow` (`lib/db/adminAudit.ts:44–68`); extend `AdminAuditAction` (`lib/data.ts:470–486`). Include actorUserId, targetAccountId, identity id/email, changed field names, old/new default IDs and clientId for MCP. Record one logical mutation, no audit on no-op/rejected validation. Do not include signature body, credentials or tokens. Legacy seed is system migration, not an invented user actor. Normal personal prefs need no new admin audit; outbound attribution stays sent_by. Audit access remains the existing admin endpoint, not a new mailbox-wide leak of personal overrides.

## 5. Personal signatures and automatic insertion

Reuse `account.settings.signatures` (`lib/data.ts:83–88`) and the manager Signatures tab. One template per mailbox/brand can serve both people:

```text
Kind regards,
{{user.name}}
{{identity.displayName}}
```

Supported substitutions: `{{user.name}}`, `{{user.email}}` (existing §9 contract), `{{identity.displayName}}`, `{{identity.email}}`. User comes from the authenticated person composing/creating a draft, not account.name or identity.createdBy. Identity substitutions use the selected identity. No evaluation, nested templates or arbitrary property access; validate unknown tokens, substitute once, normalize line endings. Escape the resulting plain text when rendering HTML, using `getSignatureBlocks`'s existing `escapeHtml` path (`useComposeController.ts:50–56`). A missing profile name falls back to that user's email and is visible in preview; never substitute the shared mailbox label for their personal name.

Signature resolution: own `signatureOverride` if present (including empty = none), else own explicitly selected `defaultSignatureId` (empty = none), else selected `identity.signatureId`, else mailbox `account.settings.defaultSignatureId`, else none. Missing/deleted template references are skipped with a preference warning. `null` in a prefs PUT removes a personal override and restores inheritance. Users can choose a manager template or supply their own plain-text override in Preferences; they do not need manager permission to sign personally. The team template list stays manager-owned.

Fix the existing gap at compose initialization, not with a post-render effect: `openCompose` currently sets the signature ID at `useComposeController.ts:191` but initializes body fields at `:207–229` without insertion. Compute identity, effective signature and rendered body together in the pure initializer, then set state and `composeSignatureRef` once. Insert into the editable body before the separately assembled quoted content for new, reply, replyAll and forward, in text/markdown/HTML. Establish the draft baseline hash **after** insertion; do not append again on render, account-list refresh, format conversion or reopening a saved draft.

On identity/signature changes, replace only the previously inserted block if it is still byte-equivalent to the tracked block. If the user edited that block, preserve it and offer an explicit “Replace signature” action; never remove arbitrary body text by broad suffix matching. The current replacement helper (`useComposeController.ts:59–103`) supplies the starting seam; preserve its conversion/ref behavior with regression coverage. Reopened shared drafts keep the author's rendered text. Sending B's draft as A does not silently change B's signature; UI previews it and offers replacement, while sent_by records A.

Normal and detached compose must share this initializer and renderer (`MailClient.tsx`/`ComposeOrchestrator.tsx`; `DetachedComposeWindowClient.tsx:413–415,469`), consuming collab-ui's effective prefs. MCP-created new/reply/forward drafts use the same pure signature renderer once before save. Raw send never appends another signature; the body is already composed. This is the §1.1 item 15 fix/enhancement jointly handed off from collab-ui, not a second competing signature implementation.

## 6. REST and MCP contract

### 6.1 REST

Use plural mailbox-scoped resources beside members/prefs; strict Zod request schemas reject unknown mutation keys. IDs are opaque UUID strings. All errors use `{ok:false,message,code}` (plus existing requiredRole where applicable); reads need viewer membership and writes their stated role. JSON writes reuse `requireJsonSameOrigin`. No credentials or mutable user IDs in these shapes.

| Method and path | Shape / success | Role |
|---|---|---|
| `GET /api/accounts/[accountId]/identities` | 200 `{ok:true,identities:SenderIdentity[],defaultIdentityId:string,effectiveDefaultIdentityId:string,ownAddresses:string[],warnings:string[]}`. Stable default-first, email/id order; includes disabled entries, UI filters selection. Effective default is for the current authenticated user, not reply-specific. | viewer |
| `POST .../identities` | Body `{email,displayName,replyTo?,signatureId?,isDefault?,enabled?}`; enabled defaults true, isDefault false. 201 `{ok:true,identity}`. IDs/actor/timestamps assigned server-side. No SMTP/network probe during CRUD. | manager |
| `PATCH .../identities/[identityId]` | Sparse `{displayName?,replyTo?:string|null,signatureId?:string|null,isDefault?,enabled?}`; 200 `{ok:true,identity}`. Promotion atomically changes old default. No-op is 200 without audit. | manager |
| `GET/PUT .../prefs` | Keep `{ok:true,prefs}`. PUT gains `defaultIdentityId?:string|null`, `signatureOverride?:string|null`; existing defaultSignatureId unchanged. | viewer, own row |
| `POST .../smtp/send` | Existing shape plus `identityId?:string`; 200 existing collaboration response plus `identityId`, preserving sentCopy and warning fields. | editor |
| `POST .../drafts/save` | Existing shape plus `identityId?:string`; existing response/message includes senderIdentityId. Save uses current actor/defaults only for a new draft; an omitted ID on edit preserves and validates stored From. | editor |
| `POST .../drafts/[draftId]/send` | Keep existing bodyless send behavior; identity comes from validated saved draft. Switching identity requires save, not a send-only override. Existing collaboration result plus identityId. | editor |
| `POST .../calendar/events/[eventId]/respond` | Existing response fields; optional identityId constrained to RSVP attendee, result includes actual identity when mail is sent. | editor |

Codes: 400 `invalid_identity`/`immutable_identity_field`/`reply_to_managed`/`invalid_preferences`; existing unauthenticated 401 and role/MFA errors; 403 for inaccessible mailbox or insufficient role; 404 `identity_not_found` for an id outside this authorized mailbox (including another mailbox's id); 409 `identity_exists`, `default_identity_required`, `identity_unavailable`, `draft_identity_changed`, `signature_in_use`; 422 SMTP permanent rejection codes from §3.5. An explicit disabled From never falls back. Expired/revoked membership wins over validation and performs zero SMTP work. Invalid explicit preference references are 400; later stale stored choices use the documented fallback/warning.

### 6.2 MCP

Follow `TEAM-INBOX.md:1217–1235`: `server.registerTool`, input **and output** schemas, `buildToolResult` with structuredContent, same service implementation as REST. Bind optional accountId to the token's mailbox (`lib/mcpServer.ts:325`); derive user/actor from token.createdByUserId and `clientId=mcp:<tokenId>`. Recheck current manager/editor role; token creation-time privileges are insufficient.

| Tool | Input | Structured output / minimum role |
|---|---|---|
| `list_sender_identities` | `{accountId?}` | REST identities read shape, with effective defaults for token creator; viewer authorization (tokens remain editor+ to mint under §5.2). |
| `create_sender_identity` | `{accountId?,email,displayName,replyTo?,signatureId?,isDefault?,enabled?}` | `{ok:true,identity}`; manager. |
| `update_sender_identity` | `{accountId?,identityId,patch:{displayName?,replyTo?,signatureId?,isDefault?,enabled?}}` | `{ok:true,identity}`; manager, same null semantics and audit. |
| `get_sender_preferences` | `{accountId?}` | `{ok:true,prefs:{defaultIdentityId?,defaultSignatureId?,signatureOverride?}}` for creator only; viewer. |
| `set_sender_preferences` | `{accountId?,patch:{defaultIdentityId?:string|null,defaultSignatureId?:string|null,signatureOverride?:string|null}}` | Same own sparse subset after merge; viewer. |
| Existing `create_draft_message` | Add optional `identityId`; preserve all existing mode/body/reference fields. | Existing `{ok,mode,referenceMessageId,draftId,message}`; editor. Uses reply default resolution and personal signature once. |

Do not invent an MCP direct-send tool: the inspected `lib/mcpServer.ts:1047–1079` exposes draft creation, not a corresponding send registration. If integration later supplies a send tool, give it the same identity validation and rejection codes. Expected domain failures return `isError:true` with structured `{ok:false,code,message,...}` and a declared discriminated output schema; use existing authorization error conventions for role denials. No faux HTTP statuses in successful MCP envelopes. Document routes/tools in `doc/API.md` after the thread-collaboration ownership handoff.

## 7. UI contract

- **Compose From row:** the ui-shell fix is already present at `ComposeFields.tsx:334–351`: a labeled fromRow rendered before recipients for both variants. Replace the read-only input with the existing Radix Select style used by kept compose controls. Keep `compose-${variant}-from` label association; show `displayName <email>`, a default indicator, and only enabled choices. One enabled option still displays the From row. Empty/loading/error state disables Send until identity resolution finishes; a selected disabled/stale draft identity is displayed as unavailable with an instruction to choose/save.
- New props/state carry selected identity ID and loaded identities through `ComposeOrchestrator`, inline/modal/detached compose, `useComposeState`, `composeTypes`, `buildSendPayload`, `draftSaveUtils`, autosave hashing and detached handoff (`lib/ui/detachedComposeHandoff.ts`). Never derive mutable compose state from the globally active mailbox after a detached composer has captured its account ID. Keyboard, touch and mobile full-screen compose retain a visible From row; no free-text From entry.
- **Identities tab:** add `app/components/account-settings/tabs/IdentitiesTabContent.tsx` inside `AccountSettingsModal.tsx`, reusing the existing `SettingsFrame` (`app/components/shell/SettingsFrame.tsx:14–27`), tab overflow/mobile Sheet and form Field components. Position alongside Account/Signatures. Fields: Email (immutable after creation), Display name, optional Reply-To, optional signature template, Enabled, mailbox-default radio. Row actions save/disable/enable; show provider-probe status as runbook guidance, not a false “verified” badge inferred from syntactic validation. Disabling the default directs the manager to choose another first.
- Manager sees CRUD controls; editor/viewer may inspect the read-only list and own default in Preferences. Selection and Send require editor+. Server role enforcement remains authoritative. Keep the existing “Recipient Aliases” tab and its naming, help text and permissions; “Identities” explicitly says “Addresses this mailbox can send from”.
- **Preferences:** own default From selector with “Mailbox default”, own signature template/none choice and personal text override with preview expanded for the active identity/current user. Saves only personal changed keys to `/prefs`. Manager “mailbox default” is a separate action. The existing frame/footer must not POST identity edits as a wholesale account.settings array. Reuse collab-ui's role-aware settings frame/content contract.
- SMTP rejection appears inline with the address, keeps the composer/draft intact, and focuses or links to From. Preserve accepted-but-Sent-warning notices. Do not expose transport configuration to editor/viewer clients.

## 8. netcup verification and go-live runbook insertion

### 8.1 What documentation establishes

Official netcup [Webhosting Interface, E-Mail-Aliase](https://www.netcup.com/de/helpcenter/dokumentation/webhosting/interface#e-mail-aliase) documents adding multiple aliases to an email address; the adjacent forwarding section is separate. Official [E-Mail-Weiterleitung einrichten](https://www.netcup.com/de/helpcenter/dokumentation/webhosting/email-weiterleitung-einrichten) documents inbound redirection and whether a copy remains. Neither statement proves that an arbitrary forwarding source may authenticate/send through its destination mailbox. Official [external-client setup](https://www.netcup.com/de/helpcenter/dokumentation/webhosting/externe-mailclients) directs operators to WCP's per-mailbox connection settings. Sources accessed 2026-10-22.

The researched official pages do **not** explicitly guarantee the proposed “own address plus configured aliases/forwarders only” SMTP allowlist. Treat that as a deployment hypothesis, especially the forwarder part, not a verified provider contract. No SOGo policy is evidence for this webhosting installation. Application identities remain a manager allowlist regardless of whether netcup is more permissive; acceptance/rejection per mailbox is measured below.

### 8.2 Probe procedure (planned; not executed by this design task)

Insert after inventory and before Noctua cut-over in `doc/MAILPLUS-CUTOVER.md` (Stage 4 owner; `TEAM-INBOX.md:1740` onward):

1. Inventory `work area → real netcup mailbox/SMTP login → Noctua accountId → address → primary|WCP-alias|forwarder|folder → members/roles`. Include all four domains and all eight shared work areas plus personal addresses. Deduplicate shared delivery destinations; aliases do not receive independent Noctua accounts. Identify a controlled sink mailbox whose raw headers/DSNs the operator can inspect. No production customer recipients.
2. From WCP “Mail-Clients konfigurieren”, use the exact configured SMTP endpoint, port, implicit TLS/STARTTLS and credentials of the **real mailbox**. Use a purpose-built Bun probe reusing Nodemailer/options or an operator SMTP client with private credential input; no password in command arguments, transcript, repo or this report. Run serially/at low rate, not as a parallel load test. Transport `verify()` tests authentication, not send-as authorization.
3. For each primary and candidate alias/forwarder, authenticate as that real mailbox; EHLO, TLS, AUTH, **MAIL FROM candidate**, RCPT TO sink, DATA with **From candidate**, optional configured Reply-To and unique Message-ID/subject. No VRFY/EXPN. Record final DATA acceptance/queue id or rejected stage/code/redacted response, SMTP login label and timestamp. A MAIL FROM 250 alone is insufficient. Test ordinary alias/primary cases with matching header/envelope exactly as Noctua will use them. A foreign/mismatched control address, if needed, must also be operator-controlled, never an invented third-party identity.
4. Inspect received sink raw message: From/display name, Reply-To, Return-Path, Message-ID, authentication results and body/signature. Separate accepted from delivered and from successfully authenticated; record provider rewrites/DSNs. Failure of a forwarder means leave that identity disabled and configure a real supported alias/mailbox in WCP before retest. Do not “fix” by silently using the primary MAIL FROM while displaying an unverified header From; a future per-identity bounce sender would need an explicit design change.
5. Independently send inbound tests from the sink to each public address, including a Bcc-only recipient. Read the destination raw headers to learn whether Delivered-To/X-Original-To survives aliasing/forwarding and in which order. Confirm reply default selection; if neither reveals the alias, document fallback/manual selection instead of fabricating original-recipient data.
6. With the real mailbox IMAP login, run `CAPABILITY`, `NAMESPACE` where supported and `LIST "" "*"`; record folder paths, delimiter, SPECIAL-USE and exactly one intended Sent/Drafts. Check whether any alias-named folders are merely filter destinations, and whether authenticating as the alias is actually a separate mailbox (not required for alias support). LIST is not an alias-discovery API; absence of an alias folder is normal and proves no SMTP rule. Preserve the Stage 4 UIDPLUS/Sent checks.
7. Enable only successfully probed identities in Noctua. Through the application, A and B each send one synthetic message per required shared identity, using their own signature; exercise direct, saved-draft and RSVP paths, Bcc-only mail and a disabled/rejected identity. Verify a single common Sent destination, correct From/envelope, actor in sent_by, B sees A's reply, and rejection preserves draft without Sent/activity side effects. Record browser/PWA From selection on both household phones.

The actual provider inventory/probe evidence stays with the Stage 4 owner. No credentials or real household address local-parts in committed fixtures/tests. This research cannot settle which work areas are true mailboxes; go-live item 16 is waived only if the operator inventory shows that no required send-as address remains an alias.

## 9. Three implementation slices, dependencies and checks

All slices work in their own authorized implementation checkout, never this concurrently merged dry-run worktree. Respect `TEAM-INBOX.md:1588–1596`: acquire shared files after their current owner merges. Update the §9 ownership handoff/design references as an implementation documentation change. New DB modules/routes get adjacent Bun tests, real synthetic users/sessions/memberships through `lib/testAuthHarness.ts`, DB isolation through `lib/testDbHarness.ts`; mock wrapper seams (`serverDb`, `serverSmtp`, `serverImap`) or inject narrow functions, not shared `@/lib/db` globally (AGENTS.md; §2 D12).

### Slice 1 — Identity configuration, metadata and recognition

Depends on **feat/team-auth** master schema, membership guards, audit and prefs. Coordinate shard changes with **feat/thread-collaboration**; merge that branch first before touching its upsert/thread hooks. No compose ownership required yet.

Files: new `lib/{senderIdentities,ownAddresses,senderIdentitySelection}.ts`, `lib/db/senderIdentities.ts`; `lib/{data,accountPrefs,db,serverDb}.ts`; `lib/db/{schema,accounts,userAccountPrefs,rowParsers,adminAudit}.ts` as needed; mailbox-create/delete services; new `app/api/accounts/[accountId]/identities/{route.ts,[identityId]/route.ts}`; existing prefs/settings routes. Metadata files: `lib/mail/imap/{parser,sync}.ts`, `lib/mail/{syncMessageSanitizer,resyncMessage}.ts`, `lib/db/messages/{upsert,retrieval,query}.ts`. Own-address consumers and topic/calendar propagation listed in §3.4, including the existing recompute job interface. Keep all collaboration remap hooks intact.

Tests: new `lib/db/senderIdentities.test.ts`, `lib/senderIdentities.test.ts`, `lib/ownAddresses.test.ts`, `lib/senderIdentitySelection.test.ts`, adjacent identity route tests, prefs schema/merge tests, and delivery-header parser/upsert/retrieval regressions. Cover legacy + fresh + second-open migrations, primary seed stability, per-mailbox uniqueness and cross-account isolation in a shared shard, default-promotion races/disable invariants, atomic audit rollback, user deletion/mailbox cleanup, disabled identities as historically own but unsendable, folded/repeated/malformed/missing headers, envelope-only preservation, all reply-default tiers/ties and own-address consumer regressions. Verify adding an identity invalidates/rebuilds persisted thread signals without discarding collab state. Use synthetic `example.test` addresses.

Gate: focused Bun tests; `bun run test:ci`; `bun run test:stress` for DB races/mock-sensitive changes; `bun run lint`; TypeScript `bunx tsc --noEmit`. Run in implementation checkout only. UI remains primary-only until Slice 2/3; configuration can be merged additively without claiming complete alias send support.

### Slice 2 — Authoritative identity throughout sending, drafts and MCP

Depends on Slice 1 and merged **feat/thread-collaboration**, specifically **133bddc**'s actor-aware route/draft/calendar and `completeSend`/sent_by contracts. Rebase on the integration result; do not restore older send functions. team-auth owns auth/token semantics; change only identity plumbing after handoff.

Files: `lib/mail/{smtp,smtpError,sentInvite}.ts`, `lib/{drafts,calendarReply,mcpServer}.ts`, `lib/serverSmtp.ts` signatures if needed; `app/api/_helpers/smtpUpstreamError.ts`; `app/api/accounts/[accountId]/{smtp/send,drafts/save,drafts/[draftId]/send,calendar/events/[eventId]/respond}/route.ts`; the existing Bcc/header preparation helper extended for internal-marker removal; `lib/mail/completeSend.ts` only if a type seam is necessary, no behavior rewrite; `doc/API.md` and MCP schemas. Integrate draft identity parsing with Slice 1 metadata. Extend the shared signature renderer here for MCP draft creation if collab-ui has already landed; otherwise finish that one call in Slice 3.

Tests: direct/draft/calendar routes with editor/viewer/non-member and revoked membership; chosen alias reaches both wire header and envelope, configured Reply-To is used, foreign/disabled/unknown identity performs zero SMTP/APPEND work; raw draft marker/From/Sender mismatch, config drift, Bcc stripping, unknown legacy draft and saved identity restore; invitation organizer/RSVP attendee consistency; permanent sender vs recipient vs DATA errors including deferred sender rejection; transient/timeout and partial-success behavior. MCP tests cover schemas, token mailbox binding/live downgrade, manager CRUD and per-user defaults. Re-run existing collaboration direct/draft/calendar Sent-copy/timeout/attribution regressions and `lib/testFixtures/verifyCollaborationSend.ts` through its owning fixture workflow in an isolated environment. Check same Message-ID, same intended Sent, sent_by actor and accepted-but-Sent-failed warnings.

Gate: focused Bun route/transport/MCP tests, `bun run test:ci`, `bun run test:stress`, lint and typecheck. No live netcup mail required in CI. These checks must prove validation occurs before network work and no second SMTP attempt follows acceptance.

### Slice 3 — Compose/settings/signatures and cut-over handoff

Depends on Slices 1–2, merged **feat/ui-shell** From-row/frame/mobile work, and **feat/collab-ui** role-gated settings/effective prefs/signature ownership. collab-ui already owns item 15 (`TEAM-INBOX.md:1593,1626–1628`): reuse or complete its initializer; do not ship two insertion effects. Coordinate `MailClient.tsx` and `useComposeController.ts` after handoff.

Files: new `IdentitiesTabContent.tsx` and shared pure `lib/signatureTemplates.ts` if not already supplied; `app/components/{AccountSettingsModal,MailClient}.tsx`; `account-settings/tabs/{Preferences,Signatures}TabContent.tsx`; `lib/accountSettings.ts` tab save typing; composition `ComposeFields.tsx`, `ComposeOrchestrator.tsx`, `ComposeInlineCard.tsx`, `ComposeModal.tsx`, `DetachedComposeWindowClient.tsx`, `useCompose{Controller,State,DraftAutoSave}.ts`, `compose{Types,InitState}.ts`, `buildSendPayload.ts`, `draftSaveUtils.ts` and relevant hashing/reset helpers; `lib/ui/detachedComposeHandoff.ts`. Add only necessary From-row CSS to `Compose.module.css`. Stage 4 owner receives §8 for `doc/MAILPLUS-CUTOVER.md`; do not edit another agent's live runbook without handoff.

Tests: adjacent pure initializer/signature tests and focused `ComposeFields.dom.test.tsx`/settings DOM tests: enabled From options, both inline/modal From labels, mobile-visible row, viewer gating, personal vs mailbox defaults, reply to alias via To/Cc/Bcc/delivery headers, stale draft identity, autosave identity-only dirty/hash change, detach/restore preserving account/identity, default signature insertion exactly once for new/reply/forward in all formats, no insertion on reopen, current user's placeholders, HTML escaping, explicit none, personal override and preserving an edited signature on From change. Retain lazy markdown-conversion/send-race tests. Browser acceptance in the normal implementation fixture: two users/shared account, settings/compose direct and saved draft, narrow viewport; no server/build in this research checkout.

Gate: focused unit/DOM suites, `bun run test:ci`, stress pass for shared-module mock changes, lint, typecheck, and `bun run build` in the implementation checkout. Stage 4 then performs the serial netcup probes, A→B shared-Sent check and both-phone PWA acceptance before enabling required identities. Provider acceptance evidence and completed address mapping are release gates, not reasons to block writing/configuring the feature.

## 10. Open questions for the household (maximum five)

1. What is the exact mapping of each public address/work area to a real netcup mailbox, WCP alias, forwarder or filter folder, including the wife's three personal accounts? In particular, how do the five MonkeyDent work areas map onto four monkeydent.de addresses?
2. For each shared address, what should customers see as the From display name: the brand/work area (proposed default), or the individual sender? The proposed design personalizes the signature and keeps the identity display name manager-owned.
3. Which identities need a Reply-To different from their From address, and what mailbox default and personal default should each person initially have?
4. What exact personal names, job titles and required signature text should be used for each brand, and should either person start with a custom personal signature override instead of the shared placeholder template?
5. Which operator-controlled sink address should the go-live probes use, and can a required forward-only address be converted to a supported alias or real mailbox if its SMTP probe fails?
