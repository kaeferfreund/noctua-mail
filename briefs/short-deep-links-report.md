# Kürzere Direktlinks

Stand: 2026-10-23. Worktree `wt-short-links`, Branch `feat/short-deep-links`, Basis `56840cea`.
Commit: `c9462236d68c4ddd8118fc1aac5ca265979947c1`.

## Umsetzung

- `a`/`m`: zwölf ID-Bytes als 16 Zeichen Base64url; andere IDs mit eindeutigem `~`-Rohdatenpräfix. Großgeschriebene Hex-IDs und Kollisionssuffixe bleiben exakt erhalten.
- `f`: kontorelativer Ordnerpfad, einschließlich Leerzeichen, Umlauten, Slashes und führender Tilde; `s`/`g` ersetzen scope/group. Sonstige Parameter bleiben lesbar.
- Gemäß aktualisiertem Auftrag ausschließlich neues URL-Schema: alte Parserpfade und deren Tests entfernt, ebenso der ungenutzte openCalendar-Verbraucher.
- PWA-Manifest und Browser-Protokollregistrierung verwenden `c=<mailto-URI>`; MailClient übernimmt die Vorbefüllung und veröffentlicht danach nur `c=mailto%3A`.
- Kalenderimport leitet auf `/?panel=calendar` um. Service Worker erzeugt kompakte URLs und reicht dieselbe URL bei warmen `noctua:notification-open`-Klicks weiter; das Konto ist auch ohne accountId im Reminder enthalten.
- Mitgliedschaftsprüfung und autorisierter Nachrichtenresolver unverändert. Dokumentation und Browserfälle aktualisiert.

## Beispiel

Vorher, relative URL mit 130 Zeichen:

```text
/?accountId=acc-0357e6dc07a93be003c3321b&folderId=acc-0357e6dc07a93be003c3321b%3AINBOX&openMessageId=imap-4d2efbb6963d6825053ba2d5
```

Nachher, 47 Zeichen (64 % kürzer):

```text
/?a=A1fm3AepO-ADwzIb&f=INBOX&m=TS77tpY9aCUFO6LV
```

## Prüfungen

- `bun install`: erfolgreich; keine Lockfile-Änderung.
- `bun test lib/navigation`: 32 bestanden, 0 fehlgeschlagen. Enthält ID-/Ordner-Roundtrips, Rohdatenmarker, kompakte Parameter, Rechteprüfung und tatsächliche SW-URL-Erzeugung mit warmen/kalten Klicks.
- `bun run test:dom`: 754 bestanden, 0 fehlgeschlagen (95 Dateien).
- `bun check`: 0 Fehler (1.330 Dateien).
- ESLint auf allen 13 berührten Code-/Testdateien: 0 Fehler, 0 neue Warnungen. 66 vorhandene MailClient-Warnungen mit unveränderten Regel-/Positionsdaten gegenüber der Basis.
- `bun run build`: erfolgreich.
- Abschließender Browserlauf ohne Diagnosecode: 10/10 bestanden. Desktop 1440 × 900 und Mobilansicht 390 × 844; Linkkopieren, Anmeldung, Reload, Back/Forward, Berechtigungen, Mailto-Vorbefüllung über das tatsächliche Manifest, Kalenderimport-Weiterleitung und warme Benachrichtigungen geprüft.
- Browserkommando: `QA_SHELL_USE_BUILD=1 QA_DEEP_LINKS_FIXTURE=1 QA_SHELL_SPEC=qa-deep-links.spec.ts QA_SHELL_PORT=4110 QA_SHELL_FIXTURE_IMAP_PORT=4111 QA_SHELL_FIXTURE_CONTROL_PORT=4112 QA_SHELL_FIXTURE_SMTP_PORT=4113 bun scripts/runQaShellBrowserTests.ts`.

Beobachtung: Frühere Browsergesamtläufe erreichten 9/10 bzw. 8/10. Einzelne beforeEach-Aufbauten warteten auf den Standardordner in der URL, während die Liste bereits sichtbar war. Der isolierte betroffene Fall, vier Diagnosefälle, sechs weitere Wiederholungen und der abschließende unveränderte Gesamtlauf bestanden. Die Ursache dieser sporadischen Start-Timeouts ist offen; keine Zeitlimits oder Assertions wurden gelockert. Temporärer Diagnosecode wurde entfernt, kein zusätzlicher Kontowechsel-Fix eingeführt.

Nur synthetische Daten; eigene Fixture-Server auf 4110–4113 wurden vom Runner beendet. Scratch-Dateien entfernt. Kein Push, PR, Merge, Deploy oder Zugriff auf die Live-Vorschau.
