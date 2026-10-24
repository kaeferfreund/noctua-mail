# Mailbox-switch ideas — deduplicated (orchestrator, 2026-10-23 ~19:00 UTC)

Sources: grok-4.7.md (G-ids below as "Grok"), gpt-6.1-sol.md ("GPT"), muse-wonder-full.md ("Muse"). Stage head 7425f75.
Already covered by perf/mailbox-switch-2 (running, wt-perf-switch-2): one translator per locale (GPT G01 / Muse M1 part 1, commit 657373c), memoized address parsing (Muse M2, 29519f0), first page with the switch (D4), no duplicate reload after sync (64b4959); still in flight there: list render H, D5 (defer secondary requests: sender icons, 4 virtual counts, topics/stats, members, reminders, compose preload).

| Cluster | Ideas (who) | Votes | Status |
|---|---|---|---|
| A Folder tree + sidebar rows cheaper on the switch commit: lazy Radix menu, memo nodes, stable closures, lazy count tooltip, memo MailboxRow | Grok F3, GPT G05+G07, Muse M3 (+M1 rest: lazy hover titles) | 3 | **verify V1** (perf/switch-folder-tree) |
| B Click feedback: pending state on clicked sidebar row (not aria-current) | Muse M10 | 1 | **verify V1** (same files) |
| C Server list query: topic suggestions early exit / out of threads response, date-group key, index use for baseCount/messages, skip date group counts the client discards, empty-list master touch, warm getAccountDb row re-read | Grok T1+S1b+G2+Q1+S8, GPT G02+G04+G06, Muse M5+M11 | 3 | **verify V2** (perf/switch-server-list), parked prototype briefs/perf-mailbox-switch/server/proto.patch |
| D gzip for JSON (threads ~860 KB uncompressed?) | Muse M7, (GPT G13 HTTP/2 sibling) | 1–2 | **verify V3** (measure only) |
| E 4 virtual counts → one counts-only endpoint | GPT G03, Muse M4 | 2 | **verify V3** (measure/design only; overlaps D5) |
| F Defer IMAP consistency POST + IDLE stream until first rows; stream keyed by account; keep consistency fingerprints | Grok I1, Muse M8+M9 | 2 | **verify V3** (measure/design only; overlaps D5) |
| G Abort stale fetches (open message body, refresh, folder reads) | Grok A1, GPT G10 | 2 | **verify V3** (measure only) |
| H Thread forest once / collapsed first paint / one thread-set pass / skip discarded list fields | Grok R2+S6, Muse M6, GPT G12 | 3 | overlaps in-flight H → hand to switch-2 follow-up after it merges |
| I Unchanged folder-status / collab values not re-published | GPT G08+G09 | 1 | backlog (small, after go-live) |
| J Selection write retries / compare-and-set | Grok S4c+C1, GPT G11, Muse M13 | 3 | parked (auth-owned; only under contention) |
| K Payload slimming, one message per thread | Grok P2, Muse M12 | 2 | parked (audit-gated) |
| L Second tab / HTTP/1.1 connection cap / resident sync worker | Grok N1, GPT G13+G14, Muse M14 | 3 | parked (product decision / after go-live) |
| — Hover prefetch | Muse M15 (rejected by Muse) | 0 | dropped |
