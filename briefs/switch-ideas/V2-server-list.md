# V2 — verify + implement: cheaper threads/list query on the server

Worktree ROOT/wt-switch-server, branch perf/switch-server-list (from integration/stage 7425f75). `bun install` first. Ports 3960–3969.
Context: ROOT/briefs/switch-ideas/_dedup.md cluster C; idea texts grok-4.7.md T1, S1b, G2, Q1, S8; gpt-6.1-sol.md G02, G04, G06; muse-wonder-full.md M5, M11. The parked measured prototype (66.5 → 38.4 ms p50): ROOT/briefs/perf-mailbox-switch-server.md (§1, §9 S1–S4) and its patch ROOT/briefs/perf-mailbox-switch/server/proto.patch + harness in ROOT/briefs/perf-mailbox-switch/server/. Note: the code moved since 647359b (FTS work, fts-german-folding) — re-derive, do not blindly apply.

## Task
1. Baseline the server critical path on 7425f75 with the existing in-process harness (2k and 11k synthetic mailboxes, mailbox without topics and with topics, warm + cold shard).
2. Implement, each as its own commit: (a) topic-suggestion enrichment: early exit when the account has no topics + own-address normalization once per request (S1/S1b/G02); (b) date-group key derived once per thread (G04); (c) skip `getThreadGroupCounts` for date/week/year grouping where the client discards the counts (Grok G2) — keep for sender/domain/invite/event; (d) index use for baseCount/messages via existing idx_messages_account_thread_date only where EXPLAIN + timing at 2k and 11k both improve, deterministic tie-break (G06/S3); (e) only if trivially safe: no master-DB touch for an empty list query (Q1), no account-row re-read on warm getAccountDb (S8) — S8 must not delay revocation (check how membership/revocation is enforced first; if unsure, drop it).
   Muse M5 (suggestions out of the threads response into their own request) only if (a) does not already make suggestions cheap; it changes the client and overlaps the running D5 — prefer not.
3. Differential test: same items, order, total, hasMore, baseCount, group headers for default view, flagged-first, filters, search, exclusions, foreign-folder rejection. Re-measure.
4. Gates: bun check, lint 0 new on touched files, focused unit tests for lib/db/messages + topics + threads route, build. No schema/migration changes (if one becomes necessary, stop and report). No PRAGMA optimize / ANALYZE.
5. Report ROOT/briefs/switch-ideas/V2-report.md: per idea keep/drop with ms before/after (p50/p90), risks, gates. Target ≤ 90 min.
No push/merge/deploy. Rules: ROOT/briefs/_rules-common.md.
