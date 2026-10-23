# perf/rrule-lazy — verification brief

## Summary

- **Branch:** `perf/rrule-lazy` (worktree `wt-perf-rrule`), base `origin/integration/stage` `11dc3c5`.
- **Verified HEAD:** `122ca69` (3 commits: `66d0f5e`, `86c84f1`, `122ca69`).
- **Verdict: GO** at `122ca69` — `rrule` is out of every route's first load; all gates green / at baseline.
- **At the originally handed-off `66d0f5e` alone the verdict was NO-GO (partial):** `rrule` was still eager on `/` and `/message/window` via `lib/messageGrouping.ts` (see Defect). The two follow-up commits by the implementation agent fixed exactly that path during this verification.
- **Headline numbers (`/` route):** JS first load **669,487 → 653,712 B gzip (−15,775 B, −2.4 %)**; `rrule` now lives only in lazy chunk `0zw4k_8u5g478.js` (46,025 raw / 13,274 gzip, in no route's first load).
- This test agent changed **no source files** and made **no commits**.

## What changed (by file, `11dc3c5..122ca69`, 18 files, +547/−250)

Implemented in `66d0f5e` unless noted.

| File | Change |
| --- | --- |
| `lib/calendarRecurrenceSummary.ts` (new) | `buildCalendarRecurrenceSummary` + helpers moved verbatim out of `lib/calendar.ts`; sole `rrule` importer of the summary surface (`import { RRule } from "rrule"`). |
| `lib/calendar.ts` | Summary code and `rrule` import removed (−170 lines); `parseCalendarDate` now exported for reuse by the summary module. Parsing/formatting surface is `rrule`-free. |
| `lib/reminderDates.ts` (new) | Pure `normalizeReminderDateList` split out of `reminderRecurrence.ts` (no `rrule`). |
| `lib/reminderRecurrence.ts` | Imports/re-exports the normalizer from `reminderDates`; recurrence evaluation unchanged, still static `rrule` import. |
| `app/components/calendar/useLazyRecurrence.ts` (new) | `useRecurrenceSummaryBuilder` / `useNextReminderOccurrenceResolver`: dynamic-import the recurrence modules only when an event repeats; `null` until loaded; chunk failure resolves to `() => null`. |
| `app/components/mailclient/message/CalendarEventPreview.tsx` | Next-occurrence resolution via lazy resolver; preview stays on neutral loading state while unresolved for recurring invites. |
| `app/components/calendar/EventDetailView.tsx` | Recurrence summary via lazy builder; row omitted until loaded. |
| `app/components/mailclient/status/UpcomingStatusPopover.tsx` | Entry summaries via lazy builder; row omitted until loaded. |
| `app/components/calendar/useEventReminderState.ts` | `canScheduleReminder` is `false` until the lazy resolver lands (no guessing from series start). |
| `app/components/mailclient/useReminderNotifications.ts` | `await import("@/lib/calendarOccurrences")` only when a fetched event repeats; state set only after expansion. |
| `app/components/mailclient/utils/calendarReminders.ts` | `buildLocalReminder`/`applyLocalUpsert` now `async`; lazy `resolveNextReminderOccurrence` for recurring events only; normalizer imported from `reminderDates`. |
| `app/components/calendar/useEventDeleteState.ts` | Series truncation lazy-imported inside the delete action. |
| `app/components/mailclient/message/CalendarEventPreview.dom.test.tsx` (new) | DOM test: neutral loading first, then eager-identical summary (see Review). |
| `lib/calendar.test.ts` | Import of `buildCalendarRecurrenceSummary` repointed to new module. |
| `lib/inviteDeckGrouping.ts` (new, `86c84f1`) | `buildInviteDeckGroupKeyFromEvent` moved out of `messageGrouping.ts`; imports `reminderRecurrence` directly. |
| `lib/messageGrouping.ts` (`86c84f1`+`122ca69`) | No recurrence reference at all (initial re-export removed in `122ca69` — it still kept the chunk eager). |
| `lib/db/messages/query.ts` (`122ca69`) | Import line only: `buildInviteDeckGroupKeyFromEvent` now from `../../inviteDeckGrouping`. Server evaluation stays static/synchronous. |
| `lib/messageGrouping.test.ts` (`122ca69`) | Import repointed to `inviteDeckGrouping`. |

## Bundle before / after

Method: production build (`rm -rf .next && nice -n 10 bun run build`) + harness `briefs/perf-backlog-rerank-r8/measure.cjs` (copied to `wt-perf-rrule/.tmp/rrule/measure.cjs`, only output path retargeted), same as the rerank-r8 methodology. "Before" is `briefs/perf-backlog-rerank-r8/bundle-summary.json` measured on `11dc3c5`. "66d0f5e" column is from the implementation agent's preserved measurements (`.tmp/rrule/measurements.prior-agent.json`), re-analyzed with their `analyze.mjs`. "After" is this agent's build+measure at `122ca69`.

### Route first-load JS (gzip bytes; raw in parentheses)

| Route | Before `11dc3c5` | `66d0f5e` | After `122ca69` | Δ gzip vs before |
| --- | ---: | ---: | ---: | ---: |
| `/` | 669,487 (2,207,028) | 668,312 (2,206,312) | **653,712 (2,156,215)** | **−15,775** |
| `/message/window` | 460,526 (1,513,116) | 460,112 (1,513,080) | 445,743 (1,462,917) | −14,783 |
| `/compose/window` | 433,720 (1,418,354) | 433,729 (1,418,354) | 433,729 (1,418,354) | +9 (noise) |
| `/calendar/window` | 374,915 (1,247,909) | 360,018 (1,197,649) | 360,018 (1,197,649) | −14,897 |
| `/calendar/import` | 210,442 (703,868) | 195,749 (654,159) | 195,749 (654,159) | −14,693 |
| `/reset-password` | 208,439 (683,403) | 208,439 | 208,439 (683,403) | 0 |
| `/_not-found` | 186,759 (628,281) | 186,759 | 186,759 (628,281) | 0 |

Window routes did not grow: `/compose/window` +9 B gzip (it never contained `rrule`); the others shrank by ~14.7–14.9 KB gzip. `/calendar/window` and `/calendar/import` already reached their final size at `66d0f5e`; `/` and `/message/window` only at `122ca69`.

### `rrule` chunk location

| State | Chunk | Raw / gzip | In first load of |
| --- | --- | ---: | --- |
| Before `11dc3c5` | `0-2~3usm75doz.js` | 57,208 / 16,969 | `/`, `/message/window`, `/calendar/window`, `/calendar/import` |
| `66d0f5e` | `0zw4k_8u5g478.js` | 46,025 / 13,274 | `/`, `/message/window` (defect) |
| After `122ca69` | `0zw4k_8u5g478.js` | 46,025 / 13,274 | **none — lazy only** |

Independent corroboration beyond the harness's string attribution, at `122ca69`: the `rrule`-specific strings `BYSETPOS` and `Invalid frequency` occur **0 times** across all 24 `/` first-load chunk files (from `.next/diagnostics/route-bundle-stats.json`) and are present in lazy chunk `0zw4k_8u5g478.js`. The chunk is now reached only through the five dynamic-import sites (`useLazyRecurrence` ×2, `useReminderNotifications`, `calendarReminders`, `useEventDeleteState`).

## Gates

All commands in `wt-perf-rrule` with `export TMPDIR=$PWD/.tmp/rrule/tmp` and `nice -n 10`. Walls are shell wall seconds on a heavily loaded shared box (load ≈ 25) — compare counts/exits, not walls.

| Gate | Command | At | Exit | Result | Wall |
| --- | --- | --- | ---: | --- | ---: |
| Typecheck | `bun run typecheck` | `66d0f5e` | 0 | No errors, 1,198 files | 2 s |
| Typecheck | `bun run typecheck` | `122ca69` | 0 | No errors, 1,200 files | 1 s |
| Lint | `bun run lint` | `66d0f5e` | 1 | 1 error + 25 warnings = baseline; sole error pre-existing `useCalendarConflicts.ts:58` (untouched); 0 problems in branch files | 62 s |
| Lint | `bun run lint` | `122ca69` | 1 | Same: 1 error + 25 warnings; 0 in grouping/branch files | 62 s |
| Tests | `bun run test:ci` | `66d0f5e` | 0 | Unit **2804 pass / 0 fail** (304 files, bun 735.07 s), DOM **463 pass / 0 fail** (59 files, bun 79.52 s) — baseline 2804+462, +1 new DOM test | 876 s |
| Tests | `bun run test:ci` | `122ca69` | 0 | Unit **2804 pass / 0 fail** (304 files, bun 542.31 s), DOM **463 pass / 0 fail** (59 files, bun 74.91 s) | 630 s |
| Build | `rm -rf .next && bun run build` | `122ca69` | 0 | Production build OK (route table complete); HEAD/tree verified stable before+after | 86 s |
| Workers | `bun build-scripts/verifyStandaloneWorkerBuild.ts` | `122ca69` build | 0 | "Verified worker runtime files in .next/standalone." | <1 s |
| Merge check | `git -C repo merge-tree --write-tree 66d0f5e origin/integration/stage` | — | 0 | Clean (tree `e91496a…`) | — |
| Merge check | `git -C repo merge-tree --write-tree 122ca69 origin/integration/stage` | — | 0 | Clean (tree `a139cf9…`) | — |

Notes: three earlier build attempts (mixed HEADs) failed with `ENOENT … .next/…` because the implementation agent was concurrently building in the same worktree (mutual `rm -rf .next` races, confirmed via process table) — environment contention, not a code defect. `origin/integration/stage` is still `11dc3c5`, so both merge-trees are against the branch base (trivially clean, fast-forward shape).

## Review findings (diff correctness)

1. **Server paths unchanged (pass).** Static `rrule` importers before/after are identical except the intended move `lib/calendar.ts` → `lib/calendarRecurrenceSummary.ts`: `lib/reminderRecurrence.ts`, `lib/fullcalendarRecurrence.ts`, `lib/inviteDeckEventBounds.ts`, `lib/calendarSeriesTruncation.ts` untouched. No `app/api` or `lib/mail` file imports `rrule` directly in either revision; server consumers reach recurrence via `lib/db/calendar/reminders.ts` and `lib/db/messages/{query,_shared}.ts`, which keep static synchronous imports (`normalizeReminderDateList` re-export preserves the old specifier; `buildInviteDeckGroupKeyFromEvent` changed import line only). Summary code moved verbatim (same helpers, same `toText()`/UNTIL/COUNT handling); `lib/calendar.ts` consumers (`parseIcsInvite`/`parseIcsEvents`/formatters in IMAP sync, CalDAV, invite processing) are unaffected.
2. **No flash of wrong state (pass).** `CalendarEventPreview` extends its existing loading state while the resolver is in flight (grouping by the raw series start is computed but never rendered); `EventDetailView`/`UpcomingStatusPopover` omit the recurrence row until the builder loads; `useEventReminderState` reports "cannot schedule yet" (`false`); `useReminderNotifications` only calls `setUpcomingCalendarEvents` after the awaited expansion; `useLazyRecurrence` resolves chunk failure to `() => null` — the same outcome callers already handle for unparseable rules, so nothing can stick in loading.
3. **Reminders still fire (pass).** Firing is driven by `pendingCalendarReminders` (server-computed `triggerAtMs` via the static DB path) through `processDueCalendarReminders` + service-worker sync — untouched. The lazy changes affect only (a) upcoming-events display expansion (awaited before state is set) and (b) the optimistic local upsert's next-occurrence (awaited; on chunk failure it falls back to series-start trigger and the server recomputes on sync). Non-recurring paths never load the chunk and are byte-identical.
4. **New DOM test (pass).** `CalendarEventPreview.dom.test.tsx` computes the expected summary eagerly via direct static imports (`resolveNextReminderOccurrence` + `buildCalendarRecurrenceSummary` at the next occurrence), asserts the neutral `Loading event preview…` state with neither the series-start nor the expected summary present, then `waitFor`s the exact eager string and asserts the series-start summary never appears. It also guards the interesting property `next.eventStartAtMs !== series start`. Green in both `test:ci` DOM runs (463 = 462 baseline + this test).
5. **Defect found during verification (fixed upstream of this brief, not by this agent).** At `66d0f5e`, `lib/messageGrouping.ts` statically imported `resolveCurrentOrNextOccurrence` from `reminderRecurrence` for the server-only `buildInviteDeckGroupKeyFromEvent`; client modules import only grouping constants from that module, but Turbopack kept the dependency, leaving `rrule` eager on `/` + `/message/window` (chunk unchanged 46,025/13,274). The implementation agent fixed it in `86c84f1` (split into `lib/inviteDeckGrouping.ts`) and `122ca69` (removed the re-export, which alone still kept the graph alive; server caller imports directly). This agent independently traced the same root cause from the `66d0f5e` measurements before those commits landed and made no source change, per task rules (fix was outside the handed-off file set).

## Risks

- **Chunk-load failure degradation (low, by design):** recurrence summaries render as omitted/`null`, local reminder trigger falls back to series start until server sync recomputes, an upcoming-events refresh is skipped (retried next poll). No wrong data is displayed and nothing wedges in loading, but a persistently failing chunk (e.g. stale deploy) silently loses recurrence text.
- **Latency/CLS (low):** recurring invite previews wait for the lazy chunk in loading state; detail/popover recurrence rows pop in one row when it lands.
- **Bundler fragility (medium, process):** the `86c84f1` re-export experiment proved Turbopack keeps the `rrule` graph alive through a bare re-export. The invariant "`lib/calendar.ts` and `lib/messageGrouping.ts` stay recurrence-free" is currently enforced only by comments. A bundle guard in CI (assert no `rrule` strings in `/` first-load chunks) is a recommended follow-up; not added here.
- **Test time-sensitivity (negligible):** the new DOM test samples `Date.now()` for the eager reference separately from the component's mount time; a flake would require crossing a 2-week occurrence boundary mid-test.
- **Verification environment:** shared box at load ≈ 25 with many parallel agents; a second agent was actively committing/building in this worktree during verification (HEAD moved `66d0f5e` → `122ca69`, three build races). Final build/gates were (re)run with HEAD and clean tree verified immediately before and after each command.

## Files touched

Branch diff `11dc3c5..122ca69`: 18 files (+547/−250) — listed per file in "What changed" above. By this test agent: only scratch under `wt-perf-rrule/.tmp/rrule/` (logs, `measure.cjs` copy, `measurements.json`, `bundle-summary.json`; prior agent's artifacts preserved as `*.prior-agent.*`) and this brief. No commits, no push/merge/rebase/stash. No server started; `data/*` untouched.
