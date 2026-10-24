# QA sweep 3 fixes, round 1 (`fix/qa-sweep3-r1`)

Worktree `wt-qa-fixes`, base `e70c30b` (round 9 final, `origin/integration/stage`). Source: `briefs/qa-ui-sweep-98b4301.md`. Not pushed. 20 files changed, 407 insertions, 17 deletions.

## Commits

| Commit | Finding | Subject |
|---|---|---|
| `61c57f0` | QA-201 | fix(compose): treat an untouched editor body as empty when a signature is added |
| `dea6de4` | QA-203 | fix(admin): wrap header and mailbox action rows on phones |
| `9f7bad0` | QA-201 | test(compose): browser regression for QA-201 From switch signatures |
| `0a69377` | QA-204 | fix(compose): size the desktop From menu to its field |
| `1c11e8d` | QA-212 | fix(collab): list the current user once in the assignee picker |
| `443198f` | QA-210 | fix(search): shorten the folder search placeholder |

`dea6de4` also adds the shared browser harness for these fixes: `playwright.qa-sweep3.config.ts` (new file, extends the QA shell config) and `tests/browser/ui/qaSweep3.ts` (catalog loader and localized user-menu helper). It runs with the existing `scripts/runQaShellBrowserTests.ts`. `playwright.qa-round2.config.ts` is not edited, because `feat/reader-focus` already conflicts on its `testMatch`.

## Findings: root cause, fix, tests

### QA-201 (P2): signature lost after switching From back

- **Root cause (confirmed):** with no tracked previous signature, `replaceSignatureBlock` (`lib/signatureTemplates.ts`) returned `conflict: Boolean(body)`. After switching to an identity without a signature, the editor body is still truthy even though nothing was typed: Lexical serializes an empty paragraph (`<p><br></p>`), and text bodies can be `"\n"`. Switching back therefore raised the "keep edited signature" confirm. Cancel left the message without a signature; OK joined the signature after the empty block, which produced the extra blank lines.
- **Fix:** the change is in `lib/signatureTemplates.ts` only. A new private `isBlankComposeBody(body, separator)` uses the existing format discriminator: `"\n\n"` means plain text or Markdown, `""` means HTML.
  - Plain text and Markdown: blank means whitespace only.
  - HTML: blank means no visible text and no media. Visible text comes from the existing `extractVisibleHtmlText`, which handles `&nbsp;`, NBSP and zero-width characters.
  - When there is no tracked previous signature and the body is blank, the result is `{ body: next, conflict: false }`. The signature is inserted once, exactly as the initial insert does.
  - Media is checked with `hasRenderableHtmlMedia`, now exported from `lib/html/extract.ts` and reused by `scoreHtmlDocument` instead of a duplicate regex. An image-only body is therefore never treated as blank.
  - Authored text and media still produce the existing prompt.
  - The tracked-previous path is unchanged. `ComposeMessageField` relies on its `conflict` result to locate the block.
  - `useComposeController.ts` has no diff.
- **Tests:**
  - `lib/signatureTemplates.test.ts`: two new cases.
    - Blank bodies are not a conflict: `""`, `"\n"`, whitespace and NBSP, a Markdown-escaped signature, and four HTML empty-paragraph serializations.
    - Authored text, HTML text and image-only HTML still conflict.
  - `senderComposeReview.dom.test.tsx`: new case for HTML, Text and Markdown. It runs three rounds of unsigned → signed → other identity: the signature is restored once, at the start, without a confirm, and is never duplicated or lost. Authored text then still triggers exactly one confirm.
  - Without the fix, the unit case and the HTML DOM case fail; HTML reproduces the QA result, with the confirm declined and no signature. Text and Markdown also pass without the fix, because removing the tracked block leaves exactly `""` there. The unit test covers `"\n"`.
  - Browser (`qa-sweep3-compose.spec.ts`), German, 1440 light: personal default "QA Team" with "Team-Signatur". Over three switch rounds the body is exactly `"Viele Grüße\nSynthetic Alex\nteam@example.test"` with 0 prompts. After typing, 1 prompt.

### QA-203 (P2): admin on phones

- **Root cause:** in `AdminPanel.tsx` and `AdminMailboxes.tsx`, the title row, Users/Mailboxes headers, the mailbox header button group and the per-mailbox action rows were `flex` without `flex-wrap`. The buttons are `whitespace-nowrap`, so the longer German labels pushed them past the edge.
- **Fix:** new `app/components/admin/adminLayout.ts` with two shared class strings:
  - `adminHeaderRow`: `flex flex-wrap items-center justify-between gap-2`
  - `adminActionRow`: `flex flex-wrap gap-2`

  Both add `max-md:[&_button]:min-h-11`, the same 44 px touch pattern as `ShellHeader`; `max-md` matches the app's 767 px `MOBILE_QUERY`. They are applied to the admin title row, section nav, Users header, Mailboxes header and its button group, and each mailbox's action row. Desktop layout is unchanged apart from wrapping when space runs out.
- **Tests:** `qa-sweep3-admin.spec.ts`, de and en, at 390/360/320 in light and dark. Every visible admin button stays within `[0, width]`, is at least 44 px tall and has no truncated label (`scrollWidth <= clientWidth`), and `document.scrollWidth` stays at or below the width.
  - Measured: 9 buttons each time, minimum height 44 px.
  - Rightmost button edge in de: 378 (at 390), 322 (360), 214 (320).
  - Rightmost button edge in en: 378, 348, 308.
  - DOM tests cannot measure layout. The existing `AdminMailboxes`/`AdminPanel`/`lazyAdmin` DOM suites pass unchanged.

### QA-204 (P3): desktop From menu spans the viewport

- **Root cause:** `.composeFromMenu { width/max-width: calc(100vw - 32px) }` in `Compose.module.css` sat outside the phone media query.
- **Fix:**
  - Desktop: `width: var(--radix-select-trigger-width); min-width: min(280px, 100vw - 32px); max-width: min(560px, 100vw - 32px)`. Radix Themes' own `min-width` is a zero-specificity `:where()` rule, so this rule wins.
  - Phones: the full-width rule moves into the existing `@media (width < 768px)` block alongside the other From-trigger rules.
- **Tests:** `qa-sweep3-compose.spec.ts` measures the `.rt-SelectContent` box after its open animation has finished.

  | Case | Field | Menu |
  |---|---|---|
  | Inline, 1440 light | 456 px | 456 px |
  | Modal, 1440 dark | 820 px at x=358 | 560 px at x=358 (capped) |
  | Modal, 1280 light | 820 px | 560 px |
  | Phone, 390 dark | — | 358 px (unchanged `width - 32`) |
  | Phone, 320 light | — | 288 px (unchanged `width - 32`) |

  The existing P2-D mobile assertion in `qa-compose.spec.ts` checks the same `width - 32` value.

### QA-212 (P3): current user listed twice

- **Root cause:** `AssigneeCombobox.tsx` added a separate "Ich" entry and then listed every active member again, including the current user.
- **Fix:** the current active member appears once, directly after "Nicht zugewiesen", labelled `Collaboration.assignee.meNamed` = „Ich ({name})“ / "Me ({name})". The name falls back to the email. The search value still includes "Ich"/"Me", name, email and user id. The new catalog key is added to both catalogs; `assignee.me` stays because the search value uses it.
- **Tests:**
  - `Collaboration.dom.test.tsx`: the selection loop now picks "Me (Alex Example)". The test asserts the exact option list `["Unassigned", "Me (Alex Example)", "Toni Example"]` and fails on the old component.
  - Browser (`qa-sweep3-collab.spec.ts`, de and en, 1440 light): Jo is added as an editor through the members API. Options are `["Nicht zugewiesen", "Ich (Synthetic Alex)", "Synthetic Jo"]` / `["Unassigned", "Me (Synthetic Alex)", "Synthetic Jo"]`. Selecting the self entry shows "Synthetic Alex" in the trigger.

### QA-210 (P3): search placeholder clipped

- **Deviation from the brief:** the brief asks for the copy to read "im Posteingang", as a copy-only change with `ShellSearch.tsx` untouched. These requirements conflict:
  - The key `Search.placeholder.folder` receives only the folder display name. A literal "E-Mails im {folder} suchen" would be ungrammatical for other folders, for example "im Entwürfe" or "im Gesendet", and for user-created names.
  - `doc/I18N.md` forbids branching on translated labels. An ICU `select` would need a new stable argument passed from `ShellSearch.tsx`, which the brief excludes.
  - "E-Mails im Posteingang suchen" would also still be wider than the field.
- **Fix (copy only):**
  - de: „{folder} durchsuchen“ (the Windows Explorer pattern, for example "Posteingang durchsuchen").
  - en: "Search {folder}". The English "Search messages in Inbox" also clipped at 1440: 174 px of text in 171 px.

  The folder name stands alone, so every special-use and custom name reads correctly.
- **If "im Posteingang" is still preferred:** pass a stable `kind` argument (for example the special-use key) in the `t("placeholder.folder", …)` call at `ShellSearch.tsx:182`, then use an ICU `select` with a quoted-name fallback such as „E-Mails in „{folder}“ suchen“. That touches `ShellSearch.tsx` and needs a layout check, because the inbox text would still be about 200 px.
- **Tests:**
  - New `ShellSearch.placeholder.dom.test.tsx` checks "Posteingang durchsuchen", "Entwürfe durchsuchen", "Projekte 2026 durchsuchen", "Search Inbox" and "Search Projekte 2026".
  - Browser (`qa-sweep3-search.spec.ts`) measures the canvas text width of the placeholder against the input's content width at 1440 and 1280, light and dark.

    | Locale | Text | Available |
    |---|---|---|
    | de | 173 px | 178 px |
    | en | 88 px | 171 px |

    The German text fits with only 5 px to spare. A longer custom folder name will still be cut at this field width; per the brief, the field layout was not changed.

## Gates

All test commands ran with `env -u CLAUDECODE -u AGENT -u REPL_ID`, `nice -n 15` and `TMPDIR=<worktree>/.tmp`.

| Gate | Result |
|---|---|
| `bun run typecheck` | exit 0, 0 errors in 1,252 files |
| New and affected tests, 3 runs | Server: 196 pass / 0 fail in 9 files each run (`signatureTemplates`, `i18n/catalogs`, `i18n/folderNames`, `html`, `ui/messageView`, `HtmlMessage`, `composeInitState`, `composeSenderInit`, `composeTabSwitch`). DOM: 93 pass / 0 fail in 10 files each run (`senderComposeReview`, `signatureHtmlTracking`, `ComposeFields`, `ComposeHeader`, `Collaboration`, `ShellSearch.placeholder`, `ShellSearch`, `AdminMailboxes`, `AdminPanel`, `lazyAdmin`); 32 s / 37 s / 43 s |
| `bun run test:ci`, run once | exit 0. Server: 2,917 pass / 0 fail in 315 files (522 s). DOM: 568 pass / 0 fail in 74 files (88 s). Total 620 s |
| `bun run lint` | exit 0, 0 errors, 181 warnings repo-wide. The touched files have the same 2 pre-existing scoped `react-hooks/set-state-in-effect` warnings as at base (`AdminMailboxes.tsx` `load()` effect, now line 91 after the import; `AdminPanel.tsx:57`). No new warnings |
| `bun run build` on HEAD | exit 0 (compiled in 15.3 s) |
| Playwright on the production build (`next start` on 3875, fixture IMAP/SMTP on OS-assigned ports; `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-arm64 QA_SHELL_PORT=3875 QA_SHELL_USE_BUILD=1 bun scripts/runQaShellBrowserTests.ts --config=playwright.qa-sweep3.config.ts`) | exit 0, 8 passed in 2.4 min |
| `git diff --check e70c30b HEAD` | clean |

Earlier browser runs during development failed for reasons that were fixed before the final run:

- My helper did not open the phone sidebar before looking for the user menu.
- The first QA-204 assertion measured the inner listbox, and later measured during the select's open animation.
- The English placeholder overflowed, which is a real finding and was fixed in the catalog.

No existing timeout, retry budget or assertion was changed.

## Screenshots (`briefs/qa-sweep3-fixes-evidence/`, all PNG ≤ 185 KB)

- **QA-201:** `QA-201-signature-restored-1440-light.png`, `QA-201.json`
- **QA-203:**
  - `QA-203-de-{390,360,320}-{light,dark}.png`
  - `QA-203-en-{390,320}-{light,dark}.png`
  - `QA-203-de.json`, `QA-203-en.json`
- **QA-204:**
  - `QA-204-from-menu-modal-1440-dark.png`, `QA-204-from-menu-modal-1280-light.png`
  - `QA-204-from-menu-inline-1440-light.png`
  - `QA-204-from-menu-phone-390-dark.png`, `QA-204-from-menu-phone-320-light.png`
  - `QA-204.json`
- **QA-210:**
  - `QA-210-search-de-{1440,1280}-{light,dark}.png`
  - `QA-210-search-en-{1440,1280}-light.png`
  - `QA-210-de.json`, `QA-210-en.json`
- **QA-212:** `QA-212-assignee-{de,en}-1440-light.png`, `QA-212-{de,en}.json`

## Merge checks (`git merge-tree --write-tree HEAD <ref>`)

The conflict file sets are identical to the base `e70c30b` for every ref, and the extracted conflict regions are byte-identical (compared region by region). This branch adds no conflict. In every merged tree, all of my hunks are present: the signature helper, both catalog keys, the From-menu CSS and the `lib/html/index.ts` export.

| Ref | Result | Notes |
|---|---|---|
| `origin/feat/i18n-slice3` (`7c05ea6`) | exit 1 | Conflict in `tests/browser/compose/qa-compose.spec.ts` only. It is pre-existing (same 28-line region at base); this branch does not touch that file. Auto-merged overlaps: `lib/html/index.ts` (slice3 adds `FORWARDED_MESSAGE_MARKERS` in the quoteBoundary export block, I add `hasRenderableHtmlMedia` in the extract block; both kept), `messages/de.json`/`en.json` (separate hunks). The brief notes that slice3 changes 3 lines in `useComposeController.ts`; this branch has **no** diff in that file. The QA-201 fix lives entirely in `lib/signatureTemplates.ts`. The QA-204 browser case finds the modal button by `/^(Open in modal\|Im Dialog öffnen)$/` so it also works after slice3 localizes it |
| `origin/feat/status-bar-compact` (`a864dfc`) | exit 1 | Conflict in `messages/de.json` only. It is pre-existing (identical 75-line region around `Shell` status keys, lines ~169–244). My de.json hunks, at `Search.placeholder.folder` (l. 320) and `Collaboration.assignee.meNamed` (l. 529), auto-merge. `Compose.module.css` auto-merges: their hunk is the z-index at the top, mine is the From menu around l. 495/520 |
| `origin/feat/reader-focus` (`e7d00ee`) | exit 1 | Conflicts in `MailClient.tsx`, `lazyAdmin.dom.test.tsx` and `playwright.qa-round2.config.ts`, all pre-existing and identical to base. This branch touches none of those files. Its catalog hunks (~l. 686) auto-merge with mine |
| `origin/fix/sidebar-views-row` (`94f1a31`) | exit 0 | no conflicts |

## Cleanup

- The owned app and fixture processes were started and stopped by the harness (process group SIGTERM, then SIGKILL). No listener remains on 3875–3879.
- No other worktree, data directory, port 3790 or service was touched.
- No push, rebase, reset, stash or checkout of another branch.
- `.tmp` (build/test logs, scratch fixture data) was removed. The worktree is clean; `.next` and `public/build-version.json` are ignored build output.
