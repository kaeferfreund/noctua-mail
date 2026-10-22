# deps-safe-bumps

## Summary

Semver-compatible dependency bumps on `chore/deps-update` in `/home/monkey/code/noctua-mail/wt-deps`. Commit `3ac802dbefa608f729302fe6906e95c922622f09` (parent `c1652ec`). No application code changes. `shadcn` moved to `devDependencies` at the same version (`^4.22.1`). `packageManager` is `bun@1.4.4`.

Tests stayed green (1698 + 48 pass). Lint stayed at 1 error / 27 warnings. `tsc` stayed at 355 `error TS`. Production build succeeded.

## What changed / What was found

`package.json` ranges (resolved lock versions in parentheses):

| Package | Old | New |
| --- | --- | --- |
| imapflow | ^1.3.2 (1.3.2) | ^1.7.8 (1.7.8) |
| mailparser | ^3.9.8 (3.9.8) | ^3.12.3 (3.12.3) |
| nodemailer | ^8.0.5 (8.0.5) | ^8.0.11 (8.0.11) |
| sanitize-html | ^2.17.3 (2.17.3) | ^2.18.1 (2.18.1) |
| tsdav | ^2.1.8 (2.1.8) | ^2.5.0 (2.5.0) |
| zod | ^4.3.6 (4.3.6) | ^4.6.7 (4.6.7) |
| @uiw/react-md-editor | ^4.1.0 (4.1.0) | ^4.1.3 (4.1.3) |
| lucide-react | ^1.8.0 (1.8.0) | ^1.61.0 (1.61.0) |
| @happy-dom/global-registrator | ^20.11.1 (20.11.1) | ^20.14.6 (20.14.6) |
| @tauri-apps/cli | ^2.10.1 (2.10.1) | ^2.12.4 (2.12.4) |
| @testing-library/dom | ^10.4.1 (10.4.1) | ^10.4.2 (10.4.2) |
| @testing-library/react | ^16.3.2 (16.3.2) | ^16.3.3 (16.3.3) |
| @types/mailparser | ^3.4.6 (3.4.6) | ^3.9.0 (3.9.0) |
| packageManager | bun@1.3.12 | bun@1.4.4 |
| shadcn ^4.22.1 | dependencies | devDependencies (version unchanged) |

`cn` stayed a dependency (`^0.5.0`). No runtime JS/TS import of the `shadcn` package. `app/globals.css` still has the build-time `@import "shadcn/tailwind.css"`. Docker's `bun install --frozen-lockfile` installs devDependencies, so that import still resolves during image build.

`bun install` (not frozen) rewrote `bun.lock` (222 lines in `--stat`). Version changes are the packages above plus their transitive deps and hoists: `@zone-eu/mailsplit`, `libmime`, `iconv-lite`, `encoding-japanese`, `socks` / `ip-address`, `happy-dom`, `@tauri-apps/cli-*`, `linkify-it`, `is-plain-object`, `launder`, `dayjs`, `deepmerge-ts`, mailparser's nested `html-to-text@10.0.1` and `nodemailer@10.2.0`, sanitize-html's nested `htmlparser2` / `entities@8.1.0`, and `@babel/code-frame` 7.29.0 → 7.29.7 (caret range of `@testing-library/dom`). `tsdav` dropped `base-64` and `cross-fetch`. Direct `next`, `react`, `html-to-text@9.0.5`, `entities`, and `next/postcss@8.4.31` were not retargeted. No protected-area source edits.

`bun pm ls --all` (ANSI stripped) shows a single major for each requested name: `lucide-react@1.61.0`, `zod@4.6.7`, `imapflow@1.7.8`, `mailparser@3.12.3`. Extra majors pulled in by those bumps: `mailparser` → `nodemailer@10.2.0` beside direct `nodemailer@8.0.11`, and `html-to-text@10.0.1` beside direct `html-to-text@9.0.5`.

`bun audit` went from 147 (5 critical, 64 high, 71 moderate, 7 low) to 136 (4 critical, 61 high, 64 moderate, 7 low). `sanitize-html` dropped off the advisory list. `nodemailer@8.0.11` (direct) and `nodemailer@10.2.0` (via mailparser) are still grouped on advisories whose fix lines are 9.x/10.x; the ranges that stop at 8.0.8 no longer match 8.0.11.

## Verification (exact commands + numbers)

All commands from `/home/monkey/code/noctua-mail/wt-deps`, prefixed with `nice -n 10`. Wall times are bash `SECONDS`.

Baseline, untouched `c1652ec`:

- `bun audit` — exit 1, wall 1s. 147 vulnerabilities (5 critical, 64 high, 71 moderate, 7 low).
- `bun run test:ci` — exit 0, wall 21s. Unit: 1698 pass, 0 fail, 4194 expect(), 196 files, 6.30s. DOM: 48 pass, 0 fail, 295 expect(), 8 files, 13.96s.
- `bun run lint` — exit 1, wall 41s. 28 problems (1 error, 27 warnings). The error is `react-hooks/set-state-in-effect` in `app/components/calendar/useCalendarConflicts.ts`.
- `bunx tsc --noEmit` — exit 2, wall 20s. `grep -c "error TS"` = 355.

After the bumps:

- `bun install` — exit 0, wall 5s. 50 packages installed, 1 removed.
- `bunx tsc --noEmit` — exit 2, wall 22s. 355 `error TS` (equal to baseline).
- `bun run lint` — exit 1, wall 48s. 28 problems (1 error, 27 warnings). Equal to baseline.
- `bun run test:ci` — exit 0, wall 26s. 1698 pass / 0 fail (196 files, 9.32s) + 48 pass / 0 fail (8 files, 15.74s).
- `bun run build` — exit 0, wall 49s. Compiled successfully in 19.6s. Finished TypeScript in 25.4s.
- `bun pm ls --all | grep -E "lucide-react|zod@|imapflow|mailparser"` — one resolved copy of each of those four packages (see above). `zod@` is hidden from a raw grep by ANSI codes between the name and `@`; the tree has a single `zod@4.6.7`.
- `bun audit` (after) — exit 1. 136 vulnerabilities (4 critical, 61 high, 64 moderate, 7 low).

## Risks & follow-ups

- Direct `nodemailer@8.0.11` still matches advisories fixed in 9.x/10.x (raw-option file read/SSRF `<=9.0.0`, addressparser DoS `<9.1.0` and `<=10.0.5`, DNS-cache credential disclosure `<10.0.2`, and others). A major bump was out of scope. `mailparser@3.12.3` already depends on `nodemailer@10.2.0`, so two majors are installed. App imports resolve to 8.0.11; mailparser uses 10.2.0.
- `mailparser` also pins `html-to-text@10.0.1` while the direct dependency stays `^9.0.5` (9.0.5), as required. Nested `entities@8.1.0` arrived via `sanitize-html` → `htmlparser2`; direct `entities` is unchanged.
- `Dockerfile` is still `FROM oven/bun:1.3.12-debian` while `packageManager` is `bun@1.4.4`. Not changed here.
- `shadcn` is a devDependency but `app/globals.css` imports `shadcn/tailwind.css`. A production install that omits devDependencies before `next build` would fail that import. The current Dockerfile does not omit them.
- `bun audit` is still exit 1. Remaining criticals are outside this bump (Next.js and others owned by other agents).

## Files touched

- `package.json`
- `bun.lock`
- This brief: `/home/monkey/code/noctua-mail/briefs/deps-safe-bumps.md` (outside the worktree, not in the commit)

No files under the protected areas. Worktree `git status` is clean after the commit (`.env.local` is gitignored).
