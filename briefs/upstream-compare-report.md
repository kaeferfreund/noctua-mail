# Upstream-Vergleich für den MailPlus-Ersatz

Stand: 2026-10-23, Recherche ab ca. 23:20 UTC. Ausschließlich Quellcodevergleich und Patch-Trockenläufe; keine Implementierung.

**Empfehlung:** Die auf eine Stunde begrenzte IMAP-SSE-Laufzeit und den dazugehörigen unmittelbaren Client-Reconnect gemeinsam in die Fork-Struktur übertragen. Die grundlegende Ressourcenfreigabe ist im Fork bereits vorhanden und teilweise umfassender. Diagnosezähler können nach dem Go-live folgen. Die Docker-Logänderung ist für das geplante systemd-Deployment nicht erforderlich. Kein vollständiger Upstream-Commit wird unverändert zur Übernahme empfohlen.

## 1. Vergleichsstand und Vollständigkeit

Frische, vollständige Klone wurden ausschließlich unter `research/upstream-compare/upstream` und `research/upstream-compare/fork` angelegt. Verglichen wurden:

| Referenz | Festgehaltener Commit |
|---|---|
| Gemeinsamer Vorfahr / Fork-`origin/main` | `0f40e022d740c7dc14a82263ec22c20771e56264` — PR #160, Icon-Button-Tooltips |
| Upstream-`origin/main` | `7a5895c527b1110c5f407d05a43759c3ed2104e9` |
| Fork-`integration/stage` | `8aae8bad4e5dcc2795d01ac938e95f4a0e20fc49` |

`git merge-base` bestätigt den angegebenen gemeinsamen Vorfahren. Der Fork-Vergleichsstand enthält 521 Commits nach diesem Vorfahren, einschließlich Merge-Commits. Spätere Änderungen aus den parallel laufenden CI-/Dependency-Aufgaben oder dem Alpha-Release sind nicht Bestandteil dieses festgehaltenen Stands. Upstream-`main` wurde während der Recherche nochmals per `git ls-remote` bestätigt.

**Die vollständige Menge `0f40e022..upstream/main` umfasst nur drei Commits: zwei Inhaltsänderungen und ihren gemeinsamen Merge in [PR #161](https://github.com/paulwellnerbou/noctua-mail/pull/161).** Es gibt in diesem Bereich keine weiteren Features, Fehlerkorrekturen oder Dependency-Updates.

| Commit | Zeitpunkt UTC | Inhalt / Gruppierung |
|---|---|---|
| [e49ae2f](https://github.com/paulwellnerbou/noctua-mail/commit/e49ae2f67feac9fb6880560ed15d7ab3a7e6a05a) | 2026-10-23 21:07:40 | IMAP-SSE: zuverlässiges Aufräumen, Laufzeitlimit, Reconnect und Diagnose; zwei Dateien, +84/−16 Zeilen |
| [99f08a3](https://github.com/paulwellnerbou/noctua-mail/commit/99f08a3b4d4dbc8b9710e1d68d09164b1608a480) | 2026-10-23 21:07:40 | Docker-Logbegrenzung; eine Datei, +2 Zeilen |
| [7a5895c](https://github.com/paulwellnerbou/noctua-mail/commit/7a5895c527b1110c5f407d05a43759c3ed2104e9) | 2026-10-23 21:17:11 | Merge von PR #161; gegenüber dem ersten Elternteil dieselben drei Dateien, keine zusätzliche Inhaltsänderung |

Alle nachfolgenden Empfehlungen sind Teilaspekte dieser zwei Themen. Sie dürfen nicht als fünf unabhängige Upstream-Verbesserungen oder zusätzliche PRs gezählt werden.

## 2. Übersicht

Aufwand: Schätzung für eine spätere Umsetzung samt gezielten Tests, keine gemessene Implementierungsdauer. ADOPT bedeutet unveränderte Übernahme eines Commits; ADAPT bedeutet gezielte Übertragung in die bestehende Architektur; SKIP bedeutet keine zusätzliche Implementierung aus diesem Delta.

| Thema | Upstream-Commits | Betroffene Upstream-Dateien | Zustand im Fork-Klon | Empfehlung | Aufwand |
|---|---|---|---|---|---|
| U1a: Aufräumen bei Abort, Cancel und Enqueue-Fehlern | `e49ae2f`, Merge `7a5895c` | `app/api/accounts/[accountId]/imap/stream/route.ts` | Bereits vorhanden: idempotentes Stoppen, Timerfreigabe, Registry-Abmeldung, parallele Entsorgung aller eigenen Clients, einschließlich noch verbindender Clients und laufender Polls | **SKIP**, bestehende Fork-Lösung behalten | Keine Neuimplementierung |
| U1b: Maximal eine Stunde pro IMAP-SSE-Verbindung | `e49ae2f`, Merge `7a5895c` | dieselbe Route | Kein eigenes einstündiges Transportlimit; Auth-Liveness alle 5 s und Ablauf spätestens 24 h nach Anmeldung existieren bereits | **ADAPT**, zusammen mit U1c sinnvoll vor Go-live | U1b+U1c zusammen ca. 2–4 h einschließlich Regressionstests |
| U1c: `reconnect`-Ereignis unmittelbar behandeln | `e49ae2f`, Merge `7a5895c` | Route und `app/components/mailclient/useSyncController.ts` | Kein Listener für dieses Ereignis; Fehlerpfad startet Polling und versucht nach 15 s bei sichtbarer Seite erneut SSE | **ADAPT**, gemeinsam mit U1b | In obiger Schätzung enthalten; Hook-Patch allein +5 Zeilen |
| U1d: Stream-ID, Öffnungs-/Schließgrund, Laufzeit und Zähler | `e49ae2f`, Merge `7a5895c` | dieselbe Route | Kein entsprechendes IMAP-SSE-Open/Close-Logging; Auth-Registry protokolliert beim Shutdown die Zahl ihrer aktiven Streams | **ADAPT**, nach Go-live bzw. bei konkretem Diagnosebedarf | Ca. 0,5–1 h zusätzlich |
| U2: Docker-Loggröße/-anzahl begrenzen | `99f08a3`, Merge `7a5895c` | `deploy-scripts/deploy-instance.sh` | Optionen fehlen; Docker-Skript existiert weiterhin, Produktionsziel ist jedoch systemd. Journald-Retention ist im Go-live-Runbook beschrieben | **SKIP** für diesen Go-live | Kein App-Aufwand; bei späterem Docker-Betrieb kleiner Patch, separat prüfen |

Es gibt **keinen ADOPT-Kandidaten auf Ebene eines vollständigen Commits**: U1 benötigt Anpassung; U2 wäre technisch konfliktfrei, betrifft aber den ausgewählten Betrieb nicht.

## 3. Top-5-Ranking für den Go-live

Da nur zwei neue Upstream-Themen existieren, bewertet diese Rangliste fünf Teilmaßnahmen/Entscheidungen, einschließlich der begründeten Nichtübernahmen. Nur Rang 1 und 2 bilden ein empfohlenes gemeinsames Umsetzungspaket; Rang 3 erfordert keine zusätzliche Änderung.

| Rang | Teilmaßnahme | Nutzen / Aufwand und Zeitpunkt |
|---|---|---|
| 1 | **U1b: einstündiges Laufzeitlimit adaptieren** | Begrenzt verwaiste SSE-Poller und IMAP-Verbindungen früher als der bestehende Auth-Ablauf. Sinnvolle kleine Absicherung für längeren Betrieb und mobile Verbindungswechsel; mit Rang 2 umsetzen. Ein entsprechendes Leak ist im Fork nicht nachgewiesen. |
| 2 | **U1c: sofortigen Reconnect ergänzen** | Verhindert bei geplantem Streamende den Umweg über Polling und den bestehenden 15-s-Reconnect-Timer. Sehr kleiner Clientanteil, aber nur zusammen mit dem Serverlimit wirksam. |
| 3 | **U1a: vorhandene Fork-Freigabe beibehalten** | Die zentrale Upstream-Fehlerkorrektur ist bereits abgedeckt; keine zweite Cleanup-Implementierung und kein Ersatz des Auth-Pfads nötig. Bestehende gezielte Tests bei Umsetzung von Rang 1/2 weiterverwenden. |
| 4 | **U1d: Stream-Diagnose adaptieren** | Erleichtert den Nachweis, ob sich Streams ansammeln. Geringer Zusatzaufwand, aber keine Voraussetzung für den MailPlus-Ersatz; nach Go-live einplanen. |
| 5 | **U2: Docker-Logpatch überspringen** | Für die geplante systemd-Installation kein unmittelbarer Nutzen. Statt neuer App-Arbeit den bereits vorgesehenen Journald-Schritt beim Produktionsaufbau abnehmen. |

Die bestehende Go-live-Liste bleibt maßgeblich: Produktionshost/TLS, finaler Sicherheitscheck, Import und Zählabgleich, Backup-/Restore-Probe sowie PWA-Abnahme auf beiden Telefonen. U1b/U1c sind eine empfohlene Absicherung und kein durch diese Recherche neu belegter Go-live-Blocker. Zusätzliche Optimierungs- oder Review-Schleifen sind daraus nicht abzuleiten.

## 4. Details und Trockenläufe

### Gemeinsamer Trockenlauf von `e49ae2f`

Der Upstream-Commit wurde per lokalem `git fetch --no-tags <upstream-klon> main` ausschließlich in den Fork-Rechercheklon geladen, ohne dort einen zusätzlichen Remote anzulegen. Auf dem unveränderten Fork-HEAD wurde ausgeführt:

```text
git -c core.hooksPath=/dev/null cherry-pick --no-commit e49ae2f67feac9fb6880560ed15d7ab3a7e6a05a
Exit 1
CONFLICT (content): app/api/accounts/[accountId]/imap/stream/route.ts
Auto-merging app/components/mailclient/useSyncController.ts
```

**Konfliktgröße:** eine konfliktbehaftete Datei, fünf Konfliktblöcke; die Hook-Datei wurde automatisch und konfliktfrei mit +5/−0 Zeilen übernommen. Die Konfliktblöcke enthielten folgende Zeilenzahlen, jeweils ohne Markierungen:

| Block | Fork-Seite | Upstream-Seite |
|---|---:|---:|
| Imports | 8 | 1 |
| Encoder / Stream-Identität | 1 | 3 |
| Streamstart, Versand und Cleanup-Struktur | 20 | 160 |
| Watcher-/Polling-Struktur | 43 | 35 |
| Poll-/Keepalive-/Lifetime-Timer und Streamabschluss | 100 | 32 |
| **Summe** | **172** | **231** |

Das sind die tatsächlich erzeugten Konfliktblöcke, keine Schätzung notwendiger neuer Codezeilen. Wegen des zusätzlichen Auth-Wrappers und der umgebauten Ressourcenverwaltung enthalten sie viel strukturellen Kontext. Der kleine Upstream-Patch ist deshalb kein sinnvoller blinder Cherry-pick.

Ein zusätzlicher rein prüfender `git apply --check` des vollständigen Patches scheiterte ebenfalls an der Route. Die temporären Änderungen des No-Commit-Versuchs wurden mit `git restore --source=HEAD --staged --worktree -- <beide betroffenen Dateien>` vollständig entfernt. Danach waren Arbeitsbaum und Index sauber und HEAD unverändert auf `8aae8bad…`.

### U1b — ADAPT: einstündige Transportlaufzeit

**Was upstream ergänzt:** `MAX_STREAM_LIFETIME_MS = 60 * 60 * 1000`; ein Timeout sendet `reconnect` und beendet anschließend den Stream. Eine gemeinsame Timerliste wird beim Aufräumen geleert. Der Commit begründet dies mit verwaisten EventSource-Verbindungen unter Bun/Next standalone, deren Abort-/Cancel-Signale in der dort beobachteten Umgebung ausblieben. Die im Commit genannten Speicher- und Latenzprobleme sind ein Upstream-Erfahrungsbericht, keine Messung an diesem Fork.

**Geprüfter Fork-Zustand:** Die [Route am Vergleichsstand](https://github.com/kaeferfreund/noctua-mail/blob/8aae8bad4e5dcc2795d01ac938e95f4a0e20fc49/app/api/accounts/%5BaccountId%5D/imap/stream/route.ts#L82) räumt über `registerAuthStream(identity, stopAll)` bereits bei Abort, Cancel, fehlgeschlagenem Enqueue, Autorisierungsverlust und Startfehlern auf. `ownedClients` erfasst Clients ab ihrer Konstruktion; eine `WeakSet` verhindert doppelte Entsorgung. Das ist weitergehend als die reine Upstream-Iteration über registrierte Watcher-Sessions.

Die [Auth-Registry](https://github.com/kaeferfreund/noctua-mail/blob/8aae8bad4e5dcc2795d01ac938e95f4a0e20fc49/lib/authStreams.ts#L68) prüft die Berechtigung alle fünf Sekunden und setzt bereits einen Ablauf-Timer auf `min(identity.expiresAt, authenticatedAt + 24 h)`. Verwaiste Streams sind damit schon zeitlich begrenzt, sofern die Timer ausgeführt werden. Das neue Limit würde diese Dauer zusätzlich auf eine Stunde pro Verbindung verkürzen.

**Übertragung:** Einen lokalen Lifetime-Timer in der bestehenden Route ergänzen, zusammen mit deren Poll-/Keepalive-Timern aufräumen und weiterhin ausschließlich den vorhandenen `authStream.close()`-Pfad nutzen. Keine neue Auth-Registry, keine Änderung von Session-/MFA-Fristen und kein Ersatz von `ownedClients` durch Upstreams kleinere Sessionliste. Den Timer über die vorhandene Testnaht `lib/mail/imapStreamRuntime.ts` steuerbar machen.

**Dry-run:** vollständiger Quellcommit: eine Datei mit fünf Konfliktblöcken, 172 Fork-/231 Upstream-Zeilen wie oben. U1b ist kein eigenständiger Commit, daher keine separat gemessene Cherry-pick-Konfliktzahl. Der gemeinsame Aufwand mit U1c wird auf 2–4 h einschließlich gezielter Tests geschätzt.

### U1c — ADAPT: geplanten Reconnect ohne Polling-Umweg ausführen

**Was upstream ergänzt:** Fünf Zeilen im Hook registrieren `source.addEventListener("reconnect", …)` und rufen bei nicht verworfenem Effekt `startStream()` auf. Dieses schließt bereits die alte EventSource und stoppt Polling, bevor es eine neue Verbindung öffnet.

**Geprüfter Fork-Zustand:** Der [Hook](https://github.com/kaeferfreund/noctua-mail/blob/8aae8bad4e5dcc2795d01ac938e95f4a0e20fc49/app/components/mailclient/useSyncController.ts#L1240) besitzt denselben Einstieg `startStream()`, aber noch keinen `reconnect`-Listener. Der bestehende `error`-Handler schaltet auf Polling und plant nach 15 Sekunden einen SSE-Neustart bei sichtbarer Seite. Wechsel von Postfach/Ordner, `visibilitychange`, `pagehide`, `beforeunload` und Effekt-Cleanup sind bereits berücksichtigt.

**Wichtiger Architekturunterschied:** Upstreams `send()` ist synchron; das Fork-`send()` ist asynchron und prüft unmittelbar vor dem Enqueue die aktuelle Berechtigung. Ein direkt kopiertes `send("reconnect", …); authStream.close();` könnte im Fork `stopped` setzen, bevor das Ereignis tatsächlich geschrieben wird. Beim geplanten Ende deshalb den berechtigungsgeprüften Versand abwarten und anschließend über den bestehenden Cleanup-Pfad schließen, auch im Fehlerfall. Authentifizierung, Rollenprüfung, Cookie-Antwort und bereinigte Fehler-DTOs bleiben erhalten.

**Dry-run:** Aus dem Upstream-Commit isolierter Hook-Dateipatch: `git apply --check` **Exit 0, null Konflikte**, +5/−0 Zeilen. Auch der gemeinsame Cherry-pick führte diese Datei konfliktfrei zusammen. Der Gesamtcommit hat weiterhin den oben dokumentierten Routenkonflikt. Die Einordnung ADAPT bezieht sich auf das zusammengehörige Server-/Client-Verhalten; der kleine Hook-Hunk selbst ist direkt übertragbar. Aufwand in U1b enthalten.

**Gezielte spätere Abnahme für U1b/U1c:** Die vorhandene `route.test.ts` deckt bereits Abort/Cancel/Revoke einschließlich laufender Connect-/Poll-Operationen ab. Ergänzen sollte man den Ablauf des neuen Lifetime-Timers, das tatsächlich vor Abschluss ausgelieferte Reconnect-Ereignis und die Freigabe aller Timer/Clients. Im Hook mit synthetischer EventSource prüfen, dass genau eine neue Verbindung geöffnet und die alte geschlossen wird, kein Polling-Umweg erfolgt und nach Unmount/Postfachwechsel kein alter Reconnect mehr startet. Die vorhandenen Hook-DOM-Tests halten `authState` auf `loading` und prüfen diesen EventSource-Pfad nicht. Die Tests wurden in dieser Recherche nur gelesen, nicht ausgeführt.

### U1d — ADAPT: gezielte Stream-Diagnose

**Was upstream ergänzt:** Zufällige kurze Stream-ID, Open-/Close-Logs mit Account-/Client-ID, Schließgrund, Laufzeit und einem modulweiten `openStreamCount`. Das kann die im Commit beschriebenen dauerhaft offenen Streams sichtbar machen.

**Geprüfter Fork-Zustand:** Entsprechende per-IMAP-SSE-Logs fehlen. Die Auth-Registry hält bereits eine globale Stream-Menge und protokolliert ihre Größe beim Shutdown. Deren Zählwert umfasst Auth-Streams verschiedener Typen; er ist kein unmittelbarer Ersatz für einen ausschließlich IMAP-SSE betreffenden Zähler.

**Übertragung:** Falls benötigt, Diagnose in den bestehenden idempotenten Stopppfad einfügen; Open/Close nur einmal zählen. Keine Nachrichteninhalte oder Credentials protokollieren. Den Zähler als Diagnose registrierter SSE-Streams beschriften: Er beweist nicht, dass asynchrones IMAP-Logout schon abgeschlossen ist. Eine neue Metrik-Infrastruktur ist dafür nicht nötig. Erst nach Go-live oder bei konkretem Verdacht auf Ressourcenansammlung umsetzen.

**Dry-run:** Teil desselben `e49ae2f`; Gesamtcommit: eine Konfliktdatei/fünf Konfliktblöcke. Keine eigenständige, isolierte Messung für Logging-Hunks; sie überlagern Streamstart und Cleanup. Aufwand ca. 0,5–1 h zusätzlich, ohne Anspruch auf eine Produktionsmessung.

### U2 — SKIP: Docker-Logbegrenzung, technisch konfliktfrei

Der [Commit `99f08a3`](https://github.com/paulwellnerbou/noctua-mail/commit/99f08a3b4d4dbc8b9710e1d68d09164b1608a480) ergänzt ausschließlich `--log-opt=max-size=100m` und `--log-opt=max-file=5` beim `docker run` in `deploy-scripts/deploy-instance.sh`. Der Commit nennt ein stark angewachsenes Entwicklungscontainer-Log als Anlass. Er ändert weder Dockerfile noch App-Verhalten.

**Dry-run:** vollständiger Patch mit `git apply --check`: **Exit 0, null Konflikte**, eine Datei, +2/−0 Zeilen. Der Fork hat in diesem Skript zwar bereits Better-Auth-Environment und DB-Credentials angepasst, die beiden neuen Argumente lassen sich dennoch unverändert einfügen.

**Warum trotzdem SKIP:** Das Produktionsziel ist Linux/systemd ohne Docker. Das [Go-live-Runbook §2.5](/home/monkey/code/noctua-mail/briefs/go-live-runbook.md:383) enthält bereits eine vorgeschlagene Journald-Retention (`SystemMaxUse=512M`, `RuntimeMaxUse=128M`, `MaxRetentionSec=14day`) und den Abnahmeschritt zur Journalgröße. Diese Werte sind Planung und betreffen das Hostjournal; ihre tatsächliche Einrichtung wurde hier nicht untersucht. Für spätere Docker-Nutzung kann der kleine Patch neu bewertet werden; den ganzen Upstream-Deploypfad oder dessen alte Auth-Umgebung zu übernehmen wäre dafür unnötig.

## 5. Einordnung nach Funktionsbereich und parallelen Aufgaben

| Bereich | Befund im vollständigen Upstream-Delta |
|---|---|
| IMAP-Synchronisierung | Nur Lebenszyklus der browsergebundenen SSE-Route; keine Änderung an Sync-Workern, UID-/Checkpoint-Logik oder Hintergrund-Watcher. Relevanz für Ressourcenverbrauch und laufende Aktualisierung; kein belegter Fix für die im Fork-Backlog vermerkten IMAP-„Unexpected close“-Fehler. |
| MIME-/Header-Parsing | Keine Änderung. Insbesondere kein weiterer Parsing-Fix neben dem im Fork bereits vorhandenen Sync-Header-Split-Fix. |
| Entwürfe / Versand / Sent | Keine Änderung; kein Upstream-Kandidat für die fork-eigenen Shared-Sent-/Rollenanforderungen. |
| Kalender | Keine Änderung. |
| Suche / FTS / Shards | Keine Änderung und keine Migration. |
| Sicherheit | Kein eigenständiger Auth-, Berechtigungs- oder Privacy-Fix in diesen Commits. Ressourcenbegrenzung hilft der Verfügbarkeit; kein Sicherheitsvorfall am Fork nachgewiesen. Beim Übertragen müssen dessen finaler Auth-Check, Widerruf und sichere Fehler-DTOs erhalten bleiben. |
| Dependencies / Lockfile | Keine Änderung an `package.json` oder `bun.lock`. Der untersuchte Fork enthält bereits u. a. Next 16.4.2, imapflow ^2.9.1 und Bun 1.4.4; keine zusätzliche Upstream-Dependency-Welle zu übernehmen. |
| `next.config.ts` / Dockerfile / CI | Keine Änderung upstream nach dem Fork-Punkt. Die parallel beauftragten CI-/Dependabot-/Dependency-Arbeiten werden durch diesen Vergleich nicht ersetzt oder erweitert. Der Fork hat bereits eigene Build-/Worker-Tracing-, i18n- und Auth-Browser-Anpassungen. |
| Deployment-Konfiguration | Ausschließlich die zwei Docker-Logargumente; Retention für den gewählten Betrieb steht schon im lokalen Runbook. |

Die Aussage „keine Änderung“ bezieht sich jeweils auf den vollständigen Commitbereich nach `0f40e022`, nicht auf die gesamte Upstream-Historie. Ältere Verbesserungen liegen bereits vor dem gemeinsamen Vorfahren und wurden nicht als neue Übernahmekandidaten gezählt.

## 6. SKIP-Liste

- **U1a, grundlegendes Stream-Cleanup:** Im Fork bereits vorhanden und um Auth-Widerruf sowie Besitz noch verbindender Clients erweitert; keine doppelte Implementierung.
- **`e49ae2f` als vollständiger Cherry-pick:** Erheblicher struktureller Konflikt in der Route; nur fehlende Laufzeit-/Reconnect-Teile adaptieren, Fork-Auth und Ressourcenverwaltung behalten.
- **`99f08a3`, Docker-Logs für diesen Go-live:** Konfliktfreier Patch, aber der geplante Betrieb verwendet systemd/journald und hat dafür bereits einen Retention-Schritt.
- **`7a5895c` als Merge-Commit-Übernahme:** Enthält keine dritte Verbesserung; gezielte Teilübertragung ist ausreichend.
- **Neue Dependency-, MIME-, Versand-, Kalender-, Such- oder CI-Arbeit aus diesem Vergleich:** In diesem Upstream-Delta existiert dafür kein Kandidat.

## 7. Durchführung und Grenzen

Gelesen wurden der vollständige Rechercheauftrag, die gemeinsamen Regeln, beide geklonten `AGENTS.md`, das Team-Inbox-Konzept sowie `briefs/STATUS.md`, `briefs/BACKLOG.md` und die einschlägigen Go-live-Runbook-Stellen. Belege für Fork-Äquivalente stammen aus dem frischen Fork-Klon; die lokalen Briefs liefern Prioritäten und Betriebsentscheidungen.

Die Prüfung bestand aus Git-Historie, vollständigen Änderungen der zwei Inhaltscommits, Vergleich der betroffenen Implementierungen/Testquellen, einem No-Commit-Cherry-pick und drei `git apply --check`-Prüfungen: Gesamt-SSE-Patch, isolierter Hook-Patch, Docker-Patch. Keine Dependencies installiert, keine Builds oder Tests ausgeführt, keine App gestartet, keine IMAP-/SMTP-Verbindung hergestellt und keine Produktions-/Preview-Messung vorgenommen. Konfliktfreiheit ist keine Aussage über Laufzeitkorrektheit.

Keine Änderungen unter `repo/` oder einem `wt-*`-Worktree, keine dortigen Remotes geändert, keine Commits/Pushes/Deploys. Datendirectorys und der Dienst auf Port 3790 wurden nicht berührt. Alle Patch-Versuche wurden verworfen; der Fork-Klon war danach sauber und sein HEAD unverändert. Beide Rechercheklone wurden nach Abschluss entfernt. Als einziges dauerhaftes Ergebnis bleibt dieser Bericht.
