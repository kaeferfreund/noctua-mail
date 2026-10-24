# Sidebar "Ansichten" row layout - report

Branch `fix/sidebar-views-row`, worktree `wt-sidebar-views`, base 98b4301 (round-9 candidate).
Commit: `94f1a31 fix(shell): keep view counts inside the sidebar row highlight` (not pushed).
Restarted run. The predecessor thread was no longer readable (`thread_not_found`), so the acceptance list comes from the summary in the task.

## Root cause

1. **Pill ends before the badge.** `fix/i18n-views` (2aa5e7a) turned `.viewRow` into a two-column grid (`minmax(0,1fr) auto`) and set the badge to `position: static`. That put the badge in its own column next to `SidebarMenuButton`, so the button's hover/active background stopped at column 1.
   Before measurements, 1280 light: Inbox row box x 16-244, badge x 244-268. "Offen" row box ends at 217, badge 217-268.
2. **Active looked the same as hover.** Both used `bg-sidebar-accent`: rgb(232,232,232) light and rgb(49,49,49) dark. The only difference was `font-medium`.
3. **Tooltip.** Each view button had its own native `title` (`rowTitle`). The code never mixes up rows. The screenshot shows how the browser places native tooltips: at the pointer, below and to the right, after a delay. That covers the next row, and the browser can be late to replace the text when the pointer moves on. The page cannot control placement, collision padding or timing for a native title.
   - The "clipped" look comes from the crop: the OS tooltip extends over the message list.
   - The badge's own `title` never shows, because the badge is `pointer-events: none`.

## Fix (layout only, count data path unchanged)

`app/components/shell/ShellSidebar.tsx`, `ShellSidebar.module.css`:

- **Full-row button (shadcn `SidebarMenuBadge` anatomy).**
  - The button spans the whole row again. The badge sits on top of it, inside the row's right padding (`margin-right: 4px`, like `right-1`).
  - The row grid is `icon | label | count` (`auto minmax(0,1fr) auto`, the 3rd column only when a badge exists). The button joins it with `grid-template-columns: subgrid`, so a wrapped label ends at the count column instead of running under the badge.
  - The i18n-views wrapping at 320/360/390 px and the 44 px mobile minimum height are unchanged.
- **Active state.** A shared `ACTIVE_ROW_CLASS` (the existing mailbox-row accent: `--iris-3` fill, `--iris-11` text) now applies to mailbox rows and view rows, so both use one row design.
  - Light: active rgb(240,241,254) with indigo text; hover rgb(232,232,232).
  - Dark: active rgb(32,34,72) with rgb(177,169,255) text; hover rgb(49,49,49).
  - Hovering the active row keeps the active fill (asserted).
  - The view badge loses its separate `bg-sidebar-accent` chip, matching the mailbox, drafts and folder badges.
- **Tooltip.** The native `title` is replaced by the existing `SidebarMenuButton` `tooltip` prop (Radix): `side="right"`, centred, `collisionPadding: 8`, hidden in the mobile sheet. It opens for the row under pointer or keyboard focus and is linked through `aria-describedby`. The text is unchanged (`rowTitle` / `Views.rowTitle`).
  - **Two Radix behaviours, fixed and covered by tests:**
    - **Grace area.** With hoverable content (the default), leaving a row toward the tooltip keeps the previous row's tooltip open while the pointer is over the neighbouring row. The new row's trigger ignores the pointer while it is "in transit" to the tooltip, which gives stale text. The views list now has its own `<TooltipProvider disableHoverableContent>`.
      - Reproduced: QA-014 showed "Unassigned..." while hovering "Open". The new DOM pointer assertion fails without this change.
    - **Re-entry during the exit animation.** A Radix tooltip that reopens while its own content is still animating out closes itself again. On open it dispatches `tooltip.open`, and its own still-mounted content listens to that event and calls `onClose` (react-tooltip 1.4.1, index.mjs l.101/l.317).
      - Reproduced with the sequence Unassigned → Inbox → Unassigned: no tooltip at all. With animations disabled the same sequence works.
      - Fix: `.viewTooltip[data-state="closed"] { animation: none; }`, so the previous row's tooltip does not linger either. The entry animation is kept.
- **Collapsed state.** The shell uses `collapsible="offcanvas"`, so there is no icon-only rail. When collapsed, the sidebar is hidden and no tooltip or row stays behind (`after-collapsed-1440.png`).

## Tests added or changed

- `tests/browser/ui/qa-shell.spec.ts`: new **QA-014**, run against the production build. It covers light and dark at 1440x900 and 1280x720:
  - every badge box lies inside its row (highlight) box, and the label ends before the badge;
  - the active row has a badge; active fill differs from hover fill, and hovering the active row keeps the active fill;
  - tooltip text equals `name: description` from `messages/en.json` for the row under the pointer, including the re-entry sequence. The tooltip sits to the right of the row and inside the viewport;
  - keyboard focus shows the same description, `:focus-visible`, a 2px ring, and the ring stays inside the sidebar scroll container.
- `app/components/shell/Shell.dom.test.tsx`:
  - The title checks became tooltip checks: no `title` attribute; focusing each row shows exactly one tooltip with that row's text, linked by `aria-describedby`.
  - A pointer leave/move sequence over three rows must show only the current row's text. Verified to fail without `disableHoverableContent`.
- `app/hooks/useMailboxSummaries.dom.test.tsx`: renders `ViewRow` standalone, so the harness now provides a `TooltipProvider`, as `AppShell` does in production.

## Gates (all with `env -u CLAUDECODE -u AGENT -u REPL_ID`)

| Gate | Result |
| --- | --- |
| `bun run typecheck` | 0 errors (1,244 files) |
| Focused DOM tests (Shell, MobileFrames, useMailboxSummaries, InAppNoticeStack) x3 | 52 pass / 0 fail, three times |
| `bun run test:ci` | 2915 pass / 0 fail (315 files) + DOM 563 pass / 0 fail (73 files), rc 0 |
| `bun run lint` | 0 errors, 181 warnings; none in touched files (zero new) |
| `bun run build` | rc 0 |
| `tests/browser/ui/qa-shell.spec.ts` against the production build (`QA_SHELL_USE_BUILD=1`, port 3846) | 5 passed (QA-003/009, QA-004/009, QA-005, QA-011/012/013, QA-014) |
| Extra: `qa-i18n-views.spec.ts` against the same build | 3 passed (sidebar wrapping at 1280/390/360/320 in de and en still holds) |
| `git diff --check` | clean |

Earlier QA-014 runs failed and exposed the two Radix behaviours above. The final code passes. No timeout, retry or assertion was weakened.

## Evidence (`briefs/sidebar-views-evidence/`, all PNG <= 90 KB)

Captured with the production build on port 3845, a synthetic fixture and German UI.

- Counts were routed in the browser for the evidence only: assigned 0, unassigned 9111, open 12345 → "12.345". Inbox 21.
- `before-*` / `after-*`:
  - `{light,dark}-{1440,1280}-hover.png`: "Mir zugewiesen" hovered;
  - `-focus.png`: "Nicht zugewiesen" keyboard focus with tooltip;
  - `collapsed-1440.png`;
  - `mobile-{light,dark}-390.png`: 390x844 sheet.
- `*-measurements.json` holds the row and badge boxes, computed colours and tooltip text and box.
- `before-light-1440-*` was taken on the fixture's first page load, before the inbox folder existed, so it lacks the Inbox row. The other before shots show the cut-off pill.

## Merge-tree (`git merge-tree --write-tree HEAD <ref>`)

| Ref | Result | Notes |
| --- | --- | --- |
| a864dfc (feat/status-bar-compact) | conflict `messages/de.json` | Same conflict with base 98b4301. Not caused by this commit. a864dfc does not touch any file of this commit. |
| e7d00ee (feat/reader-focus) | conflicts `MailClient.tsx`, `lazyAdmin.dom.test.tsx`, `playwright.qa-round2.config.ts` | Identical list with base 98b4301. Pre-existing, unrelated to this commit. No overlap with these files. |
| feat/build-info (now 6307539) | clean, tree c36f50f | No overlap. |
| integration/stage tip (now e70c30b) | clean, tree 8475659 | No overlap. |

Per-hunk notes: none of the four refs change `ShellSidebar.tsx`, `ShellSidebar.module.css`, `Shell.dom.test.tsx`, `useMailboxSummaries.dom.test.tsx` or `qa-shell.spec.ts` relative to their merge base with this branch. The brief said they also edit `ShellSidebar.tsx`; the refs as of this run do not. No hunk resolution is needed for this commit.

## Open points

- **Shared tooltip.** The re-entry self-close also affects the other Radix tooltips that use `app/components/ui/tooltip.tsx` with its exit animation, for example the header toolbar buttons. This commit fixes only the view rows. An app-wide fix belongs in `ui/tooltip.tsx` or a Radix update.
- **Mailbox rows.** Mailbox rows still use a native `title` (summary text). Their `SidebarMenuBadge` child spans also carry `title`s that never show (`pointer-events: none`). Left unchanged (out of scope).
- **Tooltip delay.** The shell `TooltipProvider` uses `delayDuration` 0, so row descriptions appear immediately on hover, the same as the header tooltips. If a delay is wanted for the list, it needs a decision: a provider prop on the views provider.
- **Active fill.** "Stronger than hover" is met by the accent fill plus indigo text, the app's selection token (`--list-row-selected-bg` = `--iris-3`). In light mode the active fill is a lighter but tinted colour than the grey hover fill. If a darker active fill is wanted, changing `ACTIVE_ROW_CLASS` (for example to `--iris-4`) changes mailbox and view rows together.
