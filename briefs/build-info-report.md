# Build info in the status bar: report (feat/build-info)

Worktree `/home/monkey/code/noctua-mail/wt-build-info`, branch `feat/build-info`, base `98b4301`, HEAD `6307539b0f0ab265fe9365e2b5672be9b475a7e9`. Not pushed.

## Commits

| SHA | Subject |
| --- | --- |
| a5eb028 | feat(shell): show build commit and time in the status bar (predecessor) |
| b4d963f | fix(shell): translate the calendar trigger's accessible name |
| fa69197 | fix(shell): keep the build label in the status bar flow |
| 6307539 | fix(shell): keep the fixed status bar sections on one line |

## What the change does

- `lib/buildVersion.ts` `getBuildInfo()` reads `NOCTUA_BUILD_HASH` / `NOCTUA_BUILD_TIME` (with `NEXT_PUBLIC_*` fallback) on the server at render. It returns `null` when there is no hash. `/` is dynamic (`ƒ /` in the build output), so the running server's runtime env is what gets shown.
- `app/components/mailclient/status/BuildInfo.tsx` is self-contained (props `info`, `className`). It renders `Build <7-char sha> · <date>, <time>` in Europe/Berlin via `lib/i18n/format.ts` (de `23.10.2026, 17:06`, en `23/10/2026, 17:06`). The tooltip is `Commit <full sha>, gebaut|built <UTC ISO>`. It renders nothing without data.
- The desktop bottom bar shows the label where the live clock used to be. The clock had also been the calendar popover trigger, so the calendar now has its own trigger labelled "Kalender"/"Calendar".

## Fix-ups in this round

1. **Calendar trigger accessible name (b4d963f).** The trigger kept a hard-coded English `aria-label`/`title` "Open calendar". In German that overrode the visible "Kalender". `BottomStatusBar` now passes the existing `Shell.status.openCalendar` string ("Kalender öffnen" / "Open calendar") as a new `triggerTitle` prop, and the trigger has `aria-expanded`.
2. **The build label covered other triggers (fa69197).** The predecessor kept the label absolutely centred. Once "Kalender" joined the normal flow, the label overlapped other controls. Measured with synthetic data:
   - 1024 px: it covered "Kalender" and "Fehler".
   - 1280 px: it overlapped the "Bevorstehend" section (on its box, not its text).
   - 1440 px: it overlapped the section box by 1 px.

   Before-fix screenshots: `before-fix-bar-{1024,1280,1440}.png`. The label is now a normal flex item between the calendar and exception triggers. It truncates with an ellipsis on narrow bars, and the tooltip keeps the full value.
3. **Bar height at 1024 px (6307539).** With both items in the flow, "E-Mail-Abruf Inaktiv" wrapped onto three lines at 1024 px and the bar grew from 28 to 59 px (42 px with the predecessor's state). The fixed bar sections (`.bottom-bar > .bottom-section:not(.bottom-wide)`) now keep one line. The build label and the wide upcoming section take up the remaining width. Result: the bar is 28 px at 800, 1024, 1280 and 1440 px.

## Gates (HEAD 6307539 unless noted)

All `bun test` runs used `env -u CLAUDECODE -u AGENT -u REPL_ID`.

| Gate | Result |
| --- | --- |
| `bun run typecheck` | 0 errors (1,247 files), on b4d963f and fa69197; CSS-only change afterwards |
| Focused tests `lib/buildVersion.test.ts` + `status/` | 23 pass / 0 fail |
| `BuildInfo.dom.test.tsx` (`--config=bunfig.dom.toml`) | 5/5, three times in a row |
| `app/globals.test.ts` | 15 pass / 0 fail |
| `bun run test:ci` on b4d963f | rc 0; 2924 pass / 0 fail (316 files, 449 s) + DOM 568 pass / 0 fail (74 files, 81 s) |
| `bun run test:ci` on 6307539 | rc 0; 2924 pass / 0 fail (316 files, 432 s) + DOM 568 pass / 0 fail (74 files, 88 s). The predecessor's 2 `resyncMessage.senderKey` failures did not reproduce without CLAUDECODE. |
| `bun run lint` (b4d963f) | rc 0, 0 errors / 181 warnings (= documented baseline). Touched files: no warnings on changed lines; per-file counts match 98b4301 (MailClient.tsx 73 = 73, BottomStatusBar.tsx 0, CalendarPopover.tsx 0). Later commits change only a className in BottomStatusBar.tsx (eslint 0) and CSS. |
| `git diff --check 98b4301 HEAD` | clean |
| Production build | `bun run build` with `NOCTUA_BUILD_HASH=6307539b…` and `NOCTUA_BUILD_TIME=2026-10-23T15:06:18Z` exported; rc 0. Standalone assembled like `ops/deploy-dev.sh` (copied `.next/static` and `public`); run with `bun --bun server.js`, `NODE_ENV=production`, port 3900. |

## Browser evidence (production standalone, port 3900)

Setup: synthetic data in `data/noctua-data-build-info`, user `alex@example.test`, fixture IMAP/SMTP on OS-assigned loopback ports, Playwright Chromium, timezone Europe/Berlin.

**With build env:**
- de label: `Build 6307539 · 23.10.2026, 17:06`. Title: `Commit 6307539b0f0ab265fe9365e2b5672be9b475a7e9, gebaut 2026-10-23T15:06:18Z`.
- en label: `Build 6307539 · 23/10/2026, 17:06`. Title: `… built 2026-10-23T15:06:18Z`.
- Calendar trigger:
  - Role button, name "Kalender öffnen" / "Open calendar", visible text "Kalender" / "Calendar".
  - Mouse click opens and closes the panel (`aria-expanded` false → true → false).
  - Keyboard: one Tab from "Prozesse" reaches it, the focus outline is solid, and Enter opens and closes the panel.
- No overlap at 1024, 1280 or 1440 px, no horizontal overflow, bar 28 px. At 800 px the label shrinks to 0 width and the bar overflows by 21 px; without the build env it overflows by 9 px at 800 px.

**Without build env:**
- No `.bottom-build` element and no "Build" text in the bar. Bar 28 px; the calendar trigger works the same way.
- Process, mail-check and calendar keep their positions at 304, 412 and 539 px. The label is server-rendered from the first paint, so nothing shifts after hydration.

**`GET /api/version`:** `{"ok":true,"buildVersionLabel":"6307539b0f0a | 2026-10-23 15:06 UTC"}`. This value comes from `public/build-version.json`, which is generated at build time, so it is the same with and without the runtime env.

Files in `briefs/build-info-evidence/` (all PNGs ≤ 124 KB):
- `build-info-de-light-1440.png`, `build-info-de-dark-1440.png`
- `build-info-bar-de-1440.png`, `build-info-bar-de-1024.png`
- `no-build-env-de-light-1440.png`, `no-build-env-bar-de-1440.png`
- `before-fix-bar-{1024,1280,1440}.png`
- `results-with-build.json`, `results-no-build.json`

The scripts (runner, seed, spec) were scratch files in `.tmp` and were removed.

## Merge-tree notes (read-only)

- **integration/stage (tip e70c30b):** merges cleanly.
- **e7d00ee (feat/reader-focus):** conflicts in `MailClient.tsx`, `lazyAdmin.dom.test.tsx` and `playwright.qa-round2.config.ts`. The same three conflicts already occur between 98b4301 and e7d00ee (different merge bases), and the `MailClient.tsx` hunk is the import block at the top of the file, not the `buildInfo` lines. This branch adds no new conflict.
- **a864dfc (feat/status-bar-compact):** conflicts in `BottomStatusBar.tsx`, `globals.css`, `messages/de.json` and `messages/en.json`. Only `de.json` already conflicts from the base. a864dfc removes the desktop bottom bar (and `.bottom-bar` CSS) and moves status into a header Popover (desktop) or DropdownMenu (phone). How to resolve:
  - **`BottomStatusBar.tsx`:** take a864dfc's version. Add `buildInfo: BuildIdentity | null` to its props and import `BuildInfo from "./BuildInfo"`. Place it on desktop inside `<PopoverContent>` → `<Theme asChild><div className="space-y-3">`, as the last child after the `(["process", "mail-check", "exception", "reminder"]).map(...)` sections: `<BuildInfo info={props.buildInfo} className="block border-t border-border pt-3 text-xs text-muted-foreground tabular-nums" />`. BuildInfo returns null without data, so no empty border is left behind. On the phone, optionally add it at the end of `<DropdownMenuContent>` as a non-focusable `DropdownMenuLabel` after a `DropdownMenuSeparator`, only when `props.buildInfo` is set.
  - **`MailClient.tsx`:** it auto-merges and still passes `buildInfo`.
  - **`globals.css`:** drop both of this branch's rules (`.bottom-bar > .bottom-section:not(.bottom-wide)` and `.bottom-build`), because the bar no longer exists.
  - **Messages:** add `build`, `buildUndated`, `buildTitle` and `buildCommit` to a864dfc's restructured `Shell.status` (no name clashes there).
  - **Calendar trigger:** the `openCalendar` key and the `triggerTitle` prop become unused, because a864dfc no longer renders `CalendarPopover`. `CalendarPopover.tsx` auto-merges and has no caller there.

## Observations / open points

- The sidebar header (`ShellSidebar`, pre-existing) already shows the 12-character build label (`6307539b0f0a | 2026-10-23 15:06 UTC`), as the screenshots show. The status bar now shows the build a second time. Keeping both or dropping one is a product decision.
- The floating calendar panel still has hard-coded English strings: heading "Calendar", "Open in sidebar", "Open in window", "Close calendar", and the resize label. These predate this change and are not translated here.
- The trigger name fix is covered by the Playwright evidence run but has no committed unit or DOM test, because `BottomStatusBar` is replaced in a864dfc.
- At 800 px the bar is too narrow for all sections, with or without this change. The build label collapses to zero width there.

## Cleanup

- `public/build-version.json` restored with `git checkout`.
- `.tmp` and the `.next` build output removed.
- The assigned data dir was emptied.
- All servers and fixtures were started and stopped by the runner via process group; nothing is listening on 3900–3904.
