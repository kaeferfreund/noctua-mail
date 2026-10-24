# Reader focus — fix round 4 (review r3 P3s, round-9 merge)

- **Worktree:** `wt-reader-focus`, branch `feat/reader-focus`
- **Commits:** e7d00ee → **4634b91**, 10 commits on the first-parent chain, nothing pushed, no history rewritten.
- **Old PNGs:** the PNG blobs from e9d2428 are still in history, as decided.
- **Evidence:** `briefs/reader-focus-evidence/r4/`
  - `logs/`: gate logs, the live probe script and its result.
  - `browser/`: screenshots and the PDF from the final `qa-reader-focus` run.
- **Data:** synthetic only.

## Commits

| SHA | Change |
| --- | --- |
| 1fb0bc2 | Merge integration/stage e70c30b into feat/reader-focus |
| 98666fa | fix(reader): exit-focus target keyed off the reader's message (P3-1) |
| 97eb6bc | fix(api): bounded read deadline for request bodies (P3-2) |
| 3cbff28 | test(api): server port typing; typecheck back to 0 after 97eb6bc |
| bdf25c4 | test(reader): evidence default in `.tmp`; QA fixture documented (P3-3, P3-4) |
| 6c81714 | docs(shell): merge notes for the round-9 baseline |
| ed59980 | refactor(reader): toolbar message menu passed as a render function (lint back to baseline) |
| fe2d341 | test(reader): print case uses the localized "Inbox" search label (needed after the merge) |
| cc7c328 | fix(api): never await the cancel of a rejected body (P3-2, found by the live probe) |
| 4634b91 | test(api): header-variant typing; typecheck back to 0 after cc7c328 |

Two commits (97eb6bc and cc7c328) failed typecheck when they were committed. A pipe masked the exit status. Each is fixed by the commit right after it (3cbff28 and 4634b91). Because history may not be rewritten, they were not squashed.

## Merge of e70c30b

Conflicts were the three expected files. Each was resolved byte-identically to deploy/dev-stage `deff0b5`, which I checked with a file diff.

- **`app/components/MailClient.tsx`, import hunk:** kept both sides.
  - From round 9: `useSenderMessages`, `useStartupSync`, `useEmptyFolderRepair`, `isAccountFolder`, `findInboxFolder`.
  - From reader focus: `ReaderToolbar`, `useReaderFocusPlacement`, `useReaderFocus`, `useReaderNavigation`, `readerShortcut`.
  - The rest of the file differs from deff0b5 only in build-info and status-bar-compact code, which exists only on dev-stage.
  - After the merge there is exactly one `tn`, one `authState` state and one `readErrorMessage = useApiErrorMessage(...)`.
  - `useApiErrorMessage.ts` is unchanged from e70c30b, so 97dd982's resolver identity across language switches is kept.
- **`app/components/mailclient/lazyAdmin.dom.test.tsx`, Retry hunk:** kept this branch's async `act` and its single combined `waitFor`.
- **`playwright.qa-round2.config.ts`, `testMatch`:** `…|qa-admin-self-grant|qa-reader-focus`.

Checks run right after the merge:
- `bun install --frozen-lockfile`: `bun.lock` and `package.json` are identical to e70c30b. Next 16.4.2, React 19.3.1.
- Typecheck: 0 errors in 1,260 files.
- Focused server suites: 131/131.
- Focused DOM suites, three runs: 59/59 each.
- `useAccountController.dom.test.tsx` (97dd982's regression test): 13/13.

## P3 fixes

### P3-1: exit-focus target
- **Fix:**
  - `MailClient.tsx` now passes `activeMessage?.id ?? ""` to `useReaderFocusPlacement` instead of `activeMessageId`.
  - The hook (`lib/ui/useReaderFocusPlacement.ts`) keeps the last non-empty reader id. So when the reader closes in the same commit that leaves focus, the target is still the last shown message.
- **DOM test** (`readerFocus.dom.test.tsx`): "exit focuses the reader's message row, also when the reader closes in the same commit".
  - Opening the second row and leaving focuses the second row.
  - Closing with an empty id focuses the last reader row.
  - Without the hook guard the test fails.
- **Browser spec:** after Escape, focus must now be the reader's row or the list container. Any other row fails the test.
- **Repeat run** (`--repeat-each=5`, production build):
  - Enter path: focus is on the reader's row, 5/5.
  - Click + Shift+Enter path: focus is on the list container, 5/5. This is the documented fallback for a row that is not found. It also happened on ccddc4d and in the review's 1.5 s run.
  - No other row was ever focused.

### P3-2: stalled body in the mutation guard
- **First fix (97eb6bc):**
  - The body reader `readBoundedBody` is shared by the mutation and bodyless guards and by `readAuthJson`.
  - It now gives the whole read `BODY_READ_TIMEOUT_MS` (10 s). On timeout it cancels the stream and rejects with `BodyReadTimeoutError`.
  - The guards treat an unreadable body as not empty, so they return 400.
  - All `readAuthJson` callers already have a `.catch`, so a timeout gives their existing 400.
  - The JSON route handlers (`requireJsonSameOrigin` and `request.json()`) do not share this reader and are unchanged. The review's `PUT /topics/x` observation stays as it was.
- **Probe on the production build after the first fix:**
  - No chunk sent, then stall: 400 at 10 s.
  - One chunk sent (`3\r\nabc\r\n`), then stall: still open after 30 s.
- **Cause, from instrumenting a temporary `next dev` on 3871 (instrumentation not committed):**
  - The first chunk is delivered.
  - The guard sees it as not empty and then *awaited* `reader.cancel()`.
  - Bun's request stream settles that promise only when the client sends more data.
  - The deadline was not being raced at that point.
- **Second fix (cc7c328):** every reject path now starts the cancel without awaiting it: declared length, oversized chunk, and deadline.
- **Tests:**
  - A real chunked HTTP request through `Bun.serve` and a raw socket. Fake timers advance to the deadline. Covers both guards and pre-session logout, with no chunk and with one chunk.
  - A stalled stream for `readAuthJson`: still pending at 9,999 ms, `BodyReadTimeoutError` at 10,000 ms, stream cancelled and unlocked.
  - A source whose `cancel()` never settles: both guards, with and without Content-Length, plus logout.
  - With either fix removed, the matching tests fail by timing out.
- **Live probe on the final production build** (`logs/probe-result.txt`; no cookie, `Transfer-Encoding: chunked`):

  | Route | One chunk, then stall | No chunk, stall |
  | --- | --- | --- |
  | `POST /threads/recompute` | 400 in 19 ms | 400 in 10,007 ms |
  | `DELETE /mcp-tokens/:id` | 401 in 21 ms (session check runs first) | 401 in 5 ms |
  | `POST /api/auth/logout` | 400 in 23 ms | 400 in 10,008 ms |

- **Not done:** the review's optional hardening, rejecting non-JSON requests with `Transfer-Encoding` up front. The deadline already bounds these requests.

### P3-3: evidence default
- The spec now defaults to `<checkout>/.tmp/reader-focus-evidence`. The path is resolved from the spec file and is untracked, like `qaRound2Session`'s `.tmp/qa-round2-evidence`.
- `READER_FOCUS_EVIDENCE_DIR` still overrides it, for example to point at a briefs directory.
- `doc/SHELL.md` describes the new default.
- Verified: the final run wrote 9 artifacts into `.tmp/reader-focus-evidence` and nothing outside the checkout.

### P3-4: QA fixture
- `doc/SHELL.md` and the spec header now name `QA_ROUND2_FIXTURE=1` and give the runner command:
  `QA_ROUND2_FIXTURE=1 QA_SHELL_PORT=<port> bun scripts/runQaShellBrowserTests.ts --config=playwright.qa-round2.config.ts qa-reader-focus`
- They also say that without the fixture the paging and print cases fail.
- PNG history is unchanged, as decided.

### Other changes needed after the merge
- **Lint (ed59980):**
  - Under round 9's scoped react-hooks rules, the merged branch added three MailClient warnings: one `refs` warning and two `preserve-manual-memoization` warnings at `bulkContextMenuActions` and `headerSelectionActions`.
  - The cause was `menu={renderMessageMenu(activeMessage, "thread")}`, which calls a function that reads refs during render.
  - `ReaderToolbar` now takes a `renderMenu` function prop instead. The list and reader orchestrators already pass `renderMessageMenu` the same way. The menu is now only built in focus.
  - All three warnings are gone.
- **Print spec (fe2d341):** round 9 displays INBOX as "Inbox", so the search field's accessible name is now "Search messages in Inbox".

## Gates (final head 4634b91 unless noted)

| Gate | Result |
| --- | --- |
| `bun run typecheck` | 0 errors, 1,260 files |
| Focused server suites (requestOrigin, readAuthJson, auth bodyLimit, mutationOrigins, i18n catalogs) | 134/134 |
| Focused DOM suites, three runs (readerNavigation, readerFocus, useMessageMutations, lazyAdmin, useMessageDeleteActions, MessageListOrchestrator, useSyncController + notice, useAccountController) | 73/73, 73/73, 73/73 |
| `test:ci` (final head) | exit 0. Server 2,925 pass / 0 fail (317 files, 18,398 assertions). DOM 591 pass / 0 fail (75 files, 3,299 assertions) |
| `test:ci` (6c81714, before ed59980/fe2d341/cc7c328/4634b91) | exit 0. Server 2,924 / 0. DOM 591 / 0 |
| `bun run lint` | exit 0, **0 errors / 180 warnings**. The round-9 baseline is 0 / 181; the difference is −1 because the branch removes one `exhaustive-deps` warning in `useMessageMutations.ts` |
| Lint, files touched since e70c30b (rule + source-line multiset) | MailClient 73 → 73. One existing `exhaustive-deps` warning (`setMessagesPage`) sits on a deps line the branch extended with `readerFocused`; it has the same message on stage. MessageViewOrchestrator 8 → 8. `useMessageMutations` 2 → 1. 0 new |
| `bun run build` | exit 0 (final head) |
| `qa-reader-focus` (round2 config, `QA_ROUND2_FIXTURE=1`, production build on 3870) | **8 passed (2.4 m)**. On ed59980 the first run had 7 passed and 1 failed: the print case's search label after the merge, fixed in fe2d341 (`logs/qa-reader-focus.log`) |
| Escape case `--repeat-each=5` (fe2d341) | 5 passed |
| `qa-bodyless` (production build on 3870) | 1 passed (19.8 s) |
| `tests/browser/auth/shell.spec.ts:229` alone (`AUTH_BROWSER_USE_BUILD=1`, port 3871) | 1 passed. Also passed on fe2d341 |
| Live stalled-chunked probe (production build on 3870) | all bounded, see P3-2 |
| `git diff --check` e70c30b..HEAD and e7d00ee..HEAD | clean |

Load average during the gates was 7–15 because of other threads. No gate needed a rerun because of load.

## Merge rehearsal (`git merge-tree --write-tree HEAD <ref>`, final head)

| Ref | Result | Notes |
| --- | --- | --- |
| origin/feat/status-bar-compact a864dfc | conflicts in `AppShell.tsx`, `doc/SHELL.md`, `messages/de.json` | see below |
| origin/feat/build-info 6307539 | clean (tree 80ae76c) | at r3 (b4d963f) there were 3 conflicts; with the e70c30b merge they are gone |
| origin/fix/sidebar-views-row 94f1a31 | clean (tree b5ddc84) | — |
| origin/feat/i18n-slice3 7c05ea6 | conflict in `tests/browser/compose/qa-compose.spec.ts` | the same hunks appear when merging e70c30b with slice3 (only the marker labels differ). Reader focus does not touch the file |

Per-hunk notes for status-bar-compact (they match deff0b5):
- **`app/components/shell/AppShell.tsx`, ShellHeader hunk:** keep this branch's `toolbar` condition, `(isMobile && navigation.view === "thread") || (!isMobile && panes.readerLayout === "focus") ? undefined : header.toolbar`, and take compact's `indicators={statusBar}`. deff0b5 lines 93–94 are exactly this.
- **`doc/SHELL.md` (add/add):** combine both under one `# Shell` title.
  - Reader-layout sections come first: description, verification (now with the `.tmp` default and the `QA_ROUND2_FIXTURE` text from this round), then merge notes.
  - Then the status indicator and its round records, as in deff0b5.
  - In split, notices are measured against the list; in focus, against `#reader`.
  - The header status stays visible in focus.
- **`messages/de.json`, two status hunks:** the hunks are identical when merging e70c30b with compact (only the marker labels differ), so they are not caused by reader focus. Resolve them as on deploy/dev-stage.

`doc/SHELL.md` now holds these notes in place of the round-8 rehearsal against 11dc3c5.

## Cleanup

- The worktree is clean and HEAD is 4634b91.
- I started three servers myself, each with a scratch data dir under `.tmp`:
  - the probe `next start` on 3870, twice;
  - the instrumented `next dev` on 3871.

  I stopped all of them by PID or process group. The QA and auth runners stopped their own servers.
- Ports 3870–3873 are free.
- `next dev` added a `nextjs-agent-rules` block to `AGENTS.md`. I restored the file and did not commit the block.
- The data dir `../data/noctua-data-reader-focus` was not used.
- `.tmp` is removed. Logs and browser evidence are kept under `briefs/reader-focus-evidence/r4/`.
