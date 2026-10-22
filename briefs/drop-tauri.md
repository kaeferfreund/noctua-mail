# drop-tauri

## Summary

Removed the Tauri desktop client from `chore/drop-tauri` (base `team-inbox` `a1f4c63`). The web invite panel, `window.open`, and `document.title` are the only remaining paths in the files this branch may edit. LoginOverlay, `lib/desktop.ts`, the desktop API routes, and `package.json` are unchanged.

Commits on `chore/drop-tauri`, working tree clean, not pushed:

- `dc2ee8976bc0517688325640b5a8cf09558fa008` `chore(desktop): remove Tauri client tree`
- `210779a73cffc9be52a957f6c58b7d23e1726365` `refactor(ui): drop desktop branches from admin tab and window helpers`

## What changed

Deleted `src-tauri/` (58 tracked files), `doc/DESKTOP.md`, and `build-scripts/build-desktop.sh`. Dropped the now-dead `src-tauri` ignores in `tsconfig.json`, `eslint.config.mjs`, `bunfig.toml`, and `bunfig.dom.toml`, the Tauri entries in `.gitignore` and `.dockerignore`, and the README "Desktop app" section that linked `doc/DESKTOP.md`. `build-scripts/generate_icons.sh` stays; it generates web icons.

`AdminTabContent` no longer calls `useIsDesktop` or `GET /api/desktop/storage-info`. The storage-path card and the desktop copy ("Inspect users…", hidden invite controls) are gone. The tab always shows invite generation, invite usage, and the user directory. The `TooltipIconButton` import and the invite-copy props (`size="1"`, `variant="soft"`, `color="gray"`, `tooltip="Copy invite code"`) are unchanged.

`openDetachedWindow` and `openDetachedWindowConfirmed` only call `window.open`. The `title` option stays on the options type because MailClient, the message window, and the calendar callers still pass it, and those files were out of scope. Browsers ignore it; the opened page sets `document.title`. `useWindowTitle` only writes `document.title`.

No existing test covered the removed desktop branches, so no test files changed.

The §10 fork CI guard was not part of this task. Workflow files were not edited.

## What was intentionally left (and which branch removes it later)

Left for the change that follows the `feat/team-auth` merge (LoginOverlay and `package.json` are that branch's files; `chore/deps-update` also edits `package.json`):

- `lib/desktop.ts` — `LoginOverlay.tsx` on this tree still imports `isDesktop` / `useIsDesktop`. Deleting the module now would break this branch.
- `app/components/auth/LoginOverlay.tsx` — still has the desktop invite-skip. `feat/team-auth` removes it.
- `app/api/desktop/needs-setup/route.ts` and `app/api/desktop/storage-info/route.ts` — still the live handlers. `feat/team-auth` stubs them to 410; delete the routes after that lands.
- `package.json` — `desktop:dev-server`, `desktop:dev`, `desktop:build` (`bash build-scripts/build-desktop.sh`, now a dangling script), and `@tauri-apps/cli`. Do not run `desktop:build` on this branch. Drop the scripts and the CLI in the post-merge `package.json` edit, and do not take the `chore/deps-update` Tauri CLI bump.

Also left, because this task forbids editing them:

- `doc/TEAM-INBOX.md` mentions `useIsDesktop` in the D15 prose. It is in the compact-toolbar dirty set. The sentence describes the removal, and it does not link `src-tauri`, `DESKTOP.md`, or `build-desktop.sh`.
- GitHub workflows. They do not reference the deleted files. The §10 repository guard is a separate change.

`app/api/auth/signup/route.ts` still reads `NOCTUA_DESKTOP_MODE`. That is signup behavior, not a dangling reference to the deleted files, and team-auth owns that route.

## Verification (exact commands + numbers)

Run from `/home/monkey/code/noctua-mail/wt-drop-tauri` after both commits. Before numbers are the task baseline for this tree (not re-run before the edit). `bun run build` was not run.

| Check | Before (stated) | After |
| --- | --- | --- |
| `nice -n 10 bunx tsc --noEmit \| grep -c "error TS"` | 355 | **355** (exit 2). 0 errors outside `*.test.ts` / `*.dom.test.tsx`. None in the edited files. |
| `nice -n 10 bun run lint` | 1 error + 27 warnings | **1 error, 27 warnings** (exit 1). Error is the pre-existing `react-hooks/set-state-in-effect` in `app/components/calendar/useCalendarConflicts.ts:58`. |
| `nice -n 10 bun run test:ci` | 1698 unit + 48 DOM pass | exit 0. Unit: **1698 pass, 0 fail**, 196 files, 5.52s. DOM: **48 pass, 0 fail**, 8 files, 12.36s. |

`git grep -n "src-tauri\|DESKTOP.md\|build-desktop\|useIsDesktop\|storage-info"` after the commits:

| Hit | Why it remains |
| --- | --- |
| `lib/desktop.ts:7`, `lib/desktop.ts:26` | Module stays while LoginOverlay imports it. Removed with the post-team-auth cleanup. |
| `app/components/auth/LoginOverlay.tsx:3`, `:98` | `feat/team-auth` removes `useIsDesktop`. |
| `package.json:29` `desktop:build` → `build-scripts/build-desktop.sh` | `package.json` not edited here. Script file is already deleted. |
| `doc/TEAM-INBOX.md:1561` | Design prose in the compact-toolbar dirty set. |

The same grep does not print `app/api/desktop/**` because those route bodies do not contain the search strings. Both route files are still tracked: `app/api/desktop/needs-setup/route.ts`, `app/api/desktop/storage-info/route.ts`. No remaining `src-tauri` or `DESKTOP.md` hits. Workflows, Dockerfile, and `scripts/` had no dangling references.

## Files touched/deleted

Deleted:

- `src-tauri/**` (58 files)
- `doc/DESKTOP.md`
- `build-scripts/build-desktop.sh`

Edited:

- `.dockerignore`
- `.gitignore`
- `README.md`
- `bunfig.toml`
- `bunfig.dom.toml`
- `eslint.config.mjs`
- `tsconfig.json`
- `app/components/account-settings/tabs/AdminTabContent.tsx`
- `lib/ui/openDetachedWindow.ts`
- `lib/ui/windowTitle.ts`
