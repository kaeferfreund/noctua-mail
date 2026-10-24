# Deps wave r9 (`chore/deps-wave-r9`): report

2026-10-23. Worktree `/home/monkey/code/noctua-mail/wt-deps-wave-r9`, branch `chore/deps-wave-r9`, base `origin/integration/stage` @ `e70c30b` (round 9). Spec: `briefs/deps-wave-r9-task.md` (owner decisions binding). Six commits, one concern each, all six landed; nothing dropped. Nothing pushed, merged, rebased or deployed. Every gate ran under `nice -n 10` with `TMPDIR` inside the worktree; heavy gates (`test:ci`, `test:stress`, `bun run build`) waited until the 1-min load was ≤ 12. Wall times are from a shared box with other heavy tasks, so differences under ~5 % are noise; the 1-min load at start → end is given where relevant.

HEAD: **`8d5fd372f0d14d3901579c7154729ba95c095ffa`** (`8d5fd37`)

| # | Commit | Concern |
| --- | --- | --- |
| 1 | `fdc52ba` | mailparser 3.12.4, @types/bun 1.4.4, @types/node 25.9.9 |
| 2 | `0602565` | ESLint 10.13 |
| 3 | `ad77f93` | happy-dom 21.0.4 + `enableIframePageLoading` + no child-frame navigation, new guard test |
| 4 | `b5227f8` | `lib/authStreams.test.ts`: `ts.transpileModule` → `Bun.Transpiler` (test-only, for the auth owners) |
| 5 | `5b4a844` | @types/sanitize-html 2.16.2 (+ comment-only fix in `next.config.ts`) |
| 6 | `8d5fd37` | Build type gate, variant B (`ignoreBuildErrors` + `bun check` after `next build`) |

Each commit body carries the owner-required proofs in full; the summary below is for review.

## 1. mailparser 3.12.4, @types/bun 1.4.4, @types/node 25.9.9 (`fdc52ba`)

- `mailparser` ^3.12.3 → ^3.12.4 (upstream `lib/` identical; nodemailer pin 10.2.0 → 10.2.1). **`bun pm ls nodemailer`: only `nodemailer@10.2.1`** (root); the nested `mailparser/nodemailer@10.2.0` is gone.
- `@types/bun` ^1.4.3 → ^1.4.4 (bun-types 1.4.4 = runtime). `@types/node` ^25.6.0 → ^25.9.9 (undici-types 7.19.2 → 7.24.6). @types/node 26 stays on hold.
- **Lock dedupe:** `bun install` kept a stale nested `bun-types/undici-types@7.19.2`, although bun-types asks for `undici-types: "*"`. I removed that one lock entry. Then `rm -rf node_modules && bun install --frozen-lockfile` accepted the lock with a single `undici-types@7.24.6`, and `node_modules/bun-types/node_modules` no longer exists.
- Gates: typecheck 0 / 1,243 files (1.3 s); `test:ci` 2,915 pass / 0 fail (315 files) + DOM 564 / 0 (73 files), 639.5 s (load 11.43 → 15.63).

## 2. ESLint 10.13 (`0602565`)

- `eslint` ^9.39.4 → ^10.13.0. `eslint.config.mjs` unchanged. `bun install` printed no peer warnings. eslint-plugin-react 7.37.5, eslint-plugin-jsx-a11y 6.10.2 and eslint-plugin-import 2.32.0 (via eslint-config-next 16.4.2) declare peers only up to `^9`. They are outside their range but work.
- **Rule-firing proof** (scratch `app/zz-eslint10-probe.tsx`, deleted, never committed). Under ESLint 10.13.0 these fired: react `react/jsx-key`, `react/no-unescaped-entities`; jsx-a11y `jsx-a11y/aria-props`, `jsx-a11y/alt-text`; import `import/no-anonymous-default-export`; also `react-hooks/rules-of-hooks` and `@next/next/no-img-element`.
- **Findings diff vs e70c30b** (`eslint . -f json`, compared per `file:line:col:rule:severity`): 0 added, 0 removed; 0 errors / 181 warnings, with the same per-rule counts (refs 59, preserve-manual-memoization 53, set-state-in-effect 40, exhaustive-deps 20, purity 4, no-img-element 2, immutability 1, use-memo 1, 1 unused disable directive).
- Lock: @eslint/eslintrc, @eslint/js, js-yaml, import-fresh, strip-json-comments, hoisted minimatch 3 and others are gone. In come espree 11, eslint-scope 9, @eslint/core 1.2.1, file-entry-cache 11 / flat-cache 6 / keyv 5 (+ cacheable, hookified, qified). minimatch 3 / brace-expansion 1 remain only nested under the three plugins above. Same package delta as the spike.
- Gates: `bun run lint` 0 / 181 (62.3 s, load 17.76 → 16.84); typecheck 0 / 1,243.

## 3. happy-dom 21.0.4 (`ad77f93`)

`lib/testSetupDom.ts` now registers with `enableIframePageLoading: true, navigation: { disableChildFrameNavigation: true }`.

**Deviation from the spike's one-liner, and why.** In happy-dom 21, `srcdoc` iframes are written in place and never consult `enableIframePageLoading`. The 54 errors come from HtmlMessage's iframe being mounted before its effect assigns `srcdoc`, i.e. an `about:blank` load. `enableIframePageLoading: true` *alone* turns an iframe `src` into a real request: happy-dom navigates the child frame through its `Fetch`, which uses node `http`/`https`. That would fail the owner condition "no real network loads". `navigation.disableChildFrameNavigation: true` makes happy-dom only record the URL on the child frame, and the `load` event still fires. With both settings, `about:blank` mounts are quiet and no iframe can fetch. This is stricter than happy-dom 20, which loaded iframe pages by default. CSS file and image loading stay disabled (the defaults).

Proofs:
- **New committed test** `lib/testSetupDom.dom.test.tsx`. One iframe points at a loopback `Bun.serve` (request counter, port 0), one at `https://iframe-probe.example.invalid/page`. Both settle with `load` and an empty document, and the counter reads 0 requests.
- **Mutation check:** without `disableChildFrameNavigation`, the test fails with `requests: 1` and both frames `error` (a loopback hit plus a DNS attempt for the external host). Reverted.
- **Whole-suite network counter:** a scratch preload (`.tmp/netguard.ts`, not committed) wrapped node `http/https.request|get`, `net.connect|createConnection|Socket#connect`, `tls.connect`, `Bun.connect`, native `fetch` and `WebSocket`, and logged every call. To validate the counter itself, I ran it against the mutation: it logged `http.request http://127.0.0.1:…` and `https.request` + `tls.connect` for `iframe-probe.example.invalid`. **Full DOM suite under the counter: 565 pass / 0 fail, 0 network calls logged** (87.2 s).
- **DOM gate** (`bun run test:dom`): **565 pass / 0 fail across 74 files** (564 on the base + the new test), **0 lines matching `iframe` or `NotSupportedError`**, 770 log lines (89.0 s). For comparison, plain `register()` on 21.0.4 logs **54** `NotSupportedError: Failed to load iframe page "about:blank"` lines in the two HtmlMessage files alone.
- **HtmlMessage / HTML-privacy DOM tests** (all pass, 0 iframe errors, run separately with a JUnit report):
  - `app/components/HtmlMessage.memo.dom.test.tsx`: "HtmlMessage sanitize memo > sanitizes again only when the html input changes".
  - `app/components/HtmlMessage.privacy.dom.test.tsx` (35 tests):
    - "reader treats unkeyed legacy sender as unknown and still allows Load once" (3 cases)
    - "reader rejects unrelated sender permissions and saves/reads the mailbox" (26 cases)
    - "notice, load once, message change and persisted sender choice"
    - "a failed preference save stays blocked and exposes a retry message"
    - "sender permission reads and writes the real mailbox rather than quoted display-name text"
    - "opt-in never reinserts sender stylesheets or remote CSS"
    - "links open on primary click and middle auxclick, never right auxclick or contextmenu"
    - "fragment links scroll inside the mail document and missing targets never navigate"
- Lock: `@happy-dom/global-registrator` and `happy-dom` 20.14.6 → 21.0.4; same dependency set.
- Gates: typecheck 0 / 1,244; eslint on both touched files clean.

## 4. authStreams test → Bun.Transpiler (`b5227f8`), for the auth owners

- `lib/authStreams.test.ts`: `ts.transpileModule(wrapper,{compilerOptions:{target:ts.ScriptTarget.ESNext}}).outputText` → `new Bun.Transpiler({loader:"ts",target:"bun"}).transformSync(wrapper)`; the `import ts from "typescript"` is gone. This was the repo's only TypeScript-API import; none is left.
- **Same behaviour:** the test still slices the real `send` closure out of `app/api/accounts/[accountId]/imap/stream/route.ts` and runs it against the real checker and DB with the same assertions. I compared both transpilers' output for the exact wrapper: the statements are identical. The only differences are TS's `"use strict"` prologue, Bun returning the arrow directly instead of `const send = …; return send`, and Bun writing the template literal's `\n` escapes as literal newlines. None of these changes what the closure does.
- **Mutation check:** I changed route.ts to `await assertStreamAuthorized(identity); if (stopped) return; controller.enqueue(…)`, i.e. delivery outside the guarded callback. The old test (from e70c30b, run as a scratch copy) and the new test, run side by side, **both fail at `expect(delivered).toBe(before)`, Expected 0 / Received 1**. Both pass again after the revert.
- Gates: `bun test lib/authStreams.test.ts` 1 pass; typecheck 0 / 1,244.

## 5. @types/sanitize-html 2.16.2 (`5b4a844`), kept

- ^2.16.1 → ^2.16.2. The types now depend on `htmlparser2 ^12`, which flips the hoisting. Root `htmlparser2` becomes 12.0.0 (with domhandler 6.0.1, domutils 4.0.2, domelementtype 3.0.0). html-to-text's htmlparser2 10.1.0 + entities 7.0.1 + domhandler 5 / domutils 3 / domelementtype 2 move to `node_modules/html-to-text/node_modules/`. @selderee/plugin-htmlparser2 and dom-serializer get nested domhandler 5 / domelementtype 2. Runtime versions are unchanged: sanitize-html still runs on htmlparser2 12 (before: nested under sanitize-html), and html-to-text still runs on htmlparser2 10 + entities 7.
- **Owner gate:** `bun run test:standalone-workers` (cold, `rm -rf .next`): exit 0, "Verified worker runtime files in .next/standalone" (61.5 s, load 11.94 → 11.51). On the pre-commit tree it was also green (79.0 s).
- **This gate alone is not enough.** `verifyStandaloneWorkerBuild.ts` only checks the worker's local TS files, not the node_modules layout. I therefore copied `.next/standalone` to a directory with no `node_modules` in any ancestor (`data/noctua-data-deps-wave-r9/…`, so resolution cannot fall back into the repo) and verified there:
  - Resolution with the worker's ESM conditions: html-to-text → `html-to-text/node_modules/htmlparser2` 10.1.0 → `entities/decode` 7.0.1; sanitize-html → root `htmlparser2` 12.0.0 → `entities/decode` 8.1.0. `convert()` and `sanitizeHtml()` both run correctly on synthetic input.
  - `bun build --target=bun` of all three worker entrypoints (`scripts/runSyncJob.ts`, `recomputeThreads.ts`, `recomputeCategories.ts`) resolves the full import graph (462 / 444 / 443 modules).
  - The sync route's `.nft.json` traces the nested htmlparser2 10 tree (ESM files, `entities/decode`, domhandler/domutils/domelementtype) from html-to-text's own imports, so **no new trace include is needed**.
  - Same check on the pre-commit tree: the same results, with the old layout.
- `next.config.ts`: comment-only. The htmlparser2 trace note described the old "v10 hoisted, entities 7 nested under it" layout, which was stale even before this bump. The include list is unchanged.
- Gates: typecheck 0 / 1,245 (`next-env.d.ts` exists from the build); `lib/html*.test.ts` + `lib/html/*.test.ts` 155 pass / 0 fail.

## 6. Build type gate, variant B (`8d5fd37`)

- `next.config.ts`: `typescript: { ignoreBuildErrors: true }` with a comment. `build` script: **`generateBuildVersion → next build → bun check → prepareStandaloneShutdown`**.
- **tsconfig coverage:** `include` already lists `".next/types/**/*.ts"`, so I did not widen anything. I verified that `bun check` really checks those files: a scratch error appended to `.next/types/validator.ts` was reported, and a scratch `.next/types/zz-probe.ts` raised the file count by 1. With `ignoreBuildErrors`, Next still generates `.next/types` (`cache-life.d.ts`, `root-params.d.ts`, `routes.d.ts`, `validator.ts`), and the list is identical to before.
- **(a) Type error in an app file:** `export const typeGateProbe: number = "not a number"` in `app/page.tsx` makes `bun run build` **exit 1**. The output prints `app/page.tsx` 8:14 TS2322 "Type 'string' is not assignable to type 'number'", and prepareStandaloneShutdown does not run. Before (e70c30b config): exit 1 with the same TS2322 from Next ("Failed to type check").
- **(b) typedRoutes:** `next.config.ts` has **`typedRoutes: false`**. A `<Link href="/does-not-exist-typegate-probe">` is therefore *not* a type error, before or after (exit 0 on both trees). This is not a regression. I did not enable typedRoutes; that is a separate decision. To prove instead that the generated route types are gated, I added `export async function OPTIONS(_request: Request, _context: { params: { accountId: number } })` to `app/api/accounts/route.ts`. Result: `bun run build` **exits 1** with `.next/types/validator.ts` 1021:31 TS2344 ("does not satisfy the constraint 'RouteHandlerConfig<"/api/accounts">'"). Before: exit 1 with the same TS2344 from Next.
- **(c) Build times** (`bun run build`, load ≤ 12 at start):

| | before (e70c30b gate, tree of commit 5) | after (variant B) |
| --- | --- | --- |
| cold (`rm -rf .next`) | **64.8 s** (load 11.92 → 15.08): Compiled 22.8 s + TypeScript 37.3 s | **31.7 s** (11.01 → 15.76): Compiled 23.7 s, "Skipping validation of types", `bun check` 0.6 s; final gate run: **26.6 s** (6.69 → 9.34), Compiled 18.8 s, `bun check` 0.6 s |
| warm (second build) | **18.4 s** (11.02 → 11.33): Compiled 5.7 s + TypeScript 7.7 s | **8.8 s** (10.94 → 13.33): Compiled 1.5 s, `bun check` 0.8 s |

- **ops/deploy-dev.sh** (read only, not edited). It runs `set -euo pipefail`, `bun install --frozen-lockfile`, `generateRuntimeConfig`, `bun run build`, then finds `.next/standalone/**/server.js` and copies `.next/static` and `public`. None of what it relies on changes:
  - Exit code: 0 on success; 1 on any type error, so it still stops before assembling.
  - `.next/standalone` file list: 4,000 files (hashes normalised), identical before/after.
  - `server.js` is still patched to `noctua-server.mjs`.
  - `.next/types` and `next-env.d.ts`: identical.
  - No tsbuildinfo is written (`bun check` writes none; Next's own `.next/cache/.tsbuildinfo` no longer appears, and nothing uses it).

  A replica of its build + assemble steps (`.tmp/bin/deploy-sim.sh`) succeeded. I left out the build-info and systemd parts because they write outside this worktree, to `ops/build-info-dev.env` and the unit. With a type error the replica stopped at `bun run build` without assembling. The assembled standalone server answered **200** on `/` and `/reset-password` on 127.0.0.1:3895 (synthetic auth secret; stopped by PID).
- **One behavioural difference:** a failed type gate now leaves a fresh but *unpatched* `.next/standalone` on disk, because Next writes it before `bun check` runs. Before, Next failed before writing standalone output, so after a failed build there was none. Every consumer (deploy-dev.sh with `set -e`, Docker `RUN bun run build`) stops on the exit code and never uses that output. Anything that ignores the exit code would now find a standalone tree without the shutdown lifecycle.
- Docker: the builder stage installs all deps (`bun install --frozen-lockfile`) and copies the source, so `bun check` (Bun 1.4.4 in `oven/bun:1.4.4-debian`) sees the same file set Next's type check saw. Not run in Docker here.

## Final gates (HEAD `8d5fd37`)

| Gate | Command | Result | Wall time (load) |
| --- | --- | --- | --- |
| Typecheck | `bun run typecheck` | 0 errors / 1,245 files | 0.8 s (9.51) |
| Lint | `bun run lint` | 0 errors / 181 warnings, findings identical to e70c30b | 55.2 s (9.51 → 9.01) |
| Unit + DOM | `bun run test:ci` | 2,915 pass / 0 fail (315 files) + DOM 565 pass / 0 fail (74 files); 0 iframe / NotSupportedError lines | 561.7 s (10.91 → 7.19) |
| Stress | `bun run test:stress` | 8,745 pass / 0 fail (2,915 × 3, seed 1337, 315 files) | 1,437.5 s (7.19 → 6.92) |
| Build, cold | `rm -rf .next && bun run build` | exit 0; "Skipping validation of types"; `bun check` 0 errors / 1,245 files | 26.6 s (6.69 → 9.34) |
| Standalone workers | `bun run test:standalone-workers` (warm build) | exit 0, "Verified worker runtime files in .next/standalone"; server.js patched | 7.7 s (9.34 → 11.02) |
| Clean tree | `git status --short` | empty | |

Lint findings diff on the final tree vs e70c30b: **0 added, 0 removed** (per `file:line:col:rule:severity`). The linted file count rises from 1,254 to 1,256: `lib/testSetupDom.dom.test.tsx` is new, and `public/runtime-config.js` is a gitignored file generated by the deploy replica.

## Lock notes

- Package entries in `bun.lock`: 1,168 → 1,163.
- nodemailer: a single 10.2.1 (mailparser's nested 10.2.0 is gone).
- undici-types: a single 7.24.6, after removing bun's stale nested `bun-types/undici-types@7.19.2` entry (commit 1).
- ESLint 10: about 20 packages leave, about 15 enter; minimatch 3 stays nested under the three out-of-range plugins.
- htmlparser2 family: hoisting flipped by @types/sanitize-html (commit 5); runtime versions unchanged.
- After each lock change I ran `rm -rf node_modules && bun install --frozen-lockfile` so that no stale nested directories remain (Bun leaves them behind on in-place updates).

## Dropped

Nothing. Commit 5 had the only drop condition (`test:standalone-workers` red), and it stayed green, backed by the deeper layout check above.

## Merge check

`git fetch origin integration/stage`: the stage head has moved to **`45060d0`** (100 commits after e70c30b, including perf/rrule-lazy, perf/test-parallel-fixes, fix/fts-german-folding and feat/reader-focus).

- `git merge-tree --write-tree HEAD origin/integration/stage`: **exit 0, no conflicts**, tree `ec299ed`. Overlapping files: stage adds cache headers to `next.config.ts` and two `test:*parallel*` scripts to `package.json`; both merge cleanly with this branch. `bun.lock` is unchanged on stage. Stage still has `import ts from "typescript"` in `lib/authStreams.test.ts`, which this branch replaces.
- Sanity check on the merged tree. I made a dangling `git commit-tree` object (on no ref) and checked it out detached in this worktree, then switched back to the branch.
  - `bun run typecheck`: 0 errors / 1,281 files.
  - `bun run test:dom`, first run under a load spike (9.89 → 29.14): 635 / 1 fail. The failure is `app/components/calendar/useEventReminderState.dom.test.tsx` "recurring reminders retain the next occurrence and disable after the last one", new on stage from perf/rrule-lazy; its `flushRecurrenceImport()` assumes the hook's lazy import settles within one extra microtask.
  - That file alone: 5/5 runs pass. Full DOM suite again at normal load (11.19 → 6.72): **636 pass / 0 fail across 80 files, 0 iframe / NotSupportedError lines**, 78.1 s.
  - I read this as a load-sensitive timing assumption in that new test, not a happy-dom 21 effect. Flag it to the rrule-lazy owner if it recurs.
- After the merge, re-run the full gates on the merged head (not done here: only the branch is gated in full).

## Follow-ups (not done here)

- `verifyStandaloneWorkerBuild.ts` checks only local worker files. Make it also resolve and bundle the worker entrypoints inside `.next/standalone`, as done by hand for commit 5, so that hoisting changes are caught automatically.
- `typedRoutes` is off, so links to missing routes are not type-checked; enabling it is a separate decision.
- The three eslint-config-next plugins run outside their declared ESLint peer range; watch ESLint 10 minors.

## Process notes

- Logs, scratch scripts (`.tmp/bin/`, `.tmp/netguard.ts`, `.tmp/worker-resolve-check.ts`, `.tmp/compare-transpile.ts`) and lint JSONs are in the worktree's ignored `.tmp/` (`.tmp/logs/timings.txt` lists every timed run).
- The load gate (1-min load ≤ 12) was applied before every `bun run build`, `test:ci`, `test:stress` and standalone run. It was not applied to two lighter runs during commits 2/3: the ESLint 10 lint (load 12.54 at start) and the two DOM-only suite runs for commit 3 (14.42 / 15.37 at start). Their counts are unaffected; their wall times are inflated.
- Port use: 127.0.0.1:3895 only, for the standalone smoke start in commit 6. One `bun server.js` child got reparented, so `$!` did not catch it. I identified it via `ss` and its cwd (this worktree's `.next/standalone`) and stopped it by PID. Ports 3895–3897 are free.
- Removed after use: the scratch probe files, the isolated standalone copy in `data/noctua-data-deps-wave-r9/`, and the gitignored `public/runtime-config.js` written by the deploy replica. The worktree is clean on `8d5fd37`.
