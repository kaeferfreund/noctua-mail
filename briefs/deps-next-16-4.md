# Next 16.4.2 / React 19.3.1 upgrade (`chore/deps-next-16-4`)

2026-10-23. Worktree `/home/monkey/code/noctua-mail/wt-deps-next16`, branch `chore/deps-next-16-4`, final SHA **`4547815`** (`4547815` short; full tip as validated in this worktree), based on `origin/integration/stage` **`11dc3c5`**. Verification-only pass: no tracked files were modified by the test agent; `git status` is clean at the end. All heavy commands ran at `nice -n 10` with `export TMPDIR=$PWD/.tmp/next16/tmp`. Owned ports: 3905–3908, 3910, 3912–3913, 3915. No server was started on 3790 or 3795–3799 (3790/3795–3797 were already occupied by other sessions and left untouched). Every owned listener was stopped; final `ss` check on 3905–3919 and 3791–3794 shows nothing.

## Summary — GO

**GO.** Every release gate that can run on this box passed on the first attempt, with zero retries and zero source fixes. The only gate that could not run is the Docker worker-image verification (`bun build-scripts/verifyDockerWorkerImage.ts` / `test:docker-workers`): `command -v docker` is empty on this host. That gate must pass on a Docker-capable build host before release, exactly as the spike brief required. Typecheck is clean (0 errors / 1,197 files) and lint is green for the first time on this line (exit 0, 0 errors / 181 warnings) because the branch fixes the last pre-existing error and scopes the 156 new react-hooks 7.1 findings to warnings. Unit, DOM, stress, browser, QA, htmlPrivacy and security suites all reproduce or exceed their round-8 baselines. The production build keeps the flat standalone layout with the owned launcher, graceful shutdown is 29–44 ms in all three probes, the standalone locale matrix is 5/5, and main-route initial JS shrinks by 21,064 gzip bytes (−3.17%). Merging against `feat/sender-identities-2` is clean; against `feat/sender-identities-3` there are four content conflicts, but all four already exist between the unchanged base `11dc3c5` and that branch — this branch introduces no new conflict.

## Package table (from `a0ef4fb`)

| Package | Before (`11dc3c5`) | After (`4547815`) |
| --- | --- | --- |
| next | 16.2.4 | **16.4.2** |
| react / react-dom | 19.2.5 | **19.3.1** |
| @types/react | ^19.2.14 | **19.3.0** (exact) |
| @types/react-dom | ^19.2.3 | **19.3.0** (exact) |
| eslint-config-next | 16.2.4 | **16.4.2** |
| eslint-plugin-react-hooks | 7.0.1, transitive | **7.1.1**, explicit dev pin |
| next-intl / use-intl | 4.14.9 | 4.14.9, unchanged |
| sharp (override + Next optional) | 0.35.5 | 0.35.5, retained |
| TypeScript | ^6.0.3 | ^6.0.3, unchanged |
| Bun | 1.4.4 | 1.4.4, unchanged |

`bun install --frozen-lockfile` is a no-op against the committed lockfile (1,087 installs / 1,094 packages checked, no changes; `package.json`/`bun.lock` SHA-256 unchanged). `reactCompiler` and `cacheComponents` stay off — the effective config embedded in the fresh standalone `server.js` shows `"cacheComponents":false` and `"useCache":false`.

## Per-commit description (from `git show`)

**`a0ef4fb` — chore(deps): upgrade Next to 16.4.2 and React to 19.3.1** (3 files: `package.json`, `bun.lock`, `lib/i18n/testRender.tsx`). Applies the exact package table above with a Bun-1.4.4-regenerated lockfile, retaining the sharp 0.35.5 override, all typescript-eslint overrides, next-intl, the standalone launcher, tracing includes and the disabled compiler/cache flags. The only source edit supplies the new required `AppRouterInstance.bfcacheId: "test"` field in the i18n test-router fixture — without it, the upgraded Next types fail typecheck with TS2741. The commit body carries the full 35-advisory relevance summary (4 relevant surfaces, 4 conditional, 27 with no matching app condition; see "Advisory relevance" below). No production app, launcher, tracing or i18n code changes, and no build tsconfig workaround was needed.

**`6976e0a` — fix(calendar): compute reminder timestamps outside render** (2 files: `useEventReminderState.ts`, new `useEventReminderState.dom.test.tsx`, +126/−7). Implements the reviewed R5 fix from the hooks cleanup ledger — the one real purity bug among the new react-hooks 7.1 findings. Reminder timestamps now use a deterministic null clock for SSR/initial hydration, a first asynchronous tick, and one-second updates with timer cleanup, while persistence-time recurrence resolution is kept. Four new DOM tests cover event boundaries, recurring occurrences, hydration, StrictMode cleanup and click-time scheduling. This removes one purity diagnostic from the scoped-warning inventory (157 → 156 in combination with the next commit's warning cleanup).

**`81f5cc5` — fix(calendar): resolve set-state-in-effect in useCalendarConflicts** (2 files: `useCalendarConflicts.ts`, new `useCalendarConflicts.dom.test.tsx`, +88/−17). Fixes — rather than waives — the pre-existing `react-hooks/set-state-in-effect` error at `useCalendarConflicts.ts:58` that every previous stage carried as its sole lint error. Conflict snapshots stay scoped to the current account by adjusting state only on an account transition instead of clearing it in an effect; latest-request tokens, refresh signals and failure behavior are retained. Three new DOM regressions cover refresh ordering, account switch/back, stale completions, failures and cleanup. The fix also removes one existing exhaustive-deps cleanup-ref warning.

**`0b9e3be` — chore(lint): scope new react-hooks 7.1 rules to warnings pending cleanup** (1 file: `eslint.config.mjs`, +212/−1). Adds the reviewed temporary policy from the spike: 29 exact-file blocks / 37 rule-file pairs downgrade only the enumerated new hooks-7.1 findings to `warn`, owned by `umbau-thread` through 2026-11-15. Reminder purity and calendar-conflicts stay at error (both fixed in code by the two preceding commits), and all correctness/dependency rules (`rules-of-hooks`, `exhaustive-deps`) keep their existing severity. Result: ESLint exits 0 with 0 errors / 181 warnings — 156 scoped hooks findings (refs 57, preserve-manual-memoization 52, set-state-in-effect 40, purity 4, immutability 2, use-memo 1) plus 25 others (exhaustive-deps 22, no-img-element 2, one obsolete `OverflowTabsList` disable). The spike's expected 183 drops by one for the R5 purity fix and one for the calendar-conflicts warning cleanup. MailClient/ComposeOrchestrator refs remain reserved for Umbau cleanup after i18n 2b/3 + sender slice 3. Full inventory: [lint-react-hooks-cleanup.md](lint-react-hooks-cleanup.md).

**`4547815` — test(calendar): type fetch mocks with the bun-types preconnect field** (2 test files, +3/−3). Test-only typing fix so `bun check` (and `tsc` with `@types/bun`) accepts the two new DOM tests: `typeof fetch` requires the `preconnect` field, so the fetch mocks use the `Object.assign` pattern already used by the `ShellUserMenu.admin` and `LanguageSelector` tests. No production code changes.

## Gate table

All gates ran in this worktree at HEAD `4547815`, `nice -n 10`, `TMPDIR=$PWD/.tmp/next16/tmp`. Wall times are shell-measured (`date +%s` deltas); per-suite times in parentheses are the runners' own reports. Baselines are the round-8 validation at `11dc3c5` ([report.json](integration-stage-r8-validation-905c32f/report.json)) unless noted. Logs: `.tmp/next16/logs/` in the worktree.

| # | Gate (command) | Exit | Result (counts) | Wall | Baseline |
| --- | --- | --- | --- | --- | --- |
| 1a | `bun install --frozen-lockfile` | 0 | No changes; 1,087 installs / 1,094 packages; hashes unchanged | <1 s | no-op |
| 1b | `bun run typecheck` | 0 | **0 errors / 1,197 files** | 1 s | 0 errors |
| 1c | `bun run lint` | **0** | **0 errors / 181 warnings** (156 scoped hooks + 25 other) | 50 s | exit 1: 1 error / 25 warnings |
| 2 | `bun run test:ci` | 0 | **2,804 unit** / 15,275 assertions / 304 files (429.99 s); **469 DOM** / 2,721 assertions / 60 files (68.17 s); 0 fail | 500 s | 2,804 + 462, 0 fail |
| 3 | `bun run test:stress` (seed 1337, rerun-each 3) | 0 | **8,412 pass / 0 fail**, 45,825 assertions, 304 files (1,293.24 s) | 1,319 s | 8,412 / 0 fail |
| 4a | `rm -rf .next && bun run build` | 0 | Next 16.4.2 Turbopack; compile **21.0 s**, TypeScript **33.9 s**; standalone packaging OK | 60 s | pass (spike: 34.2 s / 45 s on `9424150`) |
| 4b | `bun build-scripts/verifyStandaloneWorkerBuild.ts` | 0 | "Verified worker runtime files in .next/standalone." | <1 s | pass |
| 4c | Launcher/layout inspection | — | Flat `.next/standalone/server.js` (exactly 1, maxdepth 1); sole launcher line `require('./noctua-server.mjs')`; `noctua-server.mjs` present | — | spike review item 1 |
| 5a | `bun scripts/checkGracefulShutdown.ts --port 3905 --data-dir …/noctua-data-deps-next16` (idle) | 0 | PID 2261994, **29 ms**, exit 0, forced=false | 1 s | spike 40 ms; lock-line 53–59 ms |
| 5b | Same, `--port 3906`, `NOCTUA_MAILBOX_WATCHER=1` | 0 | PID 2262174, **44 ms**, exit 0, forced=false; leases/queue 0/0/0, integrity ok | 2 s | spike 98 ms |
| 5c | Live idling watcher harness (r8 `watcher-shutdown.ts`, port 3915) | 0 | PID 2262307, watcher `idling` → SIGTERM **39 ms**, exit 0; state `stopped`; leases/queue 0, integrity ok | 2 s | spike 188 ms (heavier fixture) |
| 6 | Standalone locale matrix (r8 `locale-gate.ts`, port 3907) | 0 | **5/5** (table below), exit 0 | 2 s | 5/5 |
| 7a | `bun run test:auth-browser` (`AUTH_BROWSER_USE_BUILD=1 AUTH_BROWSER_PORT=3908`) | 0 | **20 passed** (7.6 m), 0 failed | 478 s | 19–20 passing |
| 7b | QA round-2 specs ×5 (`runQaShellBrowserTests.ts`, `QA_SHELL_PORT=3910`) | 0 | **11 passed** (compose 4, shell 4, admin 1, translation 1, unread 1) | 205 s | r8 qa-all pass (203 s) |
| 7c | htmlPrivacy (`bun test --config=bunfig.browser.toml`, port-swapped copy 3913/3912) | 0 | **1 pass / 177 assertions** (60.12 s) | 60 s | 177 |
| 7d | Security controls (`bash tests/runTeamAuthSecurityControls.sh`) | 0 | **156 pass / 0 fail**, 861 assertions, 5 files (75.22 s) | 76 s | ≥156 (r8: 156) |
| 8 | Main-route initial JS gzip (Node zlib, `route-bundle-stats.json`) | 0 | 664,843 → **643,779** bytes, **−21,064 (−3.17%)** | — | spike −21,130 (−3.31%) on `9424150` |
| 9a | `git merge-tree --write-tree 4547815 abf1b9e` (sender-identities-3) | 1 | **4 content conflicts** (pre-existing vs base; list below) | — | — |
| 9b | `git merge-tree --write-tree 4547815 d5ae17b` (sender-identities-2) | 0 | **Clean**, tree `a7e55e7` | — | — |
| — | Docker worker image (`verifyDockerWorkerImage.ts`) | — | **Not run: Docker unavailable** (`command -v docker` empty) | — | blocked in spike too |

Notes on deltas vs baseline: DOM tests grew 462 → 469 and DOM files 58 → 60 — exactly the two new test files (`useEventReminderState.dom.test.tsx`, 4 tests; `useCalendarConflicts.dom.test.tsx`, 3 tests). Unit counts are identical (2,804). Stress is byte-identical to the round-8 baseline (8,412 / 45,825). Lint improves from exit 1 (1 error) to exit 0. No gate needed a retry; no test was skipped, narrowed or relaxed.

## Shutdown-probe details

Probes loaded this worktree's `.env.local` unchanged (data dir `/home/monkey/code/noctua-mail/data/noctua-data-deps-next16`, created fresh by these probes). Missing Better Auth settings were supplied process-only: synthetic `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL=http://127.0.0.1:<port>`, `PASSKEY_RP_ID=127.0.0.1`, `BETTER_AUTH_TELEMETRY=0` — the deps-lock-line pattern; no env file was edited.

- **Idle (3905):** `{"pid":2261994,"port":3905,"exitCode":0,"signal":null,"durationMs":29,"forced":false}`. Health `/api/ba/ok` 200 before SIGTERM; shutdown hooks ran in order (`http:stop/drain`, background, auth-streams, admission, `db:close`); no listener remains.
- **Watcher-enabled CLI variant (3906):** same script with `NOCTUA_MAILBOX_WATCHER=1`. `{"pid":2262174,"port":3906,"exitCode":0,"signal":null,"durationMs":44,"forced":false}`; the `mailbox-watcher` hook appears in the shutdown sequence. Post-shutdown SQLite (`db/main.db`): `sync_worker_leases` 0, `sync_worker_queue` 0, `mailbox_watcher_lease` 0, `PRAGMA integrity_check` = ok. Caveat: the fresh `.env.local` data dir has no seeded mailbox, so this variant proves watcher-enabled startup/teardown but not a live IDLE drain — hence the third probe.
- **Live idling watcher (3915, r8 harness adapted):** synthetic IMAP fixture on OS-assigned ports (IMAP 39821, control 42547), seeded `synthetic-shutdown` mailbox in isolated `.tmp/next16/shutdown-watcher-data` (deleted after). The standalone watcher reached `watcherState='idling'`; SIGTERM completed in **39 ms**, exit 0, not forced; state afterwards `stopped`; `sync_worker_leases` 0, `sync_worker_queue` 0, `mailbox_watcher_lease` 0; integrity ok in both master and account DBs. Fixture stopped by the harness; no listener remains on 3915.

All three probes are far inside the 5 s forced-kill budget and consistent with the spike's 40/98 ms (the spike's 188 ms live drain carried two extra retrying workers from the auth suite; this run's fixture had none).

## Locale matrix (standalone, port 3907)

Production standalone artifact with `.next/static` + `public` copied in, `.env.local` data dir, synthetic auth env, PID 2262540, exit 0 on SIGTERM. Harness: r8 `harnesses/locale-gate.ts` adapted to port 3907 and this data dir (`.tmp/next16/locale-gate.ts`).

| # | Accept-Language | `noctua-ui-locale` cookie | Expected = observed `<html lang>` | Result |
| --- | --- | --- | --- | --- |
| 1 | de | none | de | 200, pass |
| 2 | en | none | en | 200, pass |
| 3 | en | de | de | 200, pass |
| 4 | de | en | en | 200, pass |
| 5 | en | invalid | en | 200, pass |

Each case also fetched its first static JS chunk (200). Every response carried `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate`. **5/5.**

## Browser / QA / htmlPrivacy / security results

- **Auth browser (`test:auth-browser`, port 3908, `AUTH_BROWSER_USE_BUILD=1`, `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-arm64`): exit 0, 20 passed (7.6 m), 478 s wall.** The runner seeds its own synthetic users/mailboxes, serves via `next start` on localhost:3908, and stops its own process group (sync-worker exit 143 lines in the log are the runner's group SIGTERM of `.invalid`-mailbox retry workers after the suite passed — expected, also present in the spike run). Baseline 19–20: at the top of range. No listener remains on 3908.
- **QA round-2 specs (r8 `qa-all.py` order, `QA_SHELL_USE_BUILD=1 QA_SHELL_PORT=3910 NOCTUA_MAILBOX_WATCHER=1 QA_ROUND2_FIXTURE=1`, fresh synthetic mailbox per spec via the tracked `scripts/runQaShellBrowserTests.ts` against the standalone artifact): all exit 0, 205 s wall.** `qa-compose.spec.ts` 4 passed (46.5 s), `qa-shell.spec.ts` 4 passed (20.6 s), `qa-admin-breakpoint.spec.ts` 1 passed (18.7 s), `qa-translation.spec.ts` 1 passed (39.7 s), `qa-unread-count.spec.ts` 1 passed (29.9 s) — 11 tests total, matching the r8 qa-all pass (203 s). IMAP fixture/SMTP ports are OS-assigned by the harness. No listener remains on 3910.
- **htmlPrivacy: exit 0, 1 pass / 177 assertions, 60 s.** The tracked test hardcodes ports 3798/3799, which are forbidden for this task (and 3795–3797 are occupied by other sessions). It was therefore run from a scratch copy with only the port literals swapped (3798→3913, 3799→3912); a reverse substitution diffs byte-identical against the tracked file, so no assertion changed. The copy lived at `tests/browser/htmlPrivacy.next16.test.ts` (same depth, so relative imports resolve; `bunfig.toml` ignores `tests/browser/**` in `test:ci`) and was deleted immediately after the run — `git status` confirms the tree is clean. The upstream invocation header in the file (`TMPDIR="$PWD/.tmp" PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-arm64 bun test --config=bunfig.browser.toml --timeout 120000`) was followed exactly, apart from the filename. Baseline 177 reproduced exactly.
- **Security controls (`bash tests/runTeamAuthSecurityControls.sh`, bubblewrap sandbox, no network ports): exit 0, 156 pass / 0 fail, 861 assertions, 5 files, 76 s.** Identical to the r8 baseline (156 / 861); baseline floor ≥156 met.

## Bundle delta

Method (spike/r8 `bundle.mjs`, run with **Node 24.22.1** — Bun's zlib gives different byte counts and must not be mixed in): read route `/` `firstLoadChunkPaths` from `.next/diagnostics/route-bundle-stats.json`, deduplicate, sum raw bytes and per-file `zlib.gzipSync(bytes, {level: 6}).length`. Initial JS only; excludes CSS, fonts, HTML/RSC and lazy chunks.

| Route `/` | Chunks | Raw bytes | Gzip bytes |
| --- | --- | --- | --- |
| Before (`11dc3c5`, `.tmp/bundle-before.json`) | 26 | 2,207,028 | 664,843 |
| After (`4547815`, `.tmp/bundle-after.json`) | 24 | 2,093,211 | 643,779 |
| **Delta** | **−2** | **−113,817** | **−21,064 (−3.17%)** |

The "before" capture was made by the previous agent on `11dc3c5` and found at `.tmp/bundle-before.json` (the task brief said `.tmp/next16/bundle-before.json`; a copy now sits at both paths, alongside `bundle-after.json`). The delta matches the spike's independent measurement on the older `9424150` tree (638,891 → 617,761; −21,130 / −3.31%) — same direction and magnitude, on a larger r8 baseline.

## Merge-tree results

Read-only, against `/home/monkey/code/noctua-mail/repo` object store. Both target branches share merge-base `9424150` (round-7) with this branch.

- **`4547815` × `abf1b9e` (feat/sender-identities-3): exit 1, 4 content conflicts** — `app/components/account-settings/tabs/PreferencesTabContent.tsx`, `lib/mail/resyncMessage.senderKey.test.ts`, `messages/de.json`, `messages/en.json`. Attribution check: `git merge-tree --write-tree 11dc3c5 abf1b9e` produces the **identical four conflicts**, and this branch touches none of those files. The conflicts are r8-integration ↔ sender-3 fallout, not caused by the dependency upgrade; the upgrade adds zero new merge risk against sender-3.
- **`4547815` × `d5ae17b` (feat/sender-identities-2): exit 0, clean merge**, resulting tree `a7e55e789170fbd6a44398b5c2d69eafbbdb6948`.

## Advisory relevance (summary of the spike brief's table)

Release floor **Next ≥16.4.1**; this branch ships **16.4.2**, closing all **35** upstream advisories fixed between 16.2.5 and 16.4.1 (12 + 1 + 9 + 2 + 1 + 7 + 3). Per-advisory rationale: [deps-next-16-4-spike.md](deps-next-16-4-spike.md), "Advisory relevance". Buckets against this app's inspected surface:

- **Relevant framework/developer surfaces (4) — closed by 16.4.2:** GHSA-8h8q-6873-q5fj / CVE-2026-23870 (RSC decoder DoS — the launcher delegates to `getRequestHandlers`, so RSC handling remains in play), GHSA-c4j6-fc7j-m34r / CVE-2026-44578 (WebSocket-upgrade SSRF — the custom server forwards all upgrades to Next), GHSA-h64f-5h5j-jqjh / CVE-2026-44577 (Image Optimization DoS — the default optimizer stays enabled even with no `next/image` imports), GHSA-39w2-rjm5-chcv / CVE-2026-94486 (dev-server MCP info disclosure — developer machines only; production runs `isDev:false`).
- **Conditional optimizer/shared-cache surfaces (4) — closed by 16.4.2 (incl. sharp 0.35.5):** GHSA-vfv6-92ff-j949 / CVE-2026-44582 and GHSA-wfc6-r584-vfw7 / CVE-2026-44576 (RSC cache poisoning — local responses are private/no-store, but downstream CDN behavior is unproven), GHSA-2xp9-vwfh-vxw4 (AVIF optimizer RCE) and GHSA-2464-fhr4-w9xw / CVE-2026-96889 (SVG optimizer RCE; the advisory's fix is the patched Next release forcing sharp ≥0.35.5, which this lockfile already resolves and retains via override). No attacker-controlled local AVIF/SVG source was established; absence of `next/image` UI usage is not an exemption.
- **No matching inspected app condition (27) — still fixed by the upgrade:** all middleware/proxy bypasses (no `middleware.ts`/`proxy.ts`; auth lives in route handlers), all Server-Actions issues (zero `"use server"` directives; empty action manifests; `__NEXT_PRIVATE_ORIGIN` pinned), Pages-Router/i18n-routing/SSG-ISR cache issues (App Router only, `i18n:null`, no ISR), `use cache`/Cache-Components issues including the October typed-array RCE GHSA-673q-mjm6-r5xr (cacheComponents off — verified in the new build's embedded config), rewrite SSRF (no rewrites), remote-image SSRF/DoS (`remotePatterns: []`), the `next/og` RCE GHSA-vcvr-r3jv-pc5j (icon `ImageResponse` inputs are deployment-controlled), and the Windows-only RCE GHSA-p293-qw3h-jr36 (Linux/glibc deployment). Staying on 16.2.4 would remain below the mandatory floor regardless of these exclusions.

## What could not be run, and why

- **Docker worker-image gate** (`bun build-scripts/verifyDockerWorkerImage.ts`, `bun run test:docker-workers`): **not run — no Docker on this host** (`command -v docker` empty), same blocker as the spike. Nothing was substituted for it: host standalone execution can fall back to ancestor `node_modules`, so it does not prove image self-containment. The host-side equivalents did pass (`verifyStandaloneWorkerBuild.ts` exit 0; the standalone server booted and served all probe/QA/auth traffic; the live watcher drained cleanly). **Release condition: run the Docker gate on a Docker-capable host before shipping.**
- **htmlPrivacy at its hardcoded ports**: the tracked test binds 3798/3799, outside this task's port allocation. Ran instead from a port-swapped scratch copy proven byte-identical modulo port literals (above). No tracked file was modified.
- Everything else in the gate list ran as specified. The r8 migration and German-320 harnesses were out of scope for this dependency branch (no schema/i18n-catalog changes in the diff) and were not rerun.

## Risks

- **156 deferred hooks findings.** The scoped warnings are a deliberate, owned deferral (umbau-thread, expiry 2026-11-15), not a clean bill: the ledger classifies a subset (notably render-time ref writes in MailClient/ComposeOrchestrator and related hooks) as real concurrency hazards. React Compiler must stay off until that cleanup lands. The two genuine bugs found by the new rules (reminder purity R5, calendar-conflicts effect) are fixed in this branch.
- **Docker image unverified.** Until `verifyDockerWorkerImage.ts` passes on a Docker host, standalone self-containment (notably sharp's libvips tracing under Next 16.4) is inferred from host runs, not proven.
- **Sender-identities-3 integration cost is unchanged, not zero.** Whoever integrates `abf1b9e` still resolves the same four conflicts (preferences tab, senderKey resync test, both message catalogs) against the r8 tree.
- **Framework-internal surface.** The owned launcher depends on `next/dist/server/lib/start-server` internals; the spike verified the consumed contract is byte-identical between 16.2.4 and 16.4.2, and this run's build/probes confirm it live — but each future Next bump must re-verify the exactly-one-import guard and shutdown behavior.
- Bundle savings (−3.17% initial JS gzip) are payload measurements, not load-time measurements.

## Files touched by the branch

`git diff --stat 11dc3c5..4547815` — 8 files, +485/−80:

```text
 .../calendar/useCalendarConflicts.dom.test.tsx     |  67 +++++++
 app/components/calendar/useCalendarConflicts.ts    |  38 ++--
 .../calendar/useEventReminderState.dom.test.tsx    | 113 +++++++++++
 app/components/calendar/useEventReminderState.ts   |  20 +-
 bun.lock                                           |  97 +++++-----
 eslint.config.mjs                                  | 213 ++++++++++++++++++++-
 lib/i18n/testRender.tsx                            |   2 +-
 package.json                                       |  15 +-
 8 files changed, 485 insertions(+), 80 deletions(-)
```

No changes to `next.config.ts`, `tsconfig.json`, `build-scripts/**`, `lib/server/**`, production i18n sources or message catalogs. Verification artifacts left in the worktree (untracked, `.tmp/` only): gate logs under `.tmp/next16/logs/`, adapted harnesses `.tmp/next16/locale-gate.ts`, `watcher-shutdown.ts`, `watcher-seed.ts`, and bundle measurements `.tmp/bundle-before.json`, `.tmp/bundle-after.json` (copies in `.tmp/next16/`). `TMPDIR` scratch (`.tmp/next16/tmp`) and the watcher fixture data were deleted. The shutdown/locale probes initialized `/home/monkey/code/noctua-mail/data/noctua-data-deps-next16` (fresh master DB with a bootstrap invite, no accounts) — the only `data/*` directory touched.
