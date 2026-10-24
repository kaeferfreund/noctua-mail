# Handoff: Deps/Perf thread 96c8419f → "Noctua Orchestrator"

Stand 2026-10-23 ~16:40 UTC. Basis aller laufenden Arbeiten: `origin/integration/stage` **e70c30b** (Runde 9).
Regeln ab jetzt: `AGENTS.md` (Majors und Perf pausieren bis nach Go-live; laufende Branches laufen zu Ende und werden bei Grün gemergt, keine Folgerunden).
Alle Child-Tasks laufen auf `claude-judith` / `claude-opus-5-5` / effort high. Sie committen nur lokal, keiner pusht. Push mit kaeferfreund-Token (siehe Fallstricke).
taskId-Präfixe: **P1** = `node:delegated-task:command%3Amcp%3A1d1d2988-9b0a-4238-85c4-5013c0179d90%3Adelegate-task%3A`, **P0** = `node:delegated-task:command%3Amcp%3A0abaa2c2-f2c7-42b6-a0a9-c78e2a7e5f85%3Adelegate-task%3A`. childThreadId = `thread:delegated-task:command%3Amcp%3A<uuid>%3Adelegate-task%3A<id>` mit derselben uuid und id.

## Laufende Child-Tasks (nicht abbrechen)

| id (Präfix) | Worktree / Branch | HEAD jetzt | Erwartet | Merge-Bedingung |
|---|---|---|---|---|
| `deps-wave-r9-r1` (P1) | wt-deps-wave-r9 / chore/deps-wave-r9 | b5227f8 (4 von 6 Commits) | Commit 5 `@types/sanitize-html` nur bei grünem `test:standalone-workers`, Commit 6 Build-Typgate (Variante B), Bericht `briefs/deps-wave-r9.md` | Owner-Nachweise je Commit, siehe `briefs/deps-wave-r9-task.md` „Owner decisions“; ESLint 10 und happy-dom 21 sind Majors |
| `perf-account-batching-r1` (P1) | wt-perf-account-batching / perf/account-presentation-batching | 9b379e0 (5 Commits) | Session-UPDATE-Skip (5 min) als eigener Commit, Lastvergleich, Security-Control-Lauf, Bericht `briefs/perf-account-batching.md` | Review durch die Auth-Owner; Bedingungen in `briefs/perf-account-batching-task.md` |
| `perf-html-sanitize-r1` (P1) | wt-perf-html-sanitize / perf/html-sanitize-single-pass | f8189bb (2 Commits) | htmlPrivacy 177, Bench, Gates, Bericht `briefs/perf-html-sanitize.md` | Security-Review; Differential mit Golden Hashes und Fuzz-Seeds muss byteidentisch sein |
| `perf-mailbox-switch-r1` (P1) | wt-perf-mailbox-switch / perf/mailbox-switch | b7974e7 (D1, D3, F1, F2, D2) | Gates, Vorher/Nachher-Messung, Bericht `briefs/perf-mailbox-switch.md` | Invarianten (a) folderAccountGuard, (b) loadInitialData-Deps, (c) kein Revocation-Delay, je mit Test; merge-tree gegen neue Tips von reader-focus, status-bar-compact, fix/qa-sweep3-r1, i18n-slice3 |
| `fix-fts-german-folding-r1` (P1) | wt-fix-fts-german-folding / fix/fts-german-folding | b3eed2d (auf 5c5b605 = e29b64f + Merge e70c30b) | QA-208 ß/ss und Umlaut-Varianten auf der Query-Seite, Bericht `briefs/fts-german-folding.md` | Owner-Review; erst nach perf/fts-search-driven mergen. Shard-Formatänderung nur nach Design und Review |
| `spike-mailbox-switch-server-r1` (P0) | wt-spike-switch-server (detached 647359b), read-only | — | `briefs/perf-mailbox-switch-server.md` (in Arbeit): Routen-Profil und unabhängige Prüfung der D1-Sicherheitsannahme | nichts zu mergen; findet der Spike eine Route, die über die Session-Auswahl autorisiert, ist D1 zu stoppen |

Fertige Spikes:
- **spike-mailbox-switch-client-r1** (P0): `briefs/perf-mailbox-switch-client.md`. Worktree ist entfernt.
- **spike-mailbox-switch-e2e-r1** (P0): `briefs/perf-mailbox-switch-e2e.md`. Ergebnis, Median Klick bis erste Zeilen, warm 378–711 ms, kalt 662–1.141 ms. Den größten Teil kostet das Rendern von 300 angeforderten Threads bei nur etwa 18 sichtbaren Zeilen (134–412 ms). Dazu kommen die serielle Kette und Requests für das alte Postfach. Server-Zeit ist nicht der Engpass. Der Worktree wt-spike-switch-e2e ist noch vorhanden, ebenso der Datenordner `data/noctua-data-spike-switch-e2e`.

## Fertige Branches (gepusht)

| Branch | SHA | Gates | Merge-bereit |
|---|---|---|---|
| perf/fts-search-driven | **e29b64f** | eigene Basis: test:ci 2.905 + 462. Auf echtem Runde-9-Merge: lib/db 395/395, test:ci 3.016 + 564, typecheck 0. Owner-Review r1: alle Follow-ups erledigt | ja, für Runde 10 gepinnt |
| perf/rrule-lazy | 122ca69 gepusht; **46bdb7d** lokal = Merge e70c30b | 46bdb7d: typecheck 0/1.249; Build und verifyStandaloneWorkerBuild grün; rrule in keinem First Load (0 Marker auf allen 5 Routen); „/“ 648.516 B gzip gegenüber 658.204 auf Runde 9; Lint 0/181; test:ci läuft. Ergebnis wird hier angehängt | 46bdb7d nach grünem test:ci pushen und **statt 122ca69** pinnen. 122ca69 hat einen Konflikt mit e70c30b |
| perf/tiny-headers | **7d31d6d** | test:ci 2.812 + 462 bei niedriger Last; merge-tree gegen e70c30b sauber (Umbau geprüft) | ja |
| perf/test-parallel-fixes | **018452b** (enthält Trial a614f26) | stress-parallel mit 3 Seeds je 8.412/0, test:ci seriell grün | ja, nur 018452b pinnen. test:ci bleibt seriell |

Schon integriert (keine Aktion nötig): chore/deps-next-16-4 4547815 (Runde 9), Lock-Line A/B/C (sharp, imapflow 2.9.1, nodemailer 10.2.1, MCP 1.32.1), perf/fts-identity-v3 36be023, db-retrieval-statements 64cdb64, die sechs Perf-Branches aus Runde 6, typecheck-bun, drafts-autosave, client-assets, client-startup-v2.

## Bewusst nach Go-live verschoben
- Postfachwechsel D4 und D5. Beide brauchen einen MailClient.tsx-Hunk.
- Weitere Befunde aus dem e2e-Spike:
  - Listen-Seitengröße 300 und Row-Rendering;
  - doppelter Listen-Reload nach dem Auto-Sync beim ersten Besuch;
  - die Sidebar-Markierung hängt bis zu 350 ms nach;
  - ein zweiter Tab folgt dem Wechsel nicht;
  - unter HTTP/1.1 sperren die Streams zweier Tabs Verbindungen (HTTP/2-Proxy klären).
- Residenter Sync-Worker: Design Rev. 2 in `briefs/design-resident-sync-worker.md`, Owner-Review steht aus.
- Thread-Collapse-Fix beim ersten Commit: `briefs/perf-thread-collapse-task.md`.
- Batching Phase 2: `ensureCalendarEventRuntimeData` in `lib/db/schema.ts`, außerdem SSE-Fan-out.
- FTS-Follow-ups:
  - F1, Cap-Messung auf echten Logs nach Deploy;
  - F6, Thread-Selector aufs PK;
  - F7, Nachmessung auf ruhiger Box;
  - F8, ID-Substring-Pass.
- Umstellung von test:ci auf parallel. Der Trial ist grün, die Entscheidung steht aus.
- TypeScript 7 (typescript-eslint blockiert), @types/node 26, FullCalendar 7 (upstream blockiert).
- Aufteilung des i18n-Katalogs pro Surface. Das gehört dem Umbau-Thread in i18n Slice 3.

## Offene Release-Bedingung und fremde Befunde
- **Docker-Worker-Image-Gate für Next 16.4** (`bun run test:docker-workers`) lief nie, weil auf dieser Box kein Docker installiert ist. Es muss vor dem Go-live auf einem Docker-Host laufen.
- Aus dem e2e-Spike: Unter starker Neu-Mail-Last brachen drei Hintergrund-Sync-Worker nach erschöpften DB-Lock-Retries ab. Das ist Sync/Watcher-Bereich, nicht Perf.

## Bekannte Konflikte und Fallstricke
- **perf/mailbox-switch gegen feat/i18n-slice3 7c05ea6:** merge-tree meldet einen Konflikt in `tests/browser/compose/qa-compose.spec.ts`. Der besteht schon zwischen e70c30b und i18n-slice3, der Wechsel-Branch fasst die Datei nicht an. ComposeOrchestrator.tsx aus D2 merged automatisch.
- **UpcomingStatusPopover.tsx** ändern sowohl rrule-lazy als auch status-bar-compact. merge-tree gegen deren neuen Tip prüfen.
- **fix/fts-german-folding** enthält einen Merge von e70c30b und baut auf e29b64f auf. Reihenfolge: fts-search-driven, dann german-folding.
- **Gate-Läufe in Claude Code auf Branches ohne fc8aab3:** mit `env -u CLAUDECODE -u AGENT -u REPL_ID` starten. Sonst schlagen die Resync-Sender-Key-Tests fehl, und test:ci überspringt die DOM-Suite. Ab e70c30b ist das nicht mehr nötig.
- **Nach dem Merge eines neueren Stage-Stands** in einen Worktree `bun install` ausführen. Sonst kommen falsche Next-Typen, zum Beispiel ein Fehler wegen `bfcacheId`.
- **Push:** Der aktive gh-Account steht auf MonkeyMed. Push zu kaeferfreund/noctua-mail per `gh auth token --user kaeferfreund` über ein temporäres `GIT_ASKPASS` mit `git -c credential.helper=`. Den globalen Account nicht umschalten.
- **Docs-Branch** docs/briefs-2026-10-22 (wt-docs) steht auf 53875f7. Die neueren Briefs (mailbox-switch-*, HANDOFF, fts-german-folding, …) sind noch nicht synchronisiert. `briefs/` enthält node_modules-Ordner, also nie mit `rsync -c` über das ganze Verzeichnis kopieren.
- **Ports dieses Threads:** 3791–3794, 3895–3899, 3905–3919. htmlPrivacy hat 3798/3799 fest codiert und muss deshalb aus einer Wegwerf-Kopie mit getauschten Ports laufen.
- **Nie** `PRAGMA optimize` oder `ANALYZE` ausführen. Das macht die `from:`-Suche auf SQLite 3.53.4 zum Full Scan.
- **Memory:** `noctua-deps-thread.md`, die neuesten Einträge stehen direkt vor dem ersten `**Why:**`.

## Ergebnis-Zeilen (Child-Task fertig)
- perf/rrule-lazy: **46bdb7d gepusht** (Merge e70c30b). test:ci unit 2.915/0, DOM 564 pass + 1 Last-Timeout (LoginScreen.dom.test.tsx, 5-s-Default bei Load 15–18; Datei vom Branch unberührt; isoliert mit --timeout 20000 7/7 grün), Lint 0/181, Build + Standalone grün, rrule in keinem First Load. Merge-bereit; für Runde 10 46bdb7d statt 122ca69 pinnen. Logs: wt-perf-rrule/.tmp/rrule/*-46bdb7d.*
- spike-mailbox-switch-server-r1 (P0): fertig, read-only, kein Commit. Urteil: Server-Zeit pro Wechsel 66,5 ms p50 / 141,8 ms p99 (3/4 Thread-Liste); D1-Sicherheitsannahme bestätigt (keine Route autorisiert über die Session-Auswahl; /api/calendar/import liest sie, fail-closed); Batching + 5-min-Skip ≈ −10 % p50, unter Schreiblast /auth/me-p99 1.019 → 18 ms; Prototyp (Topic-Suggestions, Date-Grouping, 2 Index-Fixes, Write-Skip) 66,5 → 38,4 ms p50 byteidentisch — nach Go-live. Caveat: paralleles /auth/me kann alte Auswahl zurückschreiben (lib/auth.ts:120-121, Fix CAS-Write). Bericht: briefs/perf-mailbox-switch-server.md + briefs/perf-mailbox-switch/server/
- fix-fts-german-folding-r1 (P1): fertig, b3eed2d auf fix/fts-german-folding (lokal, NICHT gepusht; auf 5c5b605 = e29b64f + Merge e70c30b). Urteil: QA-208 Query-seitig behoben, kein Shard-Format-Change; typecheck 0, Lint 0/181, lib/db 469/0, test:ci 3.090 + 564 / 0, 165 Differential-Tests legacy=driven, Fuzz 4.355/0, merge-tree vs e70c30b clean; Bench +0,02…+0,33 ms ohne Treffer. Owner-Review nötig, nach fts-search-driven mergen. Base-Befund (nicht gefixt): Gruppen mit gleichem Count ohne Tiebreak (ORDER BY count DESC). Bericht: briefs/fts-german-folding.md
- perf-html-sanitize-r1 (P1): fertig, f8189bb auf perf/html-sanitize-single-pass (lokal, NICHT gepusht; 2 Commits auf e70c30b). Urteil: byteidentisch zu 0ac6cfa (72 Golden Hashes beide Modi + Banner, Fuzz 18.000/0), htmlPrivacy 177 grün, Bench −41 % bei 54/120 KB, −82…102 ms bei 300 KB; typecheck 0, Lint 0/181, test:ci 2.922 + 564 / 0, stress 8.766/0, Build grün; merge-tree vs a6e16d6 clean. Security-Review der Owner nötig (Skip des allowed-Passes hängt am Rewrite-Zähler). Hinweis: bun test lädt .env.local nicht → ohne NOCTUA_DATA_DIR landet der Testlauf im geteilten noctua-data (1× passiert). Bericht: briefs/perf-html-sanitize.md
- deps-wave-r9-r1 (P1): fertig, 8d5fd37 auf chore/deps-wave-r9 (lokal, NICHT gepusht; 6 Commits auf e70c30b, nichts gedroppt). Urteil: grün — typecheck 0, Lint 0/181 identisch (ESLint 10 Regel-Feuer-Nachweis), test:ci 2.915 + 565 DOM / 0, stress 8.745/0, Build kalt 64,8 → 26,6 s (bun check nach next build), test:standalone-workers grün; happy-dom 21 mit disableChildFrameNavigation, 0 Netzwerk-Loads belegt; merge-tree vs stage 45060d0 clean. Hinweise: typedRoutes ist false (Nachweis b über validator.ts statt Link); bei Typfehler bleibt unpatchtes .next/standalone liegen (Exit-Code stoppt Deploy); authStreams-Test an Auth-Owner geben; useEventReminderState.dom.test.tsx unter Last 29 einmal rot (5/5 isoliert grün). Bericht: briefs/deps-wave-r9.md
- perf-mailbox-switch-r1 (P1): fertig, 5a8c373 auf perf/mailbox-switch (lokal, NICHT gepusht; 5 Commits D1 D3 F1 F2 D2 auf e70c30b, nichts gedroppt). Urteil: grün — erste Zeilen warm 22–60 % / kalt 27–50 % schneller (z. B. warm Ordner→groß 725 → 396 ms), Requests 23 → 13, Requests ans alte Postfach 2 → 0, Stream-Opens 4 → 1; typecheck 0, Lint 0/180, test:ci 2.915 + 584 DOM / 0, stress 8.745/0, Build ok, auth-browser 20/20 inkl. shell.spec.ts:229; Invarianten je mit Test; merge-tree clean vs stage dd27be7 und neue Tips reader-focus/status-bar/qa-sweep3. Offen: kalt klein→groß 'settled' +85 ms (D5 nach Go-live), Auth-Owner-Empfehlung CAS-Write in lib/auth.ts. Bericht: briefs/perf-mailbox-switch.md
- perf-account-batching-r1 (P1): fertig, 84edb89 auf perf/account-presentation-batching (lokal, NICHT gepusht; 7 Commits auf e70c30b, Session-UPDATE-Skip als eigener Commit db06a72). Urteil: grün — /auth/me 86 → 14 Statements ohne Write (15,0 → 2,9 ms), Summary 201 → 85, Fremd-Event 56 → 1; unter Auth-Schreiblast /auth/me p99 397–870 → 30–38 ms, Busy-Retries 133–162 → 0; 57 Differential-Tests inkl. 4 Revocation-Seams + 5. Fall; typecheck 0, Lint 0/181, test:ci 2.981 + 564 / 0, Security-Controls 156/0, auth-browser 20/20, stress 8.943/0 (4. Lauf; vorher eigene Fixtures, dann 2 Last-Timeouts in fremden Dateien); merge-tree clean vs stage ab7a2f8. Auth-Review nötig: 'Zuletzt aktiv' nur noch alle 5 min, Lost-Update mit switch-account kleiner, aber nicht weg. Bericht: briefs/perf-account-batching.md
