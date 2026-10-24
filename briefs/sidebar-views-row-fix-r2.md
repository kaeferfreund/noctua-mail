# Sidebar "Ansichten" rows - fix round 2

Branch `fix/sidebar-views-row`, worktree `wt-sidebar-views`. Not pushed.

## Commits

| Commit | What it does |
| --- | --- |
| `9ab0c65` | fix(shell): no view row tooltips in the phone sheet or collapsed sidebar |
| `031d070` | test(shell): run the phone-sheet and collapsed QA-014 cases separately |

Both sit on `94f1a31` (round 1), which sits on `98b4301`.

Touched files compared with round 1: `app/components/shell/ShellSidebar.tsx`, `app/components/ui/sidebar.tsx`, `app/components/shell/Shell.dom.test.tsx` and `tests/browser/ui/qa-shell.spec.ts` (+146 / -12 lines).

## Changes per finding

### F1 (P2): tooltip visible and clipped beside the phone sheet

Implemented option (a), scoped to the view rows.

- In `ViewRow`, `SidebarMenuButton` gets **no `tooltip` prop** when `isMobile` is true or `state === "collapsed"`. No Radix tooltip, no content and no `aria-describedby` are rendered there.
- On desktop the prop now passes `hidden: false` instead of `hidden: isMobile`.
  - Reason: `SidebarMenuButton` sets the icon-rail default `hidden={state !== "collapsed" || isMobile}`. Without an override, every expanded desktop tooltip would carry the `hidden` attribute. It shows today only because the preflight rule is missing.
  - With `hidden: false`, the view tooltips keep working if option (b) is adopted later.
- Trade-off of (a): on mobile the row has no accessible description. The old native `title` gave none on touch either. The badge's own `aria-label` is unchanged.

### F2 (P3): collapsed offcanvas, Shift+Tab reaches off-screen rows and opens a detached tooltip

- `app/components/ui/sidebar.tsx`: the desktop `sidebar-container` gets `inert` while `state === "collapsed" && collapsible === "offcanvas"`.
  - The shadcn sidebar itself only moves the container to `left: -width` in this mode. It does not make the content unfocusable.
  - `inert` is the smallest change in the component that owns the offcanvas positioning. It takes the off-screen content out of the tab order, pointer hit-testing and the accessibility tree.
- **Scope:** this applies to the whole collapsed sidebar, not only the view rows: mailbox rows, folder tree, topics and user menu. All of it is off screen in that state.
  - In-app notices are unaffected. `resolveNoticePlacement` already floats them over the panes while the sidebar is collapsed.
  - The mobile sheet and the expanded sidebar are unaffected.
- Second safeguard: `ViewRow` renders no tooltip while collapsed (see F1).
- Measured (German UI, 1440, collapsed): 13 × Shift+Tab from the toggle goes BODY → header and message-list controls. Focus never enters the sidebar, and no tooltip content exists afterwards (`r2-measurements.json`, `r2-light-1440-collapsed-shift-tab.png`).

### F3 (P3): QA-014 depended on test order and covered few badge rows

- **Robust when run alone.** After each `goto`, QA-014 waits until all 7 view rows have a badge, inside an `expect(...).toPass({ timeout: 90000 })`. An attempt that finds fewer than 7 reloads first, then polls for 10 s. This covers the fresh-fixture first load, which renders before the inbox row exists.
  - Run alone it took 36.2 s, compared with 14.6 to 19.0 s in full order. That points to the wait or reload path being used. The log does not count reloads.
- **All rows carry a badge.** The test routes wide synthetic counts, so every one of the 7 rows has one:
  - collaboration counts through `/api/me/mailboxes/summary`: assigned 3, unassigned 9111 → "9.1K", open 12345 → "12.3K";
  - virtual counts through the one-message count queries: focused 7, action queue 48, invite deck 2.
  - An init script holds `/api/me/events` open without events, so a live summary event cannot overwrite the routed counts mid-measurement. Other requests pass through unchanged.
  - The inbox count (21) is the fixture's real unread count.
- **New assertions:**
  - row order is exactly `inbox, assigned-to-me, unassigned, open, focused, action-queue, invite-deck`;
  - `withBadge.length === 7`;
  - the active row is the inbox.
  - The per-badge checks (inside the row box, label ends before the badge) now run on all 7 rows. Before, 3 to 5 rows were checked.
  - This runs in light and dark at 1440x900 and 1280x720.
  - Log on every pass: `"rows":7,"badges":["21","3","9.1K","12.3K","7","48","2"]`.

### Item 4: browser assertions for the phone sheet and collapsed mode

These are two new tests in `qa-shell.spec.ts`. They share the `QA-014:` prefix, so `-g QA-014` runs all three.

- **"QA-014: the phone sheet shows no view row description on hover or keyboard focus"** (390x844, sheet open):
  - the pointer rests on "Unassigned" (`:hover` confirmed), then 800 ms passes, which is longer than the 400 ms delay. Then: 0 `tooltip-content`.
  - Keyboard focus (`:focus-visible` confirmed), then 800 ms: 0 `tooltip-content`, and no `aria-describedby`.
- **"QA-014: the collapsed sidebar keeps its rows out of the tab order and shows no description"** (1440):
  - the container is `inert` and `right <= 0`;
  - programmatic `focus()` on a row does not move focus into the sidebar;
  - for 30 × Shift+Tab, focus never lands inside `sidebar-container`;
  - no tooltip content contains a view description.
- The DOM equivalent is in `Shell.dom.test.tsx`: "renders no view row description in the collapsed sidebar / phone sheet". It checks that the container is inert only when collapsed, that focus or pointer adds no `aria-describedby`, and that no tooltip appears after 500 ms.
  - **Verified to fail on the round-1 code:** the collapsed case fails on `inert` (expected true, got false), and the phone-sheet case fails on `aria-describedby` (expected false, got true).
- The new Playwright cases were not run against a round-1 build. The review evidence `review-de-light-mobile-*-tooltip.png` and `review-de-light-collapsed-shift-tab.png` shows the old behaviour.
- **Why the cases are split (`031d070`).** At first the phone and collapsed checks were one test. In the full suite that test failed once with `page.goto: net::ERR_ABORTED` after resizing 390 → 1440.
  - Cause: the open sheet owns a history entry (`useMobileOverlayHistory`). When the viewport turns desktop, the sheet unmounts and calls `history.back()`, which aborts the concurrent `goto`. This is app behaviour, not a defect of this change.
  - Each case now starts from its own page. No timeout or retry was changed.

## Orchestrator decisions applied

- **Active fill:** kept at `--iris-3`, the same as mailbox rows.
  - Light: active rgb(240,241,254), hover rgb(232,232,232).
  - Dark: active rgb(32,34,72), hover rgb(49,49,49).
- **Tooltip delay:** the views `TooltipProvider` now has `disableHoverableContent delayDuration={400} skipDelayDuration={150}`.
  - A pointer sweeping down the list opens nothing until it rests on a row for 400 ms.
  - Once one description is open, moving to the neighbouring row replaces it without a new delay.
  - Keyboard focus still opens at once (Radix opens on focus without a delay).
  - No stale text came back:
    - the QA-014 sequence Unassigned → Open → Focused shows exactly one tooltip with the hovered row's text, including the re-entry after the hover-fill check;
    - the DOM pointer-move test (three rows) passes.
  - `disableHoverableContent` is kept.

## Gates (all bun test / Playwright runs with `env -u CLAUDECODE -u AGENT -u REPL_ID`)

| Gate | Result |
| --- | --- |
| `bun run typecheck` | 0 errors, 1,244 files |
| Focused DOM tests: Shell (contains the ShellSidebar tests; there is no separate ShellSidebar test file), MobileFrames, useMailboxSummaries, InAppNoticeStack, 3 runs | 54 pass / 0 fail on each run (round 1: 52; +2 new cases) |
| `bun run test:ci` | 2915 pass / 0 fail (315 files) + DOM 565 pass / 0 fail (73 files), rc 0 |
| `bun run lint` | 0 errors, 181 warnings (same count as round 1). `eslint` on the 4 touched files: 0 errors, 0 warnings |
| `bun run build` | rc 0. Built from the app code of `9ab0c65`; `031d070` changes only the spec |
| `qa-shell.spec.ts` against the production build (`QA_SHELL_USE_BUILD=1`, port 3846) | 7 passed (QA-003/009, QA-004/009, QA-005, QA-011/012/013, QA-014 ×3) |
| `qa-i18n-views.spec.ts` against the same build (port 3846, harness copy under `.tmp` with only the config path changed) | 3 passed |
| QA-014 alone (`-g QA-014`) on a fresh fixture | 3 passed (36.2 s / 4.6 s / 4.6 s) |
| QA-014 alone on a scratch merge with `feat/status-bar-compact` (see below), own build, port 3848 | 3 passed |
| `git diff --check` | clean (both commits) |

Before the split, the full-suite run had 6 passed and 1 failed: the `ERR_ABORTED` described above. After the split all 7 passed.

## Merge-tree (`git merge-tree --write-tree HEAD <ref>`)

The refs have moved since the brief was written. Each brief SHA is an ancestor of the current tip, and both were checked.

| Ref | Result with HEAD | Result with base 98b4301 | Note |
| --- | --- | --- | --- |
| integration/stage `e70c30b` (brief) | clean, tree 37f899e | clean | No overlap. |
| origin/integration/stage `ab7a2f8` (current tip) | clean, tree cf107de | clean | No overlap. |
| feat/status-bar-compact `a864dfc` (brief) | conflict `messages/de.json` | same conflict | Pre-existing, not caused by this branch. a864dfc touches none of the files changed here. |
| feat/status-bar-compact `3c954a5` (current tip) | conflict `app/components/shell/Shell.dom.test.tsx` | clean | Caused by this branch, see hunk notes. |
| feat/reader-focus `e7d00ee` (brief) | conflicts `MailClient.tsx`, `lazyAdmin.dom.test.tsx`, `playwright.qa-round2.config.ts` | identical list | Pre-existing, unrelated. |
| feat/reader-focus `ed59980` (current tip) | clean, tree 2b994dd | clean | No overlap. |
| feat/build-info `6307539` | clean, tree c39149e | clean | No overlap. |

Per-hunk notes:

- **`3c954a5`, `Shell.dom.test.tsx`, conflict (1 hunk).**
  - Both sides add a parameter after `locale` in `renderSidebar`: this branch adds `sidebar: { open?, openMobile? } = {}`, 3c954a5 adds `buildInfo = null`.
  - Resolution: keep both, `buildInfo` first, then `sidebar`. Then change this branch's one 7-argument call (the collapsed/phone-sheet test) to `..., "en", null, { ... }`.
  - The rest of the file auto-merges: 3c954a5 changes `brand: { buildInfo }` and adds a new build-label test.
- **`3c954a5`, `ShellSidebar.tsx`, clean.** 3c954a5 changes the brand header (`BuildInfo`, the `brand.buildInfo` prop) and imports. This branch changes `ViewRow` and the views `TooltipProvider`. The hunks are separate.
- **`a864dfc` / `ee60d26`, `ui/tooltip.tsx`, clean.** `z-[9998]` becomes `z-(--layer-popper)`. There is no text overlap with this branch.
  - **Scratch merge:** HEAD plus `3c954a5`, which contains a864dfc and ee60d26, with the hunk above resolved as described, built under `.tmp` (port 3848).
    - typecheck 0 errors (1,251 files);
    - focused DOM tests 56 pass / 0 fail;
    - QA-014 alone 3 passed: view tooltip on top, inside the viewport, right of the row; all 7 badges inside.
  - The scratch copy was deleted afterwards.
- **`ui/sidebar.tsx`:** none of the refs change it since their merge base, so the `inert` change merges clean everywhere.

## Follow-up (b): restore the `[hidden]` preflight rule (not done in this branch)

- **Proposal:** in `app/globals.css`, next to the scoped preflight baseline (around l.267-300), add:

  ```css
  [hidden]:where(:not([hidden="until-found"])) { display: none !important; }
  ```

  This restores the shadcn `hidden` contract for every `SidebarMenuButton` tooltip.
  - It could be scoped to `:where([data-slot])[hidden]`, like the rest of that block.
- **Grep results for where it applies:**
  - `<SidebarMenuButton` uses in `app/` (non-test):
    - `app/components/shell/ShellSidebar.tsx:94`: mailbox rows, native `title`, no tooltip;
    - `app/components/shell/ShellSidebar.tsx:148`: view rows, the only `tooltip=` user;
    - `app/components/shell/ShellSidebar.tsx:231`: drafts, no tooltip;
    - `app/components/shell/ShellUserMenu.tsx:68`: user menu, native `title`, no tooltip.
  - `hidden={...}` in app TSX: only `app/components/ui/sidebar.tsx:549` (the `SidebarMenuButton` tooltip default `state !== "collapsed" || isMobile`).
  - The other `tooltip=` props in `app/` (about 60, e.g. `MessageQuickActions`, `ComposeModal`, `FolderPane`) belong to `TooltipIconButton` and similar components. They do not go through `SidebarMenuButton` and are not affected.
- **Impact today:** no other `SidebarMenuButton` tooltip has the issue. The defect would come back as soon as a second sidebar row uses `tooltip=` with the default `hidden`.
- **After (b):** `ViewRow` could go back to `hidden: isMobile || state === "collapsed"` instead of not rendering. It currently passes `hidden: false`, so (b) does not change its desktop behaviour.
  - Check before adopting: the HTML `hidden` attribute is also set by non-shadcn markup (Radix Themes, third-party widgets). A global `!important` rule would override any of them that use `hidden` together with a display class on purpose. The scoped `[data-slot]` variant avoids that.

## Evidence (`briefs/sidebar-views-evidence/`, all PNG <= 130 KB)

Captured on the production build of the final app code with a synthetic fixture, German UI and the same routed counts as QA-014 (shown as "9111" / "12.345" in de).

- `r2-light-1440-hover.png`, `r2-dark-1440-hover.png`: "Nicht zugewiesen" hovered. The fill spans the badge, and the tooltip sits right of the row with the row's text.
- `r2-light-390-sheet-hover-focus.png`: 390x844 sheet, "Nicht zugewiesen" hovered and then keyboard-focused (focus ring visible). No tooltip.
- `r2-light-1440-collapsed-shift-tab.png`: collapsed, after 13 × Shift+Tab from the toggle. Focus is in the message list, with no detached tooltip.
- `r2-measurements.json`: row and badge boxes and colours for all 7 rows (light/dark), tooltip boxes, the sheet tooltip lists after hover and focus (both empty, `aria-describedby` null), and the collapsed Shift+Tab focus path.

## Open points / observations

- **English label in the German UI.** The collapsed Shift+Tab path showed the calendar trigger's accessible name as English "Open calendar". `b4d963f` (on `feat/status-bar-compact`) already translates it.
- **Shared re-entry workaround.** The `.viewTooltip[data-state="closed"] { animation: none }` workaround from round 1 is still local to the view rows. Moving it into `ui/tooltip.tsx` remains a separate decision.

## Worktree

- `git status` is clean at `031d070`.
- No listeners remain on ports 3845-3849. The harness stopped its own servers, and the scratch merge copy was deleted.
- `.tmp` is removed at the end of this task.
