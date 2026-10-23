# Toolchain majors spike: TypeScript 7, ESLint 10, happy-dom 21, @types/node 26

2026-10-23. Read-only spike in the detached worktree `/home/monkey/code/noctua-mail/wt-spike-toolchain-majors` (HEAD `0ac6cfa`, the dev preview 8.9 tree: Next 16.4.2, React 19.3.1, Bun 1.4.4, host aarch64, Node 24.22.1 for the ESLint CLI). Nothing was committed, branched, pushed or deployed. Each experiment was reset with `git checkout -- package.json bun.lock <config>` plus `bun install --frozen-lockfile`. A clean `rm -rf node_modules && bun install --frozen-lockfile` was run after the TS 7 and @types/sanitize-html probes, because Bun left stale `@typescript/*` and nested `htmlparser2` directories behind.

Artifacts (diffs, lock excerpts, logs, lint summaries) are in `briefs/deps-toolchain-majors/`. Every timing ran under `nice -n 10`. The load gate (1-min load < 10) was applied before every build, full lint and DOM run; the gate never timed out. Each timing below shows the 1-min load at start → end. The host is shared with seven other agents, so treat differences under about 5 % as noise.

## Verdicts at a glance

| Package | Verdict | Measured gain |
| --- | --- | --- |
| typescript 7.0.2 (plain `typescript@^7`) | **NO-GO**: lint crashes (typescript-eslint has no TS 7 support) | build 59.5–64.8 s → 29.5–34.8 s, if lint did not matter |
| typescript 7.0.2 side-by-side (TS 6 API + TS 7 `tsc`) | **GO with changes** (later wave, needs a build-gate decision) | type-check 31.0 s → 3.8–4.0 s; build ≈ 60 s → ≈ 29.5 s only with the gate change below |
| eslint 10.13.0 | **GO** (no config change; identical findings) | none (54–59 s both ways) |
| @happy-dom/global-registrator 21.0.4 | **GO with a one-line setup change** (optional but recommended) | 85.5 s → 81.8–82.2 s (noise level) |
| @types/node 25.9.9 | **GO** (0 new errors) | n/a |
| @types/node 26.6.5 | **GO with changes** (1 new error, one-line fix), but not recommended yet | n/a |
| FullCalendar 7 | **blocked upstream** | n/a |

## Baseline (unchanged tree)

| Command | Result | Wall time (load) |
| --- | --- | --- |
| `bun run typecheck` (`bun check`) | 0 errors, 1,243 files (1,244 once `next-env.d.ts` exists after the first build) | 4.7 s first run (cold), then 0.8–0.9 s (5.31) |
| `tsc` 6.0.3 standalone, `--noEmit --incremental false` | 0 errors | 30.8–31.0 s (7.97–9.55) |
| `bun run lint` | 0 errors, 181 warnings, 1,254 files | 56.6 s (6.81 → 9.66), 55.3 s (9.31 → 10.05) |
| `bun run build`, cold (`rm -rf .next`) | ok; Next prints *Compiled 21.7 s / 21.9 s*, *Finished TypeScript in 38.7 s / 34.0 s* | 64.8 s (8.64 → 8.72), 59.5 s (9.46 → 10.63) |
| `bun run build`, warm `.next/cache` | *Compiled 1.2 s*, *TypeScript 5.5 s* (incremental `.next/cache/.tsbuildinfo`) | 10.3 s (8.05) |
| `bun run test:dom` | **563** pass / 0 fail across 73 files (the brief's 462 is outdated) | 85.5 s (9.79 → 11.03) |

Baseline lint warnings by rule: `react-hooks/refs` 59, `react-hooks/preserve-manual-memoization` 53, `react-hooks/set-state-in-effect` 40, `react-hooks/exhaustive-deps` 20, `react-hooks/purity` 4, `@next/next/no-img-element` 2, `react-hooks/immutability` 1, `react-hooks/use-memo` 1, and 1 unused-disable directive (`OverflowTabsList.tsx`).

Lock note: the lock pins **typescript-eslint 8.59.0** (the `^8.59.0` overrides only *allow* 8.72.0). The TS 7 lint test was run with both 8.59.0 and 8.72.0.

Important context: Next 16.4.2 defaults to `experimental.useTypeScriptCli: true` (`next/dist/server/config-shared.js:263`). The build's type-check phase therefore spawns the `typescript` package's `tsc` binary (`next/dist/lib/typescript/runTypeCheckCli.js`); it does not use the JS compiler API. Next resolves `typescript/package.json` and takes `bin.tsc`, falling back to a `tsc<N>` bin. That phase is 34–39 s of the 60–65 s cold build.

## 1. TypeScript 7.0.2

Upstream facts:
- `typescript@7.0.2` ships **no compiler API**. Its main export is `lib/version.cjs`, plus `./unstable/*` subpaths. The TS 7.0 announcement says the new API arrives with 7.1. It recommends running side by side with the new compat package `@typescript/typescript6`, which provides a `tsc6` bin and re-exports the 6.0 API: <https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-6.0>.
- typescript-eslint 8.72.0 (latest) and canary 8.72.1-alpha.8 declare `typescript: ">=4.8.4 <6.1.0"`. 8.72.0 throws on purpose: *"typescript-eslint does not support TS 7.0 … See also https://github.com/typescript-eslint/typescript-eslint/issues/10940 for tracking typescript-eslint's support for TS >=7.1"*. Issue [#10940](https://github.com/typescript-eslint/typescript-eslint/issues/10940) is open; work targets TS 7.1 in PR #12803, which as of 2026-09-29 was not ready for public review. No date is given.

### 2a. Plain `typescript@^7.0.2`

| Check | Result |
| --- | --- |
| install | ok: 20 optional `@typescript/typescript-<platform>` binaries in the lock |
| `bun check` | **2 errors**: `lib/authStreams.test.ts:17` uses `ts.transpileModule` / `ts.ScriptTarget` from the `typescript` API, which no longer exists. This is the only `typescript` import in the repo. |
| `next build` | **Next 16.4 supports TS 7 here**: it runs TS 7's `tsc` CLI, reports the same 2 errors and fails with *Failed to type check*. That is a real failure, not a fallback. |
| `next build` after a test fix | ok. Cold **34.8 s** (9.50 → 14.75), **29.5 s** (8.97 → 13.14); *Finished TypeScript in 6.9 s / 5.3 s* (baseline 38.7 / 34.0 s) |
| `tsc` 7 standalone | 3.8–4.0 s cold (`--incremental false`) vs 30.8–31.0 s for tsc 6, about **8×**. 0 errors after the fix, so TS 7's diagnostics on this tree match TS 6. |
| `bun run lint` | **crashes** in 1.6–1.9 s: 8.59.0 throws `Cannot read properties of undefined (reading 'Cjs')` in `typescript-estree/dist/create-program/shared.js:59`; 8.72.0 throws the explicit "does not support TS 7.0" error |

The test fix (spike only, reverted; `briefs/deps-toolchain-majors/ts7-authStreams-test-fix.diff`) replaces the TS API call with Bun's transpiler. The test passes and the change works on TS 6 too, so it can land on its own:

```diff
-import ts from "typescript";
 ...
-  const compiled=ts.transpileModule(wrapper,{compilerOptions:{target:ts.ScriptTarget.ESNext}}).outputText;
+  const compiled=new Bun.Transpiler({loader:"ts",target:"bun"}).transformSync(wrapper);
```

Verdict 2a: **NO-GO** while typescript-eslint has no TS 7 support. Our lint config enables no `@typescript-eslint/*` rules, but `eslint-config-next` uses its parser, which needs the TS API to parse `.ts`/`.tsx` files.

### 2b. Side by side (`ts7-side-by-side.diff`)

```json
"typescript": "npm:@typescript/typescript6@^6.0.2",
"@typescript/native": "npm:typescript@^7.0.2",
```

`@typescript/typescript6@6.0.2` is a thin wrapper. It depends on `@typescript/old: npm:typescript@^6`, so the API is still **6.0.3**. Its bin is `tsc6`, and `node_modules/.bin/tsc` becomes TS 7.

| Check | Result (load) |
| --- | --- |
| `bun check` | 0 errors; `authStreams.test.ts` works unchanged because `typescript` is the 6.0.3 API again |
| `bun run lint` | ok, **identical** findings (0 / 181, same per-rule counts), 62.8 s (8.74 → 17.44; load spike) |
| `tsc` (7) / `tsc6` | 3.8–4.0 s vs 31.0 s |
| `next build`, unchanged config | ok, 65.8 s, *TypeScript 39.1 s*: **no gain**, because Next picks `tsc6` from the `typescript` package |
| `next build` with `typescript: { ignoreBuildErrors: true }` (probe) | ok, **25.4 s** (6.97 → 8.66), *Skipping validation of types*. Adding a TS 7 `tsc --noEmit` step (≈ 4 s) gives about 29.5 s, the same as plain TS 7. |

Verdict 2b: **GO with changes**. Getting the speed-up needs all of the following:
1. Both npm aliases in `package.json` (and the lock).
2. `next.config.ts`: `typescript: { ignoreBuildErrors: true }`.
3. The `build` script runs `tsc --noEmit` (TS 7) **after** `next build`, so the generated `.next/types/**` (included by `tsconfig.json`) exist. Then `next build`'s own gate is replaced, not dropped.

Risks:
- The build gate moves out of Next. A misordered or forgotten script step silently ships untyped code. Docker and CI use `bun run build`, so the step has to live in that script.
- The `typescript` name now points to a wrapper package: an extra indirection on the 6.0.2/6.0.3 line, and any tool that reads `typescript/package.json` `bin.tsc` sees only `tsc6`.
- TS 7 changes defaults and removes options (`baseUrl`, `moduleResolution: node10`, `target: es5`, …). None of these are used in our `tsconfig.json`; TS 7 type-checks this tree with 0 errors.
- When typescript-eslint gains TS 7.1 support, unwind the aliases and switch to plain `typescript@^7.1`. Next's default CLI mode then gives the gain with no config change at all.

Cheaper alternative, not measured as a separate experiment: keep TS 6, set `ignoreBuildErrors`, and make `bun check` (0.8 s) the build's type gate. It gives the same ≈ 35 s saving without any TS 7 package. The `noctua-typecheck-bun-check` note says `bun check` reports the same errors as tsc; that held here too, since the TS 7 and @types/node 26 errors were identical in both checkers. This is a gate-policy decision for the user, not a dependency bump.

## 2. ESLint 10.13.0 (`eslint10.diff`)

Peer ranges:

| Package | Declared `eslint` peer | Includes 10? |
| --- | --- | --- |
| eslint-config-next 16.4.2 (and 16.4.3, latest) | `>=9.0.0` | yes |
| eslint-plugin-react-hooks 7.1.1 | `… ^9.0.0 \|\| ^10.0.0` | yes |
| typescript-eslint 8.59.0 / 8.72.0 | `^8.57.0 \|\| ^9.0.0 \|\| ^10.0.0` | yes |
| eslint-plugin-react 7.37.5 (via next) | `… ^9.7` | **no** |
| eslint-plugin-jsx-a11y 6.10.2 (via next) | `… ^9` | **no** |
| eslint-plugin-import 2.32.0 (via next) | `… ^9` | **no** |

`bun add` printed no peer warnings. The lock gets smaller: `@eslint/eslintrc`, `@eslint/js`, `js-yaml`, `import-fresh`, `strip-json-comments`, minimatch 3 (hoisted) and others drop out, while `espree` 11, `eslint-scope` 9, `@eslint/core` 1.x and `file-entry-cache` 11 come in (52 insertions, 68 deletions). ESLint 10 needs Node `^20.19 || ^22.13 || >=24`; the host runs 24.22.1. Lint does not run in the Docker image.

Results:
- **No change to `eslint.config.mjs`.** It already uses flat config with `defineConfig`/`globalIgnores` from `eslint/config`, and there is a single root config, so ESLint 10's per-file config lookup changes nothing.
- Lint: 0 errors / 181 warnings. **Per finding (file:line:col:rule:severity) the result is identical to the baseline**: 0 added, 0 removed.
- Because three plugins are outside their declared peer range, a probe file (`eslint10-probe.txt`) was linted under ESLint 10. Every plugin still reports: `react/jsx-key`, `react/no-unescaped-entities`, `react/display-name`, `jsx-a11y/aria-props`, `jsx-a11y/alt-text`, `import/no-anonymous-default-export`, `@next/next/no-img-element`, `react-hooks/rules-of-hooks` and our `no-restricted-imports` boundary rule all fired.
- Time: 58.8 s (7.61 → 10.06) and 56.2 s (9.84 → 12.60), against 56.6 s and 55.3 s for the baseline. No measurable change.
- **ESLint 10 + TS side-by-side** (`eslint10-plus-ts7-side-by-side.diff`): lint ok, identical 0 / 181 findings, 54.1 s (9.82 → 9.68); `tsc` 7 4.1 s; `bun check` 0 errors.

Verdict: **GO**. Risks: the three plugins under eslint-config-next run outside their declared peer range. They work today because they use the `context.sourceCode` fallbacks, but a future ESLint 10 minor could break them, and they are not ours to pin. Upstream context: ESLint v9 reached end of life on 2026-08-06 ([eslint.org notice](https://eslint.org/blog/2024/09/eslint-v8-eol-version-support/); the 9.39.5 release notes add an EOL notice). Staying on 9 means no further fixes.

## 3. happy-dom 21.0.4 (`happydom21.diff`)

Release notes ([v21.0.0](https://github.com/capricorn86/happy-dom/releases/tag/v21.0.0), [releases](https://github.com/capricorn86/happy-dom/releases)):
- 21.0.0 has one breaking change: **CSS file loading and iframe page loading are disabled by default** (SSRF hardening). New settings are `enableCSSFileLoading` / `enableIframePageLoading`; `disableCSSFileLoading` is deprecated.
- 21.0.1 only changes server-renderer CLI aliases. 21.0.2 fixes server-renderer SSRF, 21.0.3 stops forwarding the auth header on redirect, and 21.0.4 fixes ESM-compiler code injection and `data:` iframe isolation.
- **No 20.x backport** exists: 20.14.6 is the last 20.x and `latest` is the only dist-tag. The registrator API (`register({ width, height, url, settings })`) is unchanged.

| Run | Result | Time (load) |
| --- | --- | --- |
| baseline 20.14.6 | 563 / 0 | 85.5 s (9.79 → 11.03) |
| 21.0.4, no code change | **563 / 0**, but 54 extra `NotSupportedError: Failed to load iframe page "about:blank". Iframe page loading is disabled.` logs from `HtmlMessage.privacy` / `HtmlMessage.memo` (the `srcdoc` message iframe). The log grows from 755 to 1,785 lines. | 81.8 s (8.79 → 9.52) |
| 21.0.4 + setup change below | **563 / 0**, log back to 755 lines, `bun check` 0 errors | 82.2 s (8.21 → 9.60) |

```diff
-GlobalRegistrator.register();
+// happy-dom 21 disables iframe page loading by default; HtmlMessage renders a
+// srcdoc iframe, which then logs a NotSupportedError for about:blank per mount.
+GlobalRegistrator.register({ settings: { enableIframePageLoading: true } });
```

Verdict: **GO with this one-line change** (optional; without it the tests still pass but the noise hides real errors). CSS loading can stay disabled, since no DOM test needs it. The setting re-enables only what 20.x did by default, for trusted test fixtures. Speed: no meaningful change (−4 %, within noise).

## 4. @types/node (`types-node-25.9.9.diff`, `types-node-26.6.5.diff`)

| Version | `bun check` | `tsc` 6 | Lock side effect |
| --- | --- | --- | --- |
| 25.6.0 (locked) | 0 | 0 | |
| **25.9.9** | **0 (Δ 0)** | 0 (30.8 s) | undici-types 7.19.2 → 7.24.6; bun-types gets a nested undici-types 7.19.2 |
| **26.6.5** | **1 (Δ +1)** | 1 (32.7 s) | undici-types → 8.9.0 |

The new error under 26: `scripts/dev-fixture/verify-http.ts:37:50` TS2769. `assert.notEqual(…, status.job.error)` now rejects `string | undefined`, because the message overloads were split into `Error | AssertMessageFunction | undefined` and `string, ...args`. The fix is `status.job.error ?? "sync job failed"`.

Verdict: take **25.9.9** in the wave (GO). For 26.6.5: *GO with changes*, but it describes Node 26 APIs, while the runtime is Bun 1.4.4 (whose own `bun-types` pin `@types/node: *`) and Node 24 for tooling. Bumping it advertises APIs we don't run on. Hold it until the runtime moves.

## 5. Patch bumps for a later wave (release notes only, plus cheap lock checks)

| Package | Change | Risk |
| --- | --- | --- |
| **mailparser** 3.12.3 → 3.12.4 (prod) | Changelog: "update dependencies". Tarball diff: `lib/` **identical**; only the `nodemailer` pin moves 10.2.0 → 10.2.1. That drops the nested `mailparser/nodemailer@10.2.0`, since we already have root nodemailer 10.2.1. (3.12.3, from the same day, carried the RFC 2231 / Content-Type comment changes, already in the lock.) | Very low. `patch-mailparser.txt`. |
| **@types/bun** 1.4.3 → 1.4.4 | bun-types 1.4.4, matching the Bun 1.4.4 runtime and Docker image; `bun check` 0 errors | Very low. `patch-types-bun.txt`. |
| **@types/sanitize-html** 2.16.1 → 2.16.2 | Types now depend on `htmlparser2 ^12` instead of `^10.1`. **This flips the hoisting:** `node_modules/htmlparser2` becomes 12.0.0 (with domhandler 6, domutils 4, domelementtype 3), and html-to-text's htmlparser2 10.1.0 + entities 7 move to `node_modules/html-to-text/node_modules/`. | **Medium for a types-only bump.** `next.config.ts` hard-codes `"./node_modules/htmlparser2/**"` into the sync-worker trace on the assumption that the hoisted copy is the CJS v10 + entities 7 tree. The worker imports `html-to-text` (`lib/mail/imap/sync.ts`). It needs `bun run test:standalone-workers` (and ideally the Docker worker check) before merging, and probably a trace entry for `./node_modules/html-to-text/**`. Also, the existing comment in `next.config.ts` ("sanitize-html 2.17 … use htmlparser2 10") is already stale: sanitize-html 2.18.1 nests htmlparser2 12. |
| **eslint** 9.39.4 → 9.39.5 | Backported "handle unavailable require cache" fix, dependency pins, EOL notice; no rule changes | Very low, but **skip it if ESLint 10 goes in** |

## 6. FullCalendar 7: still blocked upstream

`bun info … dist-tags` (`fullcalendar-dist-tags.txt`): `@fullcalendar/core`, `react` and `rrule` are `latest: 7.1.3` (legacy 6.1.22), while `daygrid`, `timegrid`, `interaction` and `list` are still `latest: 6.1.22` with no v7. No experiment.

## Recommendation for the next deps wave (in order)

1. **Low-risk batch, one commit:** mailparser 3.12.4, @types/bun 1.4.4, @types/node `^25.9.9` (not 26). Gates: `bun check`, `bun run test:ci`.
2. **ESLint 10.13.0**, no config change; drop the 9.39.5 bump. Gate: full lint (expect exactly 0 errors / 181 warnings), plus re-running the plugin probe once.
3. **happy-dom 21.0.4** plus the `enableIframePageLoading` line in `lib/testSetupDom.ts`. Gate: `test:dom`, 563 pass with no iframe `NotSupportedError` noise.
4. **Optionally, now:** the `lib/authStreams.test.ts` switch from `ts.transpileModule` to `Bun.Transpiler`. It removes the repo's only runtime dependency on the TypeScript API and makes either TS 7 path a pure tooling change later.
5. **@types/sanitize-html 2.16.2** only together with a `test:standalone-workers` run and a trace-include review (hoisting flip above). Otherwise hold it.
6. **TypeScript 7: a separate decision, not part of this wave.** The largest measured gain (cold build ≈ 60 s → ≈ 30 s; type-check 31 s → 4 s) is reachable today only via side-by-side aliases plus moving the build type gate out of Next (`ignoreBuildErrors` + `tsc` 7 after `next build`). If the user accepts that gate change, ship it as its own small PR after step 2. Otherwise wait for TS 7.1 + typescript-eslint (#10940); then plain `typescript@^7.1` works with Next 16.4's default CLI type-check and no config change.

Hold: @types/node 26 (runtime mismatch), FullCalendar 7 (upstream).

## Cleanup state

The worktree is back at `0ac6cfa` with a clean `git status`; ignored leftovers are only `.env.local` and `.tmp/` (helper scripts in `.tmp/bin`, lint JSONs). `.next/`, `next-env.d.ts` and `tsconfig.tsbuildinfo` from the spike builds were removed, and `.tmp/tmp` was emptied. `node_modules` was reinstalled from the frozen lockfile. No ports were used.
