Delivered on `perf/client-startup-v2`, head `18b6a5bbe10a8151f4c23ce109365e90b8e4f76f`, based on `81e5484`, exclusively in `/home/monkey/code/noctua-mail/wt-perf-startup`. Three commits replace the original three-commit implementation. The old `perf/client-startup` remains at `d765959b04d35f95585cc7c070b171b4a1976706`. No push, merge, PR, deployment, stash, or other branch/worktree modification was performed. Final worktree status and `git diff --check` are clean.

The final diff contains neither `ComposeOrchestrator.tsx` nor `sendMailRace.dom.test.tsx`, and no other protected file. Every individual new commit also avoids those files. Both original protected files are byte-identical to `81e5484`. `ComposeFields.tsx` is also unchanged in the final delivery.

The relocation keeps `useComposeController.openCompose` synchronous. Its caller immediately applies prefill, restored detached-compose semantics, and hydrated attachments; deferring controller initialization would reorder those updates. The controller instead starts the cached converter load at open time. A small `useSyncExternalStore` subscription announces converter readiness. `ComposeMessageField` renders a loading status until readiness, then mounts the original message editor and synchronous conversion tabs. A failed chunk load offers Retry and remains retryable in the loader. Recipient and subject fields remain interactive while body tools load.

The protected orchestrator also requests a payload unconditionally during render to calculate draft status. Until converters are available, the controller returns an empty, render-only status snapshot and does not call the real content builder. This snapshot never reaches persistence: autosave returns before hashing/building content until readiness; manual draft save and handoff save await the loader; and send awaits the exported draft flush, which now waits for converters and then the save queue. The builder checks actual module readiness when invoked, so a send closure captured before loading still converts the real compose fields after its await. No pending-chunk fallback text or empty status snapshot is saved or sent.

Autosave also handles recipient/subject edits made before the first ready content hash: it seeds the baseline without consuming the dirty edit, then schedules the real save. Otherwise such an early edit could be lost when the delayed first baseline was initialized. Manual-save continuation checks account scope and compose-session versions after the new await. The internal discard path retains a queue-only flush, so discarding does not depend on downloading conversion tools. The synchronous converter facade still throws if misused before loading; production compose conversion paths are guarded before calling it.

These conversion/persistence guarantees remain strict for new, reply, reply-all, forward, edit, as-new and detached compose, because they share the controller, message field, autosave and draft manager. The unchanged orchestration, attachment and send-race tests remain green. Existing server email rendering continues importing the synchronous implementation directly.

The alias guarantee is explicitly relaxed as permitted by the brief: **opening compose requests aliases immediately, and the shared alias UI updates on arrival; aliases are not guaranteed to finish before To becomes interactive.** `useDraftManager` brings `ensureRecipientAliasesReady(apiFetch, activeAccountId)` forward in the compose-open effect. This uses the same fetch-function/account resource as the idle hook, preserving request deduplication, account isolation and local-edit precedence. The resource's accepted fetch input type was narrowed to path strings, matching the requests it actually performs and the draft-manager fetch contract, without wrapping or changing cache identity. `ComposeFields` has no fetch context, so strict alias blocking would require additional wiring through protected composition interfaces. Recipient autocomplete continues using its existing server endpoint; this change does not replace that behavior.

The accounts hook and its five DOM tests are byte-identical to the final original branch. Topic logic, idle scheduling, alias hook, and the five startup-request tests are also byte-identical to the original branch. Only the alias resource's input type and the location of the immediate compose trigger changed for relocation.

Both original lazy-compose tests now live in the new `composition/lazyComposeConversions.dom.test.tsx`, with a copied local render helper. The delayed-alias test now explicitly checks the relaxed guarantee: no eager read before compose, immediate read after open, shared alias snapshot/UI update after a held response, and no duplicate at idle. The HTML-draft regression still verifies actual Turndown-derived `text/plain` in autosave and SMTP payloads. Two additional tests cover recipient edits before cold body tools settle and Send clicked in the same synchronous turn as opening a prefilled composer. The cold-send test was also run alone in a fresh Bun process, verifying the pending-import assertions rather than relying on converters warmed by other test files.

Final verification, all expensive commands under `nice -n 10`:

- `bun run test:ci`: **1,706 unit pass, 0 fail** across 198 files; **69 DOM pass, 0 fail** across 13 files. Supplied baseline: 1,705 unit + 55 DOM. Logs: `/tmp/perf-startup-r2-test-ci.log`.
- Typecheck: **356 `error TS` diagnostics**, matching the required baseline. TypeScript itself exits 2 as expected; no new production diagnostics. Log: `/tmp/perf-startup-r2-tsc.log`.
- `bun run lint`: **1 existing error / 27 existing warnings**, unchanged. Existing error: `app/components/calendar/useCalendarConflicts.ts:58`, state update inside effect. No diagnostics in changed files. Log: `/tmp/perf-startup-r2-lint.log`.
- Targeted final compose suites: **17 pass, 0 fail**; isolated cold-send run: **1 pass, 0 fail**, 3 filtered out. Logs: `/tmp/perf-startup-r2-focused-final.log` and `/tmp/perf-startup-r2-cold-send.log`.
- Exactly **one production build**, exit 0: Next.js 16.2.4 / Turbopack; compile 10.7 s; build TypeScript 22.4 s; 21/21 static pages generated. These are build timings, not load timings. Log: `/tmp/perf-startup-r2-build.log`.
- No install was needed: `package.json` and the lockfile are unchanged.

Final first-load JavaScript measurements:

- `/`: 21 first-load JS assets; 2,029,353 bytes raw; **600,770 bytes gzip**.
- `/compose/window`: 15 first-load JS assets; 1,244,204 bytes raw; **375,044 bytes gzip**.
- `/message/window`: 17 first-load JS assets; 1,364,382 bytes raw; **411,549 bytes gzip**.

The main-route gzip total is **600,770 bytes (600.770 decimal KB)**. These are final branch totals including the pre-existing `perf/client-assets` integration in `81e5484`. No separate `81e5484` baseline rebuild or isolated savings claim is made.

Measurement uses the original report's method: unique `firstLoadChunkPaths` from `.next/diagnostics/route-bundle-stats.json`, summing raw asset bytes and separately gzip-compressing each JS asset at level 6. HTML/RSC, the modern-browser polyfill asset, and future interaction chunks are excluded. The measurement script was copied to `/tmp/perf-startup-r2/measure.cjs`, preserving the original evidence in `/tmp/perf-startup/`.

Factory fingerprints from source strings/SSR source maps were intersected with eager asset membership on **all three routes**. All six groups have `eagerChunks: []` on each route: MarkdownPanel/viewer, unified, mdast/remark parsing, micromark CommonMark, the raw-HTML/parse5 7 pipeline used by rehype-raw, and Turndown. Verified factory groups: viewer `356729, 934838, 918789`; unified `175765, 541991`; mdast `713059`; micromark `98189, 69489, 109334, 431369, 35198`; raw pipeline `130562, 241631, 789213, 161505, 282643, 207026`; Turndown `715530`. The viewer loadable manifests list `0lvl0zhisiwa~.js` and `04-sewmv8ortl.js`, absent from eager route membership. The unrelated display sanitizer/parse5 8 remains eager. Evidence: `/tmp/perf-startup-r2/measurements.json`, `measurements-summary.json`, `parser-boundaries.json`, and `check-parser-boundaries.cjs`.

For the collab-ui integration owner: rebase your `ComposeOrchestrator.tsx` changes normally; this branch adds no orchestrator/context/action interface changes or send-ownership tokens. Preserve the existing `await flushPendingDraftSaves()` **before** `buildComposePayload()` in send. The exported flush now guarantees converter readiness as well as queue completion; bypassing it would bypass the send readiness boundary. Keep the centralized controller and body-field paths, and keep autosave readiness gating when refactoring them. `openCompose` resolves after synchronous field initialization, not necessarily after body tools or aliases have loaded; the loading status now belongs to the body field. Account-switch cancellation/hydration and operation-token ownership remain the other team's responsibility and were not modified here. Converter readiness is global module availability; alias data remains scoped to fetch identity/account.

A repeat check during implementation caught the old proposed whole-field gate hiding To longer than the unchanged race test allowed. The final design gates only body tools and preserves early envelope edits; the final targeted and full-suite runs above passed. No authenticated production-browser network trace, real SMTP send, or remote mailbox operation was performed; network behavior is verified with synthetic fixtures.

Exact final diff stat (`git diff 81e5484...perf/client-startup-v2 --stat`):

```text
 app/components/mailclient/RenderHelpers.tsx        |   6 +-
 .../composition/ComposeConversionBoundary.tsx      |  14 +
 .../mailclient/composition/ComposeMessageField.tsx |   7 +-
 .../composition/composeContentBuilder.test.ts      |   6 +-
 .../composition/composeTabSwitch.test.ts           |  22 +-
 .../lazyComposeConversions.dom.test.tsx            | 292 +++++++++++++++++++++
 .../mailclient/composition/useComposeController.ts |  16 ++
 .../composition/useComposeDraftAutoSave.ts         |  11 +-
 .../mailclient/composition/useDraftManager.ts      |  35 ++-
 .../composition/useMarkdownConverters.ts           |  25 ++
 app/components/mailclient/deferUntilIdle.ts        |   9 +
 .../mailclient/recipientAliasesResource.ts         |  77 ++++++
 .../mailclient/startupRequests.dom.test.tsx        | 116 ++++++++
 .../mailclient/useAccountController.dom.test.tsx   | 130 +++++++++
 app/components/mailclient/useAccountController.ts  |  75 +++---
 app/components/mailclient/useRecipientAliases.ts   |  71 ++---
 app/components/mailclient/useTopics.ts             |  35 ++-
 app/message/window/page.tsx                        |   7 +-
 lib/markdownConvert.test.ts                        |   6 +-
 lib/markdownConvert.ts                             | 148 +++--------
 lib/markdownConverters.ts                          | 128 +++++++++
 lib/markdownEmail.ts                               |   2 +-
 22 files changed, 1011 insertions(+), 227 deletions(-)
```

Exact commit list (`git log --oneline 81e5484..perf/client-startup-v2`):

```text
18b6a5b perf(compose): gate lazy conversions outside send orchestration
a9e4adc perf(startup): defer alias and topic count reads until idle
04af008 perf(accounts): reuse auth bootstrap accounts and stabilize initialization
```
