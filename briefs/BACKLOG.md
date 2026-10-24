# Backlog (P3 and parked items)

One line each: area | finding | source. Worked in batches on user request or after go-live (AGENTS.md rule 2).
Items marked (r4) / (qa-fix) / (i18n-3a) are in a task that was already running at handover; strike them when its report confirms the fix.

## Reader / shell
- reader | exit-focus target keyed off activeMessageId, not the reader's message (r4) | reader-focus-review-r3.md P3-1
- reader | mutation guard waits indefinitely on a stalled non-JSON chunked body (r4) | reader-focus-review-r3.md P3-2, security-recheck-98b4301.md F1
- reader | evidence default path outside the checkout; QA_ROUND2_FIXTURE undocumented (r4) | reader-focus-review-r3.md P3-3/P3-4
- reader | 641 KB PNGs under artifacts/reader-focus/ in history (e9d2428); no rewrite planned | reader-focus-review-r3.md P3-4
- status bar | desktop calendar popover loses keyboard focus when tabbing past the last event | status-bar-compact-review-r3.md #1
- status bar | phone status sheets: inconsistent heading hierarchy | status-bar-compact-review-r3.md #2
- status bar | German copy polish | status-bar-compact-review-r3.md #3
- sidebar | collapsed mode: keyboard focus opens a detached, clipped tooltip (fix r2) | sidebar-views-row-review-r1.md F2
- sidebar | QA-014 depends on test order, thin badge coverage (fix r2) | sidebar-views-row-review-r1.md F3
- build info | label twice (sidebar UTC vs popover Berlin); calendar panel still English; no test for trigger name | HANDOFF-umbau.md §4
- i18n | stale-translator window after locale switch (tnRef → useLayoutEffect) | integration-stage-r9-verify.md P3-1
- i18n | refreshFolders identity changes on language switch (MailClient.tsx:532) | integration-stage-r9-verify.md P3-2
- i18n | adopt localeSwitch probe as permanent test | integration-stage-r9-verify.md P3-3
- tests | unescaped RegExp from catalog text in qa-compose.spec.ts:357 | integration-stage-r9-verify.md P3-4

## QA sweep 98b4301 (qa-ui-sweep-98b4301.md)
- compose | QA-204 From menu much wider than the trigger (qa-fix)
- settings | QA-205 Settings need two Escapes to close
- settings | QA-207 sender preference controls shorter than other selects (i18n-3a)
- search | QA-208 German folding ß/ss, ä/ae (deps task fix-fts-german-folding running)
- search | QA-209 filter popover shows raw "INBOX" (status-bar r4)
- search | QA-210 search placeholder truncated (qa-fix)
- compose | QA-211 SMTP 550/451 alerts link to "Absender prüfen"
- collab | QA-212 assignee shown twice (qa-fix)
- sidebar | QA-213 Drafts count 12 (pinned) vs 3 (folder)
- i18n | QA-214 "Konto" vs "Postfach" terminology
- i18n | QA-215 English left in translated areas (preferences tab, reader badge, quote header, filter popover)
- settings | QA-216 preferences: two save buttons
- compose | field labels and "Open in modal" tooltip still English | HANDOFF-umbau.md §4

## Security hardening (P3)
- launcher | log redaction misses non-canonical reset-path spellings — fixed by fix/reset-log-redaction-r2 90949cd (merged 2026-10-23); next.config.ts logging.incomingRequests.ignore still exact-match | security-recheck-98b4301.md F2

## Tooling / tests
- tests | QA Playwright configs lack actionTimeout (a hung click costs 480 s) | HANDOFF-umbau.md §4
- tests | smoke banner hardcodes "Next 16.2.4" (scripts/smokeTeamAuth.ts:175) | HANDOFF-umbau.md §4
- lint | 181 react-hooks warnings, cleanup target 2026-11-15 | briefs/lint-react-hooks-cleanup.md

## Parked until after go-live (AGENTS.md rule 5)
- deps majors beyond the running deps-wave-r9; further perf work beyond the running branches
- release: Docker worker-image gate needs a host with Docker

## Added 2026-10-23 16:55 UTC
- build info | F3 NEXT_PUBLIC_* fallback does nothing for Docker images; prefer reading identity from public/build-version.json (also the proper fix for F2) | build-info-review-r1.md F3
- build info | F4 build time truncated at 1024 px; F5/F6 calendar panel keyboard flow notes | build-info-review-r1.md
- auth | parallel /auth/me can write back an old mailbox selection (lib/auth.ts:120-121, CAS write suggested) — check severity in the mailbox-switch review | perf-mailbox-switch-server.md
- perf | mailbox switch server prototype 66.5 → 38.4 ms p50 (topic suggestions, date grouping, 2 index fixes, write skip) — after go-live | perf-mailbox-switch-server.md
- html sanitize | P3-1 skip of the allow pass relies on every mode-dependent rewrite calling onRemoteRewrite (comment only); make it structural via one helper | perf-html-sanitize-review-r1.md
- html sanitize | P3-2 pair test adds ~30 s to test:ci (~90 s stress); ~1,000 docs per seed suffice | perf-html-sanitize-review-r1.md
- html sanitize | P3-3 sanitize-html/postcss/parse5 upgrades break golden hashes; regenerate with gen-golden.ts | perf-html-sanitize-review-r1.md
- search | equal-count groups have no tiebreak (ORDER BY count DESC) | fts-german-folding.md
- privacy | N1 message source cached 24 h (private, max-age=86400) → readable after logout/revocation in same browser; fix `private, no-cache` + ETag (source/route.ts:12; attachments same) — cheap, candidate before go-live | security-recheck-6968b37.md
- search | N2 NUL byte in a search query → unhandled 500 (no leak); strip control chars (query.ts:454) | security-recheck-6968b37.md
- tests | useEventReminderState.dom.test.tsx failed once under load 29 (5/5 isolated green) | deps-wave-r9.md
- tests | authStreams test now transpiles the send closure with Bun.Transpiler — auth owner to look at | deps-wave-r9.md
- mailbox switch | P3-1 session poll /auth/me can write back an old selection → next poll jumps the screen back (may close an open compose); CAS write in lib/auth.ts:120-121 | perf-mailbox-switch-review-r1.md
- mailbox switch | P3-2 create topic in A + switch while pending → B's topic list blank until next load (MailClient.tsx:2072, useTopics.ts:91) | perf-mailbox-switch-review-r1.md
- mailbox switch | cold small→large "settled" +85 ms (D5) — addressed by perf/mailbox-switch-2 if measured | perf-mailbox-switch.md
- i18n | invite form inside compose still English (Start/End/All day/Repeat/Location/Open time picker; calendar components) | i18n-slice3a-review-r1.md
- i18n | forwarding labels the original as „Antwort auf:“ (pre-existing) | i18n-slice3a-review-r1.md
- i18n | 320 px: Topics tab label cut ~9 px, „IMAP (Posteingangsserver)“ heading 4 px too wide; personal-settings fieldset default border/padding | i18n-slice3a-review-r1.md
- settings | QA-207 selects 36 px (44 px asked on phones); Members role selects unstyled ~18 px; members table scrolls sideways without hint | i18n-slice3a-review-r1.md
- i18n | „Speichert …“ vs „Wird gespeichert …“; hyphens:auto on phones also hits user text | i18n-slice3a-review-r1.md
- tests | LoginScreen.dom.test.tsx "uses app credentials…" is bimodal (0.1 s vs 6–7.5 s → 5 s timeout) — fails ~3 of 4 isolated runs at load ~10, also on 6968b37 before deps-wave; pre-existing, makes test:ci red intermittently; needs a test-only root cause (not a timeout bump) | orchestrator 2026-10-23
- mobile reader | card action icons keep 14 px icons with small tap areas on phones | briefs/mobile-reader-report.md
- mobile reader | long sender address breaks mid-word in the card header | briefs/mobile-reader-report.md
- mobile reader | dark-mode screenshots show the HTML body dim (before and after; check real dark rendering) | briefs/mobile-reader-report.md
- tests | lib/teamAuthSlice3.test.ts one test times out at 5 s under load, also on 7425f75 (pre-existing) | briefs/switch-ideas/V2-report.md
- auth/perf | test for revoke mid-request while the session write is skipped (reviewer probe passed, not committed) | briefs/perf-account-batching-review-r1.md
- auth/perf | cross-tab lost mailbox switch when last-active >5 min (ms window; needs conditional session write) | briefs/perf-account-batching-review-r1.md
- auth/perf | duplicated membership query lib/db/users.ts:139 | briefs/perf-account-batching-review-r1.md
- perf | one counts-only endpoint for the 4 virtual counts (only with one combined query; ~80 ms server time after first rows) | briefs/switch-ideas/V3-report.md §2
- perf | do not start small per-account reads while a switch is pending (rapid A->B->C) | briefs/switch-ideas/V3-report.md §4
- perf | API JSON uncompressed although next compress is on — root cause not pinned (app-level option b in V3 §1) | briefs/switch-ideas/V3-report.md
- perf/threads | unreachable date branch in getThreadGroupCounts (lib/db/messages/query.ts:1820-1846) can be removed | briefs/switch-ideas/V2-review-r1.md
- perf/topics | score reuse misses threads with the same signals in a different order (correct, only less speed-up) | briefs/switch-ideas/V2-review-r1.md
- folder tree | choosing an item from a folder's menu also selects that folder (existing behaviour) | briefs/switch-ideas/V1-report.md
- folder tree | Enter on a folder's menu button also selects the folder (existing behaviour) | briefs/switch-ideas/V1-report.md
- a11y | folder count tooltip only after pointer/focus; virtual-cursor screen-reader users no longer hear it (unread count keeps its label) | briefs/switch-ideas/V1-report.md
- deep links | 9 P3 findings from review r1 (see report, section P3) | briefs/deep-links-review-r1.md
- list cache | two switches in the same tick (B then A) show B while server keeps A; compare against last committed mailbox — check once deep links can trigger it | briefs/mailbox-list-cache-review-r1.md
- list cache | thread-setting change without view change: revisit briefly shows old row format | briefs/mailbox-list-cache-review-r1.md
- list cache | 401/403 on any page drops the whole mailbox from the cache (speed only) | briefs/mailbox-list-cache-review-r1.md
- tests | qa-reader-focus.spec.ts: 2 cases fail since deep links (reload reopens the message in focus view, list hidden) — update the spec to the new behaviour | briefs/scroll-anchors-report.md
- conversation window | 10 P3 findings (incl. body requests not cancelled on fast thread switch, ~3 KB per header row) | briefs/t3-learnings/package-b-review-r1.md
- MCP: `tools/list` advertises all 27 tools regardless of token mode; filter by MCP_TOOL_SCOPES (mcp-multi-mailbox-review-r1 P3-1)
- MCP: token rows show raw IDs of mailboxes the viewer cannot access; GET should keep only accessible IDs + count (review-r1 P3-2)
- MCP: deleting a token from one mailbox tab revokes it everywhere, no hint in the UI (review-r1 P3-3)
- MCP: schema comment in lib/db/schema.ts still says scopes "not enforced yet" (review-r1 P3)
- MCP: token with invalid stored scopes is shown as "Nur lesen" instead of "ungültig" (review-r1 P3)
- MCP: no committed test for manage tools refused via tools/call; no 390 px screenshot of the MCP tab (review-r1 P3)
- MCP: new primary after revoke/deletion = alphabetically first remaining mailbox, not the one with the best role (mcp-multi-mailbox-verify-r1 P3)
- MCP: lib/db/users.ts removeUserAccountLink removes a membership without token cleanup (tests only today) (verify-r1 P3)
- MCP: lib/db/mcpTokens.ts filter `accountId IS NOT NULL` is always true (verify-r1 P3)
- Sync: 382× IMAP "Unexpected close" / connect retries to mxf9a0.netcup.net on several accounts in the dev journal (not the rc-portal account); separate from the parser stall (sync-rcportal-report.md)
