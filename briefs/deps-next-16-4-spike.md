# Next 16.4 / React 19.3 spike

2026-10-23. Worktree `/home/monkey/code/noctua-mail/wt-next-spike`, branch `spike/next-16-4`, baseline `9424150f5aa0a446ed9bc03ed199e6825129467d`. Review commit: `6fa896e49f464a978f1a6683a1b43e7519abe3b4`. Disposable spike only; no push, merge, rebase, stash, PR, or deployment.

## Decision

**Conditional GO for Next 16.4.2 + React 19.3.1. NO-GO for shipping the diff unchanged under the existing zero-new-lint gate.** Target **Next >=16.4.1** explicitly: 16.2.4 is below the October 14 security floor. Keep `reactCompiler` and `cacheComponents` off. Approve a scoped lint deferral or fix the new findings, and run the Docker worker-image gate on a Docker-capable host before release.

- Only required source edit: add `bfcacheId` to the i18n test router. No production application/launcher/tracing/i18n changes and **no build tsconfig workaround** are needed on this tree.
- Typecheck: **0 errors / 1,174 files**. CI: **2,754 backend + 433 DOM**, zero failures. Production build, standalone worker tracing, locale **5/5**, two browser scenarios, and live login/list/open/send passed.
- Main-route initial JS: **638,891 → 617,761 gzip bytes**, **−21,130 bytes / −3.31%**.
- Lint: **1 error + 25 warnings → 158 errors + 26 warnings**; **157 new hooks errors**. Recommendation: retain hooks 7.1.1, temporarily downgrade only the enumerated new file/rule pairs to warnings with an owned cleanup plan; keep existing correctness/dependency enforcement. No lint-policy change was applied in this spike.
- Shutdown: **40 ms idle / 98 ms watcher-enabled**; a live idling watcher with **two worker leases and one queued job** stopped in **188 ms**, exit 0, no force, zero remaining leases/queue, SQLite integrity `ok`.
- Docker image verification is **blocked by missing Docker**, not passed. `test:stress` was not rerun; the supplied baseline is 8,262 passes.
- “Advisory relevance” covers **35 exact upstream advisories/CVEs** and this app's launcher, icons, routing, Actions, optimizer and cache configuration. Installed sharp is **0.35.5**, resolved automatically by Next; no separate sharp bump or override was added.
- All owned listeners are stopped. App/probe ports were **3895/3896** after the user's port correction; synthetic IMAP/SMTP/control used OS-assigned ports. No server was started on 3790 or 3795–3799.

## Exact packages and scope

Registry `latest` was checked directly on 2026-10-23; no canaries were selected.

| Package | Baseline installed | Spike |
| --- | --- | --- |
| next | 16.2.4 | **16.4.2** |
| react / react-dom | 19.2.5 | **19.3.1** |
| @types/react | 19.2.14 | **19.3.0** |
| @types/react-dom | 19.2.3 | **19.3.0** |
| eslint-config-next | 16.2.4 | **16.4.2** |
| eslint-plugin-react-hooks | 7.0.1, transitive | **7.1.1**, explicit dev pin |
| next-intl / use-intl | 4.14.9 | **4.14.9**, unchanged |
| TypeScript | 6.0.3 | **6.0.3**, unchanged |
| Bun | 1.4.4 | **1.4.4**, unchanged |

`nice -n 10 bun install` succeeded without `--frozen-lockfile`: 28 packages installed. The lockfile changes include Next/SWC/ESLint, React/scheduler/types, parser/tooling resolution, and Next's optional native image dependency family. They are fully visible in the committed diff and appendix.

**Sharp boundary:** baseline lockfile sharp **0.34.5**; installed after the requested Next upgrade: **0.35.5**. Next 16.4.2 itself declares `optionalDependencies.sharp = "^0.35.5"`; Bun resolved this automatically during the original Next install. No direct sharp dependency, override, independent sharp bump, or image implementation change was added. Preserving 0.34.5 would contradict the target's dependency range and the SVG advisory remedy; no such downgrade was attempted. Reconcile this automatic lockfile overlap with the separate `chore/deps-sharp` branch during the real integration; that branch was not read or modified.

## Required source/config changes

There are exactly three committed files: `package.json`, regenerated `bun.lock`, and `lib/i18n/testRender.tsx`. The latter supplies the new required `AppRouterInstance.bfcacheId: string` in a test-only router fixture. A package-only typecheck initially reported TS2741 there; after the one-field edit, both Bun check and Next's full TypeScript CLI checker pass.

```diff
diff --git a/lib/i18n/testRender.tsx b/lib/i18n/testRender.tsx
index b588547..a2164bf 100644
--- a/lib/i18n/testRender.tsx
+++ b/lib/i18n/testRender.tsx
@@ -8,7 +8,7 @@ import type { UiLocale, UiLocalePreference } from "./config";
 export function I18nTestProvider({ children, locale = "en", uiLocale = null, deviceLocale = null, refresh = () => {} }: {
   children: ReactNode; locale?: UiLocale; uiLocale?: UiLocalePreference; deviceLocale?: UiLocalePreference; refresh?: () => void;
 }) {
-  const router: AppRouterInstance = { refresh, push() {}, replace() {}, back() {}, forward() {}, prefetch() {} };
+  const router: AppRouterInstance = { bfcacheId: "test", refresh, push() {}, replace() {}, back() {}, forward() {}, prefetch() {} };
   return <AppRouterContext.Provider value={router}>
     <I18nProvider locale={locale} messages={getMessages(locale)} uiLocale={uiLocale} deviceLocale={deviceLocale}>{children}</I18nProvider>
   </AppRouterContext.Provider>;
diff --git a/package.json b/package.json
index 74c6814..a6af31c 100644
--- a/package.json
+++ b/package.json
@@ -61,12 +61,12 @@
     "lexical": "^0.52.0",
     "lucide-react": "^1.61.0",
     "mailparser": "^3.12.3",
-    "next": "16.2.4",
+    "next": "16.4.2",
     "next-intl": "4.14.9",
     "nodemailer": "^8.0.11",
     "parse5": "^8.0.1",
-    "react": "19.2.5",
-    "react-dom": "19.2.5",
+    "react": "19.3.1",
+    "react-dom": "19.3.1",
     "react-markdown": "^10.1.0",
     "rehype-raw": "^7.0.0",
     "rehype-stringify": "^10.0.1",
@@ -97,14 +97,15 @@
     "@types/html-to-text": "^9.0.4",
     "@types/mailparser": "^3.9.0",
     "@types/node": "^25.6.0",
-    "@types/react": "^19.2.14",
-    "@types/react-dom": "^19.2.3",
+    "@types/react": "19.3.0",
+    "@types/react-dom": "19.3.0",
     "@types/sanitize-html": "^2.16.1",
     "eslint": "^9.39.4",
-    "eslint-config-next": "16.2.4",
+    "eslint-config-next": "16.4.2",
     "typescript": "^6.0.3",
     "shadcn": "^4.22.1",
-    "@types/qrcode": "^1.5.6"
+    "@types/qrcode": "^1.5.6",
+    "eslint-plugin-react-hooks": "7.1.1"
   },
   "overrides": {
     "typescript-eslint": "^8.59.0",
```

`next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `build-scripts/**`, `lib/server/**`, production i18n sources, and catalogs have no diff. Do not copy the older spike's proposed `tsconfig.build.json` blindly: Next 16.4 still defaults `experimental.useTypeScriptCli` to true, but this tree already includes Bun types. The actual build invoked TypeScript's CLI with `--project .../tsconfig.json --noEmit`, finished successfully in 45 seconds, and `.next/cache/.tsbuildinfo` lists **4,103 files including 355 `*.test.*` files**, e.g. `lib/i18n/resolveLocale.test.ts`. No tests were excluded and no build errors were ignored.

## Review item 1: custom standalone launcher

The full existing `bun run build` chain passed: generateBuildVersion → Next build → prepareStandaloneShutdown. A read-only capture watched the generated file before packaging; `.next/standalone/server.js` contained exactly **one** occurrence of:

```js
const { startServer } = require('next/dist/server/lib/start-server')
```

After the unchanged packaging script, the same generated line is:

```js
const { startServer } = require('./noctua-server.mjs')
```

`.next/standalone/noctua-server.mjs` exists. Thus the exactly-one import guard passed on freshly generated 16.4.2 output, rather than merely on an already patched file.

The entire installed `start-server.d.ts` is byte-for-byte identical between 16.2.4 and 16.4.2. So is the extracted `getRequestHandlers` implementation, which forwards these options into router-server initialization. The signature from `node_modules/next/dist/server/lib/start-server.d.ts` is:

```ts
export declare function getRequestHandlers({ dir, port, isDev, onDevServerCleanup,
  server, hostname, minimalMode, keepAliveTimeout, experimentalHttpsServer,
  serverFastRefresh, quiet }: {
  dir: string;
  port: number;
  isDev: boolean;
  onDevServerCleanup: ((listener: () => Promise<void>) => void) | undefined;
  server?: import('http').Server;
  hostname?: string;
  minimalMode?: boolean;
  keepAliveTimeout?: number;
  experimentalHttpsServer?: boolean;
  serverFastRefresh?: boolean;
  quiet?: boolean;
}): ReturnType<typeof initialize>;
```

The pre-existing omission of `onDevServerCleanup` passes runtime `undefined`; that declaration is not a new requirement. Router initialization still returns `requestHandler`, `upgradeHandler`, `server: handlers.server`, and `closeUpgraded()`. `ServerInitResult` retains these types. NextServer's `close()` still awaits its cleanup listeners. Additional framework metadata fields do not alter the adapter's consumed contract.

16.4.2 `start-server.js:377` still installs Next's SIGINT/SIGTERM listeners only under `if (!process.env.NEXT_MANUAL_SIG_HANDLE)`. The custom launcher sets `"1"` before initialization and bypasses Next's `startServer` wrapper. A harmless runtime observer on the actual packaged server recorded:

```json
{"pid":1615035,"title":"next-server (v16.4.2)","cwd":"/home/monkey/code/noctua-mail/wt-next-spike/.next/standalone","manual":"1","origin":"http://127.0.0.1:3895","port":"3895","sigtermListeners":1,"sigintListeners":1}
```

`__NEXT_PRIVATE_ORIGIN` remains a valid origin for the bound listener, and there is one owned signal listener per signal. The unmodified `checkGracefulShutdown.ts` passed at 3896 in **40 ms idle** and **98 ms with `NOCTUA_MAILBOX_WATCHER=1`**, both exit 0 without SIGKILL. The stronger live-fixture shutdown below also passes. The extra `checkNextStartShutdown.test.fixture.ts` probe completed its delayed HTTP 200 response in **1,530 ms**, exited **143**, left zero leases/queue with integrity `ok`, and logged no cooperative cleanup-adapter registration error.

## Review item 2: next-intl

Installed 4.14.9 peers explicitly accept:

```text
next:  ^12.0.0 || ^13.0.0 || ^14.0.0 || ^15.0.0 || ^16.0.0
react: ^16.8.0 || ^17.0.0 || ^18.0.0 || >=19.0.0-rc <19.0.0 || ^19.0.0
@types/react: ^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0
```

These ranges include the exact spike versions. The effective plugin-wrapped config preserves `output: standalone`, both pinned roots, external packages, and trace includes, and adds/retains `turbopack.resolveAlias["next-intl/config"] = "./i18n/request.ts"`. There is no locale middleware or URL rewrite. [Package metadata](https://registry.npmjs.org/next-intl/4.14.9), [official App Router setup](https://next-intl.dev/docs/getting-started/app-router).

No specific 16.4/19.3 incompatibility was found in the upstream issue search. Do not interpret that as exhaustive absence of bugs. The old cacheComponents umbrella issue is now **closed**, following Next 16.3 root-param support; it is not evidence that this app's session/cookie locale architecture is ready for caching. Leave cacheComponents off as requested. [Upstream issue #1493](https://github.com/amannn/next-intl/issues/1493).

The owners' “standalone locale 5/5” gate is a manual matrix documented in `doc/I18N.md` and earlier integration briefs; there is no matching package script. It was reproduced against the actual packaged server with public/static assets installed:

| Accept-Language | Device cookie | Expected/observed html lang | Result |
| --- | --- | --- | --- |
| de | none | de | 200, pass |
| en | none | en | 200, pass |
| en | noctua-ui-locale=de | de | 200, pass |
| de | noctua-ui-locale=en | en | 200, pass |
| en | noctua-ui-locale=invalid | en | 200, pass |

Every case also checked the corresponding description and catalog text. All returned `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate`.

Two unchanged browser scenarios from `tests/browser/auth/shell.spec.ts` passed against standalone (**2/2, 18.3 s**): activated signup/enrollment and mailbox switching/personal locale. The latter verifies language persistence after a fresh login, selected mailbox, open thread and unsent reply preservation. No hydration errors were observed during the accepted live browser session. The full 19-scenario auth suite was not rerun.

## Review item 3: worker tracing and flat layout

The effective config keeps both `outputFileTracingRoot` and `turbopack.root` at this worktree. Sync tracing has **189 entries**; thread/category recompute each have **182**. All three contain `./lib/i18n/config.ts`; the sync list retains all seven explicit parser/package globs, including `htmlparser2/**` with its nested CJS entities copy. `serverExternalPackages` remains `rrule`, `imapflow`, `mailparser`, `nodemailer`, `html-to-text`, `sanitize-html`.

`nice -n 10 bun build-scripts/verifyStandaloneWorkerBuild.ts` passed unchanged. Output remains flat at `.next/standalone/server.js`; it has the owned launcher, exactly the expected three top-level worker scripts, their local TS graph and tsconfig. Explicit checks found these files at the same flat root:

```text
lib/i18n/config.ts
node_modules/sanitize-html/package.json
node_modules/parse5/package.json
node_modules/entities/package.json
node_modules/htmlparser2/package.json
node_modules/htmlparser2/node_modules/entities/package.json
```

All three worker entrypoints were also executed from `.next/standalone`; each exited 1 at its intended argument validation (`Missing accountId in sync payload.` / `Missing accountId argument.`), without a module-resolution error. More substantially, the packaged server spawned real sync worker **PID 1615127** from its standalone cwd; it completed a two-phase full sync of **60 synthetic INBOX messages**. This exercises the traced worker graph beyond file-existence checks.

`nice -n 10 bun build-scripts/verifyDockerWorkerImage.ts` was attempted and exited 1: `Docker daemon is unavailable. Start Docker and rerun "bun run test:docker-workers".` `command -v docker` is empty. **No Docker image was built.** Host standalone execution can fall back to ancestor `node_modules`, so it is not a replacement for the isolated image gate. The actual release image must pass that gate on a Docker host.

## Lint delta and recommended policy

The baseline was rerun and exactly reproduced **1 error / 25 warnings**. After upgrading, JSON output reports **158 errors / 26 warnings**. Matching baseline diagnostics by file/rule/severity/position/message leaves **157 new errors**, all from react-hooks, and one new warning: the now-unused `react-hooks/set-state-in-effect` disable at `app/components/account-settings/OverflowTabsList.tsx:51`.

| New rule | Errors | Meaning / example |
| --- | ---: | --- |
| react-hooks/refs | 57 | Ref access inferred through render/hook calls; MailClient:891, compose/sync/collaboration hooks |
| react-hooks/preserve-manual-memoization | 52 | Compiler cannot preserve existing memoization; MailClient:1441 and 35 ComposeOrchestrator findings |
| react-hooks/set-state-in-effect | 40 | Synchronous effect state updates; MailClient:1075 and settings/admin/calendar/message surfaces |
| react-hooks/purity | 5 | Date.now / random IDs during render or initializer analysis; MailClient:431 |
| react-hooks/immutability | 2 | Access-before-declaration analysis; MailClient:387 callback captures later `setViewMessage` |
| react-hooks/use-memo | 1 | Complex dependency expression; MailClient:1304 |
| **Total new hooks errors** | **157** | The existing calendar-conflicts error is additional |

| File | New errors by rule (react-hooks/ prefix omitted) | Total new errors |
| --- | --- | ---: |
| `app/components/MailClient.tsx` | `immutability`=2, `purity`=2, `refs`=21, `set-state-in-effect`=12, `use-memo`=1, `preserve-manual-memoization`=16 | 54 |
| `app/components/account-settings/tabs/CategorizationTabContent.tsx` | `set-state-in-effect`=1 | 1 |
| `app/components/account-settings/tabs/McpTabContent.tsx` | `set-state-in-effect`=1 | 1 |
| `app/components/account-settings/tabs/MembersTabContent.tsx` | `set-state-in-effect`=1 | 1 |
| `app/components/account-settings/tabs/PreferencesTabContent.tsx` | `set-state-in-effect`=1 | 1 |
| `app/components/account-settings/tabs/TopicsTabContent.tsx` | `set-state-in-effect`=1 | 1 |
| `app/components/admin/AdminAuditLog.tsx` | `set-state-in-effect`=1 | 1 |
| `app/components/admin/AdminMailboxes.tsx` | `set-state-in-effect`=1 | 1 |
| `app/components/admin/AdminPanel.tsx` | `set-state-in-effect`=1 | 1 |
| `app/components/calendar/EventDialog.tsx` | `set-state-in-effect`=1 | 1 |
| `app/components/calendar/useEventReminderState.ts` | `purity`=1, `set-state-in-effect`=1 | 2 |
| `app/components/calendar/useEventResponseState.ts` | `set-state-in-effect`=2 | 2 |
| `app/components/mailclient/AccountReloginDialog.tsx` | `set-state-in-effect`=1 | 1 |
| `app/components/mailclient/RecipientAliasManager.tsx` | `set-state-in-effect`=1 | 1 |
| `app/components/mailclient/TopicPickerDialog.tsx` | `set-state-in-effect`=1 | 1 |
| `app/components/mailclient/composition/ComposeFields.tsx` | `set-state-in-effect`=1 | 1 |
| `app/components/mailclient/composition/ComposeOrchestrator.tsx` | `refs`=8, `preserve-manual-memoization`=35 | 43 |
| `app/components/mailclient/composition/DetachedComposeWindowClient.tsx` | `purity`=2, `refs`=4 | 6 |
| `app/components/mailclient/composition/useComposeTranslation.ts` | `refs`=2 | 2 |
| `app/components/mailclient/composition/useDraftManager.ts` | `refs`=4 | 4 |
| `app/components/mailclient/message/CalendarEventPreview.tsx` | `set-state-in-effect`=2 | 2 |
| `app/components/mailclient/message/MessageViewOrchestrator.tsx` | `set-state-in-effect`=4, `refs`=4 | 8 |
| `app/components/mailclient/messagelist/MessageListHeader.tsx` | `set-state-in-effect`=4 | 4 |
| `app/components/mailclient/useAccountController.ts` | `set-state-in-effect`=1 | 1 |
| `app/components/mailclient/useMessageData.ts` | `set-state-in-effect`=1 | 1 |
| `app/components/mailclient/useMessageMutations.ts` | `preserve-manual-memoization`=1 | 1 |
| `app/components/mailclient/useSyncController.ts` | `refs`=4 | 4 |
| `app/hooks/useMailboxSummaries.ts` | `refs`=1 | 1 |
| `app/hooks/useThreadCollab.ts` | `refs`=9 | 9 |

**Recommendation:** keep the matching **7.1.1** and temporarily change only the above new file/rule pairs to `warn`, with a named owner, expiry, and separate cleanup task, if the security upgrade must ship before refactoring. Preserve `rules-of-hooks`, existing `exhaustive-deps` handling, and the old `useCalendarConflicts.ts:58` error. This is an explicit migration-policy exception, not a green unchanged lint gate. Expect **1 error / 183 warnings** before removing the one obsolete disable. Review and fix real render purity, declaration-order, ref and effect problems in focused changes; do not enable React Compiler until that work is complete.

Do not broadly set all react-hooks rules to off, and do not delete memoization to silence the compiler analyzer. Pinning 7.0.1 is not recommended: eslint-config-next 16.4.2 requires `^7.1.0`, so a root direct pin alone can leave Next loading a nested 7.1.x; forcing a global override would step outside that declared dependency range and discard newer diagnostics. No warning override or old-plugin override was installed in this spike. The exact new file/rule pairs above are the proposed scope, not an applied patch.

## Bundle and gates

Measured on fresh baseline/target builds in the same worktree. Method: read each route's `firstLoadChunkPaths` from `.next/diagnostics/route-bundle-stats.json`, deduplicate paths, and sum the raw bytes and **each file's** `node:zlib.gzipSync(bytes,{level:6}).length`. Decimal KB; no concatenated compression. Node **24.22.1**, zlib **1.3.2.1-motley-285e94b**. This exactly reproduces the supplied 638.9 KB baseline. Bun's zlib implementation gave 643,215 for the same baseline files, so it was not mixed into the comparison.

| Route | Chunks before → after | Raw bytes before → after | Gzip bytes before → after | Gzip delta |
| --- | --- | --- | --- | --- |
| `/` | 27 → 24 | 2,115,748 → 2,003,459 | 638,891 → 617,761 | -21,130 (-3.31%) |
| `/message/window` | 21 → 20 | 1,421,946 → 1,337,925 | 430,590 → 416,150 | -14,440 (-3.35%) |
| `/compose/window` | 18 → 18 | 1,329,227 → 1,251,636 | 403,277 → 390,526 | -12,751 (-3.16%) |
| `/calendar/window` | 19 → 17 | 1,250,187 → 1,170,099 | 373,441 → 358,378 | -15,063 (-4.03%) |

This is initial JS payload, not measured load time or a network HAR; it excludes CSS, fonts, HTML/RSC and subsequent interactions. Compiler/cache flags stayed off.

| Gate | Result |
| --- | --- |
| bun install | 0; matching stable packages installed and lockfile regenerated |
| bun run typecheck | 0; 1,174 files, after test-router field fix |
| bun run lint | 1; 158 errors / 26 warnings, delta classified above |
| bun run test:ci | 0; 2,754 backend / 11,309 assertions / 300 files; 433 DOM / 2,551 assertions / 52 files |
| bun run build | 0; compile 34.2 s, TypeScript 45 s, standalone packaging succeeds |
| checkGracefulShutdown idle / watcher | 0 / 0; 40 / 98 ms |
| production next start held-request shutdown | 0; HTTP 200 completed, process 143, 1,530 ms, integrity ok |
| standalone locale matrix | 5/5 |
| focused auth/locale browser scenarios | 2/2 |
| verifyStandaloneWorkerBuild | 0 |
| three packaged worker CLI checks | intended payload validation, no resolution failure |
| live fixture | password + TOTP, list 60, open, send HTTP 200; exact SMTP capture |
| live watcher + workers shutdown | 0; 188 ms; zero leases/queue, integrity ok |
| verifyDockerWorkerImage | blocked; Docker executable unavailable |
| test:stress | not rerun; supplied baseline 8,262, include in real-branch acceptance |
| git diff --check | passed |

## Live fixture and port/PID audit

All runtime data used `/home/monkey/code/noctua-mail/data/noctua-data-wt-next-spike`, exactly the `.env.local` directory. Synthetic users, fixture mailboxes and SMTP recipients only. Missing Better Auth settings were supplied as process-only synthetic fixture settings; no secret/environment file was edited. Offline auth seeding ran in children that exited before server startup, respecting the auth datastore lifetime lock.

Final app **PID 1615035**, harness/IMAP/SMTP/control **PID 1614209**: app **3895**, IMAP **34645**, SMTP **38663**, control **41231**. Password/TOTP login selected `next-spike-fixture`. List HTTP 200 returned **60 INBOX messages**. Message HTTP 200 contained the synthetic newsletter HTML; its thread's synthetic reply rendered in the reader. Compose sent **one** message through `/api/accounts/next-spike-fixture/smtp/send`, HTTP **200**; SMTP capture matched subject `Next 16.4 synthetic smoke`, recipient `recipient@example.test`, and the complete synthetic body. Composer closed after success. Runtime config and Latin font returned 200; the font loaded.

Before the final SIGTERM, the real fixture watcher was `idling`, master watcher leases = **1**, worker leases = **2**, queued jobs = **1**, and the browser's streams were open. The two additional workers belonged to the auth browser suite's `.invalid` mailboxes and were retrying, not real remote accounts. Shutdown completed in **188 ms**, exit 0, no force/deadline, all three tables empty, master SQLite integrity `ok`, SMTP received count **1**. The log shows IMAP IDLE and pooled connection cleanup. Harness then closed its fixture listeners. All listed app/harness/worker PIDs and listener ports were checked absent, and the owned browser tab was closed.

Other owned launches (all stopped):

| Purpose | PIDs | Listener ports |
| --- | --- | --- |
| accepted standalone idle CLI probe | 1599373 | 3896 |
| accepted watcher-enabled CLI probe | 1599468 | 3896 |
| earlier successful idle check | 1595355 | 3896, exit 0 in 44 ms |
| initial in-process-seeding harness / app | 1595461 / 1595993 | app 3895; IMAP 35929, SMTP 45201, control 42059 |
| first live harness / app | 1602404 / 1603387 | app 3895; IMAP 36221, SMTP 45309, control 36947 |
| final full-sync worker | 1615127 | outbound connection to owned fixture only |
| final retry workers | 1616751, 1616875 | no application listener |
| worker argument probes | 1617717, 1617774, 1617840 | no listener |

The first live harness stopped in 287 ms with zero leases and integrity ok. Stock shutdown-probe error paths do not print child PIDs; initial failed preflight PIDs and the `next start` child PID were not captured. Those probes only started their own children at **3896** and reaped them in `finally`; they never signalled existing listeners. There were twelve 3896 probe launches across setup corrections and final acceptance, plus the three 3895 harness launches above. This PID-recording limitation is explicit rather than guessed.

Initial setup failures were missing synthetic Auth URL/secret, overlapping seed/server lifetime locks, a 127.0.0.1-versus-localhost canonical-origin mismatch in signup, and my first public-assets copy nesting `public/public`. These were fixed in scratch/harness setup, not production source. NextURL normalizes loopback IP hosts to localhost; using the repository browser runner's `http://localhost:3895` canonical URL made both browser scenarios pass unchanged. The final asset assembly used `cp -a public/. .next/standalone/public/` and supplied all required assets. The earlier newsletter text wait also targeted the root newsletter while the UI opened its latest thread reply; HTTP details and actual rendered reply were then checked separately.

No app or fixture was started on **3790 or 3795–3799**. Existing shared services were not stopped. Heavy commands used `nice -n 10`; scratch stayed small (about 3 MB before advisory research) and was removed after promoting the evidence into this brief. No other worktree was read or changed.

## Advisory relevance

**Release floor: Next >=16.4.1; selected target 16.4.2.** The October 14 release fixes the cache typed-array RCE, SVG image-optimizer RCE, and Server Actions CPU denial of service. Local feature exclusions do not waive the requested release floor. [16.4.1 release](https://github.com/vercel/next.js/releases/tag/v16.4.1). The selected [16.4.2 release](https://github.com/vercel/next.js/releases/tag/v16.4.2) adds subsequent bug fixes.

I read the upstream repository's complete public advisory response (72 records, one 100-record page) and the security release notes from 16.2.5 through 16.4.2. There are **35 distinct advisories** in the intervening security releases: 12 in 16.2.5, one additional follow-up in 16.2.6, nine in 16.2.11, two in 16.3.3, one in 16.3.6, seven in 16.3.8, and three in 16.4.1. First-fixed versions below use those release notes where the advisory's own version field contains a literal placeholder such as `16.3.?`. This is a focused source/config applicability review, not an exploit test or comprehensive security audit. [Upstream advisory inventory](https://github.com/vercel/next.js/security/advisories), [16.2.5](https://github.com/vercel/next.js/releases/tag/v16.2.5), [16.2.6](https://github.com/vercel/next.js/releases/tag/v16.2.6), [16.2.11](https://github.com/vercel/next.js/releases/tag/v16.2.11), [16.3.3](https://github.com/vercel/next.js/releases/tag/v16.3.3), [16.3.6](https://github.com/vercel/next.js/releases/tag/v16.3.6), [16.3.8](https://github.com/vercel/next.js/releases/tag/v16.3.8).

Repository facts used for every row:

- **Launcher:** `lib/server/standalone.ts` owns HTTP lifecycle but still passes normal requests and *all* upgrades to Next's handlers. `isDev:false` and `minimalMode:false` preserve ordinary production framework handling. `NEXT_MANUAL_SIG_HANDLE` only changes signal ownership; it is not a security boundary. `__NEXT_PRIVATE_ORIGIN` is explicitly pinned and was observed at runtime. Therefore the launcher does not exempt the app from RSC, image, or upgrade-handler advisories.
- **Server Actions:** no production `"use server"` directives were found; the built server-reference manifest has **zero Node and zero Edge action entries**. No `use cache`, Draft Mode or Edge action implementation was found. Generic RSC exposure is considered separately rather than claiming that an empty action manifest proves immunity to every React/RSC flaw.
- **Routing:** App Router + Turbopack. No root/src `middleware.ts` or `proxy.ts`, no Pages Router, no Next i18n routing (`i18n:null`), and no configured rewrites/redirects. next-intl's request/config plugin does not create middleware or Next's `i18n.locales` option. No root catch-all page, `generateStaticParams` allowlist or `dynamicParams:false` was found.
- **Caching:** effective `cacheComponents:false`, no experimental useCache opt-in, and no ISR configuration. Authenticated/root locale responses were private/no-store. A downstream CDN's behavior is not assumed from local headers.
- **Image generation:** `app/icon.tsx`, `app/apple-icon.tsx` and `/icons/badged/[size]` call `lib/ui/envIcon.tsx`. With no environment label they return committed PNG bytes; with a label they use Node `next/og` `ImageResponse`, committed PNG data, fixed styles and deployment-controlled `APP_ENV_LABEL`. `[size]` is restricted to 32/192/512. No request/query/mail content is inserted into the rendered SVG/styles. The PWA manifest references those fixed routes. `/icons/logo.svg` reads committed SVG and XML-escapes the deployment label. Public metadata/PWA icons are not themselves evidence of attacker-controlled ImageResponse input.
- **Image optimization:** no `next/image` component import was found, but the default optimizer is **still enabled** (`unoptimized:false`, default loader, local pattern `**`, `remotePatterns:[]`, `dangerouslyAllowSVG:false`). Lack of component imports does not disable `/_next/image`. The Docker runtime is Debian/glibc Linux; image-decoder advisories cannot be dismissed as a Windows-only concern. No harmful image was tested, and attacker-supplied local SVG/AVIF reachability was not established in this focused review.

“No matching condition” below means the inspected app does not satisfy the advisory's specified feature/input condition, not that remaining on 16.2.4 is acceptable. “Conditional” marks a relevant framework surface whose exploit prerequisites depend on inputs or deployment controls not established here. CVEs are exactly those assigned in the Next.js advisories at the time of the check; **no CVE listed** is deliberate.

| Advisory / exact CVE | First fixed Next 16.x | Affected component | Applicability to this app |
| --- | --- | --- | --- |
| [GHSA-267c-6grr-h53f](https://github.com/vercel/next.js/security/advisories/GHSA-267c-6grr-h53f) / CVE-2026-44575 | 16.2.5 | Middleware / Proxy bypass in App Router applications via segment-prefetch routes | No matching condition: authorization is performed in auth/API logic, not middleware/proxy matchers; neither middleware nor proxy file exists. |
| [GHSA-36qx-fr4f-26g5](https://github.com/vercel/next.js/security/advisories/GHSA-36qx-fr4f-26g5) / CVE-2026-44573 | 16.2.5 | Middleware / Proxy bypass in Pages Router applications using i18n | No matching condition: no Pages Router, no Next i18n locale data routes, and no middleware/proxy-based authorization. |
| [GHSA-3g8h-86w9-wvmq](https://github.com/vercel/next.js/security/advisories/GHSA-3g8h-86w9-wvmq) / CVE-2026-44572 | 16.2.5 | Middleware / Proxy redirects can be cache-poisoned | No matching condition: no middleware/proxy redirects. A caching CDN alone would not create the specified redirect transformation path. |
| [GHSA-492v-c6pp-mqqv](https://github.com/vercel/next.js/security/advisories/GHSA-492v-c6pp-mqqv) / CVE-2026-44574 | 16.2.5 | Middleware / Proxy bypass through dynamic route parameter injection | No matching middleware/proxy authorization condition. Dynamic API parameters still receive route-level authorization. |
| [GHSA-8h8q-6873-q5fj](https://github.com/vercel/next.js/security/advisories/GHSA-8h8q-6873-q5fj) / CVE-2026-23870 | 16.2.5 | Denial of Service with Server Components | Relevant framework App Router/RSC decoder remains in use through getRequestHandlers. No application Server Function endpoint was found; precise exploitability was not established. Empty action manifests are not used to claim general RSC immunity. |
| [GHSA-c4j6-fc7j-m34r](https://github.com/vercel/next.js/security/advisories/GHSA-c4j6-fc7j-m34r) / CVE-2026-44578 | 16.2.5 | Server-side request forgery in applications using WebSocket upgrades | Relevant delegated upgrade-handler surface: custom node-http server forwards upgrades to Next. Owning the listener does not bypass router upgrade logic; no reverse-proxy blocking or Bun exploit immunity is assumed. |
| [GHSA-ffhc-5mcf-pf4q](https://github.com/vercel/next.js/security/advisories/GHSA-ffhc-5mcf-pf4q) / CVE-2026-44581 | 16.2.5 | Cross-site scripting in App Router applications using CSP nonces | No matching nonce pattern found: root deployment config does not derive CSP nonces from request headers. Shared-cache deployment state was not independently audited. |
| [GHSA-gx5p-jg67-6x7h](https://github.com/vercel/next.js/security/advisories/GHSA-gx5p-jg67-6x7h) / CVE-2026-44580 | 16.2.5 | Cross-site scripting in beforeInteractive scripts with untrusted input | No matching untrusted-script input: root uses beforeInteractive only with the constant /runtime-config.js src; no request-controlled inline script value or prop was found. |
| [GHSA-h64f-5h5j-jqjh](https://github.com/vercel/next.js/security/advisories/GHSA-h64f-5h5j-jqjh) / CVE-2026-44577 | 16.2.5 | Denial of Service in the Image Optimization API | Relevant enabled local-optimizer surface on a self-hosted server: default localPatterns allow local assets. Large-image exploit input was not tested; no next-image imports does not remove the route. |
| [GHSA-mg66-mrh9-m8jx](https://github.com/vercel/next.js/security/advisories/GHSA-mg66-mrh9-m8jx) / CVE-2026-44579 | 16.2.5 | Denial of Service via connection exhaustion in applications using Cache Components | No matching condition: Cache Components/PPR off and no Server Actions. Manual signal handling is unrelated to this POST-resume deadlock. |
| [GHSA-vfv6-92ff-j949](https://github.com/vercel/next.js/security/advisories/GHSA-vfv6-92ff-j949) / CVE-2026-44582 | 16.2.5 | Cache poisoning via collisions in React Server Component cache-busting | Conditional App Router/RSC shared-cache surface. Root/locale responses were private/no-store; a downstream cache that ignores partitioning cannot be assessed from this local spike. |
| [GHSA-wfc6-r584-vfw7](https://github.com/vercel/next.js/security/advisories/GHSA-wfc6-r584-vfw7) / CVE-2026-44576 | 16.2.5 | Cache poisoning in React Server Component responses | Conditional App Router/RSC shared-cache surface. Local private/no-store headers reduce the observed case; actual intermediary Vary/cache-key handling is outside the inspected evidence. |
| [GHSA-26hh-7cqf-hhc6](https://github.com/vercel/next.js/security/advisories/GHSA-26hh-7cqf-hhc6) / CVE-2026-45109 | 16.2.6 | Middleware / Proxy bypass in App Router applications via segment-prefetch routes - Incomplete Fix Follow-Up | No matching condition: no middleware/proxy authorization to bypass. Turbopack follow-up fix is still included. |
| [GHSA-4633-3j49-mh5q](https://github.com/vercel/next.js/security/advisories/GHSA-4633-3j49-mh5q) / CVE-2026-64647 | 16.2.11 | Cache confusion of response bodies for requests with bodies containing invalid UTF-8 byte sequences | No matching direct app fetch input found: server HTTP payloads are UTF-8 JSON; no non-UTF-8-body cached fetch path identified. Not a complete dependency fetch audit. |
| [GHSA-4c39-4ccg-62r3](https://github.com/vercel/next.js/security/advisories/GHSA-4c39-4ccg-62r3) / CVE-2026-64646 | 16.2.11 | Unbounded Server Action payload in Edge runtime | No matching condition: no Server Actions and no Edge Server Action runtime. APIs use ordinary route handlers. |
| [GHSA-68g3-v927-f742](https://github.com/vercel/next.js/security/advisories/GHSA-68g3-v927-f742) / CVE-2026-64648 | 16.2.11 | Cache confusion of response bodies for requests with bodies | No matching direct app fetch pattern found: inspected HTTP fetches use URL strings rather than a Request plus conflicting init. Dependency fetch behavior was not comprehensively audited; target carries the framework fix. |
| [GHSA-6gpp-xcg3-4w24](https://github.com/vercel/next.js/security/advisories/GHSA-6gpp-xcg3-4w24) / CVE-2026-64642 | 16.2.11 | Middleware / Proxy bypass in App Router applications using Turbopack and single locale | No matching condition: Turbopack is used, but no middleware/proxy and no single-entry Next i18n.locales configuration. next-intl request locale selection does not enable that routing option. |
| [GHSA-89xv-2m56-2m9x](https://github.com/vercel/next.js/security/advisories/GHSA-89xv-2m56-2m9x) / CVE-2026-64649 | 16.2.11 | Server-Side Request Forgery in Server Actions on custom servers | No matching action condition. Custom launcher does merit review, but no actions are present and it explicitly pins __NEXT_PRIVATE_ORIGIN, the advisory’s custom-server mitigation. |
| [GHSA-955p-x3mx-jcvp](https://github.com/vercel/next.js/security/advisories/GHSA-955p-x3mx-jcvp) / CVE-2026-64643 | 16.2.11 | Unauthenticated disclosure of internal Server Function endpoints | No matching endpoint condition: no use-server or use-cache endpoints, and empty action manifests. The application does not rely on hiding endpoint IDs for authorization. |
| [GHSA-m99w-x7hq-7vfj](https://github.com/vercel/next.js/security/advisories/GHSA-m99w-x7hq-7vfj) / CVE-2026-64641 | 16.2.11 | Denial of Service in App Router using Server Actions | No matching condition: no Server Actions. This is the earlier July action CPU-DoS fix, separate from the October advisory. |
| [GHSA-p9j2-gv94-2wf4](https://github.com/vercel/next.js/security/advisories/GHSA-p9j2-gv94-2wf4) / CVE-2026-64645 | 16.2.11 | Server-Side Request Forgery in rewrites via attacker-controlled destination hostname | No matching condition: no external rewrite/redirect destination with a request-controlled hostname, and no configured rewrites/redirects. |
| [GHSA-q8wf-6r8g-63ch](https://github.com/vercel/next.js/security/advisories/GHSA-q8wf-6r8g-63ch) / CVE-2026-64644 | 16.2.11 | Denial of Service in the Image Optimization API using SVGs | No matching remote-image condition: default loader is enabled but remotePatterns is empty; the advisory’s remote SVG optimization input is not allowlisted. |
| [GHSA-2xp9-vwfh-vxw4](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4) / no CVE listed | 16.3.3 | Unauthenticated Remote Code Execution in Image Optimization API when AVIF files are used | Conditional optimizer/AVIF decoder surface: default optimizer enabled; no malicious local AVIF source established. Target includes the framework AVIF mitigation/fix; absence of next-image UI usage is not an exemption. |
| [GHSA-p293-qw3h-jr36](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36) / CVE-2026-75604 | 16.3.3 | Unauthenticated Remote Code Execution on windows-hosted servers | No matching platform condition for this Linux/Bun and Debian container deployment. Advisory requires a Windows filesystem; cacheComponents being off would not protect a Windows deployment. |
| [GHSA-vcvr-r3jv-pc5j](https://github.com/vercel/next.js/security/advisories/GHSA-vcvr-r3jv-pc5j) / CVE-2026-94545 | 16.3.6 | Remote Code Execution in next/og ImageResponse | No matching attacker-input condition in inspected icon code. Node ImageResponse exists when APP_ENV_LABEL is set, but image data/styles/label are trusted deployment inputs; public icon requests do not supply SVG content. |
| [GHSA-39w2-rjm5-chcv](https://github.com/vercel/next.js/security/advisories/GHSA-39w2-rjm5-chcv) / CVE-2026-94486 | 16.3.8 | Information disclosure in the Next.js development server's Model Context Protocol endpoint | Relevant to developers running the repository next-dev command; not the production artifact, whose handler isDev flag is false. No next-dev server was used in this spike. |
| [GHSA-3w37-wq28-93x7](https://github.com/vercel/next.js/security/advisories/GHSA-3w37-wq28-93x7) / CVE-2026-94544 | 16.3.8 | Pending `use cache` fill can leak Draft Mode content into regular responses and persisted pages | No matching condition: Cache Components/useCache and Draft Mode previews absent. Published range is 16.3.0, outside baseline 16.2.4; fixed on the upgrade path. |
| [GHSA-4jqv-mc3x-m676](https://github.com/vercel/next.js/security/advisories/GHSA-4jqv-mc3x-m676) / CVE-2026-94543 | 16.3.8 | Cache poisoning of SSG and ISR pages in self-hosted Next.js applications | No matching condition: advisory concerns Pages Router SSG/ISR; this app has no Pages Router. Self-hosting alone is insufficient. |
| [GHSA-cjq9-62q9-8jv4](https://github.com/vercel/next.js/security/advisories/GHSA-cjq9-62q9-8jv4) / CVE-2026-94483 | 16.3.8 | Server-Side Request Forgery in Image Optimization | No matching remote-input condition: remotePatterns is empty. Upstream explicitly excludes configurations without remotePatterns; locally permitted images are a separate decoder/size-limit concern. |
| [GHSA-f87g-xv8r-7p7x](https://github.com/vercel/next.js/security/advisories/GHSA-f87g-xv8r-7p7x) / CVE-2026-94485 | 16.3.8 | Information disclosure in Next.js App Router metadata image routes via dynamicParams bypass | No matching condition: published issue requires webpack metadata routes and excluded dynamicParams/generateStaticParams variants. Build uses Turbopack, icons are public force-dynamic routes, and no such parameter allowlist exists. |
| [GHSA-h694-7cp9-m8p3](https://github.com/vercel/next.js/security/advisories/GHSA-h694-7cp9-m8p3) / CVE-2026-103004 | 16.3.8 | Cache leak across root param values in nested 'use cache' functions | No matching condition: cacheComponents off, no nested cached root-param functions. Its published affected range is 16.3.0, so baseline 16.2.4 is outside that specific range; included because fixed on this upgrade path. |
| [GHSA-mcj8-r9mp-w47p](https://github.com/vercel/next.js/security/advisories/GHSA-mcj8-r9mp-w47p) / CVE-2026-94484 | 16.3.8 | Cache poisoning in Next.js SSG/ISR rendering leads to cross-user content substitution and persistent denial of service | No matching condition: no root catch-all page combined with SSG/ISR routes. The public static manifest does not create that combination. |
| [GHSA-2464-fhr4-w9xw](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw) / CVE-2026-96889 | 16.4.1 | Unauthenticated Remote Code Execution in Image Optimization API when SVG files are used | Conditional optimizer surface on glibc Linux; no malicious local SVG source established. Current resolved sharp 0.35.5 meets the fix; do not treat dangerouslyAllowSVG=false as proof all decoder work is absent. |
| [GHSA-673q-mjm6-r5xr](https://github.com/vercel/next.js/security/advisories/GHSA-673q-mjm6-r5xr) / no CVE listed | 16.4.1 | Unauthenticated Remote Code Execution in `use cache` functions returning typed arrays | No matching condition: cacheComponents off and no use-cache functions returning typed arrays. The advisory nevertheless directs upgrading; target clears the mandatory floor. |
| [GHSA-p3m5-59mp-jv5r](https://github.com/vercel/next.js/security/advisories/GHSA-p3m5-59mp-jv5r) / no CVE listed | 16.4.1 | Denial of Service in App Router using Server Actions | No matching condition: no Server Actions; Node/Edge action manifests are empty. App Router alone does not satisfy this advisory’s stated at-least-one-action prerequisite. |

**Most consequential distinctions:** the WebSocket fix is relevant to this launcher because its upgrade callback delegates directly to Next, even though application realtime features primarily use SSE. The custom-server Server Actions SSRF advisory is a different issue: no actions exist here, and this adapter already sets the documented private-origin mitigation. The next/og RCE is also different from sharp image-optimizer RCE: ImageResponse is used for badges, but its inputs are deployment-controlled rather than attacker-controlled. The optimizer remains enabled separately, so do not label all image advisories “not affected” merely because the UI lacks `next/image`.

**Sharp observation only:** `require("sharp/package.json").version` is **0.35.5** after the original Next install (baseline lockfile 0.34.5); Next 16.4.2 requires `sharp ^0.35.5` optionally. The SVG advisory explicitly says the patched Next release forces a fixed sharp resolution, and names **sharp >=0.35.5** as the workaround. No additional sharp change was made for this section, and no direct dependency/override was added; coordinate the automatic Next lockfile overlap with `chore/deps-sharp`. [GHSA-2464-fhr4-w9xw / CVE-2026-96889](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw).


## Recipe for the real branch

1. Start from the intended integration tree, with **Next >=16.4.1** as a release constraint. Reproduce the exact direct version changes above and the test-router field; regenerate the lockfile with Bun 1.4.4. Review/reconcile the automatic sharp/native dependency records with `chore/deps-sharp`; do not introduce a separate sharp override as part of this recipe.
2. Keep the existing plugin wrapper, roots, parser/worker trace includes, external packages, manual-signal launcher, and compiler/cache flags. Do not add the old build tsconfig workaround unless the real tree produces a new concrete TypeScript failure.
3. Resolve the lint release decision explicitly: implement the temporary per-file/per-rule warning policy described above, or fix the 157 errors in separately reviewed changes. The spike itself remains lint-red and does not conceal the existing calendar error.
4. At `nice -n 10`, run `bun install`, `bun run typecheck`, `bun run lint`, `bun run test:ci`, `bun run test:stress`, and `bun run build`; then `bun build-scripts/verifyStandaloneWorkerBuild.ts`. Run `bun build-scripts/verifyDockerWorkerImage.ts` on the actual Docker-capable build host and require success before release. Recheck advisory status and the final image's resolved dependencies.
5. Assemble standalone assets with the existing deployment pattern, taking care to merge contents into existing directories:

   ```sh
   mkdir -p .next/standalone/.next/static .next/standalone/public
   cp -a .next/static/. .next/standalone/.next/static/
   cp -a public/. .next/standalone/public/
   ```

6. With process-only synthetic Auth settings, the real worktree's isolated data directory, and currently assigned free ports, run `bun scripts/checkGracefulShutdown.ts --port 3896 --data-dir "$NOCTUA_DATA_DIR"` once idle and once with `NOCTUA_MAILBOX_WATCHER=1`. Keep seeding and server lifetimes sequential. Also run the held-request `next start` adapter probe if that deployment mode is supported. Never reuse another worktree's listeners or data.
7. Repeat the five locale cases and the auth/browser acceptance on the production standalone artifact with a canonical localhost URL. For the focused check used here:

   ```sh
   AUTH_BROWSER_BASE_URL=http://localhost:3895 \
   AUTH_BROWSER_SEED_FILE=/absolute/path/to/private-synthetic-seed.json \
   PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-arm64 \
   TMPDIR="$PWD/.tmp" nice -n 10 bun x playwright test \
     --config=playwright.auth.config.ts tests/browser/auth/shell.spec.ts \
     --grep 'activated signup|shell persists mailbox'
   ```

8. Repeat fixture login/list/open/send and the live watcher drain, measure initial JS with the Node gzip method above, verify zero new unexplained diagnostics, and stop only owned processes. Inspect the commit diff rather than merging this disposable spike.

## Full lockfile diff

This is the lockfile produced by the requested Next/React install; the sharp records are its automatic Next dependency resolution, not a separately requested sharp upgrade.

```diff
diff --git a/bun.lock b/bun.lock
index 2ee737c..8715cf6 100644
--- a/bun.lock
+++ b/bun.lock
@@ -37,7 +37,7 @@
         "lexical": "^0.52.0",
         "lucide-react": "^1.61.0",
         "mailparser": "^3.12.3",
-        "next": "16.2.4",
+        "next": "16.4.2",
         "next-intl": "4.14.9",
         "next-themes": "^0.4.6",
         "nodemailer": "^8.0.11",
@@ -45,8 +45,8 @@
         "postcss": "^8.5.31",
         "qrcode": "^1.5.4",
         "radix-ui": "1.8.1",
-        "react": "19.2.5",
-        "react-dom": "19.2.5",
+        "react": "19.3.1",
+        "react-dom": "19.3.1",
         "react-markdown": "^10.1.0",
         "react-resizable-panels": "^4.14.8",
         "rehype-raw": "^7.0.0",
@@ -74,11 +74,12 @@
         "@types/mailparser": "^3.9.0",
         "@types/node": "^25.6.0",
         "@types/qrcode": "^1.5.6",
-        "@types/react": "^19.2.14",
-        "@types/react-dom": "^19.2.3",
+        "@types/react": "19.3.0",
+        "@types/react-dom": "19.3.0",
         "@types/sanitize-html": "^2.16.1",
         "eslint": "^9.39.4",
-        "eslint-config-next": "16.2.4",
+        "eslint-config-next": "16.4.2",
+        "eslint-plugin-react-hooks": "7.1.1",
         "shadcn": "^4.22.1",
         "typescript": "^6.0.3",
       },
@@ -138,7 +139,7 @@
 
     "@babel/helpers": ["@babel/helpers@7.28.6", "", { "dependencies": { "@babel/template": "^7.28.6", "@babel/types": "^7.28.6" } }, "sha512-xOBvwq86HHdB7WUDTfKfT/Vuxh7gElQ+Sfti2Cy6yIWNW05P8iUslOVcZ4/sKbE+/jQaukQAdz/gf3724kYdqw=="],
 
-    "@babel/parser": ["@babel/parser@7.29.0", "", { "dependencies": { "@babel/types": "^7.29.0" }, "bin": "./bin/babel-parser.js" }, "sha512-IyDgFV5GeDUVX4YdF/3CPULtVGSXXMLh1xVIgdCgxApktqnQV0r7/8Nqthg+8YLGaAtdyIlo2qIdZrbCv4+7ww=="],
+    "@babel/parser": ["@babel/parser@7.29.9", "", { "dependencies": { "@babel/types": "^7.29.8" }, "bin": "./bin/babel-parser.js" }, "sha512-CjXrNHTnvqBVqHgdBysY3vk2T8tpJHb5/RMeHJBTyVa9xgugCB0CJTx/3oO8RV2QRQP391RWpB7D6hLjm8V9uA=="],
 
     "@babel/plugin-syntax-jsx": ["@babel/plugin-syntax-jsx@7.29.7", "", { "dependencies": { "@babel/helper-plugin-utils": "^7.29.7" }, "peerDependencies": { "@babel/core": "^7.0.0-0" } }, "sha512-TSu8+mHCoEaaCDEZ0I3+6mvTBYR4PCxQwf2z9/r5Tbztv6NaLR3B9thGTTxX2WGuGHJqRiAbKPeGTJ5XWXVg6A=="],
 
@@ -188,7 +189,7 @@
 
     "@eloqnt/format-po": ["@eloqnt/format-po@0.1.1", "", { "dependencies": { "@eloqnt/config": "^0.1.1", "po-parser": "^2.2.0" } }, "sha512-aLtmIoqXGEaeTT0RcsLN8sZ3aIrsT/c/dVs28zrLhDjO3+vA3KNP+r98N0xq8w/k36+/GIUt4uZNbqcA71GVWw=="],
 
-    "@emnapi/runtime": ["@emnapi/runtime@1.8.1", "", { "dependencies": { "tslib": "^2.4.0" } }, "sha512-mehfKSMWjjNol8659Z8KxEMrdSJDDot5SXMq00dM8BN4o+CLNXQ0xH2V7EchNHV4RmbZLmmPdEaXZc5H2FXmDg=="],
+    "@emnapi/runtime": ["@emnapi/runtime@1.11.3", "", { "dependencies": { "tslib": "^2.4.0" } }, "sha512-Xz4Tpyki7XyrpbUK1jR1AhdAdaXyhhY4lZ3neLodmhpuWfy2PAQN5B46sAiU4liOXGLkHypn/qU+jvfWSCYYLA=="],
 
     "@eslint-community/eslint-utils": ["@eslint-community/eslint-utils@4.9.1", "", { "dependencies": { "eslint-visitor-keys": "^3.4.3" }, "peerDependencies": { "eslint": "^6.0.0 || ^7.0.0 || >=8.0.0" } }, ""],
 
@@ -252,55 +253,59 @@
 
     "@humanwhocodes/retry": ["@humanwhocodes/retry@0.4.3", "", {}, ""],
 
-    "@img/colour": ["@img/colour@1.0.0", "", {}, "sha512-A5P/LfWGFSl6nsckYtjw9da+19jB8hkJ6ACTGcDfEJ0aE+l2n2El7dsVM7UVHZQ9s2lmYMWlrS21YLy2IR1LUw=="],
+    "@img/colour": ["@img/colour@1.1.0", "", {}, "sha512-Td76q7j57o/tLVdgS746cYARfSyxk8iEfRxewL9h4OMzYhbW4TAcppl0mT4eyqXddh6L/jwoM75mo7ixa/pCeQ=="],
 
-    "@img/sharp-darwin-arm64": ["@img/sharp-darwin-arm64@0.34.5", "", { "optionalDependencies": { "@img/sharp-libvips-darwin-arm64": "1.2.4" }, "os": "darwin", "cpu": "arm64" }, "sha512-imtQ3WMJXbMY4fxb/Ndp6HBTNVtWCUI0WdobyheGf5+ad6xX8VIDO8u2xE4qc/fr08CKG/7dDseFtn6M6g/r3w=="],
+    "@img/sharp-darwin-arm64": ["@img/sharp-darwin-arm64@0.35.5", "", { "optionalDependencies": { "@img/sharp-libvips-darwin-arm64": "1.3.4" }, "os": "darwin", "cpu": "arm64" }, "sha512-QRUlFQ0WxvdWyqqG/WtI3iupfD5rBzmCHXSdPsY91sAtVtTo7Q4cb6zOccZ3gqEqkr0f1As1ehLqmEpDsRf+lg=="],
 
-    "@img/sharp-darwin-x64": ["@img/sharp-darwin-x64@0.34.5", "", { "optionalDependencies": { "@img/sharp-libvips-darwin-x64": "1.2.4" }, "os": "darwin", "cpu": "x64" }, "sha512-YNEFAF/4KQ/PeW0N+r+aVVsoIY0/qxxikF2SWdp+NRkmMB7y9LBZAVqQ4yhGCm/H3H270OSykqmQMKLBhBJDEw=="],
+    "@img/sharp-darwin-x64": ["@img/sharp-darwin-x64@0.35.5", "", { "optionalDependencies": { "@img/sharp-libvips-darwin-x64": "1.3.4" }, "os": "darwin", "cpu": "x64" }, "sha512-+BR255RhDlpygUpOc/Jdt1nT6DQ3XG/ERo5wbcdOf5Q320dKtPCKPLR1LJs9VGXRaMa8l1uUa0tkCNOXiAxZUw=="],
 
-    "@img/sharp-libvips-darwin-arm64": ["@img/sharp-libvips-darwin-arm64@1.2.4", "", { "os": "darwin", "cpu": "arm64" }, "sha512-zqjjo7RatFfFoP0MkQ51jfuFZBnVE2pRiaydKJ1G/rHZvnsrHAOcQALIi9sA5co5xenQdTugCvtb1cuf78Vf4g=="],
+    "@img/sharp-freebsd-wasm32": ["@img/sharp-freebsd-wasm32@0.35.5", "", { "dependencies": { "@img/sharp-wasm32": "0.35.5" }, "os": "freebsd" }, "sha512-Y/z91nEZ4uIBX5X3nfTovjU9lHNKFYbL2lpHCLVNmXQK03VIZvXBBt0KxbPGp2SdGSF+2mQU4e+hQaWOt86iAw=="],
 
-    "@img/sharp-libvips-darwin-x64": ["@img/sharp-libvips-darwin-x64@1.2.4", "", { "os": "darwin", "cpu": "x64" }, "sha512-1IOd5xfVhlGwX+zXv2N93k0yMONvUlANylbJw1eTah8K/Jtpi15KC+WSiaX/nBmbm2HxRM1gZ0nSdjSsrZbGKg=="],
+    "@img/sharp-libvips-darwin-arm64": ["@img/sharp-libvips-darwin-arm64@1.3.4", "", { "os": "darwin", "cpu": "arm64" }, "sha512-5R89nBYiRdUlSWJxPhO+GVtaXzXSxKnRu/xqMn3KTA3L9EB9Oy/P+Nn2f2vlhPuUdy/Zusb2DarbyTpGCfEDuw=="],
 
-    "@img/sharp-libvips-linux-arm": ["@img/sharp-libvips-linux-arm@1.2.4", "", { "os": "linux", "cpu": "arm" }, "sha512-bFI7xcKFELdiNCVov8e44Ia4u2byA+l3XtsAj+Q8tfCwO6BQ8iDojYdvoPMqsKDkuoOo+X6HZA0s0q11ANMQ8A=="],
+    "@img/sharp-libvips-darwin-x64": ["@img/sharp-libvips-darwin-x64@1.3.4", "", { "os": "darwin", "cpu": "x64" }, "sha512-iR2OKH80yi0U+dUplyh3/xdpFvps6YkCwsXenIJxqxR1v9o+xtKTGbS9H7cps+2Vxjc8B1j96p75NmTGjIhtpQ=="],
 
-    "@img/sharp-libvips-linux-arm64": ["@img/sharp-libvips-linux-arm64@1.2.4", "", { "os": "linux", "cpu": "arm64" }, "sha512-excjX8DfsIcJ10x1Kzr4RcWe1edC9PquDRRPx3YVCvQv+U5p7Yin2s32ftzikXojb1PIFc/9Mt28/y+iRklkrw=="],
+    "@img/sharp-libvips-linux-arm": ["@img/sharp-libvips-linux-arm@1.3.4", "", { "os": "linux", "cpu": "arm", "libc": "glibc" }, "sha512-LmRtTsOHuvM2+wlO2Db37dx5MiZhB0FvSunciw48YjdOkZz9KAiRbm8ujeMOA1INqmei5NapFxYEK1D1ZSidmw=="],
 
-    "@img/sharp-libvips-linux-ppc64": ["@img/sharp-libvips-linux-ppc64@1.2.4", "", { "os": "linux", "cpu": "ppc64" }, "sha512-FMuvGijLDYG6lW+b/UvyilUWu5Ayu+3r2d1S8notiGCIyYU/76eig1UfMmkZ7vwgOrzKzlQbFSuQfgm7GYUPpA=="],
+    "@img/sharp-libvips-linux-arm64": ["@img/sharp-libvips-linux-arm64@1.3.4", "", { "os": "linux", "cpu": "arm64", "libc": "glibc" }, "sha512-Y3dgX/6lE2QhQb+Gxy0WZxfg9MEm/JBjamZpS2IklP7xIQoKN4hzAm7KcMVGtaVDt3neE9OKBC7vAfonA/Lr1A=="],
 
-    "@img/sharp-libvips-linux-riscv64": ["@img/sharp-libvips-linux-riscv64@1.2.4", "", { "os": "linux", "cpu": "none" }, "sha512-oVDbcR4zUC0ce82teubSm+x6ETixtKZBh/qbREIOcI3cULzDyb18Sr/Wcyx7NRQeQzOiHTNbZFF1UwPS2scyGA=="],
+    "@img/sharp-libvips-linux-ppc64": ["@img/sharp-libvips-linux-ppc64@1.3.4", "", { "os": "linux", "cpu": "ppc64", "libc": "glibc" }, "sha512-Le6boB8Tai0Nis+gIxIpKx68UDVVIqdR8Tin5Yf1z2LJJQLDJvCDRqRu+jC2qCoD+eIomonmOwB4smBRxfVpYQ=="],
 
-    "@img/sharp-libvips-linux-s390x": ["@img/sharp-libvips-linux-s390x@1.2.4", "", { "os": "linux", "cpu": "s390x" }, "sha512-qmp9VrzgPgMoGZyPvrQHqk02uyjA0/QrTO26Tqk6l4ZV0MPWIW6LTkqOIov+J1yEu7MbFQaDpwdwJKhbJvuRxQ=="],
+    "@img/sharp-libvips-linux-riscv64": ["@img/sharp-libvips-linux-riscv64@1.3.4", "", { "os": "linux", "cpu": "none", "libc": "glibc" }, "sha512-aHkkIEHPRdQEegJN20MLmGtxYD9R2wQr3Cwpddnu5+YKMt6Uzax7S9h5gpZTo8wyrGuZSlfQ63OevL5mTyOC7Q=="],
 
-    "@img/sharp-libvips-linux-x64": ["@img/sharp-libvips-linux-x64@1.2.4", "", { "os": "linux", "cpu": "x64" }, "sha512-tJxiiLsmHc9Ax1bz3oaOYBURTXGIRDODBqhveVHonrHJ9/+k89qbLl0bcJns+e4t4rvaNBxaEZsFtSfAdquPrw=="],
+    "@img/sharp-libvips-linux-s390x": ["@img/sharp-libvips-linux-s390x@1.3.4", "", { "os": "linux", "cpu": "s390x", "libc": "glibc" }, "sha512-ra/mB6MikESDUO7Yg+Mi95bFBb9GsObURuhnOv3OqknjGe9sZrG8tCe9q0xSIGrtLgvgw0gKnFWcK4blSgQOuQ=="],
 
-    "@img/sharp-libvips-linuxmusl-arm64": ["@img/sharp-libvips-linuxmusl-arm64@1.2.4", "", { "os": "linux", "cpu": "arm64" }, "sha512-FVQHuwx1IIuNow9QAbYUzJ+En8KcVm9Lk5+uGUQJHaZmMECZmOlix9HnH7n1TRkXMS0pGxIJokIVB9SuqZGGXw=="],
+    "@img/sharp-libvips-linux-x64": ["@img/sharp-libvips-linux-x64@1.3.4", "", { "os": "linux", "cpu": "x64", "libc": "glibc" }, "sha512-GJ//SSXbnwSDes02umB3nDJLFcQzw8a18V8fyhqr6tV515tOEMdImjjxj1AoafMRz56F3PHgftnj1QEKSU1zkw=="],
 
-    "@img/sharp-libvips-linuxmusl-x64": ["@img/sharp-libvips-linuxmusl-x64@1.2.4", "", { "os": "linux", "cpu": "x64" }, "sha512-+LpyBk7L44ZIXwz/VYfglaX/okxezESc6UxDSoyo2Ks6Jxc4Y7sGjpgU9s4PMgqgjj1gZCylTieNamqA1MF7Dg=="],
+    "@img/sharp-libvips-linuxmusl-arm64": ["@img/sharp-libvips-linuxmusl-arm64@1.3.4", "", { "os": "linux", "cpu": "arm64", "libc": "musl" }, "sha512-hvulFwtjUcagsis6BBxHwGFwWoNZjgYmULGVrZcyfNbjA8hKILbRxGg15/7w5HDyXHXUos/j6baAWqnCyQ2DWA=="],
 
-    "@img/sharp-linux-arm": ["@img/sharp-linux-arm@0.34.5", "", { "optionalDependencies": { "@img/sharp-libvips-linux-arm": "1.2.4" }, "os": "linux", "cpu": "arm" }, "sha512-9dLqsvwtg1uuXBGZKsxem9595+ujv0sJ6Vi8wcTANSFpwV/GONat5eCkzQo/1O6zRIkh0m/8+5BjrRr7jDUSZw=="],
+    "@img/sharp-libvips-linuxmusl-x64": ["@img/sharp-libvips-linuxmusl-x64@1.3.4", "", { "os": "linux", "cpu": "x64", "libc": "musl" }, "sha512-6zXKeE/p39I1AmA3cJG35eyBGNqNddLnUXjhwBnsGjFPWqf5VKkDBEqaEkPDoTEtkxwi2vv8Tcr2mDyP4So7Fg=="],
 
-    "@img/sharp-linux-arm64": ["@img/sharp-linux-arm64@0.34.5", "", { "optionalDependencies": { "@img/sharp-libvips-linux-arm64": "1.2.4" }, "os": "linux", "cpu": "arm64" }, "sha512-bKQzaJRY/bkPOXyKx5EVup7qkaojECG6NLYswgktOZjaXecSAeCWiZwwiFf3/Y+O1HrauiE3FVsGxFg8c24rZg=="],
+    "@img/sharp-linux-arm": ["@img/sharp-linux-arm@0.35.5", "", { "optionalDependencies": { "@img/sharp-libvips-linux-arm": "1.3.4" }, "os": "linux", "cpu": "arm", "libc": "glibc" }, "sha512-LEaXK2WdXVK5ykcw0buWyPMsmLLL2vpHLD6yrNSW+JGEL3BZPA4tpKN6iaMc4AxTTAoaX/sU1rOL51lcIz48ZQ=="],
 
-    "@img/sharp-linux-ppc64": ["@img/sharp-linux-ppc64@0.34.5", "", { "optionalDependencies": { "@img/sharp-libvips-linux-ppc64": "1.2.4" }, "os": "linux", "cpu": "ppc64" }, "sha512-7zznwNaqW6YtsfrGGDA6BRkISKAAE1Jo0QdpNYXNMHu2+0dTrPflTLNkpc8l7MUP5M16ZJcUvysVWWrMefZquA=="],
+    "@img/sharp-linux-arm64": ["@img/sharp-linux-arm64@0.35.5", "", { "optionalDependencies": { "@img/sharp-libvips-linux-arm64": "1.3.4" }, "os": "linux", "cpu": "arm64", "libc": "glibc" }, "sha512-LYVx5JTsOM2CBzmxreh+nl64/3H6Xb09iSLknqH47z2T2DFFxDeFLP5y4dJwe6H7uGQlHPyEEtIqyo3DYsRwdQ=="],
 
-    "@img/sharp-linux-riscv64": ["@img/sharp-linux-riscv64@0.34.5", "", { "optionalDependencies": { "@img/sharp-libvips-linux-riscv64": "1.2.4" }, "os": "linux", "cpu": "none" }, "sha512-51gJuLPTKa7piYPaVs8GmByo7/U7/7TZOq+cnXJIHZKavIRHAP77e3N2HEl3dgiqdD/w0yUfiJnII77PuDDFdw=="],
+    "@img/sharp-linux-ppc64": ["@img/sharp-linux-ppc64@0.35.5", "", { "optionalDependencies": { "@img/sharp-libvips-linux-ppc64": "1.3.4" }, "os": "linux", "cpu": "ppc64", "libc": "glibc" }, "sha512-QVxAAq8evVRI9ia2vqgwrmWucn5Dfv+JdWzj75pD8omHLPSP7f8p20O8jxzjCcuCEQEOtYOZUmX1hkiZ0kdevA=="],
 
-    "@img/sharp-linux-s390x": ["@img/sharp-linux-s390x@0.34.5", "", { "optionalDependencies": { "@img/sharp-libvips-linux-s390x": "1.2.4" }, "os": "linux", "cpu": "s390x" }, "sha512-nQtCk0PdKfho3eC5MrbQoigJ2gd1CgddUMkabUj+rBevs8tZ2cULOx46E7oyX+04WGfABgIwmMC0VqieTiR4jg=="],
+    "@img/sharp-linux-riscv64": ["@img/sharp-linux-riscv64@0.35.5", "", { "optionalDependencies": { "@img/sharp-libvips-linux-riscv64": "1.3.4" }, "os": "linux", "cpu": "none", "libc": "glibc" }, "sha512-LtdreXguaavKODPIfzJ4kffx7UNt1omwtK0rch4EBbbSTXPnxWmYSayXdLJw0fJzQ97kHt1gL/yh4tvU+nCyRQ=="],
 
-    "@img/sharp-linux-x64": ["@img/sharp-linux-x64@0.34.5", "", { "optionalDependencies": { "@img/sharp-libvips-linux-x64": "1.2.4" }, "os": "linux", "cpu": "x64" }, "sha512-MEzd8HPKxVxVenwAa+JRPwEC7QFjoPWuS5NZnBt6B3pu7EG2Ge0id1oLHZpPJdn3OQK+BQDiw9zStiHBTJQQQQ=="],
+    "@img/sharp-linux-s390x": ["@img/sharp-linux-s390x@0.35.5", "", { "optionalDependencies": { "@img/sharp-libvips-linux-s390x": "1.3.4" }, "os": "linux", "cpu": "s390x", "libc": "glibc" }, "sha512-UZasTOFiYzotTsGOCu42BfUzP6Tu6Do/947iRm1RsLKvlllxwGcn4RN27LibGWceix4Y+Pmw3jsnTcCQIgWjqA=="],
 
-    "@img/sharp-linuxmusl-arm64": ["@img/sharp-linuxmusl-arm64@0.34.5", "", { "optionalDependencies": { "@img/sharp-libvips-linuxmusl-arm64": "1.2.4" }, "os": "linux", "cpu": "arm64" }, "sha512-fprJR6GtRsMt6Kyfq44IsChVZeGN97gTD331weR1ex1c1rypDEABN6Tm2xa1wE6lYb5DdEnk03NZPqA7Id21yg=="],
+    "@img/sharp-linux-x64": ["@img/sharp-linux-x64@0.35.5", "", { "optionalDependencies": { "@img/sharp-libvips-linux-x64": "1.3.4" }, "os": "linux", "cpu": "x64", "libc": "glibc" }, "sha512-SxFtLTeJInhAA9Q836kux2vZNeOBQEx658qvbboZScr0wIARym3IcGmW7KpVD5sbVg0Ojy+udFQdayYIZyoNog=="],
 
-    "@img/sharp-linuxmusl-x64": ["@img/sharp-linuxmusl-x64@0.34.5", "", { "optionalDependencies": { "@img/sharp-libvips-linuxmusl-x64": "1.2.4" }, "os": "linux", "cpu": "x64" }, "sha512-Jg8wNT1MUzIvhBFxViqrEhWDGzqymo3sV7z7ZsaWbZNDLXRJZoRGrjulp60YYtV4wfY8VIKcWidjojlLcWrd8Q=="],
+    "@img/sharp-linuxmusl-arm64": ["@img/sharp-linuxmusl-arm64@0.35.5", "", { "optionalDependencies": { "@img/sharp-libvips-linuxmusl-arm64": "1.3.4" }, "os": "linux", "cpu": "arm64", "libc": "musl" }, "sha512-9HbMclmI1zlNkFRs3z9/eBtDjfD0sGlrX1z6b1qwmiFY5ElDLh4BC0LPBdVp7z1DXFiKlIcznf+ZlsuZzLxQqg=="],
 
-    "@img/sharp-wasm32": ["@img/sharp-wasm32@0.34.5", "", { "dependencies": { "@emnapi/runtime": "^1.7.0" }, "cpu": "none" }, "sha512-OdWTEiVkY2PHwqkbBI8frFxQQFekHaSSkUIJkwzclWZe64O1X4UlUjqqqLaPbUpMOQk6FBu/HtlGXNblIs0huw=="],
+    "@img/sharp-linuxmusl-x64": ["@img/sharp-linuxmusl-x64@0.35.5", "", { "optionalDependencies": { "@img/sharp-libvips-linuxmusl-x64": "1.3.4" }, "os": "linux", "cpu": "x64", "libc": "musl" }, "sha512-4KOphqB035HrVdqLZfCgMzzERrQkkzOwRhl4OAkRO1YCldbaFjySXMaK534Mo0V+LndnlJk+sbUyLeU0ULyD1A=="],
 
-    "@img/sharp-win32-arm64": ["@img/sharp-win32-arm64@0.34.5", "", { "os": "win32", "cpu": "arm64" }, "sha512-WQ3AgWCWYSb2yt+IG8mnC6Jdk9Whs7O0gxphblsLvdhSpSTtmu69ZG1Gkb6NuvxsNACwiPV6cNSZNzt0KPsw7g=="],
+    "@img/sharp-wasm32": ["@img/sharp-wasm32@0.35.5", "", { "dependencies": { "@emnapi/runtime": "^1.11.3" } }, "sha512-Ptsga1su4tQx+LLF1ECS9U6nz5kmrXKo6XVbtR48Ke3ZRxxgaWBu7IDtEe1quo8hiupwm6WFqxVlXaSf7IINGQ=="],
 
-    "@img/sharp-win32-ia32": ["@img/sharp-win32-ia32@0.34.5", "", { "os": "win32", "cpu": "ia32" }, "sha512-FV9m/7NmeCmSHDD5j4+4pNI8Cp3aW+JvLoXcTUo0IqyjSfAZJ8dIUmijx1qaJsIiU+Hosw6xM5KijAWRJCSgNg=="],
+    "@img/sharp-webcontainers-wasm32": ["@img/sharp-webcontainers-wasm32@0.35.5", "", { "dependencies": { "@img/sharp-wasm32": "0.35.5" }, "cpu": "none" }, "sha512-hfhF/FmoQyTUkA0bIKFOtw536BQSeBMe6BF6QyWlrPxT754+TFLaZ7sKKTfvvM0yJgKgaYTwnFCIZ/GuDw5SUA=="],
 
-    "@img/sharp-win32-x64": ["@img/sharp-win32-x64@0.34.5", "", { "os": "win32", "cpu": "x64" }, "sha512-+29YMsqY2/9eFEiW93eqWnuLcWcufowXewwSNIT6UwZdUUCrM3oFjMWH/Z6/TMmb4hlFenmfAVbpWeup2jryCw=="],
+    "@img/sharp-win32-arm64": ["@img/sharp-win32-arm64@0.35.5", "", { "os": "win32", "cpu": "arm64" }, "sha512-X4t7g+7ZA5DKblCBEXGjUqqemj4vczING/5viFwAL8h4N3qYeyjwdCvRLHi4EdOUI+2Z7UFlp1VM+p/AuEtm6Q=="],
+
+    "@img/sharp-win32-ia32": ["@img/sharp-win32-ia32@0.35.5", "", { "os": "win32", "cpu": "ia32" }, "sha512-5Zm82LoBc43nhwNybZlG7Y1KO//Zhsn306fQl29ZOuStHLGTo3BWL83q3cznX0poxSAMuYL1On/BHBxkBeKr6A=="],
+
+    "@img/sharp-win32-x64": ["@img/sharp-win32-x64@0.35.5", "", { "os": "win32", "cpu": "x64" }, "sha512-x76eH0vEiHlcMQu8Y8IenntaACtddpT6W0wmXtWrnKcnKI7ME5DdgqhAD6SEWOEl1v2zDvkZDhFA9KnURwpfqg=="],
 
     "@jridgewell/gen-mapping": ["@jridgewell/gen-mapping@0.3.13", "", { "dependencies": { "@jridgewell/sourcemap-codec": "^1.5.0", "@jridgewell/trace-mapping": "^0.3.24" } }, "sha512-2kkt/7niJ6MgEPxF0bYdQ6etZaA+fQvDcLKckhy1yIQOzaoKjBBjSj63/aLVjYE3qhRt5dvM+uUyfCg6UKCBbA=="],
 
@@ -364,25 +369,25 @@
 
     "@modelcontextprotocol/sdk": ["@modelcontextprotocol/sdk@1.29.0", "", { "dependencies": { "@hono/node-server": "^1.19.9", "ajv": "^8.17.1", "ajv-formats": "^3.0.1", "content-type": "^1.0.5", "cors": "^2.8.5", "cross-spawn": "^7.0.5", "eventsource": "^3.0.2", "eventsource-parser": "^3.0.0", "express": "^5.2.1", "express-rate-limit": "^8.2.1", "hono": "^4.11.4", "jose": "^6.1.3", "json-schema-typed": "^8.0.2", "pkce-challenge": "^5.0.0", "raw-body": "^3.0.0", "zod": "^3.25 || ^4.0", "zod-to-json-schema": "^3.25.1" }, "peerDependencies": { "@cfworker/json-schema": "^4.1.1" }, "optionalPeers": ["@cfworker/json-schema"] }, "sha512-zo37mZA9hJWpULgkRpowewez1y6ML5GsXJPY8FI0tBBCd77HEvza4jDqRKOXgHNn867PVGCyTdzqpz0izu5ZjQ=="],
 
-    "@next/env": ["@next/env@16.2.4", "", {}, "sha512-dKkkOzOSwFYe5RX6y26fZgkSpVAlIOJKQHIiydQcrWH6y/97+RceSOAdjZ14Qa3zLduVUy0TXcn+EiM6t4rPgw=="],
+    "@next/env": ["@next/env@16.4.2", "", {}, "sha512-nTUTFH7G5/J/fmpkjVLegOkqyKOP0CEsJcMsyO4UCYeN1su+YMW/MfaSErnJskL7XM+UDK6aTvslxsRCyya/sA=="],
 
-    "@next/eslint-plugin-next": ["@next/eslint-plugin-next@16.2.4", "", { "dependencies": { "fast-glob": "3.3.1" } }, "sha512-tOX826JJ96gYK/go18sPUgMq9FK1tqxBFfUCEufJb5XIkWFFmpgU7mahJANKGkHs7F41ir3tReJ3Lv5La0RvhA=="],
+    "@next/eslint-plugin-next": ["@next/eslint-plugin-next@16.4.2", "", { "dependencies": { "@eslint-community/eslint-utils": "4.9.1", "fast-glob": "3.3.1" } }, "sha512-gCTWlw0e+Y6kajpFyKKgA195jUJCRhlzJE0lV7ufe8a+ghIsANWZ0/FiJwg6DuOG1+OvRbcZDcFBoRh3mNJx0g=="],
 
-    "@next/swc-darwin-arm64": ["@next/swc-darwin-arm64@16.2.4", "", { "os": "darwin", "cpu": "arm64" }, "sha512-OXTFFox5EKN1Ym08vfrz+OXxmCcEjT4SFMbNRsWZE99dMqt2Kcusl5MqPXcW232RYkMLQTy0hqgAMEsfEd/l2A=="],
+    "@next/swc-darwin-arm64": ["@next/swc-darwin-arm64@16.4.2", "", { "os": "darwin", "cpu": "arm64" }, "sha512-ONkhFvZNFWlsEHOM/81AtxdyuJP2KRYKYR0JxPwvcu1AuPMMMgcL+wW2luldJvMtZwKtUxoSkCychW5wIeoYSw=="],
 
-    "@next/swc-darwin-x64": ["@next/swc-darwin-x64@16.2.4", "", { "os": "darwin", "cpu": "x64" }, "sha512-XhpVnUfmYWvD3YrXu55XdcAkQtOnvaI6wtQa8fuF5fGoKoxIUZ0kWPtcOfqJEWngFF/lOS9l3+O9CcownhiQxQ=="],
+    "@next/swc-darwin-x64": ["@next/swc-darwin-x64@16.4.2", "", { "os": "darwin", "cpu": "x64" }, "sha512-luPCMbOsCoaF+kXJEUjmjmOZg1lC3BflhmUu+ZmW4tBu2vW/4AXak8JBFvePizGkxVmNiAw/r9ra+6UviCWtWQ=="],
 
-    "@next/swc-linux-arm64-gnu": ["@next/swc-linux-arm64-gnu@16.2.4", "", { "os": "linux", "cpu": "arm64" }, "sha512-Mx/tjlNA3G8kg14QvuGAJ4xBwPk1tUHq56JxZ8CXnZwz1Etz714soCEzGQQzVMz4bEnGPowzkV6Xrp6wAkEWOQ=="],
+    "@next/swc-linux-arm64-gnu": ["@next/swc-linux-arm64-gnu@16.4.2", "", { "os": "linux", "cpu": "arm64", "libc": "glibc" }, "sha512-xhwFTAncJyaCNy5KqKKuKaIIdCy1/1ZV1s5S1G0hhT7wGMkDTlfJ6aQbfRFnIG/s3/kDrxQ8aycVe+c5QnP8ow=="],
 
-    "@next/swc-linux-arm64-musl": ["@next/swc-linux-arm64-musl@16.2.4", "", { "os": "linux", "cpu": "arm64" }, "sha512-iVMMp14514u7Nup2umQS03nT/bN9HurK8ufylC3FZNykrwjtx7V1A7+4kvhbDSCeonTVqV3Txnv0Lu+m2oDXNg=="],
+    "@next/swc-linux-arm64-musl": ["@next/swc-linux-arm64-musl@16.4.2", "", { "os": "linux", "cpu": "arm64", "libc": "musl" }, "sha512-T1PNmfbPcxr5ndtWUL/3wQtLXsz808lq6sc2GrNT5k2oquF7UyqZddHSuAewHVsWsGXe6nsl9HoN1YNriVjuSg=="],
 
-    "@next/swc-linux-x64-gnu": ["@next/swc-linux-x64-gnu@16.2.4", "", { "os": "linux", "cpu": "x64" }, "sha512-EZOvm1aQWgnI/N/xcWOlnS3RQBk0VtVav5Zo7n4p0A7UKyTDx047k8opDbXgBpHl4CulRqRfbw3QrX2w5UOXMQ=="],
+    "@next/swc-linux-x64-gnu": ["@next/swc-linux-x64-gnu@16.4.2", "", { "os": "linux", "cpu": "x64", "libc": "glibc" }, "sha512-N9cDUOCGtkJG5PNKDFZUF3xXndrJJcpLp121uAGjIGvO/U2p9tfdNOM9htj7+5f72l0m8rMw/cvYacUJBQoudg=="],
 
-    "@next/swc-linux-x64-musl": ["@next/swc-linux-x64-musl@16.2.4", "", { "os": "linux", "cpu": "x64" }, "sha512-h9FxsngCm9cTBf71AR4fGznDEDx1hS7+kSEiIRjq5kO1oXWm07DxVGZjCvk0SGx7TSjlUqhI8oOyz7NfwAdPoA=="],
+    "@next/swc-linux-x64-musl": ["@next/swc-linux-x64-musl@16.4.2", "", { "os": "linux", "cpu": "x64", "libc": "musl" }, "sha512-yY2uh1YhX6ufuYy2FCbw1dqblbhI57GLYAJfCkqD9auTv6pLrH67Uccjc3QMKBeCYAG6lkgu08ExmX1bbjejjQ=="],
 
-    "@next/swc-win32-arm64-msvc": ["@next/swc-win32-arm64-msvc@16.2.4", "", { "os": "win32", "cpu": "arm64" }, "sha512-3NdJV5OXMSOeJYijX+bjaLge3mJBlh4ybydbT4GFoB/2hAojWHtMhl3CYlYoMrjPuodp0nzFVi4Tj2+WaMg+Ow=="],
+    "@next/swc-win32-arm64-msvc": ["@next/swc-win32-arm64-msvc@16.4.2", "", { "os": "win32", "cpu": "arm64" }, "sha512-j/ArWRIHpMMB6wYLMhr2puTguBt70lNU/Cmjl9p6dTDE8DGknYJMP9PdwPk2dqpCNL/KIX9yfngDvIesxJPmsg=="],
 
-    "@next/swc-win32-x64-msvc": ["@next/swc-win32-x64-msvc@16.2.4", "", { "os": "win32", "cpu": "x64" }, "sha512-kMVGgsqhO5YTYODD9IPGGhA6iprWidQckK3LmPeW08PIFENRmgfb4MjXHO+p//d+ts2rpjvK5gXWzXSMrPl9cw=="],
+    "@next/swc-win32-x64-msvc": ["@next/swc-win32-x64-msvc@16.4.2", "", { "os": "win32", "cpu": "x64" }, "sha512-AA4edyWHDko3NCSo0x6GomsdgFb0oR1J3MXU1b5xt6FRFg4AucrMPW3S0hCe/9onU0O1BbpGQBsqo1r0Gneu1g=="],
 
     "@noble/ciphers": ["@noble/ciphers@2.4.0", "", {}, "sha512-AnjFn0Jv92laAkvMrghlFZq4qQCIN/4DxFV/eooqtC2YTjB7kBeLMS2T9KJX4Dn+ZVXLOwK0lSgqDtx9gvxtiw=="],
 
@@ -626,7 +631,7 @@
 
     "@swc/counter": ["@swc/counter@0.1.3", "", {}, "sha512-e2BR4lsJkkRlKZ/qCHPw9ZaSxc0MVUd7gtbtaB7aMvHeJVYe8sOB8DBZkP2DtISHGSku9sCK6T6cnY0CtXrOCQ=="],
 
-    "@swc/helpers": ["@swc/helpers@0.5.15", "", { "dependencies": { "tslib": "^2.8.0" } }, ""],
+    "@swc/helpers": ["@swc/helpers@0.5.23", "", { "dependencies": { "tslib": "^2.8.0" } }, "sha512-5lSsMOTXURePglDfvuAQUqkGek9Hg2kksOYay2m0+XR++b2NWYL/4sWyuvVBIs8oKnJaxkdi9whaL/sqN13afw=="],
 
     "@swc/types": ["@swc/types@0.1.28", "", { "dependencies": { "@swc/counter": "^0.1.3" } }, "sha512-V6Mnml8v09QALx6K0elJ7o9K/MkVDtW3t6L+7Ou/JcWtb3xwId2AH4FeOceySd2JaO87IMw4+6vSZxLm34LPbw=="],
 
@@ -696,9 +701,9 @@
 
     "@types/qrcode": ["@types/qrcode@1.5.6", "", { "dependencies": { "@types/node": "*" } }, "sha512-te7NQcV2BOvdj2b1hCAHzAoMNuj65kNBMz0KBaxM6c3VGBOhU0dURQKOtH8CFNI/dsKkwlv32p26qYQTWoB5bw=="],
 
-    "@types/react": ["@types/react@19.2.14", "", { "dependencies": { "csstype": "^3.2.2" } }, "sha512-ilcTH/UniCkMdtexkoCN0bI7pMcJDvmQFPvuPvmEaYA/NSfFTAgdUSLAoVjaRJm7+6PvcM+q1zYOwS4wTYMF9w=="],
+    "@types/react": ["@types/react@19.3.0", "", { "dependencies": { "csstype": "^3.2.2" } }, "sha512-N0rFCuH9YoxG9/m61l9MfpJKfmLOVU0em7ipIz6TRgSSkvReLB9vL85GB+yr8Bs5leqpvg96JSwF4ZS1s4viQg=="],
 
-    "@types/react-dom": ["@types/react-dom@19.2.3", "", { "peerDependencies": { "@types/react": "^19.2.0" } }, ""],
+    "@types/react-dom": ["@types/react-dom@19.3.0", "", { "peerDependencies": { "@types/react": "^19.3.0" } }, "sha512-ZI7bU42mZXXKHn/qNLEw2IrbiINU7X5+vfgdixBHkCNpYWXjKgfQ/P+uyGb5CjOLB9UcnTeg3rylQtV2hym44Q=="],
 
     "@types/sanitize-html": ["@types/sanitize-html@2.16.1", "", { "dependencies": { "htmlparser2": "^10.1" } }, "sha512-n9wjs8bCOTyN/ynwD8s/nTcTreIHB1vf31vhLMGqUPNHaweKC4/fAl4Dj+hUlCTKYgm4P3k83fmiFfzkZ6sgMA=="],
 
@@ -804,7 +809,7 @@
 
     "balanced-match": ["balanced-match@1.0.2", "", {}, ""],
 
-    "baseline-browser-mapping": ["baseline-browser-mapping@2.9.19", "", { "bin": { "baseline-browser-mapping": "dist/cli.js" } }, "sha512-ipDqC8FrAl/76p2SSWKSI+H9tFwm7vYqXQrItCuiVPt26Km0jS+NzSsBWAaBusvSbQcfJG+JitdMm+wZAgTYqg=="],
+    "baseline-browser-mapping": ["baseline-browser-mapping@2.11.30", "", { "bin": { "baseline-browser-mapping": "dist/cli.cjs" } }, "sha512-YJs6Pz17RMNv8HoyKREtCY38E3BV1nPkWVmIb+XN1uHC1Vqt3KZCH/uJH9ZKRoiKb/icZ6tvehyee6RZNbFfRA=="],
 
     "bcp-47-match": ["bcp-47-match@2.0.3", "", {}, "sha512-JtTezzbAibu8G0R9op9zb3vcWZd9JF6M0xOYGPn0fNCd7wOpRB1mU2mH9T8gaBGbAAyIIVgB2G7xG0GP98zMAQ=="],
 
@@ -840,7 +845,7 @@
 
     "camelcase": ["camelcase@5.3.1", "", {}, "sha512-L28STB170nwWS63UjtlEOE3dldQApaJXZkOI1uMFfzf3rRuPegHaHesyee+YxQ+W6SvRDQV6UrdOdRiR153wJg=="],
 
-    "caniuse-lite": ["caniuse-lite@1.0.30001765", "", {}, ""],
+    "caniuse-lite": ["caniuse-lite@1.0.30001818", "", {}, "sha512-XJbgo4adscw7R4MZU4/qVFkoMyPaNUAWmdNY4o/k9x7fFwmv4frIlndI9lWuaxviW9ObiZel9LuncnQPn6hQ5A=="],
 
     "ccount": ["ccount@2.0.1", "", {}, "sha512-eyrF0jiFpY+3drT6383f1qhkbGsLSifNAjA61IUjZjmLCWjItY6LB9ft9YhoDgwfmclB2zhu51Lc7+95b8NRAg=="],
 
@@ -1020,7 +1025,7 @@
 
     "eslint": ["eslint@9.39.4", "", { "dependencies": { "@eslint-community/eslint-utils": "^4.8.0", "@eslint-community/regexpp": "^4.12.1", "@eslint/config-array": "^0.21.2", "@eslint/config-helpers": "^0.4.2", "@eslint/core": "^0.17.0", "@eslint/eslintrc": "^3.3.5", "@eslint/js": "9.39.4", "@eslint/plugin-kit": "^0.4.1", "@humanfs/node": "^0.16.6", "@humanwhocodes/module-importer": "^1.0.1", "@humanwhocodes/retry": "^0.4.2", "@types/estree": "^1.0.6", "ajv": "^6.14.0", "chalk": "^4.0.0", "cross-spawn": "^7.0.6", "debug": "^4.3.2", "escape-string-regexp": "^4.0.0", "eslint-scope": "^8.4.0", "eslint-visitor-keys": "^4.2.1", "espree": "^10.4.0", "esquery": "^1.5.0", "esutils": "^2.0.2", "fast-deep-equal": "^3.1.3", "file-entry-cache": "^8.0.0", "find-up": "^5.0.0", "glob-parent": "^6.0.2", "ignore": "^5.2.0", "imurmurhash": "^0.1.4", "is-glob": "^4.0.0", "json-stable-stringify-without-jsonify": "^1.0.1", "lodash.merge": "^4.6.2", "minimatch": "^3.1.5", "natural-compare": "^1.4.0", "optionator": "^0.9.3" }, "peerDependencies": { "jiti": "*" }, "optionalPeers": ["jiti"], "bin": { "eslint": "bin/eslint.js" } }, "sha512-XoMjdBOwe/esVgEvLmNsD3IRHkm7fbKIUGvrleloJXUZgDHig2IPWNniv+GwjyJXzuNqVjlr5+4yVUZjycJwfQ=="],
 
-    "eslint-config-next": ["eslint-config-next@16.2.4", "", { "dependencies": { "@next/eslint-plugin-next": "16.2.4", "eslint-import-resolver-node": "^0.3.6", "eslint-import-resolver-typescript": "^3.5.2", "eslint-plugin-import": "^2.32.0", "eslint-plugin-jsx-a11y": "^6.10.0", "eslint-plugin-react": "^7.37.0", "eslint-plugin-react-hooks": "^7.0.0", "globals": "16.4.0", "typescript-eslint": "^8.46.0" }, "peerDependencies": { "eslint": ">=9.0.0", "typescript": ">=3.3.1" }, "optionalPeers": ["typescript"] }, "sha512-A6ekXYFj/YQxBPMl45g3e+U8zJo+X2+ZQwcz34pPKjpc/3S4roBA2Rd9xWB4FKuSxhofo1/95WjzmUY+wHrOhg=="],
+    "eslint-config-next": ["eslint-config-next@16.4.2", "", { "dependencies": { "@next/eslint-plugin-next": "16.4.2", "eslint-import-resolver-node": "^0.3.6", "eslint-import-resolver-typescript": "^3.5.2", "eslint-plugin-import": "^2.32.0", "eslint-plugin-jsx-a11y": "^6.10.0", "eslint-plugin-react": "^7.37.0", "eslint-plugin-react-hooks": "^7.1.0", "globals": "16.4.0", "typescript-eslint": "^8.56.0" }, "peerDependencies": { "eslint": ">=9.0.0", "typescript": ">=3.3.1" }, "optionalPeers": ["typescript"] }, "sha512-P33vjcETMXc+qBjpF77TeJHZLzk6cPcTy8KjpxLucYB3mCIFIORMcZ+cBXcAiIYjE5RM7jyknEEOwMNdnx/ADQ=="],
 
     "eslint-import-resolver-node": ["eslint-import-resolver-node@0.3.9", "", { "dependencies": { "debug": "^3.2.7", "is-core-module": "^2.13.0", "resolve": "^1.22.4" } }, ""],
 
@@ -1034,7 +1039,7 @@
 
     "eslint-plugin-react": ["eslint-plugin-react@7.37.5", "", { "dependencies": { "array-includes": "^3.1.8", "array.prototype.findlast": "^1.2.5", "array.prototype.flatmap": "^1.3.3", "array.prototype.tosorted": "^1.1.4", "doctrine": "^2.1.0", "es-iterator-helpers": "^1.2.1", "estraverse": "^5.3.0", "hasown": "^2.0.2", "jsx-ast-utils": "^2.4.1 || ^3.0.0", "minimatch": "^3.1.2", "object.entries": "^1.1.9", "object.fromentries": "^2.0.8", "object.values": "^1.2.1", "prop-types": "^15.8.1", "resolve": "^2.0.0-next.5", "semver": "^6.3.1", "string.prototype.matchall": "^4.0.12", "string.prototype.repeat": "^1.0.0" }, "peerDependencies": { "eslint": "^3 || ^4 || ^5 || ^6 || ^7 || ^8 || ^9.7" } }, ""],
 
-    "eslint-plugin-react-hooks": ["eslint-plugin-react-hooks@7.0.1", "", { "dependencies": { "@babel/core": "^7.24.4", "@babel/parser": "^7.24.4", "hermes-parser": "^0.25.1", "zod": "^3.25.0 || ^4.0.0", "zod-validation-error": "^3.5.0 || ^4.0.0" }, "peerDependencies": { "eslint": "^3.0.0 || ^4.0.0 || ^5.0.0 || ^6.0.0 || ^7.0.0 || ^8.0.0-0 || ^9.0.0" } }, "sha512-O0d0m04evaNzEPoSW+59Mezf8Qt0InfgGIBJnpC0h3NH/WjUAR7BIKUfysC6todmtiZ/A0oUVS8Gce0WhBrHsA=="],
+    "eslint-plugin-react-hooks": ["eslint-plugin-react-hooks@7.1.1", "", { "dependencies": { "@babel/core": "^7.24.4", "@babel/parser": "^7.24.4", "hermes-parser": "^0.25.1", "zod": "^3.25.0 || ^4.0.0", "zod-validation-error": "^3.5.0 || ^4.0.0" }, "peerDependencies": { "eslint": "^3.0.0 || ^4.0.0 || ^5.0.0 || ^6.0.0 || ^7.0.0 || ^8.0.0-0 || ^9.0.0 || ^10.0.0" } }, "sha512-f2I7Gw6JbvCexzIInuSbZpfdQ44D7iqdWX01FKLvrPgqxoE7oMj8clOfto8U6vYiz4yd5oKu39rRSVOe1zRu0g=="],
 
     "eslint-scope": ["eslint-scope@8.4.0", "", { "dependencies": { "esrecurse": "^4.3.0", "estraverse": "^5.2.0" } }, "sha512-sNXOfKCn74rt8RICKMvJS7XKV/Xk9kA7DyJr8mJik3S7Cwgy3qlkkmyS2uQB3jiJg6VNdZd/pDBJu0nvG2NlTg=="],
 
@@ -1552,7 +1557,7 @@
 
     "negotiator": ["negotiator@1.0.0", "", {}, "sha512-8Ofs/AUQh8MaEcrlq5xOX0CQ9ypTF5dl78mjlMNfOK08fzpgTHQRQPBxcPlEtIw0yRpws+Zo/3r+5WRby7u3Gg=="],
 
-    "next": ["next@16.2.4", "", { "dependencies": { "@next/env": "16.2.4", "@swc/helpers": "0.5.15", "baseline-browser-mapping": "^2.9.19", "caniuse-lite": "^1.0.30001579", "postcss": "8.4.31", "styled-jsx": "5.1.6" }, "optionalDependencies": { "@next/swc-darwin-arm64": "16.2.4", "@next/swc-darwin-x64": "16.2.4", "@next/swc-linux-arm64-gnu": "16.2.4", "@next/swc-linux-arm64-musl": "16.2.4", "@next/swc-linux-x64-gnu": "16.2.4", "@next/swc-linux-x64-musl": "16.2.4", "@next/swc-win32-arm64-msvc": "16.2.4", "@next/swc-win32-x64-msvc": "16.2.4", "sharp": "^0.34.5" }, "peerDependencies": { "@opentelemetry/api": "^1.1.0", "@playwright/test": "^1.51.1", "babel-plugin-react-compiler": "*", "react": "^18.2.0 || 19.0.0-rc-de68d2f4-20241204 || ^19.0.0", "react-dom": "^18.2.0 || 19.0.0-rc-de68d2f4-20241204 || ^19.0.0", "sass": "^1.3.0" }, "optionalPeers": ["@opentelemetry/api", "@playwright/test", "babel-plugin-react-compiler", "sass"], "bin": { "next": "dist/bin/next" } }, "sha512-kPvz56wF5frc+FxlHI5qnklCzbq53HTwORaWBGdT0vNoKh1Aya9XC8aPauH4NJxqtzbWsS5mAbctm4cr+EkQ2Q=="],
+    "next": ["next@16.4.2", "", { "dependencies": { "@next/env": "16.4.2", "@swc/helpers": "0.5.23", "baseline-browser-mapping": "^2.9.19", "caniuse-lite": "^1.0.30001579", "postcss": "8.5.23", "styled-jsx": "5.1.6" }, "optionalDependencies": { "@next/swc-darwin-arm64": "16.4.2", "@next/swc-darwin-x64": "16.4.2", "@next/swc-linux-arm64-gnu": "16.4.2", "@next/swc-linux-arm64-musl": "16.4.2", "@next/swc-linux-x64-gnu": "16.4.2", "@next/swc-linux-x64-musl": "16.4.2", "@next/swc-win32-arm64-msvc": "16.4.2", "@next/swc-win32-x64-msvc": "16.4.2", "sharp": "^0.35.5" }, "peerDependencies": { "@opentelemetry/api": "^1.1.0", "@playwright/test": "^1.51.1", "babel-plugin-react-compiler": "*", "react": "^18.2.0 || 19.0.0-rc-de68d2f4-20241204 || ^19.0.0", "react-dom": "^18.2.0 || 19.0.0-rc-de68d2f4-20241204 || ^19.0.0", "sass": "^1.3.0" }, "optionalPeers": ["@opentelemetry/api", "@playwright/test", "babel-plugin-react-compiler", "sass"], "bin": { "next": "dist/bin/next" } }, "sha512-r+oBJojfefUjOiWkBhXgLS+igxX/7BWyK59uHnyOyplMSLtBZ+QLP3okrdYTbrfrbrmNTVWLBPaHDX9KRaIt3w=="],
 
     "next-intl": ["next-intl@4.14.9", "", { "dependencies": { "@eloqnt/config": "^0.1.1", "@eloqnt/format-json": "^0.1.0", "@eloqnt/format-po": "^0.1.1", "@formatjs/intl-localematcher": "^0.8.1", "@parcel/watcher": "^2.4.1", "@swc/core": "~1.16.0", "icu-minify": "^4.14.9", "negotiator": "^1.0.0", "next-intl-swc-plugin-extractor": "4.14.9", "use-intl": "^4.14.9" }, "peerDependencies": { "@types/react": "^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0", "next": "^12.0.0 || ^13.0.0 || ^14.0.0 || ^15.0.0 || ^16.0.0", "react": "^16.8.0 || ^17.0.0 || ^18.0.0 || >=19.0.0-rc <19.0.0 || ^19.0.0" }, "optionalPeers": ["@types/react"] }, "sha512-uauRtUC+TrYNA1OL/QcwL9irndLrI9jK3Wdaa9W0B5AeKh9cqVdNeT0IWgLnhBqBRrVwppVdI0M+C1+JdGPQ3w=="],
 
@@ -1708,9 +1713,9 @@
 
     "raw-body": ["raw-body@3.0.2", "", { "dependencies": { "bytes": "~3.1.2", "http-errors": "~2.0.1", "iconv-lite": "~0.7.0", "unpipe": "~1.0.0" } }, "sha512-K5zQjDllxWkf7Z5xJdV0/B0WTNqx6vxG70zJE4N0kBs4LovmEYWJzQGxC9bS9RAKu3bgM40lrd5zoLJ12MQ5BA=="],
 
-    "react": ["react@19.2.5", "", {}, "sha512-llUJLzz1zTUBrskt2pwZgLq59AemifIftw4aB7JxOqf1HY2FDaGDxgwpAPVzHU1kdWabH7FauP4i1oEeer2WCA=="],
+    "react": ["react@19.3.1", "", {}, "sha512-QNhWdt7nrgVWWQG58QuGsAR3jv3Hbe4mb4vz7w2csnHavciZJgda1CPNaldF6eVxv90ud3jUXpKlHL69gO38yw=="],
 
-    "react-dom": ["react-dom@19.2.5", "", { "dependencies": { "scheduler": "^0.27.0" }, "peerDependencies": { "react": "^19.2.5" } }, "sha512-J5bAZz+DXMMwW/wV3xzKke59Af6CHY7G4uYLN1OvBcKEsWOs4pQExj86BBKamxl/Ik5bx9whOrvBlSDfWzgSag=="],
+    "react-dom": ["react-dom@19.3.1", "", { "dependencies": { "scheduler": "^0.28.0" }, "peerDependencies": { "react": "^19.3.1" } }, "sha512-Y0bARz53lhEC1NMCASs0/j+faB/zqt3R8hpvg1e8+61ZVJ4UL0UdC4cBbXfZMcIuhrfgeILTLe+ZeBCavQPtKQ=="],
 
     "react-is": ["react-is@17.0.2", "", {}, "sha512-w2GsyukL62IJnlaff/nRegPQR94C/XXamvMWmSHRJ4y7Ts/4ocGRmTHvOs8PSE6pB3dWOrD/nueuU5sduBsQ4w=="],
 
@@ -1808,7 +1813,7 @@
 
     "sax": ["sax@1.4.4", "", {}, "sha512-1n3r/tGXO6b6VXMdFT54SHzT9ytu9yr7TaELowdYpMqY/Ao7EnlQGmAQ1+RatX7Tkkdm6hONI2owqNx2aZj5Sw=="],
 
-    "scheduler": ["scheduler@0.27.0", "", {}, "sha512-eNv+WrVbKu1f3vbYJT/xtiF5syA5HPIMtf9IgY/nKg0sWqzAUEvqY/xm7OcZc/qafLx/iO9FgOmeSAp4v5ti/Q=="],
+    "scheduler": ["scheduler@0.28.0", "", {}, "sha512-juorfCmIkIw8tT+p5BXSm6PJjQF/ycEYmKyzURCIt/RaZIhL+PulbQ9Yu2z1HdOJDdqDTlxA1+xKBmHXJsczAw=="],
 
     "selderee": ["selderee@0.12.0", "", { "dependencies": { "parseley": "~0.13.1" } }, "sha512-b1YMh3+DHZp59DLna3qVwQ5iOla/nrI6mLBNW02XxU77M3046Df6VLkoaJyFz20VsGIG5kkp+FK0kg4K4HnUFw=="],
 
@@ -1832,7 +1837,7 @@
 
     "shadcn": ["shadcn@4.22.1", "", { "dependencies": { "@babel/core": "^7.28.0", "@babel/parser": "^7.28.0", "@babel/plugin-transform-typescript": "^7.28.0", "@babel/preset-typescript": "^7.27.1", "@dotenvx/dotenvx": "^1.48.4", "@modelcontextprotocol/sdk": "^1.32.0", "@shadcn/registry": "0.2.0", "@types/validate-npm-package-name": "^4.0.2", "browserslist": "^4.29.3", "cn": "^0.2.4", "commander": "^14.0.0", "dedent": "^1.6.0", "deepmerge": "^4.3.1", "diff": "^8.0.2", "execa": "^9.6.0", "fast-glob": "^3.3.3", "fs-extra": "^11.3.1", "fuzzysort": "^3.1.0", "kleur": "^4.1.5", "open": "^11.0.4", "ora": "^8.2.0", "postcss": "^8.5.23", "postcss-selector-parser": "^7.1.6", "prompts": "^2.4.2", "recast": "^0.23.11", "socks": "^2.8.8", "stringify-object": "^5.0.0", "ts-morph": "^26.0.0", "tsconfig-paths": "^4.2.0", "undici": "^7.29.1", "validate-npm-package-name": "^7.0.1", "zod": "^4.2.0" }, "bin": { "shadcn": "dist/index.js" } }, "sha512-LbB4Lro+b0qSVki/tgL5edtKylEnXe1ppxMJC12d7NHPgaT+eSgJGMQULwP72V7X9tbiUq7xfx3VDAfB7jdGoA=="],
 
-    "sharp": ["sharp@0.34.5", "", { "dependencies": { "@img/colour": "^1.0.0", "detect-libc": "^2.1.2", "semver": "^7.7.3" }, "optionalDependencies": { "@img/sharp-darwin-arm64": "0.34.5", "@img/sharp-darwin-x64": "0.34.5", "@img/sharp-libvips-darwin-arm64": "1.2.4", "@img/sharp-libvips-darwin-x64": "1.2.4", "@img/sharp-libvips-linux-arm": "1.2.4", "@img/sharp-libvips-linux-arm64": "1.2.4", "@img/sharp-libvips-linux-ppc64": "1.2.4", "@img/sharp-libvips-linux-riscv64": "1.2.4", "@img/sharp-libvips-linux-s390x": "1.2.4", "@img/sharp-libvips-linux-x64": "1.2.4", "@img/sharp-libvips-linuxmusl-arm64": "1.2.4", "@img/sharp-libvips-linuxmusl-x64": "1.2.4", "@img/sharp-linux-arm": "0.34.5", "@img/sharp-linux-arm64": "0.34.5", "@img/sharp-linux-ppc64": "0.34.5", "@img/sharp-linux-riscv64": "0.34.5", "@img/sharp-linux-s390x": "0.34.5", "@img/sharp-linux-x64": "0.34.5", "@img/sharp-linuxmusl-arm64": "0.34.5", "@img/sharp-linuxmusl-x64": "0.34.5", "@img/sharp-wasm32": "0.34.5", "@img/sharp-win32-arm64": "0.34.5", "@img/sharp-win32-ia32": "0.34.5", "@img/sharp-win32-x64": "0.34.5" } }, "sha512-Ou9I5Ft9WNcCbXrU9cMgPBcCK8LiwLqcbywW3t4oDV37n1pzpuNLsYiAV8eODnjbtQlSDwZ2cUEeQz4E54Hltg=="],
+    "sharp": ["sharp@0.35.5", "", { "dependencies": { "@img/colour": "^1.1.0", "detect-libc": "^2.1.2", "semver": "^7.8.5" }, "optionalDependencies": { "@img/sharp-darwin-arm64": "0.35.5", "@img/sharp-darwin-x64": "0.35.5", "@img/sharp-freebsd-wasm32": "0.35.5", "@img/sharp-libvips-darwin-arm64": "1.3.4", "@img/sharp-libvips-darwin-x64": "1.3.4", "@img/sharp-libvips-linux-arm": "1.3.4", "@img/sharp-libvips-linux-arm64": "1.3.4", "@img/sharp-libvips-linux-ppc64": "1.3.4", "@img/sharp-libvips-linux-riscv64": "1.3.4", "@img/sharp-libvips-linux-s390x": "1.3.4", "@img/sharp-libvips-linux-x64": "1.3.4", "@img/sharp-libvips-linuxmusl-arm64": "1.3.4", "@img/sharp-libvips-linuxmusl-x64": "1.3.4", "@img/sharp-linux-arm": "0.35.5", "@img/sharp-linux-arm64": "0.35.5", "@img/sharp-linux-ppc64": "0.35.5", "@img/sharp-linux-riscv64": "0.35.5", "@img/sharp-linux-s390x": "0.35.5", "@img/sharp-linux-x64": "0.35.5", "@img/sharp-linuxmusl-arm64": "0.35.5", "@img/sharp-linuxmusl-x64": "0.35.5", "@img/sharp-webcontainers-wasm32": "0.35.5", "@img/sharp-win32-arm64": "0.35.5", "@img/sharp-win32-ia32": "0.35.5", "@img/sharp-win32-x64": "0.35.5" }, "peerDependencies": { "@types/node": "*" }, "optionalPeers": ["@types/node"] }, "sha512-Ywn4OnzGukp7CDMrp08RQ50YKmuwG47brZgIVPTvBaaAfQlRlygrRqSrxdCiL9M+LlzLBiJ68IR1QqvzHyjC7g=="],
 
     "shebang-command": ["shebang-command@2.0.0", "", { "dependencies": { "shebang-regex": "^3.0.0" } }, ""],
 
@@ -2072,6 +2077,10 @@
 
     "@babel/core/@babel/code-frame": ["@babel/code-frame@7.29.0", "", { "dependencies": { "@babel/helper-validator-identifier": "^7.28.5", "js-tokens": "^4.0.0", "picocolors": "^1.1.1" } }, "sha512-9NhCeYjq9+3uxgdtp20LSiJXJvN0FeCtNGpJxuMFZ1Kv3cWUNb6DOhJwUvcVCzKGR66cw4njwM6hrJLqgOwbcw=="],
 
+    "@babel/core/@babel/parser": ["@babel/parser@7.29.0", "", { "dependencies": { "@babel/types": "^7.29.0" }, "bin": "./bin/babel-parser.js" }, "sha512-IyDgFV5GeDUVX4YdF/3CPULtVGSXXMLh1xVIgdCgxApktqnQV0r7/8Nqthg+8YLGaAtdyIlo2qIdZrbCv4+7ww=="],
+
+    "@babel/generator/@babel/parser": ["@babel/parser@7.29.0", "", { "dependencies": { "@babel/types": "^7.29.0" }, "bin": "./bin/babel-parser.js" }, "sha512-IyDgFV5GeDUVX4YdF/3CPULtVGSXXMLh1xVIgdCgxApktqnQV0r7/8Nqthg+8YLGaAtdyIlo2qIdZrbCv4+7ww=="],
+
     "@babel/helper-annotate-as-pure/@babel/types": ["@babel/types@7.29.8", "", { "dependencies": { "@babel/helper-string-parser": "^7.29.7", "@babel/helper-validator-identifier": "^7.29.7" } }, "sha512-Vj1jF3cPfxg7OAfoI7QnVKLoILlm2JF9pnVHrX8qx7AHMiYWT+NDAA7jChlNgRS4WTLc/fD1lXLmPixluj+3Gg=="],
 
     "@babel/helper-compilation-targets/@babel/helper-validator-option": ["@babel/helper-validator-option@7.27.1", "", {}, "sha512-YvjJow9FxbhFFKDSuFnVCe2WxXk1zWc22fFePVNEaWJEu8IrZVlda6N0uHwzZrUM1il7NC9Mlp4MaJYbYd9JSg=="],
@@ -2094,12 +2103,18 @@
 
     "@babel/helper-skip-transparent-expression-wrappers/@babel/types": ["@babel/types@7.29.8", "", { "dependencies": { "@babel/helper-string-parser": "^7.29.7", "@babel/helper-validator-identifier": "^7.29.7" } }, "sha512-Vj1jF3cPfxg7OAfoI7QnVKLoILlm2JF9pnVHrX8qx7AHMiYWT+NDAA7jChlNgRS4WTLc/fD1lXLmPixluj+3Gg=="],
 
+    "@babel/parser/@babel/types": ["@babel/types@7.29.8", "", { "dependencies": { "@babel/helper-string-parser": "^7.29.7", "@babel/helper-validator-identifier": "^7.29.7" } }, "sha512-Vj1jF3cPfxg7OAfoI7QnVKLoILlm2JF9pnVHrX8qx7AHMiYWT+NDAA7jChlNgRS4WTLc/fD1lXLmPixluj+3Gg=="],
+
     "@babel/plugin-transform-modules-commonjs/@babel/helper-module-transforms": ["@babel/helper-module-transforms@7.29.7", "", { "dependencies": { "@babel/helper-module-imports": "^7.29.7", "@babel/helper-validator-identifier": "^7.29.7", "@babel/traverse": "^7.29.7" }, "peerDependencies": { "@babel/core": "^7.0.0" } }, "sha512-UPUVSyXbOh627KiCIGQSgwWzGeBKLkaJ9PJEdrngIwMSzxLR4jS4+f1f1jb7VzBbg8nFLaYotvVPFCTqdrmTAg=="],
 
     "@babel/template/@babel/code-frame": ["@babel/code-frame@7.29.0", "", { "dependencies": { "@babel/helper-validator-identifier": "^7.28.5", "js-tokens": "^4.0.0", "picocolors": "^1.1.1" } }, "sha512-9NhCeYjq9+3uxgdtp20LSiJXJvN0FeCtNGpJxuMFZ1Kv3cWUNb6DOhJwUvcVCzKGR66cw4njwM6hrJLqgOwbcw=="],
 
+    "@babel/template/@babel/parser": ["@babel/parser@7.29.0", "", { "dependencies": { "@babel/types": "^7.29.0" }, "bin": "./bin/babel-parser.js" }, "sha512-IyDgFV5GeDUVX4YdF/3CPULtVGSXXMLh1xVIgdCgxApktqnQV0r7/8Nqthg+8YLGaAtdyIlo2qIdZrbCv4+7ww=="],
+
     "@babel/traverse/@babel/code-frame": ["@babel/code-frame@7.29.0", "", { "dependencies": { "@babel/helper-validator-identifier": "^7.28.5", "js-tokens": "^4.0.0", "picocolors": "^1.1.1" } }, "sha512-9NhCeYjq9+3uxgdtp20LSiJXJvN0FeCtNGpJxuMFZ1Kv3cWUNb6DOhJwUvcVCzKGR66cw4njwM6hrJLqgOwbcw=="],
 
+    "@babel/traverse/@babel/parser": ["@babel/parser@7.29.0", "", { "dependencies": { "@babel/types": "^7.29.0" }, "bin": "./bin/babel-parser.js" }, "sha512-IyDgFV5GeDUVX4YdF/3CPULtVGSXXMLh1xVIgdCgxApktqnQV0r7/8Nqthg+8YLGaAtdyIlo2qIdZrbCv4+7ww=="],
+
     "@babel/types/@babel/helper-validator-identifier": ["@babel/helper-validator-identifier@7.28.5", "", {}, "sha512-qSs4ifwzKJSV39ucNjsvc6WVHs6b7S03sOh2OcHF9UHfVPqWWALUsNUVzhSBiItjRZoLHx7nIarVjqKVusUZ1Q=="],
 
     "@dotenvx/dotenvx/commander": ["commander@11.1.0", "", {}, "sha512-yPVavfyCcRhmorC7rWlkHn15b4wDVgVmBA7kV4QVBsF7kv/9TKJAbAXVTxvTnwP8HHKjRCJDClKbciiYS7p0DQ=="],
@@ -2120,6 +2135,8 @@
 
     "@radix-ui/react-popper/@floating-ui/react-dom": ["@floating-ui/react-dom@2.1.7", "", { "dependencies": { "@floating-ui/dom": "^1.7.5" }, "peerDependencies": { "react": ">=16.8.0", "react-dom": ">=16.8.0" } }, "sha512-0tLRojf/1Go2JgEVm+3Frg9A3IW8bJgKgdO0BN5RkF//ufuz2joZM63Npau2ff3J6lUVYgDSNzNkR+aH3IVfjg=="],
 
+    "@shadcn/registry/@babel/parser": ["@babel/parser@7.29.0", "", { "dependencies": { "@babel/types": "^7.29.0" }, "bin": "./bin/babel-parser.js" }, "sha512-IyDgFV5GeDUVX4YdF/3CPULtVGSXXMLh1xVIgdCgxApktqnQV0r7/8Nqthg+8YLGaAtdyIlo2qIdZrbCv4+7ww=="],
+
     "@shadcn/registry/cn": ["cn@0.2.6", "", { "bin": { "cn": "bin/cn.mjs" } }, "sha512-+i4L0zUGgRcEnhsxueVrP7iBGxBx5iD0WOTYg1MwFEu2ZyCmH5Ov2V1cul2Ht5UchRQQgftCf4be/RxspuW6QQ=="],
 
     "@tailwindcss/oxide-wasm32-wasi/@emnapi/core": ["@emnapi/core@1.11.3", "", { "dependencies": { "@emnapi/wasi-threads": "1.2.3", "tslib": "^2.4.0" }, "bundled": true }, "sha512-zLpS5asjEb7lq8jYLq37N6XKaE41DIexlY1rF/z4/tIl3wo13Sqm28fRyfIsKZD+NZ8mM5RoKkpW/rBcuoSZSg=="],
@@ -2150,10 +2167,6 @@
 
     "body-parser/iconv-lite": ["iconv-lite@0.7.2", "", { "dependencies": { "safer-buffer": ">= 2.1.2 < 3.0.0" } }, "sha512-im9DjEDQ55s9fL4EYzOAv0yMqmMBSZp6G0VvFyTMPKWxiSBHUj9NW/qqLmXUwXrrM7AvqSlTCfvqRb0cM8yYqw=="],
 
-    "browserslist/baseline-browser-mapping": ["baseline-browser-mapping@2.11.30", "", { "bin": { "baseline-browser-mapping": "dist/cli.cjs" } }, "sha512-YJs6Pz17RMNv8HoyKREtCY38E3BV1nPkWVmIb+XN1uHC1Vqt3KZCH/uJH9ZKRoiKb/icZ6tvehyee6RZNbFfRA=="],
-
-    "browserslist/caniuse-lite": ["caniuse-lite@1.0.30001818", "", {}, "sha512-XJbgo4adscw7R4MZU4/qVFkoMyPaNUAWmdNY4o/k9x7fFwmv4frIlndI9lWuaxviW9ObiZel9LuncnQPn6hQ5A=="],
-
     "chalk/ansi-styles": ["ansi-styles@4.3.0", "", { "dependencies": { "color-convert": "^2.0.1" } }, "sha512-zbB9rCJAT1rbjiVDb2hqKFHNYLxgtk8NURxZ3IZwD3F6NtxbXZQCnnSi1Lkx+IDohdPlFp222wVALIheZJQSEg=="],
 
     "cliui/string-width": ["string-width@4.2.3", "", { "dependencies": { "emoji-regex": "^8.0.0", "is-fullwidth-code-point": "^3.0.0", "strip-ansi": "^6.0.1" } }, "sha512-wKyQRQpjJ0sIp62ErSZdGsjMJWsap5oRNihHhu6G7JVO/9jIB6UyevL+tXuOqrng8j/cxKTWyWUwvSTriiZz/g=="],
@@ -2228,7 +2241,7 @@
 
     "micromatch/picomatch": ["picomatch@2.3.1", "", {}, ""],
 
-    "next/postcss": ["postcss@8.4.31", "", { "dependencies": { "nanoid": "^3.3.6", "picocolors": "^1.0.0", "source-map-js": "^1.0.2" } }, ""],
+    "next/postcss": ["postcss@8.5.23", "", { "dependencies": { "nanoid": "^3.3.16", "picocolors": "^1.1.1", "source-map-js": "^1.2.1" } }, "sha512-g50586zr4bZmwFiTlflMu8E0bDTb5I5gertgwAKmsdUlTQIhZtunzUlD1WSzwcVWPoAVpsrA6vlfCD7oXvRwgg=="],
 
     "npm-run-path/path-key": ["path-key@4.0.0", "", {}, "sha512-haREypq7xkM7ErfgIyA0z+Bj4AGKlMSdlQE2jvJo6huWD1EdkKYV+G/T4nq0YEF2vgTT8kqMFKo1uHn950r4SQ=="],
 
@@ -2252,11 +2265,13 @@
 
     "sanitize-html/htmlparser2": ["htmlparser2@12.0.0", "", { "dependencies": { "domelementtype": "^3.0.0", "domhandler": "^6.0.0", "domutils": "^4.0.2", "entities": "^8.0.0" } }, "sha512-Tz7u1i95/g2x2jz81+x0FBVhBhY5aRTvD3tXXdFaljuNdzDLJ8UGNRrTcj2cgQvAg3iW/h77Fz15nLW0L0CrZw=="],
 
+    "shadcn/@babel/parser": ["@babel/parser@7.29.0", "", { "dependencies": { "@babel/types": "^7.29.0" }, "bin": "./bin/babel-parser.js" }, "sha512-IyDgFV5GeDUVX4YdF/3CPULtVGSXXMLh1xVIgdCgxApktqnQV0r7/8Nqthg+8YLGaAtdyIlo2qIdZrbCv4+7ww=="],
+
     "shadcn/@modelcontextprotocol/sdk": ["@modelcontextprotocol/sdk@1.32.1", "", { "dependencies": { "@hono/node-server": "^1.19.9 || ^2.0.5", "ajv": "^8.17.1", "ajv-formats": "^3.0.1", "content-type": "^1.0.5", "cors": "^2.8.5", "cross-spawn": "^7.0.5", "eventsource": "^3.0.2", "eventsource-parser": "^3.0.0", "express": "^5.2.1", "express-rate-limit": "^8.2.1", "hono": "^4.11.4", "jose": "^6.1.3", "json-schema-typed": "^8.0.2", "pkce-challenge": "^5.0.0", "raw-body": "^3.0.0", "zod": "^3.25 || ^4.0", "zod-to-json-schema": "^3.25.1" }, "peerDependencies": { "@cfworker/json-schema": "^4.1.1" }, "optionalPeers": ["@cfworker/json-schema"] }, "sha512-2DdE+SJDtzLEEWzY1ZjY7Q+VcPhcV1KisD3zI4u0XZyktsjHum1mwbMI+JaulUBi2OZk+KJAi2uPXzxichPkdw=="],
 
     "shadcn/cn": ["cn@0.2.6", "", { "bin": { "cn": "bin/cn.mjs" } }, "sha512-+i4L0zUGgRcEnhsxueVrP7iBGxBx5iD0WOTYg1MwFEu2ZyCmH5Ov2V1cul2Ht5UchRQQgftCf4be/RxspuW6QQ=="],
 
-    "sharp/semver": ["semver@7.7.3", "", { "bin": "bin/semver.js" }, ""],
+    "sharp/semver": ["semver@7.8.5", "", { "bin": { "semver": "bin/semver.js" } }, "sha512-Y7/KDsb8LjooZpwaqGyulO6DQlksgCncchHGk+sZIY4SBvUocMBEFH5Ur1fI4dV+Jvl0w6cjvucaIi40puRioA=="],
 
     "string-width/emoji-regex": ["emoji-regex@10.6.0", "", {}, "sha512-toUI84YS5YmxW219erniWD0CIVOo46xGKColeNQRgOzDorgBi1v4D71/OFzgD9GO2UGKIv1C3Sp8DAn0+j5w7A=="],
 
@@ -2282,6 +2297,10 @@
 
     "@babel/helper-annotate-as-pure/@babel/types/@babel/helper-string-parser": ["@babel/helper-string-parser@7.29.7", "", {}, "sha512-Pb5ijPrZ89GDH8223L4UP8i6QApWxs04RbPQJTeWDV0/keR2E36MeKnyr6LYmUUvqRRI+Iv87SuF1W6ErINzYw=="],
 
+    "@babel/helper-compilation-targets/browserslist/baseline-browser-mapping": ["baseline-browser-mapping@2.9.19", "", { "bin": { "baseline-browser-mapping": "dist/cli.js" } }, "sha512-ipDqC8FrAl/76p2SSWKSI+H9tFwm7vYqXQrItCuiVPt26Km0jS+NzSsBWAaBusvSbQcfJG+JitdMm+wZAgTYqg=="],
+
+    "@babel/helper-compilation-targets/browserslist/caniuse-lite": ["caniuse-lite@1.0.30001765", "", {}, ""],
+
     "@babel/helper-compilation-targets/browserslist/electron-to-chromium": ["electron-to-chromium@1.5.286", "", {}, "sha512-9tfDXhJ4RKFNerfjdCcZfufu49vg620741MNs26a9+bhLThdB+plgMeou98CAaHu/WATj2iHOOHTp1hWtABj2A=="],
 
     "@babel/helper-compilation-targets/browserslist/node-releases": ["node-releases@2.0.27", "", {}, "sha512-nmh3lCkYZ3grZvqcCH+fjmQ7X+H0OeZgP40OierEaAptX4XofMh5kwNbWh7lBduUzCcV/8kZ+NDLCwm2iorIlA=="],
@@ -2292,8 +2311,6 @@
 
     "@babel/helper-create-class-features-plugin/@babel/traverse/@babel/helper-globals": ["@babel/helper-globals@7.29.7", "", {}, "sha512-3nQVUAtvkKH9zahfWgw96Jc/uFOmjACE1kQz82E2lqWmHBgjzbNlsC22nuQTfahmWeQtTq5nQ/4Nnd2A1wj4zA=="],
 
-    "@babel/helper-create-class-features-plugin/@babel/traverse/@babel/parser": ["@babel/parser@7.29.9", "", { "dependencies": { "@babel/types": "^7.29.8" }, "bin": "./bin/babel-parser.js" }, "sha512-CjXrNHTnvqBVqHgdBysY3vk2T8tpJHb5/RMeHJBTyVa9xgugCB0CJTx/3oO8RV2QRQP391RWpB7D6hLjm8V9uA=="],
-
     "@babel/helper-create-class-features-plugin/@babel/traverse/@babel/template": ["@babel/template@7.29.7", "", { "dependencies": { "@babel/code-frame": "^7.29.7", "@babel/parser": "^7.29.7", "@babel/types": "^7.29.7" } }, "sha512-puq+Gf35oI24FeN11LkoUQFqv9uwNeWpxXZi/Ji3rRIoKAzKnxRaZ+Gkj0vKS9ZCiTESfng1N9LyOyXvo+m+Gg=="],
 
     "@babel/helper-create-class-features-plugin/@babel/traverse/@babel/types": ["@babel/types@7.29.8", "", { "dependencies": { "@babel/helper-string-parser": "^7.29.7", "@babel/helper-validator-identifier": "^7.29.7" } }, "sha512-Vj1jF3cPfxg7OAfoI7QnVKLoILlm2JF9pnVHrX8qx7AHMiYWT+NDAA7jChlNgRS4WTLc/fD1lXLmPixluj+3Gg=="],
@@ -2302,8 +2319,6 @@
 
     "@babel/helper-member-expression-to-functions/@babel/traverse/@babel/helper-globals": ["@babel/helper-globals@7.29.7", "", {}, "sha512-3nQVUAtvkKH9zahfWgw96Jc/uFOmjACE1kQz82E2lqWmHBgjzbNlsC22nuQTfahmWeQtTq5nQ/4Nnd2A1wj4zA=="],
 
-    "@babel/helper-member-expression-to-functions/@babel/traverse/@babel/parser": ["@babel/parser@7.29.9", "", { "dependencies": { "@babel/types": "^7.29.8" }, "bin": "./bin/babel-parser.js" }, "sha512-CjXrNHTnvqBVqHgdBysY3vk2T8tpJHb5/RMeHJBTyVa9xgugCB0CJTx/3oO8RV2QRQP391RWpB7D6hLjm8V9uA=="],
-
     "@babel/helper-member-expression-to-functions/@babel/traverse/@babel/template": ["@babel/template@7.29.7", "", { "dependencies": { "@babel/code-frame": "^7.29.7", "@babel/parser": "^7.29.7", "@babel/types": "^7.29.7" } }, "sha512-puq+Gf35oI24FeN11LkoUQFqv9uwNeWpxXZi/Ji3rRIoKAzKnxRaZ+Gkj0vKS9ZCiTESfng1N9LyOyXvo+m+Gg=="],
 
     "@babel/helper-member-expression-to-functions/@babel/types/@babel/helper-string-parser": ["@babel/helper-string-parser@7.29.7", "", {}, "sha512-Pb5ijPrZ89GDH8223L4UP8i6QApWxs04RbPQJTeWDV0/keR2E36MeKnyr6LYmUUvqRRI+Iv87SuF1W6ErINzYw=="],
@@ -2314,8 +2329,6 @@
 
     "@babel/helper-replace-supers/@babel/traverse/@babel/helper-globals": ["@babel/helper-globals@7.29.7", "", {}, "sha512-3nQVUAtvkKH9zahfWgw96Jc/uFOmjACE1kQz82E2lqWmHBgjzbNlsC22nuQTfahmWeQtTq5nQ/4Nnd2A1wj4zA=="],
 
-    "@babel/helper-replace-supers/@babel/traverse/@babel/parser": ["@babel/parser@7.29.9", "", { "dependencies": { "@babel/types": "^7.29.8" }, "bin": "./bin/babel-parser.js" }, "sha512-CjXrNHTnvqBVqHgdBysY3vk2T8tpJHb5/RMeHJBTyVa9xgugCB0CJTx/3oO8RV2QRQP391RWpB7D6hLjm8V9uA=="],
-
     "@babel/helper-replace-supers/@babel/traverse/@babel/template": ["@babel/template@7.29.7", "", { "dependencies": { "@babel/code-frame": "^7.29.7", "@babel/parser": "^7.29.7", "@babel/types": "^7.29.7" } }, "sha512-puq+Gf35oI24FeN11LkoUQFqv9uwNeWpxXZi/Ji3rRIoKAzKnxRaZ+Gkj0vKS9ZCiTESfng1N9LyOyXvo+m+Gg=="],
 
     "@babel/helper-replace-supers/@babel/traverse/@babel/types": ["@babel/types@7.29.8", "", { "dependencies": { "@babel/helper-string-parser": "^7.29.7", "@babel/helper-validator-identifier": "^7.29.7" } }, "sha512-Vj1jF3cPfxg7OAfoI7QnVKLoILlm2JF9pnVHrX8qx7AHMiYWT+NDAA7jChlNgRS4WTLc/fD1lXLmPixluj+3Gg=="],
@@ -2324,12 +2337,12 @@
 
     "@babel/helper-skip-transparent-expression-wrappers/@babel/traverse/@babel/helper-globals": ["@babel/helper-globals@7.29.7", "", {}, "sha512-3nQVUAtvkKH9zahfWgw96Jc/uFOmjACE1kQz82E2lqWmHBgjzbNlsC22nuQTfahmWeQtTq5nQ/4Nnd2A1wj4zA=="],
 
-    "@babel/helper-skip-transparent-expression-wrappers/@babel/traverse/@babel/parser": ["@babel/parser@7.29.9", "", { "dependencies": { "@babel/types": "^7.29.8" }, "bin": "./bin/babel-parser.js" }, "sha512-CjXrNHTnvqBVqHgdBysY3vk2T8tpJHb5/RMeHJBTyVa9xgugCB0CJTx/3oO8RV2QRQP391RWpB7D6hLjm8V9uA=="],
-
     "@babel/helper-skip-transparent-expression-wrappers/@babel/traverse/@babel/template": ["@babel/template@7.29.7", "", { "dependencies": { "@babel/code-frame": "^7.29.7", "@babel/parser": "^7.29.7", "@babel/types": "^7.29.7" } }, "sha512-puq+Gf35oI24FeN11LkoUQFqv9uwNeWpxXZi/Ji3rRIoKAzKnxRaZ+Gkj0vKS9ZCiTESfng1N9LyOyXvo+m+Gg=="],
 
     "@babel/helper-skip-transparent-expression-wrappers/@babel/types/@babel/helper-string-parser": ["@babel/helper-string-parser@7.29.7", "", {}, "sha512-Pb5ijPrZ89GDH8223L4UP8i6QApWxs04RbPQJTeWDV0/keR2E36MeKnyr6LYmUUvqRRI+Iv87SuF1W6ErINzYw=="],
 
+    "@babel/parser/@babel/types/@babel/helper-string-parser": ["@babel/helper-string-parser@7.29.7", "", {}, "sha512-Pb5ijPrZ89GDH8223L4UP8i6QApWxs04RbPQJTeWDV0/keR2E36MeKnyr6LYmUUvqRRI+Iv87SuF1W6ErINzYw=="],
+
     "@babel/plugin-transform-modules-commonjs/@babel/helper-module-transforms/@babel/helper-module-imports": ["@babel/helper-module-imports@7.29.7", "", { "dependencies": { "@babel/traverse": "^7.29.7", "@babel/types": "^7.29.7" } }, "sha512-ejHwrQQYcm9xnTivShn2IDOlIzInN34AXskvq9QicvCtEzq1Vzclu/tKF8Jq1Cg8JG2GL6/EmjgsCT7lXepE3g=="],
 
     "@babel/plugin-transform-modules-commonjs/@babel/helper-module-transforms/@babel/traverse": ["@babel/traverse@7.29.10", "", { "dependencies": { "@babel/code-frame": "^7.29.7", "@babel/generator": "^7.29.8", "@babel/helper-globals": "^7.29.7", "@babel/parser": "^7.29.9", "@babel/template": "^7.29.7", "@babel/types": "^7.29.8", "debug": "^4.3.1" } }, "sha512-B3lYAs2nkKskbgQ1nfy8Ma9ao9Q1rntTAQHrzzyDuj+TSO+X3le6PfWwqDvodsb+OumE10eMFfuMCTQSQ5iuIQ=="],
@@ -2388,10 +2401,6 @@
 
     "mailparser/libmime/libqp": ["libqp@3.0.1", "", {}, "sha512-7QZxpPX25pga1WiMueduWxmrHMVBFrZPH6ZUaozGYa/H98JH6NVBSET3qVw+4NxzoraIW7rJ81YxSU9IalvCpg=="],
 
-    "next/postcss/nanoid": ["nanoid@3.3.11", "", { "bin": "bin/nanoid.cjs" }, ""],
-
-    "next/postcss/source-map-js": ["source-map-js@1.2.1", "", {}, ""],
-
     "pkg-up/find-up/locate-path": ["locate-path@3.0.0", "", { "dependencies": { "p-locate": "^3.0.0", "path-exists": "^3.0.0" } }, "sha512-7AO748wWnIhNqAuaty2ZWHkQHRSNfPVIsPIfwEOWO22AmaoVrWavlOcMR5nzTLNYvp36X220/maaRsrec1G65A=="],
 
     "sanitize-html/htmlparser2/domelementtype": ["domelementtype@3.0.0", "", {}, "sha512-umCQid3jKbDmVjx8jGaW7uUykm4DEUeyV21hPxNMo2nV955DhUThwqyOIDtreepP31hl84X7G5U9ZfsWvIB3Pg=="],
@@ -2420,8 +2429,6 @@
 
     "@babel/plugin-transform-modules-commonjs/@babel/helper-module-transforms/@babel/traverse/@babel/helper-globals": ["@babel/helper-globals@7.29.7", "", {}, "sha512-3nQVUAtvkKH9zahfWgw96Jc/uFOmjACE1kQz82E2lqWmHBgjzbNlsC22nuQTfahmWeQtTq5nQ/4Nnd2A1wj4zA=="],
 
-    "@babel/plugin-transform-modules-commonjs/@babel/helper-module-transforms/@babel/traverse/@babel/parser": ["@babel/parser@7.29.9", "", { "dependencies": { "@babel/types": "^7.29.8" }, "bin": "./bin/babel-parser.js" }, "sha512-CjXrNHTnvqBVqHgdBysY3vk2T8tpJHb5/RMeHJBTyVa9xgugCB0CJTx/3oO8RV2QRQP391RWpB7D6hLjm8V9uA=="],
-
     "@babel/plugin-transform-modules-commonjs/@babel/helper-module-transforms/@babel/traverse/@babel/template": ["@babel/template@7.29.7", "", { "dependencies": { "@babel/code-frame": "^7.29.7", "@babel/parser": "^7.29.7", "@babel/types": "^7.29.7" } }, "sha512-puq+Gf35oI24FeN11LkoUQFqv9uwNeWpxXZi/Ji3rRIoKAzKnxRaZ+Gkj0vKS9ZCiTESfng1N9LyOyXvo+m+Gg=="],
 
     "@babel/plugin-transform-modules-commonjs/@babel/helper-module-transforms/@babel/traverse/@babel/types": ["@babel/types@7.29.8", "", { "dependencies": { "@babel/helper-string-parser": "^7.29.7", "@babel/helper-validator-identifier": "^7.29.7" } }, "sha512-Vj1jF3cPfxg7OAfoI7QnVKLoILlm2JF9pnVHrX8qx7AHMiYWT+NDAA7jChlNgRS4WTLc/fD1lXLmPixluj+3Gg=="],
```
