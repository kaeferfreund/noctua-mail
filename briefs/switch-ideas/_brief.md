# Brief: more mailbox-switch optimizations (idea round, read-only)

User (2026-10-23, German): performance is already better; find further optimizations for switching between mailboxes in the sidebar (screenshot: sidebar rows "Eigene Postfächer" / "Gemeinsame Postfächer", each row avatar + name + unread / assigned / open counts + status dot) — without significant downsides.

ROOT=/home/monkey/code/noctua-mail. App: Next.js 16.4.2 App Router (standalone, own launcher), React 19.3, Bun 1.4.4, bun:sqlite master DB + per-account shards, Better Auth, next-intl, shadcn/ui shell. Code to read: ROOT/wt-switch-ideas (detached at integration/stage a504783 = current preview code incl. the first switch optimization).

## Already done (on a504783) — do not re-propose, but you may propose improvements on top
- D1 parallel atomic switch: POST switch-account ∥ folders(B), one commit, no /auth/me re-read (app/components/mailclient/useAccountController.ts).
- D3 superseded list loads are aborted (useMessageData.ts). F1/F2 no cross-mailbox topic/count flash (useTopics.ts, useSearchState.ts). D2 no eager sender-settings reload (ComposeOrchestrator.tsx).
- Result: first rows 22–60 % sooner warm, 27–50 % cold; requests per switch 23 → 13.

## In flight in another task (perf/mailbox-switch-2) — mark overlaps as "overlaps in-flight"
- H: cheaper first rows (300 threads parsed/address-parsed/formatted while ~18 visible; lazy per-row derivation or smaller first page).
- D4 first page request in parallel with the switch; D5 defer secondary per-account requests (sender icons, 4 virtual counts, topics/stats, members, reminders, compose preload) until first rows; skip the duplicate threads + counts reload after the first-visit interactive POST /sync.
- Fix for fast A→B→A (last click wins).

## Known and parked (after go-live) — you may re-rank them
- Server prototype 66.5 → 38.4 ms p50 (topic suggestions, date grouping, 2 index fixes, session write skip) — briefs/perf-mailbox-switch-server.md.
- /auth/me compare-and-set selection write (lib/auth.ts:120-121).
- Second tab does not follow a switch; HTTP/1.1 stream connection limits with two tabs; resident sync worker design (briefs/design-resident-sync-worker.md).

## Evidence to read first
ROOT/briefs/perf-mailbox-switch-e2e.md (critical path, ms per segment, §9 ranking), perf-mailbox-switch-client.md, perf-mailbox-switch-server.md, perf-mailbox-switch.md (what D1–D3/F1/F2/D2 changed + before/after), perf-mailbox-switch-review-r1.md, and the data under ROOT/briefs/perf-mailbox-switch/.

## Constraints for every idea ("ohne große Nachteile")
Security invariants: no data of mailbox A ever shown or requested under B; every per-account route authorizes by the path account id + membership; revoked access must still take effect promptly (no caching that delays revocation); no PRAGMA optimize/ANALYZE. Must not break: reader-focus paging and saved page size, keyboard navigation, unread counts, collaboration state, compose drafts, German UI, mobile layout. Prefer small, local, measurable changes. Ideas that are costly or risky should still be listed but ranked low with the downside stated.

## Output (strict)
Write exactly one file: ROOT/briefs/switch-ideas/<your-model-tag>.md. At most 15 ideas, ranked by expected gain/risk. For each: id, title, what to change (files + functions, file:line), why it helps (cite the measured segment or a code fact), expected gain (ms or requests, with reasoning), downside/risk, overlap (none / overlaps in-flight / parked item), how to verify (test or measurement). Then a 5-line summary. Keep the file under ~250 lines.
