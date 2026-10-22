# deps-lexical

## Summary

Upgraded `lexical` and every direct `@lexical/*` package from 0.43.0 to 0.52.0 (latest stable; `npm view lexical version` is 0.52.0, 0.52.1 is nightly only). Pins stay `^0.52.0`. No second copy of lexical. Two call sites needed a small API migration; compose behaviour is otherwise unchanged. Commit `ea8784c` on `chore/deps-lexical` in `/home/monkey/code/noctua-mail/wt-deps-lexical`. Working tree clean. Not pushed.

## What changed / What was found

Release notes 0.44–0.52 that touch this repo:

- 0.49 `$config()` removes static `importDOM` / `importJSON` / `clone` from built-in nodes. Custom nodes (`ImageNode`, `CenterNode`, `QuotedMessageNode`, extended table nodes) keep their own static methods and still register.
- 0.52 `TableNode` HTML import is priority 1, same as `ExtendedTableNode`. Equal priority keeps the last importer, which is the built-in converter, then the node replacement builds a fresh extended table and drops HTML attributes. Raised the extended table importer to priority 2. Cell and row importers were already priority 1 against built-in priority 0.
- 0.52 `editor.getEditorState().read(fn)` does not set the active editor. `$createRangeSelectionFromDom` (image drop caret capture) threw `Unable to find an active editor` and the drop never ran. That read is now `editor.read("latest", …)`, which is the committed state plus the editor. `SELECTION_CHANGE_COMMAND` now runs inside the pending update, so the table-toolbar listener uses `editor.read("pending", …)` instead of the previous committed state.
- 0.51 packages are ESM-only. This app imports them from ESM; nothing `require()`s lexical. `LexicalComposer` is deprecated in favour of `LexicalExtensionComposer` but still works. Left it in place.
- `CodeNode` without `CodeExtension` warns once, on Enter inside a code block, and the old shim still runs. Not wired up.
- `bun pm ls --all | grep lexical`: one version, 0.52.0, including transitive `@lexical/selection`, `@lexical/utils`, `@lexical/yjs`, and the rest. `@uiw/react-md-editor` and `react-markdown` do not pull lexical. `@lexical/offset` (0.43 transitive) is gone. `yjs` is an optional peer of `@lexical/react` and is not installed.

`lib/markdownConvert.ts` does not use lexical (remark/turndown). The HTML ↔ Lexical ↔ markdown path lives in the compose editor. Added `app/components/ComposeEditor.roundTrip.dom.test.tsx` for headings, bold, links, lists, quotes, inline code, `<center>`, images, editor-state JSON, and extended-table attribute import.

## Verification (exact commands + numbers)

- `npm view lexical version` → `0.52.0`
- `nice -n 10 bun install` → installed `lexical@0.52.0` and the nine `@lexical/*` direct deps at 0.52.0
- `bun pm ls --all | grep lexical` → 22 packages, all `0.52.0`, no duplicates
- `nice -n 10 bunx tsc --noEmit` → `356` `error TS` (baseline ≈354). `0` errors outside test files. The only error this change adds is `ComposeEditor.roundTrip.dom.test.tsx` `TS2307` `bun:test`, the same pre-existing class as every other test. Immediately after the install, before that test, the count was 355.
- `nice -n 10 bun run lint` → `1` error, `27` warnings (baseline: 1 pre-existing error in `useCalendarConflicts.ts` + 27 warnings). No new findings in the files touched.
- `nice -n 10 bun run test:ci` → unit `1698` pass, `0` fail, 196 files (baseline ~1681); DOM `52` pass, `0` fail, 9 files (baseline 48, plus the 4 new round-trip tests). Includes `ComposeEditor.imageDrop.dom.test.tsx` and `ComposeEditor.roundTrip.dom.test.tsx`.
- `bun run build` was not run (task forbids it).

## Risks & follow-ups

- happy-dom's `node.replaceWith(node)` removes the node. `TableNode.exportDOM` returns that same element from `after`, so `$generateHtmlFromNodes` yields an empty string for tables under happy-dom. Browsers keep the node. Not patched. The new test checks the extended-table node tree and attributes, not generated table HTML.
- `TablePlugin hasHorizontalScroll` logs `theme.tableScrollableWrapper is not defined`. The wrapper still gets inline `overflow-x: auto`. No theme change.
- Enter in a code block still uses the deprecated `CodeNode` shim (`Using CodeNode without CodeExtension is deprecated`, once). Wiring `CodeExtension` would change that path; left alone.
- `LexicalComposer` is deprecated and scheduled for removal. Moving to `LexicalExtensionComposer` is a separate migration.
- Table cell HTML export from `@lexical/table` still adds its own inline border, width, and alignment. That comes from `super.exportDOM`, unchanged here.

## Files touched

- `package.json`
- `bun.lock`
- `app/components/ComposeEditor.tsx`
- `app/components/lexical/ExtendedTableNodes.tsx`
- `app/components/ComposeEditor.roundTrip.dom.test.tsx`
- This brief: `/home/monkey/code/noctua-mail/briefs/deps-lexical.md` (not part of the commit)

No edits under the other agents' areas (MailClient, IMAP sync, MCP, thread collab, auth, schema).
