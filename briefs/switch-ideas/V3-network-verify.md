# V3 — verify by measurement (no product change): gzip, counts endpoint, IMAP deferral, stale-fetch aborts

Worktree ROOT/wt-switch-verify (branch perf/switch-verify-scratch at 7425f75, scratch only — do not commit product code; you may commit nothing at all). `bun install` first. Ports 3970–3979.
Context: ROOT/briefs/switch-ideas/_dedup.md clusters D, E, F, G; idea texts muse-wonder-full.md M4, M7, M8, M9; gpt-6.1-sol.md G03, G10, G13; grok-4.7.md I1, A1. Harness/evidence: ROOT/briefs/perf-mailbox-switch-e2e.md, perf-mailbox-switch.md, ROOT/briefs/perf-mailbox-switch/.
The running branch perf/mailbox-switch-2 (wt-perf-switch-2, read only, do not touch) already defers secondary requests (D5) — read its diff to know what remains.

## Questions to answer with numbers
1. gzip (M7): does a production build (`bun run build`, standalone launcher as in ops/deploy-dev.sh, own port) send `Content-Encoding` for /api/.../threads and other large JSON? Bytes for the large mailbox first page identity vs gzip vs br; server CPU cost per response; first-rows time under CDP throttling (e.g. 20 Mbit/s, 40 ms RTT — the household reaches mails.monkeymed.de over Wi-Fi/mobile). If not compressed: where is the smallest safe place to enable it (Next `compress`, launcher, Caddy in go-live-runbook), with the downside.
2. Counts endpoint (G03/M4): after D5, how many ms/requests do the 4 virtual counts still cost on a switch? Is a single counts-only authorized endpoint worth it? Sketch the route + authz.
3. IMAP consistency POST / IDLE stream (I1/M8/M9): what do they cost on the switch path after D5? Would deferring/keying by account change first rows measurably? Risks (missed new mail, revocation).
4. Stale fetches (A1/G10): on a switch with an open message, are body/refresh/folder responses for the old mailbox still downloaded/processed? Cost in ms, and any correctness risk today.
Measure warm, ≥ 10 runs, p50/p90; synthetic data only.

Output: ROOT/briefs/switch-ideas/V3-report.md — per question: measured numbers, recommendation (do now / after go-live / drop), concrete change sketch with files. Leave the worktree clean. Target ≤ 75 min.
No push/merge/deploy, no product commits. Rules: ROOT/briefs/_rules-common.md.
