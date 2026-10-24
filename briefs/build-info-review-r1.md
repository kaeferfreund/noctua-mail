# Build info in the status bar: review r1 (feat/build-info)

Reviewer: independent, read-only. Worktree `wt-build-info` at `6307539` (base `98b4301`, 4 commits). No tracked files changed, nothing committed or pushed. A previous review run was cancelled before it wrote a report. This review started over: its screenshots in `build-info-evidence/` were deleted and regenerated, and its scratch was discarded.

## Verdict: FIX

One P2 in the branch (F1, a layout regression from `6307539`). One P2 outside the branch (F2, `ops/deploy-dev.sh`). The rest are P3 or notes.

F1 only affects the branch as reviewed. On `deploy/dev-stage` (live preview), a864dfc removes the bottom bar and the merge `2136d48` drops the CSS rule. The live preview therefore does not show F1. F2 does affect the live preview.

## Findings

### F1 (P2): during a sync the fixed bar sections no longer wrap, which pushes Kalender, Fehler and Bevorstehend out of the bar

- **Where:** `app/globals.css:1060` (`.bottom-bar > .bottom-section:not(.bottom-wide) { flex-shrink: 0; white-space: nowrap; }`, added in 6307539).
- **Cause:** the process trigger (`app/components/mailclient/status/ProcessStatusPopover.tsx:168`) has variable-length text and is caught by this rule. While a sync runs, its value is for example `„Posteingang“ wird synchronisiert (Synchronisierung der letzten Nachrichten, 42 %) …` (`Shell.status.syncingScope` + `modes.recent`). That is about 540 px. The section can neither shrink nor wrap, so the following sections are moved past the bar's right edge. An ancestor clips them (`docOverflow` 0), so they disappear.
- **Reproduction:** production standalone, de, Berlin. Put the real German sync string into the process value, then measure the bar.

| Width | Branch: bar overflow | Buttons beyond the bar edge | Base CSS (98b4301 rule state): bar height, overflow |
| --- | --- | --- | --- |
| 1024 | 240 px | Kalender (partly), Fehler, Bevorstehend | 75 px, 0 |
| 1152 | 112 px | Bevorstehend | 59 px, 0 |
| 1280 | 0 (exactly fits) | none | 59 px, 0 |
| 1440 | 0 | none | 42 px, 0 |

  A longer folder name, or a second process row joined with ` · ` (thread or category recompute), also pushes 1280 px over. Without injected text, the real initial sync in the fixture already overflowed by 36 px at 1024 (24 px without build env). So the overflow does not depend on the build label.
- **Evidence:** `review-sync-text-de-{1024,1152,1280,1440}-branch.png` against `…-base-css.png`.
- **Impact:** for the duration of a sync (minutes to hours on a first sync), the error indicator and the upcoming section are invisible and cannot be clicked. That is exactly when sync errors appear.
- **Suggested fix:** keep the rule for the short fixed sections, but let the process trigger shrink: `min-width: 0` with an ellipsis on its value, like the existing `.bottom-wide .bottom-item` rules. Its `title` already carries the full text. Alternatively, give the process section the same treatment as `bottom-wide`. Then re-measure 1024/1152/1280 during a sync.

### F2 (P2, outside the branch: `ops/deploy-dev.sh:14-17`): the runtime build env is written before the build. A later restart can pair the new hash with the old build, and that triggers a reload dialog that does not go away

- **Mechanism:** `deploy-dev.sh` writes `ops/build-info-dev.env` before `bun install` and `bun run build`. The `noctua-dev` unit loads that file (`EnvironmentFile=-…/build-info-dev.env`, `Restart=on-failure`).
- **When the env stops matching the build:**
  - The build fails. Then any later restart (crash with `on-failure`, a manual restart, a reboot) runs the old standalone with the new hash and time.
  - `--build-only` is used. It writes the env file but leaves the unit untouched.
  - A crash restart happens mid-build. The standalone dir is rewritten in place.
- **Reproduced consequence:** scenario `public`: the build-time label `6307539b0f0a | 2026-10-25 00:30 UTC` in `public/build-version.json`, with different runtime build env. Every page load then shows the modal "Neuladen erforderlich … Neue Version: 6307539b0f0a | 2026-10-25 00:30 UTC". At the same time, the status bar shows the runtime stamp `23.10.2026, 15:16`. Reloading does not clear it, because `useReminderNotifications.ts:105-128` compares the page's runtime `buildVersionLabel` with `/api/version`, and `/api/version` reads the build-time file. In addition, BuildInfo then shows a build that is not the one running.
- **Suggested fix:** pick one of these:
  - (a) Write the env file only after the standalone is assembled and only when restarting (not with `--build-only`).
  - (b) Preferred: read the build identity from the build artifact rather than from the runtime env. Extend `public/build-version.json`, which `generateBuildVersion.ts` already writes at build time, with `hash` and `builtAt`, and have `getBuildInfo()` read it. Then the display and the `/api/version` comparison use one source, and no runtime env file is needed. (b) also fixes F3.

### F3 (P3): with build-time env only, nothing is shown, so the `NEXT_PUBLIC_*` "fallback" does nothing for Docker images

- **Where:** `lib/buildVersion.ts:54-55`, `Dockerfile:18-21`.
- **Observed:** scenario `none` built with `NOCTUA_BUILD_*` exported and ran without env. Result: no `.bottom-build` and no sidebar label. `getBuildInfo` reads `process.env` dynamically, so Next does not inline anything. The Dockerfile sets `NEXT_PUBLIC_BUILD_*` only in the builder stage, so a CI image shows neither BuildInfo nor the sidebar label at runtime. This was already true for the sidebar label before this branch. The fix in F2 (b) resolves it.
- **Related nit:** `??` treats an empty `NOCTUA_BUILD_HASH=` as set, which blocks the `NEXT_PUBLIC_*` fallback. Scenario `emptyNoctua` rendered nothing. This matches the old label behaviour; worth knowing for EnvironmentFiles.

### F4 (P3): at 1024 px the build time is cut off when idle

`.bottom-build` shrinks to 115 px at 1024 × 768, showing `Build 6307539 · 25…` (`review-runtime-de-1024-bar.png`). The time, which is the point of the request, is visible only in the tooltip. The sidebar label is truncated too (`6307539b0f0a | 2026-10-25 00:30…`). At 1280 and 1440 px the full label fits (196 px).

### F5 (P3, existing before this branch, relevant because the trigger is now a first-class button): calendar panel keyboard flow and focus return

- **Where:** `app/components/calendar/CalendarPopover.tsx:287-298, 356-367`.
- **What passes:**
  - The trigger is a `button` named "Kalender öffnen" / "Open calendar" with visible text "Kalender" / "Calendar", so the name contains the label.
  - `aria-expanded` toggles false → true → false.
  - Mouse open/close works.
  - Shift+Tab → "Prozesse", Tab → trigger, with a solid 1 px focus outline.
  - Enter opens the panel.
- **What fails:**
  - Escape does not close the panel (`aria-expanded` stays true).
  - After Enter, Tab moves to "Fehler" in the bar, not into the panel, because the panel is portalled to the end of the document.
  - Closing with the panel's close button leaves focus on `body`, not on the trigger.
  - The panel heading and buttons are hard-coded English ("Calendar", "Close calendar", …), which the implementer already noted.
- **Assessment:** this is a follow-up, not a regression. a864dfc no longer renders `CalendarPopover` in the bar.

### F6 (P3): test gaps

`BuildInfo.dom.test.tsx` is meaningful:
- It covers the DST change on 2026-10-25 (00:30Z and 01:30Z both give 02:30), the en/de formats, the tooltip, an undated build, and null.
- It passes under `TZ=America/New_York`, and `buildVersion.test.ts` passes under `TZ=Asia/Tokyo`, so the explicit zone really is under test.

Not covered:
- No test pins the `BottomStatusBar` wiring (`!isMobile`, `buildInfo` passthrough) or the translated trigger name.
- `parseBuildTime` accepts calendar-invalid dates that `Date.parse` rolls over: `2026-02-30T10:00:00Z` gives `2026-03-02T10:00:00Z`. The test name "not a date-time" suggests these are rejected. This is negligible for machine-written stamps.

### Note: report accuracy

The implementer report says the label "is server-rendered from the first paint". The server HTML contains no `bottom-bar` or `bottom-build`. The status bar is rendered on the client, and its value comes from the server props (RSC payload). So the value does reflect the running server, and there is no shift within the bar: the label is present in the bar's first client render, and Prozesse, E-Mail-Abruf and Kalender sit at 304, 412 and 539 px with or without build env. But the reason is not SSR.

## Sidebar label vs BuildInfo (requested assessment)

**Current state:** the sidebar header (`ShellSidebar.tsx:192-198`) shows `getBuildVersionLabel()`: 12-character hash, minute stamp in the server's local zone. BuildInfo shows the 7-character hash with Berlin time. With the review build time `2026-10-25T00:30:00Z`, one screen shows `2026-10-25 00:30 UTC` (sidebar) and `25.10.2026, 02:30` (bar): see `review-runtime-de-1280x720.png`. The sidebar label also has a latent defect that existed before this branch. `appendShortTimeZone` (`lib/buildVersion.ts:46`) appends the host's current zone name to a UTC time: `TZ=Europe/Berlin` gives `2026-10-23 15:06 GMT+2` for a 15:06 UTC stamp. It also changes across DST, and that would change the `/api/version` comparison key on Berlin-zoned hosts.

**Recommendation:** drop one display and keep one formatter.
- **Display:** render `<BuildInfo/>` in the sidebar header in place of the raw label text. On `deploy/dev-stage` that is the only build information visible at a glance, because a864dfc removed the bottom bar and BuildInfo now sits in the status popover footer.
- **Version key:** keep `buildVersionLabel` only as the internal `/api/version` comparison key (and at most in a `title`), not as visible text.
- **Popover footer:** with the sidebar showing BuildInfo, it can go. If it stays, it uses the same component.

## Gates (HEAD 6307539)

All `bun test` runs used `env -u CLAUDECODE -u AGENT -u REPL_ID`.

| Gate | Result |
| --- | --- |
| `bun run typecheck` | 0 errors, 1,247 files |
| `bun test lib/buildVersion app/components/mailclient/status/ app/globals.test.ts lib/i18n` | 105 pass / 0 fail (10 files, includes the de/en catalog parity tests) |
| `BuildInfo.dom.test.tsx` (`--config=bunfig.dom.toml`) | 5/5; also 5/5 under `TZ=America/New_York`; `buildVersion.test.ts` 9/9 under `TZ=Asia/Tokyo` |
| eslint, the 8 touched TS/TSX files | 0 errors. Warnings: MailClient.tsx 73 (= base 73, checked by linting the 98b4301 blob), none on changed lines; all other files 0 |
| Production build | `bun run build` with `NOCTUA_BUILD_HASH=6307539…`, `NOCTUA_BUILD_TIME=2026-10-25T00:30:00Z` (DST edge); rc 0; `ƒ /` dynamic. Standalone assembled like `deploy-dev.sh` |
| Standalone runs (port 3900, synthetic fixture data, Playwright Chromium) | see the scenario list below |

**Standalone run scenarios:**
- **`runtime` (runtime `NOCTUA_BUILD_*`):**
  - de/Berlin, 1280: `Build 6307539 · 25.10.2026, 02:30`, title `Commit 6307539b0f0ab265fe9365e2b5672be9b475a7e9, gebaut 2026-10-25T00:30:00Z`.
  - en-GB/New_York, 1280: `Build 6307539 · 25/10/2026, 02:30`.
  - de/Tokyo, 1024: same string as de/Berlin.
  - Bar 28 px, no overlaps, no overflow when idle.
  - Phone 390 × 844: no `.bottom-build` (by design). The menu has "Kalender", the sheet opens, and Escape returns focus to "Aktivität und Kalender".
- **`none` (built with env, run without):** no `.bottom-build`, no sidebar label, bar 28 px, same left positions.
- **`public` (runtime `NEXT_PUBLIC_*` only):** BuildInfo shows the `NEXT_PUBLIC` value (`23.10.2026, 15:16`). Because that differs from the build-time file, the blocking reload dialog appeared (F2).
- **`emptyNoctua` (`NOCTUA_BUILD_HASH=""` + `NEXT_PUBLIC_*`):** nothing rendered (F3 nit).
- **Console:** no errors and no hydration warnings in any desktop or phone context. The only entries were the app's own `[noctua][sync]` warnings.

## Screenshots (`briefs/build-info-evidence/review-*.png`, all ≤ 100 KB)

- `review-runtime-de-1280x720.png`, `review-runtime-en-1280-nyx720.png`, `review-runtime-de-1024x768.png`, `review-runtime-de-390x844.png`, `review-runtime-de-390x844-calendar.png`, plus `-bar` crops.
- `review-none-*` (same set, without build env).
- `review-sync-text-de-{1024,1152,1280,1440}-{branch,base-css}.png` (F1).

## Merge notes

- **In `2136d48`:** the deploy/dev-stage merge takes a864dfc's popover design and keeps BuildInfo as a popover footer (desktop) and a `DropdownMenuLabel` (phone). It also drops `.bottom-bar > .bottom-section` and `.bottom-build`. As a result, F1 does not reach the stage.
- **Visibility:** the user's request (see at a glance when the preview was rebuilt) is no longer met by the popover footer alone. See the recommendation above: show BuildInfo in the sidebar header.
- **Unused after the stage merge:** `triggerTitle` and `Shell.status.openCalendar`, because `CalendarPopover` has no caller there.
- **Before relying on the display on the preview:** fix F2 in `ops/deploy-dev.sh`, or move to the build-artifact source.

## Cleanup

- `public/build-version.json` restored with `git checkout -- public/build-version.json`.
- `.next` removed.
- `.tmp/review` removed, along with the previous run's scratch (`.tmp/review-prev`) and the Playwright and compile caches.
- No server on 3900–3904.
- `git status` clean.
