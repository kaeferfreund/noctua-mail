# Dependency stacked lockfile line

Base: `9424150f5aa0a446ed9bc03ed199e6825129467d`. Runtime: Bun **1.4.4**, Next **16.2.4**, linux-arm64/glibc.

- A: `b3ad7240326465b361126fc18bb40008d73c256b` (`chore/deps-sharp`).
- B: `f6c133a5b2a66d5894756a584ed366ddecf4e33a` (`chore/deps-imapflow2`), completed and validated.
- C: `3fe0562ada13f4df517b4885fc7dd2bfb285e73d` (`chore/deps-nodemailer-mcp`), completed and validated.

Ancestry verified: **A → B → C**. C contains all three dependency branches with Bun-generated combined lockfiles.

All heavy commands use `nice -n 10`; tests export worktree-local `TMPDIR=$PWD/.tmp/lock-line/tmp`. The repository provides `test:stress`, not `stress`, so the requested stress gate uses `bun run test:stress`. The documented lint result (exit 1, 1 error + 25 warnings) is retained as the accepted baseline.

## Stage B — sharp into imapflow

Worktree: `/home/monkey/code/noctua-mail/wt-deps-imapflow`.

Merge: `f6c133a5b2a66d5894756a584ed366ddecf4e33a`.
Parents: `ac566eb57a704b7967e738db4a0b29e27866cd55` and A.
Message: `Merge chore/deps-sharp into chore/deps-imapflow2 (lock line stage B)`.

**Conflicts:** none. Git's ort merge automatically combined package.json, next.config.ts and bun.lock and created the requested merge commit. To enforce the requested lock-generation rule even without a conflicted index, restored `HEAD^1:bun.lock` (the pre-merge B / ours lockfile), then ran `nice -n 10 bun install` without frozen-lockfile. Its result exactly matches the committed auto-merge lockfile; no amendment or extra commit was necessary. Source STATUS/SEARCH guards remain unchanged.

Final package.json dependency and override lines:

```json
    "@modelcontextprotocol/sdk": "1.29.0",
    "imapflow": "^2.9.1",
    "nodemailer": "^8.0.11",
  "overrides": {
    "sharp": "0.35.5",
```

Final tracing includes, with original comments preserved:

```ts
  outputFileTracingIncludes: {
    // Next 16.2's tracer misses sharp 0.35's libvips shared library.
    // Include the installed platform's binaries in standalone deployments.
    "/*": ["./node_modules/@img/sharp-libvips-*/lib/**"],
    "/api/accounts/*/sync": [
      ...workerRuntimeTraceFiles,
      // imapflow 2 has separate import/require exports; keep both runtime trees
      // available to standalone routes and the Bun worker subprocesses.
      "./node_modules/imapflow/**",
```

**Lock delta vs pre-merge B (`ac566eb`):** bun.lock +33/-28 lines; 28 existing package records updated and 2 added, all in sharp's dependency graph; no records removed. sharp/native bindings/WASM 0.34.5 → 0.35.5; libvips packages 1.2.4 → 1.3.4; @emnapi/runtime 1.8.1 → 1.11.3; @img/colour 1.0.0 → 1.1.0; sharp/semver 7.7.3 → 7.8.5; new FreeBSD and WebContainers WASM wrappers; sharp override added. imapflow, nodemailer, SDK and Next versions unchanged from pre-merge B. Install reported 5 packages installed. Frozen install: exit 0, **1,090 installs / 1,097 packages, no changes**; package.json/bun.lock SHA-256 hashes unchanged; both and next.config.ts equal the merge commit.

**Installed versions:** sharp **0.35.5**, imapflow **2.9.1**, direct nodemailer **8.0.11**, SDK **1.29.0**, Next **16.2.4**. Existing mailparser-private nodemailer **10.2.0** is retained.

**Gates:**

- `bun run typecheck`: **PASS**, exit 0, **0 errors / 1,175 files**.
- `bun run lint`: **baseline unchanged**, exit 1, **1 error + 25 warnings**. Error: `app/components/calendar/useCalendarConflicts.ts:58`, `react-hooks/set-state-in-effect`.
- `bun run test:ci`: **PASS**, exit 0; **2,754 unit / 0 fail**, **11,309 assertions**, **300 files**, **456.06s**; **433 DOM / 0 fail**, **2,553 assertions**, **52 files**, **66.99s**. First run passed; no retry.
- `bun run test:stress`: **PASS**, exit 0; **8,262 pass / 0 fail**, **33,927 assertions**, **300 files**, **1,283.42s**; seed **1337**, rerun-each **3**. First run passed; no retry.
- `bun run build`: **PASS**, exit 0; production Next **16.2.4** standalone produced. Removed old generated standalone output before building. Removed only two obsolete ignored non-target optional directories left by prior installs: `@img/sharp-linuxmusl-arm64` 0.34.5 and `@img/sharp-libvips-linuxmusl-arm64` 1.2.4, matching the sharp report's cleanup.
- Standalone content/runtime: **PASS**, sharp **0.35.5**, imapflow **2.9.1**, nodemailer **8.0.11**, ARM64/glibc libvips package **1.3.4**; `lib/libvips-cpp.so.8.18.7`, supporting lib files and `noctua-server.mjs` present. Standalone sharp actually loads: **libvips 8.18.7 / librsvg 2.63.2**. imapflow CJS root and legacy tools/handler paths resolve inside standalone.
- `bun build-scripts/verifyStandaloneWorkerBuild.ts`: **PASS**, exit 0.
- `bun test ./lib/mail/imap.structure.test.ts`: **PASS**, exit 0, **46 pass / 0 fail**, **122 assertions**, **1 file**, **352ms**.
- `bun scripts/checkGracefulShutdown.ts --port 3791 --data-dir /home/monkey/code/noctua-mail/data/noctua-data-wt-deps-imapflow`: **PASS**, health **200**, owned PID **1768213**, child exit **0**, signal null, **53ms**, **forced=false**.
- Standalone icon HTTP spot checks on **3791**, `APP_ENV_LABEL=LOCK`: **PASS**. `/icon`: **200 / image/png / 256×256 / 14,241 bytes**; `/icons/badged/32`: **200 / image/png / 32×32 / 1,977 bytes**; `/manifest.webmanifest`: **200 / application/manifest+json**, parsed **3 icons**; fetched declared `/icons/badged/192`: **200 / image/png / 192×192 / 10,644 bytes**. All PNG signatures and dimensions verified. Static/public assets copied into standalone before serving. Icon server owned PID **1768299** exited **0** after SIGTERM.
- `git diff --check`, committed-file equality and final clean status: **PASS**. No listeners remain on **3791/3792**.

Probe processes loaded this worktree's `.env.local` data directory unchanged; missing startup auth settings were supplied only in process environment using an ephemeral synthetic secret and loopback origin/RP ID. Watcher and telemetry disabled; no mailbox operations performed. Stage B scratch was deleted after recording results and transferring only the temporary probe harness to stage C.

`git log --oneline 9424150..HEAD` on chore/deps-imapflow2:

```text
f6c133a Merge chore/deps-sharp into chore/deps-imapflow2 (lock line stage B)
b3ad724 chore(deps): pin sharp 0.35.5 (security advisory)
ac566eb chore(deps): upgrade imapflow to 2.9.x
```

## Stage C — stage B into nodemailer / MCP

Worktree: `/home/monkey/code/noctua-mail/wt-deps-mailer`.

Merge: `3fe0562ada13f4df517b4885fc7dd2bfb285e73d`.
Parents: `bd929411b5e74f7695d4f162b5733564f2dc07de` and B (`f6c133a5b2a66d5894756a584ed366ddecf4e33a`).
Message: `Merge chore/deps-imapflow2 into chore/deps-nodemailer-mcp (lock line stage C)`.

**Conflicts:** none. Git's ort merge automatically combined package.json and bun.lock; next.config.ts incorporated B's complete tracing changes without conflict. Both nodemailer type-stub deletions remain in place (`types/nodemailer.d.ts`, `lib/types/nodemailer-mail-composer.d.ts`), along with the existing punycode namespace import. To enforce the lock-generation rule, restored `HEAD^1:bun.lock` (pre-merge C / ours), then ran `nice -n 10 bun install` without frozen-lockfile. The regenerated result exactly matches the committed merge lockfile; no amendment or extra commit was necessary.

Final package.json dependency and override lines:

```json
    "@modelcontextprotocol/sdk": "1.32.1",
    "imapflow": "^2.9.1",
    "nodemailer": "^10.2.1",
  "overrides": {
    "sharp": "0.35.5",
```

Final tracing includes, with original comments preserved:

```ts
  outputFileTracingIncludes: {
    // Next 16.2's tracer misses sharp 0.35's libvips shared library.
    // Include the installed platform's binaries in standalone deployments.
    "/*": ["./node_modules/@img/sharp-libvips-*/lib/**"],
    "/api/accounts/*/sync": [
      ...workerRuntimeTraceFiles,
      // imapflow 2 has separate import/require exports; keep both runtime trees
      // available to standalone routes and the Bun worker subprocesses.
      "./node_modules/imapflow/**",
```

**Lock delta vs pre-merge C (`bd92941`):** bun.lock **+40/-53 lines**; **34 existing package records updated, 2 added, 9 removed**. Includes the same 28 sharp-graph updates and 2 new WASM wrappers as B, plus six imapflow-graph upgrades: imapflow **1.7.8 → 2.9.1**, @zone-eu/mailsplit **5.4.16 → 5.4.29**, encoding-japanese **2.3.0 → 2.4.0**, libbase64 **1.3.0 → 1.4.1**, libmime **5.4.3 → 5.6.3**, libqp **2.1.1 → 3.0.1**. Removed redundant `imapflow/socks`, `mailparser/@zone-eu/mailsplit` plus its two nested paths, and `mailparser/libmime` plus its four nested paths. Workspace imapflow range and sharp override updated. No unrelated package upgrade; nodemailer, SDK and Next stay at pre-merge C versions. Install reported **12 packages installed**. Frozen install: exit **0**, **1,087 installs / 1,096 packages, no changes**; package.json/bun.lock SHA-256 hashes unchanged; both and next.config.ts equal the merge commit.

**Installed versions:** sharp **0.35.5**, imapflow **2.9.1**, nodemailer **10.2.1**, SDK **1.32.1**, Next **16.2.4**. mailparser's exact nested nodemailer **10.2.0** is retained. **Zero nodemailer 8 copies**, verified by all nodemailer package manifests in installed node_modules and fresh standalone output and by all lockfile package records.

**Gates:**

- `bun run typecheck`: **PASS**, exit **0**, **0 errors / 1,174 files**.
- `bun run lint`: **baseline unchanged**, exit **1**, **1 error + 25 warnings**. Error remains `app/components/calendar/useCalendarConflicts.ts:58`, `react-hooks/set-state-in-effect`.
- `bun run test:ci`: **PASS**, exit **0**; **2,754 unit / 0 fail**, **11,309 assertions**, **300 files**, **456.97s**; **433 DOM / 0 fail**, **2,554 assertions**, **52 files**, **76.29s**. First run passed; no retry.
- `bun run test:stress`: **PASS**, exit **0**; **8,262 pass / 0 fail**, **33,927 assertions**, **300 files**, **1,357.71s**; seed **1337**, rerun-each **3**. First run passed; no retry. Waited for clean process exit after its test summary before starting the build.
- `bun run build`: **PASS**, exit **0**; fresh production Next **16.2.4** standalone produced. Removed prior generated standalone output and the two stale ignored non-target musl directories (sharp **0.34.5** / libvips **1.2.4**) before building, as in B.
- Standalone content/runtime: **PASS**, sharp **0.35.5**, imapflow **2.9.1**, nodemailer **10.2.1**, ARM64/glibc libvips package **1.3.4**; `lib/libvips-cpp.so.8.18.7`, supporting lib files and `noctua-server.mjs` present. Standalone sharp loads with **libvips 8.18.7 / librsvg 2.63.2**. imapflow CJS root and legacy tools/handler paths resolve. Standalone nodemailer manifests are only **10.2.1** (root) and **10.2.0** (mailparser-private).
- `bun build-scripts/verifyStandaloneWorkerBuild.ts`: **PASS**, exit **0**.
- `bun test ./lib/mail/imap.structure.test.ts`: **PASS**, exit **0**, **46 pass / 0 fail**, **122 assertions**, **1 file**, **350ms**.
- Requested focused command, `bun test lib/mail lib/outboundAuthorization.routes.test.ts lib/senderIdentity.test.ts ./app/api/mcp/route.test.ts ./lib/mcpAuth.identities.test.ts`: **PASS**, exit **0**, **283 pass / 0 fail**, **877 assertions**, **25 files**, **24.72s**. Includes all five MCP route tests and the MCP identity test.
- `bun scripts/checkGracefulShutdown.ts --port 3793 --data-dir /home/monkey/code/noctua-mail/data/noctua-data-wt-deps-mailer`: **PASS**, health **200**, owned PID **1902855**, child exit **0**, signal null, **59ms**, **forced=false**.
- Standalone icon HTTP spot checks on **3793**, `APP_ENV_LABEL=LOCK`: **PASS**. `/icon`: **200 / image/png / 256×256 / 14,241 bytes**; `/icons/badged/32`: **200 / image/png / 32×32 / 1,977 bytes**; `/manifest.webmanifest`: **200 / application/manifest+json**, parsed **3 icons**; fetched declared `/icons/badged/192`: **200 / image/png / 192×192 / 10,644 bytes**. All PNG signatures and dimensions verified. Static/public assets copied into standalone before serving. Icon server owned PID **1902941** exited **0** after SIGTERM.
- `git diff --check`, committed-file equality, final clean status and **A → B → C** ancestry: **PASS**. No listeners remain on **3793/3794**.

Probe processes loaded this worktree's `.env.local` data directory unchanged, with ephemeral process-only synthetic auth settings, loopback origin/RP ID, watcher disabled and telemetry disabled. No mailbox operations or external delivery performed. Temporary test data, logs and probe harness were removed after the report was recorded; generated build output and installed dependencies remain available.

`git log --oneline 9424150..HEAD` on chore/deps-nodemailer-mcp:

```text
3fe0562 Merge chore/deps-imapflow2 into chore/deps-nodemailer-mcp (lock line stage C)
f6c133a Merge chore/deps-sharp into chore/deps-imapflow2 (lock line stage B)
b3ad724 chore(deps): pin sharp 0.35.5 (security advisory)
ac566eb chore(deps): upgrade imapflow to 2.9.x
bd92941 chore(deps): upgrade @modelcontextprotocol/sdk to 1.32.x
de89651 chore(deps): upgrade nodemailer to 10.x
```

## Handoff

Integration tip is **C (`3fe0562ada13f4df517b4885fc7dd2bfb285e73d`)**; B remains **`f6c133a5b2a66d5894756a584ed366ddecf4e33a`**, and A remains **`b3ad7240326465b361126fc18bb40008d73c256b`**. Both worktrees are clean. The only nonzero requested gate is the explicitly documented unchanged lint baseline. There were no new gate failures and no test retries.

All heavy commands used `nice -n 10`. Each stage's worktree-local test scratch was deleted. Both owned probe servers exited normally; no processes belonging to others were stopped. Manual standalone servers used only **3791** for B and **3793** for C; **3792/3794** were not needed. Existing repository test harnesses used their synthetic fixtures and normal isolated sockets. No other worktree was edited, and there was no stash, rebase, push, force operation, PR or real mailbox access.
