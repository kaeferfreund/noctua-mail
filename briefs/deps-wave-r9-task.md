# Task draft: chore/deps-wave-r9 (from the toolchain spike)

Status: APPROVED by the Umbau thread (2026-10-23, all six commits, binding conditions below). Start when the Umbau thread has pushed the round-9 head of `origin/integration/stage` (after their record commit) and sent its SHA.
Source: `briefs/deps-toolchain-majors.md` and `briefs/deps-toolchain-majors/` (spike on 0ac6cfa, the round-9 candidate tree).

## Base and isolation
- Worktree `/home/monkey/code/noctua-mail/wt-deps-wave-r9`, branch `chore/deps-wave-r9` from `origin/integration/stage` @ `e70c30b (round 9, pushed 2026-10-23 ~15:45 UTC)`; own data dir; ports from this thread's range (3791–3794, 3905–3919; never 3895–3899).
- Model `claude-judith` / `claude-opus-5-5` / `{"effort":"high","fastMode":false}`. Commits on the branch only; never push, merge, rebase, deploy. `nice -n 10`, `TMPDIR` inside the worktree.

## Commits, in this order (one concern each)
1. `mailparser` 3.12.3 → 3.12.4, `@types/bun` 1.4.3 → 1.4.4, `@types/node` → 25.9.9. Check that mailparser's nodemailer pin (10.2.1) dedupes with our root nodemailer; report `bun pm ls nodemailer`.
2. ESLint 10.13: identical findings expected (spike: 0 errors / 181 warnings). Note the peer-range warnings of eslint-plugin-react, jsx-a11y and import. ESLint 9 has been end-of-life since 2026-08-06. **Owner condition:** the commit body must prove that react, jsx-a11y and import rules still fire under ESLint 10: one deliberate violation per plugin in a scratch file (not committed), the rule ids that fired, and the full findings diff vs base (0 errors / 181 warnings, identical).
3. happy-dom 21.0.4 (`@happy-dom/global-registrator`) plus `enableIframePageLoading: true` in `lib/testSetupDom.ts`; without it every DOM run logs 54 iframe errors. **Owner conditions:** DOM suite 563/563 with zero iframe error log lines; name the HtmlMessage and HTML-privacy DOM tests explicitly in the report (iframes are security-relevant there); prove that `enableIframePageLoading` triggers NO real network loads in tests (e.g. a fetch/socket guard or request counter during the DOM suite, plus a test page whose iframe points at an external URL that must not be requested).
4. Test-only and flagged for the auth owners: `lib/authStreams.test.ts` replaces `ts.transpileModule` with `Bun.Transpiler` (passes on TS 6; removes the only TS-compiler-API use, a precondition for TypeScript 7). **Owner condition:** the test must check exactly the same behaviour as before; prove it with one mutation check (break the guarded behaviour in the module under test, show the new test fails like the old one did, revert).
5. `@types/sanitize-html` 2.16.2 ONLY if `bun run test:standalone-workers` stays green: it changes which `htmlparser2` is hoisted (12 instead of 10), and the sync-worker trace in `next.config.ts` assumes the top-level copy is v10. If it fails, drop this commit and report (owner decision: otherwise out).
6. Build type gate (variant B), APPROVED with conditions. `typescript.ignoreBuildErrors: true` in `next.config.ts`; build script order **`generateBuildVersion → next build (ignoreBuildErrors) → bun check → prepareStandaloneShutdown`**, i.e. `bun check` runs AFTER `next build` so the generated `.next/types` (typedRoutes / Route types) are type-checked too (verify that tsconfig `include` covers `.next/types/**/*.ts`; if not, say so instead of silently widening it). Proof in the commit body: (a) a deliberate type error in an app file makes `bun run build` fail (non-zero exit, error printed); (b) a deliberate typedRoutes error (a `<Link href>` / `router.push` to a non-existent route) makes `bun run build` fail; (c) build times before/after, cold (`rm -rf .next`) and warm (second build). The Umbau thread's `ops/deploy-dev.sh` calls `bun run build` and must keep working unchanged: read it (outside the repo, `/home/monkey/code/noctua-mail/ops/deploy-dev.sh`) and confirm nothing it relies on (exit code, `.next/standalone` layout, generated files) changes. Do not edit ops/.

Not in this wave: TypeScript 7 (typescript-eslint refuses TS 7 until its 7.1 support; side-by-side aliasing is fragile), `@types/node` 26 (hold), FullCalendar 7 (blocked upstream), `eslint` 9.39.5 (superseded by ESLint 10).

## Gates
All gates on the final tree; per commit at least `bun run typecheck` and the tests the commit touches.
`bun run typecheck`, `bun run lint` (findings diff vs base), `bun run test:ci` (DOM suite now about 563 tests), `bun run test:stress`, `bun run build`, `bun run test:standalone-workers`; `git merge-tree` against the then-current stage head.

## Report
`briefs/deps-wave-r9.md`: per commit the versions, changes, gate results and timings; lock dedupe notes; anything dropped and why.

## Owner decisions (Umbau thread, 2026-10-23, binding)
1. mailparser 3.12.4 + @types/bun 1.4.4 + @types/node 25.9.9: OK.
2. ESLint 10.13: OK with the rule-firing proof in the commit body (findings identical, 0 errors / 181 warnings).
3. happy-dom 21.0.4 + enableIframePageLoading: OK with DOM 563/563, no iframe error logs, HtmlMessage/privacy DOM tests named, and proof of no real network loads.
4. authStreams.test.ts → Bun.Transpiler: OK in this wave; test-only; same behaviour, one mutation check.
5. @types/sanitize-html: only with green test:standalone-workers, otherwise dropped.
6. Variant B: OK as the sixth commit; order next build → bun check; proofs (a) type error, (b) typedRoutes error, (c) cold/warm times; ops/deploy-dev.sh unchanged and working.
All from the round-9 SHA, which follows their record commit.


## Launch overrides (2026-10-23 ~15:55 UTC, orchestrator)
Base `origin/integration/stage` @ `e70c30bf316cde3f3e266806b34687e311c74088` (round 9; gates: typecheck 0 / 1,244 files, test:ci 2,915 + 564 DOM, lint 0 errors / 181 warnings = new baseline, auth browser 20/20). Worktree and branch are already created and installed. Instance claude-judith. PORTS for this task: 3895–3897 only (overrides any port list above; 3895–3899 are released to this thread since round 9; never 3790, 3795–3799, 3905–3914 = other running tasks of this thread). Load discipline: four sibling tasks run heavy gates in parallel on a shared 6-core box — before each `test:stress`, `bun run build` or full `test:ci`, check `uptime`; if the 1-min load is above 12, wait and re-check (do not skip the gate). `nice -n 10` always. Agent commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
