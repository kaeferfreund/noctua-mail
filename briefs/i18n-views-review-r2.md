**PIN — use 4d812228be2e447e1181caa1c808a5ea437e0bba for integration round 9, input 6, and the interim preview merge.** All r1 product findings are closed; no open P1/P2 finding on this branch. Fresh CI is **not green**: one inherited sender-fixture case encountered a SQLite lock. Preserve that result in the integration record.

Reviewed the clean detached checkout at `/home/monkey/code/noctua-mail/wt-review-fts`. All executable verification used disposable archives inside the approved [regression directory](/home/monkey/code/noctua-mail/briefs/i18n-views-regressions-r2). No source fix, merge resolution, commit, push or deployment was performed.

**R1 closure and browser evidence**

- Settings tabs pass in German and English at 320/360/390 px, plus 1280 px. Every mobile target is at least 44 px high and 111 px wide. German preferences: 84 px trigger around a 68 px label; English: 64/48 px. Adjacent labels have a 16 px gap. No overlap; wrapped text remains readable. Fix: `app/components/shell/MobileFrames.module.css:34`, used by `AccountSettingsModal.tsx:227`. Fresh [German 320 px PNG](/home/monkey/code/noctua-mail/briefs/i18n-views-regressions-r2/browser/i18n-settings-de-320.png); all six phone combinations have separate PNGs.
- At 320 px the sidebar sheet is 240 px wide. “Ungelesen & unbeantwortet” grows to a 56 px row at 320/360, returning to 44 px at 390. Labels remain inside their rows and clear their numeric badges. English rows remain 44 px. Fix: `ShellSidebar.tsx:130` and `ShellSidebar.module.css:2`. Fresh [sidebar PNG](/home/monkey/code/noctua-mail/briefs/i18n-views-regressions-r2/browser/i18n-sidebar-de-320.png).
- Actual `/message/window` readers show button/title “Posteingang” in German and “Inbox” in English at 1280/390/320 px. No raw `INBOX` remains in the folder tooltip. `app/message/window/page.tsx:387` uses the shared path helper; tree and main-shell badges use it too. Fresh [detached-reader PNG](/home/monkey/code/noctua-mail/briefs/i18n-views-regressions-r2/browser/i18n-detached-de-320.png).
- Real moves and undo pass in both locales. The additional review probe changes language through Preferences, **German → English → German**, without document navigation; a window sentinel survives. Re-triggered notices are “5 Nachrichten werden im Hintergrund nach „Gesendet“ verschoben.” / “Moving 5 messages to Sent in background.” Undo reports “Verschiebungen rückgängig gemacht.” / “Moves undone.” Inbox totals return to their pre-move values. `useMessageMoveActions.ts:373` resolves the destination with the active locale, included in its callback dependencies. Undo notices contain no destination field. Evidence: [runtime observations](/home/monkey/code/noctua-mail/briefs/i18n-views-regressions-r2/browser/review-runtime-locale.json).
- All **11 German corrections match the r1 list verbatim**, including ICU whitespace/punctuation and folder plurals. English `Shell.loading.mailbox` is now “Add mailbox”. [Exact comparison](/home/monkey/code/noctua-mail/briefs/i18n-views-regressions-r2/copy-check.json). Catalog/ICU parity passes; both catalogs retain 1,018 leaves.

The branch’s three browser cases passed across 22 viewport/locale groups. The independent live-switch case also passed: **4/4 cases, 30 fresh PNGs**, 1.7 minutes. T3’s native preview independently confirmed the German 320 px sidebar and settings measurements. The detached/move case recorded zero page exceptions.

**Raw-string sweep — German rendered text, titles and accessible labels**

The sweep covered `INBOX`, `Sent`, `Drafts`, `Junk`, `Trash`, `Archive`, `Assigned`, `Unassigned`, `Open`, `Starred`, `Todo`, `Focused`, `Action Queue` and `Invite Deck`. Protocol IDs/data attributes deliberately retain their original values.

| Surface | Result | Component |
| --- | --- | --- |
| Seven sidebar views and tooltips | No English/raw identifiers | `shell/ShellSidebar.tsx:130`, `MailClient.tsx:5354` |
| Eight folder rows and paths | Posteingang, Gesendet, Entwürfe, Archiv, Spam, Papierkorb; literal Projekte/Website preserved | `mailclient/folder/FolderTree.tsx:65`, `lib/i18n/folderNames.ts:14` |
| Settings tab strip/header | No English labels; MCP remains its proper acronym | `AccountSettingsModal.tsx:136` |
| Detached folder button/title | Posteingang; no INBOX | `app/message/window/page.tsx:387` |
| Move/undo notices | Localized destination and action in active locale | `mailclient/useMessageMoveActions.ts:373` |
| Settings account form body | **Known remaining, slice 3:** “Manage IMAP/SMTP credentials…”, “Account details”, “Delete Account”, Close/Save | `account-settings/tabs/AccountTabContent.tsx:51`, `:55`, `:280` |

Full observations: [DOM sweep](/home/monkey/code/noctua-mail/briefs/i18n-views-regressions-r2/browser/review-de-dom-sweep.json), [native preview measurements](/home/monkey/code/noctua-mail/briefs/i18n-views-regressions-r2/native-preview.json). Synthetic mailbox names/message content are user content. Other deferred auth/calendar/server-error prose remains documented in `doc/I18N.md:263`; this was not a comprehensive slice-3 workflow review.

**Logic by ID**

No display-label comparison remains in the reviewed view/folder UI logic. Virtual definitions store IDs, `messageKey` and query badge codes; selection/filter predicates use IDs. Special-use **display naming** uses case-insensitive IMAP flags, including Junk/Spam, without inferring from the visible name. Renamed protocol folders are covered by `lib/i18n/folderNames.test.ts:8` and `FolderTree.i18n.dom.test.tsx:10`; flagless custom “Sent” stays literal. Path and move-hook tests retain raw request/selection IDs, including a live locale change.

Existing discovery/classification heuristics at `lib/specialFolders.ts:182–187` still inspect normalized raw protocol names. They are unchanged baseline behavior, separate from display labels. [Sweep output](/home/monkey/code/noctua-mail/briefs/i18n-views-regressions-r2/logic-sweep.txt).

**Open P3 findings**

- **P3, confirmed baseline — damaged-shard fixture leakage.** `lib/teamAuthSlice3.test.ts:208` and `:366`; downstream `lib/db.folders.test.ts:107`. The implementer’s three stress failures are three repetitions of **“getFolders > returns folders across all accounts when no accountId is provided”**, not three distinct tests. Independently ran only “absent both, installed idempotent unassign/audit, partial schema durable failure after revoke” and “installed malformed activity schema with zero assignments remains cleanup_pending”, then closed cached DB connections and called global `getFolders()`. Both **4d81222 and 11dc3c5** produce **2 pass / 1 fail, 12 assertions**, with “Incomplete account shard format 3; explicit atomic repair required” at `lib/db/shardFormat.ts:77`. Relevant fixture, folder DB, format and harness blobs are identical. The fixtures drop/recreate collaboration tables and leave their registered shards without the original writer guards. Fix their isolation/guaranteed teardown; retain production fail-closed validation. Opened a [local P3 follow-up](/home/monkey/code/noctua-mail/briefs/i18n-views-regressions-r2/P3-baseline-corruption-fixtures.md), with branch/baseline logs and the exact reproducer adjacent. No full stress rerun.
- **P3, inherited test path; intermittent cause not fully established — sender fixture direct write locks.** `lib/testFixtures/verifySenderIdentity.ts:339`, invoked by `lib/sendIdentity.routes.test.ts:7`. Fresh full CI fails its direct `DELETE FROM user_accounts` with `SQLITE_BUSY` after 4.99 s. Both files are byte-identical at baseline/head. One isolated run on each revision passes (5.89/6.20 s), so the full-run lock was not reproduced in isolation. Investigate fixture background DB activity and serialize that write through the existing DB/retry mechanism; retain role/revocation assertions. This is not established as an i18n regression. Do not report fresh CI as passing.

**Merge resolutions for the integrator**

Read-only `git merge-tree --write-tree <target> 4d81222` checks used the exact remote heads below, verified again with `ls-remote`. Raw conflicts and merged trees are retained under the regression directory. Apply normal post-merge gates; these are resolution instructions, not tested merge commits.

**Sender identities 3 — 26d82d81126639afd82cf5d0d53ff1093b9959c7:** five conflicting files, twelve hunks.

- `AccountSettingsModal.tsx`, four hunks: (1) put `"use client"` first and keep both `useSenderMessages` and `useTranslations`; (2) keep both component hook calls; (3) retain the identities tab with `senderMessages.identitiesTitle`, localize all existing tabs with `t`, preserving disabled/access filtering and aria labels; (4) include both translation dependencies and preserve the sender branch’s preferences-first fallback. Keep auto-merged identities content and SenderPreferences injection, the translated frame/header, mobile class and r2 growing-label CSS. This combines sender tab injection with the localized layout.
- `PreferencesTabContent.tsx`, two hunks: (1) combine `type ReactNode` and next-intl imports, retaining localized errors and optional `senderPreferences`; (2) keep `!senderPreferences &&` around the localized signature selector, its closing brace, and injected content below the fieldset. Preserve sparse PUT patches, null/inherit behavior and localized options; no duplicate selector.
- `lib/mail/resyncMessage.senderKey.test.ts`, two hunks: follow the **binding r9 prompt**: choose sender’s `realResyncTest` / `NOCTUA_REAL_RESYNC_SENDER_KEY`, escaped anchored names, named-pass plus zero-failure checks, and 20,000 ms budgets. Remove competing `runIsolated` / `NOCTUA_RESYNC_TEST_CHILD`; use `realResyncTest` for the collision case too. Preserve case assertions and stage FTS/source-ownership behavior; never nest wrappers.
- `messages/de.json` and `en.json`, two hunks each: first union full `Settings.sender`/`Settings.edit` with members/preferences/roles/tabs. Second retain all existing namespaces plus `Compose.sender`, `Compose.from`, `Compose.closeComposer`, `Compose.fromValue`, `Errors.sender`, Views and Folders. Deep-merge full Admin. Preserve all 75 sender additions, the 11 reviewed German corrections and English “Add mailbox”; German `Settings.language.saving` stays stage’s “Sprache wird gespeichert …”. No whole-file winner or duplicate keys. Rerun leaf/ICU parity. This matches `briefs/integration-stage-r9.prompt.md`.

**Admin self-grant — b6c1ba94019dad49410dba7df623ece2f10a26a8:** one `lib/i18n/catalogs.test.ts` hunk. Retain the complete self-grant test and all three views/ICU/round-two-copy tests as separate fully closed blocks. Keep self-grant catalog keys. Do not lose r2 assertions or reuse closing braces.

**Status bar compact — 5809d898b7077793be30bfde7262d4977862d2b2:** contains **old 992b220**, not the r2 follow-ups. One conflict file, `messages/de.json`, two hunks.

- First hunk: retain compact status `label`, process/mailCheck/exception/reminder objects and singular `phase` tree. Its active duration/recurrence consumers require **`{value}`**, matching automatically merged English; do not pair those with r2’s `{duration}`/`{summary}` templates.
- Second hunk: retain singular `mode`, `updatedAt` and `calendarEvent`, applying the reviewed recent-sync wording to the active mode. Preserve r2’s tested `modes.recent`, `syncingFolders` and `upcomingSummary` leaves **in both languages**, or migrate all corresponding tests/consumers deliberately. Automatic English merging drops 38 old leaves, including the scalar-to-object `mailCheck` transition; [exact inventory](/home/monkey/code/noctua-mail/briefs/i18n-views-regressions-r2/status-auto-en.json). Restoring German keys alone breaks parity.
- Reconcile beyond markers: preserve wrapped settings tabs, sidebar grid/compact counts, shared detached paths, active-locale move notices and “Add mailbox” assertions alongside compact status/calendar/focus changes. `ProcessStatusPopover.tsx:40` and `:64` currently use raw folder `.name`; apply `getFolderDisplayName(folder, locale)` at both scope sites to avoid reintroducing raw names. Run combined status/i18n browser and ICU regressions.

**Reader focus — 14a1f8ef8ba54cb5eab0cf75de72606746d70a10:** one `lazyAdmin.dom.test.tsx` hunk. Keep reader-focus’s asynchronous `act` around Retry and combined `waitFor` checking Admin absence **and exactly one idle task**. This preserves r2’s cleanup wait. Keep cold-import checks, timeouts and auto-merged “Add mailbox” assertions. Actual reader/focus layout changes auto-merge; retain folder localization.

**Sync-folder/account mismatch — 20d93cf4bca6df4d7c128ae173710f188882d6b4:** clean. Preserve folder/account validation and switch reset alongside ID-based activation and locale dependencies. No conflicting hunk.

**Deploy dev-stage — 580ee852fc436fa0f2266e8d99b044c321bcfd8b:** one `catalogs.test.ts` hunk, identical to the admin resolution above. This head contains self-grant and **does not contain sender-identities-3**. If the deployment head advances, recompute conflicts and apply sender resolutions if present. No other current conflict.

**Integration stage — 11dc3c5f50826aec73f7547990e3b89def1dd08b:** clean ancestor merge. Round 9 merges sender before views, so use the exact sender resolutions above and retain input 4’s self-grant keys/tests.

`doc/I18N.md:366–399` agrees with the sender/admin hunk structure and combined UI behavior. Its `:381` instruction to “select one” subprocess wrapper is less specific than the r9 prompt: **choose sender’s wrapper explicitly**. Earlier absent-reader/status-branch statements are historical; the latest comparisons above supersede them. Additional [per-hunk notes](/home/monkey/code/noctua-mail/briefs/i18n-views-regressions-r2/merge-resolution-notes.md) are retained for handoff.

**Independent gates**

All workloads ran at niceness 15 or lower priority.

- `bun run typecheck`: exit 0, zero errors, 1,202 files; 0.63 s.
- Catalog + folder-name tests: **19 pass / 0 fail**, 5,192 assertions, two files; 0.08 s.
- Affected DOM/server suites: **240/0 twice**, 1,002 assertions/run, 30 files; 10.63 / 11.04 s.
- Complete `timeout 1800 bun run test:ci`: **exit 1**, **2,815 pass / 1 fail**, 16,976 assertions, 305 files; Bun 467.55 s, wall 470.81 s. Only the sender fixture above failed. Its `&&` prevented the DOM phase.
- Separate full `bun run test:dom`: **480 pass / 0 fail**, 2,779 assertions, 62 files; Bun 81.09 s. Lazy-admin cleanup passes.
- `timeout 600 bun run lint`: exit 1, baseline **1 error / 25 warnings**, **zero new diagnostics**; normalized diagnostics exactly match implementer baseline evidence. Error: `calendar/useCalendarConflicts.ts:58`, `react-hooks/set-state-in-effect`; 57.23 s.
- `timeout 1200 bun run build`: exit 0, production compilation/type checking/static generation/standalone preparation; 66.54 s.
- Production browser on **3891**, IMAP/SMTP fixtures **3893/3894**, no control listener: **4/4 pass**, 22 branch groups plus live-switch probe, 30 PNGs. Browser launcher exits 0 after preview release.
- `git diff --check`: exit 0. Checkout remains clean at the requested SHA.

Review setup error: I inadvertently started an additional CI attempt before the dependency copy completed, then stopped it. Its missing-module output is retained as `bootstrap-invalid-*.log` and excluded from product evidence. The completed CI run above was not repeated. No stress suite was rerun.

Owned browser/app/fixture processes stopped through the harness; ports **3891–3894 have no listeners**. T3 preview tab closed. Copied private `.env.local` removed; synthetic browser login/TOTP seed removed by harness cleanup. No other worktree was edited.

Recorded load: start **2026-10-23 11:03:39 UTC — 19.38 / 17.13 / 14.35**; end **11:18:51 UTC — 9.51 / 9.40 / 11.46**.

Report: [i18n-views-review-r2.md](/home/monkey/code/noctua-mail/briefs/i18n-views-review-r2.md). Evidence: [regressions-r2](/home/monkey/code/noctua-mail/briefs/i18n-views-regressions-r2).
