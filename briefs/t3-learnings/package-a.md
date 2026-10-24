# Package A — quick UI render fixes (from the T3 Code learnings)

User approved 2026-10-23 ~19:50 UTC. Background: ROOT/briefs/t3-learnings/_dedup.md cluster Q; details in rendering.md §1, §3, §6 and mobile-navigation.md §5 (file:line refs there are against stage 34dd18e — re-check in your worktree).
Two tasks run in parallel on separate branches from integration/stage 34dd18e:

## A1 — ROOT/wt-ui-perf-a1, branch perf/ui-clock-geometry, ports 4010–4019
1. Draft "saved … ago" clock: MailClient.tsx (~1073) bumps root state every second while `draftSavedAt` exists; move the ticking into a small leaf label component used by both places that show it (shell surface + compose, ~5838/~6004). Same wording, same update cadence as displayed, language switch still works. Verify: render count of MailClient over 65 s idle with a saved draft (before/after, React Profiler or a counter in a test).
2. Virtual list geometry: messagelist/VirtualizedList.tsx measures height on mount, scroll and window resize only (720 px fallback); on phones the list is display:none while the reader is open (ShellPanes.module.css), so Back can show a wrong/blank window. Observe the scroll element (ResizeObserver) or re-measure on reveal; never store a measurement taken while hidden. Verify at 390 px: scroll far down → open mail → rotate/keyboard → Back: rows fill the pane, same position.
Keep MailClient.tsx edits minimal (feat/deep-links is changing it in parallel).

## A2 — ROOT/wt-ui-perf-a2, branch perf/reader-card-isolation, ports 4020–4029
Reader cards: ThreadView.tsx spreads shared card props into every card; ThreadMessageCard.tsx takes whole collapse/tab/font/zoom/translation maps and pending sets and is not memoized; MessageViewOrchestrator.tsx (~756) rebuilds the message lookup and card props each render. Give each card per-message scalar/slice props and stable callbacks, keep shared lookups identity-stable when unchanged, memo the card. Do not write a comparator that ignores changing callbacks, permissions, remote-content policy or translated bodies. Verify: synthetic 200-message thread — toggle collapse/tab/zoom on one card and change collaboration on a sibling; card render counts before/after; actions still use the current mailbox, role and message; HtmlMessage not re-sanitized for unchanged bodies.

## Both
- Self-check (fast lane, no reviewer task): bun check 0; lint 0 new on touched files; focused DOM tests for touched components green + a test that pins the render-isolation behaviour; bun run build OK; screenshots at desktop and 390 px showing no visual change (ROOT/briefs/t3-learnings/package-a-evidence/<a1|a2>-*.png).
- Commit on your branch; report ROOT/briefs/t3-learnings/package-a-<a1|a2>-report.md with before/after numbers. Do not push, merge or deploy.
- Rules: ROOT/briefs/_rules-common.md (ROOT=/home/monkey/code/noctua-mail). Target ≤ 60–90 min.
