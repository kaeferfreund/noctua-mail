# Equal live updates — Implementierungsbericht

Stand: 2026-10-23. Branch: `perf/equal-updates-noop`.
Worktree: `/home/monkey/code/noctua-mail/wt-equal-updates`.
Basis: `f29fbd637971d909282de479f392de36d0b9951c`.
Commit: `2efa3c0f7e238fc83383974cf0b09cb4cc43b022`.

## Änderungen

- `folderStreamUpdates.ts`: identische, unbekannte, leere und reine `uidNext`-Updates behalten das bisherige Array. Nur geänderte Zähler erzeugen eine neue Ordnerreferenz; unbekannte Unread-Zahlen bleiben unbekannt.
- `threadCollabUpdates.ts`: kleine reine Helfer für beide Map-Ebenen, Nachrichtenlisten und die ausgewählte Nachricht. Verglichen werden Status, Zuweisung, Kommentarzahl, Zeitstempel und sämtliche zusätzlichen Felder des vollständigen `ThreadCollabState`, einschließlich Revision und Zuweisungs-/Aktivitätsmetadaten.
- `MailClient.tsx`: diese Helfer ersetzen die bisherigen unbedingten Kopien. Unveränderte Thread-Inhalte werden nicht erneut in den Thread-Cache geschrieben. Sonstige Abläufe bleiben unverändert.
- Mailbox-Zusammenfassungen behalten bei gleichen SSE-Werten ihre Referenzen, einschließlich gleichwertiger Watcher-Objekte. Gleichwertige kanonische Antworten werden innerhalb der bestehenden Sitzung abgeglichen; Rollen, Eigentümerschaft, Shared-Status, Name und E-Mail werden dabei ausdrücklich berücksichtigt.
- Sitzungswechsel, Berechtigungsentzug, unbekannte Mailboxen, alte Server ohne vollständige Metadaten und autoritative Invalidierungen behalten ihre bisherigen Lösch-/Reparaturpfade. Es gibt keinen neuen globalen Cache.

## Render-Messung

Reproduzierbarer synthetischer Happy-DOM-Test mit React `Profiler` in `equalLiveUpdates.dom.test.tsx`. Der Test nutzt den echten `FolderTreeNode`, einfache Listen-/Lesebereichsansichten und dieselben Update-Helfer wie der MailClient. Er misst zusätzliche Commits nach Mount und einem Aufwärmereignis, jeweils über 20 getrennt mit `act` zugestellte identische Ordner-/Kollaborationsereignisse.

- Vorher: Liste **20**, Ordnerleiste **20**, Lesebereich **20**.
- Nachher: Liste **0**, Ordnerleiste **0**, Lesebereich **0**.
- Eine anschließende echte Änderung aktualisiert Unread-Badge, Notizanzahl, beide Cache-Ansichten und Lesebereich; die Liste erhält genau einen zusätzlichen Commit.
- Die Vorher-Messung lief mit dem ursprünglichen Ordner-Reducer und den unverändert in Helfer extrahierten bisherigen Kollaborationsoperationen. Anschließend wurden die Helfer optimiert und die Erwartung auf null umgestellt.
- Zusätzlicher Hook-DOM-Test: 20 identische Mailbox-SSEs verursachen **0** zusätzliche Render-Aufrufe des Sidebar-Harness und **0** weitere Snapshot-GETs. Alle 20 `onSummaryChanged`-Signale werden weiterhin zugestellt.

Die Messung ist ein gezielter DOM-/Reducer-Nachweis, kein Profil des vollständig gemounteten MailClient. `onSummaryChanged` bleibt absichtlich autoritativ: gleiche Summenzähler beweisen keine identischen Einzelzuweisungen. Dessen konsumierende Aktualisierungen sowie vollständige Kommentar-/Aktivitäts-Snapshots in `useThreadCollab` werden nicht unterdrückt.

## Gates

- `bun install`: erfolgreich.
- `bun check`: Exit 0, keine Typfehler; auch im Build erfolgreich.
- ESLint auf allen zehn geänderten Dateien: Exit 0, **0 Fehler, 0 neue Warnungen**. Baseline und Ergebnis enthalten dieselben 74 bestehenden Warnungen: 73 in `MailClient.tsx`, eine in `useMailboxSummaries.ts`. Zusätzlich per ESLint-API gegen `git show HEAD:<Pfad>` vor dem Commit geprüft, einschließlich Regel, Schweregrad, Meldung und Quellzeile; keine neuen Diagnosen.
- Unit-Tests: **25 bestanden, 0 fehlgeschlagen**, 308 Assertions. Dateien: `folderStreamUpdates.test.ts`, `threadCollabUpdates.test.ts`, `mailboxSummaryEvents.test.ts`.
- DOM-Tests: **110 bestanden, 0 fehlgeschlagen**, 1.018 Assertions. Dateien: `equalLiveUpdates.dom.test.tsx`, `folderStreamUpdates.dom.test.tsx`, `useMailboxSummaries.dom.test.tsx`, `useThreadCollab.dom.test.tsx`, `useSyncController.dom.test.tsx`.
- `bun run build`: Exit 0, Produktionsbuild erfolgreich; Kompilierung 18 Sekunden, 31 statische Seiten erzeugt.
- `git diff --check`: erfolgreich; Worktree nach Commit sauber.

Die Tests prüfen Referenzidentität bei Wiederholungen, gezielte Ersetzung je Feld, unveränderte Nachbarobjekte, Konto-/Sitzungsisolation, Reconnects und Berechtigungsinvalidierungen. `useMessageData.ts` und `useAccountController.ts` wurden nicht geändert. Die vollständige CI-Suite wurde nicht ausgeführt; geprüft wurden die betroffenen Bereiche und die bestehenden Kollaborations-/Sync-Regressionen.

Nur synthetische Daten; kein Server gestartet und kein Port verwendet. Kein Zugriff auf Port 3790, Live-Daten oder externe Mailserver. Keine Pushes, PRs, Merges, Deployments, Service-Neustarts oder Zugangsdatenänderungen. Generierte Build-Versionsdatei wiederhergestellt; temporäre Arbeitsdateien entfernt.
