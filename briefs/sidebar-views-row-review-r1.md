# Review r1: fix/sidebar-views-row (94f1a31)

Read-only review of `fix/sidebar-views-row` at 94f1a3153a921d3a4e69bea8770b6f2580393091 (one commit on 98b4301), worktree `wt-sidebar-views`. No tracked files were changed and nothing was committed. Scratch work stayed under `.tmp/review/` and was removed afterwards.

**Verdict: FIX.** On desktop the change does what the user asked for. Two tooltip defects remain:
- the "hidden on mobile" tooltip is visible and clipped in the phone sheet (P2);
- in collapsed mode, keyboard focus opens a detached, clipped tooltip (P3).

## Gates (all bun test / Playwright runs used `env -u CLAUDECODE -u AGENT -u REPL_ID`)

| Gate | Result |
| --- | --- |
| `bun run build` (own build of HEAD, nice 15) | rc 0 |
| `bun run typecheck` | 0 errors, 1,244 files |
| Focused DOM tests: Shell, useMailboxSummaries, MobileFrames, InAppNoticeStack, run 3 times | 52 pass / 0 fail on each run |
| `eslint` on the 4 touched TS/TSX files | 0 errors, 0 warnings |
| `git diff --check 98b4301 HEAD` | clean |
| `qa-shell.spec.ts` on the production build (QA_SHELL_USE_BUILD=1, port 3845) | 5 passed (QA-014 included) |
| QA-014 (HEAD spec) on a `.tmp` source copy of 98b4301, own build, port 3847, full spec order | 4 passed, **QA-014 failed** at `badge.right <= row.right`: expected <= 244, received 268. This is the user's defect. |
| QA-014 alone (`-g QA-014`) on a fresh fixture, HEAD and base | fails at line 148 on both (no inbox row yet). The test depends on the order of earlier tests, see F3. |
| Review measurement spec (uncommitted, port 3846) | desktop matrix: 0 problems; mobile and collapsed findings below |

## Measurements (production build, German UI, counts routed in the browser: assigned 3, unassigned 9111, open 12345)

Desktop: 1440x900, 1280x720, 768x900 (smallest desktop breakpoint) and 2560x1440, each in light and dark, plus en at 1440 in light and dark. The sidebar has a fixed width of 18rem (288 px at every desktop viewport), so the narrowest and widest viewports cover its minimum and maximum width. Results for all 10 configurations:
- **Badge inside the highlight.** All 6 badges lie inside the button box, e.g. Inbox row x 16-272, badge 244-268. Labels end before the badge. Badges are vertically centred within 1.5 px, including the 2-line "Ungelesen & unbeantwortet" row (56 px).
- **Pointer over the badge.** With the pointer on the badge centre, the row button is `:hover` and shows its fill (the badge has `pointer-events: none`).
- **Insets and radius.** View rows match mailbox rows: left 16, right 272, radius 6px, badge right inset 4px. View rows are 36 px high, mailbox rows 32 px. The 98b4301 measurements show the same 36 px, so this is not a regression.
- **Hover vs active.**
  - Light: active rgb(240,241,254) with rgb(87,83,198) text; hover rgb(232,232,232).
  - Dark: active rgb(32,34,72) with rgb(177,169,255) text; hover rgb(49,49,49).
  - Hovering the active row keeps the active fill.
- **Tooltip.** Exactly one tooltip shows, and it contains the hovered row's description.
  - No stale text appeared immediately after a move, or after a fast Unassigned / Open / Unassigned / Assigned / Unassigned / Focused sequence.
  - It sits right of the row, overlaps the row vertically, stays inside the viewport (max right 602) and is the top element at its centre.
- **Keyboard.** Tab from the mailbox row through all 7 view rows: each row is `:focus-visible` with a 2px ring, no ancestor with overflow clips it, and the tooltip text matches the focused row.
- **Mailbox rows and unread badges.** The QA Shared chips (21 / 3 / 9111 / watcher) stay inside the mailbox row, and the folder "Posteingang 21" badge still shows. `MailboxRows` changed only by moving its class string into `ACTIVE_ROW_CLASS` (identical string).
- **Drag and drop.** I did not exercise drag and drop in the browser. No drop-target or folder-tree code was changed.

Mobile sheet at 390x844 and 320x640, light and dark:
- rows are at least 44 px high;
- badges stay inside their rows, and labels wrap before them ("Ungelesen & unbeantwortet" takes 2 lines at 320);
- the sheet is 292.5 / 240 px wide;
- `aria-describedby` resolves to the row text.

## Findings

### F1 (P2): the row tooltip is not hidden on mobile; it shows and is clipped next to the sheet

- **Code:** `ShellSidebar.tsx` `ViewRow` passes `tooltip={{ ..., hidden: isMobile }}`.
- **Why it does not work:** `hidden` becomes the HTML `hidden` attribute on `TooltipContent`. This app loads Tailwind without preflight (`app/globals.css` l.3-12), so nothing turns `[hidden]` into `display: none !important`. The content's own `inline-flex` class overrides the user-agent `display: none`.
- **Measured:** at 390x844, 320x640 and 767x900 (sheet mode), hovering or keyboard-focusing "Nicht zugewiesen" gives a tooltip with `hidden` attribute present, `display: inline-flex`, visibility visible, opacity 1.
  - Box x 294-614 at 390 and x 241-561 at 320: the right part is cut off by the viewport.
  - At 767 it shows over the dimmed overlay (x 385-705).
- **Evidence:** `review-de-light-mobile-{390,320,767}-{hover,focus}-tooltip.png`. The plain sheet shots `review-de-{light,dark}-mobile-{390,320}.png` also show a tooltip still open for the row focused earlier.
- **Impact:** this is the clipped-tooltip symptom from the user's report, now on phone and narrow layouts. Touch taps mostly do not trigger it, because Radix ignores touch pointermove and a tap selects the row and closes the sheet. A mouse, a keyboard or a narrow desktop window does.
- **Missed by tests:** QA-014 covers only 1440/1280, and the DOM tests do not cover mobile.
- **Fix options:**
  - (a) Do not pass a tooltip when `isMobile` (and when collapsed, see F2). The aria description is then lost on mobile, as with the old `title`, which touch never showed.
  - (b) Restore the preflight rule `[hidden]:where(:not([hidden="until-found"])) { display: none !important; }` in `globals.css`, so the shadcn `hidden` contract works everywhere.
  - Either way, add a 390 px assertion that no tooltip content is visible.

### F2 (P3): collapsed (offcanvas) mode, keyboard focus on the off-screen view rows opens a detached, clipped tooltip

- **State:** in collapsed mode the sidebar container is at left -288 and is not `inert` or `aria-hidden` (this part predates the branch).
- **Measured:** Shift+Tab from the sidebar toggle reaches `virtual:invite-deck` after 13 steps. A tooltip then shows at x -6 to 314 over the message list, with no visible row next to it and its left edge clipped.
- **Evidence:** `review-de-light-collapsed-shift-tab.png`.
- **Cause:** the commit overrides the shadcn default `hidden={state !== "collapsed" || isMobile}` with `hidden: isMobile`. Even the default would not hide it, because of F1.
- **Fix:** the same as F1 (no tooltip, or a working hidden, when `state === "collapsed"`). Making the offcanvas container inert when collapsed is a separate, older issue.

### F3 (P3): QA-014 depends on test order and has thin badge coverage

- **Order dependency:** run alone (`-g QA-014`) on a fresh fixture, QA-014 fails on HEAD at l.148 (`active.locator("..")…menu-badge` not found): the first page load has no inbox row yet. It passes only after QA-003…013 have loaded the shell.
- **Thin coverage:** without routed counts, QA-014 checked only 3 to 5 badge rows per pass (log: `rows: 3/5/3/3`).
- **Suggestion:** a reload/wait until 7 rows and the inbox badge exist, and optionally routed collaboration counts as in the evidence run.

### Notes (no change requested)

- **Badge colour on the active row.** The view badge on the active row uses `sidebar-accent-foreground`: rgb(32,32,32) light, against the row's iris-11 label. The mailbox row chips behave the same, so it is consistent, but the active-row count is not tinted.
- **Hoverable content.** `disableHoverableContent` on the views provider means the pointer cannot move onto the tooltip. That is a deliberate trade-off against stale text; WCAG 1.4.13 "hoverable" would argue for the default. The tooltip holds only plain text.
- **The implementer's two open decisions still stand:**
  - the light-mode active fill (iris-3) is lighter than the grey hover fill but tinted;
  - tooltips open with delay 0 on every row.
- **The animation workaround is local.** `.viewTooltip[data-state="closed"] { animation: none }` works around the Radix re-entry self-close for view rows only. The shared `ui/tooltip.tsx` keeps the behaviour elsewhere.

## Merge notes (checked with `git merge-tree --write-tree`)

- **a864dfc:** conflict `messages/de.json`.
- **e7d00ee:** conflicts in `MailClient.tsx`, `lazyAdmin.dom.test.tsx` and `playwright.qa-round2.config.ts`.
- Both conflict lists are identical against 98b4301, as the implementer reported.
- feat/build-info (6307539) and integration/stage (e70c30b) merge clean.
- **Addition:** a864dfc (ee60d26) changes `app/components/ui/tooltip.tsx`: z-index `z-[9998]` becomes `z-(--layer-popper)`. There is no textual overlap with this commit. Still, the view tooltips and their "on top" assertion depend on that layer, so re-run QA-014 after combining with a864dfc.

## Evidence

`briefs/sidebar-views-evidence/review-*.png`:
- `de-{light,dark}-{1440,1280}-{hover-badge,focus}`
- `de-light-{768,2560}-{hover-badge,focus}`
- `de-{light,dark}-mobile-{390,320}`
- `de-light-mobile-{390,320,767}-{hover,focus}-tooltip`
- `de-light-collapsed`
- `de-light-collapsed-shift-tab`
