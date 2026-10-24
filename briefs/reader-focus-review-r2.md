# Reader focus — review round 2 (14a1f8e..ccddc4d)

**Verdict: FIX. ccddc4d should not go into integration round 10 or the interim preview yet.** I found 3 P2s and 4 P3s; no P1.

Every r1 P2, the archive continuation and the four repaired commands are **verified closed** on a real production build. But three P2s remain:

1. With the focus preference saved, the list can no longer load more pages. This bug has been in the branch since e9d2428; r1 did not catch it.
2. After entering focus with Enter or Shift+Enter, Esc has to be pressed twice.
3. The shared bodyless-command contract is still broken for every other caller. One of them is permanent Delete in Trash, which the new focus toolbar triggers.

All three fixes are small, and the merge notes are valid, so a quick r3 should be enough.

- Reviewed commit: `ccddc4dafc3007f6235db6f27f98b585139fbf4b`
- Baseline for comparison: `11dc3c5`
- Worktree `wt-review-collab`: not modified (`git status` empty; HEAD = ccddc4d).
- All probes, logs, PNGs and PDFs are in `briefs/reader-focus-regressions-r2/`. They ran against a git-archive snapshot with synthetic storage only (first@/second@example.test, dev-fixture seed `reader-review` plus 65 "Review synthetic" messages and one 260-line message; 126 INBOX messages).
- Servers: production `next start`, ccddc4d on 3895 and 11dc3c5 on 3896, with the fixture on IMAP 3897, control 3898 and SMTP 3899. The committed suite ran through `scripts/runQaShellBrowserTests.ts` on 3896, after I had stopped the baseline server.

## Findings

### P2-1 — Saved focus preference disables list infinite scroll
- **Location:** `app/components/MailClient.tsx:4931`
  - The scroll handler returns early when `readerLayout === "focus"`.
  - ShellPanes renders split whenever no message is open (`MailClient.tsx:5716`: `activeMessage ? readerLayout : "split"`).
  - The same mismatch exists in the notice-anchor choice (`:4944`, `:4967`) and the scroll capture (`:2749`, `:2893`).
- **Reproduction:**
  1. Open focus once, so the preference is `focus`.
  2. Reload, or archive the last message until focus falls back to the list.
  3. Scroll the visible list to the bottom.
- **Result** (`out-3895/observations.json` → `infinite-scroll`, 20-row pages):
  - Split preference: `33 of 126` → `126 of 126`, page requests 2–5.
  - Focus preference: `33 of 126` → `33 of 126`, **zero page requests**.
  - The real page size is 300 (`messageListQueryUrl.ts:55`). So anyone who prefers focus can't scroll past the first 300 rows until they press Esc once.
- **Required fix:**
  - Gate the list paging on the *effective* layout (`readerFocused` = `!isMobile && readerLayout === "focus" && activeMessage`).
  - Use the same condition for the notice anchor and the scroll capture.
  - Add a regression test: focus preference, no open message, scrolling loads the next page.

### P2-2 — Keyboard entry needs two Esc presses
- **Location:** `lib/ui/useReaderFocusPlacement.ts:13`, combined with `ReaderToolbar.tsx:166`. Focusing Back programmatically opens its Radix tooltip "Back to messages (Escape)". The first Esc closes the tooltip; `readerShortcut` then ignores that event because it is `defaultPrevented` (`lib/ui/readerFocus.ts:36`).
- **Reproduction:**
  1. In split, focus a row and press Enter (or select a row and press Shift+Enter).
  2. Press Esc.
- **Result** (`observations.json` → `entry-paths`, `probe-entry.log`):
  - Enter and Shift+Enter: `escPresses: 2`, tooltip `["Back to messages (Escape)"]`.
  - Double-click, the button, saved-preference sidebar click, saved-preference reload click and the "after end-of-list" click: one Esc is enough.
  - All 7 paths put focus on Back, restore the list scroll exactly (600 → 600), and focus the selected row on exit.
- **Required fix:**
  - Don't open the tooltip on programmatic focus (or don't let the tooltip swallow Esc while Back is focused), so one Esc returns to the list.
  - Add a Playwright case: Enter → one Esc → split.

### P2-3 — Shared bodyless-command contract still broken (baseline bug, r1 asked for the shared repair)
- **Location:** `app/api/_helpers/requestOrigin.ts:37`. `requireMutationSameOrigin` checks `request.body === null`, which is never true for a production POST/DELETE, so every bodyless call returns `400 json_required`. r2 only changed the four commands in `useMessageMutations.ts:265` (archive, spam, not-spam, unsubscribe).
- **Callers still broken:**
  - Permanent delete — `useMessageDeleteActions.ts:342`; this is what the focus-toolbar and row Delete do in Trash.
  - Message-window delete — `app/message/window/page.tsx:225`
  - Resync — `useThreadContent.ts:182`
  - Calendar sync — `MailClient.tsx:4476`
  - Categories model reset
  - Topic and recipient-alias DELETE; attachment, calendar-event and MCP-token DELETE are also bodyless calls.
- **Reproduction:** in Trash, open a message in focus and click Delete in the toolbar.
- **Result** (`observations.json` → `trash-delete`, screenshot `out-3895/trash-delete-400.png`):
  - `POST …/delete` → `400 {"code":"json_required"}`.
  - The message stays, and the user sees "Operation failed (400)".
  - Direct matrix (`out-389{5,6}/contract-matrix.json`): bodyless message delete, archive, topic DELETE, recipient-alias DELETE and calendar sync all return 400. The same request with JSON `{}` returns 200 or 404, and ccddc4d and 11dc3c5 behave identically.
- **Required fix:**
  - Repair it at the server guard: treat a request with no content-type and an empty body as bodyless, and keep requiring JSON when a body is present.
  - Alternatively, use one shared client command helper for **all** callers.
  - Add a real-HTTP (`next start`) regression check for a bodyless delete. Do not add per-caller fixes.

### P3
1. **Avatar initials leak into print.** `ThreadMessageCard.tsx:604`/`:826` — the `data-mail-print` scope includes the avatar. Text extracted from the PDFs ends with `SRSR` (reply print) or `MBMB ×5` (thread print). Exclude avatars from print.
2. **The committed spec writes evidence outside the repo.** `tests/browser/ui/qa-reader-focus.spec.ts:7` (also `doc/SHELL.md:59`) defaults `READER_FOCUS_EVIDENCE_DIR` to `../briefs/reader-focus-evidence`. In the ROOT/wt-* layout each run overwrites the preserved r1/r2 PNGs; in CI it creates a directory outside the workspace. Default to `.tmp/reader-focus-evidence` (gitignored) instead.
3. **Keyboard focus drops to BODY after Delete and after Undo** in focus (`notices` → `after.focus: BODY`). After Archive, focus stays on the Archive button. Keep focus on the toolbar (or the Back button) after Delete and Undo.
4. **The PNG blobs are still in branch history.** The tree is clean (no tracked PNG/PDF besides the pre-existing `doc/noctua-mail.png`), but e9d2428 still carries the 641,507 bytes. Only a squash or rewritten merge keeps them out of integration history.

**Observations, not findings:**
- The removal continuation bypasses the old delete successor rules: thread-root fallback, `sortedMessages` fallback and collapsed-thread effective target (`useMessageDeleteActions.ts:638–653`). `visibleMessages` is per-message while `navigationRows` is per-row. No failure showed up on synthetic data; a DOM test for successor parity on collapsed threads would be worthwhile.
- Archive on a thread representative archives only that message. The continuation then skips past the rest of that thread (the implementer's `2 / 265`). This is the existing archive semantics.
- Archive in split now also advances to the next message instead of clearing the reader, which matches Delete. This is intended.

## Checks
1. **r1 P2s and the continuation, on the real app — verified, except where P2-1/P2-2 apply.**
   - Notices and Undo with the sidebar collapsed:
     - 1280 px: Undo at x=1173, y=807.5 (46×23); stack at x=786, width 470.
     - 1024 px: Undo at x=917; stack at x=530.
     - Clicking Undo restores the message for both Delete and Archive.
   - Print: the PDF excludes the typed draft, the composer, collaboration and action controls (`reply-print.pdf`). The 260-line message prints as 6 pages including the end marker. The thread prints its collapsed summaries plus the expanded message.
   - Entry paths: see P2-2.
   - Archive and Delete in focus advance to the next rendered row at 1280 and 1024 (counter `12 / 91` → `12 / 90`).
   - Selection changes during a delayed request (Archive+j, Archive+k, Delete+j) keep the newly selected message.
   - End of list: `3/3` → `2/2` → `1/1` → list. The final step shows split, focus on the list container, and the notice visible.
   - The counter steps through 5-row pages: `1/5+` … `20/20+` … `23/30+`; Previous goes back `22`, `21`, `20`.
2. **Archive 400 fixed for the row and the toolbar — verified.** Archive returns 200 from both, in my probes and in the committed suite. Spam with JSON returns 200.
   - Grep of callers: `buildAccountMessageActionPath` has 8 callers, and the guard is used by 19 routes. The JSON change does not break the four patched commands.
   - Related suites pass: `useMessageMutations`, MessageMenu, SelectionActionsMenu, usePruneMessageSelection, selectionActions, threadCollab.api, authClient.
   - Every other bodyless caller is still broken: **P2-3**.
3. **P3s from r1 — verified.**
   - The shortcut row and its CSS are gone. Tooltips show the shortcut and `aria-keyshortcuts` is set; j/k appear only on Previous/Next.
   - `role="group"` with `Reader.focus.toolbarLabel` ("Steuerung der Leseansicht" / "Message reading controls"). The counter is `aria-live` with `aria-describedby` pointing at sr-only text.
   - No `artifacts/` or `doc/screenshots` in the tree. History: P3-4.
4. **Regressions — verified.**
   - Split at 1280 vs 11dc3c5: the list pane and the list-only screen are **0 px different**. The reader differs only by the "Expand reading view" row (29 px shift, a feature from r1).
   - Mobile 390 px: list and reader are 0 px different. No toolbar, no overflow; browser Back returns to the list.
   - The collaboration bar is visible in focus. Internal note opens; typing "j k" doesn't navigate, and Esc in the note editor doesn't leave focus.
   - Catalogs: 881 keys with de/en parity; the 13 `Reader.focus` keys are identical; the obsolete `shortcuts` key is removed.
   - No display text is used as logic in product code.
5. **Gates — all pass.**
   - `bun run typecheck`: 0 errors in 1,206 files.
   - The 9 touched or related DOM suites, 3 runs: **74/74 pass** each time. Related server tests: **35/35** (including `successfulRemoval`, catalogs).
   - Committed `qa-reader-focus`: **6 passed (1.8 min)**.
   - `test:ci`: exit 0. Server **2,805 pass / 0 fail**, 305 files, 15,332 assertions, 337.4 s. DOM **486 pass / 0 fail**, 60 files, 2,767 assertions, 61.9 s. No flakes this run.
   - Both production builds: exit 0.
6. **Merge readiness — the per-hunk notes are valid.** See `merges/*.merge.txt` and `merges/scratch-resolutions.txt`.

   | Merged with | Result | Conflicts |
   | --- | --- | --- |
   | origin/integration/stage 11dc3c5 | clean | — (tree 628f425, same as the implementer's) |
   | **Local integration/stage 09b2695** (round 9, sender-identities-3 already merged) | conflict | only the `MailClient.tsx` import hunk |
   | status-bar-compact 5809d89 | conflict | `AppShell.tsx`, `doc/SHELL.md` |
   | sender-identities-3 26d82d8 | conflict | 5 files, as the implementer noted |
   | i18n-views 4d81222 | conflict | `lazyAdmin.dom.test.tsx` |
   | admin-self-grant b6c1ba9 | conflict | `playwright.qa-round2.config.ts` |
   | sync-folder-account-mismatch **1ee8d64** | conflict | `MailClient.tsx` import hunk |

   - The 09b2695 import hunk is resolved per the notes. On that merge: typecheck 0, focused DOM 74/74 ×3, server 35/35.
   - I applied the notes to scratch merges for compact, i18n, admin and sync. Each one typechecks with 0 errors. Compact: focused 74/74 ×3 and the shell DOM suites 44/44. i18n: 55/55, catalogs 10/10. Sync: 60/60.
   - The implementer's sync note was written against 20d93cf; the conflict on 1ee8d64 is the same hunk.
   - **Stack note (not a reader-focus issue):** compact and i18n-views on top of round 9 also conflict in `AccountSettingsModal.tsx` and the catalogs (against sender-identities). Those branches' integrators must resolve that.

## Cleanup
- Tracked files unchanged.
- Nothing created in the worktree, so there is no worktree `.tmp`. The only `/tmp` scratch file I created is removed. Headless browser profiles ran under Playwright's normal `/tmp` handling, and `/tmp/playwright-transform-cache-1002` is Playwright's per-user cache (left in place).
- I stopped only my own processes, by recorded PID: harness 2900672, servers 2901465/2902165. Ports 3895–3899 are free.
- Heavy copies removed (node_modules, `.next`, scratch clone); the regression directory is now 31 MB.
- Load: 9.91 at the start, 3.67 at the end (12:16:51 UTC).

```json
{"verdict":"FIX","reviewed_commit":"ccddc4dafc3007f6235db6f27f98b585139fbf4b",
"findings":[
{"severity":"P2","location":"app/components/MailClient.tsx:4931 (also :4944,:4967,:2749,:2893)","issue":"With the focus preference saved and no message open, the list renders split but infinite scroll is disabled (guard uses readerLayout, not the effective layout)","reproduction":"Save focus preference, reload (or archive to end-of-list fallback), scroll list to bottom","result":"focus pref: 33 of 126 -> 33 of 126, 0 page requests; split pref: 33 -> 126, pages 2-5 (20-row pages; real page size 300)","required_fix":"Use the effective layout (readerFocused) for paging, notice anchor and scroll capture; add a regression test"},
{"severity":"P2","location":"lib/ui/useReaderFocusPlacement.ts:13 + ReaderToolbar.tsx:166 + lib/ui/readerFocus.ts:36","issue":"Keyboard entry (Enter, Shift+Enter) opens the Back tooltip; the first Esc only closes it","reproduction":"Focus a row, press Enter (or select and press Shift+Enter), press Esc","result":"escPresses=2, tooltip 'Back to messages (Escape)'; the other 5 paths need 1 Esc; all 7 focus Back and restore scroll 600->600","required_fix":"Don't open the tooltip on programmatic focus (or don't let it swallow Esc); add a Playwright test with one Esc after Enter"},
{"severity":"P2","location":"app/api/_helpers/requestOrigin.ts:37 (callers: useMessageDeleteActions.ts:342, app/message/window/page.tsx:225, useThreadContent.ts:182, MailClient.tsx:4476, topic/alias/attachment/calendar-event DELETE)","issue":"Shared bodyless contract not repaired: request.body is never null in production, so every bodyless command returns 400 json_required; r2 patched only 4 client commands","reproduction":"Trash folder, open a message in focus, toolbar Delete; or a bodyless POST/DELETE to delete, resync, topics, recipient-aliases, calendar/sync","result":"400 {code:json_required}, message stays, 'Operation failed (400)'; identical on 11dc3c5","required_fix":"Fix the server guard (empty body + no content-type = bodyless) or one shared client helper for all callers; add a real-HTTP bodyless-delete check"},
{"severity":"P3","location":"app/components/mailclient/message/ThreadMessageCard.tsx:604,:826","issue":"Avatar initials printed","reproduction":"Print any message or thread","result":"PDF text ends 'SRSR' / 'MBMB' x5","required_fix":"Exclude avatars from data-mail-print"},
{"severity":"P3","location":"tests/browser/ui/qa-reader-focus.spec.ts:7, doc/SHELL.md:59","issue":"Evidence default is ../briefs (outside repo); overwrites preserved r1/r2 PNGs","reproduction":"Run qa-reader-focus without READER_FOCUS_EVIDENCE_DIR","result":"Writes to ROOT/briefs/reader-focus-evidence","required_fix":"Default to .tmp/reader-focus-evidence"},
{"severity":"P3","location":"ReaderToolbar delete/undo flow","issue":"Keyboard focus drops to BODY after toolbar Delete and after Undo","reproduction":"Focus view, toolbar Delete, then Undo","result":"activeElement BODY (Archive keeps focus on Archive)","required_fix":"Keep focus on the toolbar/Back after Delete and Undo"},
{"severity":"P3","location":"history e9d2428","issue":"641,507 bytes of PNGs still in branch history","reproduction":"git log --stat e9d2428","result":"Tree clean, blobs remain in history","required_fix":"Squash or rewrite before integration if history size matters"}],
"checks":{"1":"verified (notices/Undo 1280+1024 in view, print PDF clean + 6-page pagination, all entry paths focus Back + restore scroll, continuation next/previous/end/async, counter across pages) except P2-1/P2-2","2":"verified for row+toolbar archive (200); other bodyless callers still 400 -> P2-3; related suites pass","3":"verified (shortcut row removed, tooltips + aria-keyshortcuts, localized group name, no PNG/PDF in tree; history P3)","4":"verified (split list 0 px diff vs 11dc3c5, reader differs only by expand row; mobile 390 0 px; collab bar usable; catalog parity 881 keys; no display-text logic)","5":"all gates pass","6":"notes valid; integration/stage 11dc3c5 clean; local 09b2695 conflicts only in the MailClient import hunk (resolved, typecheck 0, tests pass)"},
"gates":{"typecheck":"exit 0, 0 errors / 1206 files","focused":"9 DOM suites x3: 74/74 each; server 35/35","playwright":"qa-reader-focus 6 passed (1.8m), production build on 3896","test_ci":"exit 0; server 2805/0 (305 files, 15332 assertions, 337.4s); DOM 486/0 (60 files, 2767 assertions, 61.9s)"},
"merge_tree":{"origin/integration/stage 11dc3c5":"clean, tree 628f42515fdf09cdca0d802d9489b5610e4d2595","local integration/stage 09b2695":"MailClient.tsx (import hunk) - resolved per notes, typecheck 0, focused 74/74x3","feat/status-bar-compact 5809d89":"AppShell.tsx, doc/SHELL.md - resolved per notes, typecheck 0, focused 74/74x3, shell DOM 44/44","feat/sender-identities-3 26d82d8":"MailClient.tsx, PreferencesTabContent.tsx, resyncMessage.senderKey.test.ts, de.json, en.json (already integrated in 09b2695)","fix/i18n-views 4d81222":"lazyAdmin.dom.test.tsx - resolved per notes, typecheck 0, 55/55, catalogs 10/10","fix/admin-mailbox-self-grant b6c1ba9":"playwright.qa-round2.config.ts - resolved per notes, typecheck 0","fix/sync-folder-account-mismatch 1ee8d64":"MailClient.tsx (import hunk, same as the implementer's 20d93cf note) - typecheck 0, 60/60","stack_note":"compact and i18n on round 9 also conflict in AccountSettingsModal.tsx and the catalogs (vs sender-identities) - not reader-focus"},
"cleanup":{"tracked_files_unchanged":true,"tmp_removed":true,"ports_free":true}}
```
