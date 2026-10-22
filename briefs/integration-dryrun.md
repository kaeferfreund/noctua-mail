# Integration dry-run

Scope: local throwaway `integration/dryrun` in `/home/monkey/code/noctua-mail/wt-integration-dryrun`, starting at `20be988cf6720bdfbb8f3e916b475be229a390af`. No push, PR, deployment or update to `team-inbox`; no other worktrees edited. Commands used the worktree `.tmp` as TMPDIR and `nice -n 10` for heavy work. App/browser harness port: 3799 via `AUTH_BROWSER_PORT=3799`; no application server on other ports. Existing synthetic protocol tests allocate their own ephemeral loopback fixture sockets.

Ownership follows team-auth's design v5 §9: auth/session/guards → team-auth; collaboration state/routes/send attribution → thread-collaboration; watcher/sync/stream core → mailbox-watcher, retaining auth's delivery checks; collab UI → collab-ui; existing shell → team-inbox. The dry-run sources remain exactly the four requested SHAs.

The background watcher deliberately uses encrypted DB credentials independently of browser sessions. Browser SSE delivery keeps team-auth’s live user/session/generation/role checks, including revocation during pending connect/fetch/poll, and owns disposal of its clients. Temporary collaboration role/member helpers were replaced with canonical team-auth helpers.

## Merge 1: team-auth `54dc833`

Merge commit: `684d680311e01c381c2b5f695089bee8d9554139`. Conflicted files: **0**.

No textual conflicts; team-auth already includes the supplied team-inbox base.

Integration glue (line references are in the final dry-run tree):

- `scripts/runAuthBrowserTests.ts:9` — configurable AUTH_BROWSER_PORT.
- `scripts/authBrowserServer.ts:19` — configurable AUTH_BROWSER_PORT.
- `playwright.auth.config.ts:5` — configurable AUTH_BROWSER_PORT.

Checks: `bun install` and `bun install --frozen-lockfile`: pass. Filtered TypeScript diagnostic count: **151** (team-auth baseline 151). `test:ci`: **2105 + 69 DOM pass, 0 fail**.

## Merge 2: thread-collaboration `133bddc`

Merge commit: `0eaf8bae5ecda7f45597ab1600513a16bf77b686`. Conflicted files: **12**.

- `app/api/accounts/[accountId]/calendar/events/[eventId]/respond/route.ts:155` — Keep team-auth editor guard and origin validation; retain the existing single RSVP parse and add collaboration completeSend attribution from the assured session.
- `app/api/accounts/[accountId]/drafts/[draftId]/send/route.ts:41` — Keep team-auth editor guard and bodyless-capable mutation-origin guard; add collaboration actor to sendDraftForAccount.
- `app/api/accounts/[accountId]/drafts/save/route.ts:21` — Keep team-auth editor guard; remove duplicate pre-guard parsing and parse once inside withAuthResponse.
- `app/api/accounts/[accountId]/members/route.ts:9` — Keep team-auth role/member DTO policy, then extract listAccountMembersForRole for REST, collaboration bootstrap and MCP.
- `app/api/accounts/[accountId]/smtp/send/route.ts:41` — Keep team-auth editor guard and origin policy; retain incoming completeSend and actor metadata; parse JSON once inside withAuthResponse.
- `app/api/accounts/[accountId]/thread/related/route.ts:56` — Union requireJsonSameOrigin and collaboration enrichment imports; preserve auth viewer guard and add response enrichment.
- `app/api/accounts/[accountId]/threads/route.ts:90` — Keep viewer guard; retain viewerUserId and add enrichMessagesWithThreadCollab after topic enrichment.
- `app/api/mcp/route.test.ts:170` — Keep team-auth implementation/HTTP security tests; incoming implementation predates live auth.
- `app/api/messages/listMessagesHandler.ts:74` — Union canonical auth guard and collaboration enrichment imports; retain live account access and viewerUserId filtering.
- `lib/mcpServer.ts:330` — Keep live resolveMcpToolContext and auth list_accounts policy; add collaboration imports, actor and tools.
- `lib/serverDb.ts:182` — Union auth/mailbox wrappers with saveFoldersForAccount.
- `package.json:56` — Union shell dependencies and auth/playwright pins; regenerate bun.lock.

Integration glue (line references are in the final dry-run tree):

- `app/api/_helpers/threadCollabContext.ts:10` — canonical requireAccountContext plus collab actor.
- `lib/threadCollab.ts:15` — re-export canonical accountAccess role/member helpers.
- `lib/accountAccess.ts:26` — shared public member DTO by role.
- `lib/threadCollab.api.test.ts:19` — mint MFA-bound tokens, assert live roles, auth DTO and JSON status contract.
- `lib/teamAuthSlice3.test.ts:207` — explicitly remove installed collaboration tables to model absent/corrupt schema.
- `lib/accountRouteRoles.testData.ts:500` — add five collaboration methods.
- `app/components/mailclient/utils/calendarInviteState.test.ts:11` — threadId in message fixture.
- `lib/crossAccountCopy.test.ts:176` — retain generic threading input type.
- `app/api/accounts/[accountId]/drafts/save/route.ts:21` — parse JSON once inside auth response tail.
- `app/api/accounts/[accountId]/smtp/send/route.ts:41` — parse JSON once inside auth response tail.
- `app/api/accounts/[accountId]/drafts/[draftId]/send/route.ts:41` — preserve bodyless mutation origin guard.
- `lib/mcpServer.ts:330` — live token recheck plus collab tool registration; optional disabled in public DTO schema.
- `app/api/accounts/[accountId]/members/route.ts:9` — delegate public member serialization to shared role-aware helper.
- `app/api/accounts/[accountId]/threads/[threadId]/collab/route.ts:8` — share the canonical public member DTO with REST and MCP.
- `app/api/accounts/[accountId]/calendar/events/[eventId]/respond/route.ts:155` — keep canonical editor guard and derive collaboration send actor from its session.

Checks: `bun install` and `bun install --frozen-lockfile`: pass. Filtered TypeScript diagnostic count: **148** (team-auth baseline 151). `test:ci`: **2153 unit/integration + 69 DOM pass, zero failures (448.74s + 21.27s)**.

## Merge 3: mailbox-watcher `bd7eb5f`

Merge commit: `8653dc9c2e0740e81bac12da29ae7902e9807489`. Conflicted files: **6**.

- `app/api/accounts/[accountId]/imap/stream/route.ts:189` — Keep team-auth liveness, refresh headers, resource ownership and test seams; port watcher shared IDLE loop and UIDVALIDITY reconciliation.
- `instrumentation.ts:13` — Initialize master DB, await Better Auth, then start gated watcher.
- `lib/db.ts:431` — Union exports/wrappers; retain auth and collaboration plus watcher summary helpers.
- `lib/serverDb.ts:182` — Union exports/wrappers; retain auth and collaboration plus watcher summary helpers.
- `lib/specialFolders.test.ts:158` — Both sides contain identical Sent discovery assertions; retain one copy and the explanatory merge comment.
- `lib/teamFeatures.ts:2` — Keep canonical DB-only teamFeaturesSupported implementation.

Integration glue (line references are in the final dry-run tree):

- `lib/mail/imap/idle.ts:16` — optional createClient/disposeClient hooks retain browser ownership during connect.
- `app/api/accounts/[accountId]/imap/stream/route.ts:189` — use shared IDLE connect/loop, retain auth stream boundary and disposal, reconcile UIDVALIDITY before equal-UIDNEXT return.
- `app/api/accounts/[accountId]/imap/stream/route.test.ts:23` — fake client implements usable/close lifecycle.
- `app/api/_helpers/mailboxSummary.ts:13` — remove retired guard fallback, recheck live selected-account role.
- `app/api/accounts/summary/route.test.ts:55` — port activeAccountId fixtures, remove legacy guard cases, verify revoked member cannot open shard.
- `scripts/verifyBrowserNamespace.test.fixture.ts:21` — authenticatedTestCookie and narrow stream transport seam; initialize harness before subprocess storage.
- `scripts/verifyMailboxWatcher.ts:193` — authenticatedTestCookie; initialize harness before subprocess storage.
- `lib/db/connection.ts:219` — retry idempotent master-schema startup with a shared initialization promise; all callers await readiness.
- `lib/db/connection.auth.test.ts:65` — cold module startup under a held writer lock, including concurrent callers.

Checks: `bun install` and `bun install --frozen-lockfile`: pass. Filtered TypeScript diagnostic count: **148** (team-auth baseline 151). `test:ci`: **2188 unit/integration + 69 DOM pass, zero failures (414.78s + 18.45s)**.

## Merge 4: collab-ui `731ddc2`

Merge commit: `788153e3d3d35594b3b02438390a9af914dfeffc`. Conflicted files: **0**.

No textual conflicts; Git combined the pinned UI changes with the existing shell and integrated backend.

Integration glue (line references are in the final dry-run tree):

- `app/components/collab/types.ts:33` — accept canonical nullable member name and fall back to email.
- `app/components/collab/Collaboration.dom.test.tsx:274` — render a real nullable member DTO in list chip coverage.
- `bun.lock:28` — normalize four duplicate workspace dependency keys retained by Bun no-change installs; all resolved package entries unchanged.

Checks: `bun install` and `bun install --frozen-lockfile`: pass. Filtered TypeScript diagnostic count: **148** (team-auth baseline 151). `test:ci`: **2189 unit/integration + 138 DOM pass, zero failures (332.16s + 23.18s)**.

## Final checks after merge 4

- TypeScript (filtered): 148 diagnostics, all test sources, versus team-auth baseline 151; production build type checking passed
- Dependency install / frozen lockfile: PASS; package resolutions unchanged; pins better-auth 1.7.12, @better-auth/passkey 1.7.12, @playwright/test 1.58.2, radix-ui 1.8.1
- test:ci: PASS: 2189 unit/integration + 138 DOM, zero failures
- test:stress: PASS: 6567 tests across 243 files, zero failures, seed 1337, rerun-each=3 (943.01s)
- lint: exit 1, baseline unchanged: 1 error (app/components/calendar/useCalendarConflicts.ts:58, react-hooks/set-state-in-effect) + 27 warnings; no new diagnostics; warning signatures identical to preflight and failing file unchanged from 20be988
- build: PASS (Next.js 16.2.4, optimized production compilation, type checking and route generation)
- test:auth-browser: PASS: 8 Chromium WebAuthn tests (15.1s), production build on port 3799; owned server stopped by harness

## Final merge checklist

1. Start from the intended clean `team-inbox` head in an operator-owned integration checkout. Confirm the source commits before merging: `54dc833` (team-auth), `133bddc` (thread-collaboration), `bd7eb5f` (watcher), then **the newer collab-ui head** instead of `731ddc2`. Read any new source diffs; these conflict counts apply only to the pinned dry-run. Do not copy whole resolved files over later feature fixes.
2. Merge with `git merge --no-ff <verified SHA>` in that order. The first merge was conflict-free from `20be988`. Preserve team-auth's design v5 docs, Better Auth setup, canonical account guards, auth policy, stream liveness and test harness.
3. For collaboration's 12 expected conflicts, follow the per-file map above. Keep team-auth's `requireAccountContext(..., {minRole})`, `withAuthResponse`, origin policy and live `resolveMcpToolContext`. Add collaboration enrichment, `viewerUserId`, send attribution (`collabActorFromSession`) and tool registrations. In smtp/send and drafts/save, parse JSON exactly once **inside** the authenticated response tail. Keep the calendar RSVP handler’s existing single parse and add its send attribution. Draft-send remains a bodyless-capable command using `requireMutationSameOrigin`.
4. Replace collaboration's temporary role/member SQL helpers with canonical accountAccess helpers. Share the member DTO policy: managers see `disabled`, other members receive enabled members with that field omitted. Apply the same policy to `/members`, collaboration bootstrap and MCP; MCP output schema permits absent `disabled`. Keep team-auth's `list_accounts` semantics and its HTTP downgrade/generation/ban tests.
5. Port collaboration MCP fixtures to real MFA-bound tokens. Mint while the creator is editor, then use `setUserAccountRole` to apply the role under test; `addMembership` uses INSERT OR IGNORE and cannot downgrade an existing link. Pass the real tokenRecord and user-bound authInfo to executor tests. Use the real token id in activity client assertions. Update JSON content-type expectation to team-auth's 400 contract.
6. Port schema tests: explicitly drop the automatically installed collaboration tables in the two tests that model absent/corrupt schemas in `lib/teamAuthSlice3.test.ts`. Keep their fail-closed cleanup_pending and idempotency assertions. Add the five collaboration GET/PATCH/POST/DELETE methods to `lib/accountRouteRoles.testData.ts` so authorization inventory remains exhaustive. Keep threadId/generic message fixtures compatible with the merged Message type.
7. For watcher’s six expected conflicts: initialize master DB → await Better Auth → start opt-in watcher; union DB exports/wrappers; keep canonical teamFeaturesSupported; retain one copy of identical Sent tests. In the SSE route retain auth's final authorization check before enqueue, refresh cookies, sanitized errors, abort/cancel/revoke cleanup and ownership of in-flight clients. Reuse watcher’s shared connection/IDLE core with the create/dispose hooks, and check UIDVALIDITY **before** returning for unchanged UIDNEXT. Never reuse SELECT-time validity or stale watermarks after a reset.
8. Port both watcher standalone fixtures (`scripts/verifyBrowserNamespace.test.fixture.ts`, `scripts/verifyMailboxWatcher.ts`) from sealSession to authenticatedTestCookie. Initialize the shared harness module before opening their subprocess data root and keep that root stable for spawned workers. Keep the browser fixture mock at the narrow stream runtime seam. Remove the retired requireSessionOr401 fallback from the transitional summary helper and recheck selected-account membership before shard access. Keep the revocation regression test.
9. Merge collab-ui preserving the current shell and its collab prop bag. Match nullable member names to the auth DTO; render email for null/blank names. **Take the final monotonic revision fix** in DB schema, store and UI; review all raw state writers, especially `lib/membershipCleanup.ts`, for revision increments and test any new snapshot acceptance logic. The pinned dry-run intentionally does not invent the missing revision implementation.
10. Resolve package.json as a deduplicated union, retaining exact better-auth **1.7.12**, @better-auth/passkey **1.7.12**, @playwright/test and radix-ui **1.8.1** pins. Never concatenate conflict hunks into duplicate JSON keys. Regenerate `bun.lock` with `bun install`, normalize duplicate workspace keys if Bun reports no changes instead of rewriting them, then verify `bun install --frozen-lockfile`. Compare resolved package entries to ensure normalization did not change versions.
11. After each merge, run `bun check --no-pretty --all 2>&1 | grep "error TS" | grep -v bun:test | wc -l` and `timeout 1500 nice -n 10 bun run test:ci`. Compare diagnostic identities as well as counts; the baseline contains test type errors. Run the focused integration areas when adapting these resolutions.
12. After the last merge run `timeout 1800 nice -n 10 bun run test:stress`, `timeout 600 bun run lint`, `timeout 1200 nice -n 10 bun run build`, then `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-arm64 AUTH_BROWSER_USE_BUILD=1 AUTH_BROWSER_PORT=3799 bun run test:auth-browser` with TMPDIR set to the checkout `.tmp`. Configurable AUTH_BROWSER_PORT retains 3784 as the repository default but allows the dry-run's required 3799. Keep owned PID cleanup, use isolated synthetic storage and fail if the port is occupied.
13. Commit each real merge with the actual conflict/resolution list and validation, then follow the real integration's review/approval process. This dry-run authorizes no push or merge to team-inbox.

## Read-only preview for the newer collab-ui head

The observed head `0ec723280aee2d662f7b6125de41c854bc6e7944` adds backend revision commit `ef8baf2` and UI commit `0ec7232`. `git merge-tree --write-tree 8653dc9 0ec7232` found **one additional textual conflict**, in `app/api/accounts/[accountId]/threads/[threadId]/collab/route.ts`. This preview did not change the worktree and is not included in the four pinned merge/check results.

Resolve that GET bootstrap by importing `getThreadCollabSnapshot` from threadCollab and retaining `listAccountMembersForRole` from accountAccess. Read `[snapshot, members]` in parallel with those helpers and return `collabJson({ ok: true, ...snapshot, members })`. Preserve PATCH and the canonical withThreadCollab guard. Retain the new snapshot’s atomic consistency and revision metadata; do not restore the three independent state/comments/activity reads or the old member serialization. Update auth cleanup’s raw state writer and its corruption-test schema for revisions, then rerun all gates on the actual newer merged tree.

## Failure history and flaky tests

- Collaboration: an initial run was stopped after a duplicated draft-send JSON guard failed; fixed the bodyless command contract. A dateFormatting DST subprocess assertion failed because duplicate package.json keys emitted Bun warnings on stderr. This was a deterministic merge error, not a date/DST flake; deduplicating package keys fixed it.
- The next collaboration run found exactly three integration fixture/inventory failures (two schema assumptions and missing collaboration routes). They were fixed, focused checks passed, and the subsequent full CI run passed.
- Watcher full CI exposed SQLITE_BUSY in the team-auth master-schema startup transaction while watcher leases were being written. Fixed getDb with bounded retry and a shared initialization promise; a cold-module held-writer regression covers it. This was a real integration race, not a test timeout to suppress.
- Final randomized stress passed all 6567 test executions with seed 1337 and three runs per test. No unresolved flaky failures were observed in that run; this is not a guarantee for every order or host load.
- Synthetic IMAP/SMTP send, watcher, process-lease and browser tests have explicit deadlines. Preserve their diagnostics and use the supplied timeouts on the shared host; do not silently skip or extend tests to mask a regression.

## Open integration issues

- **P1 — Real integration must take the newer revision contract** (`lib/db/threadCollab.ts`, `lib/db/schema.ts`, `app/hooks/useThreadCollab.ts`, `lib/membershipCleanup.ts`, `app/api/accounts/[accountId]/threads/[threadId]/collab/route.ts`): The required pinned dry-run uses 731ddc2, which orders snapshots by timestamps. Observed newer collab-ui head 0ec723280aee2d662f7b6125de41c854bc6e7944 includes backend ef8baf2 plus UI 0ec7232. Recheck the final head and merge its monotonic revision implementation. Team-auth cleanup currently performs raw UPDATEs of thread_collab_state without revision increments; adapt that writer and its fixture schema/tests when adopting the newer head. This follow-up was intentionally not invented in the pinned dry-run. Read-only merge-tree preview against 8653dc9 found one additional textual conflict in the bootstrap route: combine getThreadCollabSnapshot with listAccountMembersForRole; this newer merge was not applied or validated in the pinned dry-run.
- **P2 — Canonical cross-mailbox summaries/events are not implemented in these pinned snapshots** (`app/api/accounts/summary/route.ts`, `app/api/_helpers/mailboxSummary.ts`, `lib/db/mailboxSummary.ts`, `app/api/me/mailboxes/summary/**`, `app/api/me/events/**`): Watcher supplies only a transitional selected-account summary (now with live membership checks). The pinned collab-ui does not contain the canonical /api/me/mailboxes/summary or /api/me/events routes, nor cross-account assigned-to-me/unassigned-open counts. These remain collab-ui ownership under design §9; do not treat the transitional route as design-v5 completion.

Estimated real integration effort: About 2–3 hours with this map: roughly 45–90 minutes for resolutions and review plus 50–75 minutes for the four CI passes, stress, build and browser gates on the shared host. Excludes implementing the missing canonical summaries/events; recheck any newer source diffs and revision/cleanup contract first.

Temporary scratch files: removed worktree .tmp after final validation; worktree clean, all four merge parents and co-author trailers verified.
