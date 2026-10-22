# deps-html-parsers

## Summary

Upgraded the direct HTML parser dependencies on `chore/deps-html-parsers` and committed `507c3b14a90ef108189a2231fa2aaccddc01ca9e` (`chore(deps): upgrade html-to-text, entities and parse5`). Working tree is clean. No push.

- `html-to-text` `^9.0.5` → `^10.0.1` (installed 10.0.1)
- `entities` `^7.0.1` → `^8.1.0` (installed 8.1.0)
- `parse5` `^7.3.0` → `^8.0.1` (installed 8.0.1)

`sanitize-html` stayed at `^2.17.3`. `@types/html-to-text` stayed at `^9.0.4`. No application call sites changed.

## What changed / What was found

Release notes:

- html-to-text 10.0.0 is a maintenance major (Node >= 20.19.0, ES2022). It does not remove deprecated features. It moves `htmlparser2` 8.0.2 → 10.1.0 (more spec-compliant entities, `textarea`, and `xmp`) and replaces `deepmerge` with `deepmerge-ts`. 10.0.1 bumps `deepmerge-ts` 7.1.5 → 8.x for a security fix. The package ships CJS and ESM and no `.d.ts`.
- entities 8.0.0 is ESM-only, Node >= 20.19.0, and drops deprecated helpers. `decodeHTMLStrict` remains. 8.1.0 is faster and fixes a few non-strict decode edge cases (`&notin<`, `&Xi$`, XML numeric code points). Strict decoding of those inputs is unchanged.
- parse5 8.0.0 is ESM-only. 8.0.1 is the release that moves its dependency from `entities` `^6` to `entities` `^8`. `parse`, `parseFragment`, `serialize`, and `DefaultTreeAdapterMap` are unchanged. The XING malformed-table fixture serializes identically on parse5 7.3.0 and 8.0.1.

`npm view @types/html-to-text version` is `9.0.4` (no v10). html-to-text 10 does not ship types. The existing `@types/html-to-text` still covers `convert()` with `wordwrap` and `selectors`.

Call sites, all still valid: `lib/mail/imap/sync.ts` (`convert`, `decodeHTMLStrict`), `lib/html/strip.ts` (`decodeHTMLStrict`), `lib/html/normalize.ts` (`parse`, `parseFragment`, `serialize`), `lib/html.test.ts` (`DefaultTreeAdapterMap`, `parseFragment`).

Dependency layout after install (`find` of every `entities` and `parse5` package root):

| Copy | Where | Why it remains |
| --- | --- | --- |
| entities 8.1.0 | `node_modules/entities` | Direct dependency. parse5 8.0.1 resolves this hoisted copy. No `node_modules/parse5/node_modules`. |
| entities 7.0.1 | `node_modules/htmlparser2/node_modules/entities` | htmlparser2 10.1.0 (`entities` `^7`) used by sanitize-html 2.17.3 and html-to-text 10.0.1. CJS; cannot load ESM entities 8. |
| entities 7.0.1 | `node_modules/happy-dom/node_modules/entities` | happy-dom devDependency still declares `entities` `^7`. Same major, second physical copy. |
| entities 6.0.1 + parse5 7.3.0 | under both `hast-util-from-html` and `hast-util-raw` | Those packages (via rehype) declare `parse5` `^7`, which cannot take parse5 8. Two physical copies of the same pair. |
| entities 4.5.0 | `dom-serializer/node_modules/entities` | dom-serializer 2 depends on `entities` `^4`. |
| entities 4.5.0 + html-to-text 9.0.5 + htmlparser2 8.0.2 | under `mailparser` | mailparser 3.9.8 pins `html-to-text` `9.0.5`, so it no longer shares the hoisted 10.0.1. |

`sanitize-html` stayed 2.17.3. Checked, not installed:

- sanitize-html 2.18.1 depends on htmlparser2 `^12`, which depends on entities `^8`. It does not depend on parse5. That entities 8 would dedupe with the hoisted copy.
- mailparser 3.12.3 pins html-to-text `10.0.1` exactly, which matches this bump, so the nested html-to-text 9 / entities 4 copy would disappear. html-to-text 10 still pulls htmlparser2 10 and therefore entities 7. mailparser does not depend on parse5.

Pinning parse5 at `^8.0.1` avoids a third entities major on this stack. parse5 8.0.0 would nest entities 6 next to hoisted entities 8 and htmlparser2's entities 7.

`next.config.ts` sync-route `outputFileTracingIncludes`: `./node_modules/entities/**` and `./node_modules/parse5/**` stay. Added `./node_modules/htmlparser2/**` so the worker keeps the nested CJS entities 7 instead of resolving the ESM-only entities 8. Comment updated. The standalone output contains entities 8.1.0, parse5 8.0.1 with no nested entities, and htmlparser2 10.1.0 with nested entities 7.0.1.

## Verification (exact commands + numbers)

Commands run from `/home/monkey/code/noctua-mail/wt-deps-html`.

- `nice -n 10 bun run test:ci` — exit 0. Unit: **1698 pass, 0 fail**, 196 files, 5.25s. DOM: **48 pass, 0 fail**, 8 files, 12.22s. Baseline given as ~1681 unit + 48 DOM. No tests were added or removed; 1698 is the count this tree reported.
- `nice -n 10 bunx tsc --noEmit` — exit 2. `grep -c "error TS"` = **355** (baseline ≈354). No errors in production sources. The html test files only report the pre-existing `bun:test` TS2307. The other errors are existing test-file type mismatches.
- `nice -n 10 bun run lint` — exit 1. **1 error, 27 warnings** (baseline 1 error + 27 warnings). The error is still `app/components/calendar/useCalendarConflicts.ts` `react-hooks/set-state-in-effect`.
- `nice -n 10 bun run build` — exit 0. Compiled in 13.4s, TypeScript pass in 21.7s. Next warned that it inferred the workspace root from `/home/monkey/package-lock.json`.
- `nice -n 10 bun --bun build-scripts/verifyStandaloneWorkerBuild.ts` — **exit 1**. The script looks for worker files directly under `.next/standalone/`. Next wrote them to `.next/standalone/code/noctua-mail/wt-deps-html/` (root `/home/monkey`, not a `home/monkey/...` suffix). The script was not changed. Those files are present at the nested path (`scripts/*.ts`, `lib/html/*`, `tsconfig.json`), along with the traced packages above.

Smoke import before the suite: `convert` with `wordwrap: false` and the img/anchor selectors, `decodeHTMLStrict`, and parse5 fragment serialization all ran. Node resolution from htmlparser2 finds entities 7.0.1 CJS; resolution from parse5 and the repo root finds entities 8.1.0.

## Risks & follow-ups

- `verifyStandaloneWorkerBuild.ts` does not follow Next's inferred workspace root, so `test:standalone-workers` fails on this machine even when the traced files exist. Not patched, per the task.
- rehype's `hast-util-from-html` and `hast-util-raw` still pin parse5 `^7`, so parse5 7.3.0 and entities 6.0.1 remain, duplicated under both packages. Forcing parse5 8 there would be an override. Left alone.
- htmlparser2 10 and happy-dom keep entities 7. entities 8 cannot satisfy `^7`, and htmlparser2 10 cannot `require` the ESM entities 8 build. A single entities major waits on htmlparser2 12 (sanitize-html 2.18 uses it; html-to-text 10 does not).
- mailparser 3.9.8 now nests its own html-to-text 9.0.5. mailparser 3.12.3's exact pin of html-to-text 10.0.1 would share the hoisted copy.
- html-to-text 10 changes entity / `textarea` / `xmp` parsing via htmlparser2 10. The existing suite passed, including the malformed-table sanitizer test. Preview text for unusual markup can still differ from 9.0.5 in production mail that the tests do not cover.
- entities 8 and parse5 8 are ESM-only. Bun and the Next build accepted them. The sync worker was not executed; only the file trace was inspected.

## Files touched

- `package.json` — range bumps for `html-to-text`, `entities`, `parse5`
- `bun.lock` — lockfile for those packages and their transitive updates (`deepmerge-ts`, `selderee` 0.12, `parseley` 0.13, `leac` 0.7, `peberminta` 0.10, `@selderee/plugin-htmlparser2` 0.12); mailparser's html-to-text 9 moved to a nested key
- `next.config.ts` — sync-route trace comment and `./node_modules/htmlparser2/**`

No edits under the other agents' active areas.
