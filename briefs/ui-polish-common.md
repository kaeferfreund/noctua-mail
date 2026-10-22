# Common setup for the UI polish tasks (2026-10-22)

## Rules for every task
- Work ONLY in your own worktree (path in your task file). Other agents and threads work in the other checkouts under `/home/monkey/code/noctua-mail/` — do not edit them. Reading other checkouts is fine.
- You may commit on your own branch. Do NOT push, merge into other branches, open PRs, deploy, change credentials, or run destructive git (`reset --hard`, force-push, branch deletion, bare `git stash`).
- No new npm dependencies. Use only synthetic data (dev fixture below); never real mailboxes or addresses.
- Match the surrounding code style: CSS modules + Radix Themes + existing tokens (`var(--gray-*)`, `var(--accent-*)`, `--radius-*`), short comments that explain *why*, no drive-by refactors outside your scope.
- Check both dark and light theme and a desktop width (~1440 px) plus a narrow/mobile width (< 768 px).
- `/tmp` is a 12 GB tmpfs shared by many agents: put browser profiles and scratch files under `/tmp/<your-task-name>/` and delete them at the end. Stop every server you started before you finish.

## Running the app with synthetic mail
Each worktree already has `node_modules` and a git-ignored `.env.local` (its own data dir and `PORT`). Use only YOUR ports from your task file.

```sh
# terminal 1: synthetic IMAP/SMTP fixture (ports from your task file)
bun --env-file=.env.local scripts/dev-fixture/run.ts --port <IMAP> --control-port <CTL> --smtp-port <SMTP> --seed monkeydent --date 2026-10-22
# terminal 2: app
ENV_FILE=.env.local bun --bun build-scripts/generateRuntimeConfig.ts
bun --env-file=.env.local --bun next dev -p <APP>
```
See `doc/DEV-FIXTURES.md` in your worktree. On a fresh DB, `curl http://localhost:<APP>/api/auth/me` makes the app print `Admin invite code: <uuid>`. Sign up as Name `MonkeyDent`, email/user `demo@monkeydent.test`, password `demo`, IMAP `127.0.0.1:<IMAP>` and SMTP `127.0.0.1:<SMTP>`, security None. `scripts/dev-fixture/verify-http.ts` hardcodes IMAP 3789 / SMTP 3787 in its signup body — if you want it, copy it to `/tmp/<your-task-name>/` and change the ports and `--base-url`; do not edit the repo copy. It signs up, logs in and syncs all folders.

## Browser screenshots
Use `playwright-core` by absolute import: `import { chromium } from "/home/monkey/code/noctua-mail/wt-review-auth/node_modules/playwright-core/index.mjs";` (headless Chromium is installed under `~/.cache/ms-playwright`; on this ARM host set `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-arm64` if it complains). Log in through the UI, or via the login API from the copied verify script, and reuse the cookie. Save before/after screenshots to `/home/monkey/code/noctua-mail/briefs/<your-task-name>-screens/` (`before-*.png` from an unmodified run, `after-*.png`).

## Verification before you commit
`bun check` (type check), `bunx eslint <changed files>`, `bun run test:ci` (unit + DOM tests; add or adjust tests where behaviour changes), and `bun run build` at the end. Report counts.

## Final report
What changed (files + one line each), before/after screenshot paths with a short description, test/lint/build results with counts, commit SHA(s), and open questions or trade-offs you had to decide.
