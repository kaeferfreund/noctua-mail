# Weitere Optimierungen beim Postfachwechsel — GPT-6.1 Sol

Stand: 23.10.2026; statische Analyse von `/home/monkey/code/noctua-mail/wt-switch-ideas`, laut Brief a504783. Keine Implementierung, neuen Laufzeitmessungen, Tests, Builds, Serverstarts oder externen Verbindungen. Alle Codepfade unten sind relativ zu diesem Checkout.

**Einordnung:** D1/D3/F1/F2/D2 sind bereits vorhanden. Die laufenden Arbeiten an Nachrichtenzeilen, früherem Listenabruf, nachgelagerten Nebenabrufen und A→B→A werden nicht erneut als neue Ideen verkauft. Rangfolge nach Nutzen, Belegbarkeit und Änderungsrisiko; die Zahlen sind **nicht addierbar**. „M“ bedeutet vorhandene Messung, „E“ eine noch zu prüfende Schätzung. Verifikationen unten sind Vorschläge für später, hier nicht ausgeführt.

**Messbasis:** `briefs/perf-mailbox-switch.md` §4: nach der ersten Optimierung warm ca. 191 ms bis zu kleinen, 396–403 ms bis zu großen und 471–479 ms bis zu 50-Ordner-Postfächern. Aus `perf-mailbox-switch/impl/e2e/r{2,3}-head-warm.json` statisch neu aggregiert, je Richtung n=10: Antwortende des ersten Ziel-`threads`-Abrufs → erste Zeilen weiterhin 234–239 ms bei großen/mittleren und 348–350 ms bei 50-Ordner-Postfächern. Das sind ältere Messungen derselben ersten Optimierung, keine Messung der laufenden zweiten Arbeit. Das ältere CPU-Profil in `perf-mailbox-switch-e2e.md` §6 ordnet 64–212 ms der Intl-Formatierung zu, ohne einzelne Aufrufstellen sicher zu trennen.

Für alle Ideen gelten weiterhin die Autorisierung je Pfad-Account, aktuelle Mitgliedschaftsprüfungen und bestehende Account-/Folder-Guards. Keine Rollen-/Session-Caches, kein Anzeigen alter Postfachinhalte vor frischer Freigabe, keine Änderung an Seitengröße, Paging oder Sicherheitsfristen.

## 1. G01 — Übersetzer für Ordner-Titel je Sprache wiederverwenden

- **Änderung:** `lib/i18n/translator.ts:11`, `getTranslator`, pro `UiLocale` einen Übersetzer wiederverwenden; alternativ die Wiederverwendung eng in `app/components/mailclient/folder/folderBadgePresentation.ts:21`, `getFolderCountTitle`, halten. Bestehendes Vorbild: `lib/i18n/folderNames.ts:10`.
- **Warum:** `FolderTreeNode.tsx:102` formatiert jeden Titel bei jedem Render. `getFolderCountTitle` ruft jedes Mal `createTranslator` auf. Die installierte Implementierung in `node_modules/use-intl/dist/esm/development/core.js:40` erzeugt dabei jeweils einen neuen Formatter-/Nachrichtencache. Die statischen Kataloge und Zeitzone ändern sich dabei nicht.
- **Gewinn:** **E 5–20 ms bei 50 Ordnern**, eher 1–3 ms bei sechs Ordnern; 0 Requests. Nur ein Teil des gemessenen Intl-Budgets entfällt auf diese Stelle, deshalb keine Behauptung „212 ms gespart“.
- **Nachteil/Risiko:** sehr gering; Sprache muss Teil des Schlüssels bleiben. Titel weiterhin mit aktuellen Zahlen formatieren; keine Titel oder Kontodaten global speichern.
- **Overlap:** **none**; betrifft Ordnerdarstellung, nicht die laufende Ableitung der Nachrichtenzeilen.
- **Prüfen:** Übersetzer-Konstruktionen zählen; deutsche/englische Titel mit 0/1/vielen Nachrichten vergleichen; Sprachwechsel und bestehende `FolderTree.i18n.dom.test.tsx` / `folderBadgePresentation.test.ts` prüfen. Anschließend 6-/50-Ordner-Szenarien paarweise messen.

## 2. G02 — Vermessene Themenvorschlags-Optimierung vorziehen

- **Änderung:** `lib/topics/suggestions.ts:674`, `getTopicSuggestionsForThreads`: bei fehlenden Themen früh zurückkehren; eigene Adressen und Ignore-Entscheidungen aus `shouldIgnoreTopicSuggestionSignal` (`:111`) einmal pro Aufruf vorbereiten/memoisieren. Der aktuelle Code hat diese Abkürzungen noch nicht.
- **Warum:** `threads/route.ts:89` aktiviert Vorschläge auch für themenlose Postfächer; `suggestions.ts:165` normalisiert/parst für jede Signalzeile erneut. `perf-mailbox-switch-server.md` §3/§9 S1 hat diesen Aufwand bereits isoliert.
- **Gewinn:** **M ungefähr 20 ms Serverarbeit ohne Themen bzw. 12–14 ms mit Themen**, bei der gemessenen 300-Thread-Seite; 0 Requests. Bei kleinerer erster Seite aus der laufenden Arbeit entsprechend weniger. Die gemessenen 66,5→38,4 ms sind ein Gesamtprototyp einschließlich anderer Änderungen und kein zusätzlicher Gewinn dieser Idee allein.
- **Nachteil/Risiko:** gering; nur aufruflokale Memos. Ausschluss eigener Adressen, Aliasse und leere Ergebnisse müssen identisch bleiben. Nicht mit einer dauerhaften Themenexistenz-Abfrage aus einem Cache arbeiten.
- **Overlap:** **parked item** — Server-S1; zusätzlicher Nutzen nach der laufenden Clientarbeit, aber abhängig von deren endgültiger Seitengröße.
- **Prüfen:** vorhandene Prototypdaten/Antwort-Hashes als Vorlage; identische Vorschläge bei gleichen Sendern in zwei Accounts, eigenen Aliasadressen und nach Themenanlage/-löschung zwischen zwei Requests. Bei null Themen keine Signalabfrage mehr.

## 3. G03 — Vier virtuelle Zähler als reine Zähler gebündelt abfragen

- **Änderung:** `app/components/mailclient/useSearchState.ts:210`, `fetchCount`, durch einen Account-gebundenen Zählerabruf ersetzen. Serverseitig einen kleinen Handler mit `requireAccountContext` und `validateAccountFolders` sowie gemeinsam genutzten Filter-/Zählfunktionen aus `lib/db/messages/query.ts:1659`, `getTotalCount`, bereitstellen.
- **Warum:** Vier `messages?pageSize=1`-Antworten werden auf `total` reduziert. `app/api/messages/listMessagesHandler.ts:63–78` berechnet dafür trotzdem Nachrichten, Gruppen, Themen und Collaboration; außerdem läuft dort vor `requireAccountContext` bereits ein weiterer Sessionguard (`:27/:48`). Ein Zählerhandler braucht diese Listenarbeit nicht. E2E §4 dokumentiert vier Abrufe je Aktualisierung.
- **Gewinn:** **4→1 Requests pro Zählerrunde**, außerdem keine vier ungenutzten Listenelemente/Gruppen/Enrichments; **E 5–25 ms Serverarbeit** pro Runde. Hauptnutzen: weniger Nachlauf und Verbindungskonkurrenz, kein zugesagter direkter Erstzeilen-Gewinn. Unter Last neu messen.
- **Nachteil/Risiko:** klein bis mittel; Zählersemantik keinesfalls vereinfachen: Focused/Todo sowie Kalendereinladungen inklusive Unread und ausgeschlossener Ordner müssen exakt der heutigen Filterlogik folgen. `viewerUserId` aus der Session; keine Counts aus einem anderen Postfach übernehmen.
- **Overlap:** **overlaps in-flight** — D5 verschiebt dieselben vier Abrufe; Bündelung und Weglassen ihrer Listenarbeit sind zusätzliche Änderungen. Mit dem Besitzer dieser Datei abstimmen.
- **Prüfen:** alle vier Ergebnisse gegen die bestehenden Endpunkte vergleichen, einschließlich Sent/Trash/Junk, gelöschter Nachrichten, eigener Zuweisungen und Einladungssonderfällen; 403 nach Entzug und fremde Folder-IDs prüfen; pro Refresh nur ein Request, Badges während des Wechsels weiterhin unbekannt statt fremd.

## 4. G04 — Datumsgruppen einmal je Datum/Thread ableiten

- **Änderung:** `lib/messageGrouping.ts:41`, `buildTimeGroupKey`, und `:61`, `buildMessageGroupKey`; aufruflokalen Gruppierungskontext mit einmaligem „Heute“ verwenden. In `lib/db/messages/query.ts:3098–3107`, `listThreads`, bei datumsabhängigen Gruppen den identischen Thread-Gruppenschlüssel wiederverwenden.
- **Warum:** Der aktuelle Pfad berechnet das Anzeigedatum vor der Verzweigung und danach erneut; „Heute“ wird für jede Nachricht wieder formatiert. Die gemessene Seite enthält 900 Nachrichten zu 300 Threads. Serverbericht §9 S2: 4,45→0,5 ms.
- **Gewinn:** **M rund 3,9 ms Serverarbeit je gemessener Seite**, 0 Requests; kleinerer Gewinn bei kleinerer erster Seite. Auch Gruppen ohne Datumsbezug können die unnötige frühe Datumsformatierung vermeiden.
- **Nachteil/Risiko:** sehr gering bei exakten, aufruflokalen Schlüsseln. Keine globale Minutenrundung und keine nebenbei veränderte Zeitzonen-/Gruppenlogik.
- **Overlap:** **parked item** — Server-S2.
- **Prüfen:** Ergebnisvergleich bei Mitternacht, DST, verschiedenen Thread-Datumsquellen, Jahr/Woche/Datum und eingefrorener Uhr; Reihenfolge und Gruppenzähler unverändert.

## 5. G05 — Stabile Ordnerdarstellung und spät erzeugte Menüinhalte

- **Änderung:** `app/components/mailclient/folder/FolderTree.tsx:66`, `folderPathLabel`, nach `[folderById, locale]` stabilisieren; in `FolderTreeNode.tsx:101–102` Pfad/Anzeigename/Titel nach ihren tatsächlichen Eingaben memoisiert ableiten. Die übersetzten Items aus `FolderTreeNode.tsx:216–244` in eine eigene Komponente innerhalb von `DropdownMenu.Content` verschieben.
- **Warum:** Pfade und Titel werden trotz unveränderter Ordner mehrfach berechnet. Außerdem wertet JSX die vier Menütexte bereits im Parent aus, auch wenn Radix den geschlossenen Inhalt nicht mountet. Ein Kind-Component verschiebt diese Arbeit bis zum Mounten des Inhalts. Trigger, Root und Radix-Presence bleiben bestehen.
- **Gewinn:** **E 2–15 ms bei 50 Ordnern**, nach G01 eher am unteren Ende; 0 Requests. Reine Pfad-/Titelmemoisierung wurde als 2–10-ms-Kandidat identifiziert; der Zusatznutzen der Menüs ist ungemessen.
- **Nachteil/Risiko:** gering. Hooks müssen vor dem bedingten Return in `FolderTreeNode.tsx:94` stehen. Elternumbenennung, Zähler und Sprachwechsel müssen sämtliche abhängigen Texte erneuern; keine Handler durch einen unvollständigen Memo-Vergleich einfrieren.
- **Overlap:** **none**; die Nachrichtenzeilen-Optimierung H behandelt einen anderen Baum. Überschneidung im Gewinn mit G01, deshalb nicht addieren.
- **Prüfen:** Render-/Formatteraufrufe zählen; Elternordner umbenennen, Badge ändern, Deutsch/Englisch wechseln. Menü per Tastatur öffnen, Aktion ausführen, Fokus nach Schließen sowie Desktop und 390 px prüfen.

## 6. G06 — Bekannte Thread-Indexzugriffe gezielt übernehmen

- **Änderung:** `lib/db/messages/query.ts:2928–2940` und `:2969–3019`, `listThreads`: BaseCount und Nachrichtenabruf über den vorhandenen `idx_messages_account_thread_date` prüfen; beim Nachrichtenabruf den bisherigen Gleichstand explizit mit `m.rowid ASC` sichern. Keine neuen Indizes/Migrationen nötig.
- **Warum:** Die vorhandene Profilierung fand einen Account-weiten Datumsindexscan statt Thread-Präfixzugriffen. `perf-mailbox-switch/server/results/sqlvariants.json` bestätigt identische 900 Zeilen; Serverbericht §9 S3: Nachrichten 10,9→4,3 ms, BaseCount 5,3→0,8 ms bei 11k Nachrichten. Der aktuelle Nachrichtenabruf hat weiterhin nur `ORDER BY m.dateValue DESC`.
- **Gewinn:** **M zusammen ungefähr 11 ms bei 11k Nachrichten**, 0 Requests. Bei 2k wurde der Nachrichtenabruf mit erzwungenem Index ca. 0,7–0,9 ms langsamer; deshalb BaseCount zuerst und Nachrichtenzugriff nur nach erneutem Plan-/Größenvergleich.
- **Nachteil/Risiko:** gering bis mittel; heutige FTS-/Filterzweige sind gegenüber dem alten Profil weiterentwickelt. Kein blindes Übertragen alter Zeilennummern, keine globale Indexerzwingung und kein ANALYZE/PRAGMA optimize.
- **Overlap:** **parked item** — Server-S3; Dateibesitz auch mit aktueller Sucharbeit koordinieren.
- **Prüfen:** EXPLAIN und Differentialvergleich auf kleinen/großen Postfächern, gleichen Datumswerten, Flagged-first, Ausschlüssen und Suchfiltern; Reihenfolge, Counts, Paging und fremde Folder-Abweisung unverändert.

## 7. G07 — Unveränderte Postfachzeilen separat rendern

- **Änderung:** `app/components/shell/ShellSidebar.tsx:76`, `MailboxRows`, in kleine Postfachzeilen mit `React.memo` aufteilen (`MailboxRow`); Partitionierung/Gruppierung (`:191/:86`) und Summary-Map (`:83`) nach ihren Eingaben memoisiert wiederverwenden. Wechselhandler in `MailClient.tsx:5436` und Sidebar `:242/:257` stabilisieren.
- **Warum:** Heute laufen bei jedem Sidebar-Render Gruppierung, Titel-/Statusformatierung und Avatarbaum aller Accounts erneut. Beim Wechsel ändern meist nur zwei Aktivmarkierungen; die benutzerweiten Summaries bleiben bestehen.
- **Gewinn:** **E 2–8 ms bei zwölf Postfächern**, 0 Requests. Bloßes `React.memo` um den heutigen Code reicht wegen neuer Arrays/Callbacks nicht.
- **Nachteil/Risiko:** gering; Standardvergleich mit stabilen Eingaben bevorzugen. Accountentzug, Avatar, alle Zähler, Watcherstatus und aktueller Handler müssen sofort berücksichtigt werden.
- **Overlap:** **none**.
- **Prüfen:** Renderzähler je Account; Wechsel aktualisiert aktive Zeilen, Summary-Event die betroffene Zeile. `Shell.dom.test.tsx` / `useMailboxSummaries.dom.test.tsx`, Tastaturbedienung und Schließen der mobilen Sidebar prüfen.

## 8. G08 — Identische Folder-Statusmeldungen als unverändert behandeln

- **Änderung:** `app/components/mailclient/folderStreamUpdates.ts:11`, `applyFolderStreamUpdates`, nur tatsächlich geänderte Folder-Objekte ersetzen und ohne Änderung das alte Array zurückgeben; Updates einmal nach ID indizieren, statt pro Folder `find` aufzurufen.
- **Warum:** Der Helfer erzeugt heute immer ein neues Array und bei jeder passenden Meldung ein neues Objekt. Der Stream sendet beim Öffnen ausdrücklich den Status (`app/api/accounts/[accountId]/imap/stream/route.ts:272`); dieser kann mit der gerade geladenen Folder-Antwort identisch sein. `MailClient.tsx:772/828/829` baut daraufhin Account-Folder, Baum und Map neu auf.
- **Gewinn:** **E 2–15 ms pro wirkungsloser Statusmeldung bei 50 Ordnern**, häufig weniger; 0 Requests. Keine Einsparung der vier Counts behaupten: deren vorhandener String-Schlüssel bleibt bei identischen Zahlen ohnehin gleich.
- **Nachteil/Risiko:** sehr gering. `uidNext` wird in `useSyncController.ts:1261` separat verarbeitet und muss auch ohne Folder-Stateänderung fortgeschrieben werden. Fehlendes `unseen` darf einen vorhandenen Unread-Zähler nicht löschen.
- **Overlap:** **none**.
- **Prüfen:** Identität von Array/Objekten bei unveränderten und unbekannten IDs; genau geänderte Counts/Unread-Werte veröffentlichen. Bestehende `folderStreamUpdates.dom.test.tsx` ergänzen; Wiederholung eines identischen Events darf keine Folder-Neuberechnung auslösen.

## 9. G09 — Unveränderte Collaboration-Werte nicht neu veröffentlichen

- **Änderung:** `MailClient.tsx:5393` Providerwert nach Mitgliedern und `threadCollabById` memoisierten; leere Mitglieder-Fallbacks in `app/hooks/useThreadCollab.ts:307–310` stabil halten. `invalidateThreadCollab` (`MailClient.tsx:2887`) bei fehlendem Account-Eintrag `prev` zurückgeben.
- **Warum:** Der Provider erzeugt bei jedem Parent-Render ein neues Objekt. `CollabRowBadges.tsx:20` abonniert diesen Context. Eine leere Cacheinvalidierung erzeugt ebenfalls eine neue Map; der Effekt läuft bei Accountwechsel und erster autoritativer Antwort (`MailClient.tsx:2891`).
- **Gewinn:** **E 0–5 ms je Wechsel**, 0 Requests; garantiert weniger wirkungslose Veröffentlichungen, aber kein garantierter zusätzlicher React-Commit weniger.
- **Nachteil/Risiko:** gering; echte Cache-/Mitgliederänderungen einschließlich `readDenied` dürfen niemals ausgespart werden. Kein Beibehalten alter Accountdaten als „Optimierung“.
- **Overlap:** **overlaps in-flight** — angrenzend an H/Nachrichtenzeilen; anderer Auslöser als die Ableitung der Zeilen, aber möglicherweise bereits in deren Renderarbeit berücksichtigt.
- **Prüfen:** Badge-Renderzähler bei unabhängigen Parent-Updates; Zuweisungs-, Kommentar-, Mitglieder- und Entzugsereignisse bleiben sofort sichtbar. Vorhandene Collaboration-Tests und Accountwechsel prüfen.

## 10. G10 — Abbruch auch für veraltete Refresh- und Folder-Leseantworten

- **Änderung:** `app/components/mailclient/useMessageData.ts:306`, `refreshMailboxData`, in Abbruch/Lebenszyklusverwaltung aufnehmen; auf Schlüsselwechsel auch diesen GET abbrechen. `useAccountController.ts:289`, Folder-GET, bei überholtem Wechsel abbrechen. Weiterhin Versions-/Mutationsprüfungen nach jedem Await behalten.
- **Warum:** D3 schützt den paginierten Load, aber `refreshMailboxData` lädt separat ohne Signal und parst die Antwort (`:321`) vor dem Schlüsselvergleich (`:343`). Auch überholte Folder-GETs laufen weiter. Ein laufender Sync-/SSE-Refresh kann dadurch während des nächsten Wechsels noch große alte JSON-Antworten verarbeiten.
- **Gewinn:** **0 im ungestörten Normalfall**; je überholtem Listen-Refresh bis zu eine gemessene ca. **0,86-MB-Antwort** weniger vollständig übertragen/verarbeitet, plus unnötige Folder-Antworten. Keine belastbare ms-Zahl vorhanden. Abgebrochene Requests sind keine garantierte Ersparnis bereits begonnener Serverarbeit.
- **Nachteil/Risiko:** klein bis mittel; nur GETs abbrechen, niemals den serialisierten Auswahl-POST. Abbruch darf weder Fehler anzeigen noch Ladezustand eines neueren Abrufs löschen; neue Mutationen dürfen nicht durch Wiederverwendung alter Ergebnisse verloren gehen.
- **Overlap:** **overlaps in-flight** — dieselben Hooks wie D4 und schnelle Wechsel; Erweiterung über D3 und das Weglassen des ersten doppelten Sync-Refreshs hinaus. Nicht parallel ohne Abstimmung ändern.
- **Prüfen:** A-Refresh offenhalten, nach B wechseln, Signalabbruch vor JSON-Verarbeitung erwarten; verspätete A-Antwort ohne Wirkung/Fehler. Neuere B-Mutation und Refresh sowie Reader-focus-Paging weiter korrekt.

## 11. G11 — Kurze Lockkollisionen beim Auswahl-Write schneller erneut versuchen

- **Änderung:** `lib/betterAuth.ts:223`, `setActiveAccountId`, vorhandene `withDbWriteRetry`-Option `handshakeRetry` gezielt für geeignete SQLITE_BUSY/LOCKED-Kollisionen nutzen; Mechanismus in `lib/dbWriteRetry.ts:79–97`. Statement, Autorisierung und Gesamtbudget beibehalten.
- **Warum:** Der Aufruf verwendet heute die grobe Standardstaffel von zunächst 96–144 ms. Serverbericht §4/§9 S4c weist unter Writerstress zahlreiche kurze Kollisionen nach; der Browser-Spike fand dagegen keine solche Switch-Kollision. Das ist eine Verbesserung des seltenen langen Endes, keine Erklärung für normale 400-ms-Wechsel.
- **Gewinn:** **E ca. 90–130 ms je kurzzeitig kollidierendem ersten Retry**, 0 Requests, im ruhigen Fall 0 ms. Kein Versprechen eines bestimmten p99 oder der Beseitigung aller 500er; längere Sperren bleiben möglich.
- **Nachteil/Risiko:** mittel wegen Authpfad und erhöhter Retry-Frequenz; bestehenden Fehlerfilter und das Gesamtzeitbudget erhalten. Keine pauschale Änderung aller DB-Writes und keine blockierenden Sleeps.
- **Overlap:** **parked item** — Server-S4c; nicht mit dem bereits aus dem Switch entfernten `/auth/me`-Write verwechseln.
- **Prüfen:** kontrollierte kurze/lange Schreibsperren, abgelaufene Session, Entzug zwischen Vor-/Nachprüfung und Antwortreihenfolge bei schnellen Klicks; Retries und CPU unter Last vergleichen. Eine passende Authverifikation genügt.

## 12. G12 — Bereits verworfene Listenfelder gar nicht erst aufbereiten

- **Änderung:** `lib/db/messages/query.ts:3008–3009/3091–3092`, `listThreads`, optional eine schmale Listenprojektion für `threads/route.ts:75` anbieten. Dort entfallende `categoryScore`/`categorySignals` nicht selektieren/parsen; gemeinsame Aufrufer behalten ihren bisherigen Vertrag. Der API-Slimmer entfernt sie ohnehin (`threads/route.ts:36–37`).
- **Warum:** Insbesondere `categorySignals` wird von SQL gelesen, als Array geparst und anschließend vor der Antwort gelöscht. Das ist konkret nachweisbare, ungenutzte Arbeit; die Kategorie selbst und alle Flags bleiben notwendig.
- **Gewinn:** **E 0–2 ms bei 900 Nachrichten**, mehr nur bei großen Signalarrays; 0 Requests und keine zusätzliche Antwortverkleinerung, weil diese Felder bereits fehlen. Nur als Mitnahmeeffekt, keine eigene größere Baustelle.
- **Nachteil/Risiko:** gering bis mittel: `listThreads` ist geteilter Code. Eine globale Feldentfernung könnte andere Aufrufer verändern; Typen, Kalender-, Identitäts- und Compose-Metadaten nicht nebenbei ausdünnen.
- **Overlap:** **none**; ggf. Koordination mit Query-Änderungen aus G06.
- **Prüfen:** bytegleiche API-Antworten und unveränderte Ergebnisse anderer `listThreads`-Aufrufer; Parseraufrufe für ausgeschlossene Felder zählen. Nur übernehmen, wenn die Projektion klein und verständlich bleibt.

## 13. G13 — HTTP/2 am Browserzugang prüfen; nur bei echtem HTTP/1.1-Engpass ändern

- **Änderung:** vorhandene Go-live-Proxyvorlage in `briefs/go-live-runbook.md:317` als Bezugspunkt; Verbindung des Browsers über einen HTTP/2-fähigen Zugang führen, falls sie derzeit HTTP/1.1 verwendet. `lib/server/standalone.ts:30` darf HTTP/1.1-Upstream bleiben. Kein neuer Proxy nur auf Verdacht.
- **Warum:** E2E §4/§7: Zwei SSE-Verbindungen je Tab belegen im HTTP/1.1-Szenario Verbindungsslots; bei zwei Tabs wurden 680–930 ms Queueing-Ausreißer und 0–150 ms zusätzliche Erstzeilenzeit beobachtet. Das tatsächliche Preview-Protokoll wurde ausdrücklich nicht ermittelt; die vorhandene TLS-Proxyvorlage könnte den Bedarf bereits erfüllen.
- **Gewinn:** **0, falls bereits HTTP/2 oder keine Verbindungskonkurrenz**. Sonst potenziell ein Teil der gemessenen 0–150 ms bei zwei Tabs und weniger Queueing-Ausreißer; keine belastbare Prognose nach D5, 0 Requests weniger.
- **Nachteil/Risiko:** mittel durch Infrastrukturänderung; SSE ohne Buffering, Host-/Origin-Behandlung und Auth-Header unverändert halten. Kein Entzug von Streams oder Mailboxrechten zugunsten freier Slots.
- **Overlap:** **parked item** — bekannter Mehrtab-/HTTP/1.1-Befund; D5 dürfte den Engpass bereits verkleinern.
- **Prüfen:** später per Browser-Protokoll/Timing erst bestätigen, dann ein/zwei Tabs vergleichen; lange SSE-Verbindungen und sofortige Revocation prüfen. Hier weder Preview noch Proxy kontaktiert.

## 14. G14 — Residenten Sync-Worker für später zurückstellen

- **Änderung:** `lib/syncJobs.ts:454`, `launchSyncWorker`, langfristig nach `briefs/design-resident-sync-worker.md` auf wiederverwendete Worker umstellen, statt je Job `bun.spawn` (`:464`) zu starten.
- **Warum:** Die vorhandene Designmessung nennt ca. 328 ms kalten Import pro Job. Das betrifft Sync und Nachlauf; E2E §7 zeigt, dass IMAP nicht die ersten Zeilen sperrt. Die laufende D5-Arbeit nimmt zusätzlich den ersten Sync aus dem frühen Zeitfenster.
- **Gewinn:** **E 390–640 ms je geeignetem wiederholtem Sync-Job** laut vorhandenem Design, kein belegter Gewinn bei den ersten Mailzeilen und 0 Browserrequests weniger. Nicht als weitere 400-ms-Verbesserung jedes Postfachwechsels zählen.
- **Nachteil/Risiko:** hoch: Prozess-/Lease-Lebenszyklus, Accountisolation, Credentialwechsel, Versionswechsel und Shutdown. Damit aktuell kein kleiner Schritt „ohne große Nachteile“.
- **Overlap:** **parked item** — bekannter Resident-Worker-Entwurf; D5 adressiert bereits die unmittelbare Switch-Priorität.
- **Prüfen:** erst nach Go-live die dort beschriebenen Isolation-/Lease-/Shutdown-Fälle und wirklichen Sync-Nachlauf messen. Für dieses Optimierungsziel hinter den lokalen Ideen lassen.

## Zusammenfassung — fünf Zeilen

Die beste neue lokale Maßnahme ist die Wiederverwendung der Übersetzer für Ordner-Titel.
Danach: reine Zählerantworten bündeln und unveränderte Sidebar-/Ordnerdarstellung wiederverwenden.
Bereits vermessene Serverideen bleiben sinnvoll: Themenvorschläge, Datumsgruppen und passende Indexzugriffe.
Alle neuen Zeitgewinne sind Schätzungen; Überschneidungen mit der laufenden Arbeit sind markiert.
Nur statisch analysiert; keine Tests, Builds, Server, externen Dienste oder Anwendungsdaten berührt.
