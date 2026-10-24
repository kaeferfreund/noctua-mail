# Deep Links – Implementierungsbericht

Stand: 2026-10-23. Worktree: `/home/monkey/code/noctua-mail/wt-deep-links`, Branch `feat/deep-links`, Basis `a5184097`.

Commit: `774f0d88364683bc86c700b9b5cac4c1d42fa54a`.

## Umsetzung und URL-Schema

Query-Parameter auf `/` erhalten die bestehende einzelne Next-App-Router-Seite. Schema, Identität und Grenzen sind in `doc/DEEP-LINKS.md` dokumentiert.

| Ziel | URL-Parameter |
| --- | --- |
| Postfach | `accountId=<id>` |
| Ordner | `folderId=<id>`, etwa `qa-shared%3AINBOX` |
| Geöffnete Nachricht / Thread | `openMessageId=<lokale Nachrichten-ID>` |
| Suche | `q=<Suchtext>&scope=all`, sonst Ordnersuche |
| Virtuelle Ansicht | `view=virtual:open`, `assigned-to-me`, `unassigned`, `focused`, `action-queue`, `invite-deck` jeweils mit Präfix `virtual:` |
| Gruppierung / Filter / Suchfelder | `group=sender`, `filter=unread,flagged`, `fields=subject,body` |
| Postfacheinstellungen | `settings=preferences` sowie alle vorhandenen sichtbaren Einstellungsbereiche |
| Administration | `admin=users/mailboxes/invites/audit` |
| Profil / Sicherheit | `security=1` |
| Kalender-Seitenleiste | `calendar=1` |
| Kalender / Statusbereich | `panel=calendar/process/exception/reminder/mail-check` |
| Neue Nachricht | `mailto=mailto%3A`, ausschließlich Öffnungszustand |

Ausgehende Nachrichtenlinks verwenden `(accountId, Message.id)`: die bestehende stabile, postfachlokale Hash-ID statt IMAP-UID oder Betreff. Normale Synchronisierung, Neuladen und Shard-Speicherung ändern diese Identität nicht. Kollisionsvarianten und ältere RFC-Message-IDs werden über den vorhandenen Detail-Endpunkt aufgelöst. Ordner-IDs enthalten den Serverpfad; eine Umbenennung kann diese ID ändern. Neu angelegte Nachrichten mit geänderter Identität sind nicht dauerhaft adressierbar.

Der eigene Hook `useDeepLinks.ts` trennt URL-Wiederherstellung und Veröffentlichung des UI-Zustands. `lib/navigation/deepLinks.ts` bündelt Parser, Serializer, Berechtigungs-Vorprüfung und Link-Erstellung; `resolveMessage.ts` verwendet ausschließlich den vorhandenen autorisierten Nachrichten-Endpunkt. `useAccountController.ts` und `useMessageData.ts` wurden nicht verändert.

Ortswechsel erzeugen History-Einträge; Suchtexteingabe und Tastatur-Nachrichtenwahl ersetzen den aktuellen Eintrag. Die automatische Entdeckung des Standardordners bei einem erstmals synchronisierten Postfach ergänzt den vorhandenen Postfach-Eintrag. Browser Zurück/Vorwärts und der mobile Zurück-Knopf verwenden dieselbe History. Die bestehende Abfanglogik für vorübergehende mobile Overlays bleibt erhalten; URL-verwaltete Einstellungen und Statusbereiche erzeugen keine zusätzlichen Sheet-Einträge.

Die Wiederherstellung wartet auf Anmeldung, Mitgliedschaft/Postfachwechsel, übernommenen UI-Zustand und autorisierte Nachrichtenauflösung. Veraltete Detailanfragen werden abgebrochen. 401 führt mit erhaltenem Ziel zur Anmeldung zurück; 403 aktualisiert die Mitgliedschaften und meldet fehlenden Zugriff; nur 404 meldet eine fehlende Nachricht. Netzwerk-/Serverfehler erhalten den angefragten Nachrichtenparameter für einen erneuten Aufruf. Verschobene Nachrichten öffnen ihren aktuellen Ordner mit Hinweis. Unzulässige Einstellungen fallen auf einen sichtbaren Bereich zurück.

Alte Parameter `messageId`, `openMessageId`, `accountId`, `scope`, `q`, `mailto` und `openCalendar=1` bleiben nutzbar. Warme `noctua:notification-open`-Ereignisse, kalte Benachrichtigungs-URLs, Kalender-/Hinweislinks und popstate verwenden denselben Resolver. Der statische Service Worker darf weiterhin seine bisherigen Links erzeugen. „Link kopieren“ im gemeinsamen Nachrichtenmenü erstellt den Link aus der Identität der betreffenden Nachricht, auch im separaten Nachrichtenfenster. Entwurfsinhalt, Empfänger, Betreff und Absender werden nicht aus dem Composer in URLs übernommen. Zurück minimiert einen geöffneten Composer, ohne seinen Inhalt zu verwerfen.

Die Abschnitte 1, 2, 3 und 9 der Forschungsnotiz `briefs/t3-learnings/mobile-navigation.md` wurden berücksichtigt. Zusätzliche positionsbezogene Scroll-Anker wurden nicht eingeführt.

## Gates

| Prüfung | Ergebnis |
| --- | --- |
| `bun install` | erfolgreich; `bun.lock` unverändert |
| `bun check` | 0 Fehler, 1.310 Dateien |
| ESLint auf sämtlichen angefassten TS/TSX-Dateien | 0 Fehler, 0 neue Warnungen; 67 bestehende MailClient-Warnungen gegenüber 73 an der Basis, 1 unveränderte AdminPanel-Warnung |
| `bun test lib/navigation` | 9 bestanden, 37 Assertions |
| `bun test lib/i18n/catalogs.test.ts` | 14 bestanden, 7.973 Assertions |
| Fokussierte DOM-Suites | 48 bestanden, 284 Assertions; URL-Hook, bestehende mobile History/Overlays, SettingsFrame, MessageMenu, Reader-Fokus und Reader-Paging |
| `bun run build` | erfolgreich, einschließlich nachgelagertem Typecheck |
| Produktions-Browsertest `qa-deep-links.spec.ts` | 5 bestanden, 42,7 Sekunden |
| `git diff --check` | erfolgreich |

Die Browserfälle prüfen:

1. Wechsel auf ein kaltes zweites Postfach, Nachricht öffnen, tatsächlichen Menü-Link kopieren, Neuladen, Zurück zur Liste und zum vorherigen Postfach, Vorwärts sowie Öffnen des kopierten Links mit Formular-Anmeldung und TOTP in einem frischen Browserkontext. Beim normalen Postfachwechsel genau ein Switch-POST.
2. Einstellungsbereiche mit Neuladen/Zurück, Admin-Unterbereich, Suche mit Gruppierung/Filter, Kalender-Legacy-Link und leeren Composer.
3. Nicht freigegebenes Postfach ohne Datenabruf auf dessen Nachrichtenroute, serverseitige 403 sowie gelöschte Nachricht mit Hinweis und Ordner-Fallback.
4. 390 px: genau ein History-Eintrag beim Öffnen, mobiler Zurück-Knopf zur Liste, Vorwärts, Neuladen und Browser-Zurück.
5. Kalten Reader bei absichtlich angehaltener Listenantwort sowie warme Service-Worker-Benachrichtigung über deren alte URL/RFC-ID.

Die Tests verwenden isolierte synthetische QA-Daten unter dem Worktree und ausschließlich App-Port 4000 sowie Fixture-Ports 4001–4003. Der Runner hat seine Prozesse beendet und seine Fixture-Daten entfernt. Kein Zugriff auf Port 3790, externe Mailserver oder ROOT/data. Die vollständige `test:ci`-Suite wurde nicht ausgeführt; die Änderung ist durch die oben genannten fokussierten Gates geprüft.

## Screenshots

Alle Bilder zeigen synthetische Korrespondenz; Browser-Locale ist Englisch.

- [Desktop-Reader, 1440 px](deep-links-evidence/desktop-reader.png)
- [Mobiler Reader, 390 px](deep-links-evidence/phone-reader-390.png)
- [Mobile Liste nach Zurück, 390 px](deep-links-evidence/phone-list-390.png)
- [Hinweis für fehlende Nachricht](deep-links-evidence/missing-message.png)

## Nicht abgedeckt

- Eigene positionsbezogene Listen-/Reader-Anker pro History-Eintrag, Pixelwiederherstellung und Abbruch verzögerter Scroll-Wiederherstellung bei Benutzergesten. Bestehende Auswahl-, Aufklapp- und Scroll-Logik nach Nachrichten-ID wird weiterverwendet; der Reader wartet nicht auf zusätzliche Listenseiten.
- Kalenderdatum, Kalenderansicht und einzelner Termin; verschachtelte Dialoge und ungespeicherte Einstellungsformulare.
- Sortier-/Threading-Präferenzen und Desktop-Fokuslayout in der URL. Die bestehenden Geräteeinstellungen bleiben zuständig.
- Entwurfsinhalt oder Wiederherstellung einer bestimmten Compose-Sitzung aus einem Link.
- Tatsächlich installierte iOS-/Android-PWA, OS-Linkübernahme und abgebrochene native Wischgesten; 390-px-Chromium ist die geprüfte Web-Variante.
- Eigenständiger Browserfall für „Link kopieren“ im Pop-out; der dort ebenfalls verwendete Nachrichtenmenü-Code und die identitätsbezogene Link-Erstellung sind implementiert und fokussiert geprüft.

Nur lokale Änderungen und lokaler Commit. Kein Push, Merge, PR, Deploy, Dienst-Neustart oder Zugangsdatenwechsel.


## Fix round r1

Commit: `e323db4832203f12cbd209d3f87dbfe3ed6a6c9d` auf `feat/deep-links`, Basis `01b7727c`. Umfang: die fünf beauftragten Findings aus `deep-links-review-r1.md`.

- **P1-1:** Mobile Overlay-Backs werden direkt aus dem Overlay-Zustand erkannt, auch wenn der Deep-Link-Listener zuerst läuft. Postfach- und Ordnerwahl werden dadurch nicht zurückgenommen; kein verzögerter URL-Restore erforderlich.
- **P1-2:** Postfachnavigation liefert ein Promise bis zum Abschluss beziehungsweise zur Ablösung der Transaktion; die Sidebar erhält `navigateLinkedAccount` direkt. Der reale MailClient-DOM-Test prüft die ausstehende Zeile während des langsamen Wechsels.
- **P2-3:** Beim Wiederherstellen verdrängen Suchtext und Badge-Filter die virtuelle Ansicht. Deren automatisches Entfernen ersetzt den Filter-Eintrag, statt einen weiteren History-Eintrag anzulegen.
- **P2-4:** Verlässt die geöffnete Nachricht die geladene Liste, ersetzt die nachfolgende Reader-Auswahl den aktuellen History-Eintrag. Zurück führt zur vorherigen Liste.
- **P2-5:** Der DOM-Preload verwendet eine echte lokale URL auf Port 4000 und setzt URL und History-State nach jedem Test zurück. A → B → A besteht auch zusammen mit den Deep-Link-Tests; bestehende Assertions bleiben erhalten.

Abschließende Gates: `bun check` **0 Fehler** (1.320 Dateien); ESLint auf allen neun angefassten TS/TSX-Dateien **0 Fehler, 0 neue Warnungen** (67 bestehende MailClient-Warnungen); `bun test lib/navigation` **10 bestanden**; vollständige DOM-Suite mit dem Repository-Filter (`bun test --config=bunfig.dom.toml dom.test`, entsprechend `bun run test:dom`) **717 bestanden, 0 fehlgeschlagen**, alle 92 DOM-Testdateien; `bun run build` **erfolgreich**; `qa-deep-links.spec.ts` **9/9 bestanden** (56,9 Sekunden); `git diff --check` **erfolgreich**.

Die Browserfälle ergänzen 390-px-Sidebar → anderes Postfach → anderer Ordner → Zurück/Vorwärts, virtuelle Ansicht mit Filter einschließlich kaltem Link sowie Löschen und Archivieren im Reader mit Zurück zur Ausgangsliste. Die beiden Triage-Fälle verwenden einzelne Nachrichten ohne Thread-Gruppierung, damit genau die angeklickte Nachricht geprüft wird. Die vorhandenen fünf Browserfälle bleiben grün. Nur synthetische Fixture-Daten und Ports 4000–4003; Fixture-Prozesse beendet und Scratch entfernt. P3-Findings wurden nicht bearbeitet.


## Fix after stage merge

Commit: `54644eaf5e9319299d0faa1bf6087a481db757da` auf `feat/deep-links`, Basis `3e0959ee` (Stage-Merge mit `1af46a6`).

Die verdeckte Ausnahme lautet `TypeError: target?.closest is not a function` in `useDeepLinks.ts`: Ein auf `window` ausgelöstes Tastaturereignis hat kein Element als Ziel. Der Capture-Listener brach dadurch vor der Reader-Navigation ab. Eine echte `instanceof Element`-Prüfung schützt den Zugriff; Tastaturnavigation ersetzt weiterhin den History-Eintrag, Eingabefelder setzen das Tastaturkennzeichen nicht. Der unveränderte `listCommit.dom.test.tsx` besteht einschließlich Wechsel von 1/3 auf 2/3; vier zusätzliche Hook-Fälle prüfen Fenster, Dokument, Body und Eingabefeld. Reader-Zeilenspeicher und Navigationslogik bleiben unverändert.

Der erste Browserlauf deckte außerdem einen Fehler des neuen Postfach-Vorabrufs auf: Bei einem kalten zweiten Postfach konnte die spekulative Listenanfrage vor dessen Ordneranlage mit `400 folder_account_mismatch` antworten und später als endgültiges Listenergebnis übernommen werden. Nur erfolgreiche Vorabrufe ersetzen jetzt das reguläre Laden nach dem Wechsel; zwei zunächst rote DOM-Fälle belegen den Fehler vor beziehungsweise nach Abschluss des Wechsels. Erfolgreicher Vorabruf benötigt weiterhin nur eine Listenanfrage. Bestehende Tests und Assertions wurden nicht abgeschwächt.

Abschließende Gates: fokussierte DOM-Suites **27 bestanden**; vollständiges `bun run test:dom` **739 bestanden, 0 fehlgeschlagen** (95 Dateien, 4.656 Assertions); `bun test lib/navigation` **10 bestanden**; `bun check` **0 Fehler** (1.329 Dateien); ESLint auf allen vier geänderten Dateien **0 Fehler, 0 neue Warnungen** (eine bestehende `set-state-in-effect`-Warnung in `useMessageData.ts`, identische Ausgabe gegenüber HEAD vor dem Fix); Produktionsbuild **erfolgreich**; unveränderte `qa-deep-links.spec.ts` **9/9 bestanden** (52,3 Sekunden), einschließlich beider 390-px-Fälle; `git diff --check` **erfolgreich**.

Ausschließlich synthetische Daten, eigene Prozesse auf Ports 4000–4003; Runner-Aufräumen bestätigt. Scratch entfernt, Worktree nach Commit sauber. Kein Push, PR, Merge, Deploy, Dienst-Neustart, Zugangsdatenwechsel oder Zugriff auf Port 3790 beziehungsweise ROOT/data.
