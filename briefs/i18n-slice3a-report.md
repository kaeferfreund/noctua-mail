# i18n slice 3a — report (feat/i18n-slice3)

Worktree `ROOT/wt-i18n-3`, branch `feat/i18n-slice3`, base `98b4301`, head **`b772bd9`**. Not pushed. The branch has 11 commits: the first 10 came from the two earlier, cancelled agents and were kept as they were; this run added one. The run found no in-scope string still in English, so no commit redoes earlier work.

## 1. Commits (98b4301..b772bd9)

| SHA | Subject |
| --- | --- |
| 572a8ab | feat(i18n): localize generated reply and forward text with the draft's locale |
| 574bd24 | feat(i18n): German settings forms and recipient-alias editing |
| bc6bc4c | feat(i18n): German compose editor, Lexical controls and markdown commands |
| 46e2452 | feat(i18n): German compose UI, send/draft notices and window controls |
| 903101e | feat(i18n): document slice 3a namespaces, generated correspondence and remaining English |
| 60fdf8c | feat(i18n): follow the German composer in the locale-switch scenario |
| 54b3012 | feat(i18n): align the German compose editor matrix with integration/stage |
| 9414b3e | feat(i18n): localize the composer's in-reply-to label |
| d7c8920 | feat(i18n): let German settings actions wrap at 320 px and name the personal tab |
| 7c05ea6 | feat(i18n): record the 320 px settings frame limits found in the German pass |
| **b772bd9** | feat(i18n): fit the German settings frame on phones (QA-202, QA-207) — this run |

Total: 66 files, +2,573 / −661.

## 2. Scope check (step 1) and files migrated

The scope list was compared with `git diff 98b4301..HEAD`, and the in-scope files were searched for English JSX text, string `title`/`aria-label`/`placeholder`/`label` attributes and sentence literals. The production build was then checked in German (section 7). The only English literals left are protocol or example placeholders (`https://caldav.example.com/`, `user@example.com`, `cc@example.com`, `bcc@example.com`).

The items the round-9 integrator saw in English are all migrated on this branch. They are missing from integration/stage only because the branch is not merged there yet:

- AccountSettingsModal title and tabs: `Settings.accountTitle`, `Settings.tabs.*`; the identities tab uses `Settings.sender.identitiesTitle`.
- Account, Identities, Signatures, Categorization, Topics, Translation, MCP and CalDAV/Calendar tabs, the mailto section and the account form.
- Compose field labels: `Compose.fields.*`. The "Open in modal" tooltip: `Compose.window.openInModal` („Im Dialog öffnen“).
- The slice-2 error codes `identity_unavailable`, `identity_not_found`, `draft_identity_changed` and `smtp_*`. `senderErrors.ts` maps them to `Errors.sender.*` catalog IDs, and they are rendered with `useSenderMessages().renderMessage` in ComposeOrchestrator, useDraftManager and DetachedComposeWindowClient.
- `lib/accountSettings.ts` contains no UI labels (normalization and save snapshots only), so nothing there needed migrating.

Production files changed (48):

- **app/components:** AccountSettingsModal, ComposeEditor, ComposeMarkdownEditor, MailClient (minimal, see section 5).
- **account-settings:** Field, MailtoHandlerSection, OverflowTabsList.
- **account-settings/tabs:** Account, Calendar, Categorization, Identities, ImportReplaceConfirmDialog, Mcp, Members, Preferences, RecipientAliases, SenderPreferences, Signatures, Topics, Translation.
- **lexical:** ImageNode, QuotedMessageNode.
- **mailclient:** RecipientAliasDialog, RecipientAliasManager.
- **composition:** ComposeActions, ComposeConversionBoundary, ComposeFields, ComposeImageDropMenu, ComposeInlineCard, ComposeInviteSection, ComposeMessageField, ComposeMinimized, ComposeModal, ComposeOrchestrator, DetachedComposeWindowClient, SendWarnings, composeInitState, sendOutcome, useComposeController, useComposeTranslation, useDetachedSendWarnings, useDraftManager.
- **shell:** MobileFrames.module.css.
- **lib:** dateFormatting, deeplLanguages, html/index, html/quoteBoundary, i18n/useDeeplLanguageLabel (new).

### Catalog keys (de and en, identical structure)

- Leaf keys: 1,102 → 1,547, i.e. **+445**, with 0 removed and 0 renamed. de/en leaf parity: true.
- **Settings +256:** common 12, account 21, modal 8, mailto 6, signatures 8, recipientAliases 34, categorization 38, topics 40, translation 35 (incl. `languages`), mcp 33, calendar 21.
- **Compose +97:** generated 7, modes 6, fields 13, actions 9, draft 9, window 23, notices 13, warnings 4, attachments 5, invite 6, translation 2.
- **Editor +92:** placeholder 1, linkPrompt 1, toolbar 21, image 3, quoted 21, tabs 3, translation 9, signature 3, attachment 2, loading 4, markdown 24.
- **Errors +0:** the existing `Errors.sender.*` codes are reused.
- Changed values: only the German `Settings.sender.sharedTemplatesHelp`, which now points to „Persönliche Einstellungen“. No English value changed.

### Test files changed

Changes that only swap the import or add a provider wrapper:

- `ComposeEditor.imageDrop.dom.test.tsx` and `McpTabContent.dom.test.tsx`: `render` now comes from `lib/i18n/testRender`.
- `detachedSendWarnings.dom.test.tsx`: `I18nTestProvider` wrapper.
- `composeSenderInit.test.ts` and `ownAddressConsumers.test.ts`: pass `locale: "en"` to `computeComposeInitState`.

New test files: `ComposeEditor.i18n.dom.test.tsx`, `SettingsForms.i18n.dom.test.tsx`, `SettingsTabsB.i18n.dom.test.tsx`.

Extended: `ComposeHeader.dom.test.tsx`, `sendOutcome.dom.test.tsx`, `composeInitState.test.ts`, `quoteBoundary.test.ts`, `catalogs.test.ts`.

Browser specs:

- `tests/browser/auth/shell.spec.ts`: after the switch it expects the German dialog name and the German composer.
- `tests/browser/compose/qa-compose.spec.ts`: compose labels are now read from the catalogs.

## 3. Text-as-logic replacements

- Lexical toolbar items are keyed by stable IDs, not by their English `title`.
- Markdown-editor commands are localized by the library's command `name` (`commands` and `extraCommands`).
- Compose translation errors and detached-window errors are `{ code }` / `{ key }` states, translated at render time. Server text stays opaque.
- Attachment-blocked reasons, settings probe/test failures, CalDAV sync intervals, MCP expiry presets and topic signal types are codes or numbers rendered through ICU messages.
- Category labels are translated from stable category codes.
- DeepL target languages keep their protocol codes; `useDeeplLanguageLabel` provides the localized names.
- Sender error codes map to catalog IDs (`senderErrors.ts`) instead of English sentences.

## 4. Generated correspondence and boundary recognizers

`computeComposeInitState` requires `locale`, and `useComposeController` captures `useLocale()` when a draft is created. The German forms are:

- Attribution line: `Compose.generated.replyHeader`, „Am {date} schrieb {sender}:“.
- Forward header labels: `Compose.generated.forwardFields`.
- Forward separator: `FORWARDED_MESSAGE_MARKERS[locale]` in `lib/html/quoteBoundary.ts`, „-------- Weitergeleitete Nachricht --------“.

The recognizers (`FORWARD_SEPARATOR`, `HEADER_BLOCK_*`, `ATTRIBUTION_LINE`) accept both the English and the German forms.

Tests:

- `composeInitState.test.ts`, describe "localized generated correspondence", 5 cases:
  - German attribution with a Berlin-time date and the sender kept verbatim;
  - German attribution in the quoted header of rich replies and reply-alls;
  - English attribution for English drafts;
  - German forward separator and header labels, with subject prefixes kept as protocol text;
  - a saved draft's text is not regenerated in another UI locale.
- `quoteBoundary.test.ts`, describe "Noctua's own generated correspondence in every UI locale". For each catalog locale it checks the forward separator, the attribution line (also with braces and quotes in the sender) and the header block with and without the separator, plus the English constant for existing forwards.
- `catalogs.test.ts`: "generated correspondence keeps user text opaque and uses recognizable German markers", and "DeepL language names are localized by stable code".

The German browser pass shows the generated text:

- Reply: `Am 23.10.2026, 18:13 schrieb Synthetic Reader <reader@example.test>:`
- Forward: `-------- Weitergeleitete Nachricht --------` / `Von:` / `Datum: Fr., 23. Okt. 2026, 18:13 MESZ` / `Betreff:` / `An:`

## 5. MailClient.tsx hunks (98b4301..HEAD; none from this run)

All hunks are inside the component body, away from the imports:

1. Line 398: `const tcompose = useTranslations("Compose");`.
2. Lines 2564 and 2582: the discard-draft fallback `"Failed to discard draft."` becomes `tcompose("draft.discardFailed")`.
3. Lines 2602–2603: `tcompose` added to that callback's dependencies.
4. Lines 3207 and 3281: the list-level draft-send fallback `"Failed to send draft."` becomes `tcompose("notices.draftSendFailed")`.
5. Line 3214: `presentDraftSendOutcome(…, pushNotice, locale)`.
6. Lines 3308–3310: `tcompose` and `locale` added to that callback's dependencies.

## 6. QA-202 and QA-207 (commit b772bd9)

**Before** (QA sweep, 98b4301):

- The tab column was a fixed 112 px with `overflow-wrap:anywhere`. German labels broke mid-word („Persönlich/e Einstellung/en“, „Kategorisie/rung“, „Übersetzun/g“; tab heights 44/64/84 px).
- At 390 the sender-preference selects reached x=522–534 px, and x=380 at 360/320. English also overflowed at 390 (x=479–491).
- The footer was clipped and could not be scrolled into view: „Schließen“ showed as „ßen“ at 390, and „Einstellungen speichern“ was cut at 320.
- QA-207: the three sender-preference selects were 18 px tall on phones and 20 px on desktop.

**Changes:**

- **Tab rail** (`MobileFrames.module.css`): `width: min-content` capped at 45 %, so the rail is as wide as its longest single word. Labels use `overflow-wrap: break-word`. The trigger drops its horizontal padding, because the label layer already pads 8 px.
- **Content:**
  - `Field.tsx` exports `nativeControlClass` (`w-full min-w-0 rounded-md border bg-background p-2`). It is used by the Preferences, SenderPreferences (3 selects and the textarea) and Identities controls; Identities' local copy of the class was removed.
  - Fieldsets and grid items get `min-width: 0`. The sender fieldset gets `grid-cols-1` and drops the browser's default fieldset border/padding (no preflight), which sat inside the already bordered section.
  - Account form grids collapse to one column below Radix `sm`. The Translation heading row wraps.
- **Phone frame:**
  - Long Radix and ui-Button labels wrap inside their button; single-line buttons keep their height.
  - The Preferences footer and the member search row wrap.
  - Tab content uses `hyphens: auto`. Callout text may also break inside a word.
  - The members table scrolls horizontally in its own container.
- `doc/I18N.md`: the layout note was rewritten.

**After** (production build, German and English, every tab at 1440/390/360/320 plus the scrolled sender-section and footer states; 56 states per locale):

- 0 elements past the viewport, 0 clipped or covered buttons, 0 mid-word tab-label breaks. `document.scrollWidth` equals the viewport in every state.
- Rail width at 320/360/390: German 122 px (set by „Kategorisierung“), English 114 px. Tab heights are 44 px, except „Persönliche Einstellungen“ and „Empfänger-Aliasse“ (64 px, the second wraps after its hyphen) and English "Recipient Aliases" (64 px).
- Sender-preference selects are **36 px** at every width (QA-207). Their right edge is 295 at 320, 335 at 360, 365 at 390 and 1165 at 1440, always inside the panel. All 11 selects in the Preferences tab are 36 px.
- The Preferences footer is fully visible: „Schließen“, then „Einstellungen speichern“ wrapped to two lines at 320.

## 7. Remaining English or open items in scope, with reasons

- The `doc/I18N.md` "Remaining English after slice 3a" list still applies:
  - The reader translation bar uses the English DeepL label; it belongs to the next reader change.
  - Calendar RSVP send warnings lack the locale (calendar is owned by a parallel branch).
  - MailClient's list-level draft send shows `smtp_*` codes as server text (`readErrorMessage`).
  - `app/compose/window/page.tsx` handoff copy and the detached window title belong to slice 4.
  - Date-format preset specimens stay literal.
  - Server-originated messages, protocol tokens and example placeholders stay untranslated.
- The German pass found exactly one English UI string on compose screens: „Open calendar“ (title and aria-label) from `calendar/CalendarPopover.tsx:358`. That file is outside slice 3a (calendar branch).
- At 320 px, test Chromium has no German hyphenation dictionary. It breaks the placeholder token `{{identity.displayName}}` and „Berufsbezeichnungen“ inside the word instead of overflowing. Browsers with a dictionary hyphenate via `hyphens: auto`.
- The Members tab's role selects are still the unstyled 18 px native controls. QA-207 named only the sender-preference selects, and Members belongs to slice 2.

## 8. Gate results

- **Typecheck:** `bun run typecheck` → 0 errors, 1,248 files.
- **i18n tests:** `bun test lib/i18n` → 69 pass, 0 fail, 8,549 expect() calls, 7 files.
- **Focused settings DOM tests** (`account-settings` + `AccountSettings*`): 50 pass, 0 fail.
- **Full test:ci:** `env -u CLAUDECODE -u AGENT -u REPL_ID nice -n 15 timeout 1800 bun run test:ci` → exit 0. Server: 2,929 pass, 0 fail, 20,543 expect() calls, 315 files (533.21 s). DOM: 580 pass, 0 fail, 3,283 expect() calls, 76 files (86.65 s).
- **Lint:** `bun run lint` → exit 0, 0 errors, 179 warnings. Compared per file over all 62 TS/TSX files the branch touches, with the ESLint API (98b4301 content linted under its real path): base 0 errors / 138 warnings, now 0 / 136. Rules match file for file, except two fewer warnings in `useComposeTranslation.ts`. New files have 0. **No new findings.**
- **Build:** `nice -n 15 bun run build` → exit 0. The final build is of clean `b772bd9`.
- **Auth browser** (`PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-arm64 AUTH_BROWSER_USE_BUILD=1 AUTH_BROWSER_PORT=3861 bun run test:auth-browser`):
  - On clean `b772bd9`: exit 1, **19 passed, 1 failed** (8.0 m). The failing case is `shell.spec.ts:229`: the unsent inline reply is lost after the language switch.
  - This is the known 98b4301 regression that round 9 bisected and fixed in **97dd982** on integration/stage (`useApiErrorMessage` translator identity re-bootstraps the mailbox). This branch is based on 98b4301 and does not contain 97dd982; it was not added, because it is integration-owned.
  - Proof: 97dd982's one-file `useApiErrorMessage.ts` change was applied as an uncommitted working-tree patch (identical to the commit) and the app rebuilt. The focused `:229` run then passed (7.3 s), and the **full suite gave 20 passed (7.6 m), exit 0**. A separate English → German live-switch probe kept the unsent reply in every check from 0 to 3 s after the switch (`Betreff` = "Synthetic unsent locale draft", now German).
  - The patch was then reverted (`git apply -R`), the tree is clean, and the app was rebuilt for the following gates.
- **qa-compose** (`tests/browser/compose/qa-compose.spec.ts`, production build of clean `b772bd9` on 3862, sender-3 two-person seed via the runner copy): **8 passed (6.4 m)**, exit 0. This includes P2-E/P2-G in de and en, which an earlier agent's run had left as a 480 s `apiRequestContext.put` timeout.
- **German pass** (device cookie `de`, production build, chromium, de-DE). Results in sections 4 and 6:
  - Compose: new mail inline, From listbox, new mail in the modal, reply inline and in the modal, reply-all, forward, and mobile 320/390 compose with the From listbox.
  - Settings: all 11 tabs at 1440/390/360/320.
  - English cross-check: same pass with cookie `en`.
  - From options (de): „QA Shared <demo@monkeydent.test> (Postfachstandard)“.
- **Screenshots** (25 PNG, largest 204,361 bytes) in `ROOT/briefs/i18n-slice3a-evidence/`:
  - Compose: c01-new-inline-1440, c02-from-1440, c03-new-modal-1440, c04-reply-1440, c04-forward-1440, c05-reply-modal-1440, c06-mobile-320, c06-mobile-390, c07-mobile-from-320.
  - Settings at 320: all 11 tabs (`s-320-00…10`) plus the Persönliche Einstellungen sender section.
  - Settings at 390 and 1440: s-390-03 (top and sender section), s-1440-03, s-1440-01.
- **Bundle** (initial JS of `/`, firstLoadChunkPaths deduplicated, gzip level 6). The 98b4301 baseline was measured in this worktree before the first slice commit.
  - 98b4301: 24 assets, 2,141,750 raw / 662,899 gzip bytes.
  - b772bd9: 26 assets, 2,183,165 raw / 674,758 gzip bytes.
  - Delta: **+41,415 raw / +11,859 gzip (+1.79 %)**.
- **`git diff --check 98b4301..HEAD`:** exit 0.

## 9. Merge notes (`git merge-tree --write-tree HEAD <target>`, read-only)

**`origin/integration/stage`** — the target named in the brief is `e70c30b`; origin is now at `ab7a2f8`:

- Both targets conflict in one file, `tests/browser/compose/qa-compose.spec.ts`, with 4 hunks. Everything else auto-merges, including `shell.spec.ts` (the merged result keeps this branch's German assertions).
- The conflicts come from stage's `6e4bbcb`, which assumed compose labels were not localized yet. **Resolve every hunk with HEAD (this branch):**
  1. `openCompose(page, newMail, subjectLabel)` with the catalog subject label;
  2. the `chrome` / `draftSaved` catalog block (comment "Shell, reader and compose copy follow the UI language");
  3. `openCompose(page, chrome.newMail, copy.fields.subject)`;
  4. `getByLabel(copy.fields.subject)`.
- With stage's 97dd982 present after the merge, `shell.spec.ts:229` passes (see the auth result in section 8).

**`a864dfc`** (feat/status-bar-compact):

- One conflicted file, `messages/de.json`, with 2 hunks in the Shell status block (98b4301's `syncingScope`/`phases`/… against a864dfc's `folder`/`scope`/`process`/…).
- These hunks are **identical to `98b4301 x a864dfc`**: they predate slice 3a, belong to the integrator and come from a864dfc's older base 992b220. Merge them by leaf as in the earlier rounds.
- `app/components/shell/MobileFrames.module.css` **auto-merges with 0 conflicts**. a864dfc changes only the sheet-close rule, the `.desktopStatusBar` media query and the end of the file; b772bd9 changes only the tab-rail and tab-content rules (lines 25–58).

**`e7d00ee`** (feat/reader-focus, based on round-8 11dc3c5):

- 3 conflicted files, 1 hunk each, all **identical to `98b4301 x e7d00ee`**, so none is introduced by slice 3a:
  - `MailClient.tsx` imports: keep both sides (sender/startup-sync/folder imports and the ReaderToolbar/readerFocus imports).
  - `lazyAdmin.dom.test.tsx` retry wait: one of the two existing variants; neither is from this branch.
  - `playwright.qa-round2.config.ts` testMatch: union, `qa-admin-self-grant|qa-reader-focus`.
- The slice 3a MailClient hunks listed in section 5 auto-merge.

## 10. Housekeeping

- Worktree clean (`git status --short` is empty). No push, PR, rebase, reset, stash or checkout of another branch.
- Owned processes ran only on 3861/3862 and were stopped by their runners; ports 3860–3864 are free.
- The temporary `shell.spec.ts` diagnostics and the 97dd982 patch were reverted before the final build.
- `.tmp` removed at the end.
