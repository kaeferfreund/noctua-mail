# Correctness, data-isolation and privacy re-check — round-9 candidate 98b4301

Reviewed 2026-10-23. Source: `98b4301f55e6365021f9899ba16c61303c1c2672`, branch `qa/security-recheck-98b4301`, `/home/monkey/code/noctua-mail/wt-security2`. Base for format and checklist: `briefs/security-recheck-9424150.md`. Scope: the 70 commits in `9424150..98b4301`.

**Result:** no P1 or P2 finding was established. Two **P3 hardening findings** were recorded. F1 is new: the bodyless-command guard buffers an unbounded body before rejecting it. F2 is a residual of the previous F1: launcher log redaction still misses non-canonical reset-path spellings. The previous P3 (raw reset capability in exceptional launcher logs) is fixed for every link form the application issues. The previous dependency release gate is closed at the version level: Next 16.4.2 meets the 16.4.1 floor and sharp is at 0.35.5. The two required gates passed: security controls 156/156 and privacy 177 assertions. Compiled smoke, graceful shutdown, build and typecheck also passed. The compiled auth browser suite passed 19 of 20 cases. The one failure (C-1 below) is a correctness item, not a security finding, and appears identically in the orchestrator's gate log for this commit. These results establish the stated local checks; they do not constitute go-live acceptance.

The documented same-event-loop outbound window from `sender-identities-slice2-review-r2.md` is covered by the slice-3 same-continuation assertion (`781b4b2`) and was re-verified below. It is no longer excluded.

## Method and execution boundary

Read `AGENTS.md`, `briefs/_rules-common.md`, the brief, the 9424150 report, and the branch briefs for FTS v3, sender identities slice 2/3, admin self-grant and i18n. Code inspection for three areas ran in parallel read-only forks of this reviewer. Each was restricted to source reading and focused `bun test` runs (ephemeral loopback only, no fixed ports, scratch under `.tmp/area*`, removed afterwards):

- A: outbound authorization and sender identities;
- B: FTS v3 and the folder-account guard;
- C: admin self-grant, launcher redaction, body bounds, i18n and dependencies.

The reviewer ran every fixed-port, build and browser gate personally, one after another.

Only synthetic principals, mailboxes, tokens and addresses were used (`first@example.test` / `second@example.test`; committed fixtures use example.test/example.invalid). Shared-shard probes map two accounts to one SQLite file with identical local IDs and Message-IDs. No real user, external mail server, live preview (3790), `noctua-dev`/`noctua-fixture` service, other worktree or other data directory was touched.

Isolation for the build and runtime gates:

- **Source and sandbox.** All of them ran against a disposable `git archive 98b4301` under `.tmp`, inside bubblewrap: no network namespace except isolated loopback, cleared environment, synthetic keys, private HOME/TMPDIR/cache, and the installed `node_modules` bound read-only.
- **Ports.** Fixed listeners used 3885 (smoke, graceful shutdown), 3886 (auth browser and privacy app) and 3887 (privacy tracker), adapted in the disposable copy only.
- **Harness accommodations.** These are reviewer accommodations, not product changes:
  - a private hosts file for `localhost`;
  - a `node` shim pointing to Bun for Next;
  - the installed Node 24.22.1 for the Playwright CLI only, as in the previous review.
- **Discarded startup attempts.** They are listed under Gates. None established a product defect.

No tracked file was edited. No commit, push, PR, checkout/reset/stash, dependency installation, `PRAGMA optimize` or `ANALYZE` occurred.

## Checklist from the previous audits (regression status at 98b4301)

| Item and expected invariant | Probe | Observed result | Verdict |
|---|---|---|---|
| 1a/1b. Activated auth, passkeys, TOTP, reset: compiled mount rejects raw/retired paths, foreign origins, setup-only sessions; reset is one-use, no auto-session, MFA retained. | `tests/runTeamAuthSecurityControls.sh`; compiled `scripts/smokeTeamAuth.ts` on 3885 (canonical HTTPS origin/proxy headers); compiled auth browser suite on 3886 against the Next 16.4.2 build. | 156/156 controls. The smoke ran these PASS lines: migration CLI; canonical proxy (Secure cookies, foreign origin/raw path/old cookie rejection, enrollment gate, TOTP); refresh, live MCP, revoke and ban; operator reset redemption/reuse with MFA preserved; isolated restore; log hygiene. Browser: 19/20 passed. All 8 WebAuthn/UV/RP/challenge/finalizer cases passed, and so did every shell login/TOTP/enrollment case except C-1. | OK, local compiled scope |
| 1c. Reset capabilities absent from request logs, including exceptional launcher logs (previous F1). | `lib/server/standalone.test.ts` (real launcher on OS port, failing request and upgrade handlers); 30-target helper probe; compiled smoke log scan. | Fixed for `/reset-password?token=` and `/api/ba/reset-password/<t>`, absolute-form, `//host`, fragments, CRLF suffixes. Malformed targets log `[invalid-url]` without throwing. Non-canonical spellings still pass through (F2). | OK for issued forms; FINDING F2 (P3) |
| 2a–2c. Manager candidates, membership policy codes, admin ≠ membership, role-filtered DTOs. | Security-controls suite; Area C self-grant route probe (below). | Unchanged server routes. Admin without membership has no role and no mailbox in `/api/auth/me`. | OK |
| 3a/3b. Collaboration revisions, summary/events scoped to live membership. | Covered by the security-controls suite and unchanged since 9424150, apart from i18n strings. | No regression observed. Not re-probed beyond the suite. | OK (suite scope) |
| 4. Sender identities affect From only; validation before side effects; documented narrow window. | Area A rows A1–A11 below. | Same-continuation final assertion is in place on every outbound effect. | OK |
| 5. Composite shard keys / FTS isolation / migration atomicity. | Area B rows B1–B5 below. | FTS v3 identity map preserves isolation. | OK |
| 6a. HTML privacy: no remote loads by default; keyed opt-in, no Referer, no remote CSS. | `tests/browser/htmlPrivacy.test.ts` (Chromium, app 3886 / tracker 3887). | 1 pass, **177 assertions**. | OK |
| 6b. Framework/image dependency floor. | Installed `package.json` versions and `bun.lock`; advisories re-read 2026-10-23 (Area C). | Next 16.4.2 ≥ 16.4.1; sharp 0.35.5 (single copy); React/ReactDOM 19.3.1 (listed as patched in GHSA-h3gv-c5rc-p453); Better Auth/passkey 1.7.12; MCP SDK 1.32.1; imapflow 2.9.1; nodemailer 10.2.1. No Next advisory newer than 2026-10-14 found. `mailparser` carries nested `nodemailer@10.2.0` (`bun.lock:2233`). It is used only for `lib/addressparser`; the 10.2.1 delta is a Content-Type comment-stripping bug fix. | OK at version level; previous release gate closed. No runtime exploit probe run |
| 7. Watcher/IMAP correctness. | Not re-run as a fixture in this round. Folder-guard changes to watcher/new-mail-check were reviewed (B7/B9). | `lib/folderAccountGuard.test.ts` real worker child exits 1 on mismatch without retry. | OK for changed paths; full watcher fixture not re-run |
| 8. Deployment/keys/backup. | Compiled smoke isolated restore; graceful shutdown on 3885. | Restore preserved IDs, factor bytes, decryptable mailbox secret and signed MFA session. Built standalone exited 0 in 29 ms, `forced:false`. | OK, local smoke only |

## Changed surfaces since 9424150

### A. Outbound authorization final boundary and sender identities (slice 2/3)

| Item and expected invariant | Probe | Observed result | Verdict |
|---|---|---|---|
| A1. Direct send: live authorization is asserted synchronously with the first effect. | Source `app/api/accounts/[accountId]/smtp/send/route.ts:163-179`, `lib/mail/smtp.ts:106-117`. Executed `lib/outboundAuthorization.routes.test.ts`, which revokes via `queueMicrotask` after the guard and after the boundary assertion. Variants: membership, role, ban, generation, credential, disabled identity. | Raw MIME and transport are prepared before `beforeSend()`. `transporter.sendMail(wire)` starts in the same continuation. Revoked variants return 401/403/409 with zero SMTP connections. | OK |
| A2. Draft send (raw relay). | `lib/drafts.ts:576-582`, `lib/mail/smtp.ts:141-152`; fixture `draft-send`. | The assertion sits immediately before `sendMail` starts. | OK |
| A3. Draft save: APPEND, local upsert and old-draft delete each asserted. | `lib/drafts.ts:427-473`; `lib/mail/imap/mutations.ts:47-55` (`beforeAppend` inside the op callback before `client.append`); `beforeDelete` (`:161`); upsert via `withOutboundWrite`. Fixture `draft-save`. | Revoked variants: no APPEND and no replacement. Revocation between an authorized APPEND and the upsert fails closed (403). The new IMAP draft can then remain beside the old one, a correctness-only duplicate with no exposure. | OK (correctness note) |
| A4. Calendar respond. | Route `:146-190`; `lib/db/calendar/events.ts:135,384`; series/occurrence fixture. | `sendReply` asserts at SMTP initiation. `sendReply:false` asserts inside the participation write transaction. Post-acceptance persistence (Sent copy, partstat, processed flag) runs without a recheck, as documented. | OK |
| A5. Master hold during shard writes (`lib/outboundWrite.ts:18-55`). | Source; `lib/outboundWrite.revocation.test.ts`, which forces commit BUSY after file publication and a real membership revoke during read-only planning. | Order: master `BEGIN IMMEDIATE` → `assertCurrent(master)` → shard write → shard COMMIT → master ROLLBACK. The sequence is synchronous and refuses an outer transaction. BUSY rolls back before reauthorization denies the retry. | OK |
| A6. Retry and handshake deadline (`94601bb`, `6b0b57a`, `d5ae17b`). | `lib/dbWriteRetry.ts` (16 fast retries, 2,160 ms budget); `withOutboundWrite` attempts. | Each attempt builds a fresh actor via `await beforeWrite()`. The deadline is rechecked after `workerPause`. | OK (source and revocation test) |
| A7. MCP paths. | `lib/mcpServer.ts:841` (create_draft), `:1177/1191/1214` (identity CRUD/prefs); fixture `mcp-*`; `lib/mcpAuth.identities.test.ts`. | There is no MCP send tool. A revoked or downgraded token, or a binding change, yields a tool error with no mutation. | OK |
| A8. Server rejects foreign/disabled identities on every outbound route. | `lib/sendIdentity.ts:22-30` (accountId+id, enabled); `authorizeOutbound` re-reads the live row; `from`/`envelopeFrom` rejected (send route `:73`); `lib/testFixtures/verifySenderIdentity.ts`. | Foreign identity → 404 `identity_not_found`; disabled → 409; null → 400. An MCP draft with a foreign identity is a tool error with counts unchanged. The detached-compose handoff `identityId` is shape-checked client-side and re-validated by the server. | OK |
| A9. Compose offers only enabled identities of the current mailbox. | `app/components/mailclient/composition/ComposeFields.tsx:328`; DOM tests. | Enabled filter applies. A saved identity that is unavailable is shown as a disabled item, not selectable. | OK |
| A10. Signature templates and placeholders are HTML-escaped; profile text cannot inject markup or tokens. | Reviewer probe on `renderSignatureTemplate` (`lib/signatureTemplates.ts:50-60`) + `markdownToEmailHtml`. Values: `<script>`, `"><img onerror>`, `{{user.email}}` / `{{identity.displayName}}` as user/identity names, `$& $1 $' $\``, `[x](javascript:…)`, autolinks, pre-escaped entities, CRLF, image markdown. Templates: `{{constructor}}`, `{{__proto__}}`, `{{ user.name }}`, `{{{user.name}}}`, `<b>{{user.name}}</b>`, unbalanced braces. | 0 failures. HTML is fully entity-escaped. Substituted values are not re-expanded. The function replacer interprets no `$` patterns. Markdown output has no tags or `javascript:` links. Unsupported or unbalanced tokens are rejected on write; legacy templates are stripped with a warning. | OK |
| A11. Identity display names cannot inject headers. | Schema `lib/senderIdentities.ts:15` (C0/DEL rejected); `buildRawMessage` probe with CRLF/LF/quote/encoded-word names passed directly as a resolved sender. This covers a seeded primary identity built from the unvalidated `account.name` (`lib/db/senderIdentities.ts:25-31`). | nodemailer RFC 2047-encodes or quotes every case. No injected header line appeared in 6 of 6 cases. | OK |

### B. FTS v3 / `message_fts_identity` and the sync-folder guard

| Item and expected invariant | Probe | Observed result | Verdict |
|---|---|---|---|
| B1. Search on a shared shard never returns the other account's rows. | `lib/db/messages/query.ts:738` joins `message_fts_v3` on `(accountId, id)`, with base `m.accountId = ?`. Reviewer probe: same local ID and Message-ID in A and B plus a B-only row; each account searched for the other's tokens. | No cross-account hit in either direction. | OK |
| B2. Identity map is unique per (account, message). | `lib/db/ftsIdentity.ts:5-11` (AUTOINCREMENT PK, `UNIQUE(accountId,messageId)`, composite FK with cascade); rowid check after a mixed workload. | Rowids unique; `validateFtsIdentity` passed after every step. | OK |
| B3. A-side deletes/replaces never remove or reattach B's FTS rows. | Ran under A, with IDs and folders that also exist in B: `deleteMessageById`, `deleteMessagesByIds([shared, bOnly])`, `deleteMessagesByFolderPrefix(A, B.folderId)`, `upsertMessages(replaceExisting)` with folder and `null`, and `upsertMessages({replaceDraftId: bOnly})`. | B stays searchable after each step. A's own row survives the prefix delete aimed at B's folder. | OK |
| B4. Orphan FTS/identity rows never reach results. | Hand-inserted FTS rows with no identity row: (A, B-only id) and (A, missing id). | Neither appeared in A's or B's search. `validateFtsIdentity` rejects them and passes after removal. The FK prevents identity rows without a message, and AUTOINCREMENT prevents stale rowid reuse. | OK |
| B5. v3 migration is atomic; old/raw writers are rejected. | `ftsIdentity`, `shardFormat`, `accountKeys` tests (crash points, rollback, 50k migration). Raw `bun:sqlite` connection without the registered writer function. | Raw `DELETE FROM messages`, `INSERT INTO message_fts_identity` and `INSERT INTO message_fts` (now a view) all threw. 50,000 messages migrated in 2,261.54 ms; idempotent reopen in 4.33 ms. | OK (synthetic data) |
| B6. MCP folder parameter. | `lib/mcpServer.ts:648-680`; `listMessages` / `listThreads` as A with B's folderId on a shared shard. | Empty result. Isolation comes from the token's account binding. MCP returns empty rather than 400, which is a consistency difference only. | OK |
| B7. folder ∈ account checked on every folder-taking route before IMAP or queue work. | Source trace of every route that takes a folder (list below the table). | Order: account auth → guard → IMAP. Flags/bulk, archive, spam and delete/bulk take folders from stored account-scoped rows. Delete/rename read only their own account's folders before the guard. | OK |
| B8. 400 `folder_account_mismatch` reveals no foreign folder name and is not an existence oracle. | Two real accounts; user is a member of both (editor on B); B has a folder `ConfidentialProbeFolder`. Sent B's real folder and an unknown folder through 8 inputs (list below the table). | Every case returned 400 `{ok:false,code:"folder_account_mismatch"}`. Foreign and unknown bodies were byte-identical and contained no folder name. Worker logs carry only the code. | OK |
| B9. Queued/watcher/CLI mismatches never open IMAP and are not retried. | `lib/folderAccountGuard.test.ts` (real worker child), `lib/syncJobs.test.ts`. | The worker exits 1 with no retry. Watcher and new-mail-check await `startSyncJob` validation. | OK |

Routes traced for B7:

- sync and new-candidates;
- poll (`folderId`, and raw `mailbox` mapped to `${accountId}:path`);
- the IMAP stream (`activeFolderId`, `folderId`);
- messages and threads (`folderId`, `excludeFolderIds`);
- move (source and destination);
- copy-to-account (source checked against the source account, destination against the destination account);
- folders create/rename/delete/consistency;
- recompute;
- `startSyncJob` (queue) and `runSyncOperationBatched` (worker).

Inputs sent for B8:

- messages and threads `excludeFolderIds`;
- stream `folderId`;
- poll raw `mailbox`;
- move `threadMove.sourceFolderId`;
- copy destination under the wrong account;
- copy `threadMove` source;
- sync with numeric and empty `folderId`.

Correctness note (not a finding): `app/api/_helpers/newMailCheck.ts:47` admits per-folder jobs via `Promise.all`. If a folder disappears between planning and admission, the call rejects as a whole, though jobs for the other folders may already be queued. There is no isolation impact.

### C. Admin self-grant, launcher redaction, body bounds, i18n

| Item and expected invariant | Probe | Observed result | Verdict |
|---|---|---|---|
| C1. Admin mailbox self-grant is explicit and audited, cannot escalate roles, checks origin; admin ≠ membership. | `b6c1ba9`/`20d93cf` change only the client (`AdminMailboxes.tsx`). The server route `app/api/admin/accounts/[accountId]/members/[userId]/route.ts` and `lib/accountMembers.ts` are unchanged since 9424150. Reviewer route probe with the real harness: admin without membership against a synthetic mailbox. | Before the grant, the admin has no role and no mailbox in `/api/auth/me`. Non-admin PUT 403, foreign Origin 403, anonymous 401. Roles `owner`, `admin`, `MANAGER`, `""`, null, array, object and `__proto__` → 400 with no audit row. Three concurrent identical PUTs give one membership row and exactly one `member.grant` audit row (actor = target = admin, `{role:"viewer",previousRole:null}`). An identical repeat adds no audit row; a role change writes `member.update`. Revoking the sole manager → 403 `last_manager`. The grant requires the MFA session but no fresh re-auth proof, which is unchanged and by design. The admin may grant any user through this endpoint, an existing designed capability. | OK |
| C2. Launcher exceptional-log redaction (`3766c92`, `lib/server/standalone.ts:7-9,43,56`). | See 1c. | Fixed for issued link forms. Residual spellings in F2. | OK / F2 |
| C3. Self-service auth JSON bodies are capped at 16,384 bytes with 413. | `app/api/auth/bodyLimit.test.ts`, `app/api/_helpers/readAuthJson.test.ts`; 32 MiB streamed body without Content-Length. | `readAuthJson` returned 413 after pulling a single 64 KiB chunk. | OK |
| C4. Other JSON routes keep their documented contract (`doc/API.md:260-279`). | grep over `app/api`. | 55 unbounded `request.json()/text()/formData()/arrayBuffer()` reads in 52 route files. Seven routes changed in this range still read with `request.json()`: calendar respond, folder rename/create, copy-to-account, move, smtp send, sync new-candidates. Also changed: `app/api/_helpers/recomputeJobs.ts:33` now parses a body (for `folderId`) it previously ignored. All of these read after the session, account role and origin checks. This matches the documented contract; the deployed proxy limit remains the control (open item 4). | OK vs. contract (informational) |
| C5. Bodyless-command contract: any body is rejected with 400 `unexpected_body`. | `app/api/_helpers/requestOrigin.ts:26-33`; reviewer probe with a streamed 16 MiB body and matching `Origin`. | 400 `unexpected_body`, but only after **16,777,216 bytes** were pulled. In `app/api/auth/logout/route.ts:9` and `app/api/admin/_users.ts:22` (passkey-remove, sessions-revoke), this runs before any session lookup. | FINDING F1 (P3) |
| C6. Catalogs contain no user content or PII. | Scan of `messages/de.json`, `messages/en.json` (1,102 leaf keys) for addresses, URLs, HTML and owner/project names. | None found. | OK |
| C7. `noctua-ui-locale` validated against an allowlist; no dynamic catalog import or header reflection. | `lib/i18n/config.ts:10` (strict `"de"`/`"en"`), static imports in `translator.ts`, `requestLocale.ts`, `preferences/route.ts:24`, `LanguageSelector.tsx:40`. `resolveLocale` called with `../en`, `en; Path=/`, `EN`, `de\r\n`, `en\0`, `__proto__`, `constructor`, `" en"`. | All fell back to `de`. | OK |
| C8. User values never reach rich/HTML i18n sinks. | grep `t.rich`/`t.markup`/`dangerouslySetInnerHTML`; read `folderNames.ts`, `authMessages.ts`, `adminMessages.ts`. | No rich/markup i18n calls. The only `dangerouslySetInnerHTML` uses are the existing sanitized calendar renderers. Folder display names map from `specialUse` only. Unknown server messages render as React text. | OK |

## Findings ranked by severity

### F1 — P3 — Bodyless-command guard buffers an unbounded body, pre-session on two routes

**Location:** `app/api/_helpers/requestOrigin.ts:29` (`await request.arrayBuffer()`). Pre-session callers:

- `app/api/auth/logout/route.ts:9`;
- `app/api/admin/_users.ts:22`, for the `passkey-remove` and `sessions-revoke` actions, which run before `requireAdminSessionOr403`.

The other six call sites run after session and role checks.

**Invariant:** the bodyless contract rejects any payload. A reject path should not buffer arbitrary input, and the auth routes already apply a bounded reader (`readAuthJson`, 16 KiB, 413).

**Minimal reproduction:** with the test env preload, call `requireBodylessSameOrigin` on `new Request(BETTER_AUTH_URL + "/api/auth/logout", {method:"POST", headers:{origin: BETTER_AUTH_URL}, body: <ReadableStream of 256 × 64 KiB>, duplex:"half"})`. Observed: `{"status":400,"code":"unexpected_body","bytesPulled":16777216}`. Over HTTP, the equivalent is `POST /api/auth/logout` with a matching `Origin` header and a large chunked body. A non-browser client can set that header. It needs no session.

**Scope and severity:** no data exposure and no authorization effect; the request is rejected. This is a memory-pressure input reachable without authentication. It is pre-existing (`requestOrigin.ts` and `logout/route.ts` are unchanged since 9424150), newly recorded here. The Better Auth `/api/ba/*` JSON endpoints also parse bodies without an application bound before authentication, so the effective control is the deployed proxy body limit (open item 4).

**Smallest correction:** reject on the first body chunk, or when `Content-Length > 0`, without buffering: read with a 0/1-byte cap in the same way `readAuthJson` reads. Keep the 400 `unexpected_body` response. Add a streamed-body regression asserting that at most one chunk is pulled. No correction was made during this read-only review.

### F2 — P3 — Launcher log redaction misses non-canonical reset-path spellings (residual of the previous F1)

**Location:** `lib/authRecoveryContext.ts:19` (exact, case-sensitive pathname match), used by `lib/server/standalone.ts:7-9`. The same patterns appear in the `next.config.ts:14` incoming-request ignore regexes.

**Invariant:** reset capabilities are never persisted in request logs.

**Minimal reproduction:** `redactAuthUrl(URL.parse("/reset-password/?token=T", "http://localhost")!.href)` returns a string still containing `T`. These spellings are also not redacted:

- `/RESET-PASSWORD?token=T`;
- `/reset-password;a?token=T`;
- `/%72eset-password?token=T`;
- `/reset-password%3Ftoken=T`;
- `/api/ba//reset-password/T`;
- `/api/ba/Reset-Password/T`.

The text reaches the log only on the exceptional launcher path (handler or upgrade rejection), as in the previous F1.

**Scope and severity:** the application issues only canonical links (`resetCallback`, `lib/authRecoveryContext.ts:14`), which are redacted. A token reaches these spellings only if a client rewrites the URL, and it is logged only when the handler throws. No real token disclosure was established. P3 hardening.

**Smallest correction:** for the launcher error lines, log only the pathname without the search part or fragment, or normalize the pathname (lowercase, collapse repeated `/`, drop a trailing `/` and `;…`, decode once) before matching. Extend `lib/server/standalone.test.ts` with these spellings. No correction was made.

### C-1 — correctness gate failure (not a security severity) — unsent inline reply not present after a UI-language switch; stale test selector

**Location:** `tests/browser/auth/shell.spec.ts:229` (case "shell persists mailbox switch and keeps personal security independent"). Product surfaces involved: `app/components/i18n/LanguageSelector.tsx:40-44` (cookie write, then `router.refresh()`, intended not to remount the shell) and `app/components/AccountSettingsModal.tsx:220`.

**Observed:** the committed case fails deterministically at 98b4301, in two stages:

1. At `:264` it times out. After switching to German, the test looks for the dialog named "Account settings", but `79283b2` localized `accountTitle` to "Postfacheinstellungen" (`messages/de.json:129`). This is a test defect.
2. With only that selector adapted, in the disposable copy, the case fails at `:266`. `getByPlaceholder('Subject')` is not found: the inline reply composer, with its unsent subject "Synthetic unsent locale draft", is absent once the settings dialog closes. The placeholder is hard-coded English (`ComposeFields.tsx:314`), so localization does not explain it. The retained page snapshot shows mailbox B still selected (`aria-current` assertion at `:265` passed), the thread open, and "Antworten" visible, with no composer.

The fixture's network isolation also produced a toast for a failed IMAP poll (500, `imap.example.invalid`). Whether that toast contributes was not established.

**Assessment:** no authorization, isolation or privacy effect was observed. The locale persisted to the session user only (`/api/auth/me` `uiLocale: "de"`). The unexecuted remainder of the case (fresh login preferring the personal language over the device cookie) is covered at unit level by the `resolveLocale` and preferences route tests (C7). However, losing an unsent reply on a language switch would be user-visible data loss. The root cause (RSC refresh remount, dialog close path, or fixture noise) was not established in this read-only review. Recorded for the i18n owner; not counted in P1–P3.

## Previous items: status

| Previous item | Status at 98b4301 |
|---|---|
| F1 (9424150) — raw reset capability in exceptional launcher logs (P3) | Fixed for issued link forms by `3766c92`. Residual spellings recorded as F2. |
| Dependency release gate (Next 16.2.4 / sharp 0.34.5 below fixes) | Closed at the version level: Next 16.4.2, React 19.3.1, sharp 0.35.5. Compiled smoke, auth browser and standalone shutdown re-run on the new build. Note: the smoke script's PASS banner still prints a hard-coded "Next 16.2.4" (`scripts/smokeTeamAuth.ts:175`), while the installed and standalone `next` are 16.4.2. This is a label-only test hygiene issue. |
| Documented narrow outbound same-event-loop window (sender-identities slice 2) | Addressed by `781b4b2` and the `withOutboundWrite` master hold. Verified in A1–A6. |

## Gate results and retained evidence

| Gate | Observed result |
|---|---|
| Security controls — `nice -n 15 bash tests/runTeamAuthSecurityControls.sh` | **156 passed**, 0 failed, 861 assertions, 77.6 s; exit 0 |
| HTML privacy browser — `bun test --config=bunfig.browser.toml --timeout 120000 ./tests/browser/htmlPrivacy.test.ts` (disposable copy, 3886/3887) | 1 passed, 0 failed, **177 assertions**, 61.0 s; exit 0. The first attempt failed in the harness: the disposable copy had no `.tmp` for `mkdtemp`. Not a product failure. |
| `bun run typecheck` (`bun check`, disposable copy) | 0 type errors in 1,243 files; exit 0 |
| `bun run build` (sandbox) | Production build and standalone packaging passed; exit 0. Two earlier attempts failed on harness setup only: a symlinked `node_modules` outside the Turbopack root, then no `node` binary in the sandbox. |
| `AUTH_SMOKE_PORT=3885 bun scripts/smokeTeamAuth.ts` (compiled, sandbox) | 6 PASS lines, SMOKE PASS; exit 0 |
| `bun scripts/checkGracefulShutdown.ts --port 3885` (built standalone) | exit 0, signal null, 29 ms, `forced:false`. The first attempt lacked synthetic keys in the cleared environment (instrumentation refused to start, health 500). It was rerun with synthetic keys. |
| Compiled auth browser (Next 16.4.2 build, port 3886, Playwright CLI under installed Node 24.22.1) | **19 passed, 1 failed** (11.6 min). The failure is `shell.spec.ts:229` (C-1). The orchestrator's log `ops/r89-gates-20261023T131558Z.log` for 98b4301 shows the same `auth rc=1`, 19 passed. Two earlier attempts failed on harness setup only: the Next child loaded under Node, then a mount order hid the Playwright browsers. |
| Area A focused tests: outbound authorization routes, outbound-write revocation | 13 passed, 0 failed, 131 assertions |
| Area A: sendIdentity routes, draftIdentity, senderIdentities, senderIdentitySelection, mcpAuth.identities, accountPrefs.identities, identities route, signatureTemplates (+save) — 9 files | 38 passed, 0 failed, 198 assertions |
| Area A: composeSenderInit, senderErrors | 28 passed, 0 failed, 129 assertions |
| Area A DOM (`bunfig.dom.toml`): ComposeFields, senderComposeReview, signatureHtmlTracking | 21 passed, 0 failed, 124 assertions |
| Area A reviewer probes (signature injection matrix; From display-name header injection) | 0 failures; header injection absent in 6/6 cases |
| Area B: ftsIdentity, shardFormat, accountKeys, db.sharedShard, folderAccount helper, folderAccountGuard, syncJobs — 7 files | 95 passed, 0 failed, 598 assertions |
| Area B reviewer probe (shared-shard FTS isolation/orphans/raw writers; two-account folder-mismatch routes) | 3 passed, 0 failed, 75 assertions |
| Area C: launcher (`lib/server/standalone.test.ts`) | 5 passed, 0 failed, 22 assertions |
| Area C: bodyLimit, readAuthJson | 12 passed, 0 failed, 194 assertions |
| Area C: i18n catalogs/resolveLocale/folderNames/authMessages/format + preferences route | 64 passed, 0 failed, 6,322 assertions |
| Area C DOM: AdminMailboxes, useAccountController | 18 passed, 0 failed, 108 assertions |
| Area C reviewer self-grant route probe | 1 passed, 0 failed, 17 assertions. One earlier run failed on a reviewer expectation (sole-manager revoke expected 200); the route correctly returns 403 `last_manager`. |
| Reviewer bodyless-guard probe (F1) | 400 `unexpected_body` after 16,777,216 bytes pulled |
| Selected Bun test total (excluding one overlapping Area A rerun of 38 tests) | **455 passed, 0 failed; 8,956 assertions** |
| Package metadata | `package.json` SHA-256 `cc62344f28724014baa244f9cbf4372877a614e7f052265545e0fbe7ba1202e8`; `bun.lock` SHA-256 `326073eee764c5c45295a6cf608bb05761474891aef9fab6711fb757dd512fb3` (unchanged before/after) |

Full `test:ci`, `test:stress`, `lint`, the watcher integration fixture, the SMTP wire matrix and the bounded IMAP source probe were not re-run in this round. The SMTP mapper and watcher code paths touched in this range are limited to folder-guard and sender-identity changes, which are covered above. Successful selected groups are test executions, not a claim of complete CI.

## Still open / recommended before go-live

1. Correct F1 (bounded bodyless reject) and F2 (normalized or search-free launcher error targets). Both are P3 hardening.
2. Resolve C-1: update the stale German dialog selector, then establish whether an unsent inline reply survives a UI-language switch. The compiled auth browser gate is red at 98b4301 (19/20) until then.
3. Run the complete current `test:ci` and `test:stress` and lint on the release candidate. Re-run the watcher integration fixture, the SMTP wire rejection matrix and the bounded IMAP full-source probe once on the final build. They were not repeated in this round.
4. Validate on the deployment:
   - actual canonical TLS/DNS/RP behavior, physical phone and PWA;
   - the deployed proxy: header overwrite and **request body limits**, which are the effective control for F1, C4 and the Better Auth endpoints;
   - listener isolation, effective global headers and the native telemetry setting;
   - service umask/permissions and independent key custody.
5. Perform the full coherent application plus independent mail-archive restore with synthetic mail, collaboration state, attachments and resumed workers barred from real IMAP. For FTS v3, follow the migration runbook (`36be023`) during the stopped-service procedure and run `validateFtsIdentity` afterwards. The 50k synthetic migration does not inspect household data.
6. Establish explicit aggregate full-source/MIME depth and worker memory/time/byte limits and validate them with a bounded resource test. Production-level IMAP log redaction under arbitrary server diagnostics remains broader than the tested fixtures.
7. Complete the final-mount unknown/wrong-password/banned/pending-operation response and timing comparison and all-public-passkey limiter coverage.
8. Optional hygiene: update the stale "Next 16.2.4" banner in `scripts/smokeTeamAuth.ts:175`. Consider aligning MCP folder-mismatch behavior (empty result) with REST (400) for consistency only.

## Final workspace state

The worktree is clean at `98b4301f55e6365021f9899ba16c61303c1c2672` on `qa/security-recheck-98b4301`; only the pre-existing ignored `.env.local` is present. No tracked file was changed and no commit was created. `package.json` and `bun.lock` hashes are unchanged. The worktree `.tmp` directory was removed, including the disposable source/build, sandbox scripts, gate logs, probes and Playwright error context. `ROOT/data/noctua-data-security2` was not used; all runtime data lived in disposable scratch directories. No reviewer process or listener on 3885–3889 remains. The only retained artifact is this report.

```json
{
  "status": "review_complete_with_open_items",
  "commit": "98b4301f55e6365021f9899ba16c61303c1c2672",
  "branch": "qa/security-recheck-98b4301",
  "new_findings": {
    "P1": 0,
    "P2": 0,
    "P3": 2
  },
  "top_items": [
    {
      "id": "F1",
      "severity": "P3",
      "item": "Bodyless-command guard buffers an unbounded body before 400; pre-session on logout and admin passkey-remove/sessions-revoke",
      "location": "app/api/_helpers/requestOrigin.ts:29"
    },
    {
      "id": "F2",
      "severity": "P3",
      "item": "Launcher log redaction misses non-canonical reset-path spellings (residual of 9424150 F1)",
      "location": "lib/authRecoveryContext.ts:19"
    },
    {
      "id": "C-1",
      "severity": "correctness (not security)",
      "item": "Compiled auth browser case fails at HEAD: stale German dialog selector; with it adapted, unsent inline reply absent after UI-language switch",
      "location": "tests/browser/auth/shell.spec.ts:229"
    },
    {
      "id": "previous-F1",
      "item": "Raw reset capability in exceptional launcher logs fixed for issued link forms (3766c92)"
    },
    {
      "id": "previous-dependency-gate",
      "item": "Closed at version level: Next 16.4.2, React 19.3.1, sharp 0.35.5"
    },
    {
      "id": "remaining-acceptance",
      "item": "Deployed proxy body/header limits, TLS/RP, full restore incl. FTS v3 runbook, aggregate IMAP resource bounds, statistical login comparisons, full CI/stress/lint"
    }
  ],
  "gates": {
    "security_controls_passed": 156,
    "security_controls_failed": 0,
    "privacy_assertions": 177,
    "selected_bun_tests_passed": 455,
    "selected_bun_tests_failed": 0,
    "selected_bun_assertions": 8956,
    "compiled_auth_browser_passed": 19,
    "compiled_auth_browser_failed": 1,
    "compiled_smoke": "passed",
    "graceful_shutdown": "passed",
    "typecheck_errors": 0,
    "build": "passed",
    "test_ci": "not_run",
    "lint": "not_run",
    "watcher_fixture": "not_run",
    "smtp_wire_matrix": "not_run"
  },
  "report_path": "/home/monkey/code/noctua-mail/briefs/security-recheck-98b4301.md",
  "worktree_clean": true,
  "tracked_files_modified": false,
  "commits_created": 0,
  "tmp_removed": true
}
```
