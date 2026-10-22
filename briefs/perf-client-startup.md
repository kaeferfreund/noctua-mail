# perf-client-startup

## Summary

Implemented ranks **5, 2, and 7**, in that order, on `perf/client-startup`, based on `0beb9a6`, exclusively in `/home/monkey/code/noctua-mail/wt-perf-startup`. All three ranks are committed. No push, merge, rebase, stash, server, mailbox access, or remote sync was performed. No no-touch files were modified.

Main-route first-load JavaScript: **2,413,531 → 2,055,963 bytes raw**, **722,139 → 610,690 bytes gzip**. Savings: **357,568 raw / 111,449 gzip bytes** (14.8% / 15.4%). This is the combined final build, not isolated per-commit builds. Exactly one production build was run.

| Route | JS chunks before → after | Raw KB before → after | Gzip KB before → after | Saved raw / gzip KB |
|---|---:|---:|---:|---:|
| `/` | 23 → 21 | 2,413.5 → 2,056.0 | 722.1 → 610.7 | 357.6 / 111.4 |
| `/compose/window` | 17 → 15 | 1,613.8 → 1,270.3 | 491.1 → 384.7 | 343.5 / 106.4 |
| `/message/window` | 18 → 17 | 1,552.9 → 1,387.3 | 469.0 → 420.0 | 165.6 / 49.0 |

Decimal KB; gzip level 6, compressed separately per asset. Baseline is the supplied brief's exact `0beb9a6` build, also retained in `/tmp/perf-bundle/measurements.json`; there was no baseline rebuild. Saved baseline routes are `/tmp/perf-startup/baseline-routes.json`.

Commits:

```
d765959 perf(startup): defer alias and topic count reads until idle
3e87578 perf(compose): defer Markdown viewing and warm conversion on interaction
27478f9 perf(accounts): reuse auth bootstrap accounts and stabilize initialization
```

## Per-rank

### Rank 5 — account bootstrap

`useAccountController` reads the sanitized accounts supplied by `/api/auth/me`, avoiding the sequential `/api/accounts` request. Its bootstrap callback no longer depends on `activeAccountId`; an effect-updated ref supplies the current selection when the async auth/accounts result arrives. Publishing the first selection therefore does not rerun initialization. The existing resolver still checks access against the freshly returned accounts.

Dedicated account reads remain for `skipAuthCheck` (login, account switching, explicit reload), older/missing auth payloads, and account CRUD/settings refreshes. The existing unauthenticated path stops immediately after a failed auth response. Account switching still mutates the session before reading accounts and folders.

Before: the original source predicts two copies of `/auth/me → /accounts → /folders`, six requests; that baseline was source-derived, not a captured production trace. After: the real hook DOM regression test records exactly:

```
GET /api/auth/me
GET /api/accounts/account-b/folders
```

There is no second bootstrap after the selected account is published or on rerender. Switch trace:

```
POST /api/auth/switch-account
GET  /api/accounts
GET  /api/accounts/account-b/folders
```

Five focused hook tests cover cold request order, selection changing while auth is pending, switch/explicit skip-auth reload order, auth 401, and a preferred account absent from fresh access data. No folders are requested for an inaccessible preferred account. No endpoint latency or time saving is claimed.

### Rank 2 — lazy Markdown viewing and conversion

Both `RenderHelpers.tsx` and detached `message/window/page.tsx` now dynamically load the existing MarkdownPanel, with a loading status. MarkdownPanel and all protected message files remain untouched.

The eager `lib/markdownConvert.ts` is now a lightweight cached loader and synchronous facade. The unchanged converter implementation lives in `lib/markdownConverters.ts`. Server email rendering imports that implementation directly, retaining its synchronous conversion behavior. Concurrent client loads share one promise; failed chunk loads can retry.

`ComposeOrchestrator.initializeCompose` warms and awaits the converter module before exposing the synchronous message-field controls or triggering autosave hashing. This common entry covers new, reply, reply-all, forward, edit/as-new, and detached compose. Existing initialization tokens discard superseded opens. The first open failure clears its initialization key so a subsequent attempt can retry. Send and draft handoff also explicitly await the loader. Autosave's synchronous content builder runs only after compose initialization has completed; it cannot save fallback content merely because a converter chunk is pending. The entire imperative orchestrator remains eager.

Focused conversion/initialization checks: **144 pass** across five files. Added an explicit Markdown → HTML → Markdown → text round trip. The compose DOM suite verifies a real HTML draft opens through the lazy boundary, autosaves a Turndown-derived `text/plain` part, and sends the same conversion. Existing forward attachment, cancellation, draft flush/send race, mobile and detached compose tests pass.

Production output confirms these factory groups have **zero occurrences in root eager chunks**:

| Group | Build-specific factory IDs / async evidence |
|---|---|
| MarkdownPanel / ReactMarkdown + JSX runtime | `356729`, `918789`; `0lvl0zhisiwa~.js` and detached `0vs02.3jfo4oz.js` |
| unified | `175765`, `541991`; async Markdown-core groups |
| mdast/remark-parse | `713059`; async Markdown-core groups |
| micromark CommonMark | `98189`, `69489`, `109334`, `431369`, `35198`; async Markdown-core groups |
| raw-HTML pipeline / parse5 7 | `130562`, `241631`, `789213`, `161505`, `282643`, `207026`; `0ldsqb0408gaj.js`, `1027a53uzko92.js` |
| Turndown | `715530`; `0zkhfao3y_bej.js` |

The Markdown viewer's root loadable manifest lists `0lvl0zhisiwa~.js` and `0w_601yils6n5.js`, both absent from the root first-load list. The old 182,633-byte raw-HTML pipeline chunk `0ldsqb0408gaj.js` still exists for interactions, with no eager route membership. Parser factory identities were checked against installed source strings and SSR source maps using the original brief's inspection method, then intersected with the emitted root `firstLoadChunkPaths`.

The separate HTML display sanitizer/parser (including parse5 8) remains eager as intended. The no-touch ComposeMarkdownEditor wrapper still imports `remark-breaks` and its small transformation utilities/styles; it does not keep the Markdown parser core eager.

### Rank 7 — secondary request gating

Recipient-alias and topic-stats startup reads are scheduled with `requestIdleCallback` (bounded by a 1,500 ms timeout); browsers without it use a cancellable 1,000 ms timer. This implements the permitted browser-idle condition without adding first-list plumbing to MailClient.

Aliases use a shared resource scoped by fetch-function identity and account, observed through React's `useSyncExternalStore`. Both the hook's idle load and compose initialization use the same resource. Immediate compose starts/awaits the read before becoming interactive; the later idle callback does not repeat it. Explicit alias refresh remains immediate. Public alias setters preserve create/update/delete behavior, and local edits supersede an older in-flight read. Account changes unsubscribe from the old snapshot and cancel scheduled work.

Topic definitions remain eager to preserve topic UI/badges; only their stats request moves to idle. Explicit stats refresh still runs immediately, supersedes scheduled/in-flight startup reads, and results remain tagged to their account. Reminders and their delivery path were not modified.

Before initial secondary reads: `topics`, `topics/stats`, `recipient-aliases`. After, before idle or compose interaction: **`topics` only**, shifting **two requests**. Immediate compose brings aliases forward as required; stats remain idle. No numerical millisecond saving is asserted.

Five focused hook tests cover no eager alias/stats reads, immediate-compose readiness, in-flight deduplication, local edits, explicit refresh, account cancellation/isolation and topic counts. A separate real-orchestrator DOM test holds the alias response and verifies compose remains noninteractive until it resolves. The combined startup/compose DOM check passes **20 tests**.

## Skipped and why

No requested rank was skipped. The optional Markdown editor wrapper/CSS deferral (rank 6 in the original brief) was not attempted because both wrapper files are explicitly no-touch. No change there was required to remove the parser core from root eager chunks. Settings, icons, fonts, sanitization, message/list/shell internals and all other out-of-scope recommendations remain untouched.

## Verification

Commands ran from `/home/monkey/code/noctua-mail/wt-perf-startup`. Long commands were run with `nice -n 10`. Test/build runs override the configured data directory with the sole authorized perf-startup directory. No dev/start server was needed; the cold-load request evidence comes from actual hook tests with synthetic API responses.

```sh
# Rank 5
nice -n 10 bun test --config=bunfig.dom.toml app/components/mailclient/useAccountController.dom.test.tsx
# 5 pass, 0 fail.

# Rank 2
nice -n 10 bun test lib/markdownConvert.test.ts lib/markdownEmail.test.ts app/components/mailclient/composition/composeTabSwitch.test.ts app/components/mailclient/composition/composeContentBuilder.test.ts app/components/mailclient/composition/composeInitState.test.ts
# 144 pass, 0 fail.
nice -n 10 bun test --config=bunfig.dom.toml app/components/mailclient/composition/sendMailRace.dom.test.tsx
# 14 pass, 0 fail at rank 2 (15 after rank 7's integration test).

# Rank 7
nice -n 10 bun test --config=bunfig.dom.toml app/components/mailclient/startupRequests.dom.test.tsx app/components/mailclient/composition/sendMailRace.dom.test.tsx
# 20 pass, 0 fail.

# Final full suite: run exactly once
nice -n 10 env NOCTUA_DATA_DIR=/home/monkey/code/noctua-mail/data/noctua-data-perf-startup bun run test:ci > /tmp/perf-startup-test-ci.log 2>&1
# 1,706 unit pass / 0 fail (198 files), 65 DOM pass / 0 fail (12 files).
# Baseline: 1,705 unit + 53 DOM.

nice -n 10 bunx tsc --noEmit > /tmp/perf-startup-tsc-final.log 2>&1
# 356 error TS diagnostics, unchanged from baseline; command itself exits 2.
# An initial run found 359; fixed a fixture's incomplete type and followed the
# repo's existing targeted bun:test declaration annotation in the two new tests.
# Two explicit tsc invocations total. No new production diagnostics.

nice -n 10 bun run lint > /tmp/perf-startup-lint.log 2>&1
# 1 error / 27 warnings, unchanged. Existing error:
# app/components/calendar/useCalendarConflicts.ts:58, setState inside effect.
# ESLint on all changed source/test files passes without warnings.

# One and only production build
nice -n 10 env NOCTUA_DATA_DIR=/home/monkey/code/noctua-mail/data/noctua-data-perf-startup bun run build > /tmp/perf-startup-build.log 2>&1
# Exit 0. Next 16.2.4 Turbopack: compile 14.6s; build TypeScript 20.7s;
# 21/21 static pages generated. These phase timings are not app load timings.

nice -n 10 bun /tmp/perf-startup/measure.cjs > /tmp/perf-startup/measurements-summary.json
nice -n 10 bun /tmp/perf-startup/check-parser-boundaries.cjs > /tmp/perf-startup/parser-boundaries.json
# All six parser/viewer/converter groups have eagerChunks: [].
git diff --check
git status --short
# Both clean.
```

`measure.cjs` is a copy of the supplied brief's `/tmp/perf-bundle/measure.cjs`, with its output file changed to `/tmp/perf-startup/measurements.json`. It sums each route's unique `firstLoadChunkPaths` from `.next/diagnostics/route-bundle-stats.json`, reads each asset, and sums `zlib.gzipSync(bytes, {level: 6}).length`. The modern-browser polyfill asset, HTML/RSC bytes, and future interaction chunks are excluded, as in the baseline. Root raw sum also exactly matches Next's `firstLoadUncompressedJsBytes` (2,055,963).

Measurements and parser evidence are retained under `/tmp/perf-startup/`; test/typecheck/lint/build logs are `/tmp/perf-startup-*.log`.

## Risks

- First compose waits for converter chunks and, if not already loaded, the alias read. A failed converter load reports the existing compose-open error and can retry. The synchronous tab-conversion contract depends on all UI entry points continuing to use the central initializer.
- Alias resources are cached for the lifetime of the client's fetch function; account activation schedules a fresh idle read, and explicit refresh/mutations remain available. Failed network reads retain the last snapshot and remain retryable, matching the existing nonfatal alias behavior.
- Idle scheduling shifts contention; its fallback is time-based where the browser lacks requestIdleCallback. Topic counts can briefly be empty until idle. Reminder requests remain timely and unchanged.
- The root bundle reduction and request traces are measured/verified as described, but no authenticated production-browser network trace, LCP, CPU profile, real SMTP, remote mailbox, or interactive detached-message browser session was run. Detached behavior is covered by source parity, production route output, and compose DOM tests. No transfer-time/latency improvement is claimed.
- Existing typecheck and lint baselines still fail globally; this task does not repair those unrelated issues.

## Files touched

- `app/components/mailclient/RenderHelpers.tsx`
- `app/components/mailclient/composition/ComposeOrchestrator.tsx`
- `app/components/mailclient/composition/composeContentBuilder.test.ts`
- `app/components/mailclient/composition/composeTabSwitch.test.ts`
- `app/components/mailclient/composition/sendMailRace.dom.test.tsx`
- `app/components/mailclient/composition/useDraftManager.ts`
- `app/components/mailclient/deferUntilIdle.ts`
- `app/components/mailclient/recipientAliasesResource.ts`
- `app/components/mailclient/startupRequests.dom.test.tsx`
- `app/components/mailclient/useAccountController.dom.test.tsx`
- `app/components/mailclient/useAccountController.ts`
- `app/components/mailclient/useRecipientAliases.ts`
- `app/components/mailclient/useTopics.ts`
- `app/message/window/page.tsx`
- `lib/markdownConvert.test.ts`
- `lib/markdownConvert.ts`
- `lib/markdownConverters.ts`
- `lib/markdownEmail.ts`

Delivery brief (outside the worktree): `/home/monkey/code/noctua-mail/briefs/perf-client-startup.md`.
