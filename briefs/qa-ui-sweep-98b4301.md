# UI/UX QA sweep — 98b4301 (round-9 candidate, preview 8.9)

Read-only QA on 2026-10-23 UTC against `98b4301` ("fix(integration): keep upcoming relative-time grouping pure during render"), branch `qa/ui-sweep-98b4301`, worktree `/home/monkey/code/noctua-mail/wt-qa-sweep3`. Two agents ran it. The first one (run r1) stopped at a provider session limit during the viewport matrix. A second agent took over the same fixture, server and seed (all still healthy), finished the remaining scope and wrote this report. No tracked files were modified and nothing was committed.

**QA-101, QA-102 and QA-103 all pass with their original steps. 18 new findings: 0 P1, 3 P2, 15 P3.** No hydration warnings and no page errors in any captured console. Known issues listed in the task are in the "Known" section and were not investigated further.

## Setup and coverage

- Build: the tracked source was copied to `.tmp/build` because the build writes `public/build-version.json`. `nice -n 15 bun run build` passed on Next 16.4.2. The app served `.next/standalone/server.js` (with `.next/static` and `public` copied) on **3875**.
- Fixture: own synthetic fixture with IMAP **3877**, an internal SMTP sink on **3876** and control on **3879**. A small SMTP line proxy on **3878** sends synthetic rejections: `MAIL FROM:<reject-*>` → 553, `RCPT TO:<bounce-*>` → 550, `RCPT TO:<tempfail-*>` → 451. Seed `qa-sweep3`: about 300 INBOX messages (110 unread at start), a 14-message thread "QA Langer Thread – Abstimmung Praxisumbau", long subjects, non-ASCII (umlauts, ß, CJK, Greek, French diacritics), HTML, PDF/PNG attachments and a calendar invite.
- Data: `NOCTUA_DATA_DIR` was `.tmp/qa-shell-sweep3/data`, which is stricter than the `.env.local` default. Watcher enabled. No external mail server, no port 3790, no other worktree.
- Users: Alex (admin) is manager of QA Private and QA Shared. Jo (editor) is on QA Shared only. Sign-in used real production Better Auth endpoints with TOTP, and the browser login/TOTP UI was also tested in German.
- Sender identities on QA Shared:
  - mailbox default QA Shared `<demo@monkeydent.test>`
  - QA Team `<team@monkeydent.test>` with reply-to and "Team-Signatur"
  - "Abgelehnter Alias" `<reject-alias@example.test>`, rejected by the proxy
  - "Bald inaktiv", disabled
  - Alex's personal default: QA Team
- Playwright (Chromium headless): `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-arm64`, `nice -n 15`, browser locale `de-DE`.
  - r1 used browser timezone UTC at first and switched to `Europe/Berlin` from scenario s10 on.
- Viewports: all six (1440×900, 1280×720, 834×1112, 390×844, 360×780, 320×568) in light and dark, covering list, reader (long subject), phone sidebar, Settings → Persönliche Einstellungen with all tab labels, and Admin → Postfächer. That is 12/12 configurations without script errors. Login was also checked at 1440 dark and 320 light.
- Keyboard-only on desktop: login/TOTP tab order, identity creation, Admin → create mailbox → self-grant, Settings Escape, admin layering Escape.
- No unit/integration test gates were run. This is a UI sweep, so the `env -u CLAUDECODE -u AGENT -u REPL_ID` wrapper did not apply.

## Verification of QA-101..QA-103 (from the 9424150 sweep)

| ID | Original steps | Result | Evidence | Screenshot |
|---|---|---|---|---|
| QA-101 | 1440×900 dark, watcher + SSE active. Start at 110 unread, open single message "QA synthetic 014", Message actions → Mark as read. Compare API, mailbox summary, Inbox view, folder tree. Reload, inject one unread message, repeat with 015, sample for 10 s. | **FIXED** | Both trials: exactly one `POST …/flags {flag:"seen",value:true}` → 200. API, summary, mailbox row, Inbox view, Focused and tree all went **110→109** and stayed at 109 through 10,008 ms. Reload agreed. The injected unread message restored **110** everywhere in about 3.1 s (folder total 300→301→302). | [qa101-014-settled-1440-dark.png](qa-ui-sweep-98b4301/qa101-014-settled-1440-dark.png), [qa101-015-settled-1440-dark.png](qa-ui-sweep-98b4301/qa101-015-settled-1440-dark.png) |
| QA-102 | Admin → Mailboxes → Create mailbox; enter name (pointer, then keyboard with email); resize 1440→390→1440. | **FIXED** | Pointer and keyboard runs: create dialog count 1→1→1, Close-admin 1. Name "Synthetic unsent mailbox" / "Synthetic keyboard mailbox" and email `keyboard@example.test` survived both resizes. Escape closed only the create dialog (create 0, admin 1). No console errors. | [qa102-create-390-dark.png](qa-ui-sweep-98b4301/qa102-create-390-dark.png) |
| QA-103 | Settings → Übersetzung (Translation) in all sizes and both themes; enter API key, enable, choose target. | **FIXED** | 12/12 configurations: shell kept, no "This page couldn't load", API key/enable/target controls usable, no Slot error. | [qa103-translation-1440-light.png](qa-ui-sweep-98b4301/qa103-translation-1440-light.png), [qa103-translation-320-dark.png](qa-ui-sweep-98b4301/qa103-translation-320-dark.png) |

## New findings, ranked

File:line entries are source-based guesses, not confirmed root causes, unless the text says otherwise.

| ID · priority | Area; viewport/theme | Steps | Expected vs actual | File:line guess | Screenshot |
|---|---|---|---|---|---|
| QA-201 · **P2** | Compose signatures (sender identities slice 3); 1440×900 light, inline compose | Alex (personal default QA Team with "Team-Signatur"): Neue E-Mail. The body holds the Team signature once (correct). Change From to "Abgelehnter Alias" (no signature): signature removed, body empty (correct). Change From back to QA Team without typing anything. | **Expected:** Team signature inserted again with no prompt, because nothing was edited.<br>**Actual:** a native confirm appears: "Die bearbeitete Signatur behalten und die neue Signatur hinzufügen? Dein bearbeiteter Text bleibt erhalten."<br>- **Cancel:** no signature is inserted. The message can be sent without the identity's signature, and nothing tells the user.<br>- **OK:** signature appended after extra blank lines (`"\n\n\nViele Grüße…"`).<br>The next switch to QA Shared shows the same prompt again. Cause, checked in source: when there is no tracked previous signature, `replaceSignatureBlock` reports `conflict: Boolean(body)`, and the empty editor body (Lexical empty paragraph / `"\n"`) is truthy. | [lib/signatureTemplates.ts:77](/home/monkey/code/noctua-mail/wt-qa-sweep3/lib/signatureTemplates.ts:77); caller [useComposeController.ts:69](/home/monkey/code/noctua-mail/wt-qa-sweep3/app/components/mailclient/composition/useComposeController.ts:69) | [compose-signature-lost-1440-light.png](qa-ui-sweep-98b4301/compose-signature-lost-1440-light.png) |
| QA-202 · **P2** | Settings on phones; 390/360/320, light and dark (12/12 matrix cells agree by width) | User menu → Einstellungen → Persönliche Einstellungen. | **Expected:** form and footer fit the screen; tab labels wrap at word boundaries.<br>**Actual:**<br>- The 112 px tab column breaks German labels mid-word: "Persönlich/e Einstellung/en", "Kategorisie/rung", "Übersetzun/g" (tab heights 44/64/84 px).<br>- The content pane runs past the right edge. At 390, sender-preference fieldset/selects reach x=522–534 px. At 360/320 the preference selects ("Postfachvorgabe übernehmen") reach x=380 px.<br>- Footer clipped: "Schließen" shows as "ßen" at 390, and "Einstellungen speichern" is cut at 320. `document.scrollWidth` stays equal to the viewport, so the cut-off content cannot be scrolled into view.<br>- English at 390 also overflows in the new sender-preferences block (x=479–491), so part of this is locale-independent. | [MobileFrames.module.css:28](/home/monkey/code/noctua-mail/wt-qa-sweep3/app/components/shell/MobileFrames.module.css:28) (fixed 112 px column) and [:36](/home/monkey/code/noctua-mail/wt-qa-sweep3/app/components/shell/MobileFrames.module.css:36) (`overflow-wrap:anywhere`); native selects without width cap in [SenderPreferences.tsx:52](/home/monkey/code/noctua-mail/wt-qa-sweep3/app/components/account-settings/tabs/SenderPreferences.tsx:52) | [settings-prefs-overflow-390-light.png](qa-ui-sweep-98b4301/settings-prefs-overflow-390-light.png), [settings-320-light.png](qa-ui-sweep-98b4301/settings-320-light.png) |
| QA-203 · **P2** | Admin on phones; 390/360/320, light and dark | User menu → Administration → Postfächer. | **Expected:** header and per-mailbox action rows wrap.<br>**Actual:**<br>- At 390 and 360 the primary "Postfach erstellen" button extends to x=471 px and only "Postfa…" is visible.<br>- At 320, "Administration schließen" ends at x=350 (box 153.6+196), "Postfächer aktualisieren" is cut, and every "Postfach löschen" ends at x=345.<br>- The rows use `flex` without `flex-wrap`; the longer German labels push them past the edge. | [AdminMailboxes.tsx:98](/home/monkey/code/noctua-mail/wt-qa-sweep3/app/components/admin/AdminMailboxes.tsx:98), [:101](/home/monkey/code/noctua-mail/wt-qa-sweep3/app/components/admin/AdminMailboxes.tsx:101); [AdminPanel.tsx:90](/home/monkey/code/noctua-mail/wt-qa-sweep3/app/components/admin/AdminPanel.tsx:90) | [admin-header-clipped-390-light.png](qa-ui-sweep-98b4301/admin-header-clipped-390-light.png), [admin-320-dark.png](qa-ui-sweep-98b4301/admin-320-dark.png), [admin-360-light.png](qa-ui-sweep-98b4301/admin-360-light.png) |
| QA-204 · P3 | Compose From menu on desktop; 1440×900 dark (modal) and light (inline/draft) | Open a reply, then "In Fenster öffnen" (modal), and open the Von/From select. | **Expected:** menu about as wide as the trigger.<br>**Actual:** the listbox spans almost the full viewport (x 16 → 1424) and covers sidebar and list. The mobile width rule is not limited to phones. | [Compose.module.css:495-497](/home/monkey/code/noctua-mail/wt-qa-sweep3/app/components/mailclient/composition/Compose.module.css:495) (`width: calc(100vw - 32px)` outside the `@media (width < 768px)` block) | [compose-modal-from-1440-dark.png](qa-ui-sweep-98b4301/compose-modal-from-1440-dark.png), [draft-identity-unavailable-1440-light.png](qa-ui-sweep-98b4301/draft-identity-unavailable-1440-light.png) |
| QA-205 · P3 | Settings Escape; 1440×900 de, both waits (0.8 s / 3 s) | Open Settings from the user menu (initial tab Postfach, focus on the X close button), press Escape once. | **Expected:** one Escape closes Settings (as QA-009).<br>**Actual:** the first Escape only closes the close button's focus tooltip; dialog count stays 1. The second Escape closes it, and focus returns to "Benutzermenü".<br>- One Escape is enough once focus is on a tab or in the content (Persönliche Einstellungen, Identitäten, body click, Tab into content).<br>- Same pattern as the Forward-modal note in the 9424150 sweep. | [AccountSettingsModal.tsx:222](/home/monkey/code/noctua-mail/wt-qa-sweep3/app/components/AccountSettingsModal.tsx:222) (TooltipIconButton receives initial focus) | [settings-escape-tooltip-1440-dark.png](qa-ui-sweep-98b4301/settings-escape-tooltip-1440-dark.png) |
| QA-206 · P3 | Status bar; 1440×900 dark | Cause any long status error. Here: Archivieren from the message menu (known 400, see Known). | **Expected:** error text and clock do not collide.<br>**Actual:** "Request failed (400) /api/accounts/qa-shared/messages/…/archive" runs under the centred clock "23.10.2026, 16:5x"; both are unreadable. "E-Mail-Abruf" also wraps to two lines in the left group. The error text is English (server-error strings are documented as remaining slice-3 work). | [BottomStatusBar.tsx:140](/home/monkey/code/noctua-mail/wt-qa-sweep3/app/components/mailclient/status/BottomStatusBar.tsx:140), `.bottom-bar` in [globals.css:980](/home/monkey/code/noctua-mail/wt-qa-sweep3/app/globals.css:980) | [statusbar-error-overlap-crop-1440-dark.png](qa-ui-sweep-98b4301/statusbar-error-overlap-crop-1440-dark.png), [statusbar-error-overlap-1440-dark.png](qa-ui-sweep-98b4301/statusbar-error-overlap-1440-dark.png) |
| QA-207 · P3 | Sender preferences touch targets; 390×844 dark (18 px), desktop (20 px) | Settings → Persönliche Einstellungen → "Persönlicher Absender und persönliche Signatur". | **Expected:** controls as tall as the other selects in the same tab (36 px), at least 44 px on phones.<br>**Actual:** the three native selects (Standardabsender, Persönliche Signaturvorlage, Persönliche Signatur) are **18 px** at 390/360/320 and **20 px** at desktop. The other eight selects are 36 px. The signature preview uses a monospace `<pre>`. | [SenderPreferences.tsx:52](/home/monkey/code/noctua-mail/wt-qa-sweep3/app/components/account-settings/tabs/SenderPreferences.tsx:52), [:57](/home/monkey/code/noctua-mail/wt-qa-sweep3/app/components/account-settings/tabs/SenderPreferences.tsx:57), [:61](/home/monkey/code/noctua-mail/wt-qa-sweep3/app/components/account-settings/tabs/SenderPreferences.tsx:61) | [settings-sender-prefs-390-dark.png](qa-ui-sweep-98b4301/settings-sender-prefs-390-dark.png) |
| QA-208 · P3 | Search (FTS v3) German folding; 1440×900 light | Search in QA Private/Shared INBOX for "Straße", "strasse", "Grüße", "grusse", "Übermaß", "uebermass", "Noël", "noel". | **Expected:** common German spellings without ß find the same messages.<br>**Actual:**<br>- Straße 1 hit; **strasse 0**.<br>- Grüße 75; **grusse 0**.<br>- Übermaß 8; uebermass 7.<br>- Noël/noel both 1.<br>Diacritics are folded but ß is not (default `unicode61`). `from:` works, but `subject:Anhang` returns 0 (the field filters in the popover cover this). The ~31 s for empty results is the harness waiting for rows, not app latency (hits returned in about 1.1 s). | [lib/db/ftsIdentity.ts:12](/home/monkey/code/noctua-mail/wt-qa-sweep3/lib/db/ftsIdentity.ts:12) (fts5 without custom folding) | [search-empty-de-1440-light.png](qa-ui-sweep-98b4301/search-empty-de-1440-light.png) |
| QA-209 · P3 | Search filter popover, i18n; 1440×900 light | Click "Filter" in the list header. | **Expected:** "Aktueller Ordner: Posteingang" (display name, as in the search chip "im Ordner „Posteingang“").<br>**Actual:** raw IMAP name **"INBOX"** badge. | [ShellSearch.tsx:247](/home/monkey/code/noctua-mail/wt-qa-sweep3/app/components/shell/ShellSearch.tsx:247) (`currentFolder.name` instead of `getFolderDisplayName`) | [search-filter-inbox-raw-1440-light.png](qa-ui-sweep-98b4301/search-filter-inbox-raw-1440-light.png) |
| QA-210 · P3 | Search field placeholder; 1440 and 1280, both themes | Look at the list header search field. | **Expected:** full placeholder or an ellipsis.<br>**Actual:** "E-Mails in Posteingang suchen" needs 201 px but has 178 px (1440) / 168 px (1280), so it shows as "…Posteingang suc|" with a hard cut. The wording should read "im Posteingang" (dative), which also comes out shorter. | [messages/de.json:320](/home/monkey/code/noctua-mail/wt-qa-sweep3/messages/de.json:320) | [list-1280-dark.png](qa-ui-sweep-98b4301/list-1280-dark.png), [assignee-duplicate-self-1440-light.png](qa-ui-sweep-98b4301/assignee-duplicate-self-1440-light.png) (header) |
| QA-211 · P3 | Inline SMTP rejection messages; 1440×900 light/dark | Send to `bounce-x@example.test` (550) or `tempfail-x@example.test` (451) from a valid identity. | **Expected:** the alert links to the recipient fields (or offers no sender action) when the recipient was rejected.<br>**Actual:** both the recipient-rejected and the temporary-failure alerts end with "**Absender prüfen**" and link to `#compose-…-from`. Correct cases: sender rejected (553) and `identity_unavailable` (409) also end with "Absender prüfen". | [ComposeFields.tsx:333](/home/monkey/code/noctua-mail/wt-qa-sweep3/app/components/mailclient/composition/ComposeFields.tsx:333) | [compose-sender-rejected-1440-light.png](qa-ui-sweep-98b4301/compose-sender-rejected-1440-light.png) |
| QA-212 · P3 | Collaboration assignee picker; 1440×900 light | Reader → "Nicht zugewiesen" (Zuständig) combobox as Alex. | **Expected:** the current user appears once (as "Ich", or with the name next to it).<br>**Actual:** options are "Nicht zugewiesen", "**Ich**", "**Synthetic Alex**", "Synthetic Jo". The same person is listed twice, and both entries assign the same id. | [AssigneeCombobox.tsx:35-44](/home/monkey/code/noctua-mail/wt-qa-sweep3/app/components/collab/AssigneeCombobox.tsx:35) | [assignee-duplicate-self-1440-light.png](qa-ui-sweep-98b4301/assignee-duplicate-self-1440-light.png) |
| QA-213 · P3 | Sidebar Drafts numbers; 1440×900 light/dark | Look at the pinned "Entwürfe" entry under Schreiben and the "Entwürfe" folder in the tree. | **Expected:** one meaning per number, or the same number.<br>**Actual:** pinned entry "Entwürfe **12**" (total; earlier 5) while the folder tree shows "Entwürfe **3**". API: Drafts count 12, unreadCount 3 (seeded drafts lack `\Seen`). Two different numbers for the same folder within a few centimetres. | [ShellSidebar.tsx:215](/home/monkey/code/noctua-mail/wt-qa-sweep3/app/components/shell/ShellSidebar.tsx:215) vs folder-tree unread badge | [assignee-duplicate-self-1440-light.png](qa-ui-sweep-98b4301/assignee-duplicate-self-1440-light.png) (pinned 12), [search-filter-inbox-raw-1440-light.png](qa-ui-sweep-98b4301/search-filter-inbox-raw-1440-light.png) (pinned 5) |
| QA-214 · P3 | German terminology "Konto" vs "Postfach"; all viewports | Reader/list message actions menu; error and notice strings. | **Expected (doc/I18N.md):** Mailbox = **Postfach**.<br>**Actual:** "In Konto kopieren …", "In Konto verschieben …", "…in anderes Konto verschieben", "Konto:", "Die Ordner dieses Kontos…", "Konto erneut verbunden", "…in das andere Konto kopiert werden" all refer to mailboxes. "Konto" is right only for the personal user account (login/security strings). | [messages/de.json:728-729](/home/monkey/code/noctua-mail/wt-qa-sweep3/messages/de.json:728), 873, 877, 893, 930-931, 1033, 1107, 1141 | — (text inventory) |
| QA-215 · P3 | English left in translated areas (details in the list below); 1440 light | Preferences tab, reader badge, compose reply quote header, filter popover. | **Expected:** German in areas that slices 1/2a/2b/3 mark as translated.<br>**Actual:**<br>- Persönliche Einstellungen contains the untranslated "Default mail app … Register as mailto: handler … Not supported in Safari." block.<br>- Reader shows the IMAP flag badge "**Seen**" (title "Seen").<br>- Signature trigger reads "Signature" when no template is selected (compose is documented as remaining). | Preferences: MailtoHandlerSection in [PreferencesTabContent.tsx](/home/monkey/code/noctua-mail/wt-qa-sweep3/app/components/account-settings/tabs/PreferencesTabContent.tsx); badge: [ThreadMessageCard.tsx:752-760](/home/monkey/code/noctua-mail/wt-qa-sweep3/app/components/mailclient/message/ThreadMessageCard.tsx:752) | [settings-prefs-mailto-english-1440-light.png](qa-ui-sweep-98b4301/settings-prefs-mailto-english-1440-light.png) |
| QA-216 · P3 | Preferences: two save buttons; 1440 and phones | Settings → Persönliche Einstellungen; change only "Standardabsender". | **Expected:** one obvious save path.<br>**Actual:** the sender block has its own "Absendereinstellungen speichern". The footer "Einstellungen speichern" covers only the other preferences. Two save buttons in one tab with different scope; which one applies to a sender change is not obvious. Whether an unsaved sender change survives closing was not measured. | [SenderPreferences.tsx:46-67](/home/monkey/code/noctua-mail/wt-qa-sweep3/app/components/account-settings/tabs/SenderPreferences.tsx:46) | [settings-sender-prefs-390-dark.png](qa-ui-sweep-98b4301/settings-sender-prefs-390-dark.png) |
| QA-217 · P3 | Admin create + self-grant wording/grouping; 1440 dark | Admin → Postfächer → Postfach erstellen (Synthetisches Teampostfach 3) → "Dir selbst Zugriff geben?" → Zugriff geben (Verwalter). | **Expected:** the dialog text ("Das **gemeinsame** Postfach wurde erstellt") and the sidebar grouping agree.<br>**Actual:** after the grant the mailbox appears under "**Eigene** Postfächer" (observed in run r1; grouping rule not traced). | [messages/de.json:615](/home/monkey/code/noctua-mail/wt-qa-sweep3/messages/de.json:615); sidebar grouping in ShellSidebar | [admin-selfgrant-sidebar-1440-dark.png](qa-ui-sweep-98b4301/admin-selfgrant-sidebar-1440-dark.png) |
| QA-218 · P3 | Admin create dialog on phones; 320/390 dark | Postfach erstellen at 320; self-grant follow-up at 320/390. | **Expected:** host and port values readable; buttons 44 px tall.<br>**Actual:**<br>- In the 3-column IMAP/SMTP grid, host and port inputs truncate values ("127.0.0", "387…").<br>- The follow-up buttons "Später" (68×32) and "Zugriff geben" (118×32) are 32 px tall.<br>- The create dialog shows an enabled-looking red "Delete Account" footer button (disabled) inside a *create* flow.<br>- Its body is English (documented as remaining). | AccountTabContent grid; [AdminMailboxes.tsx:67](/home/monkey/code/noctua-mail/wt-qa-sweep3/app/components/admin/AdminMailboxes.tsx:67) | [admin-selfgrant-320-dark.png](qa-ui-sweep-98b4301/admin-selfgrant-320-dark.png), [admin-create-dialog-english-1440-dark.png](qa-ui-sweep-98b4301/admin-create-dialog-english-1440-dark.png) |

## Known (not investigated further, as instructed)

- **Unsent inline reply lost after a UI language switch.** Reproduced here: reply composer count 1→0 after de→en (also with Close button instead of Escape). A new-mail composer survives. The reply draft had already been autosaved. Fixed on integration/stage 97dd982.
- **Auth spec looked for an English dialog name.** Test only.
- **Sidebar "Ansichten" highlight and tooltip.** Visible in all desktop shots. fix/sidebar-views-row in progress.
- **Bodyless POST/DELETE return 400 `json_required`.** Also seen for **Archivieren**: `POST …/messages/{id}/archive` → 400 for all three thread messages, and the message stays in place. The feat/reader-focus bodyless matrix (`tests/browser/ui/qa-bodyless-commands.spec.ts`, up to e7d00ee) includes archive. Not in this tree.
- **"Offen" counts every non-closed thread of a private mailbox.** Product question.

## English leftovers in German mode

These come from an automated text inventory (visible text + aria-label/title/placeholder) and a manual review.

**Leftovers in areas documented as translated:**

| Area | Strings |
|---|---|
| Settings → Persönliche Einstellungen | "Default mail app", "Ask your browser to handle … links with …", "After registering, you may need to pick … Not supported in Safari.", "Register as mailto: handler" (QA-215) |
| Reader message header | flag badge "Seen" (and its title) (QA-215) |
| Search filter popover | raw folder name "INBOX" next to "Aktueller Ordner:" (QA-209) |
| Signaturen tab (sender slice 3) | header help text is German, but the body is English: "Signature list", "Add signature", "Default signature", "No signatures yet." This mixes languages within one tab; the doc lists the signatures form as remaining. |

**Documented as remaining English (doc/I18N.md "Remaining English (slice 3)"), confirmed present:**

| Area | Strings |
|---|---|
| Compose | "Reply", "To:", "Subject:", "Signature", "Attach", "Add event invitation", "Create invite", "Draft not saved yet", "Cancel", "Send", "Edit draft", "Write your message…", "(no subject)", quote header "On …, … wrote:". German "Von:" sits next to English labels. |
| Settings form bodies | Postfach/Account tab: "Manage IMAP/SMTP credentials…", "Account details", "IMAP (Incoming Server)", "Detect security", host/port/user/password labels, "Security"/"None", "Delete Account", "Close", "Save", "Show password". The same form is used by Admin → Postfach erstellen.<br>Kategorisierung: "Reset learning model", "Refresh", "Model", "Never", "No feedback events yet."<br>Themen: "Topics let you group…", "Settings", "Write topics to IMAP messages (not supported yet)", "Export", "Import", "New topic", …<br>Kalender: "Week starts on", "CalDAV Server", "Server URL", "Password", "Calendar Path", "Sync Interval", "Test Connection", …<br>Übersetzung: "DeepL Translation", "API key", "Enable translation", "Default target language", "Test key", …<br>Empfänger-Aliasse: "Save common recipient combinations…", "New alias", …<br>MCP: "MCP server", "Create token", "Label", "Copy server URL", … |
| Calendar | status-bar clock button aria-label/title "Open calendar", "Open calendar in sidebar/window" |
| Server errors | "Request failed (400) …" in the status bar; "Invalid mailbox credentials" in the admin create dialog; API `message` fields such as "Choose an enabled sender identity." are only shown through the German mapped sender messages, which is correct. |

**Fully German in this tree:** shell, sidebar, views, folder tree, list headers and menus, sort/group, reader toolbar and menus, collaboration bar/notes/status, status-bar headings, Identitäten tab, sender-preferences block, Mitglieder tab, Admin (Benutzer, Postfächer, Einladungen, Protokoll), login/TOTP/backup-code screens, inline sender alerts (553/550/451/409, unavailable identity), remote-content notice ("Externe Inhalte blockiert", "Einmal laden", "Von diesem Absender immer laden"). du-form is used consistently in everything reviewed.

## What works well

- **Sender identities.**
  - Personal default (QA Team) preselected in new mail, signature inserted exactly once.
  - Reply picks the identity that matches the original To (QA Shared, mailbox default without signature, sigCount 0).
  - Modal keeps the From value; the disabled identity is hidden.
  - A draft saved with an identity that was later disabled reopens as "Abgelehnter Alias … — nicht verfügbar" with the German `unavailableDraft` alert. Sending returns 409 `identity_unavailable` with a German inline message.
  - 553/550/451 produce German inline alerts and keep the compose open.
  - Mobile From listbox at 390/360/320 fits (16→374 px at 390, 40 px rows, no clipping). Send stays 60×44 px.
  - Jo (editor) sees identities read-only ("Nur Verwalter des Postfachs können Absenderidentitäten ändern.") and gets the mailbox default as From.
- **Sync-folder guard.** Rapid QA Private ↔ QA Shared switching during a full mailbox sync (+500…+9000 ms samples) and folder hopping (Gesendet, Archiv, Posteingang): **0** `folder_account_mismatch`, **0** empty lists. Every sync request stayed scoped to its own account.
- **Admin create + self-grant, keyboard only (German, dark).** POST 201, follow-up dialog "Dir selbst Zugriff geben?" with Verwalter preselected, grant 200. Sidebar updated without reload; `member.grant` in Protokoll. Radix selects work by keyboard (Enter, ArrowDown, Enter, with the opening animation awaited).
- **Admin layering.** Members dialog z-index 9996 above Admin; Escape closes one layer at a time; focus returns to "Benutzermenü".
- **Collaboration with SSE (Alex and Jo in parallel).**
  - Assign to Jo: Jo "Mir zugewiesen" 0→1, "Nicht zugewiesen" 266→265 in **259 ms**.
  - Status change in 287 ms; note with Markdown/umlauts visible to the other user in 547 ms; close in 298 ms ("Offen" 266→265).
- **Unread counts after new mail.** Injecting an unread message moved the "Posteingang" view badge 112→113 in **288 ms**; API 113, header 304→305. Mailbox row and "Nicht zugewiesen/Offen" followed within about 5 s. QA-101 mark-as-read path is stable.
- **Search (FTS v3).** Umlauts, CJK (日本語, 会議), Greek, "Ünïcödé", phrase and prefix ("praxisumb") search, attachment names (Rechnung-Synthetisch.pdf, "Übersicht März"), sender address and `from:`, diacritic folding (noel→Noël). Hits come back in about 1.1 s. German empty-state text: "Keine Nachrichten entsprechen dieser Suche."
- **Language switch.** de↔en kept the active mailbox, list search ("Praxisumbau"), unsaved preference changes, settings tab labels, a new-mail composer and the login form fields. Only the reply composer was lost (known).
- **Login.** Login → TOTP in German at 1440 dark and 320 light. Tab order: E-Mail → App-Passwort → Anmelden → Passkey → Einladung → Sprache. Labelled "Authenticator-Code". Signed in with `lang=de`; no horizontal overflow.
- **Core flows.**
  - Delete via the reader button moves to Papierkorb.
  - Delete key shows a German thread confirmation ("Thread in den Papierkorb verschieben? Alle 3 Nachrichten …").
  - Layouts Kompakt/Karten/Tabelle/Threads switch with no horizontal overflow.
  - PDF download 200, `%PDF-1.4`, 1742 bytes.
  - Remote HTML image: **0** requests before "Einmal laden", **1** after. That request went to a synthetic `images.example.test` URL and was fulfilled locally by Playwright, so no external connection was made.
  - Mobile back button "Zurück zu den Nachrichten" is 84×44 px and returns to the list; browser Back also works.
- **Viewport matrix.** In all 12 configurations: `document` horizontal overflow 0 for list and reader, no clipped header text, settings tab strip fully visible on desktop (40 px tabs), **0 hydration warnings, 0 page errors, 0 failed requests**.
- **Console (all runs).** Only expected 4xx/5xx from deliberate rejections. The CSP note "'frame-ancestors' is ignored when delivered via a <meta> element" is logged once per HTML message iframe; this is console noise, not a UI defect.

## Untested areas and limits

- **Move to folder** via the message-menu submenu: the harness did not open the "Verschieben nach" submenu (hover target), so it is not verified in this sweep.
- **Flag toggle:** one POST `/flags` was observed but the outcome was not asserted.
- **Undo toasts:** "Rückgängig" was visible once after delete, but the timing was not measured.
- **Mark-read on open:** opening a newly injected message did not mark it read within 3 s. That is consistent with a manual mark-as-read setting, which was not checked.
- **Timezones:** a reply quote header written while the browser was in UTC showed 9:03, while the list showed 11:03 for the same message. All later runs used Europe/Berlin. A Berlin-only re-check of this was not done.
- **Emoji glyphs:** category emoji show as empty boxes in headless Chromium because no emoji font is installed. This is an environment limit.
- **Not covered:** Calendar UI, DeepL test-key call, passkeys, the viewer role, PWA/detached windows and graceful restart.
- **Fixture model:** all logical mailboxes (QA Private, QA Shared, the created Synthetisches Teampostfach 1–3) share the fixture's single IMAP identity, so injected mail shows up in each of them. This is not a multi-IMAP isolation test.
- **Leftover detection:** an English-word heuristic plus manual review. Strings that only appear in states that were not triggered may be missing from the list.

## Artifacts and cleanup

- Report: `/home/monkey/code/noctua-mail/briefs/qa-ui-sweep-98b4301.md`
- Screenshots: `/home/monkey/code/noctua-mail/briefs/qa-ui-sweep-98b4301/` (53 PNG, all ≤ 300 KB, PNG signatures validated)
- Evidence: `qa-ui-sweep-98b4301/evidence.json` (merged scenario JSON; session storage states excluded)
- Machine-readable summary: `qa-ui-sweep-98b4301/verification.json`
- Processes stopped at the end: owner runner PID 3568975, which stopped its fixture child 3568984 and standalone server 3569251. Ports 3875–3879 were free afterwards.
- `.tmp` was removed. The worktree is clean at 98b4301.

## Machine-readable summary

```json
{
  "commit": "98b4301",
  "branch": "qa/ui-sweep-98b4301",
  "verification": {"QA-101": "FIXED", "QA-102": "FIXED", "QA-103": "FIXED"},
  "counts": {"P1": 0, "P2": 3, "P3": 15},
  "findings": [
    {"id": "QA-201", "priority": "P2", "title": "False 'edited signature' prompt drops signature after From switch back"},
    {"id": "QA-202", "priority": "P2", "title": "Mobile Settings: mid-word tab breaks, form and footer overflow 320-390"},
    {"id": "QA-203", "priority": "P2", "title": "Mobile Admin: create/close/delete buttons clipped 320-390"},
    {"id": "QA-204", "priority": "P3", "title": "Desktop compose From menu spans full viewport"},
    {"id": "QA-205", "priority": "P3", "title": "Settings needs two Escapes when focus starts on close button"},
    {"id": "QA-206", "priority": "P3", "title": "Status bar error text overlaps clock"},
    {"id": "QA-207", "priority": "P3", "title": "Sender preference selects 18-20 px tall"},
    {"id": "QA-208", "priority": "P3", "title": "Search does not fold ß (strasse/grusse find nothing)"},
    {"id": "QA-209", "priority": "P3", "title": "Search filter shows raw INBOX folder name"},
    {"id": "QA-210", "priority": "P3", "title": "Search placeholder clipped; 'in Posteingang' wording"},
    {"id": "QA-211", "priority": "P3", "title": "Recipient/temporary SMTP alerts link to 'Absender prüfen'"},
    {"id": "QA-212", "priority": "P3", "title": "Assignee list shows self twice (Ich + name)"},
    {"id": "QA-213", "priority": "P3", "title": "Drafts shows total 12 pinned vs 3 in folder tree"},
    {"id": "QA-214", "priority": "P3", "title": "'Konto' used for mailbox against I18N terminology"},
    {"id": "QA-215", "priority": "P3", "title": "English leftovers in translated areas (mailto block, Seen badge)"},
    {"id": "QA-216", "priority": "P3", "title": "Two save buttons with different scope in Preferences"},
    {"id": "QA-217", "priority": "P3", "title": "Self-granted 'shared' mailbox listed under Eigene Postfächer"},
    {"id": "QA-218", "priority": "P3", "title": "Admin create dialog: truncated host/port, 32 px buttons, Delete Account in create"}
  ],
  "known_confirmed": ["reply composer lost on language switch (97dd982)", "archive POST 400 json_required (bodyless family, feat/reader-focus)"],
  "hydration_warnings": 0,
  "page_errors": 0,
  "viewports": ["1440x900", "1280x720", "834x1112", "390x844", "360x780", "320x568"],
  "themes": ["light", "dark"],
  "png_count": 53,
  "tests_run": "none (UI sweep); env -u CLAUDECODE -u AGENT -u REPL_ID not applicable",
  "worktree_clean": true
}
```
