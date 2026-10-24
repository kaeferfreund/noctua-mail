# Handoff: Umbau thread (f3317279) → "Noctua Orchestrator"

Written 2026-10-23 16:15 UTC by the Umbau orchestrator. ROOT = /home/monkey/code/noctua-mail. Facts only; times are real `date -u`.
From this point the Umbau thread starts nothing new: no tasks, merges, deploys, round 10 or new thread messages. When a running child finishes, it only appends one line under "Completions" at the end of this file.

## 1. Running child tasks (claude-judith, Opus 5.5 high, fastMode false; started 16:00 UTC)
taskId = `node:delegated-task:command%3Amcp%3A018602db-74cf-4636-93ab-d2f6f733c966%3Adelegate-task%3A<id>`, childThreadId = same with the `thread:` prefix instead of `node:`.

| id | Worktree / branch (local head now) | Ports | Expected result → report |
|---|---|---|---|
| sidebar-views-row-fix-r2 | wt-sidebar-views / fix/sidebar-views-row (9ab0c65; origin 94f1a31) | 3845-3849 | P2 fix: no row tooltip on mobile/collapsed (scoped option a), collapsed focus, robust QA-014 → briefs/sidebar-views-row-fix-r2.md |
| review-build-info-r1b | wt-build-info @6307539 (read-only) | 3900-3904 | Verdict PIN / PIN+fix / FIX → briefs/build-info-review-r1.md |
| i18n-slice3a-finish-r2 | wt-i18n-3 / feat/i18n-slice3 (7c05ea6 + 9 dirty files) | 3860-3864 | Finish German compose + settings, QA-202 + QA-207 (phone settings), gates → briefs/i18n-slice3a-report.md |
| qa-sweep3-fixes-r1 | wt-qa-fixes / fix/qa-sweep3-r1 (61c57f0 + 15 dirty; branch from e70c30b, not on origin) | 3875-3879 | QA-201 (P2 signature), QA-203 (P2 admin on phones), QA-212, QA-204, QA-210 → briefs/qa-sweep3-fixes-r1.md |
| status-bar-compact-fix-r4 | wt-status-bar / feat/status-bar-compact (3c954a5; origin a864dfc) | 3880-3884 | Merge e70c30b + feat/build-info, BuildInfo in the status popover, review-r3 P3s, sidebar build label on the shared formatter, QA-209; extra merge-tree vs perf/rrule-lazy (steered) → briefs/status-bar-compact-fix-r4.md |
| reader-focus-fix-r4 | wt-reader-focus / feat/reader-focus (6c81714; origin e7d00ee) | 3870-3873 | Merge e70c30b, review-r3 P3s (exit focus, stalled chunked body deadline, evidence path, QA_ROUND2_FIXTURE doc); no history rewrite → briefs/reader-focus-fix-r4.md |

None of these pushes. The new orchestrator pushes with the token method from section 7. The deps thread's own children (deps-wave-r9, account batching, html-sanitize, mailbox switch D1/D3/F1/F2, fts-german-folding) belong to thread 96c8419f. See briefs/ and the memory note noctua-deps-thread.md.

## 2. Branch heads (16:14 UTC; origin = pushed)
| Branch | SHA | Status |
|---|---|---|
| integration/stage | e70c30b (= origin) | **Round 9 done**: record commit, verify PASS (briefs/integration-stage-r9-report.md, -verify.md) |
| team-inbox | 9424150 (= origin) | Round 7; not fast-forwarded since then |
| deploy/dev-stage | 49ded0b (= origin) | **Live preview 9.2** (section 3); diverges from integration/stage |
| perf/fts-search-driven | e29b64f (= origin) | Ready for round 10 (deps GO, differential on e29b64f+e70c30b 395/395) |
| perf/rrule-lazy | local 46bdb7d / origin 122ca69 | 122ca69 conflicts with r9; 46bdb7d = r9 merged in, deps gates running → **pin the SHA the deps thread pushes** |
| perf/tiny-headers | 7d31d6d (= origin) | Ready for round 10 |
| perf/test-parallel-fixes | 018452b (= origin) | Ready for round 10 (contains a614f26; pin only 018452b) |
| fix/reset-log-redaction-r2 | 90949cd (= origin) | Ready for round 10 (security recheck F2) |
| feat/build-info | 6307539 (= origin) | On the preview; review r1b running |
| feat/status-bar-compact | local 3c954a5 / origin a864dfc | a864dfc = PIN (r3b); fix r4 running |
| feat/reader-focus | local 6c81714 / origin e7d00ee | e7d00ee = PIN+fix (r3, P3 only); fix r4 running |
| fix/sidebar-views-row | local 9ab0c65 / origin 94f1a31 | 94f1a31 = FIX (P2 mobile tooltip); fix r2 running |
| feat/i18n-slice3 | 7c05ea6 (= origin) | Unfinished (no report yet); task running |
| fix/qa-sweep3-r1 | local 61c57f0 | Task running; not on origin |
| deps (not mine) | perf/account-presentation-batching, perf/html-sanitize-single-pass, perf/mailbox-switch, chore/deps-wave-r9, fix/fts-german-folding | Started from e70c30b on Judith, local only |
Do not merge: spike/next-16-4, spike/better-auth.

## 3. Preview (https://remote-arm.tail31b4a1.ts.net:3790, unit noctua-dev, port 3790)
- Running: **deploy/dev-stage 49ded0b**, built 15:35 UTC, active since 15:37:16 UTC; `/api/version` = `49ded0ba07e9 | 2026-10-23 15:35 UTC`.
- Contents: round 9 e70c30b + feat/build-info 6307539 (647359b) + feat/status-bar-compact a864dfc (2136d48) + feat/reader-focus e7d00ee (deff0b5) + spec fix-ups 2770703, 49ded0b.
- Not on the preview: the sidebar row fix, the QA fixes, i18n 3a, the fix-r4 rounds and the deps perf branches.
- Logs: ops/deploy-dev-stage-20261023T150921Z.log (9.1) and ops/deploy-dev-stage-20261023T153500Z.log. The 9.2 log was reconstructed after the T3 restart and has no gate numbers. Screenshots: briefs/preview-r92/.
- Master backups: data/noctua-data-dev.bak-master-pre-r91-647359b/, data/noctua-data-dev.bak-master-pre-r92-49ded0b/ (integrity ok), plus the earlier r86/r89 backups. The full FTS-v3 backup is in data/backups/fts-v3-pre-r8-20261023T074419Z/.
- Previous builds for rollback: wt-deploy-stage/.tmp/standalone-prev (8.9) and .tmp/standalone-prev-r91 (9.1), if the 9.2 agent created the latter.

## 4. Open findings by severity
- **P0:** none.
- **P1:** none open.
  - D1 data loss: a language switch dropped an unsent inline reply. Fixed in 97dd982 and live since 9.1.
- **P2, a fix task is running for each:**
  - QA-201: after switching From away and back, a signature prompt appears and the signature can disappear.
  - QA-202: settings overflow on phones.
  - QA-203: the admin area is clipped on phones.
  - Sidebar row tooltip is shown and clipped on phones (review r1).
- **P3, parked or in fix r4 / QA fixes:**
  - **Round-9 verification:** a short window where the error text can use the old language (tnRef → useLayoutEffect); refreshFolders identity changes on a language switch (MailClient.tsx:532); adopt localeSwitch.probe as a permanent test; regex escaping in qa-compose.spec.ts:357.
  - **QA sweep:**
    - QA-204: From menu width.
    - QA-205: settings need two Escapes.
    - QA-207: select height.
    - QA-209: raw INBOX in the search filter.
    - QA-210: search placeholder.
    - QA-211: SMTP 550/451 alerts link to "Absender prüfen".
    - QA-212: assignee shown twice.
    - QA-213: Drafts count 12 vs 3.
    - QA-206 is obsolete (bottom bar removed).
    - QA-208 (ß/ss search) is with the deps thread, fix/fts-german-folding.
  - **build-info:** label shown twice (sidebar UTC vs popover Berlin time); calendar panel still English; no test for the trigger's name.
  - **Misc:** compose field labels and the "Open in modal" tooltip are English; QA Playwright configs lack an actionTimeout (a hung click costs 480 s); smoke banner hardcodes "Next 16.2.4" (scripts/smokeTeamAuth.ts:175); next.config.ts logging.incomingRequests.ignore is exact-match; 181 lint warnings (react-hooks cleanup by 2026-11-15).
- **Release conditions:** Docker worker-image gate on a host with Docker (none on this box); final security audit; production deployment and MailPlus migration (stop POP3 first, then imapsync).

## 5. Open user decisions
1. Should "Offen" / "Nicht zugewiesen" count every non-closed thread of a private mailbox? Today a private 11k mailbox shows 9113; an alternative is shared mailboxes or INBOX only.
2. Build label in two places (sidebar header and status popover). Provisional: keep both on one formatter (status-bar fix r4).
3. Sidebar active fill iris-3 vs iris-4 and tooltip delay. Provisional: iris-3, 400/150 ms (fix r2).
4. App-wide preflight rule `[hidden]{display:none}` (option b), which would fix all SidebarMenuButton tooltips. Only the scoped option a is being built now.
5. Deps account batching: skipping the session UPDATE makes "Zuletzt aktiv" precise to 5 minutes. The user has not been told yet.
6. Instance for agents: the user said "am besten claude judith" (MonkeyDent free from ~16:20, Cargnel from 17:40 UTC). The Advoria instance of this thread should not run agents.
7. The user is impatient and wants to see results on the preview. Standing rule: deploy every verified piece in between rounds (memory dev-preview-keep-current).

## 6. Round-10 prompt (briefs/integration-stage-r10.prompt.md, draft, not started)
- Base: wt-integration-dryrun @e70c30b.
- Inputs, all still valid:
  1. fts e29b64f
  2. rrule-lazy `<RRULE_SHA>` (pin the deps push, not 122ca69)
  3. tiny-headers 7d31d6d
  4. test-parallel-fixes 018452b
  5. reset-log-redaction 90949cd
  6. build-info `<SHA>`
  7. status-bar `<fix-r4 SHA>`
  8. reader-focus `<fix-r4 SHA>`
  9. sidebar `<fix-r2 SHA>`
- Late entries: i18n-slice3, qa-sweep3-r1, deps late entries; otherwise round 11.
- Placeholders must be filled and the SHAs pushed before launch.
- Changed since the draft: inputs 7/8 pre-merge round 9, so the r9 conflicts listed there are already resolved inside them. The AppShell.tsx/doc/SHELL.md conflict between 7 and 8 remains; reference merge deff0b5. Gates list unchanged; lint baseline 0 errors / 181 warnings.
- After round 10: merge integration/stage into deploy/dev-stage and take integration's side in hunks already resolved there.

## 7. Pitfalls
- **Push:** gh's active account is MonkeyMed, so the credential helper gets a 403. Use the token with `TOK=$(gh auth token --user kaeferfreund)`, an askpass script (Username → kaeferfreund, Password → $GH_PUSH_TOKEN) and `git -c credential.helper= push origin <branch>`. Never run a global `gh auth switch`.
- **Deploy:** `NOCTUA_DEPLOY_WT=ROOT/wt-deploy-stage ROOT/ops/deploy-dev.sh --build-only`. The script defaults to wt-deploy-dev, which is wrong. At 16:00 the script was changed so its unit rewrite only replaces the .env.local line; the optional build-info EnvironmentFile line stays. Order: stop → copy data/noctua-data-dev/db/main.db (+wal/shm) → start. Data dir changes need doc/FTS-V3-MIGRATION.md. Preview agents use the lock ROOT/ops/deploy.lock; it is removed now.
- **Data:** never touch ROOT/data/noctua-data-dev outside a deploy backup. Each worktree has its own data dir (data/noctua-data-<name>). wt-qa-fixes/.env.local holds fresh synthetic secrets written by the orchestrator.
- **Ports:** ours: integration 3798/3799, deploy gates 3855-3858, plus the task ports in section 1. Deps: 3791-3794, 3895-3919. The preview uses 3790 and a fixture on 3797.
- **Tests:**
  - Bun 1.4.4 hides "(pass)" lines under CLAUDECODE/AGENT/REPL_ID, so run bun tests with `env -u CLAUDECODE -u AGENT -u REPL_ID`. Fixed in-tree from e70c30b (fc8aab3).
  - Agent Bash calls stop after 10 min, so detach test:ci, stress and builds and wait with `timeout 570 tail --pid`.
  - Playwright needs `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-arm64`; the round2 config needs `QA_ROUND2_FIXTURE=1`.
- **Runtime:** a T3 server restart cancels in-session workflows and Agent subagents (it happened at about 16:00). Workflow agents run on the thread's own instance. Memory time labels before 14:40 are partly 1-4 h off.
- **Memory:** /home/monkey/.claude*/projects/-home-monkey-code-noctua-mail/memory/ (noctua-fork-project.md, noctua-deps-thread.md, agents-on-codex-when-credits-low.md).

## Completions
- 16:24 UTC review-build-info-r1b: feat/build-info 6307539, verdict FIX (P2 F1 globals.css:1060 sync text pushes status items out of the bar at ≤1152 px, not on preview; P2 F2 ops/deploy-dev.sh:14-17 writes build-info-dev.env before the build → stale label + stuck 'Neuladen erforderlich' after a failed build/restart; P3 F3–F6; recommends BuildInfo in the sidebar header as the single display), report briefs/build-info-review-r1.md
- 16:24 UTC sidebar-views-row-fix-r2: fix/sidebar-views-row 031d070 (9ab0c65 + 031d070, not pushed), done — P2 mobile/collapsed tooltip fixed (option a; collapsed desktop sidebar now inert), QA-014 robust; ci 2915+565, qa-shell 7/7; merge-tree clean vs integration/stage ab7a2f8 + build-info + reader-focus ed59980, conflict vs status-bar 3c954a5 in Shell.dom.test.tsx (keep both params, buildInfo first); needs verification before round 10; report briefs/sidebar-views-row-fix-r2.md
- 16:29 UTC status-bar-compact-fix-r4: feat/status-bar-compact 3e04c9f (not pushed), done — merged e70c30b (0bbb702) + build-info 6307539 (cd6596e, BuildInfo last in popover / phone menu), P3s fixed (calendar tab loop 2f186f2, phone sheet headings a424924, reminder lead 'Erinnerung: 1 Tag vorher' 4212f6b, sidebar label = BuildInfo 4c3948d, QA-209 3c954a5); ci 2928+605, qa-status-indicator 13/13, qa-shell 4/4; round-10 notes: vs reader-focus e7d00ee 5 files (AppShell/doc as deff0b5), sidebar 94f1a31 clean, i18n-slice3 catalogs.test + qa-compose, rrule-lazy 46bdb7d 1 conflict UpcomingStatusPopover.tsx import block (keep reminderLeadUnit + useLazyRecurrence); needs verification; report briefs/status-bar-compact-fix-r4.md
- 16:37 UTC qa-sweep3-fixes-r1: fix/qa-sweep3-r1 443198f (6 commits on e70c30b, not pushed), done — QA-201 61c57f0+9f7bad0 (empty editor body ≠ edited signature), QA-203 dea6de4 (admin rows wrap, 44 px on phones), QA-204 0a69377, QA-212 1c11e8d ('Ich ({name})' once), QA-210 443198f DEVIATES ('{folder} durchsuchen' instead of 'im Posteingang' — user decision open); ci 2917+568, Playwright 8/8; merge-tree: no own-hunk conflicts vs i18n-slice3/status-bar/reader-focus/sidebar; needs verification; report briefs/qa-sweep3-fixes-r1.md
- 16:54 UTC reader-focus-fix-r4: feat/reader-focus 4634b91 (10 commits on e7d00ee incl. merge e70c30b, not pushed; note: intermediate commits 97eb6bc + cc7c328 do not typecheck, fixed by 3cbff28/4634b91), done — P3 a exit focus from activeMessage, b stalled body 10 s deadline without awaiting cancel (mutation/bodyless guards + readAuthJson), c evidence default .tmp, d QA_ROUND2_FIXTURE documented; MailClient toolbar menu as function (−3 lint warnings); ci 2925+591, lint 0/180, qa-reader-focus 8/8, qa-bodyless 1/1, shell.spec:229 pass; merge: build-info + sidebar clean, status-bar a864dfc 3 files (AppShell/doc as deff0b5, de.json from r9); needs verification; report briefs/reader-focus-fix-r4.md
- 17:04 UTC i18n-slice3a-finish-r2: feat/i18n-slice3 b772bd9 (11 commits on 98b4301, not pushed beyond 7c05ea6), done — slice 3a complete (+445 keys de/en parity), QA-202 + QA-207 fixed (b772bd9: 0 overflow at 1440/390/360/320, selects 36 px); ci 2929+580, lint 0/179, qa-compose 8/8, bundle '/' gzip +11,859 B (+1.79 %); auth 19/20 on the branch alone (shell.spec:229 = known 98b4301 bug, 20/20 with 97dd982 applied); merge vs integration/stage only qa-compose.spec.ts 4 hunks (take the branch side); needs review; report briefs/i18n-slice3a-report.md
