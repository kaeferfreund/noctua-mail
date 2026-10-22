# message-header-overlap: report

Branch `fix/message-header-overlap` = `b65b565` on `287da5e` (fix/ui-font-consistency). Implemented by
`message-header-overlap-r1` (Opus 5.5 high, claude-judith). The task died on the account's session limit
right after committing; the orchestrator finished verification and wrote this report.

## What changed

- **Message card header (From/Date):** the From value could not shrink (`min-width: auto` around a nowrap
  address button), so a long display name ran under the date and pushed the copy button onto its own line.
  The addresses now get their own clipping box, the copy button follows the visible text, the date keeps
  its natural width. When there is no room for a short sender beside the date, the date wraps below From.
- **Truncation order:** in a tight row the e-mail address gives way before the display name (From and
  To/Cc). The name truncates only at its max-width once the address is gone. Full values stay in the
  tooltip, hover card and copy.
- **Collapsed thread summary:** the sender truncates with an ellipsis instead of being clipped.
- **Thread list rows:** badges could not shrink and spilled over the date; the fixed 140 px sender column
  pushed the actions out of narrow rows (compose open). The subject cell clips its badges
  (`overflow-x: clip`, no scroll container) and the sender column may shrink to 30 % of the row.

Files: `EmailAddressMenu.module.css`, `MessageRecipientMetaField.tsx` (+ new DOM test),
`ThreadMessageCard.module.css`, `ThreadMessageCard.tsx`, `MessageThreadList.module.css`.

## Verification

- `test:ci` on the branch: 1683 unit + 71 DOM pass. New DOM test fails against the old markup.
- `bun check`: only the pre-existing `bun:test` type-declaration diagnostics (+1 for the new test file).
- Merged into `polish/ui-bundle` (`a0a01ea`): 1752 unit + 111 DOM pass.
- Chromium measurements (synthetic fixture, long sender name), final code, light and dark:

| Shot | Date overlaps sender | Copy button on sender line | Badges over date |
|---|---|---|---|
| reader 1150 px | no | yes | 0 |
| reader 800 px (+ expanded) | no | yes | 0 |
| reader 500 px (+ expanded) | no | yes | 0 |
| reader minimum (320 px, expanded) | no, date wraps below From | yes | 0 |
| phone 390 px | no | yes | 0 |
| list with compose open, 1440 px | – | – | 0 |

Before (same shots on `287da5e`): sender ran under the date at 800/500 px and at minimum width, copy
button on its own line, list dates and badges overlapping.

Screenshots: `briefs/message-header-overlap-screens/{before,after}-*.png`.

## Known limits

- At the narrowest list width (list pane ~320 px) the single-line row still does not fit completely: the
  trailing ⋮ button sits slightly past the row edge (22 rows in the 800 px reader shot). Dates and badges no
  longer overlap. A proper fix needs a container-query stacked row layout — larger refactor, not done.
- In the To row at minimum reader width the copy icon can still wrap onto its own line (pre-existing,
  same class as the From issue, left as is).
