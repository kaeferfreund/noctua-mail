# Review r1 — i18n slice 3a (feat/i18n-slice3 @ b772bd9)

One combined review: German UI correctness and layout regression. Read-only on the branch (no tracked file changed, no commit). Worktree `ROOT/wt-i18n-3`, production build of b772bd9, ports 3862/3863 only, synthetic fixture.

## Verdict: **FIX**, one P2

There is one P2 with a 3-line fix (below). Everything else meets the brief: catalog parity, no raw keys, no English left in the in-scope compose and settings screens, QA-202 and QA-207 fixed, and the German strings fit at 320–1440 px. Under rule 2 the P2 is fixed once in the branch and needs no separate verification. After that the branch can merge. Merging now and fixing the P2 on stage straight afterwards would also work, because the change is isolated.

## Findings

### P2

**P2-1: Every compose error notice in German has the English title "Operation failed".**
- Seen in the German pass: pressing Senden with no recipient shows the notice „Operation failed“ above „Füge mindestens einen Empfänger hinzu.“
- Cause: compose reports all of its notices through `reportError`. These include the empty-recipient and invite checks, the attachment blocks, the handoff and close-save failures, and the draft save/send failures (`ComposeOrchestrator.tsx:800`, `:863`, `:899`, `:907`, `:918`, …). The title is hard-coded in `app/components/mailclient/useReminderNotifications.ts:80` (`title: "Operation failed"`). The fallback at `:70` (`"Unexpected error."`) is also hard-coded.
- The brief puts the "send/draft notices" in scope, and integration/stage (45060d0) still has the same literal.
- Minimal fix:
  - Add `Notifications.operationFailed` („Vorgang fehlgeschlagen“ / "Operation failed") and `Notifications.unexpectedError` („Unerwarteter Fehler.“ / "Unexpected error.") to both catalogs.
  - In `useReminderNotifications.ts`, add `const tn = useTranslations("Notifications")`, use `title: tn("operationFailed")` and `tn("unexpectedError")` as the fallback, and add `tn` to the `reportError` dependencies.
  - The hook runs inside MailClient, so a provider is present.
  - Check with `bun test lib/i18n` plus the existing focused DOM tests.

### P3 (for briefs/BACKLOG.md, no fix round)

- **compose/invite | English in the German invite form.** „Termineinladung hinzufügen“ → Einladung erstellen shows "Start", "End", "All day", "Repeat", "Does not repeat", "Location", "Location (optional)" and the aria-labels "Start time", "End time" and "Open time picker". These come from `calendar/CalendarEventScheduleFields` and `calendar/TimePicker.tsx:204`, which belong to the calendar branch. `doc/I18N.md` lists them only generally, as calendar "time-picker controls". The report's "remaining English" list names only „Open calendar“. They should go on the calendar branch's list explicitly, because they show inside compose.
- **compose | „Antwort auf:“ label on forwards.** The forward composer also labels the referenced message „Antwort auf:“ / "In Reply To:" (`ComposeFields.tsx:300`, `Reader.inReplyTo`). This behaviour existed before the branch. `Reader.forwardedMail` exists and would fit.
- **settings/320 | Topics: a label is clipped by about 9 px.** At 320 px „Themenfarbe au[f] Nachrichtenzeile[n] anwenden“ is cut at the right edge; the panel scrolls 9 px sideways (155 > 146). In the same tab, „Themenzuordnungen“ pushes its comma onto a new line. The test Chromium has no German hyphenation dictionary, so `hyphens: auto` does not apply here (the report already notes this). Browsers with a dictionary will probably hyphenate it.
- **settings/320 | Account tab: the heading is 4 px too wide.** „IMAP (Posteingangsserver)“ is 166 px in a 162 px column, so the panel scrolls 4 px sideways. Same cause as above.
- **settings/phones | Preferences fieldset keeps the browser's default border and padding.** The upper preference fieldset in `PreferencesTabContent.tsx:71` still has the default fieldset border and about 14 px padding. The sender fieldset dropped them in this branch (`m-0 border-0 p-0`). At 320 the selects therefore show only „Postfachvorgab…“. Using the same classes would align it.
- **QA-207 follow-up | select height.** The sender-preference selects are now 36 px, like the other selects in the tab, which fixes the reported inconsistency. QA-207 also asked for at least 44 px on phones, which no select in the tab meets yet. The Members-tab role selects are still the unstyled ~18 px controls (slice 2, as the report says).
- **settings/members phones | The table scrolls sideways.** At 390/360/320 the role column and the „Entfernen“ buttons are only reachable by scrolling horizontally inside the table container (374 px content in a 154–224 px container). This is intended and documented, but nothing on screen signals the scroll.
- **catalog | „Speichert …“ vs „Wird gespeichert …“.** `Compose.actions.saving` („Speichert …“) differs from `Compose.draft.saving` and `Settings.common.saving` („Wird gespeichert …“). Also `Compose.actions.sending` („Sendet …“).
- **i18n | `hyphens: auto` covers all settings tab content.** On phones (`MobileFrames.module.css`, `.settingsBody .rt-TabsContent`) it also covers user text such as identity names and signature previews. This is harmless in practice and noted only for awareness.

## Checks and gate numbers

| Gate | Result |
|---|---|
| `bun check` | 0 errors, 1,248 files |
| `bun test lib/i18n` | 69 pass, 0 fail, 8,549 expect(), 7 files. de/en leaf parity true, 445 new keys (1,102 → 1,547), 0 removed |
| Lint, 62 touched TS/TSX files (ESLint API, base content linted under its real path) | head 0 errors / 136 warnings, base 0 / 138; no new rule hits in any file |
| `bun run build` | exit 0 (clean b772bd9) |
| Focused DOM tests (8 changed/new `*.dom.test.tsx` + `account-settings` + `AccountSettings*` + `mailclient/composition`) | 350 pass, 0 fail, 31 files |
| Focused non-DOM tests changed by the branch (`composeInitState`, `quoteBoundary`, `catalogs`, `composeSenderInit`, `ownAddressConsumers`) | 115 pass, 0 fail, 5 files |
| `qa-compose.spec.ts` (production build, two-person sender seed via a runner copy in `.tmp`) | **8/8 passed**, including P2-E/P2-G in de (3.1 m) and en (2.1 m) |
| `qa-shell.spec.ts`, standard runner `scripts/runQaShellBrowserTests.ts` | 4/4 passed. In the combined run with the two-person seed, QA-004 failed: that seed already makes person 2 a member, so the "add existing user" select has no option for them. Fixture artefact; it passes on the standard seed. |
| `qa-translation.spec.ts` | 1/1 passed |
| `qa-i18n-views.spec.ts` (settings tabs wrapped in both locales, sidebar rows, detached folder tooltips) | 3/3 passed |
| auth `shell.spec.ts:229` | not run; known and fixed on stage by 97dd982 (per the brief) |

### Probe of the German UI (review-only Playwright spec under `.tmp`, production build)

- **Settings:** all 11 tabs × top/bottom scroll × 1440/390/360/320 × light/dark, in de and en (176 states per locale).
  - 0 raw catalog keys.
  - 0 English catalog strings in de and 0 German strings in en.
  - `document.scrollWidth` equals the viewport everywhere.
  - Tab rail at phone widths: de 121 px, en 113 px. Tabs are 44 px; „Persönliche Einstellungen“ and „Empfänger-Aliasse“ are 64 px. No label breaks inside a word.
  - The footer („Schließen“, „Einstellungen speichern“, „Postfach löschen“) is fully visible at every width.
  - The only overflow hits are the Members table scroll container (intended) and the two 320 px P3s above.
- **Compose:** new, reply, reply all and forward, inline plus modal at 1440 and inline at 390/360/320, light and dark, de and en (40 states per locale).
  - 0 raw keys, 0 leftovers, 0 controls outside the viewport, 0 clipped buttons.
  - The only overflow hits are intended truncations: the long subject in „Antwort auf:“ and the From trigger value, which is nowrap with a title.
- **Generated text in German:**
  - Reply: „Am 23.10.2026, 19:51 schrieb Synthetic Reader <reader@example.test>:“
  - Forward: „-------- Weitergeleitete Nachricht --------“ / Von / Datum „Fr., 23. Okt. 2026, 19:51 MESZ“ / Betreff / An
  - The subject prefixes Re:/Fwd: stay as protocol text.
- **Text dump of the German compose:** HTML toolbar, Markdown toolbar (all commands German, „Strg“/„Umschalt“), Signatur menu, Von listbox, Cc/Bcc, invite, empty send, and reply/forward in HTML.
  - English found only in „Open calendar“ (known, calendar), the invite schedule fields (P3) and „Operation failed“ (P2-1).
- **QA-202:** fixed. At 390, 360 and 320 the selects, the sender fieldset and the footer stay inside the panel, and tab labels wrap between words.
- **QA-207:** the three sender selects are now 36 px. The 44 px phone target is a P3 above.

## Merge with origin/integration/stage (45060d0)

`git merge-tree --write-tree origin/integration/stage b772bd9` gives tree `97e7193…` with **2 conflicted files**. The report found one; the second is new because stage moved on.

1. **`tests/browser/compose/qa-compose.spec.ts`**, 4 hunks against stage 6e4bbcb. **Take the branch side in all hunks.**
   - Verified: the branch side contains every change from stage 6e4bbcb:
     - the `catalog`/`chrome` block with the Shell/Folders/Reader labels;
     - `openCompose(page, newMail)`, extended with `subjectLabel`;
     - `chrome.toggleSidebar`, `chrome.drafts` and `chrome.editDraft` in `reopen()`.
   - It adds the compose catalog labels on top.
   - The resolved file is byte-identical to the b772bd9 version, so stage's localized label changes are kept.
2. **`lib/i18n/catalogs.test.ts`**, 1 hunk, new since the report: stage 4212f6b added the test "reminder leads read in whole minutes, hours or days in both locales" in the same place where the branch added "generated correspondence…" and "DeepL language names…".
   - **Keep both:** stage's test, then its closing `});`, then the branch's two tests. Both sides share the final `});`.
   - Verified on an exported merged tree with that resolution: `bun test lib/i18n` 70 pass / 0 fail (8,671 expect()); `bun check` 0 errors (1,283 files).

All other files auto-merge, including `MailClient.tsx`, `MobileFrames.module.css`, `doc/I18N.md`, `messages/de.json`, `messages/en.json` and `shell.spec.ts`.

## Evidence

Screenshots (de) are in `ROOT/briefs/i18n-slice3a-review-r1/` (61 PNG, 4.2 MB):
- Settings at 1440: every tab at the top, plus the bottom of „Persönliche Einstellungen“.
- Settings at 390: every tab, top and bottom.
- Settings at 320 dark: every tab.
- Compose new, reply, reply all and forward: inline and modal at 1440, inline at 390, inline at 320 dark.

## Housekeeping

- No tracked file changed; `git status --short` is empty.
- Own servers ran on 3862/3863 only and were stopped by their runners. A hung probe run was stopped by PID. Ports 3860–3864 are free.
- `.tmp` (runner copy, probe specs, merged-tree export, logs) was removed at the end.
- No push, commit, deploy or restart.
