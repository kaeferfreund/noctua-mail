# Next 16.4.2 + React 19.3.1 spike

Worktree: `/home/monkey/code/noctua-mail/wt-deps-next`
Branch: `chore/build-tracing-root`
Part A commit: `f03ece5d922b36c15706a20b3fadbacb25d5f022` (parent `c1652ec`)
Spike was not committed. After the measurements the tree was restored to that commit.

Baseline on `c1652ec` (given, not re-run here): `bun run test:ci` green (~1681 unit + 48 DOM); `bun run lint` = 1 error (`useCalendarConflicts.ts`) + 27 warnings; `bunx tsc --noEmit` ≈ 354 errors (missing `bun:test` types in tests).

## Summary

Part A pins `outputFileTracingRoot` and `turbopack.root` to the project directory. One production build on Next 16.2.4 no longer warns about `/home/monkey/package-lock.json`, and `.next/standalone/server.js` is at the top of the standalone tree. `build-scripts/verifyStandaloneWorkerBuild.ts` passed unchanged.

Part B installed Next 16.4.2, React 19.3.1, matching ESLint config, and `@types/react` / `@types/react-dom` 19.3.0, and tried Babel `reactCompiler: true`. `tsc` stayed at test-file errors only (355, 0 outside tests). `test:ci` passed (1698 unit + 48 DOM, 0 fail). Lint grew from 1 error / 27 warnings to 138 errors / 28 warnings, all new errors from `eslint-plugin-react-hooks` 7.1.1. The one allowed 16.4 `bun run build` compiled in 21.7s and then **failed typecheck** (`Failed to type check.`, exit 1). Cause: Next 16.4 defaults `experimental.useTypeScriptCli` to true, so `next build` typechecks the whole tsconfig, including `*.test.*` files that 16.2.4's API checker ignores. Standalone layout under 16.4 was **not** produced and was **not** re-checked. The two-build cap is spent; the tsconfig workaround below was not rebuilt.

No production source edits were required for the package bump. Do not enable `reactCompiler` repo-wide until the new hook-rule violations are fixed. Do not turn on `cacheComponents`.

## What changed / What was found

### (a) Part A — tracing root (committed)

`next.config.ts` derives the project directory with `path.resolve(import.meta.dirname)`. Next 16.2.4 compiles `next.config.ts` with SWC to CJS and rewrites `import.meta.dirname` to `__dirname` (the config file's directory). A `loadConfig` probe (`PHASE_PRODUCTION_BUILD`) resolved both `outputFileTracingRoot` and `turbopack.root` to `/home/monkey/code/noctua-mail/wt-deps-next` with 0 warnings. Bare `__dirname` does not typecheck under `"module": "esnext"`.

`outputFileTracingIncludes` globs stay project-relative (`cwd` is the project dir, not the tracing root). The probe still reported the sync-route includes (116 entries) starting at `./node_modules/sanitize-html/**`. `serverExternalPackages` is unchanged (`rrule`, `imapflow`, `mailparser`, `nodemailer`, `html-to-text`, `sanitize-html`). `build-scripts/workerRuntimeTraceFiles.ts` still emits `./…` paths from `process.cwd()`.

`build-scripts/verifyStandaloneWorkerBuild.ts` only checks that traced files exist under `.next/standalone`. It does not spawn a worker and does not hardcode a nested path. It was not modified. It was run only after the Part A build.

Nested-path assumptions (reported, not edited):

| Path | Assumption |
| --- | --- |
| `Dockerfile` | `COPY --from=builder /app/.next/standalone ./` then `deploy-scripts/container-entrypoint.sh` runs `exec bun --bun server.js`. Flat `server.js` at the copy root. Inside Docker there is typically only `bun.lock`, so inference may already be flat; the pin makes the host match. |
| `deploy-scripts/deploy-instance.sh` | No standalone path. |
| `.github/workflows/*.yml` | No `standalone` / `server.js` matches. |
| `build-scripts/build-desktop.sh` | Copies `.next/static` and `public` onto `.next/standalone/` (flat). |
| `build-scripts/verifyStandaloneWorkerBuild.ts` | `.next/standalone` from `process.cwd()`. |
| `src-tauri/tauri.conf.json` | `"../.next/standalone": "standalone"`. |
| `doc/DEPLOYMENT.md` | `bun --bun .next/standalone/server.js`. |
| `/home/monkey/code/noctua-mail/ops/deploy-dev.sh` (outside this worktree, not edited) | Comment and `find .next/standalone -name server.js` workaround for a nested absolute path, then systemd `WorkingDirectory` follows it. After the pin, `find` still locates the top-level `server.js`. The comment is stale. |

"No build cache found" on both builds is Next's CI warning when `ciinfo.isCI` and `.next/cache` is missing. It is not caused by the root pin.

### (b) Migration recipe — Next 16.4.2 + React 19.3.1

Apply on top of `f03ece5`. No application source edits were identified. The build **does** need a build-only tsconfig, and `bun run lint` will not stay near baseline without either a deferral or a real hooks cleanup. The tsconfig change was **not** verified with a second 16.4 build.

Exact versions (`npm view` / install resolution during the spike):

| Package | From (Part A) | To |
| --- | --- | --- |
| `next` | `16.2.4` | `16.4.2` |
| `eslint-config-next` | `16.2.4` | `16.4.2` |
| `react` | `19.2.5` | `19.3.1` |
| `react-dom` | `19.2.5` | `19.3.1` |
| `@types/react` | `^19.2.14` | `19.3.0` (latest 19.x) |
| `@types/react-dom` | `^19.2.3` | `19.3.0` (latest 19.x) |

Do not add `babel-plugin-react-compiler` for the bump itself. Do not bump TypeScript to 7 (`typescript` stays `^6.0.3`). Next 16.3 can optionally typecheck with TS 7; that path was not used.

`package.json` (current lines: `next` 63, `react` 69, `react-dom` 70, `@types/react` 98, `@types/react-dom` 99, `eslint-config-next` 102):

```json
"next": "16.4.2",
"react": "19.3.1",
"react-dom": "19.3.1",
"@types/react": "19.3.0",
"@types/react-dom": "19.3.0",
"eslint-config-next": "16.4.2"
```

Then `nice -n 10 bun install`.

**Build blocker (required config, unverified).** Next 16.4 `node_modules/next/dist/server/config-shared.js:263` defaults `experimental.useTypeScriptCli: true`. The CLI checker typechecks the complete tsconfig (`verify-typescript-setup.js`, "Failed to type check."). The 16.2 API checker in `runTypeCheck.js` still filters `(?<=[\\/.])(?:spec|test)\.[^\\/]+$` plus `__tests__` / `__mocks__`, which is why Part A printed "Finished TypeScript" despite ~354 test errors. The spike build printed those same `bun:test` errors and exited 1 before "Finished TypeScript" or page collection.

Add `tsconfig.build.json` (exclude replaces the base exclude; repeat `node_modules` and `src-tauri`):

```json
{
  "extends": "./tsconfig.json",
  "exclude": [
    "node_modules",
    "src-tauri",
    "**/*.test.ts",
    "**/*.test.tsx",
    "**/*.dom.test.tsx",
    "**/__tests__/**",
    "**/__mocks__/**"
  ]
}
```

In `next.config.ts`, next to the existing `typedRoutes: false` (committed file line 18):

```ts
typescript: {
  tsconfigPath: "tsconfig.build.json"
},
```

`typescript.tsconfigPath` is a supported string on the 16.4 config (`config-shared.js` default `undefined`, schema `z.string().min(1).optional()`). Keep `bunx tsc --noEmit` on the main `tsconfig.json` so the test-file count stays visible. Do not set `typescript.ignoreBuildErrors: true` (hides real app errors). Do not set `experimental.useTypeScriptCli: false` unless the goal is to restore the old filtered checker; the CLI is the 16.4 default and is what failed. Do not "fix" the ~354 `bun:test` errors as part of the bump. **This exclude was not applied and not rebuilt** (build budget was one `bun run build` per part, both already used).

**Lint deferral (optional, not a product fix, not left in the tree).** `eslint-config-next` 16.4.2 pulls `eslint-plugin-react-hooks` ^7.1.0 (resolved 7.1.1; 16.2.4 resolved 7.0.1). Recommended config now errors on the React Compiler rules. Append to the `defineConfig` array in `eslint.config.mjs` (export starts at line 175) only to keep `bun run lint` near the baseline count while the violations are fixed:

```js
{
  rules: {
    "react-hooks/preserve-manual-memoization": "off",
    "react-hooks/refs": "off",
    "react-hooks/set-state-in-effect": "off",
    "react-hooks/purity": "off",
    "react-hooks/immutability": "off",
    "react-hooks/use-memo": "off"
  }
}
```

New `@next/eslint-plugin-next` rule vs 16.2.4: `no-location-assign-relative-destination` (recommended as warn). It did not fire. It only flags static relative strings passed to `location.assign` / `location.href =`.

Measured lint errors (138), do not edit these files in the bump; several are owned by other agents (`MailClient.tsx`, `mailclient/**`):

| Errors | Rule |
| --- | --- |
| 47 | `react-hooks/preserve-manual-memoization` (compiler would skip these files) |
| 45 | `react-hooks/refs` |
| 38 | `react-hooks/set-state-in-effect` |
| 5 | `react-hooks/purity` |
| 2 | `react-hooks/immutability` |
| 1 | `react-hooks/use-memo` |

Hottest files: `app/components/MailClient.tsx` 46, `app/components/mailclient/composition/ComposeOrchestrator.tsx` 42, `message/MessageViewOrchestrator.tsx` 7, `composition/DetachedComposeWindowClient.tsx` 6, `composition/ComposeFields.tsx` 5, `composition/useDraftManager.ts` 4, `messagelist/MessageListHeader.tsx` 4, `useSyncController.ts` 4 (ref writes at 747 and 884). `app/components/calendar/useCalendarConflicts.ts:58` is now `set-state-in-effect` (`setConflicts([])`); line 64 stays the ref-cleanup warning. `useEventReminderState.ts:84` is `Date.now()` purity. Warnings: 28 vs baseline 27. The extra one is `app/components/account-settings/OverflowTabsList.tsx:51`, unused `eslint-disable` for `react-hooks/set-state-in-effect`. 25 `exhaustive-deps` + 2 `@next/next/no-img-element` make up the rest.

**Surfaces checked, no code edit identified:**

- `images.qualities` is already `[75, 85]` (`next.config.ts`). The Next 16 "only quality 75 is allowed by default" break is already handled. No `quality={` props to update.
- `typedRoutes: false` already.
- `serverExternalPackages` names are unchanged. Tracing globs stay `./node_modules/...`.
- `instrumentation.ts`: `register()` is still the API. It returns early when `NEXT_RUNTIME === "edge"`. No `middleware.ts`, no `runtime: "edge"`.
- No `"use cache"`, no `"use server"` directives, no `dangerouslyAllowSVG`.
- App Router route handlers: no breaking signature change identified in the 16.3–16.4 notes ("Separate App Route render and prerender pipelines" is internal).
- `bun --bun next build` (the `package.json` `build` script) started and compiled under 16.4.2. It did not finish a production build.
- React 19.3 (2026-09-09): stable View Transitions, Fragment refs, `react-dom` `browser()`, Trusted Types pass-through only if CSP has `require-trusted-types-for 'script'`, Strict Mode double-invokes effects during hydration, transitions render independently, a Server Component may render a client Context directly (`<UserContext value>`), conditional `use()` warning. 19.3.1 (2026-10-14) is one RSC transport change (react/react#37845). `tsc` had 0 errors outside test files under `@types/react` 19.3.0, and `test:ci` passed, so no app edit was required. Hydration double-invoke is a behavior change to watch, not a compile failure.
- Next 16.4.1 security: unauthenticated RCE in `use cache` functions that return typed arrays; RCE in Image Optimization when SVG is used; high DoS in App Router server actions. This repo has none of those surfaces. The upgrade is still the right fix.
- Standalone + `type: module` was fixed in 16.3. The tracing-root pin still loaded on 16.4 (no workspace-root warning). Flat `server.js` was **not** re-verified. Known issue [vercel/next.js#100260](https://github.com/vercel/next.js/issues/100260): 16.4 standalone can grow (client-reference manifests, more smaller server chunks, about 4–13% on a large app). Unmeasured here because the build died before emit.
- `next dev` can rewrite the managed block of `AGENTS.md` when an agent is detected. `next build` did not. Opt out with `agentRules: false` if that rewrite is unwanted. `experimental.agentUpgrade` defaults to `'security'` and may nudge in the background; the failed build log showed no nudge before typecheck died.
- Edge runtime deprecation does not affect this repo.

### (c) Perf features — recommendation

| Feature | Recommendation | Evidence |
| --- | --- | --- |
| React Compiler (`reactCompiler: true` + `babel-plugin-react-compiler@1.0.0`) | Do **not** enable repo-wide. | Spike config had the flag. Compile succeeded (`Compiled successfully in 21.7s`) and then typecheck failed, so Babel compilation itself did not fail. There was no compiler banner and no runtime (the build never served). Lint: 47 `preserve-manual-memoization` hits mean the compiler skips those components. Part A cold compile without the compiler was 15.7s. The +6.0s mixes Next 16.4.2 + React 19.3.1 + the Babel plugin; it is not a clean compiler delta. No "Finished TypeScript", no page-gen, no standalone size. |
| Rust compiler (`experimental.turbopackRustReactCompiler: true`) | Not tried. Do not turn it on until the hook violations are fixed (`reactCompiler: true` is required with it). | Upstream 16.3/16.4 blogs: v0 cold `next dev` about −34%, warm about −46% vs Babel. Unmeasured in this repo. |
| Annotation mode (`compilationMode: 'annotation'`) | Reasonable later opt-in for a few components. | Not measured. |
| Turbopack filesystem cache for builds | No config. Already default in 16.4 (`turbopackFileSystemCacheForDev` and `turbopackFileSystemCacheForBuild` true). | Warm-cache delta not measured: `.next` was removed before the only 16.4 build, and that build died at typecheck. Both builds printed "No build cache found" because CI + empty `.next/cache`. 16.4 also stores that cache with zstd (about −20–25% disk, no config). |
| `experimental.optimizePackageImports` | Leave `lucide-react` alone (already in Next's default list, with `date-fns`, `lodash-es`, MUI, …). A later measurement can add `@radix-ui/themes` and `radix-ui` (the app imports those barrels). Skip `@fullcalendar/*`: imports are already per entry (`react`, `daygrid`, `timegrid`, `interaction`, `rrule`). | Not added to the measured build. |
| `cacheComponents` / `"use cache"` / `experimental.useCache` | Do **not** enable. | This app is a dynamic mail client (IMAP, cookies, auth). `cacheComponents` is what Next 16.4 turns on for new apps and plans to default in Next 17. `experimental.useCache` is deprecated in favor of top-level `cacheComponents`. No `use cache` in the repo. The failed build did not print a `useCache` deprecation because the flag was not set. |

## Verification (exact commands + numbers)

Restored tree. Commands were run from `/home/monkey/code/noctua-mail/wt-deps-next` with `nice -n 10`.

### Part A

`nice -n 10 bun run build` → exit 0. Log `/tmp/noctua-deps-next-build-a.log`.

- Next.js 16.2.4 (Turbopack), env `.env.local`
- No "inferred your workspace root" / multiple-lockfiles warning
- `Compiled successfully in 15.7s`
- `Finished TypeScript in 25.2s`
- `Generating static pages using 11 workers (21/21) in 1649ms`
- Also printed: "No build cache found" (CI), telemetry notice, harness `NO_COLOR`/`FORCE_COLOR` Node warnings
- `.next/standalone/server.js` at the top level (`find` returned only that `server.js`, not a nested absolute path)
- `.next/standalone/node_modules/{sanitize-html,parse5,entities,imapflow,mailparser,nodemailer,html-to-text,rrule}` present

`nice -n 10 bun --bun build-scripts/verifyStandaloneWorkerBuild.ts` → passed: `[standalone-worker-check] Verified worker runtime files in .next/standalone.`

That `.next` directory was deleted before Part B (gitignored). It is not in the commit.

### Part B (packages and `reactCompiler: true` were in the working tree; not committed)

`nice -n 10 bun install` → resolved the seven spike packages (including `babel-plugin-react-compiler@1.0.0`), 31 packages installed, lockfile updated.

`nice -n 10 bunx tsc --noEmit` → exit 2. `grep -c "error TS"` = **355** (baseline ≈ 354). **0** errors outside `*.test.ts` / `*.test.tsx`. 204 are `TS2307` (mostly `bun:test`). Log `/tmp/noctua-deps-next-tsc.log`.

`nice -n 10 bun run lint` → exit 1. **166 problems (138 errors, 28 warnings)** vs baseline 1 error + 27 warnings. Log `/tmp/noctua-deps-next-lint.log`.

`nice -n 10 bun run test:ci` → exit 0. Log `/tmp/noctua-deps-next-test.log`.

- Unit: **1698 pass / 0 fail**, 4194 `expect()`, 196 files, 10.89s
- DOM: **48 pass / 0 fail**, 295 `expect()`, 8 files, 13.22s
- Baseline was stated as ~1681 unit + 48 DOM. This agent did not add tests. The unit count is what this tree printed under the spike packages.

`rm -rf .next && nice -n 10 bun run build` → **exit 1**. Log `/tmp/noctua-deps-next-build-b.log`. This was the second and last allowed `bun run build`.

- Next.js 16.4.2 (Turbopack), env `.env.local`
- `Running next.config.ts took 229ms`
- No workspace-root warning (the Part A pin still held)
- "No build cache found", telemetry notice, harness `NO_COLOR` warnings
- `Compiled successfully in 21.7s`
- Then raw `tsc` errors from test files (`bun:test` and cascades)
- `Failed to type check.`
- `error: "next" exited with code 1`
- No "Finished TypeScript", no "Collecting page data", no standalone output
- No React Compiler banner, no `experimental.useCache` deprecation, no `agentUpgrade` nudge in the log

`verifyStandaloneWorkerBuild.ts` was not re-run (nothing to verify).

### Restore

```
git checkout -- .
git clean -fd -e node_modules   # dry-run was empty
nice -n 10 bun install --frozen-lockfile
```

`bun install` v1.4.4, 31 packages installed in 8.43s, restored `next@16.2.4`, `react@19.2.5`, `react-dom@19.2.5`, `eslint-config-next@16.2.4`, `@types/react@19.2.14`, `@types/react-dom@19.2.3`, `eslint-plugin-react-hooks@7.0.1`.

Frozen install left `node_modules/babel-plugin-react-compiler` (optional peer of `next`, not in `package.json` or the restored lockfile as a direct dep). That directory was removed so a later `reactCompiler: true` cannot pick it up by accident. `git status` does not track it.

After restore: `git status` clean, `git log -1` is `f03ece5d922b36c15706a20b3fadbacb25d5f022`, `reactCompiler` is not in `next.config.ts`.

## Risks & follow-ups

- The 16.4 production build **failed**. Flat standalone, traced worker packages, and `verifyStandaloneWorkerBuild.ts` are proven only on 16.2.4. Re-run one build after `tsconfig.build.json` before shipping 16.4.
- `tsconfig.build.json` exclude list was not executed. If a non-test file imports a test helper, the build tsconfig will fail differently than this spike.
- Lint cannot match the baseline without the deferral above or a real cleanup. `MailClient.tsx` and `mailclient/**` are other agents' areas; the deferral is the minute-scale option, not a product change.
- React 19.3 Strict Mode hydrates effects twice. `test:ci` passed; there was no browser pass (this task forbade servers).
- Standalone output size on 16.4 (issue #100260) is unmeasured.
- React Compiler compile-time cost is mixed with the version bump and has no finished production build. Do not enable it from the 21.7s number alone.
- `ops/deploy-dev.sh` still documents a nested standalone path. The `find` keeps working; the comment should be updated when that script is next touched (not in this task).
- `agentUpgrade: 'security'` may phone home on a successful 16.4 build. Not observed here.

## Files touched

Committed (`f03ece5`, 1 file, +12):

- `next.config.ts` — `projectDir = path.resolve(import.meta.dirname)`; `outputFileTracingRoot` and `turbopack.root` set to it. No other config keys changed.

Spike-only, restored, not committed:

- `package.json`, `bun.lock` — version bumps and `babel-plugin-react-compiler`
- `next.config.ts` — three-line `reactCompiler: true` block, removed by `git checkout`

Not edited: Dockerfile, deploy-scripts, workflows, `build-scripts/*`, app source, `lib/db/schema.ts`, auth, IMAP, MCP, mail client. No other agents' files were modified.

Written outside the worktree: this brief.
