**PIN+fix — include in integration round 9 with the three P2 fixes below.** No P1 or changed query/protocol behavior found. The fresh CI run is **not green**: its only failure also reproduces on integration round 8.

Reviewed 79283b2 and 992b220 against 11dc3c5, using the clean detached checkout at 992b220bd65d8fcb3540b58a3a835d48d47a0e2e. Source remained unchanged. Builds, fixtures and probes ran in a disposable copy under the permitted regression directory.

All 150 added German keys were reviewed against their English counterparts and doc/I18N.md. Du-form, capitalization, Leser/Bearbeiter/Verwalter, Erledigt and Gemeinsame Postfächer are consistent. Most copy is natural. Current sidebar view names fit at 320 px; the German settings tab labels do not fit their rows correctly.

The exact recommended German corrections are:

- Settings.tabs.account → "Postfach"
- Views.focused.name → "Ungelesen & unbeantwortet"
- Views.focused.badgeLabel → "Ungelesen & unbeantwortet"
- Views.actionQueue.name → "Markiert & Aufgaben"
- Views.inviteDeck.name → "Kalendereinladungen"
- Views.unassigned.description → "Hier findest du noch nicht erledigte Threads, die niemandem zugewiesen sind."
- Shell.status.modes.recent → "Synchronisierung der letzten Nachrichten"
- Shell.refreshDescription → "Eine neue Version ist verfügbar. Sie ist möglicherweise mit deiner aktuellen Sitzung nicht kompatibel."
- Shell.refreshMandatory → "Lade die Seite neu, bevor du fortfährst. Neue Version: {version}."
- Shell.status.upcomingSummary → "{count, number} · {title} · {dateTime}"
- Shell.status.syncingFolders → "{more, plural, =0 {„{folder}“ wird synchronisiert …} one {„{folder}“ und # weiterer Ordner werden synchronisiert …} other {„{folder}“ und # weitere Ordner werden synchronisiert …}}"

“Fokus” does not explain unread AND unanswered AND non-newsletter to a household user. “Aufgaben” hides the flagged-message part of flagged OR todo OR done. Their descriptions correctly explain those predicates; “Wichtig & unbeantwortet” would incorrectly imply importance classification. Prefer the explicit names above, retaining the newsletter exclusion in the description. “Kalendereinladungen” distinguishes this view from administrative invitations.

Do not apply the longer names without adapting the rows: the proposed focused name measures 199 px in the emphasized font, while the current 320 px sheet is only 240 px wide and also reserves space for an icon and count. Allow labels to wrap without overlap and use compact numeric badges, retaining descriptive aria labels. All 11 proposed messages parse as ICU; the folder message was rendered with 0, 1 and 2 additional folders.

Findings:

- **P2 — German settings tabs overlap on phones.** [AccountSettingsModal.tsx:139](/home/monkey/code/noctua-mail/wt-review-collab/app/components/AccountSettingsModal.tsx:139), [MobileFrames.module.css:34](/home/monkey/code/noctua-mail/wt-review-collab/app/components/shell/MobileFrames.module.css:34). Repro: German → Einstellungen at 320 or 390 px. “Persönliche Einstellungen” occupies a 68 px label inside a 44 px trigger; its label extends from y=145.4 to 213.4, while “Kategorisierung” starts at y=199.4. Text overlaps by 14 px. Fix the mobile trigger/inner-label sizing so rows grow with wrapped labels and do not shrink below their contents. Evidence: de-settings-320.png and browser-findings.json.

- **P2 — Detached reader hover paths remain untranslated.** [FolderBadges.tsx:31](/home/monkey/code/noctua-mail/wt-review-collab/app/components/mailclient/folder/FolderBadges.tsx:31), [message/window/page.tsx:383](/home/monkey/code/noctua-mail/wt-review-collab/app/message/window/page.tsx:383). Repro: open a fixture INBOX message through /message/window in German. Its folder button has aria-label="Posteingang" but title="INBOX"; the main shell uses “Posteingang” for both. The detached caller still strips the account ID from the raw path. Reuse a shared locale-aware folder-path helper in both callers, preserving raw IDs for operations. Evidence: de-detached-folder-path.png.

- **P2 — Move notices disagree with the localized picker.** [useMessageMoveActions.ts:370](/home/monkey/code/noctua-mail/wt-review-collab/app/components/mailclient/useMessageMoveActions.ts:370). Repro: choose “Gesendet” from the German move menu. The notice says “3 Nachrichten werden im Hintergrund nach „Sent“ verschoben.” The existing raw-name lookup was missed by this migration. Resolve the destination through getFolderDisplayName(folder, locale), including the locale dependency; keep user-created names literal. Synthetic moves were undone. Evidence: browser-findings.json.

- **P3 — Copy and filter discoverability.** [de.json:1112](/home/monkey/code/noctua-mail/wt-review-collab/messages/de.json:1112). Apply the correction list. In particular, the unassigned predicate excludes closed threads, which its description omits; upcomingSummary inserts “um” before a combined date/time; syncingFolders places the extra folders after an already completed singular clause. Update exact-copy assertions when changing labels.

- **P3, existing baseline — Lazy-admin cancellation assertion races effect cleanup.** [lazyAdmin.dom.test.tsx:201](/home/monkey/code/noctua-mail/wt-review-collab/app/components/mailclient/lazyAdmin.dom.test.tsx:201). Fresh CI observed idleTasks.size=2 instead of 1 after the Admin button disappeared. Three isolated runs each of 11dc3c5 and 992b220 produced fail/pass/pass with the same assertion. A separate nine-case suite passed. Wait for the expected idle-task cleanup before asserting, retaining the exact count and cold-import checks. This is not established as an i18n regression.

The text-as-logic audit found no new comparisons on translated name, badgeLabel or description. Views branch on virtual IDs and query badge codes; search field summaries use booleans and field IDs. data-view-id, data-folder-id and data-watcher-state provide stable selectors. Existing raw-name heuristics remain protocol/discovery logic, outside the display-name helper.

Both catalogs contain 1,018 leaf keys, with exactly 150 additions each and no duplicate JSON keys. Full key and ICU argument/rich-tag parity tests cover every leaf. Admin.invites and Views.inviteDeck are separate keys and have no structural collision. All new English entries are present; the pre-existing English Shell.loading.mailbox value is still German (“Postfach hinzufügen”).

Special-use display names depend only on the case-insensitive specialUse flag, including \Junk/\Spam. Flagless custom names remain literal. Searching both displayed and raw names is correct: it supports what users see and existing IMAP names. Browser searches for “Gesendet” and “Sent” both found the same folder. Folder IDs, operations, counts and “8 insgesamt” were preserved. The mobile sidebar uses the same names. The detached tooltip and move-notice exceptions are listed above.

Independent gates, all shell workloads at nice -n 15:

- Typecheck: exit 0; no type errors in 1,198 files.
- Catalog and folder-name tests: 17 pass, 0 fail; 5,174 assertions.
- Requested affected suite: 227 pass, 0 fail across 27 files, three fresh runs: 12.74 s / 13.13 s / 11.77 s.
- Additional full DOM runs: 467/0, 466/1, 467/0; 97.82 s / 114.21 s / 89.14 s. The middle run timed out on lazy-admin role cancellation.
- Fresh timeout 1800 bun run test:ci: exit 1. Server: 2,814 pass, 0 fail across 305 files, 16,959 assertions, 618.91 s. DOM: 466 pass, 1 fail across 59 files, 2,746 assertions, 82.06 s; only the baseline cancellation race above.
- Focused lazy-admin recheck: 9 pass, 0 fail; 22.58 s.
- timeout 600 bun run lint: exit 1; baseline 1 error / 25 warnings. The error remains useCalendarConflicts.ts:58, react-hooks/set-state-in-effect; no added lint finding identified.
- timeout 1200 bun run build: exit 0; compilation, TypeScript, static generation and standalone preparation completed.
- git diff --check: exit 0.

An earlier CI attempt overlapped replacement of the probe’s dependency symlink and had missing-module failures; it is not treated as product evidence. The initial build also rejected the external dependency symlink. Both were rerun after copying dependencies into the probe. No assertion or timeout was relaxed.

The browser pass used the built app on 3895 and the actual dev fixture on 3897–3899, with a synthetic admin completing password/TOTP authentication. Both locales exercised all seven view rows, list/window titles, chips, descriptions, folder names, settings and admin tab names at 1280 and 390 px. A live English-to-German preference switch retained query “Example” and changed “in all fields / in Inbox” to “in allen Feldern / im Ordner „Posteingang“”. German layout was additionally inspected at 320 px. Twenty screenshots and machine-readable observations are retained in the regression directory. This pass found the P2 issues; it is not an all-clear browser gate.

Merge checks followed git fetch origin and used git merge-tree --write-tree <target> 992b220:

- origin/integration/stage at 11dc3c5: exit 0; no conflict files or hunks.
- origin/feat/sender-identities-3 at e63a3062eee2c866718211be50127766e77c1f86: exit 1; five files, twelve conflict hunks:
  - AccountSettingsModal.tsx, four hunks: put "use client" before both imports; retain both translation hooks; retain the identities tab alongside localized existing tabs; combine both dependency additions and preserve the sender branch’s preferences-first fallback.
  - PreferencesTabContent.tsx, two hunks: combine ReactNode and next-intl imports; retain the !senderPreferences condition around the localized signature control.
  - lib/mail/resyncMessage.senderKey.test.ts, two hunks: choose one subprocess-isolation wrapper and use it consistently for both real-IMAP cases. Preserve original assertions and the CI timeout; do not combine the two child-environment conventions. These overlap inherited integration work.
  - messages/de.json, two hunks: merge Settings.sender with the complete members/preferences/roles/tabs objects by leaf; merge Compose.sender, Errors.sender and sender flags with all existing namespaces and Views/Folders. Do not take either whole side.
  - messages/en.json, two hunks: perform the identical structural union and rerun catalog/ICU parity.
- origin/fix/admin-mailbox-self-grant at b6c1ba94019dad49410dba7df623ece2f10a26a8: exit 1; one conflict hunk in lib/i18n/catalogs.test.ts. Keep the complete self-grant test and both new views/ICU tests as separate closed test blocks; the shared trailing braces must not be reused across them.
- origin/feat/reader-focus and origin/feat/status-bar-compact: absent after fetch and successful exact-head remote lookups; no merge comparison possible.

No merge resolution, source fix, commit or push was made. Owned app/fixture PIDs were stopped explicitly; 3895–3899 have no listeners and the preview tab is closed. The review checkout is still clean.

Load average: start 2026-10-23 09:46:50 UTC — 21.46 / 19.77 / 22.57; end 10:10:31 UTC — 13.56 / 16.70 / 19.85.

Report: [i18n-views-review-r1.md](/home/monkey/code/noctua-mail/briefs/i18n-views-review-r1.md). Evidence: [regression directory](/home/monkey/code/noctua-mail/briefs/i18n-views-regressions-r1).
