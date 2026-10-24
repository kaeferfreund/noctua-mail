# Sync info@rc-portal.com

Stand: 23.10.2026. Codebasis `9523bbee`, untersuchte Dev-Version laut Auftrag `df8bd4f`. Auswertung ausschließlich aus Journal und lokal kopierten, read-only geöffneten Datenbanken.

## Ursache und Belege

- Konto: `acc-e2800a0f7acbb4770ff324d5`; Shard: `db/accounts/acc-e2800a0f7acbb4770ff324d5.db` unter dem Dev-Datenverzeichnis. Kopierter Stand: **7.800 INBOX-Nachrichten**, `MAX(imapUid)=7810`, `mailbox_state.highestUid=7810`, `uidValidity=NULL`, `highestModSeq=NULL`; `mailbox_summary.lastSyncAt=NULL`, `watcherState=idling`. Der Watcher-Zustand belegt keinen abgeschlossenen Sync.
- Journalfenster 10:59–22:58 UTC: 460 Vorkommen der Fehlermeldung, davon 444 Statusabfragen, ein Worker-Abbruch und sieben Wiederholungsversuche. Das sind keine 460 unabhängigen Parserfehler.
- 22:52:52 UTC: Fortschritt 7.830/16.037, dann `TypeError: (value ?? "").split is not a function`. Stack: `parseImapMessage` → `mergeAttachmentMetadataFromParsedAttachments` → `pickParsedAttachment` (`attachmentFromSource.ts:72`) → `normalizeContentType` (`attachmentMatch.ts:12`). Der aktuelle Batch wurde nicht gespeichert.
- 22:56:45 UTC: `attempt 6/11 failed (...), retrying in 81.085s, will resume from UID 7811`; derselbe Fehler erneut um 22:58:07. **7811 ist der Wiederaufnahmepunkt**, nicht die nachgewiesene UID der fehlerhaften Nachricht.
- Reproduzierbare Eingabe: MIME-Anhang mit vorhandenem, leerem `Content-Type:`. Das installierte `@zone-eu/mailsplit` 5.4.29 liefert dafür `false`; Mailparser 3.12.4 reicht diesen Wert als `attachment.contentType` weiter, obwohl seine Typdeklaration `string` verspricht. Ein echter synthetischer IMAP-Sync reproduzierte vor dem Fix exakt denselben Stack. Die Originalnachricht wurde nicht extern abgerufen; ihr konkreter Header und ihre genaue UID sind damit nicht direkt verifiziert. Für Array-/Objektwerte gibt es keinen Beleg.
- Historie: `7878a5ad` führte die ungeprüfte String-Annahme ein; `b183ef9f` nahm den Metadatenabgleich in den Sync auf. `3e813114` verschob den unveränderten Normalisierer in die heutige Datei. `7d31d6d` ändert nur die Icon-Cache-Konfiguration. `fdc52bae`, integriert durch `dd27be7d`, erhöht Mailparser 3.12.3 → 3.12.4; mailsplit 5.4.29 und libmime 5.6.3 bleiben dabei unverändert. Eine neu eingeführte Regression durch diese Aktualisierung ist nicht belegt.

## Letzter Fehler in der Oberfläche

In Master/Shard gibt es kein gespeichertes Feld `lastSyncError`. Der Fehler kommt aus dem laufzeitinternen Sync-Job (`job.error` bzw. `progress.message`), belegt durch `[sync-status]` und den UI-Abfragecode. Im Wiederholungszustand lautet er:

```text
(value ?? "").split is not a function. (In '(value ?? "").split(";")', '(value ?? "").split' is undefined)
```

Beim fehlgeschlagenen Job beginnt die Meldung mit `[2026-10-23 22:52:52.525 +00:00] TypeError:` und enthält zusätzlich den Stack.

## Fix und Prüfung

Commit **`7b36365659ed8767a7047b13623705bdaa70d1b2`**, Branch `fix/sync-header-split`:

- Nicht als String vorliegende MIME-Typen gelten als nicht verfügbar; keine `String()`-Umwandlung. Beim Zusammenführen bleibt der vorhandene IMAP-Typ erhalten. Auch der CID-Pfad und die Kalendererkennung behandeln den `false`-Wert sicher. Die redundante Typbehauptung im Sync entfällt.
- Regression mit ausschließlich synthetischen Daten und echtem IMAP auf Loopback: Wiederaufnahme nach 7810 speichert 7811 und die Folgemail 7812; Ergebnis, persistierter Cursor und Fortschrittsmeldung erreichen 7812. Anhangsextraktion, CID-Abgleich sowie Kalendererkennung/-extraktion sind ebenfalls geprüft. Retry-Budget und Wiederaufnahmelogik bleiben unverändert.
- Alle Gates nacheinander mit `TMPDIR=<worktree>/.tmp` und `nice -n 15`: `bun check` **0 Fehler / 1.338 Dateien**; ESLint **0 Fehler, 0 Warnungen / 5 Dateien**; `bun test lib/mail` **273 bestanden, 0 fehlgeschlagen / 27 Dateien / 725 Assertions**, einschließlich beider `mailboxWatcher*.test.ts`; zusätzliche Sync-Gates (`syncJobs`, `syncOperation`, Fortschritt, Move-Reconciliation, Policy, Semaphore) **65 bestanden, 0 fehlgeschlagen / 6 Dateien / 142 Assertions**. Gesamt: **338/0**, 867 Assertions. Die neue Regression scheiterte vor dem Fix erwartungsgemäß **0/1** und besteht danach. `git diff --check` fehlerfrei.

## Offen

Im Journal gibt es 382 Vorkommen von `Unexpected close`; die gefundenen Connect-Retries zu `mxf9a0.netcup.net` sind anderen Konto-IDs zugeordnet. Für dieses Konto sind erfolgreiche Verbindungen um 22:51:59 (71 ms) und 22:54:52 (74 ms), erfolgreiche Authentifizierung und keine solchen Connect-Fehler im untersuchten Fenster dokumentiert. Diese Verbindungsabbrüche sind ein separates Thema und erklären den deterministischen Parserabbruch nicht. Ein Zugangsdatenwechsel ist durch die Befunde nicht begründet.

Der Fix ist ausschließlich im Arbeitsbranch committed. Ein späteres Deployment und die Erfolgskontrolle am echten Postfach stehen aus. Dev-Dienst, Konfiguration und Live-Daten wurden nicht verändert; kein externer Mailserver wurde durch diese Untersuchung kontaktiert. Datenbankkopien, Journalexport und sonstige Scratch-Dateien wurden mit `.tmp` entfernt.

## Zusammenfassung

1. Ursache: ungeprüfter MIME-Typ; leerer Header reproduziert `contentType=false` und den Sync-Abbruch.
2. Fix: `7b36365659ed8767a7047b13623705bdaa70d1b2` auf `fix/sync-header-split`.
3. Ursprung: String-Annahme `7878a5ad`, Aufnahme in den Sync `b183ef9f`.
4. Prüfung: Typen/Lint fehlerfrei, 338 Tests bestanden; Cursorfortschritt bis 7812 nachgewiesen.
5. Offen: Deployment und Live-Erfolgskontrolle; Dev-Instanz unverändert, `.tmp` entfernt.
