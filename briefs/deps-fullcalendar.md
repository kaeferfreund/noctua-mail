# deps-fullcalendar

## Summary

Stayed on FullCalendar v6 and upgraded all six packages from 6.1.20 to 6.1.22. A consistent stable v7 set that still exposes `@fullcalendar/core/locales/de` does not exist.

Commit: `6a4e9c829bf445d1683a5fe8b000e570fbe3c7e6` on `chore/deps-fullcalendar`. Working tree clean. No push.

## What changed / What was found

Installed versions are now `@fullcalendar/{core,daygrid,interaction,react,rrule,timegrid}@6.1.22`. `package.json` ranges moved from `^6.1.20` to `^6.1.22`. `bun.lock` changed only those six entries. No application source, CSS, or other packages changed.

`@fullcalendar/core/locales/de` is still a file in 6.1.22 (`node_modules/@fullcalendar/core/locales/de.js`) and is covered by the package `exports` key `./locales/*`.

### Why not v7

`bun outdated` lists 7.1.3 for core, react, and rrule, and 6.1.22 for daygrid, interaction, and timegrid. That split is real:

- `@fullcalendar/daygrid`, `@fullcalendar/interaction`, and `@fullcalendar/timegrid` have no stable 7.x. `npm view @fullcalendar/daygrid versions --json` ends at `6.1.22`, then only `7.0.0-beta.0` through `7.0.0-beta.6` and `7.0.0-rc.0`. Same cutoff for interaction and timegrid. npm describes daygrid 6.1.22 as "FullCalendar v6 only (in v7, this plugin is built into each framework package, e.g. `@fullcalendar/react/daygrid`)".
- v6.1.22 release notes say a v6 plugin passed to FullCalendar v7 fails on purpose (`majorVersionError`). The three view/interaction packages cannot be mixed with `@fullcalendar/core@7.1.3`.
- `@fullcalendar/core@7.1.3`, `@fullcalendar/react@7.1.3`, and `@fullcalendar/rrule@7.1.3` do exist. Core 7.1.3 depends on `temporal-polyfill` and `@full-ui/headless-calendar@7.1.3`. React 7.1.3 peers on `temporal-polyfill` and re-exports the plugins as `@fullcalendar/react/daygrid`, `@fullcalendar/react/timegrid`, and `@fullcalendar/react/interaction`.
- Locale path required by later i18n work is gone. `npm pack @fullcalendar/core@7.1.3 --dry-run` lists 7 files and no `locales/` directory. `index.d.ts` is empty. Exports are only `.`, `./package.json`, and `./protected-api`. German ships at `@fullcalendar/react/locales/de` (`locales/de.js` in the react 7.1.3 tarball). `@fullcalendar/core/locales/de` is not importable.
- v7 also renames the types this app imports from `@fullcalendar/core` (`EventClickArg` is `EventClickInfo`, `DatesSetArg` is `DatesSetInfo` on `@fullcalendar/react`) and replaces `fc-*` classes and CSS variables (https://fullcalendar.io/docs/v7 custom CSS migration; https://fullcalendar.io/docs/upgrading-from-v6). Those would be a follow-on migration only after the locale import path is allowed to move.

6.1.21 is Angular 22 support only. 6.1.22 is v6 bugfixes (toolbar text, style injection, CSP, list-view click) plus backports. No `fc-*` rename, so `fullcalendar-theme.css` stays as-is.

## Verification (exact commands + numbers)

Run from `/home/monkey/code/noctua-mail/wt-deps-fullcalendar`.

- `nice -n 10 bunx tsc --noEmit | grep -c "error TS"` → **355** (baseline ≈354). 0 errors in non-test files. The only FullCalendar-named hit is the pre-existing `bun:test` missing-module error in `lib/fullcalendarRecurrence.test.ts`. No new FullCalendar API errors.
- `nice -n 10 bun run test:ci` → exit 0. Unit: **1698 pass, 0 fail**, 196 files, 9.70s. DOM: **48 pass, 0 fail**, 8 files, 12.84s. Baseline was ~1681 unit + 48 DOM; this tree reported 17 more unit passes and the same 48 DOM passes. No tests were added.
- `nice -n 10 bun run lint` → exit 1 from the pre-existing error. **1 error, 27 warnings** (baseline 1 error + 27 warnings). The error is `react-hooks/set-state-in-effect` in `app/components/calendar/useCalendarConflicts.ts:58`.
- `nice -n 10 bun test app/components/calendar lib/calendar*` → **218 pass, 0 fail**, 552 expects, 26 files, 1084ms.
- `bun run build` was not run (task forbids it).

## Risks & follow-ups

- `bun outdated` will keep offering 7.1.3 for core, react, and rrule. Do not take those alone; v6 plugins will fail against v7 core.
- v7 is blocked until i18n can import `@fullcalendar/react/locales/de` (or core grows that export again) and the call sites plus `fullcalendar-theme.css` are migrated. Also add the `temporal-polyfill` peer.
- tsc 355 vs the stated ≈354 was not diffed file-by-file against a fresh baseline run. Nothing in the diff can add a type error outside lockfile resolution, and no non-test file reports an error.
- Unit count 1698 vs ~1681 is the same commit plus this lockfile bump. Treat ~1681 as the approximate baseline, not a regression.

## Files touched

- `package.json`
- `bun.lock`

No edits under the areas owned by other agents. `app/components/calendar/CalendarView.tsx`, `CalendarEventBrowser.tsx`, and `fullcalendar-theme.css` were inspected and left unchanged.
