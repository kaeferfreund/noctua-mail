# Mobile reading view compact — report (2026-10-23)

Branch `fix/mobile-reader-compact`, commit `83b4d77a` on top of integration/stage `7425f75`.
Worktree: `ROOT/repo/wt-mobile-reader` (the brief named `ROOT/wt-mobile-reader`; that path does not exist, the branch's worktree is under `repo/`). Not pushed, not merged, not deployed.

## Result (synthetic HTML mail with blocked remote images, 2-line subject, collaboration bar)

| Viewport | Body starts at y (before → after) | Share of height |
|---|---|---|
| 390×844 (dark + light) | 551 → **372** | 65 % → 44 % |
| 360×740 (dark + light) | 551 → **394** | 74 % → 53 % |
| 1440×900 desktop | 355 → 355 | unchanged |

The "before" 390 px screenshot matches the user's iPhone screenshot row for row. The synthetic sender address is longer than the user's example (XTB), so it takes a second line under the name. With a shorter address like the user's, name, address and date fit on one row, and the body starts about 18 px higher. No horizontal scrolling at any width.

## Changes (only below the existing 768 px phone breakpoint; desktop/tablet markup unchanged)

- **Back row**: "← Zurück" and the Kompakt/Vollständig toggle share one row. The toggle renders there on phones only (`useIsMobile`) and stays in the subject row on desktop.
- **Subject**: clamps to 2 lines instead of 3, and the existing chevron still expands it.
- **Collaboration bar**: one row. "0 Notizen" becomes a speech-bubble icon with the count, and "Interne Notiz" becomes an icon button. Accessible names are unchanged ("n interne Notizen", "Interne Notiz"). The assignee truncates if the row is tight.
- **Message card**: the action icons share the row with the chevron and badges (there is no longer an empty row). They only move to their own row if the badges really need the space. Gaps on phones are tighter.
- **Sender/date**: the date sits on the sender row. The "Von:"/"Datum:" labels are visually hidden on phones but stay available for screen readers and print. "An:" is unchanged.
- **External-content banner**: one row with the short visible labels "Laden" / "Immer laden" (en: "Load" / "Always load"). The accessible names are still the full texts, and the full labels stay on desktop. The text wraps inside the row at 360 px. The unknown-sender note and errors get their own line.
- New i18n keys `Reader.loadOnceShort` and `Reader.alwaysLoadSenderShort` in de and en.
- Touch targets: the new icon buttons are 32 px, and the back row is still 44 px. The other controls keep their previous sizes.

## Gates

- `bun check`: 0 errors (1,302 files).
- Lint on touched files: 0 errors, and no new warnings. `MessageViewOrchestrator.tsx` has the same 8 pre-existing react-hooks warnings as on base. The other files are clean.
- Focused DOM tests (Collaboration, HtmlMessage privacy/memo, MessageRecipientMetaField, ReviewCorrections, i18n migration, ReaderLocale, ThreadSubject, readerFocus, readerNavigation, useMobileNavigation): 97 pass, 0 fail. `lib/i18n/catalogs.test.ts`: 14 pass.
  - `lib/i18n/migration.dom.test.tsx` was adjusted: the note-count button now contains both the phone and the desktop label, so the test checks the localized label inside the button instead of the button's whole text.
- `bun run build`: succeeded (it runs as part of the QA runner).
- Browser evidence: new `tests/browser/ui/qa-mobile-reader.spec.ts`. It runs with `QA_SHELL_PORT=3940 QA_SHELL_SPEC=qa-mobile-reader.spec.ts bun scripts/runQaShellBrowserTests.ts`, and `MOBILE_READER_ASSERT_BODY=1` adds the check that the body starts below 45 % of the height at 390 px. It passed. Only port 3940 plus OS-assigned fixture ports were used, and the scratch storage was removed.

## Evidence (`briefs/mobile-reader-evidence/`)

`before-` / `after-` × `390-dark`, `390-light`, `360-dark`, `360-light`, `1440-light` (.png), plus `before.json` / `after.json` with the measured y-positions.

## Notes

- The HTML body looks dim in the dark screenshots in both the before and after runs, so this change did not cause it.
- Not addressed (possible follow-ups): the 14 px message action icons keep their previous small hit areas, and long sender addresses still break mid-word on phones (existing `overflow-wrap: anywhere`).
