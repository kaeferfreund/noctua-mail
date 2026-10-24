# V1 report: cheaper folder tree and sidebar on a mailbox switch, plus click feedback

Branch `perf/switch-folder-tree` in `repo/wt-switch-tree` (from `integration/stage` 7425f75). Not pushed, merged or deployed.

Commits:
- `fd4f48e` perf(sidebar): cheaper folder tree and mailbox rows on a switch, pending row feedback
- `7cee3ee` test(shell): keep the switch callback void in the sorting test

All data is synthetic (`example.test`). Measured 2026-10-23, 18:43–19:18 UTC.

## Result

On the switch into the 50-folder mailbox, first rows arrive about **210 ms earlier** (≈ −42 %). The clicked row now reacts in **5–6 ms** instead of 70–140 ms. Switches into a 6-folder mailbox improve by 10–40 ms, or stay within noise; under high host load, small → large showed outliers in both head rounds (see the note below the table). Every implemented idea is kept.

**Warm switches, ms from click, p50 / p90.**
- base = 7425f75, head = this branch.
- base and head each ran 2 rounds × 10 runs per direction (n = 20). The rounds alternated base, head, …, head, base, at load 3–15.

| pair | variant | feedback | highlight (aria-current) | first rows | settled | long tasks p50 |
|---|---|---|---|---|---|---|
| small → folders | base | 139 / 205 | 139 / 205 | **508** / 635 | 890 / 1,176 | 650 |
| small → folders | head | **5** / 6 | 77 / 113 | **285** / 358 | 567 / 672 | 380 |
| large → folders | base | 139 / 149 | 139 / 149 | **481** / 520 | 852 / 929 | 618 |
| large → folders | head | **5** / 6 | 70 / 86 | **271** / 315 | 558 / 691 | 375 |
| folders → small | base | 71 / 282 | 71 / 282 | **220** / 415 | 423 / 779 | 142 |
| folders → small | head | **6** / 6 | 67 / 86 | **182** / 215 | 359 / 482 | 76 |
| small → large | base | 73 / 91 | 73 / 91 | **423** / 514 | 838 / 1,006 | 596 |
| small → large | head | **5** / 18 | 62 / 363 | **408** / 1,023 | 807 / 1,412 | 548 |
| folders → large *(extra)* | base | 69 / 83 | 69 / 83 | 417 / 464 | 783 / 883 | 543 |
| folders → large *(extra)* | head | 6 / 6 | 58 / 83 | 398 / 439 | 775 / 868 | 522 |
| large → small *(extra)* | base | 78 / 205 | 78 / 205 | 210 / 383 | 423 / 679 | 120 |
| large → small *(extra)* | head | 6 / 29 | 60 / 210 | 178 / 343 | 349 / 648 | 76 |

- **feedback** = the clicked row shows `aria-busy` (head) or `aria-current` (base), whichever comes first.
- **small → large p90 (head).** 4 of the 20 head runs on this pair took over 990 ms; base had none of 20. In each of those runs the server answered `switch-account` or `threads` 2–4× slower than usual, and one run had a 1.18 s long task while the list rendered. All of that is outside the folder tree, and the target mailbox has only 6 folders. A follow-up check on this pair alone (10 runs per direction; data in `results/r7–r9`):

  | round | variant | load | small → large p50 | slowest 3 runs |
  |---|---|---|---|---|
  | r7 | head | 18.9 | 468 | 641, 942, 1,134 |
  | r8 | base | 9.9 | 417 | 433, 440, 459 |
  | r9 | head | 5.7 | 392 | 402, 403, 408 |

  The outliers are consistent with host load rather than the variant: the low-load head round has none. They are not proven unrelated, because base was not measured at load 19. Other agents were running their own measurement series on the same host at the same time.
- **Raw data.** Per-round data, including the two isolation variants, is in `V1-assets/pooled.md` and `V1-assets/results/`.

## Per idea: keep or drop

To attribute the gain, two isolation variants were built and measured once each (n = 10):
- **L**: lazy menu + lazy title only, no memoization.
- **M**: memoization and the pending state only, with eager menus and titles.

| pair (first rows p50) | base | L | M | head |
|---|---|---|---|---|
| small → folders | 508 | 310 | 340 | 285 |
| large → folders | 481 | 322 | 348 | 271 |
| folders → small | 220 | 240 | 177 | 182 |
| small → large | 423 | 381 | 385 | 408 (392 in the low-load check round r9) |

| idea | source | verdict | evidence |
|---|---|---|---|
| **A1** Folder row: Radix `DropdownMenu` + `Tooltip` mount only on the first open intent: pointer over the row, focus in the row, or a press on the placeholder button. The active and syncing rows mount the menu right away. The placeholder keeps `aria-label`, `aria-haspopup="menu"` and `aria-expanded="false"`. | Grok F3, Muse M3, GPT G05 | **keep** | Measured with A2 as variant L: −160 to −200 ms first rows into 50 folders, highlight 140 → 80 ms. Not separable from A2 in this run. |
| **A2** Folder count title (`List.folderCountTitle`, ICU plural) built on hover/focus instead of per node per render; the path label is only built for it. | Grok F3, Muse M1 (rest), GPT G05 | **keep** | Part of variant L (see A1). Measured without switch-2's per-locale translator cache (657373c), which makes each `getTranslator` call cheaper. After switch-2 merges, A2's share will be smaller. |
| **A3** `FolderTree` memoized (shallow compare of `state` / `actions`). Handlers get stable identities via a new `useStableHandlers` hook in `FolderSidebarPane`. `rootFolders` memoized in MailClient. Tree helpers and the node state object memoized. | Grok F3, Muse M3, GPT G05 | **keep** | Variant M: −130 to −160 ms into 50 folders. Leaving the 50-folder mailbox: 220 → 177 ms, because the old tree no longer re-renders on every shell state change. Combined with L, head is better than either variant alone. |
| **A3b** `FolderTreeNode` wrapped in `memo`; children recurse through the memoized component. | Muse M3, GPT G05 | **keep (no separate gain)** | Nodes mount fresh on every switch (new folder-id keys), and the node state object changes whenever anything in the tree changes. So this only skips nodes when `rootFolders` or the parent re-renders without a state change. It costs a single `memo()` line. A subtree-aware comparator for in-mailbox folder clicks was not built (backlog). |
| **A4** `MailboxRow` as a memoized component. Group partition and summary map memoized. Stable switch handler. | GPT G07 | **keep (not separately measurable here)** | With 4 mailboxes it is below noise. Kept because B adds two sidebar renders per click (set pending, clear pending), and the memo limits those to the two rows that change. GPT estimated 2–8 ms at 12 mailboxes. |
| **B** Pending state on the clicked mailbox row: `aria-busy="true"`, accent fill, pulse, progress cursor. Set synchronously on click, cleared when *that* click's `switchAccount` promise settles. A token keeps a superseded switch (A → B → A) from clearing the newer click. `aria-current` stays bound to the committed `activeAccountId`. | Muse M10 | **keep** | Click → visible feedback: 70–140 ms → **5–6 ms** p50, and ≤ 29 ms p90. No change to first rows. Implemented in ShellSidebar/MailClient wiring: `onSwitch: switchAccount` now passes the promise. `useAccountController.ts` is unchanged. |

**Dropped:** nothing.

## Risks

- **Count title on hover/focus.**
  - The row and badge `title` only exist after the pointer or focus has reached the row.
  - Native tooltips still work: the title is set on `pointerenter`, before the browser's tooltip delay.
  - A screen-reader user on a virtual cursor, without focus, no longer gets the title description. The unread count still has its own `aria-label`.
- **Placeholder action button.**
  - It is only visible on hover, and hover mounts the real trigger first. The active and syncing rows always have the real trigger.
  - A press on a never-engaged placeholder opens the menu directly; this is tested.
- **Same element on first open.** Radix's first open now pays the menu mount (one frame).
- **`useStableHandlers`.**
  - The wrappers call the handler from the last commit; it is updated in `useLayoutEffect`.
  - They must not be called during render. `folderSpecialIcon` is called during render, so it is passed through unchanged; it is a module constant.
- **Pending state.**
  - It relies on `switchAccount` always settling. It does: all exits return or finish in `finally`, and errors are caught.
  - On mobile the sheet closes on click, so the state is mostly not visible there.
- **Pre-existing behaviour, unchanged.** These are not fixed here; proposed for the backlog:
  - Choosing a folder menu item also selects that folder. React events from the portalled menu bubble to the row's `onClick`.
  - Enter on the action button also selects the folder. The row's `onKeyDown` does not check the target.

## Gates

| gate | result |
|---|---|
| `bun check` | 0 errors (1,303 files) |
| eslint on the 9 touched files | 0 errors. 73 warnings, all in `MailClient.tsx` and identical to base (73). All other touched and new files: 0. |
| DOM tests | 296 pass / 0 fail across 27 files. Covers folder tree, Shell, sidebar/sheet, hooks, mailbox-switch rapid/refresh, InAppNoticeStack, Collaboration, compose race/lazy, BottomStatusBar. |
| `bun run build` | OK (compiled 22.3 s, 0 type errors) |
| screenshots | `V1-assets/`: desktop hover, desktop pending (aria-busy on "Kleine Praxis" while "Viele Ordner" keeps aria-current), desktop folder menu opened by keyboard (Synchronisieren / Unterordner erstellen / Umbenennen / Löschen), 390 px sidebar |
| full `test:ci` | not run (per rule 4, hourly on stage) |

**New tests:**
- `FolderTree.lazyMenu.dom.test.tsx`:
  - a closed tree has no menu nodes except on the active row;
  - the menu and the title mount on pointer or focus;
  - the menu opens by keyboard and runs sync, rename and delete;
  - a press on the placeholder opens the menu;
  - a syncing row keeps its trigger.
- `Shell.dom.test.tsx`: the pending state is shown and cleared, A → B → A keeps the newer click busy, a denied (403-style) settle clears it, and `aria-current` is only on the committed mailbox.
- `FolderTree.i18n.dom.test.tsx` now hovers before it checks the path title.

## Method

- **Harness.** The Spike A harness (`briefs/perf-mailbox-switch/e2e/harness`), adapted to ports 3950–3954 and a scratch data dir under `wt-switch-tree/.tmp`. Changed scripts are in `V1-assets/harness/`.
- **New milestone.** `measure.mjs` gets a `feedback` milestone (`aria-busy` or `aria-current` on the target row; see `measure.mjs.diff`).
- **Builds.** Production standalone builds per variant.
- **Mailboxes.** 4 synthetic IMAP fixtures (small 50 / medium 2,000 / large 10,000 / folders 1,350 messages in 50 folders), fully primed. Warm mode: 10 runs per direction; the first switch is excluded.
- **Rounds.**

  | round | variant | load |
  |---|---|---|
  | r1 | base | 11.6 |
  | r2 | head | 15.0 |
  | r3 | L | 10.6 |
  | r4 | M | 7.4 |
  | r5 | head | 3.4 |
  | r6 | base | 4.6 |

  | r7 / r8 / r9 (small ↔ large only) | head / base / head | 18.9 / 9.9 / 5.7 |

  Base r1 and r6 agree within 10–30 ms on the folders pairs, so the gain is not a load artefact.
- **Caveat.** Headless Chromium on a shared ARM host. Absolute numbers are higher than on a desktop browser.
- **Cleanup.** Scratch (data dir, standalone builds) lived only in `wt-switch-tree/.tmp` and has been removed; fixture and server are stopped. The assets kept are in `V1-assets/`.
