# Noctua — orchestrator status (overwritten, not appended)

Updated 2026-10-23 ~19:05 UTC by "Noctua Orchestrator" (mcp:3ce17bd9-b5ed-4e24-bc96-c2a311cf93e3). Rules: AGENTS.md. Handoffs: briefs/HANDOFF-umbau.md, briefs/HANDOFF-deps.md. P3 list: briefs/BACKLOG.md.
Old orchestrators f3317279 and 96c8419f are retired; they only append completion lines to their HANDOFF file.

## Preview (unit noctua-dev, port 3790, https://remote-arm.tail31b4a1.ts.net:3790)
- Live: deploy/dev-stage 9f9f34e (built 23:05 UTC; backups data/noctua-data-dev.bak-master-pre-0477bfb and -pre-9f9f34e — master DB data/noctua-data-dev/db/main.db; rollback wt-deploy-stage/.tmp/standalone-prev-df8bd4f) = stage 8aae8ba (MCP multi-mailbox + sync empty Content-Type fix). Full test:ci on 8aae8ba due (hourly rule).
- feat/mcp-multi-mailbox d9b31bc9: DONE (review FIX → P2-1 fixed d9b31bc9 → verify OK → merged e92b688, on preview 0477bfb; wt-mcp-scopes can be removed).
- fix/sync-header-split 7b36365: DONE (Codex diagnosis, briefs/sync-rcportal-report.md; merged 8aae8ba, on preview 9f9f34e; wt-fix-sync-split can be removed). Watch: rc-portal account acc-e2800a0f7acbb4770ff324d5 should resume from UID 7811; 382× "Unexpected close" to mxf9a0.netcup.net on other accounts = separate topic (backlog).
- Release: user asked for an integrated alpha (23:15 UTC). Plan: full test:ci on 8aae8ba (running, ROOT/wt-stage-ci) → FF team-inbox + main to stage head bdde6c9 (version 0.2.0-alpha.1 bump on stage) → tag v0.2.0-alpha.1 + GitHub pre-release (notes briefs/release-notes-0.2.0-alpha.1.md). No production deploy.
- Running Codex gpt-6.1-sol tasks (user 23:20): ci-dependabot-r1 (wt-ci-setup, chore/ci-dependabot, brief briefs/ci-dependabot.md), deps-latest-r1 (wt-deps-latest, chore/deps-latest, brief briefs/deps-latest.md), upstream-compare-r1 (research only, report briefs/upstream-compare-report.md). After each: review per rule 2 (deps: one review; CI: self-check + merge), merge to stage, preview.
- Next preview: CI/deps when done.
- NOTE: worktrees wt-mobile-reader, wt-switch-tree, wt-switch-server, wt-switch-verify were created under ROOT/repo/ (git -C repo worktree add with relative path), not ROOT/. Always use absolute paths.
- Since deps-wave (dd27be7) `bun run build` = next build + bun check: a type error fails after .next/standalone was rewritten in place → the running preview dir is half-built; run `bun check` before deploy-dev.sh, keep .tmp/standalone-prev for rollback.
- ops/deploy-dev.sh now writes ops/build-info-dev.env.pending; with --build-only, `mv` it to build-info-dev.env right before the restart (build-info review F2).
- Deploy: merge integration/stage into wt-deploy-stage (take stage side for hunks already resolved there), `NOCTUA_DEPLOY_WT=ROOT/wt-deploy-stage ROOT/ops/deploy-dev.sh --build-only`, backup master DB (stop → copy main.db+wal/shm → start), swap, verify, ops log, push.

## Branch heads
- integration/stage 8aae8ba (pushed; + fix/sync-header-split 7b36365; + feat/mcp-multi-mailbox d9b31bc9 (review FIX→fixed→verify OK); + perf/conversation-window a1f3811 (package B, P2 fixed); + feat/short-deep-links c946223; + feat/scroll-anchors 5774615; + feat/deep-links 54644ea (review FIX → fixed, no 2nd review); + feat/mailbox-list-cache 9259644 (review MERGE); + perf/mailbox-switch-2 c03efbc (no separate review, client-only) + qa-reader-focus label fix; + perf/equal-updates-noop 2efa3c0; + perf/api-json-gzip 00b27cf; + perf/reader-card-isolation 074a72c (A2); + perf/ui-clock-geometry 16f5455 (A1); + perf/switch-folder-tree 7cee3ee (V1, self-checked); full test:ci on 34dd18e: unit 3265/0, DOM 692/0 → team-inbox FF 34dd18e 19:28; + perf/switch-server-list 529a7b8 (review MERGE); + fix/qa-sweep3-r1 d7213a8 QA-201, + fix/mobile-reader-compact 83b4d77) = e70c30b + fts-search-driven e29b64f + reset-log-redaction-r2 90949cd + tiny-headers 7d31d6d + test-parallel-fixes 018452b + sidebar-views-row 031d070 + rrule-lazy 46bdb7d + status-bar-compact 3e04c9f (contains build-info 6307539) + reader-focus 4634b91 (f64ce19) + fts-german-folding b3eed2d + html-sanitize-single-pass f8189bb (d688528) + qa-sweep3-r1 443198f (6968b37) + chore/deps-wave-r9 8d5fd37 (dd27be7; htmlparser2 12 checked: sanitize pair 162/0, htmlPrivacy 177; DOM 640/0; lint 0/180). After merging stage into a branch: bun install. + perf/mailbox-switch 5a8c373 (aeb1f76; DOM 660/0) + feat/i18n-slice3 b772bd9 (2b356d8) + fix(i18n) error title a504783 (orchestrator, review P2). Full test:ci on a504783: unit 3191/0, DOM 676/1 (known bimodal LoginScreen flake, pre-existing, backlog). + perf/mailbox-switch e40b131 A→B→A fix (7425f75). Full test:ci on f64ce19: unit 3094/0, DOM 635/0; lint 0/180.
- team-inbox 9523bbe (FF ~22:50 UTC after green test:ci).
- build-info review r1b: FIX — F1 moot (bottom bar removed by status-bar), F2 fixed in ops/deploy-dev.sh, F3–F6 → backlog. Done.
- fix/qa-sweep3-r1: review FIX (P2 QA-201 forwards/text replies) → merged anyway (P2 non-blocking), one fix round running.

## Accounts (22:10): MonkeyDent 0 % (reset), Judith 0 %, Cargnel 71 % until 23:20, Advoria 429.
## Accounts rule: new tasks via ops/claude-accounts.py `pick:` (MonkeyDent first, else nearest 5h reset), opus-5-5 high, fastMode false (user 2026-10-23 17:00).

## Running tasks (old ones on claude-judith; started by the old threads, completions go to them)
childThreadId = thread:delegated-task:command%3Amcp%3A<uuid>%3Adelegate-task%3A<id>
Umbau uuid 018602db-74cf-4636-93ab-d2f6f733c966:
| id | branch / worktree | after it finishes |
|---|---|---|
My reviews (uuid 8d74cb0b-615a-4034-bc3e-80e8dfc9495f, completions come to me):
Switch idea round: Grok/Muse/GPT done → dedup briefs/switch-ideas/_dedup.md. Verification (cargnel, uuid 3343c757-7ff1-4f22-9038-99fdcbec9869):
| (done) switch-verify-v3 → V3-report.md: gzip via Caddy at go-live (in runbook §2.4); counts endpoint after go-live; IMAP deferral + stale aborts dropped |
T3 Code learnings (user 19:20, GPT 6.1 Sol high via codex; read-only, clone ROOT/research/t3code; brief briefs/t3-learnings/_brief.md) → orchestrator dedupes, proposes to user:
| all three done → briefs/t3-learnings/_dedup.md; package A (quick UI perf) / B (long conversations) proposed to user 19:45 |
Package A done (A1 16f5455, A2 074a72c on stage + preview).

Deps uuid 1d1d2988-9b0a-4238-85c4-5013c0179d90:
Spike server: done, D1 assumption confirmed (briefs/perf-mailbox-switch-server.md).

## Go-live cut list (confirmed by the user 2026-10-23 ~22:55 UTC)
Before go-live (must):
0. Deep links — DONE, on preview 6d8b0f0 (scroll anchors follow-up running).
1. Built and on stage: logins, roles, shared mailboxes, watcher, shared Sent, signatures, sender identities, German UI, reading view.
2. Open P2s fixed: signature after From switch (QA-201), settings/admin on phones (QA-202/203), sidebar tooltip on phones.
3. Finish the German UI for compose and settings (i18n 3a) — DONE, on preview 4076229; leftovers (invite form, „Antwort auf:“ on forward) in backlog.
4. Faster mailbox switching — first part on preview d080fe6 (first rows 22–60 % sooner); part 2 (list render) running.
5. Final security check on the release candidate (delta pass on 6968b37 done 18:10: no P0–P2, briefs/security-recheck-6968b37.md; rerun a short delta on the final RC); Docker worker-image gate on a Docker host (or decide to ship without Docker).
6. Production host per go-live-runbook: /srv/noctua, system unit, Caddy + DNS-01 + encode gzip (no SSE), Tailscale port 443 move, DNS for mails.monkeymed.de on all devices.
7. Address/role inventory, POP3 off, imapsync import + count check, backup + restore drill.
8. PWA on both phones: login, switch, read, reply, photo attachment.
After go-live:
- Backlog P3s, remaining perf (mailbox switch D4/D5, list page size, resident sync worker), deps majors (TS 7, FullCalendar 7, ESLint 10 beyond the running wave), parallel test:ci, i18n catalog split, lint warning cleanup.

## Open user decisions
1. (done) Go-live cut list confirmed 2026-10-23 ~22:55 UTC.
3. (later) "Offen"/"Nicht zugewiesen" counting for private mailboxes; app-wide [hidden] preflight rule.

## Next steps
- Push integration/stage after focused tests; merge build-info after review; merge status-bar/reader/sidebar as each finishes; deploy preview; tell the user.
- Full test:ci on stage at most hourly; then FF team-inbox.
