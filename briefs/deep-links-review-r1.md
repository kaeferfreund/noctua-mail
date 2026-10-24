# Review r1: feat/deep-links 01b7727 (correctness + mailbox-access lens)

Reviewer: Claude Opus 5.5, 2026-10-23. Read-only; no change to the worktree, no commit. Scratch copies
`wt-deep-links/.tmp/review-src` (01b7727) and `.tmp/base-src` (f29fbd6, comparison baseline), removed after the review.
Browser checks used the existing QA fixture runner on ports 4030–4033 (synthetic data only).

## Verdict: **FIX**

Two P1s, three P2s. The P1s break phone navigation from the sidebar and the sidebar's pending-row feedback; both
have small fixes that I tested in the scratch copy (all five `qa-deep-links.spec.ts` cases stayed green with them).

| # | Sev | Finding |
|---|---|---|
| 1 | P1 | 390 px: picking a mailbox or folder in the sidebar sheet is undone right away |
| 2 | P1 | Sidebar pending row clears immediately (merge resolution, brief item 3), confirmed |
| 3 | P2 | Filter inside a virtual view: Back gets stuck on the same URL |
| 4 | P2 | Back after delete/move from the reader jumps into Trash/Archive ("verschoben") |
| 5 | P2 | `mailboxSwitchRapid` "A → B → A" failure: URL left over from the previous test (test isolation, not a product race) |

## Gates (scratch copy of 01b7727)

| Gate | Result |
|---|---|
| `bun check` | 0 errors (1,319 files) |
| ESLint on touched TS/TSX | 0 errors; 67 warnings MailClient.tsx + 1 AdminPanel.tsx (same two files at f29fbd6: 74) — no new ones |
| `bun test lib/navigation lib/i18n/catalogs.test.ts` | 23 pass |
| Focused DOM (`useDeepLinks`, `app/hooks`) | 124 pass |
| Full `bun run test:dom` | 713 pass, **1 fail** (`mailboxSwitchRapid` A→B→A, see #5) |
| `mailboxSwitchRapid.dom.test.tsx` on its own | 3 × 4/4 pass |
| `bun run build` (inside the QA runner) | OK |
| `qa-deep-links.spec.ts` (production build) | 5/5 pass, both on 01b7727 and with the fixes for #1/#2 |
| Review probe spec (production build, 390 px + desktop) | reproduced #1, #2, #3; all three pass with the fixes |

## P1

### 1. 390 px: picking a mailbox or folder in the sidebar sheet is undone right away
`app/components/mailclient/useDeepLinks.ts:51-52`, together with `app/hooks/useMobileOverlayHistory.ts:26,30-46` and `app/components/ui/sheet.tsx:22`.

- **Repro (browser, 390 × 844, QA fixture):** open the sidebar → tap "QA Second". The server receives
  `switch-account` `["qa-second","qa-shared"]`, the URL ends at `?accountId=qa-shared&folderId=qa-shared:INBOX`
  and the list stays on QA Shared. Same with a folder: tap "Sent" → the URL and the list go back to INBOX.
  Desktop is not affected (overlay history only runs on phones).
- **Cause (instrumented trace):** closing the sheet runs a programmatic `history.back()`
  (`useMobileOverlayHistory` cleanup). The deep-link `popstate` listener (non-capture, registered at mount)
  ran **before** the overlay module's capture listener, so `isMobileOverlayPop(event)` was still `false`:
  `popstate false ?accountId=qa-shared…` → `request pop qa-shared` → the reselect cancels the B switch, or for
  folders, `applyPlace` brings back the previous folder. The order of the two listeners on `window` cannot be
  relied on. Any other phone Sheet that closes with Back (message "more" sheet, move/label sheets, calendar)
  triggers the same extra `request()`, and `applyPlace` then clears and reloads the open reader.
- **Also seen:** `write()` copies `noctuaMobileOverlay` from the current state into the pushed URL entry
  (`useDeepLinks.ts:41`). The sheet cleanup then sees "its" id on the new entry and steps back off it, which
  leaves a duplicate Forward entry (P3 part, see backlog).
- **Fix (tested):** classify the pop only after the overlay handler has run, e.g.
  ```ts
  const onPop = (event: PopStateEvent) => {
    // Listener order on window is not guaranteed; let the overlay handler mark its pops first.
    window.setTimeout(() => { if (!isMobileOverlayPop(event)) request(parseDeepLink(window.location.search)); }, 0);
  };
  ```
  With this, the phone mailbox switch sends exactly `["qa-second"]`, Back → qa-shared, Forward → qa-second, and
  the folder pick stays on Sent. `useDeepLinks.dom.test.tsx` "cancels stale message loads when Back arrives" then
  needs its `pop()` helper to wait one macrotask (`await act(() => new Promise(r => setTimeout(r, 0)))`). That
  waits for the deferred handler and does not weaken the assertion.
  An alternative that does not depend on timing: make `isMobileOverlayPop` decide from the module state itself
  (`consumedPops.has(e) || returning || (overlays.length > 0 && overlays.at(-1)!.id !== e.state?.noctuaMobileOverlay)`).
  I did not test this variant.
- Add a 390 px browser case: sidebar sheet → other mailbox, and sidebar sheet → other folder.

### 2. Sidebar pending row clears immediately (brief item 3) — confirmed
`app/components/MailClient.tsx:5196`, `app/components/mailclient/useDeepLinks.ts:154-158`, `app/components/shell/ShellSidebar.tsx:237`.

- `onSwitch` now returns `undefined`, so `Promise.resolve(undefined).finally(...)` clears `pendingAccountId` in the
  next microtask.
- **Repro (browser):** with `switch-account` delayed by 1.5 s, the row's `aria-busy` samples over 750 ms were
  `[null,null,null,null,null]`. With the fix below: `["true","true","true","true","true"]`. The perf/switch-folder-tree
  feedback is gone on 01b7727. `Shell.dom.test.tsx` cannot catch this because it mocks `onSwitch`.
- **Minimal fix (tested):** `request()` returns a promise that resolves when its transaction settles or is
  superseded, and `navigateAccount` returns it:
  ```ts
  // Pending gets done: () => void
  pending.current?.controller.abort(); pending.current?.done();
  let done = () => {}; const settled = new Promise<void>(r => { done = r; });
  pending.current = { target, initial, historyMode, phase: "requested", controller: new AbortController(), done };
  update(); return settled;
  // settle phase: pending.current = null; work.done(); …
  const navigateAccount = useCallback((accountId: string) => { …
    return new Promise<void>(resolve => afterMobileOverlayNavigation(() => {
      write(target, "push"); void request(target).then(resolve); }));
  }, [request, write]);
  // MailClient.tsx:5196
  onSwitch: navigateLinkedAccount,
  ```
  A superseded click resolves early, but ShellSidebar's token check ignores it, so A → B → A keeps the latest row
  pending. With the fix, the rapid DOM tests pass except "A → B → A", which fails only because of #5. Add one assertion to `mailboxSwitchRapid` that the clicked row has
  `aria-busy="true"` until the switch settles; it is the only test that uses the real MailClient wiring.

## P2

### 3. Filter inside a virtual view: Back gets stuck on the same URL
`app/components/MailClient.tsx:4819` (`applyPlace`), `app/components/mailclient/useSearchState.ts:247-259` (virtual-view auto-clear), `app/components/mailclient/useDeepLinks.ts:142-152` (UI → URL writer), `lib/navigation/deepLinks.ts:64`.

- **Repro (browser, desktop):** `/?accountId=qa-shared&view=virtual:unassigned` → Search filters → Unread.
  The writer pushes the intermediate `view=…&filter=unread` and then pushes again once the auto-clear (setTimeout 0)
  drops the view. Three Backs afterwards: the URL stays at `?accountId=qa-shared&scope=all&filter=unread` and
  `history.length` stays 5. Each Back restores `view+filter`, the auto-clear drops the view, and the writer pushes
  again, which cuts off the history behind it. The cold link `?view=virtual:open&filter=unread` behaves the same way.
  With fix #1 in place the timing changes: Back gets through, but the restore of that entry never settles
  (`expected.view` ≠ state), and the URL stops following the UI until the next navigation. Same root cause.
- **Fix:** in `applyPlace`, apply the same rule as the auto-clear: `targetView = requested.query.trim() || requested.badges.length ? null : requested.view`.
  When the only change between two states is that auto-clear dropped `view`, the writer should replace, not push.
  Optional safety net: if the place/settle phase gets no matching state within a few renders, accept the committed
  state and finish the transaction, so the URL never stops being written.

### 4. Back after delete/move from the reader jumps into Trash/Archive
`app/components/mailclient/useMessageDeleteActions.ts:642-646` (selects the next message after a removal), `lib/navigation/deepLinks.ts:64-72`, `app/components/mailclient/useDeepLinks.ts:104-110`.

- **Path (code):** open X, delete or archive it. The reader moves on to Y (or back to the list), and the writer
  **pushes** that change. Back → `openMessageId=X&folderId=INBOX` → the detail route returns X in Trash/Archive →
  notice "Diese Nachricht wurde verschoben…" and the **Trash/Archive folder** opens. If X was expunged, Back shows
  "nicht mehr verfügbar" instead. This happens in everyday triage: delete, then swipe back.
- **Fix:** a selection change caused by a removal should replace the current entry. Either the delete/move
  handlers set a one-shot "replace next write" flag in the hook (like `keyboard`), or the writer replaces when
  `last.messageId` is no longer in the loaded list. Add one focused test: delete in the reader → Back lands on the
  previous place.

### 5. `mailboxSwitchRapid` "A → B → A before B commits" failure — test isolation, not a product race
`app/components/mailclient/mailboxSwitchRapid.dom.test.tsx:55`, `lib/testSetupDom.ts`.

- **Deterministic repro:** `bun test --config=bunfig.dom.toml app/components/mailclient/useDeepLinks.dom.test.tsx app/components/mailclient/mailboxSwitchRapid.dom.test.tsx`
  fails every time, with `applied = ["account-c","account-a"]` (expected `["account-b","account-a"]`).
- **Cause:** when the file runs alone, the happy-dom URL is `about:blank`, so the deep-link path is effectively
  inactive. After a DOM file that sets an http URL, the URL persists between tests. Test 1 leaves
  `?accountId=account-c…`, so test 2 mounts with a cold link to C. That switch to C is legitimate, and
  `persistSelection` skips the superseded B write. In the combined run the order of files decides whether it fails.
- **Product check:** with a real URL reset before each test (`happyDOM.setURL("http://localhost:4000/")`), all four
  rapid tests pass. The URL, switch and list request sequence is identical to f29fbd6 (no extra switch, no extra
  folder/list load). A probe that sends popstate during an in-flight A → B switch ends on A, B is never shown, and
  the server ends on A.
- **Fix:** reset the URL per test, globally in `lib/testSetupDom.ts`
  (`afterEach(() => window.history.replaceState(null, "", "/"))`), and give it a real origin at preload
  (`GlobalRegistrator.register({ url: "http://localhost/", … })`), so MailClient DOM tests exercise the URL code
  path consistently. This is not a weakened assertion; it removes cross-test state.

## Checked without finding (brief items 1, 2 and 4)
- Round trip mailbox/folder/message/search/group/filter/settings/admin/panel/calendar/compose: parser and serializer
  match, unknown values fall back. Reload keeps the place; the list-predecessor entry is not duplicated after a
  reload (`noctuaMessageEntry` survives in `history.state`).
- Push vs replace: typing in search and keyboard j/k/arrows replace, clicks push, cold folder discovery replaces.
- 390 px reader: exactly one entry, header "Zurück" = browser Back, Forward reopens the reader (existing spec).
- Legacy `messageId` (RFC) / `openMessageId` / `accountId` / `scope` / `q` / `mailto` / `openCalendar`, warm
  SW `noctua:notification-open`: these go through one resolver and are canonicalised to `openMessageId=<local id>`.
- Access: a link to a non-member mailbox triggers no request to `/api/accounts/qa-private/*` and falls back to the
  current mailbox with a German notice. The detail route answers 403; a deleted message shows a notice and keeps the
  folder. 401 keeps the target through login.
- PII: account IDs are `acc-<sha256>` hashes and message IDs are local hashes; draft content and recipients are
  never serialised.
- "Link kopieren" builds the link from the message's own identity (`messageDeepLink`), also in the pop-out.

## P3 → backlog (no fix round)
- deep-links | Phone sidebar switch leaves a duplicate Forward entry. `write()` copies `noctuaMobileOverlay` into the pushed entry and the sheet cleanup steps back off it; strip that field in `write()` or push only after the overlay's Back settled | review-r1 #1
- deep-links | Clicking a sidebar row before the initial restore is `ready` (bootstrap folders still loading) is queued; A→B→A in that window sends no switch at all. Outcome correct; if bootstrap folders fail, `initialFoldersLoadedAccountId` never matches and sidebar clicks stay queued until a reload (`MailClient.tsx` `ready` expression) | review-r1
- deep-links | Unbounded list paging for an off-page link target (`MailClient.tsx:4869`: pages of 300 until found). Old reminder/notification targets in large folders can load the whole folder; cap at a few pages (reader is already open) | review-r1
- deep-links | `navigateMessage` (reminders, calendar, notices) resets the whole place: closes the calendar sidebar/status panel on desktop, clears search/filters, minimises an open composer. Keep panel/calendar/compose from the current state | review-r1
- deep-links | Revocation edge: if `accounts` no longer contains the *current* mailbox (e.g. `/api/accounts` refresh) while a transaction is pending, `useDeepLinks.ts:76-78` and `authorizeDeepLink` fall back to the same revoked id and repeat the "kein Zugriff" notice per cycle; finish the transaction and call `loadInitialData()` instead | review-r1
- deep-links | Folder IDs in the URL contain the server folder path (folder names). Allowed by the brief, but mention it in doc/DEEP-LINKS.md | review-r1
- deep-links | `mailto=` with recipients is rewritten to `mailto=mailto:`; a reload then opens a second, blank composer | review-r1
- deep-links | de.json `Notifications.deepLink.moved`: "Ihr aktueller Ordner" reads as formal "your"; use "Ihr" → "ihr", or "Der aktuelle Ordner der Nachricht wurde geöffnet." | review-r1
- deep-links | `keyboard` flag stays set after arrow-key scrolling in the reader until the next pointerdown; a later message change can then be written as replace | review-r1
