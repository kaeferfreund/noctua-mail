# Architecture tech-debt roadmap

Read-only survey of `/home/monkey/code/noctua-mail/repo` at `team-inbox` `c1652ec` (22 Oct 2026). No files in that checkout were modified. No install, server, or test suite was run. Sizes are `du` / `wc` on that tree. Line counts are newline counts.

Sibling worktrees already moving `package.json` (not merged here): `chore/deps-update` (sets `packageManager` to `bun@1.4.4`, moves `shadcn` to devDependencies, bumps `@tauri-apps/cli`), `chore/deps-radix` (pins `radix-ui@1.8.1`, themes stays 3.3.0), `chore/deps-html-parsers`, `chore/deps-lexical`, `chore/deps-fullcalendar`. Numbers below are the `c1652ec` tree unless a sibling brief is named.

In-flight overlap was taken from each branch's own commits, not from a two-dot diff against `c1652ec`. All three backend branches fork from `11c322b`, which is before the ui-shell merge, so `c1652ec..branch` looks like it deletes the shell. It does not. Those branches never edited the shell files.

| Branch | Own range | Own commits | Files that range touches |
| --- | --- | --- | --- |
| `feat/team-auth` @ `8ff60ed` | `11c322b..feat/team-auth` | 5 | 146. Almost all `app/api/**`, `lib/auth*`, `lib/db/**`, `lib/secret.ts`, `lib/credentials.ts` (deleted), `lib/data.ts`, `lib/db.ts`, `instrumentation.ts`, `package.json`, `bun.lock`, `README.md`, `doc/AUTHENTICATION.md`, `doc/DEPLOYMENT.md`, `app/components/auth/LoginOverlay.tsx` |
| `feat/thread-collaboration` @ `beb8dd5` | `ad6db7a..tip` (stacked on team-auth at `ad6db7a`, two auth commits behind) | 3 | 55. Collab routes, `lib/threadCollab.ts`, `lib/db/threadCollab.ts`, `lib/db/schema.ts`, `lib/db/messages/query.ts`, `lib/db/messages/upsert.ts`, `lib/mcpServer.ts`, `lib/data.ts`, `lib/drafts.ts`, `lib/specialFolders.ts`, `lib/serverDb.ts`, `doc/API.md`, `doc/TEAM-INBOX.md` |
| `feat/mailbox-watcher` @ `9ab5eb4` | `11c322b..tip` | 3 | 41. `lib/mailboxWatcher.ts`, sync admission, `lib/mail/imap/sync.ts`, `lib/mail/imap/idle.ts`, `lib/syncJobs.ts`, `lib/syncOperation.ts`, `lib/db.ts`, `lib/db/schema.ts`, `lib/serverDb.ts`, `lib/specialFolders.ts`, `instrumentation.ts`, `doc/DEPLOYMENT.md`, `app/api/accounts/[accountId]/imap/stream/route.ts` |
| `feat/compact-list-toolbar` | committed tip `bff923c` is an ancestor of `team-inbox` (0 unique commits, 6 behind). Live work is uncommitted in `/home/monkey/code/noctua-mail/wt-compact-toolbar` | dirty tree | `MailClient.tsx`, message list, message view, `TooltipIconButton.tsx`, `app/message/window/page.tsx`, shell DOM test, `doc/TEAM-INBOX.md`, plus new toolbar files listed in §10 |

Files edited by more than one open branch (do not touch):

- `package.json`, `bun.lock`, `types/bun-sqlite.d.ts` — team-auth, and the deps worktrees
- `lib/db.ts`, `lib/db/schema.ts`, `lib/serverDb.ts` — team-auth and watcher; schema and `serverDb` also collab
- `instrumentation.ts`, `doc/DEPLOYMENT.md`, `lib/teamFeatures.ts`, `lib/db/accounts.ts`, `app/api/accounts/[accountId]/imap/stream/route.ts` — team-auth and watcher
- `lib/data.ts`, `lib/db/connection.ts`, `lib/mcpServer.ts`, and the send/draft/thread routes — team-auth and collab
- `lib/specialFolders.ts` — watcher and collab
- `doc/TEAM-INBOX.md` — collab and the compact worktree

ui-shell is already in `c1652ec`. The only files both ui-shell and team-auth change are `package.json`, `bun.lock`, and `types/bun-sqlite.d.ts`. Watcher's own commits share no files with the ui-shell merge. A watcher merge should keep the shell.

## Ranked roadmap

Effort is S (hours), M (a day or two), L (several days, many files). Benefit is for a two-person tailnet client: less to load, less to maintain, fewer footguns.

### 1. Drop Tauri and the desktop client branches that team-auth leaves behind

**Evidence.** Desktop mode is rejected by design (TEAM-INBOX D15, §8.2) and is still present on `c1652ec`.

team-auth already does the behavioral half. Do not redo it:

- `lib/secret.ts` drops `shouldStorePasswordInDb` / `shouldIncludeSessionCredentials` and rejects `IMAP_CREDENTIALS_STORAGE=cookie` (`both` stays a deprecated alias of `db`). `lib/credentials.ts` is deleted. `lib/auth.ts` loses the sealed `noctua_session` credential overlay (421 lines rewritten).
- `lib/betterAuth.ts` throws if `NOCTUA_DESKTOP_MODE=true`.
- `app/api/desktop/needs-setup/route.ts` and `storage-info/route.ts` become a 410 `desktop_unsupported` stub. team-auth does not delete the files.
- `app/components/auth/LoginOverlay.tsx` loses `useIsDesktop` and the invite-skip (43 lines removed). That file is in the team-auth diff.

team-auth does not touch `src-tauri/`, `build-scripts/build-desktop.sh`, `doc/DESKTOP.md`, `lib/desktop.ts`, `lib/ui/openDetachedWindow.ts`, `lib/ui/windowTitle.ts`, `app/components/account-settings/tabs/AdminTabContent.tsx`, or the `desktop:*` scripts. `package.json` on that branch still has `desktop:dev-server`, `desktop:dev`, `desktop:build`, and `@tauri-apps/cli`. `src-tauri/src/main.rs` still sets `NOCTUA_DESKTOP_MODE=true`.

Current call sites of desktop detection (hit counts from search):

| File | Hits | Still needed after team-auth merges |
| --- | --- | --- |
| `src-tauri/src/main.rs` | 1 | no |
| `build-scripts/build-desktop.sh` | 8 | no |
| `doc/DESKTOP.md` | 4 | no |
| `package.json` | 2 (`desktop:*` script plus `@tauri-apps/cli`) | no, but the file is hot |
| `lib/desktop.ts` | 6 | only while LoginOverlay on this branch still imports it |
| `app/components/auth/LoginOverlay.tsx` | 4 | team-auth removes them |
| `app/components/account-settings/tabs/AdminTabContent.tsx` | 2 | yes, it still `fetch`es `/api/desktop/storage-info` |
| `lib/ui/openDetachedWindow.ts` | 4 | yes, Tauri window branch |
| `lib/ui/windowTitle.ts` | 3 | yes, Tauri title branch |
| `app/api/desktop/*/route.ts` | 1 each | team-auth stubs them; delete after that lands |
| `tsconfig.json`, `eslint.config.mjs`, `bunfig.toml`, `bunfig.dom.toml` | ignore `src-tauri` | harmless leftovers |

`src-tauri/` is 924K, 58 files. `node_modules/@tauri-apps` is 31M (the CLI). That is the largest install saving in this survey.

On `c1652ec`, `GET /api/desktop/storage-info` has no session check. When `NOCTUA_DESKTOP_MODE=true` it returns `dataDir`, `dbPath`, `attachmentsDir`, and `sourcesDir`. `needs-setup` returns whether any user exists. team-auth's 410 stub closes both. Deleting the routes after that merge is the leftover.

**Benefit.** Install size (31M CLI + 924K tree). One less startup mode. Removes an unauthenticated path disclosure that team-auth only stubs.

**Effort.** S. **Risk.** Low if LoginOverlay and `package.json` are left to team-auth. `openDetachedWindow` must keep the browser `window.open` path; MailClient calls it at `handleOpenInNewWindow` (~line 5002).

**Overlap.** LoginOverlay, the two desktop routes, `package.json`, `bun.lock` are team-auth. `chore/deps-update` bumps `@tauri-apps/cli` to ^2.12.4; that bump is wasted if the CLI is removed. AdminTab, `lib/desktop.ts`, `lib/ui/openDetachedWindow.ts`, `lib/ui/windowTitle.ts`, `src-tauri/`, `doc/DESKTOP.md`, and `build-scripts/build-desktop.sh` are in nobody's diff.

**Timing.** Delete the Tauri tree and the doc/script now (§10). Strip AdminTab's desktop panel and the Tauri branches in `openDetachedWindow` / `windowTitle` now. Delete `lib/desktop.ts`, the desktop routes, and the `package.json` scripts in the same change that merges team-auth, because LoginOverlay and `package.json` are theirs.

### 2. Keep upstream Docker CI, and stop it running on the fork

**Evidence.** `.github/workflows/build-and-push.yml` (push to `main`, PRs to `main`) builds a GHCR image, runs `test:ci`, `test:stress`, and `test:docker-workers`. `deploy-dev.yml` SSHes to a VPS after that workflow. `deploy-prod.yml` is `workflow_dispatch` only and SSHes the same way. `Dockerfile` is a Bun 1.3.12 standalone image (`oven/bun:1.3.12-debian`, port 3654, user `noctua`). `deploy-scripts/deploy-instance.sh` and `container-entrypoint.sh` are the SSH/container side. `build-scripts/verifyDockerWorkerImage.ts` is `test:docker-workers`. `next.config.ts` sets `output: 'standalone'` and `outputFileTracingIncludes` so worker subprocesses can see `scripts/` and `sanitize-html` inside the standalone trace.

None of these paths are in the team-auth, collab, or watcher diffs. The fork's deploy target is one systemd process (D15), not this pipeline.

Deleting them makes every upstream PR carry a fork-only deletion, or forces the files to be re-added when a change is contributed back. The workflows already trigger only for `main`. On the fork, a push to the fork's `main` would still build and, if GHCR/VPS secrets exist, deploy.

**Benefit.** The fork cannot push an image or SSH somewhere by accident. Upstream PRs stay possible: the files remain, and a repository guard is a no-op in `paulwellnerbou/noctua-mail`.

**Effort.** S. **Risk.** Low. A guard that checks `github.repository == 'paulwellnerbou/noctua-mail'` on all three workflows is the whole change. Leave `Dockerfile`, `deploy-scripts/`, and `verifyDockerWorkerImage.ts` byte-for-byte so upstream diffs stay empty.

**Overlap.** None of the named branches. `package.json`'s `test:docker-workers` script is hot because team-auth edits `package.json`; leave the script.

**Timing.** Now. See §10.

`output: 'standalone'` can stay until the systemd unit is chosen. `next start` from a checkout does not need the trace. A prior build on this machine (`briefs/deps-html-parsers.md`) showed Next inferring the workspace root from `/home/monkey/package-lock.json` and writing the standalone tree under `.next/standalone/code/noctua-mail/...`, while `build-scripts/verifyStandaloneWorkerBuild.ts` looks only at `.next/standalone/scripts`. That check fails on this machine even when the traced files exist. Fix the checker or `outputFileTracingRoot` when the deploy shape is decided, not as a drive-by. `next.config.ts` is not in the in-flight diffs, so it is editable, and it is coupled to how workers are launched (`lib/workers/`, which watcher does edit).

### 3. Remove Radix Themes in phases, after the open UI work lands

**Evidence.** Two stacks are loaded together, on purpose (D10): shadcn + Tailwind v4 for the shell, `@radix-ui/themes` for everything the shell has not replaced.

- 95 production files import `@radix-ui/themes`, plus 4 tests (`app/globals.test.ts`, `Shell.dom.test.tsx`, `MobileFrames.dom.test.tsx`, `sendMailRace.dom.test.tsx`).
- shadcn primitives live in 26 files under `app/components/ui/`. 20 files outside that folder import them. The shell uses them. The mail surfaces mostly do not.
- `app/globals.css` is 1,579 lines / 33,129 bytes. `@layer legacy` starts at line 250 and is 1,330 lines / ~24KB. Line 10 is `@import "@radix-ui/themes/styles.css" layer(radix);`.
- 53 CSS modules, 91,975 bytes. 32 are under `app/components/mailclient/`, 10 under `calendar/`. `MessageListPane` chrome stays in CSS modules because those unlayered rules beat utilities (design §7.2).

Components imported from `@radix-ui/themes` in production files (import-site counts):

| Component | Sites | Component | Sites |
| --- | --- | --- | --- |
| Text | 54 | Callout, Grid, Switch, Heading, Box | 5 each |
| Flex | 44 | Tabs | 4 |
| Button | 41 | TextArea, Popover, Checkbox | 3 each |
| Badge | 23 | IconButton, SegmentedControl | 2 each |
| TextField | 18 | Tooltip, HoverCard, Separator | 1 each |
| Dialog | 14 | | |
| Card | 13 | | |
| Select | 12 | | |
| AlertDialog | 9 | | |
| Theme, DropdownMenu | 8 each | | |

By area: mailclient 49 files, calendar 17, account-settings 15, compose/lexical/PasswordField/TooltipIconButton 4, shell Theme wrappers 4 (`ShellSidebar`, `ShellPanes`, `SettingsFrame`, `StatusPanelFrame`), detached windows 3 (`app/compose/window`, `app/message/window`, `app/calendar/window` plus `message/window/loading.tsx`), `app/layout.tsx`, `LoginOverlay`, `lib/ui/badgeColors.ts` (type-only `BadgeProps`).

**What removal saves.**

| Item | Disk | Shipped to the browser |
| --- | --- | --- |
| `@radix-ui/themes` | 9.3M (`styles.css` 812,667 bytes; gzip 88,222; all ESM JS together 132,524 bytes unminified) | The CSS is global, so the full 88KB gzip is on every page. JS tree-shakes; the whole themes ESM is only 132KB before minify, so the JS win is smaller than the CSS win |
| `@radix-ui/colors` | 1.0M | No app import. It leaves with themes |
| `@radix-ui/react-icons` | 4.6M | 11 named-icon imports. Runtime cost is those icons. `lucide-react` is already imported from 75 files |
| `node_modules/@radix-ui` | 13M total | Includes themes, icons, colors, and the primitives |
| `node_modules/radix-ui` | 232K meta package | Stays. shadcn `app/components/ui/*` imports `radix-ui` |
| `node_modules/@radix-ui/react-*` | the rest of the 13M | Stays. `radix-ui@1.4.3` depends on them. Themes 3.3.0 also depends on `radix-ui`, not on a private primitive copy |

Do not plan to delete `@radix-ui/react-*`. The lean-out is themes CSS, the colors package, and (once the 11 icons move to lucide) `react-icons`.

`chore/deps-radix` rebases the primitives onto one `radix-ui@1.8.1` and leaves themes at 3.3.0. That is a duplicate-copy fix, not this removal. Land it or leave it; it does not shrink `styles.css`.

**Phasing.** Design §7.1 keeps `<Theme>` until the kept components are gone, and shell portals wrap kept components in `<Theme asChild>`. Removing the provider before the call sites breaks every Radix Themes dialog.

1. After compact-list-toolbar has merged: calendar (17 files), detached window pages that only use `Text`, `PasswordField`, `QuotedMessageNode`, `lib/ui/badgeColors.ts`. These are outside the compact dirty set. Calendar is not owned by a named in-flight branch. Swap Themes widgets for the existing `app/components/ui/*` pieces (`button`, `dialog`, `select`, `switch`, `tabs`, `badge`, `card`, `dropdown-menu`, `popover`, `textarea`, `input`). `SegmentedControl`, `Callout`, `HoverCard`, `IconButton`, and `Text`/`Flex`/`Grid`/`Box`/`Heading` have no shadcn twin yet; those become plain elements plus utilities, or a tiny local component. Do this per folder, with the DOM tests that already mount `Theme` (`Shell.dom.test.tsx` is in the compact dirty set; leave it until that branch lands).
2. After compact-list-toolbar, and before `feat/collab-ui` starts rewriting rows: the 49 mailclient files. Compact currently owns the list and the reading pane (exact list in §10). Collab-ui, which does not exist as a branch yet, will own list row components, `MessageViewOrchestrator` header, and the `collab` prop bag in MailClient (design §9). Finish compact, then either fold the Themes swap into collab-ui's row work or do it immediately before that branch is cut.
3. Settings and admin tabs wait for `feat/collab-ui`. Design §9 gives that branch Preferences, Admin, and Members tab contents. Rewriting `app/components/account-settings/**` now will be rewritten again. `LoginOverlay` waits for team-auth.
4. Last: delete the `@import` of `styles.css`, the `.radix-themes` bridge in `globals.css` (around lines 203–213), `<Theme>` in `app/layout.tsx`, and the four shell `Theme` wrappers. Then remove the `@radix-ui/themes` dependency. `@layer legacy` (1,330 lines) shrinks only as the CSS-module selectors that depend on it go away. Preflight stays off until the editor and markdown surfaces have moved (D10).

**Benefit.** ~88KB gzip of CSS on every load, ~10MB install, and one component vocabulary. Maintainability is the larger win: 95 files stop speaking Themes props (`gap`, `size="2"`, `color="gray"`).

**Effort.** L, split as S/M per folder. **Risk.** Medium. Themes dialogs, dropdowns, and the z-index ladder in design §7.1 (calendar 9990, shadcn overlay 9994, Themes dialog overlay 9995, popper 9998) are easy to regress. `app/globals.test.ts` asserts `.rt-BaseDialogOverlay { z-index: 9995 }` survives. Portal containers use `document.querySelector(".radix-themes")`. Each phase needs the existing DOM tests plus a click-through of the dialogs in that folder.

**Overlap.** Compact dirty files in §10. team-auth owns `LoginOverlay.tsx`. Watcher and collab do not edit `app/components/**`. Future `feat/collab-ui` owns settings tabs and list rows.

**Timing.** Not now. Phase 1 can start the day compact merges. Phase 4 is after the last Themes import is gone, including `badgeColors.ts`.

### 4. Split `MailClient.tsx` after the UI branches land

**Evidence.** `app/components/MailClient.tsx` is 6,021 lines. The JSX `return (` of the component is at line 5292, so about 730 lines are render and about 4,900 lines are state, effects, and handlers inside the function. Counts inside the component: 19 `useState`, 38 `useEffect`, 78 `useCallback`, 62 `useMemo`, 13 `useRef`.

State still declared here, grouped by domain:

- Session: `authState`, `currentUser`, `initialDataReady` (around 620–626). `LoginOverlay` is still mounted at line 5235. team-auth rewrites the server and LoginOverlay's desktop branch; it does not replace this client session.
- Accounts and folders: `accounts`, `folders`, `activeAccountId`, `activeFolderId`, then `useAccountController` at 1678 (account/folder CRUD, initial load).
- List: `sortKey`, `sortDir`, `groupBy`, `messageSort`, `threadDateSource`, `threadsMode`, `listWidth`, `omitBody`, `includeSentInEverywhere`, selection shims over `listHandleRef` (comment at 562: selection moved into `MessageListOrchestrator`).
- Reading pane: `activeMessageId`, `viewMessage`, `relatedContext`, thread jump refs. `useThreadContent` at 1487. Two large effects still sit in MailClient: thread-related load ~4223–4349 (127 lines) and thread content load ~4351–4526 (176 lines).
- Topics: eight state variables at 365–376, handlers ~2016–2419, three effects ~2279–2352.
- Sync and repair: `useSyncController` at 821 (the hook file is 1,437 lines). MailClient still has the initial-sync effect ~4111–4186 (76 lines), CalDAV periodic sync ~4189–4221, and empty-folder auto-repair ~5091–5134.
- Compose mirror: `composeMirror`, `draftSavedAt` (636–668). The orchestrator owns the draft; MailClient keeps a mirror for layout and the relative-time tick (effect at 1048).
- Chrome: `manageOpen` / `manageTab` / `editingAccount` / relogin, `calendarSidebarOpen`, `query`, drag state, notice offset, service-worker effects ~3956–4107, keyboard effect ~3710–3869 (160 lines), detached-window `storage` events ~5035–5088.

Hooks already extracted under `app/components/mailclient/` (line counts):

| Hook | Lines | Hook | Lines |
| --- | --- | --- | --- |
| `useSyncController.ts` | 1437 | `useMessageMutations.ts` | 773 |
| `useMessageDeleteActions.ts` | 812 | `useReminderNotifications.ts` | 506 |
| `useAccountController.ts` | 486 | `useMessageMoveActions.ts` | 478 |
| `useDraftManager.ts` | 411 | `useThreadContent.ts` | 414 |
| `useMessageData.ts` | 391 | `useComposeHandlers.ts` | 364 |
| `useSearchState.ts` | 287 | `useComposeTranslation.ts` | 292 |
| `useComposeController.ts` | 251 | `useComposeState.ts` | 212 |
| `useComposeDraftAutoSave.ts` | 214 | `dialogs/useConfirmDialogs.ts` | 178 |
| `messagelist/useMessageListSelectionController.ts` | 193 | `useComposeViewEffects.ts` | 114 |
| `useTopics.ts` | 88 | `useMessageDragDrop.ts` | 82 |
| `useRecipientAliases.ts` | 73 | `useInAppNotices.ts` | 50 |
| `messagelist/useThreadListAnimationState.ts` | 68 | `messagelist/useMessageListItems.ts` | 64 |

Move/delete/flag mutations already run inside `MessageListOrchestrator` (comment at 3267). MailClient keeps shims through `listHandleRef`. Compose state already lives in `ComposeOrchestrator.tsx` (1,518 lines) behind `composeHandleRef`.

**Safe next cuts,** each a hook next to the existing ones, each leaving MailClient's props to the shell unchanged (design §7.2: MailClient keeps data and handlers; the shell owns layout):

1. `useTopicController` — state at 365–376, handlers 2016–2419, effects 2279–2352. `useTopics.ts` is only 88 lines and is the API wrapper; the picker and suggestion effects are the rest.
2. `useMailClientHotkeys` — the 160-line effect at 3710. Pure input.
3. `useServiceWorkerBridge` — effects 3956–4107 (registration, push, session TTL). No list rendering.
4. Fold the initial-sync effect (4111) and auto-repair effect (5091) into `useSyncController` rather than a fourth sync owner. That hook is already 1,437 lines, so the fold should land as a sibling module `useSyncController` imports, not as more lines in the same file.
5. Move the thread-related and thread-content effects (4223–4587, ~300 lines) into `useThreadContent`.
6. Leave auth state (`authState`, `currentUser`, `LoginOverlay`) until the Better Auth client is wired. Extracting it now fights team-auth's session model.

Do not introduce one MailClient context. The existing hooks already take large parameter bags; a context per domain (topics, sync) is justified only when a bag is passed through three components. A single reducer for all of MailClient would mix sync, topics, and selection and be harder to review than another hook.

**Benefit.** Maintainability. The file is the review bottleneck for every UI change. No measurable bundle or runtime win: it is one client component either way.

**Effort.** L as a whole, S or M per cut above. **Risk.** Medium. The effects share refs (`refreshMailboxDataRef`, `listHandleRef`, `syncStateRef`) and several comments mark stability as load-bearing ("CRITICAL: This IS passed to useMessageListDerivedState"). Move one effect at a time and keep the DOM tests (`Shell.dom.test.tsx`, `MobileFrames.dom.test.tsx`, `sendMailRace.dom.test.tsx`) green.

**Overlap.** Compact's uncommitted diff edits `MailClient.tsx`. Watcher does not. team-auth does not. collab does not. Do the split after compact has rebased onto `team-inbox` and merged. Auth extraction waits for the Better Auth client.

**Timing.** After compact-list-toolbar. Not now.

### 5. Keep both editors. The markdown tab is live, and outbound mail reads the preview CSS

**Evidence.** Compose has three formats (`ComposeTab = "text" | "html" | "markdown"` in `composeTypes.ts`).

- HTML is Lexical: `app/components/ComposeEditor.tsx` (1,132 lines), dynamically imported from `ComposeMessageField.tsx`. `@lexical/markdown`'s `TRANSFORMERS` is imported there (line 62) for Lexical's own markdown shortcuts. That is not a second markdown editor.
- Markdown is `@uiw/react-md-editor`: `ComposeMarkdownEditor.tsx` (dynamic `import("@uiw/react-md-editor")`). `ComposeMessageField.tsx` has `<Tabs.Trigger value="markdown">` near line 390 and renders `<ComposeMarkdownEditor>` when `composeTab === "markdown"` near line 599.
- Drafts round-trip the format. `composeInitState.ts` restores `xComposeFormat: "markdown"` into `composeTab` and `composeMarkdown`. Tests in `composeInitState.test.ts` and `composeContentBuilder.test.ts` cover that path.

So the markdown editor is reachable from the compose tabs, and stored drafts depend on it. Removing it is a product cut plus a draft migration, not dead-code deletion.

Disk: `node_modules/@uiw` is 8.9M (`react-md-editor` 5.0M, `react-markdown-preview` 3.8M). Lexical is `lexical` 1.7M plus `node_modules/@lexical` 5.6M. `@lexical/yjs` (356K) and `@lexical/devtools-core` (120K) are on disk; this survey did not find app imports of either. Confirm before pruning those two packages. They are transitive of `@lexical/react` more often than direct.

Three markdown renderers, and the split is documented in `lib/markdownConvert.ts` lines 11–86:

| Path | Used for | Allows raw HTML |
| --- | --- | --- |
| `markdownToHtml` (unified + remark-parse + remark-gfm + remark-breaks + remark-rehype + rehype-raw + rehype-stringify) | Tab switch and, via `lib/markdownEmail.ts`, the outbound HTML part | Yes, on purpose, so the author can embed HTML |
| `MarkdownPanel.tsx` (`react-markdown` + remark-gfm + remark-breaks, no rehype-raw) | Received-mail markdown view | No |
| `@uiw/react-md-editor` preview | The compose tab | The editor's own preview |

`lib/markdownEmail.ts` reads `node_modules/@uiw/react-markdown-preview/dist/markdown.min.css` at runtime with `readFileSync` and inlines it into outbound mail. Dropping the compose tab does not drop the `@uiw` package. The package is on the server send path.

`htmlToMarkdown` uses turndown, with one custom rule for the forward-meta table. `html-to-text` (IMAP preview) and `stripHtmlToText` (client compose) are a separate pair, also documented in that file. rehype still pins parse5 7 under `hast-util-from-html` / `hast-util-raw` (`briefs/deps-html-parsers.md`), so a second parse5 stays as long as the unified pipeline stays.

**Benefit of leaving it.** Drafts, sent HTML, and the received view keep one parser stack (remark-gfm + remark-breaks). The file header is the contract.

**Benefit of a future cut.** ~8.9M install and one client chunk, only if outbound mail stops inlining `@uiw` CSS (replace with a small checked-in stylesheet) and existing `xComposeFormat=markdown` drafts still open. Lexical can edit markdown through `@lexical/markdown`, which is already a dependency. That is an L rewrite of compose tabs, draft restore, and the send CSS, for a two-person client that already has the feature.

**Effort.** S to decide to keep. L to collapse. **Risk.** High for a collapse (drafts, outbound CSS, the rehype-raw difference). Low for keeping.

**Overlap.** `ComposeMessageField.tsx`, `ComposeEditor.tsx`, and `ComposeOrchestrator.tsx` are not in the compact dirty set. `sendMailRace.dom.test.tsx` is. `chore/deps-lexical` and `chore/deps-update` (bumps `@uiw/react-md-editor` to ^4.1.3) touch the packages. Collab owns `lib/drafts.ts` and the send route.

**Timing.** No editor removal in this round. If install size becomes the goal, replace the runtime CSS read in `markdownEmail.ts` first and only then consider dropping `@uiw`. Do not enable `rehype-raw` on `MarkdownPanel`; received mail is the untrusted side.

### 6. Leave the `lib/db.ts` barrel and its wrappers

**Evidence.** `lib/db.ts` is 404 lines. It re-exports 12 modules (`connection`, `messages`, `topics`, `accounts`, `mcpTokens`, `inviteCodes`, `folders`, `threads`, `calendar`, `categories`, `translations`, `users`). 27 exports are concrete wrappers instead of `export { x } from`:

- `updateMessageFolder` and `relocateMovedMessage` (lines 72–87), because Bun `mock.module("@/lib/db")` mutates the target namespace's live bindings and `mock.restore()` does not undo that. A plain re-export aliases the implementation binding, so a mock leaks into sibling modules.
- 25 calendar functions (lines 255–403), same reason, listed in the comment at 213–226.

Every other export is a re-export. A search found no `from "@/lib/db/..."` imports outside the barrel, so the eslint rule is holding.

`eslint.config.mjs` rules, all real boundaries rather than style:

1. `lib/db.ts` and `lib/db/**` cannot import `app/**`.
2. `lib/db/messages/**` cannot import `lib/db/calendar/**`.
3. `lib/db/calendar/**` can import only `messages/_shared` from the messages tree.
4. Everyone else imports `@/lib/db`, not a subtree path. Route files repeat the rule because flat config replaces `no-restricted-imports` wholesale.
5. `route.ts` cannot import another `route.ts`.

**Runtime cost.** A wrapper does `return impl(...args)`. That allocates one array per call and adds one call. The wrapped names include move and calendar write paths; the cost is noise next to SQLite. Importing the barrel evaluates its static dependencies (the 12 modules). That is a module-init fan-in, paid once per process when any symbol is imported, not once per call. Route handlers already pay it because they are required to use the barrel. Splitting the barrel would not speed a request that needs messages, and it would break the mock seam the comment describes.

**Benefit of keeping it.** Tests can `mock.module("@/lib/db")` (8 test files do) without poisoning `./db/messages` and `./db/calendar`. The boundary rules are what keep a 1,225-line `schema.ts` and a 2,868-line `query.ts` from importing React.

**Effort.** S to add a wrapper the next time a test mocks a new symbol. L, and a bad trade, to remove the barrel. **Risk.** High if removed while watcher, team-auth, and collab are all editing it.

**Overlap.** team-auth and watcher both edit `lib/db.ts`. Collab edits `lib/db/schema.ts` and `lib/db/messages/query.ts`. Design §9 already calls `lib/db.ts` and `lib/data.ts` known trivial conflicts.

**Timing.** Add wrappers only when a new mock needs one. No cleanup pass during these branches.

### 7. Test suite: keep it serial, isolate mocks, do not add `--concurrent`

Report only. Nothing here should be changed while three branches are adding tests.

**Evidence.** 204 test files, 8 of them `*.dom.test.tsx`. A file walk counted ~35,475 lines in test files. Sibling runs on this commit plus dependency bumps (`briefs/deps-radix.md`, `briefs/deps-html-parsers.md`) report 1,698 unit passes in 196 files (~5–6.5s) and 48 DOM passes in 8 files (~12–14s). `doc/DEV-FIXTURES.md` reports an earlier 1,677 + 12 on Bun 1.4.4. This survey did not re-run the suite.

Scripts in `package.json`:

- `test` and `test:ci` are the same: `bun test --timeout 20000` then `bun run test:dom`.
- `test:dom` is `bun test --config=bunfig.dom.toml dom.test`. `bunfig.toml` preloads `lib/testSetupEnv.ts` and ignores `**/*.dom.test.tsx`. `bunfig.dom.toml` preloads `lib/testSetupDom.ts` (happy-dom). The split exists because happy-dom makes `typeof window` true and server modules take their browser branch. Keep the split.
- `test:stress` is `bun test --timeout 20000 --randomize --seed=1337 --rerun-each=3`. It does not include the DOM config. It triples file runtime. `build-and-push.yml` runs `test:ci` and `test:stress` and `test:docker-workers` on every `main` push. `AGENTS.md` asks for stress on mock-sensitive changes, not on every edit.
- `lib/testSetupEnv.ts` seeds `IMAP_SECRET_KEY` and `IMAP_CREDENTIALS_STORAGE=db` before any test import, because `lib/secret.ts` reads them at module load.

Flake sources already written down in the tree:

- `lib/db.ts` lines 63–70 and 213–222: `mock.module` is process-global and `mock.restore()` does not undo the binding mutation. 15 test files call `mock.module(`.
- `lib/calendarInviteProcessor.test.ts` (~lines 56–110): load order under `--randomize` changes which file installs the mock.
- `lib/mail/imap/connectionPool.test.ts`: mocks leak across files in a stress run.
- `lib/syncJobs.test.ts` and `app/components/mailclient/utils/calendarReminders.test.ts`: `--rerun-each` replays a file in the same process, so SQLite rows and account ids must be unique per test.

Bun 1.4.4 on this machine (`bun test --help`) supports:

- `--concurrent` — treat every test as `test.concurrent()`. `--max-concurrency` defaults to 20.
- `--parallel=N` — one worker process per N, implies `--isolate` (fresh global per file). `--no-isolate` keeps one global per worker and is the faster, leakier mode.
- `--shard=i/n` and `--timings` to balance shards by measured file time.

**What would help, later, on a runner that is not sharing 6 cores with other agents.**

- `--parallel` with a small N and the default isolate gives each file a fresh global, which is the actual fix for the mock leakage the comments describe. It costs process startup. Measure with `--timings` before changing `test:ci`. Unit time is already ~6s; the DOM half is ~13s and must stay a second command.
- `--shard` pays off with more than one machine. This fork has one box.
- `--concurrent` runs tests inside a file at the same time. The files that needed `--rerun-each` notes share SQLite and module mocks. Turning it on for the whole suite is how to manufacture the flakes the maintainers already see under load.

**Benefit.** A later `--parallel` run could cut wall time and would make mock leaks fail in the file that caused them. **Risk.** High if applied as a default on the shared machine, and high for `--concurrent`.

**Timing.** After team-auth, collab, and watcher have added their suites. Change the script then, with one timings file checked in. Not now.

### 8. Build and package hygiene (small, mostly blocked on `package.json`)

**`bun --bun`.** `dev` and `start` run `bun --bun build-scripts/generateRuntimeConfig.ts` and then `bun --bun next`. `build` runs `generateBuildVersion.ts` and `bun --bun next build`. That flag is what keeps the Next server on Bun (and `bun:sqlite` working). Keep it.

**`generateRuntimeConfig.ts`.** Writes `public/runtime-config.js`, which assigns `window.__NOCTUA_RUNTIME_CONFIG__.appEnvironmentLabel` from `APP_ENV_LABEL` or `ENV_FILE`. The file is gitignored (`.gitignore` line 37). The payload is a label, not a secret. It runs on `dev` and `start`, not on `build`, so a systemd `next start` refreshes it. Fine.

**`generateBuildVersion.ts`.** Writes the build-version JSON consumed by `GET /api/version` (`force-dynamic`) so open clients can prompt a reload. Keep it.

**`cn` versus clsx + tailwind-merge.** Already decided, and already the smaller option. `lib/utils.ts` re-exports `cn` from the `cn` package. All 26 `app/components/ui/*` files import `cn` from `"cn"` directly. `node_modules/cn` is 536K and describes itself as a compiled drop-in for clsx + tailwind-merge. `tailwind-merge` is not installed. `clsx` is present as a transitive. `chore/deps-update` left `cn` as a dependency. There is nothing to switch.

**`postcss` as a dependency.** `postcss` (^8.5.31, 352K), `tailwindcss`, and `@tailwindcss/postcss` are `dependencies`. `postcss.config.mjs` only registers `@tailwindcss/postcss`. Production `next start` does not run PostCSS. They are build tools. Moving them to devDependencies is safe for `bun run build` and for the Docker builder (it installs devDependencies). `shadcn` is imported only as CSS (`@import "shadcn/tailwind.css"` in `globals.css`); no TS file imports the package. `chore/deps-update` already moves `shadcn` to devDependencies. Follow that for `postcss`, `tailwindcss`, and `@tailwindcss/postcss` when `package.json` is free. Benefit is a smaller production install, not a smaller client bundle.

**`overrides` for typescript-eslint 8.59.** Still justified on this tree. `eslint-config-next@16.2.4` depends on `typescript-eslint: ^8.46.0`. The installed `typescript-eslint@8.59.0` (forced by the override) declares `typescript: >=4.8.4 <6.1.0`, which matches the repo's TypeScript `^6.0.3`. A bare `^8.46.0` can resolve to a release that does not parse TypeScript 6. Keep the override until `eslint-config-next` floors a 6-capable typescript-eslint. When TypeScript moves to 6.1, 8.59's peer (`<6.1.0`) will refuse it and the override has to move with it. The override lists every `@typescript-eslint/*` package so a transitive pin cannot mix versions.

**`tsconfig.json` `target` ES2022, `lib` es2022.** No browserslist. Next compiles the client with SWC on its own target. Bun executes TypeScript itself and does not emit from `tsc` (`noEmit: true`). Raising `target` / `lib` to ES2023 or ES2024 would allow newer standard-library types (`Promise.withResolvers`, `Object.groupBy`, `Set` methods) in `tsc --noEmit`. It would not shrink the client bundle. `tsconfig.json` is not in any in-flight diff. Low value, safe, optional.

**`packageManager`.** This commit says `bun@1.3.12`. The machine running the survey is Bun 1.4.4. `Dockerfile` pins `oven/bun:1.3.12-debian`. `chore/deps-update` already sets `packageManager` to `bun@1.4.4`. Take that from the deps branch rather than editing it again. Leave the Docker pin until item 2's "keep the Dockerfile" decision is revisited; the systemd host is the one that should match 1.4.4.

**Overlap.** All of the `package.json` items wait. `tsconfig.json` can change any time and is not worth a branch by itself.

### 9. Other oversized modules, duplicated helpers, and security leftovers

**15 largest files** (newline counts, tests included, `node_modules` / `.next` / `src-tauri` excluded):

| Lines | File | Who is in it now |
| --- | --- | --- |
| 6021 | `app/components/MailClient.tsx` | compact worktree |
| 2868 | `lib/db/messages/query.ts` | collab |
| 1579 | `app/globals.css` | free, but item 3 owns its future |
| 1518 | `app/components/mailclient/composition/ComposeOrchestrator.tsx` | free of the named diffs; compose behavior is load-bearing |
| 1464 | `lib/mail/imap/sync.ts` | watcher |
| 1437 | `app/components/mailclient/useSyncController.ts` | free file; MailClient call site is in the compact diff |
| 1405 | `lib/calendarInviteProcessor.test.ts` | free |
| 1371 | `lib/topicSuggestions.test.ts` | free |
| 1225 | `lib/db/schema.ts` | team-auth, collab, and watcher |
| 1187 | `lib/mcpServer.ts` | collab (and team-auth owns the auth-binding lines, design §9) |
| 1132 | `app/components/ComposeEditor.tsx` | `chore/deps-lexical` |
| 1082 | `app/api/mcp/route.test.ts` | collab |
| 1074 | `app/components/mailclient/message/ThreadMessageCard.tsx` | compact worktree |
| 934 | `lib/syncOperation.ts` | watcher |
| 918 | `app/components/mailclient/utils/calendarReminders.ts` | free |

Next cuts after the owners land, in that order: `query.ts` (split by read family: list, thread, search), `useSyncController.ts` (item 4 step 4), `ComposeOrchestrator.tsx` (draft save vs send vs invite), `lib/mail/imap/sync.ts` (watcher should be the one to split it if it is still 1,464 lines after the merge), `schema.ts` only when all three backend branches have merged. `mcpServer.ts` waits for collab.

`schema.ts` is the hottest file in the repo: three branches append tables to it. A split into `schema.master.ts` / `schema.account.ts` matches the design's master-vs-shard split and will conflict with every one of those branches. Do it once, after they merge.

**Duplication that is already intentional.** The conversion table in `lib/markdownConvert.ts` (item 5). `formatRelativeTime` inside MailClient (~line 1148) sits beside `lib/dateFormatting.ts`; a later MailClient split should call the shared helper if the signatures match, and should not get its own date library. Folder special-use checks in MailClient (lines 1240–1243) delegate to `checkIsDraftsFolder` and friends. Good.

**Icon sets.** lucide (75 files), `@radix-ui/react-icons` (11 files: `CaretRightIcon`, `ChevronDownIcon`, `MinusIcon`, `QuestionMarkCircledIcon`), and `react-file-icon` for attachments. Move the 11 icons when the component is touched for item 3. Several of those files are in the compact dirty set (`MessageRow`, `MessageTable`, `MessageGroupRow`, `ThreadMessageCard`). `FolderTreeNode.tsx`, `FolderPickerNode.tsx`, `QuotedMessageNode.tsx`, and `ThreadTopicSuggestionsRow.tsx` are not.

**Security, and what team-auth already closes.** Do not open a second auth cleanup.

- Probe route (`app/api/probe/route.ts`) is an outbound TLS connect to a caller-supplied host:port, rate-limited to 10/minute/IP, and on `c1652ec` it has no session check. team-auth adds `requireActiveUserSession`. Leave it.
- `app/api/calendar/test/route.ts` already requires a session; team-auth only swaps in the new helper. It still lets a signed-in user test an arbitrary CalDAV URL. That is the settings "test connection" button. Acceptable on a tailnet.
- `app/api/accounts/[accountId]/messages/[messageId]/unsubscribe/route.ts` documents a residual `redirect: "follow"` SSRF and is in the team-auth diff. Leave it with that branch.
- Desktop `storage-info` / `needs-setup` path and user-count disclosure: item 1. team-auth's 410 is the fix; deletion is the leftover.
- `dangerouslySetInnerHTML` in `CalendarEventEmailSnapshot.tsx` and `EventDetailDescription.tsx` runs through `sanitizeHtmlForDisplay` + `stripStyleTags` + `enforceSafeLinks`. `MarkdownPanel` does not pass `rehype-raw`. Keep that split (item 5).
- `GET /api/version` is unauthenticated and returns the build label only. Fine.
- `categories/debug` uses `requireAccountContext` and returns the learning snapshot to any member of that mailbox. For two people sharing a mailbox that is the same trust boundary as the mail itself. No separate change.

No further security pass belongs in this roadmap. team-auth is the security change.

## 10. Safe to do now

These paths are in none of the four in-flight diffs (team-auth `11c322b..8ff60ed`, collab `ad6db7a..beb8dd5`, watcher `11c322b..9ab5eb4`, compact dirty tree below). They also are not `package.json`, `bun.lock`, `lib/db.ts`, `lib/db/schema.ts`, `lib/serverDb.ts`, `lib/data.ts`, `instrumentation.ts`, or `doc/TEAM-INBOX.md`.

**Fork CI guard** (item 2). Edit only:

- `.github/workflows/build-and-push.yml`
- `.github/workflows/deploy-dev.yml`
- `.github/workflows/deploy-prod.yml`

Add a repository guard so jobs run for `paulwellnerbou/noctua-mail` and are skipped on the fork. Do not delete the files. Do not edit `Dockerfile`, `deploy-scripts/`, or `build-scripts/verifyDockerWorkerImage.ts`.

**Tauri tree** (item 1), delete:

- `src-tauri/` (whole directory, 58 files, 924K)
- `doc/DESKTOP.md`
- `build-scripts/build-desktop.sh`

Then drop the now-dead ignores, same change:

- `tsconfig.json` exclude entry `"src-tauri"`
- `eslint.config.mjs` `globalIgnores` entry `"src-tauri/"`
- `bunfig.toml` and `bunfig.dom.toml` `pathIgnorePatterns` entry `src-tauri/target/**`

**Desktop behavior that does not touch LoginOverlay or the routes team-auth stubs:**

- `app/components/account-settings/tabs/AdminTabContent.tsx` — remove `useIsDesktop`, the `fetch("/api/desktop/storage-info")` effect, and the desktop copy branch. Leave the TooltipIconButton import alone; compact is editing `app/components/TooltipIconButton.tsx`, and a usage that keeps the same props merges cleanly. If that import's props are in doubt, skip AdminTab until compact merges.
- `lib/ui/openDetachedWindow.ts` — remove the `isDesktop()` / Tauri scheme branch. Keep `window.open`.
- `lib/ui/windowTitle.ts` — remove the `isDesktop()` early return so the browser title path is all that remains.

Do not delete `lib/desktop.ts` in this change. `LoginOverlay.tsx` on `c1652ec` still imports it, and team-auth is the branch that removes that import. Deleting the module now breaks this branch and conflicts with theirs. Do not edit `app/api/desktop/**`. Do not edit `package.json` (the `desktop:*` scripts and `@tauri-apps/cli` stay until team-auth merges; `chore/deps-update` is also editing that file, including a `@tauri-apps/cli` bump that should be dropped rather than taken).

`build-scripts/generate_icons.sh` generates `public/icons` and `app/` icons from an SVG. It is not a Tauri script. Leave it.

**Compact dirty set, do not touch** (status of `wt-compact-toolbar` at survey time):

- `app/components/MailClient.tsx`
- `app/components/TooltipIconButton.tsx`
- `app/components/mailclient/message/MessageMenu.tsx`
- `app/components/mailclient/message/MessageViewOrchestrator.tsx`
- `app/components/mailclient/message/MessageViewPane.module.css`
- `app/components/mailclient/message/MessageViewPane.tsx`
- `app/components/mailclient/message/ThreadMessageCard.module.css`
- `app/components/mailclient/message/ThreadMessageCard.tsx`
- `app/components/mailclient/message/types.ts`
- `app/components/mailclient/messagelist/MessageCardList.module.css`
- `app/components/mailclient/messagelist/MessageCardList.tsx`
- `app/components/mailclient/messagelist/MessageGroupRow.tsx`
- `app/components/mailclient/messagelist/MessageListHeader.module.css`
- `app/components/mailclient/messagelist/MessageListHeader.tsx`
- `app/components/mailclient/messagelist/MessageListRenderer.tsx`
- `app/components/mailclient/messagelist/MessageTable.tsx`
- `app/components/mailclient/messagelist/MessageThreadList.tsx`
- `app/components/mailclient/messagelist/messageListViewTypes.ts`
- `app/components/shell/Shell.dom.test.tsx`
- `app/message/window/page.tsx`
- `doc/TEAM-INBOX.md`
- untracked: `app/components/ToolbarMenuTrigger.tsx`, `ToolbarMenuTrigger.module.css`, `app/components/mailclient/message/MessageDisplayOptionsMenu.tsx` (+ `.module.css`, `.dom.test.tsx`), `MessageHeaderControls.module.css`, `messageMenuPrimitives.ts`, `app/components/mailclient/messagelist/MessageGroupRow.module.css`, `MessageGroupRow.dom.test.tsx`, `MessageListHeader.dom.test.tsx`

## Suggested order

1. Now: §10 (workflow guard, delete `src-tauri` and the two desktop files, strip AdminTab / detached-window desktop branches).
2. When team-auth merges: delete `app/api/desktop/**`, `lib/desktop.ts`, and the `desktop:*` scripts plus `@tauri-apps/cli`. Take `packageManager` bun@1.4.4 and the `shadcn` devDependency move from `chore/deps-update`, and do not take that branch's Tauri CLI bump. Move `postcss`, `tailwindcss`, and `@tailwindcss/postcss` to devDependencies in that same `package.json` edit.
3. When compact-list-toolbar merges: start Radix Themes phase 1 (calendar and the small leaves), then the MailClient hook cuts in item 4. Replace `@radix-ui/react-icons` in the files that phase touches.
4. When watcher and collab have merged: split `query.ts` and, if still huge, `lib/mail/imap/sync.ts`. Revisit `schema.ts` only then.
5. Leave the markdown editor, the db barrel, the Docker files, and the test runner flags alone until those land.
