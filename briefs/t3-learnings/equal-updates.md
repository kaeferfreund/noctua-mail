# Equal live updates keep references (T3 learnings cluster E; user approved 2026-10-23 ~20:15 UTC)

Worktree ROOT/wt-equal-updates, branch perf/equal-updates-noop (from integration/stage f29fbd6). `bun install` first. Ports 4050–4059.
Background: ROOT/briefs/t3-learnings/rendering.md §4 and data-loading.md §6 (T3 PRs #9725, #9909, #20852, #22730); backlog item "unchanged folder-status / collab values not re-published" (gpt-6.1-sol.md G08/G09 in briefs/switch-ideas/).

## Problem
- app/components/mailclient/folderStreamUpdates.ts (~11) always builds a new folders array and copies a matched folder even when counts/status are identical.
- MailClient.tsx (~2870) builds new Maps, a new messages array and copies messages for every matching collaboration summary event, even when nothing visible changed.
- useMailboxSummaries / sidebar summary updates: check for the same pattern.
Result: identical SSE/sync bursts re-render the list/sidebar/reader although nothing changed.

## Do
- Return the previous array/object when an update is display-equal (compare only the fields that are shown/used: counts, unread, status, sync state, assignment, status, note count, revision…); when one entity changes, only that entity gets a new reference.
- Keep it narrow and explicit (small pure helpers with unit tests). No mutation of old objects, no retaining data across accounts, no comparator that hides changed permissions, assignment, attachments or authoritative invalidations.
- Out of scope (other branches are changing it right now): useMessageData.ts list refresh / row reconciliation, useAccountController.ts. Touch MailClient.tsx minimally (deep links and a list-cache branch also touch it).

## Done when
- Unit tests: same payload twice → same references; one changed field → only that entity new; account change → no reuse.
- DOM/profiler check: a burst of 20 identical folder-status + collab events causes 0 list/sidebar re-renders (before/after counts).
- bun check 0; lint 0 new on touched files; focused DOM tests green; build OK.
- Commit on the branch; report ROOT/briefs/t3-learnings/equal-updates-report.md. No push/merge/deploy. Rules: ROOT/briefs/_rules-common.md. Target ≤ 60 min.
