# Bring all dependencies to the latest versions

User request 2026-10-23 ~23:20 UTC: "alle dependencies auf den neusten stand bringen".
Worktree ROOT/wt-deps-latest, branch chore/deps-latest, base integration/stage bdde6c9 (version 0.2.0-alpha.1). Rules: briefs/_rules-common.md, AGENTS.md in the worktree.

## Context
- Bun 1.4.4, `bun outdated` on the base currently lists: @fullcalendar/core|react|rrule 6.1.22 → 7.1.3, @modelcontextprotocol/sdk 1.32.1 → 1.32.2, next + eslint-config-next 16.4.2 → 16.4.3, @playwright/test 1.58.2 → 1.64.1, @types/node 25.9.9 → 26.6.5, typescript 6.0.3 → 7.0.2. Re-run `bun outdated` yourself (also check `bun outdated --filter` / nested) and compare with package.json ranges (caret ranges may hide majors).
- Earlier dependency work and findings (read the relevant ones before touching a package): briefs/deps-toolchain-majors.md (+ dir; TypeScript 7, ESLint 10, happy-dom 21, @types/node spike), briefs/deps-fullcalendar.md (FullCalendar 7 notes), briefs/deps-wave-r9.md (last wave: imapflow 2, mailparser, htmlparser2 12, Next 16.4), briefs/deps-next-16-4.md, briefs/deps-html-parsers.md, briefs/HANDOFF-deps.md. Rules learned there: the lockfile is text (bun.lock); after `bun install` check the diff is limited to intended packages; sharp needs its platform binary; `bun check` is the typecheck.
- Gates: `bun check` (0 errors), `bun run lint` (0 errors, zero new warnings), `bun run test:ci` once at the end (~10 min; known: LoginScreen DOM bimodal flake, rerun that file once if it fails), `bun run build` with the synthetic env block from briefs/go-live-runbook.md §3.1 (NOCTUA_DATA_DIR=<worktree>/.tmp/build-data; synthetic secrets only), `bun run test:standalone-workers` if the build passes. Use `nice -n 15`, one heavy gate at a time, TMPDIR=<worktree>/.tmp.

## Scope
1. Update every dependency and devDependency to its latest release, majors included, one logical group per commit (e.g. "deps: typescript 7 + @types/node 26", "deps: fullcalendar 7", "deps: next 16.4.3 + eslint-config-next", "deps: playwright", "deps: mcp sdk", "deps: remaining minors/patches"). Fix the code/config changes each major requires (TS 7 strictness, FullCalendar 7 API changes, ESLint config, happy-dom behaviour in DOM tests, etc.). Do not change behaviour beyond what the upgrade requires; do not refactor.
2. If a major cannot be made green within reasonable effort (say ~1 h for that package), leave that package at the previous version, pin it with an explicit comment in the report (not in package.json), and continue with the rest. Never weaken tests, timeouts or lint rules to get green; `eslint-disable` only with a one-line reason and only where the rule is wrong for the new API.
3. Peer-dependency warnings from `bun install`: resolve or explain each in the report.
4. Final: full gate run on the final commit, numbers in the report.

## Out of scope
No feature work, no changes to the preview or deploy scripts, no Docker image changes beyond what a dependency forces (and then say so).

## Deliverables
Commits on chore/deps-latest (explicit paths: package.json, bun.lock, touched sources; trailer `Co-Authored-By: Codex GPT-6.1 Sol <noreply@openai.com>`). Report briefs/deps-latest-report.md: table of packages before → after, per major the required code changes, packages left behind and why, gate results with numbers, risks to watch on the preview (e.g. calendar rendering, DOM tests).
