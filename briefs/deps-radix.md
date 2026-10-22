# deps-radix

## Summary

Accepted the upgrade. `radix-ui` is pinned exactly at **1.8.1** (was 1.4.3) and `@radix-ui/react-collapsible` is **^1.2.1** (resolved 1.2.1, was ^1.1.12 / 1.1.12). `@radix-ui/themes` stays **^3.3.0** resolved to **3.3.0**: `npm view @radix-ui/themes version` is 3.3.0, and the published 3.x list ends at 3.3.0, so there was nothing newer to install.

After install, every `@radix-ui/*` package resolves to exactly one version. The previous duplicates (dialog plus the context/portal/slot stack pulled in by that second dialog) are gone. Themes' `radix-ui: ^1.1.3` now shares the same `radix-ui@1.8.1` instance as the app pin.

Commit: `a9b3e979299914eb510b3cd4471ab4e0072d850e` on `chore/deps-radix`. Working tree clean. No application source edits.

## What changed / What was found

`bun pm ls` colorizes `@version`, so a raw `grep` for `package@version` misses. Versions below are from color-stripped `bun pm ls --all`, checked with `bun pm why`.

### Before (`radix-ui@1.4.3`, collapsible 1.1.12, themes 3.3.0)

| Package | Versions | Single? | Who pulled the extra copy |
| --- | --- | --- | --- |
| `@radix-ui/react-dialog` | 1.1.15, 1.3.1 | no | 1.1.15: `radix-ui@1.4.3` and its alert-dialog. 1.3.1: `cmdk@1.1.1` (`^1.1.6`) |
| `@radix-ui/react-dropdown-menu` | 2.1.16 | yes | umbrella |
| `@radix-ui/react-popover` | 1.1.15 | yes | umbrella |
| `@radix-ui/react-tooltip` | 1.2.8 | yes | umbrella |
| `@radix-ui/react-collapsible` | 1.1.12 | yes | direct dep, umbrella, accordion |
| `@radix-ui/primitive` | 1.1.3, 1.2.0 | no | 1.2.0 nested under dialog 1.3.1 |
| `@radix-ui/react-primitive` | 2.1.3, 2.2.0 | no | 2.2.0 nested under dialog 1.3.1 |
| `@radix-ui/react-portal` | 1.1.9, 1.2.0 | no | 1.2.0 nested under dialog 1.3.1 |
| `@radix-ui/react-context` | 1.1.2, 1.3.0 | no | 1.3.0 nested under dialog 1.3.1 |
| `@radix-ui/react-presence` | 1.1.5, 1.1.11 | no | 1.1.11 nested under dialog 1.3.1 |
| `@radix-ui/react-slot` | 1.2.3, 1.5.0 | no | 1.5.0 nested under dialog 1.3.1 |
| `@radix-ui/react-menu` | 2.1.16 | yes | umbrella |
| `@radix-ui/react-popper` | 1.2.8 | yes | umbrella |

Themes 3.3.0 already depended on `radix-ui ^1.1.3` and shared the pinned 1.4.3 instance. The split was `cmdk`, not themes. Dialog 1.3.1 is the package that carries React context, portal, presence, and slot, so that duplicate was the one that can break portals and contexts.

### After (`radix-ui@1.8.1`, collapsible 1.2.1, themes 3.3.0)

| Package | Version | Single? |
| --- | --- | --- |
| `@radix-ui/react-dialog` | 1.3.1 | yes (cmdk, umbrella, alert-dialog, themes) |
| `@radix-ui/react-dropdown-menu` | 2.2.1 | yes |
| `@radix-ui/react-popover` | 1.3.1 | yes |
| `@radix-ui/react-tooltip` | 1.4.1 | yes |
| `@radix-ui/react-collapsible` | 1.2.1 | yes (direct `^1.2.1` matches the umbrella pin) |
| `@radix-ui/primitive` | 1.2.0 | yes |
| `@radix-ui/react-primitive` | 2.2.0 | yes |
| `@radix-ui/react-portal` | 1.2.0 | yes |
| `@radix-ui/react-context` | 1.3.0 | yes |
| `@radix-ui/react-presence` | 1.1.11 | yes |
| `@radix-ui/react-slot` | 1.5.0 | yes |
| `@radix-ui/react-menu` | 2.2.1 | yes |
| `@radix-ui/react-popper` | 1.4.0 | yes |
| `radix-ui` | 1.8.1 | yes |
| `@radix-ui/themes` | 3.3.0 | yes |
| `@radix-ui/react-icons` | 1.3.2 | yes |

A full scan of `bun pm ls --all` found **no** `@radix-ui/*` package with more than one version.

`bun pm why @radix-ui/react-dialog` after the bump: 1.3.1 is required by `radix-ui@1.8.1`, by `@radix-ui/react-alert-dialog@1.2.1`, and by `cmdk@1.1.1`, and themes reaches it through the same `radix-ui@1.8.1`.

Lockfile side effect: `@radix-ui/react-use-is-hydrated` moved from 0.1.0 (depended on `use-sync-external-store`) to 0.1.3 (no longer does). `use-sync-external-store` left the tree. Nothing in the repo imports it.

No overrides were added. No source files under the shell, legacy UI, or the other agents' areas were edited.

## Verification (exact commands + numbers)

Worktree `/home/monkey/code/noctua-mail/wt-deps-radix`, branch `chore/deps-radix`.

- `nice -n 10 bun install` — resolved, 60 packages installed, lockfile saved. Installed: `radix-ui@1.8.1`, `@radix-ui/react-collapsible@1.2.1`, `@radix-ui/themes@3.3.0`.
- Color-stripped `bun pm ls --all` — every `@radix-ui/*` package one version (table above).
- `nice -n 10 bunx tsc --noEmit` then `grep -c "error TS"` — **355** (exit 2). Baseline ≈354. All 355 are in `*.test.*` files: 204 `TS2307` `bun:test`, plus 151 follow-on errors in 26 test files (compose init, classifier, calendar, IMAP, and similar). No diagnostic mentions radix. No error in a non-test file, `app/components/shell/**`, or `app/components/ui/**`.
- `nice -n 10 bun run lint` — **28 problems (1 error, 27 warnings)**, exit 1. Matches the baseline. The error is the pre-existing `react-hooks/set-state-in-effect` in `app/components/calendar/useCalendarConflicts.ts`.
- `nice -n 10 bun run test:ci` — exit 0.
  - Unit: **1698 pass, 0 fail**, 196 files, 6.46s. Baseline was ~1681 unit; this run is the same tree plus the dependency bump, and it is green. The baseline figure was approximate.
  - DOM: **48 pass, 0 fail**, 296 `expect()` calls, 8 files, 13.63s. Files: `app/hooks/useDarkMode.dom.test.tsx`, `app/hooks/useMobileNavigation.dom.test.tsx`, `app/components/ComposeEditor.imageDrop.dom.test.tsx`, `app/components/AttachmentsList.dom.test.tsx`, `app/components/shell/Shell.dom.test.tsx`, `app/components/shell/MobileFrames.dom.test.tsx`, `app/components/shell/ShellSearch.dom.test.tsx`, `app/components/mailclient/composition/sendMailRace.dom.test.tsx`.

No `bun run build`. No server. No browser pass: no UI source changed, and this task forbids starting a server.

## Risks & follow-ups

- Themes 3.3.0 declares `radix-ui ^1.1.3` and now runs on 1.8.1. Shell DOM tests mount `Theme` and passed. A manual click-through of legacy themes dialogs and shadcn portals in the browser was not run.
- `cmdk` still depends on dialog via `^1.1.6`, not an exact pin. A later cmdk release that resolves dialog above the umbrella's exact pin would split the context/portal stack again. Keep the umbrella pin and cmdk's dialog requirement on the same version.
- `@radix-ui/react-use-is-hydrated@0.1.3` no longer depends on `use-sync-external-store`. Reintroduce that package only if a direct dependency needs it.
- tsc 355 vs baseline ≈354 was not diffed against a saved baseline log. Nothing in the 355 points at radix or production files. Left alone as pre-existing `bun:test` noise.
- Do not drop the exact `radix-ui` pin while themes and the shadcn `radix-ui` imports both need one shared instance.

## Files touched

- `package.json` — `radix-ui` `1.4.3` → `1.8.1`; `@radix-ui/react-collapsible` `^1.1.12` → `^1.2.1`. Themes range unchanged.
- `bun.lock` — radix primitive tree collapsed onto the 1.8.1 pins; `use-sync-external-store` removed with `react-use-is-hydrated` 0.1.3.
- No other files. No edits in `app/components/MailClient.tsx`, `app/components/mailclient/**`, imap/sync, MCP, auth, or `lib/db/schema.ts`.
