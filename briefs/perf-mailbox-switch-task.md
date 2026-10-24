# Task draft: perf/mailbox-switch (faster mailbox switching, no behavioural downside)

Status: DRAFT, owner-approved scope (Umbau thread, 2026-10-23 ~16:00 UTC). Start from the round-9 SHA `origin/integration/stage` @ e70c30b. Final numbers from the end-to-end and server spikes are folded in before launch.
User request: "das wechseln zwischen den postfächern dauert viel zu lange, bitte optimieren ohne nachteile".

## Inputs
- `briefs/perf-mailbox-switch-client.md` + `briefs/perf-mailbox-switch/client/` (sequence table, counting harness `switchRequests.spike.dom.test.tsx`, prototype `useAccountController.proto.diff`, 8 draft tests, traces).
- `briefs/perf-mailbox-switch-e2e.md` (ms per milestone) and `briefs/perf-mailbox-switch-server.md` (per-route cost, D1 safety verification) — pending.

## Base and isolation
Worktree `/home/monkey/code/noctua-mail/wt-perf-mailbox-switch`, branch `perf/mailbox-switch` from the round-9 SHA; own data dir; ports 3905–3919 (never 3895–3899, 3790, 3795–3799). Model claude-judith / claude-opus-5-5 / effort high, fastMode false. Commits on the branch only; never push, merge, rebase, deploy. `nice -n 10`, TMPDIR inside the worktree.

## Commits (one concern each; owner decisions in brackets)
1. **D1 parallel atomic switch** — `app/components/mailclient/useAccountController.ts` only [FREE, GO]. `switch-account` and folders(B) in parallel; commit all mailbox-scoped state in one batch after both succeed; no `/auth/me` re-read on a switch. Owner conditions:
   - (a) folderAccountGuard (1ee8d64): no folder id of A ever exists under B; first sync after a switch uses B's INBOX or no folderId; server 400 `folder_account_mismatch` on mismatch. Existing "first sync follows the new account" tests stay green + new test.
   - (b) 97dd982: everything in `loadInitialData`'s dependency list stays identity-stable (refs only); the language-switch regression test and `useAccountController.dom.test.tsx` stay green; new test asserts identity across a switch; run `tests/browser/auth/shell.spec.ts:229`.
   - (c) no caching that delays revocation: a 403/401 from either request activates nothing and reloads from the server; with `/auth/me` gone from the switch, a revoked membership must still reach the sidebar through the existing refresh path (session-refresh poll / membership events), not only on reload — test it.
   - Safety assumption ("no per-account route reads the session's selected mailbox; each checks membership itself") recorded in the commit body as a test or as the grep list of routes with file:line (from the server spike's verification).
   - The two existing tests that pin the old serial order are rewritten so their security and ordering statements survive in the new form (say which statement maps to which new assertion).
2. **D3 superseded list loads do not block** — `useMessageData.ts` [FREE]. Abort the old load when the view key changes. Must not disturb reader-focus paging: `git merge-tree` against feat/reader-focus e7d00ee (its c6d4566 drives useMessageData paging from MailClient.tsx by the displayed layout) must be clean, and a test covers paging while a superseded load is aborted.
3. **F1 topic-name flash** — `useTopics.ts` [FREE]: never show A's topics under B.
4. **F2 virtual-folder-count flash** — `useSearchState.ts` [free; merge-tree clean against feat/status-bar-compact a864dfc required].
5. **D2 no eager sender-settings reload on switch** — `ComposeOrchestrator.tsx` [i18n-slice3 edits the file]: ONLY as a small isolated hunk with merge-tree clean against the then-current feat/i18n-slice3 tip (7c05ea6 at 16:00 UTC); on any conflict drop the commit and report — it moves to after round 10.
Not in this branch (after round 10, small MailClient.tsx hunk): D4 first page in parallel with the switch (2 → 1 round trip), D5 defer secondary per-account requests until the first page has arrived.

## Gates
Counting harness before/after (requests per switch, awaited round trips, stale old-mailbox requests, stream opens, commits); `bun run typecheck`, `bun run lint` (no new findings), `bun run test:ci`, `bun run test:stress`, `bun run build`, `bun run test:auth-browser` incl. shell.spec.ts:229; end-to-end milestone timing with the e2e spike's harness on a production build (click → first rows, click → settled; cold/warm; median/p90) before/after; `git merge-tree` against e7d00ee, a864dfc, fix/sidebar-views-row, feat/i18n-slice3 and the then-current stage head.

## Report
`briefs/perf-mailbox-switch.md`: per commit what changed, invariant tests, harness and timing before/after, merge-tree results, anything dropped and why.


## Launch overrides (2026-10-23 ~15:55 UTC, orchestrator)
Base `origin/integration/stage` @ `e70c30bf316cde3f3e266806b34687e311c74088` (round 9; gates: typecheck 0 / 1,244 files, test:ci 2,915 + 564 DOM, lint 0 errors / 181 warnings = new baseline, auth browser 20/20). Worktree and branch are already created and installed. Instance claude-judith. PORTS for this task: 3917–3919 and 3793–3794 only (overrides any port list above; 3895–3899 are released to this thread since round 9; never 3790, 3795–3799, 3905–3914 = other running tasks of this thread). Load discipline: four sibling tasks run heavy gates in parallel on a shared 6-core box — before each `test:stress`, `bun run build` or full `test:ci`, check `uptime`; if the 1-min load is above 12, wait and re-check (do not skip the gate). `nice -n 10` always. Agent commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
