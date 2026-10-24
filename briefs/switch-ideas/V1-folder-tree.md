# V1 — verify + prototype: folder tree / sidebar cheaper on the switch, click feedback

Worktree ROOT/wt-switch-tree, branch perf/switch-folder-tree (from integration/stage 7425f75). `bun install` first. Ports 3950–3959.
Context: ROOT/briefs/switch-ideas/_dedup.md clusters A + B; idea texts in grok-4.7.md §2 (F3), gpt-6.1-sol.md §5 (G05), §7 (G07), muse-wonder-full.md M1 (lazy hover titles part), M3, M10. Measurements and harness: ROOT/briefs/perf-mailbox-switch-e2e.md (§4, §6), perf-mailbox-switch.md, data under ROOT/briefs/perf-mailbox-switch/.
Do NOT touch files owned by the running perf/mailbox-switch-2 branch: useMessageData.ts, useSyncController.ts, useAccountController.ts (except reading), lib/i18n/translator.ts, lib/i18n/folderNames.ts, lib/ownAddresses.ts. If M10 needs a hook into switchAccount settle, do it in ShellSidebar/MailClient wiring, not in useAccountController.

## Task
1. Measure baseline on 7425f75 with the existing e2e harness: highlight + first rows for small→folders(50), large→folders, folders→small, small→large (warm, ≥ 10 runs each, report p50/p90).
2. Implement A: FolderTreeNode menu mounted lazily on first open intent (keyboard + aria-haspopup preserved), count tooltip computed on hover/focus, memo nodes with stable props from FolderTree/FolderSidebarPane, memoized MailboxRow in ShellSidebar with stable handlers. Implement B: pending/busy state on the clicked sidebar row (aria-busy, not aria-current), cleared on every settle incl. superseded/A→B→A and 403.
3. Re-measure the same pairs. Keep each change only if it shows a measurable gain or is needed for another; drop what does not pay off and say so.
4. Gates: bun check, lint 0 new on touched files, FolderTree*/Shell*/sidebar DOM tests green + new tests (closed tree has no menu nodes; menu still opens via keyboard and runs sync/rename/delete; pending state shown and cleared; aria-current only after commit), build. Screenshot sidebar at desktop and 390 px.
5. Commit on the branch; report ROOT/briefs/switch-ideas/V1-report.md: per idea keep/drop, before/after table, risks, gates. Target ≤ 90 min.
No push/merge/deploy. Rules: ROOT/briefs/_rules-common.md.
