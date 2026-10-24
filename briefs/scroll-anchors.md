# Scroll anchors for Back/Forward and revisits (deep-link follow-up)

User approved 2026-10-23 ~20:15 UTC (gap listed as "not covered" in briefs/deep-links-report.md). Worktree ROOT/wt-scroll-anchors, branch feat/scroll-anchors (from integration/stage 56840ce, which has deep links + the mailbox list cache). `bun install` first. Ports 4100–4109. No separate measurement phase.
Background: ROOT/briefs/t3-learnings/mobile-navigation.md §3 and §5 (T3 PRs #12144, #4867), rendering.md §7.

## Today
MailClient.tsx (~2708) captures one raw list scrollTop; lib/ui/useReaderFocusPlacement.ts restores it only for desktop reader-focus changes; reader selection scroll runs after a 220 ms collapse settle; HtmlMessage measures iframe height asynchronously. Back/Forward and mailbox/folder revisits (now instant via the list cache) land at the top.

## Do
- Store bounded anchors (e.g. last 50) keyed by account + full list key (folder/view/search) for the list, and by account + thread/message for the reader: stable row/message id + offset within the row + pixel fallback (+ relevant expansion state). Use the history entry (history.state id from the deep-link hook) where two visits to the same place need different positions.
- Precedence: explicit new URL message target → saved Back/Forward anchor → saved revisit anchor → default top.
- Restore after the list/reader has real geometry (after cached rows render, after reveal on phones, after the linked message is expanded; re-check once after HTML layout). Cancel restore on user touch/wheel/pointer/scroll keys or destination change; no smooth scrolling for history navigation; bounded retries.
- Keep one history owner (the deep-link hook); no extra pushes. Keep MailClient.tsx edits minimal; put the logic in its own hook/module.

## Done when
bun check 0; lint 0 new on touched files; DOM tests: list anchor restored on Back and on revisit, reader anchor restored on Back/Forward, explicit link target wins, user scroll cancels a pending restore, hidden-pane measurement never stored; one Playwright case at 390 px (scroll far → open mail → Back → same rows visible) and desktop; build OK. Commit; report ROOT/briefs/scroll-anchors-report.md. Fast lane (UI navigation, self-check) → merge + preview. No push/merge/deploy. Rules: ROOT/briefs/_rules-common.md.
