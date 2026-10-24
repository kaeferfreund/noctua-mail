# Mobile reading view: less wrapping, more mail content (fast lane, AGENTS.md rule 3)

User request 2026-10-23 ~18:40 UTC (iPhone, 390 px class viewport, dark theme): "Das mobile Design ist noch nicht optimal. Wir haben zu viele Umbrüche und deswegen sieht man kaum Mail-Inhalt." Screenshot: `briefs/mobile-reader-evidence/user-iphone-before.png` (look at it first).

Worktree `ROOT/wt-mobile-reader`, branch `fix/mobile-reader-compact` (from integration/stage 7425f75). Run `bun install` first. Ports for your servers/fixtures: 3940–3949.

## What the screenshot shows (top to bottom, before the mail body starts at ~60 % of the screen)
1. App header "Manuel / Posteingang" + search + activity icon.
2. "← Zurück" on its own row.
3. Subject (wraps to 2 lines) + chevron.
4. "Kompakt | Vollständig" toggle on its own row, right-aligned.
5. "Nicht zugewiesen" + "Offen" + "0 Notizen" on one row, then "Interne Notiz" wrapping onto a further row.
6. Message card: collapse chevron + "Seen" badge + inbox icon row, then a mostly empty row with the action icons (reply, reply-all, forward, search, delete, AA, more) right-aligned.
7. Von / Datum / An on three rows.
8. "Externe Inhalte blockiert" + "Einmal laden" + "Von diesem Absender immer laden" over two rows.

## Goal
On phones (≤ 640 px, check 390 px and 360 px) the first screen of an opened mail shows clearly more body content: target the body starting in the upper ~40 % of a 390×844 viewport for a typical mail. Desktop/tablet layout stays as it is.

## Direction (you decide the details, keep it simple)
- Merge rows instead of stacking: e.g. back button, Kompakt/Vollständig and the collab controls (assign, status, notes, internal note) into one or two compact rows; the "Interne Notiz" button can go into the notes control or an overflow menu on phones; shorter labels/icons with aria-labels/tooltips are fine.
- Put the message action icons on the same row as the chevron/"Seen" badge (no empty row); move secondary actions into the existing "more" menu if space is short.
- Sender/date/recipient compact (e.g. date on the sender row, "An" small) — full details may stay behind the existing expand.
- External-content banner as one compact line (shorter text, buttons inline or in a small menu).
- No horizontal scrolling, no truncated controls that become unusable; touch targets stay usable (~40 px).
- German labels stay German; new strings via the existing i18n catalog (de + en).

## Done when (self-check, no reviewer task)
- `bun check` 0 errors; lint 0 new errors/warnings on touched files; focused DOM tests for touched components green (update tests that assert the old structure, do not delete coverage).
- `bun run build` succeeds.
- Screenshots before/after with synthetic data (existing QA fixture, see `doc/SHELL.md`) at 390×844 and 360×740 (dark and light) plus one desktop 1440 px screenshot proving desktop is unchanged; save under `ROOT/briefs/mobile-reader-evidence/`.
- Commit(s) on `fix/mobile-reader-compact`; short report `ROOT/briefs/mobile-reader-report.md` (what changed, before/after "body starts at y = …" at 390 px, gates). Do not push, merge or deploy — the orchestrator does that.

Rules: `ROOT/briefs/_rules-common.md` (ROOT=/home/monkey/code/noctua-mail).
