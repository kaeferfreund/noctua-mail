# Correctness, data-isolation and privacy re-check — integrated 9424150

Reviewed 2026-10-23. Source: `9424150f5aa0a446ed9bc03ed199e6825129467d`, branch `qa/security-recheck-9424150`, `/home/monkey/code/noctua-mail/wt-security`.

One new **P3 hardening finding** was observed in the standalone launcher's exceptional request logging. No new P1 or P2 boundary violation was established by these probes. The rejecting S1/S2 storage regressions and S3 privacy checks passed. The pre-existing framework dependency gate remains open. These results establish the stated local checks; they do not constitute household go-live acceptance.

The documented same-event-loop outbound window in `sender-identities-slice2-review-r2.md` was excluded from new findings, as requested. The broader identity-load, body/preparation, transport-entry and DB-retry seams were rechecked. No broader outbound authorization window was established.

## Method and execution boundary

Read `AGENTS.md`, `doc/AUTHENTICATION.md`, `doc/API.md`, `doc/TEAM-INBOX.md` §§5–7, `doc/HTML-MAIL-PRIVACY.md`, `doc/DEPLOYMENT.md`, the first audit's final checklist, and the supplied sender-identities review. This is a scoped independent re-check, without delegated agents or a prior machine coverage ledger.

All execution used synthetic principals/mailboxes/tokens. Reviewer-created addresses use `first@example.test` and `second@example.test`; existing committed tests also use clearly synthetic example.test/example.invalid addresses. Shared-shard checks use two accounts mapped to the same SQLite file, including identical local IDs, RFC Message-IDs, attachment IDs and thread IDs. No real user, external mail server, live preview, other worktree or other data directory was used.

The required security-controls script ran first with `nice -n 15`. Remaining gates ran one at a time against a disposable `git archive HEAD` under this worktree's `.tmp`, using installed dependencies read-only. Bubblewrap denied external network access and exposed only isolated loopback; the environment was cleared and populated with synthetic keys/origins and scratch-local HOME/TMPDIR/cache. CPU, process, descriptor, file-size and time limits were applied. Browser execution needed a larger virtual-address allowance for Chromium; its initial low-address-limit launch was discarded. A private hosts file provided localhost. Playwright's test runner used the installed Node 24.22.1 binary after Bun's ESM preflight import proved incompatible; the application, fixtures and test backend remained Bun 1.4.4. These are reviewer harness accommodations, not production-source fixes.

Only disposable test copies were adapted: privacy app/tracker to 3886/3887, outbound SMTP to 3888, sender rejection fixture to 3889, watcher IMAP/proxy/control to 3887/3888/3889, listener-origin tests to 3886, compiled smoke/standalone to 3885 and auth browser to 3886. Browser cleanup enumerated its own process group and signalled individual owned PIDs. No dependency installation, tracked edit, commit, push, PR, checkout/reset/stash, `PRAGMA optimize` or `ANALYZE` occurred.

`OK` below applies to the explicit invariant/probe. `FINDING` identifies either the new P3 or an explicitly labelled existing gate. Unexecuted deployment-scale or statistical checks remain listed separately; an OK local check does not close them.

## Checklist from the first audit

| Item and expected invariant | Probe | Observed result | Verdict |
|---|---|---|---|
| 1a. Activated auth: the compiled mount rejects raw/retired paths, setup-only access and foreign origins; verified TOTP gates mail. | Required security-controls suite; compiled `scripts/smokeTeamAuth.ts` on 3885 with canonical HTTPS origin/proxy headers; auth browser suite on 3886. | Smoke passed Secure cookies, raw-route/old-cookie rejection, restricted enrollment, verified MFA, refresh, live MCP, session revoke and ban. All 19 browser cases passed. Actual external TLS was not contacted. | OK, local compiled scope |
| 1b. Passkey/backup/recovery controls bind user, session, origin/RP, challenge, UV and one-use proof; reset does not create a session or remove MFA. | Real Chromium/CDP authenticator suite; Better Auth, auth-client and security-control tests; compiled reset smoke. | All 19 browser cases passed. Compiled reset was single-use, retained TOTP, rejected the old session and required MFA at next login. Wrong proof versus dead-session distinctions are covered by wrapper tests. | OK for executed cases |
| 1c. Reset capabilities stay out of browser history and request logs, including exceptional logging. | Compiled reset browser and ordinary-log smoke; fault-injected real standalone HTTP lifecycle using a synthetic reset target. | Ordinary compiled smoke logs were free of known synthetic capabilities. The launcher logged the raw reset query when its request handler rejected. See F1. | FINDING: new P3 |
| 2a. Manager candidates are bounded identity-only enabled non-members; an instance admin without mailbox membership gains no manager directory access. | `lib/teamAuthContracts.test.ts` actual candidate route, including viewer/editor/admin, query length, limit/default and disabled/incomplete/owner/member filters. | The candidate route cases passed in the 183-test final group. Source uses bound `instr` substring matching and selects only id/name/email. | OK for tested contract |
| 2b. Membership policy codes, admin passkey resource DTOs, invite history and audit cursors match their documented authority and redaction contracts. | `lib/teamAuthContracts.test.ts`, admin routes/security-controls, invite-route tests, audit-store tests; equal-timestamp pagination and malformed cursor cases. | The endpoint contract cases passed in the 183-test final group. Passkey resources are opaque and ownership checked; history IDs are non-redeemable; policy limits are enforced server-side. | OK for tested contract |
| 2c. Admin role never substitutes for mailbox membership; account/member DTOs omit secrets and lower-role configuration across REST, collaboration and MCP. | `lib/accountRouteRoles.test.ts`, `lib/teamAuthSlice3.test.ts`, `lib/threadCollab.api.test.ts`, MCP tests and source trace through account presentation/live token context. | Anonymous/non-member/lower-role requests fail; admin-without-membership summary is empty; member fields are role-filtered; MCP cannot fall back to cookies or override mailbox binding. | OK |
| 3a. Collaboration revisions, cleanup and remapping preserve each account's history and publish only committed changes; comments respect author/manager policy. | Shared-shard recompute/remap tests, `lib/db/threadCollab.remap.test.ts`, `lib/membershipCleanup.test.ts`, REST/service collaboration tests, user-events tests and dialog tests. | Independent account rows/history remain intact; cleanup increments revisions once; rollback emits nothing; REST returns committed revisions; author/manager and editor guards apply. Comment Markdown rendering was source-inspected; no comprehensive browser Markdown corpus is claimed. | OK, bounded rendering scope |
| 3b. Summary/events enumerate A-only, B-only, both and no memberships; revocation during pending work cannot enqueue old counts/threads. | Canonical summary and MCP summary tests, `lib/userEvents.test.ts`, auth-stream/IMAP-stream tests. Pause a summary fetch, delete membership or advance generation, then release it. | No revoked mailbox payload; another accessible mailbox continues. No-membership admin gets an empty list. Watcher-only events, open counts and thread revisions remain account-scoped. Session loss closes the stream. | OK |
| 4. Sender aliases affect From selection, not membership/actor/credentials; From/header validation precedes side effects; Sent and reply bookkeeping retain the actor. | Sender route fixture; eight outbound path probes; draft-header tests; MCP identity tests; sender metadata and shared-shard tests; 24 SMTP wire rejection cases. | Foreign/disabled identities and arbitrary From/envelopeFrom fail before SMTP/APPEND. Drafts retain identity; invalidation preserves drafts. Envelope and Reply-To match the selected identity. Bcc/identity marker handling, attribution, Sent warnings and acceptance-after-revocation behavior pass. Known narrow window excluded. | OK outside documented exclusion |
| 5. Composite shard keys isolate messages, threads, FTS, translations, topics, attachments and dependent cleanup; migration is atomic and old writers fail closed. | `lib/db.sharedShard.test.ts`, `lib/db/accountKeys.test.ts`, `lib/db/shardFormat.test.ts`, shared-shard attachment route, sender metadata and watcher shared-shard fixtures. | Same IDs coexist. Copy/recompute/delete/replace leave the second account intact. Legacy migration preserves data/IDs and rolls back injected failures; 50k rows/FTS entries preserved, idempotent reopen; unowned dependents fail safely; old/prepared writers and future formats are rejected. | OK, synthetic legacy files |
| 6a. Reader/standalone default to no remote loads; sender CSS/refresh/scripts/forms remain blocked; keyed opt-in preserves CID/local resources and no-referrer. | Required privacy browser test, remote-content sanitizer tests, sender-key/source-ownership regressions, attachment ownership routes and privacy DOM tests. | Privacy browser: 177 assertions passed. No automatic tracker/CSS requests in either HTML path; explicit image opt-in works without Referer. Legacy unkeyed/colliding-source rows stay unknown; CID/local resources and sanitizer regressions pass within the tested corpus. | OK |
| 6b. Installed framework/image/RSC dependencies meet reviewed patched versions. | Read installed package versions and lockfile; re-read primary Next.js October 14 advisories on 2026-10-23. | Next 16.2.4 and sharp 0.34.5 remain below the relevant Next 16.4.1 / sharp 0.35.5 fixes. No application exploit was attempted or established. See Existing dependency gate. | FINDING: existing release gate, no new application severity |
| 7. Watcher namespace resets, reconnect/backoff, credentials, leases and malformed/bounded MIME handling preserve correctness and isolation. | Watcher integration on isolated 3887/3888/3889; durable lease multiprocess tests; IMAP STATUS/stream cases; bounded parser/sync probe described below. | Watcher fixture passed bootstrap, IDLE insertion, flags/EXPUNGE, periodic Sent, graph ownership, credential reload/auth suspension, account add/remove, shared-shard collisions and reused UIDNEXT/UIDVALIDITY resets. The bounded MIME probe also completed all eight cases with safe depth rejection/recovery (Gates). Aggregate edge-case input resource budgets remain open. | OK for bounded cases |
| 8. Deployment, keys and backup preserve the canonical trust boundary and a coherent application snapshot. | Source review of proxy/startup/deployment contracts; compiled canonical-proxy smoke; isolated stopped master/auth/shard/key snapshot and restore; packaged shutdown probe. | Proxy example overwrites forwarded headers and suppresses auth diagnostics; compiled Secure cookies and synthetic restore passed. Actual TLS/DNS/RP phones, listener firewall, service umask/keys, proxy body/rate/header behavior and full mail/archive restore were not inspected. | OK for source/local smoke; deployment acceptance remains open |

## Added surfaces

| Item and expected invariant | Probe | Observed result | Verdict |
|---|---|---|---|
| `PUT /api/auth/preferences`: only the live MFA session user's locale may change; no selected mailbox is necessary. | Actual route tests plus reviewer self-service route probe; anonymous/setup/expired sessions; foreign Origin/Sec-Fetch-Site; malformed/null/array/unknown fields, foreign userId; compare both profiles/auth tables/audit. | 401/403 for missing/restricted/dead authority, 400 for invalid shape/media type, 403 for foreign origin. Valid de/en/null writes affect only the session profile and preserve auth tables/audit. | OK |
| Bounded JSON reader on all nine self-service auth routes: limit is 16,384 UTF-8 bytes, independent of Content-Length. | Helper and route boundary tests; stream exactly 16,384 bytes then overflow/tail; absent, false-small and oversized Content-Length; malformed JSON and split multibyte sequence. | All nine returned 413 `payload_too_large`, no-store, cancelled at the overflow chunk without reading the tail. Exact-limit bodies followed normal validation/success; unknown keys and malformed JSON remained rejected. | OK |
| `noctua-ui-locale` is a validated presentation preference and grants no identity/authority. | Locale resolver and preference route tests; cookie de/en/null/invalid; personal versus device/Accept-Language precedence; expired/setup identities. | Cookie has Path=/, Lax and one-year max-age; null deletes it. Invalid values are ignored; expired identity does not supply a personal locale. Personal preference wins while valid. | OK |
| SMTP `identityId`: foreign IDs/from/envelope overrides and stale authority must fail before transport. | Sender fixture plus direct outbound seam; viewer/editor/manager/non-member; revoke/ban/generation/session loss, disabled identity and transport-entry revocation. | Expected 400/404/409/401/403; zero SMTP connections/APPEND/cleanup/writes for denied cases. Accepted delivery remains accepted after later revocation. | OK outside documented exclusion |
| Draft save/send: saved identity, owned source/recipient headers and live editor authority control the first effect. | Save/send outbound seams; saved/disabled/foreign/legacy From and duplicate/Sender/Resent/marker cases; account metadata collisions. | Invalid inputs preserve the draft and perform no send/cleanup. Save preserves the selected identity. Send validates raw outer headers, strips marker/Bcc only from the wire as specified and uses the sending user's attribution. | OK outside documented exclusion |
| Calendar respond: attendee identity remains mailbox-bound; local-only participation writes also require live editor authority. | Calendar outbound seam and sender route fixture, including sendReply:false and revocation after entry. | Invalid/stale/disabled attendee identity and revoked editor fail without SMTP or participation mutation; organizer is preserved; post-acceptance behavior retains success/warnings. | OK outside documented exclusion |
| MCP identity tools/preferences: live token binding/role and own sparse prefs are rechecked inside writes and retries. | MCP create/update identity, set prefs and create draft outbound probes; token A with account B; viewer downgrade, token deletion/binding change, foreign identity/signature fields. | Binding/role errors are tool errors. Own prefs stay per-user, viewer remains sufficient for own prefs; manager identity writes recheck synchronously in the immediate transaction and after retry. | OK outside documented draft exclusion |
| SMTP mapper never returns provider transcripts or body/credential detail. | Mapper/helper tests plus 8 real SMTP response stages × direct/draft/calendar: greeting, unexpected protocol, auth, MAIL, RCPT, DATA, deferred sender denial and temporary failure. | 24/24 responses matched the documented 422/502 mapping, excluded the private provider marker and preserved draft/counter state. Existing timeout mappings also passed. | OK |
| `/api/me/mailboxes/summary`: open/watcher are additive, counts are distinct/account-scoped, serialization rechecks the session and membership. | Canonical summary tests, same-shard counts, scope-narrowed MCP summary, paused-read source trace. | Correct open/assigned/unassigned/unread definitions, no-access empty list, no-store; final synchronous snapshot filters removed membership and updates the live role before serialization. | OK |
| `/api/me/events`: every enqueue, including heartbeat and loaded counts, checks the live session and membership synchronously. | Pause load; delete membership/advance generation; publish foreign and authorized watcher/thread events; cancel/abort/revoke; heartbeat/liveness tests. | Revoked data is dropped, live other mailboxes continue, dead sessions close; pending timers/subscriptions are cleaned up. Complete current events include open/watcher, thread events carry only the committed revision. | OK |
| IMAP stream `folder:update`: unseen is STATUS unread count, never SELECT's first-unseen sequence. | Production route transport seam with intentionally different SELECT and STATUS values; initial connection, EXISTS, flags, polls, reconnect, auth revoke. | STATUS values are emitted for unseen/exists/uidNext as applicable; pending sensitive messages recheck authority and stream cancellation leaves the shared watcher running. | OK |
| Standalone drain, upgrades and request-error response: reject late requests cleanly and retain no private error body. | Real owned HTTP lifecycle with held request, pipelined post-signal request and failing upgrade; actual built `checkGracefulShutdown.ts` child on 3885. | Held response completed; late request was 503 + Connection: close; failed upgrade socket closed; closeUpgraded/Next close called; handler failure body was exactly Internal Server Error. Built idle child exited 0 in 173 ms without fallback. Exceptional URL logging is F1. | OK response/lifecycle; FINDING F1 logging |
| MCP token tab: send ttlSeconds, read `{token,tokenRecord}`, show the secret once and retain metadata only after closing. | MCP tab DOM tests for 180/30 day presets and tab exit/re-entry; real server token mint/list/delete and downgrade tests. | Correct request/response contract; secret disappears on tab transition, metadata refresh remains; server own-token/manager ownership rules and mailbox binding apply. | OK |
| Admin/members dialogs: use audited management wrappers, canonical codes and fresh proofs; client controls never bypass server authority. | AdminPanel/CollabSettings DOM tests; actual candidate/membership/admin route tests. | Owner/self/last-manager/disabled controls, capped candidates, stable error codes, explicit confirmations and final UV grant handling pass. Non-admin/viewer panels make no management fetches. | OK |

## Findings ranked by severity

### F1 — P3 — Standalone error logging retains a reset capability in the request target

**Location:** `lib/server/standalone.ts:38` (request catch); the same raw-target logging pattern exists at `lib/server/standalone.ts:51` (upgrade catch). Existing redaction contract/helper: `lib/authRecoveryContext.ts:16`–29.

**Invariant:** reset capabilities must not be persisted in request logs. Next's ordinary incoming-request exclusions do not filter this owned launcher console.error call.

**Minimal reproduction:** in a disposable test process, stub only Next's `getRequestHandlers` seam to return a request handler that rejects with a fixed synthetic error. Start the real exported `startServer` on 127.0.0.1:3885. Request `GET /reset-password?token=synthetic-reset-capability`. Capture stderr. The launcher emits `Failed to handle request for /reset-password?token=synthetic-reset-capability` plus the error. The client receives 500 with the fixed `Internal Server Error` body. The reviewer repeated the complete HTTP lifecycle probe with this target; `requestErrorLogsIncludeSyntheticResetCapability` was true and the shutdown/upgrade checks still passed.

**Scope and severity:** this establishes the exceptional logging behavior with an injected handler rejection. No naturally triggered compiled-Next exception, unauthorized log reader, real reset token disclosure or account takeover was established. It is P3 hardening; it is not a new P1/P2 access finding. The normal compiled reset smoke passed its log-redaction checks.

**Smallest correction:** omit sensitive auth/reset request targets from these two launcher log messages, or normalize the relative request target against a trusted base and apply `redactAuthUrl` before logging. Add a focused rejected-handler request/upgrade regression with a synthetic capability; do not change the fixed error response or drain behavior. No correction was made during this read-only review.

## Existing dependency gate

Installed Next **16.2.4**, React/ReactDOM **19.2.5**, sharp **0.34.5**, Better Auth/passkey **1.7.12**, Playwright **1.58.2**; Bun **1.4.4**. The first audit's dependency concern remains current. The [Next.js October 14 update](https://nextjs.org/blog/nextjs-security-update-october-14-2026) identifies patched Next 16.4.1 and a sharp 0.35.5 workaround for the SVG issue. The [Cache Components advisory](https://github.com/vercel/next.js/security/advisories/GHSA-673q-mjm6-r5xr) and [SVG advisory](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw) were re-read on 2026-10-23. Their affected ranges include the installed Next pin. No code execution, decoder exploit or framework availability probe was attempted. This is an existing release gate, excluded from the new P1/P2/P3 application counts.

## Gate results and retained evidence

| Gate | Observed result |
|---|---|
| Security controls — `nice -n 15 bash tests/runTeamAuthSecurityControls.sh` | 156 passed, 0 failed, 861 assertions; exit 0 |
| Role/origin/storage/summary/stream/locale/mapper group (20 files) | 325 passed, 0 failed, 1228 assertions; exit 0 |
| Outbound boundary, identity metadata and reviewer self-service group (9 files) | 46 passed, 0 failed, 372 assertions; exit 0 |
| Legacy keys, sender routes, watcher, leases and remap/cleanup group (8 files) | 45 passed, 0 failed, 173 assertions; exit 0 |
| MCP token/admin/member/privacy DOM group (4 files) | 69 passed, 0 failed, 269 assertions; exit 0 |
| Required HTML privacy browser — `bun test --config=bunfig.browser.toml --timeout 120000 ./tests/browser/htmlPrivacy.test.ts` | 1 passed, 0 failed, 177 assertions; exit 0 |
| Final candidate/member/admin/body-limit/auth/collaboration/HTML contracts (10 files) | 183 passed, 0 failed, 1193 assertions; exit 0 |
| Selected Bun test total | **825 passed, 0 failed; 4273 assertions** |
| Compiled auth browser — `AUTH_BROWSER_USE_BUILD=1 AUTH_BROWSER_PORT=3886 bun scripts/runAuthBrowserTests.ts` (installed Node runs Playwright CLI) | **19/19 passed**, zero skipped, 7.4 minutes; exit 0 |
| `bun check --no-pretty --all` | 0 errors in 1,173 files; exit 0 |
| `bun run build` | Optimized production build, framework TypeScript pass and standalone packaging passed; exit 0 |
| `bun scripts/checkGracefulShutdown.ts --port 3885 --data-dir /app/.tmp/shutdown-data` | Owned built standalone: exit 0, signal null, 173 ms, forced=false |
| Reviewer launcher lifecycle + error probe | 500 fixed body; failing upgrade closed; late pipelined request 503 + Connection: close; held response completed; upgraded/Next cleanup called; exit 0. Raw exceptional reset target reproduced (F1). |
| `AUTH_SMOKE_PORT=3885 bun scripts/smokeTeamAuth.ts` | Compiled canonical-origin/proxy/auth/MCP/reset/migration/isolated restore/log checks: SMOKE PASS, exit 0 |
| Reviewer wire SMTP matrix | 24/24 rejection cases: expected sanitized HTTP/code mapping and no private provider marker; exit 0 |
| Reviewer bounded IMAP full-source probe | 8 cases completed: 256 KiB, 1 MiB and 5 MiB text payloads; incomplete MIME boundary; quoted/folded header data; MIME depths 16/32; normal message after depth rejection. Seven ingested with finite dates, depth 32 declined at parser nesting limit, recovery succeeded. Each preserved the second account's shared-shard sentinel; exit 0. |
| Final repository checks | `git diff --check` and clean status at the pinned commit; unchanged package.json/bun.lock hashes |

The bounded IMAP fixture used `scripts/dev-fixture/imap-server.ts` on 3887/3889 and the real pooled `syncImapMessage` → sanitizer → account-scoped upsert path. Payloads were individually below 6 MiB. The final large-source timings were 122/57/209 ms for 256 KiB/1 MiB/5 MiB; depth 16 parsed in 21 ms, depth 32 returned null with `MAX_IMAP_NESTING_REACHED` in 7 ms, and the following ordinary source parsed in 14 ms. These timings are observations, not latency guarantees or proof of an aggregate resource limit. The initial probe's assumption that every depth must parse was corrected to assert safe rejection and recovery; no application fix was made.

The 50,000-message legacy key migration retained every row/FTS entry, completed in 2,633.20 ms, and reopened idempotently in 2.16 ms. This is synthetic migration evidence, not inspection of pre-existing household data.

Package metadata hashes before/after review: `package.json` SHA-256 `f928adc99420e8c8625106000738db77ba2da82da087bb70a8dafe1a554fb4c2`; `bun.lock` SHA-256 `66e83cd3f8976b76db7e5501318263875ad3fc77d46cd15f70a7b18183460045`.


Full `test:ci`, stress and lint were not run in this scoped re-check. Successful selected groups are test executions, not a claim of complete CI or distinct security controls. Build/typecheck ran against disposable source; the original worktree's generated/tracked files were unchanged.

Initial harness failures were resolved without production edits: Chromium virtual-address allowance; localhost mapping in the network-isolated environment; Playwright ESM preflight under Bun and the explicit installed Node binary. Discarded startup attempts did not establish product defects. The F1 logging probe deliberately injects a handler failure; transport-boundary and IMAP-stream seams are distinguished from actual compiled/browser/wire probes above.

The report is the only retained reviewer artifact. Scratch probes/logs/builds/databases were deleted after recording these results, as requested.

## Still open / recommended before go-live

1. Complete the dependency upgrade/rebuild/reviewed runtime gate, then re-run compiled auth, stream, browser and standalone checks. No go-live recommendation follows from a passing build at the old pins.
2. Correct F1's exceptional request-target logging. The previously documented narrow outbound window remains owned by its existing follow-up; it was not re-reported or counted here.
3. Validate actual canonical TLS/DNS/RP/physical phone/PWA behavior, deployed proxy header overwrite and request limits, listener isolation, effective global headers, native telemetry setting, service umask/permissions and independent key custody. This re-check inspected examples and isolated synthetic behavior only.
4. Perform the full §11 coherent application plus independent mail-archive restore with synthetic mail, collaboration state, attachments and resumed workers barred from real IMAP. The auth/master/shard/key smoke is narrower. Migration cannot reconstruct rows lost before S1 was fixed; inventory/resync legacy shared data during the stopped-service procedure.
5. Establish explicit aggregate full-source/MIME depth/worker memory-time-byte limits and validate them with a bounded resource test. The modest source/depth cases in this report do not establish a maximum or a shared service availability bound. Production-level IMAP log redaction under arbitrary server diagnostics also remains broader than the tested SMTP/error fixtures.
6. Complete the final-mount unknown/wrong-password/banned/pending-operation response/timing comparison and all-public-passkey limiter coverage. The successful policy/browser cases are not a statistical enumeration study. Run the complete current CI/stress gates before release.

## Final workspace state

The worktree is clean at `9424150f5aa0a446ed9bc03ed199e6825129467d` on `qa/security-recheck-9424150`. No tracked file was changed and no commit was created. The worktree `.tmp` directory, including reviewer fixtures, databases, logs and the disposable build, was removed. The only retained artifact is this explicitly requested report outside the reviewed worktree.

```json
{
  "status": "review_complete_with_open_release_gates",
  "commit": "9424150f5aa0a446ed9bc03ed199e6825129467d",
  "branch": "qa/security-recheck-9424150",
  "new_findings": {
    "P1": 0,
    "P2": 0,
    "P3": 1
  },
  "top_items": [
    {
      "id": "F1",
      "severity": "P3",
      "item": "Standalone exceptional request logging preserves reset capabilities",
      "location": "lib/server/standalone.ts:38"
    },
    {
      "id": "existing-dependency-gate",
      "item": "Installed Next/sharp remain below reviewed fixes; application exploitability not established"
    },
    {
      "id": "remaining-acceptance",
      "item": "Deployed proxy/TLS, full restore, aggregate IMAP resource bounds and statistical login comparisons remain open"
    }
  ],
  "gates": {
    "security_controls_passed": 156,
    "privacy_assertions": 177,
    "selected_bun_tests_passed": 825,
    "selected_bun_assertions": 4273,
    "compiled_auth_browser_passed": 19,
    "smtp_wire_cases_passed": 24,
    "bounded_imap_cases_completed": 8,
    "typecheck_errors": 0,
    "build": "passed",
    "test_ci": "not_run"
  },
  "report_path": "/home/monkey/code/noctua-mail/briefs/security-recheck-9424150.md",
  "worktree_clean": true,
  "tracked_files_modified": false,
  "commits_created": 0,
  "tmp_removed": true
}
```
