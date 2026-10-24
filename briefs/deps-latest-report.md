# Dependencies latest — Abschlussbericht

Stand: 2026-10-23T23:51:52+00:00. Worktree `/home/monkey/code/noctua-mail/wt-deps-latest`, Branch `chore/deps-latest`, Basis `bdde6c9eac4f24bd5d4826860ae0c183ef3561f2`.
Geprüfter finaler Commit: **`ce7e827a64e9f38ed36e513b3f36e393d12e9be1`**.

## Ergebnis und Umfang

Alle direkten Dependencies, DevDependencies und expliziten Overrides gegen den npm-Registry-Tag `latest` geprüft: ursprünglich 87 Namen, abschließend 84. Alle verbliebenen Einträge außer TypeScript sind aktuell. FullCalendar 7 ist vollständig migriert; drei frühere Plugin-Pakete sind durch React-Entrypoints ersetzt, core wird transitiv installiert. `bun outdated` und `bun outdated --filter='*' --recursive` melden abschließend nur TypeScript 6.0.3 → 7.0.2. Es gibt ein Paketmanifest und keine zusätzlichen Workspaces. Prereleases und inkompatible transitive Zwangs-Overrides wurden nicht eingeführt.

Ausschließlich im zugewiesenen Worktree gearbeitet, mit der beauftragten Berichtsdatei als einziger Ausgabe außerhalb. Keine Pushes, PRs, Deployments, Worktree-/Branchwechsel oder Zugriffe auf Port 3790 und gemeinsame Datenverzeichnisse. Synthetische Daten und temporäre Browser ausschließlich unter `.tmp`; eigene Browserprüfungen nutzten Port 3919 und vom Betriebssystem zugewiesene Loopback-Fixture-Ports. Kein externer Mailserver.

## Commits

```text
280b0273e deps: update Node 26 types and typescript-eslint
6c9230983 deps: update Next and its ESLint config to 16.4.3
af988ee86 deps: update Playwright to 1.64.1
d02516bf1 deps: update MCP SDK to 1.32.2
d78eb3a3f deps: migrate FullCalendar to 7.1.3
ce7e827a6 deps: deduplicate compatible Undici type declarations
```

Jeder Commit verwendet explizite Dateipfade und den Trailer `Co-Authored-By: Codex GPT-6.1 Sol <noreply@openai.com>`.

## Vorher → nachher

Installierte Versionen, einschließlich bereits aktueller Pakete. Die elf TypeScript-ESLint-Overrides wurden ebenfalls aktualisiert; das normale `bun outdated` hatte diese nicht aufgelistet.

| Paket | Vorher | Nachher | Einordnung |
|---|---|---|---|
| `@better-auth/passkey` | 1.7.12 | 1.7.12 | aktuell |
| `@fullcalendar/core` | 6.1.22 | 7.1.3 (transitiv) | Typen jetzt aus @fullcalendar/react |
| `@fullcalendar/daygrid` | 6.1.22 | entfernt | v7-Plugin aus @fullcalendar/react/daygrid |
| `@fullcalendar/interaction` | 6.1.22 | entfernt | v7-Plugin aus @fullcalendar/react/interaction |
| `@fullcalendar/react` | 6.1.22 | 7.1.3 | aktuell |
| `@fullcalendar/rrule` | 6.1.22 | 7.1.3 | aktuell |
| `@fullcalendar/timegrid` | 6.1.22 | entfernt | v7-Plugin aus @fullcalendar/react/timegrid |
| `@lexical/code-core` | 0.52.0 | 0.52.0 | aktuell |
| `@lexical/history` | 0.52.0 | 0.52.0 | aktuell |
| `@lexical/html` | 0.52.0 | 0.52.0 | aktuell |
| `@lexical/link` | 0.52.0 | 0.52.0 | aktuell |
| `@lexical/list` | 0.52.0 | 0.52.0 | aktuell |
| `@lexical/markdown` | 0.52.0 | 0.52.0 | aktuell |
| `@lexical/react` | 0.52.0 | 0.52.0 | aktuell |
| `@lexical/rich-text` | 0.52.0 | 0.52.0 | aktuell |
| `@lexical/table` | 0.52.0 | 0.52.0 | aktuell |
| `@modelcontextprotocol/sdk` | 1.32.1 | 1.32.2 | aktuell |
| `@radix-ui/react-collapsible` | 1.2.1 | 1.2.1 | aktuell |
| `@radix-ui/react-icons` | 1.3.2 | 1.3.2 | aktuell |
| `@radix-ui/themes` | 3.3.0 | 3.3.0 | aktuell |
| `@tailwindcss/postcss` | 4.3.3 | 4.3.3 | aktuell |
| `@uiw/react-md-editor` | 4.1.3 | 4.1.3 | aktuell |
| `better-auth` | 1.7.12 | 1.7.12 | aktuell |
| `class-variance-authority` | 0.7.1 | 0.7.1 | aktuell |
| `cmdk` | 1.1.1 | 1.1.1 | aktuell |
| `cn` | 0.5.0 | 0.5.0 | aktuell |
| `entities` | 8.1.0 | 8.1.0 | aktuell |
| `html-to-text` | 10.0.1 | 10.0.1 | aktuell |
| `imapflow` | 2.9.1 | 2.9.1 | aktuell |
| `lexical` | 0.52.0 | 0.52.0 | aktuell |
| `lucide-react` | 1.61.0 | 1.61.0 | aktuell |
| `mailparser` | 3.12.4 | 3.12.4 | aktuell |
| `next` | 16.4.2 | 16.4.3 | aktuell |
| `next-intl` | 4.14.9 | 4.14.9 | aktuell |
| `nodemailer` | 10.2.1 | 10.2.1 | aktuell |
| `parse5` | 8.0.1 | 8.0.1 | aktuell |
| `react` | 19.3.1 | 19.3.1 | aktuell |
| `react-dom` | 19.3.1 | 19.3.1 | aktuell |
| `react-markdown` | 10.1.0 | 10.1.0 | aktuell |
| `rehype-raw` | 7.0.0 | 7.0.0 | aktuell |
| `rehype-stringify` | 10.0.1 | 10.0.1 | aktuell |
| `remark-breaks` | 4.0.0 | 4.0.0 | aktuell |
| `remark-gfm` | 4.0.1 | 4.0.1 | aktuell |
| `remark-parse` | 11.0.0 | 11.0.0 | aktuell |
| `remark-rehype` | 11.1.2 | 11.1.2 | aktuell |
| `rrule` | 2.8.1 | 2.8.1 | aktuell |
| `sanitize-html` | 2.18.1 | 2.18.1 | aktuell |
| `tsdav` | 2.5.0 | 2.5.0 | aktuell |
| `turndown` | 7.2.4 | 7.2.4 | aktuell |
| `unified` | 11.0.5 | 11.0.5 | aktuell |
| `zod` | 4.6.7 | 4.6.7 | aktuell |
| `next-themes` | 0.4.6 | 0.4.6 | aktuell |
| `postcss` | 8.5.31 | 8.5.31 | aktuell |
| `radix-ui` | 1.8.1 | 1.8.1 | aktuell |
| `react-resizable-panels` | 4.14.8 | 4.14.8 | aktuell |
| `tailwindcss` | 4.3.3 | 4.3.3 | aktuell |
| `tw-animate-css` | 1.4.0 | 1.4.0 | aktuell |
| `qrcode` | 1.5.4 | 1.5.4 | aktuell |
| `@happy-dom/global-registrator` | 21.0.4 | 21.0.4 | aktuell |
| `@playwright/test` | 1.58.2 | 1.64.1 | aktuell |
| `@testing-library/dom` | 10.4.2 | 10.4.2 | aktuell |
| `@testing-library/react` | 16.3.3 | 16.3.3 | aktuell |
| `@types/bun` | 1.4.4 | 1.4.4 | aktuell |
| `@types/html-to-text` | 9.0.4 | 9.0.4 | aktuell |
| `@types/mailparser` | 3.9.0 | 3.9.0 | aktuell |
| `@types/node` | 25.9.9 | 26.6.5 | aktuell |
| `@types/react` | 19.3.0 | 19.3.0 | aktuell |
| `@types/react-dom` | 19.3.0 | 19.3.0 | aktuell |
| `@types/sanitize-html` | 2.16.2 | 2.16.2 | aktuell |
| `eslint` | 10.13.0 | 10.13.0 | aktuell |
| `eslint-config-next` | 16.4.2 | 16.4.3 | aktuell |
| `typescript` | 6.0.3 | 6.0.3 | zurückgestellt; siehe TypeScript |
| `shadcn` | 4.22.1 | 4.22.1 | aktuell |
| `@types/qrcode` | 1.5.6 | 1.5.6 | aktuell |
| `eslint-plugin-react-hooks` | 7.1.1 | 7.1.1 | aktuell |
| `sharp` | 0.35.5 | 0.35.5 | aktuell |
| `typescript-eslint` | 8.59.0 | 8.72.0 | aktuell |
| `@typescript-eslint/eslint-plugin` | 8.59.0 | 8.72.0 | aktuell |
| `@typescript-eslint/parser` | 8.59.0 | 8.72.0 | aktuell |
| `@typescript-eslint/scope-manager` | 8.59.0 | 8.72.0 | aktuell |
| `@typescript-eslint/type-utils` | 8.59.0 | 8.72.0 | aktuell |
| `@typescript-eslint/types` | 8.59.0 | 8.72.0 | aktuell |
| `@typescript-eslint/typescript-estree` | 8.59.0 | 8.72.0 | aktuell |
| `@typescript-eslint/utils` | 8.59.0 | 8.72.0 | aktuell |
| `@typescript-eslint/visitor-keys` | 8.59.0 | 8.72.0 | aktuell |
| `@typescript-eslint/project-service` | 8.59.0 | 8.72.0 | aktuell |
| `@typescript-eslint/tsconfig-utils` | 8.59.0 | 8.72.0 | aktuell |
| `temporal-polyfill` | — | 1.0.6 | neuer erforderlicher Peer |
| `@full-ui/headless-calendar` | — | 7.1.3 (transitiv) | v7-Abhängigkeit |
| `undici-types` | 7.24.6 | 8.9.0 | Node-26-Typen; veraltete bun-types-Kopie entfernt |
| `jose` (Root) | 6.2.2 | 6.2.13 | passende MCP-Abhängigkeit; mit Better Auth dedupliziert |
| `@typescript-eslint/typescript-estree/semver` | 7.7.3 | 7.8.5 | passende transitive Aktualisierung |

Nexts `@next/env`, SWC-Plattformpakete und ESLint-Plugin folgen 16.4.3. `playwright` und `playwright-core` folgen 1.64.1. Die Lockfile-Diffs wurden je Gruppe auf die jeweiligen Pakete, passende Transitive und Hoisting-/Deduplizierungseffekte geprüft. Die bestehenden HTML-Parser-Mehrfachversionen bleiben von ihren jeweiligen Eltern vorgegeben; es wurden keine inkompatiblen Majors erzwungen.

## Anpassungen je Major

### FullCalendar 6 → 7

- `daygrid`, `timegrid` und `interaction` werden aus `@fullcalendar/react/*` importiert; ihre alten direkten Pakete sowie das direkte core-Paket entfallen. React/rrule und der neue transitive core/headless-Kern stehen auf 7.1.3. `temporal-polyfill` 1.0.6 erfüllt den neuen Peer.
- React-Ref-Typ `CalendarRef` statt der früheren Component-Klasse; Ereignistypen `EventClickInfo`, `DatesSetInfo`, `MountInfo<EventDisplayInfo>` und `EventInput` aus dem React-Paket. Ereignisse verwenden `className` statt `classNames`.
- Classic-Theme plus Skeleton-, Theme- und Palette-CSS explizit geladen. Öffentliche Styling-Hooks erhalten die Noctua-Klassen für Toolbar, Buttons, Zellen, Ereignisse und Jetzt-Markierung. Theme-Variablen auf `--fc-classic-*` umgestellt. Entfernte Wrapper durch die passenden v7-Zellen und Ereigniselemente ersetzt; kurze Termine und die Monatsmarkierung angepasst.
- `customButtons` heißt `buttons`. Beim Öffnen des eigenen Dialogs verhindert `preventDefault()` den neuen anschließenden `CalendarApi.addEvent()`-Aufruf. Deaktivierte Buttons behalten direkte Pointer-Hit-Tests wie bisher; das native `disabled` verhindert weiterhin Bedienung.
- Zwei neue Integrationstests prüfen kompakte und vollständige Darstellung mit echten Kalenderkomponenten: Herkunfts-/Teilnahmeklassen, Tooltip und Titel, Klick-Metadaten sowie genau einen Dialogaufruf ohne zusätzliches Kalenderereignis.
- Die acht unveränderten Browserregressionen prüfen Anlegen/Bearbeiten, Fokuswiederherstellung, Tab/Shift-Tab sowie alle drei Ansichten und 44-px-Ziele bei 1280/1024/390 px bzw. 320×568, 320×500, 360×640 und 390×844. Desktop- und Telefonscreenshots wurden visuell geprüft. Erster Versuch: 3 pass / 4 fail, Ursache deaktiviertes Today mit `pointer-events: none`; nach CSS-Korrektur: 8 pass / 0 fail. Keine Assertion und kein Timeout geändert.

Quelle für die tatsächlich nötigen API-/CSS-Änderungen: [FullCalendar JavaScript-Migration](https://fullcalendar.io/docs/upgrading-from-v6-js), [CSS-Migration](https://fullcalendar.io/docs/upgrading-from-v6-css).

### @types/node 25 → 26

`scripts/dev-fixture/verify-http.ts`: `assert.notEqual(..., status.job.error ?? "Sync job failed")`. Node 26 teilt die Assert-Message-Overloads auf; ein optionaler String muss definiert werden. Sonst keine neuen Typfehler und keine Nutzung neuer Node-26-Laufzeit-APIs. Die Laufzeit bleibt Bun 1.4.4; das ESLint-Werkzeug läuft mit Node 24.22.1. `undici-types` 8.9.0 wird auch von bun-types mit dessen unverändertem `*`-Range genutzt.

### Bereits enthaltene Majors

ESLint 10.13.0 und happy-dom/global-registrator 21.0.4 waren bereits in der Basis. Ihre Konfiguration und Testumgebung wurden nicht geändert. Die elf TypeScript-ESLint-Pakete wurden von 8.59.0 auf 8.72.0 angehoben. Next/ESLint-Config, Playwright und MCP benötigen keine weiteren Anwendungsanpassungen. [Next-Release](https://github.com/vercel/next.js/releases/tag/v16.4.3), [Playwright-Releases](https://playwright.dev/docs/release-notes), [MCP-Release](https://github.com/modelcontextprotocol/typescript-sdk/releases/tag/1.32.2).

## Zurückgestellt: TypeScript 7.0.2

**Bewusster Versionshalt: `typescript` bleibt auf 6.0.3 (`^6.0.3`).** Ein isolierter Versuch unter `.tmp` installierte TypeScript 7.0.2 und den neuesten `@typescript-eslint/parser` 8.72.0. Bereits dessen Import beendet Node mit Exit 1: `typescript-eslint does not support TS 7.0.` Der aktuelle Parser deklariert `typescript >=4.8.4 <6.1.0` und sperrt 7.0 ausdrücklich. Kein Anwendungsfix kann diesen Parserimport reparieren. Regeln oder Parser wurden weder abgeschaltet noch ersetzt.

Der von Microsoft dokumentierte Parallelbetrieb mit zusätzlicher TS-6-API bleibt eine mögliche eigene Toolchain-Umstellung, wurde hier nicht als Umgehung eingeführt. Der direkte Major-Upgrade besteht die geforderten Gates derzeit nicht. Siehe [offener Upstream-Tracker](https://github.com/typescript-eslint/typescript-eslint/issues/10940) und [TypeScript-7-Ankündigung](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/). FullCalendar ist entgegen dem alten Spike **kein zurückgestelltes Paket** mehr: Die damals untersagten Import-/CSS-Migrationen waren in diesem Auftrag ausdrücklich erlaubt und sind umgesetzt.

## Installation, Peers und native Pakete

Frische Installation aus `bun.lock` nach Weglegen der alten node_modules unter `.tmp`: `bun install --frozen-lockfile`, Exit 0, **1005 Pakete installiert**; keine Peer-Warnung. Die folgenden bereits vorher vorhandenen Peer-Range-Abweichungen bleiben dokumentiert:

| Transitiver ESLint-Plugin | Version | deklarierter ESLint-Peer | Befund |
|---|---|---|---|
| eslint-plugin-react | 7.37.5 | bis `^9.7` | ESLint 10 außerhalb Range; unveränderte Gesamtbefunde |
| eslint-plugin-jsx-a11y | 6.10.2 | bis `^9` | ESLint 10 außerhalb Range; unveränderte Gesamtbefunde |
| eslint-plugin-import | 2.32.0 | bis `^9` | ESLint 10 außerhalb Range; unveränderte Gesamtbefunde |

Die Versionen dieser Plugins sind weiterhin deren neueste Releases. Kein neuer Peer-Konflikt durch FullCalendar: Temporal ist explizit installiert; core/headless stimmen exakt überein. Der optionale MCP-Peer `@cfworker/json-schema` ist nicht erforderlich und wurde nicht künstlich hinzugefügt.

Bun meldet bei der frischen Installation zwei blockierte Installationsskripte; `bun pm untrusted` listet die bestehenden Pakete `@parcel/watcher` 2.6.0, `@swc/core` 1.16.20 und `unrs-resolver` 1.11.1. Keine Vertrauensänderung oder manuelle Skriptausführung. Die plattformspezifischen optionalen Binaries genügen für die gemessenen Gates. sharp 0.35.5 lädt erfolgreich mit libvips 8.18.7; `@img/sharp-linux-arm64` und `@img/sharp-libvips-linux-arm64` sind vorhanden. Docker-/Image-Tests waren nicht Teil des beauftragten Gatesatzes.

## Abschlussprüfungen

Alle folgenden Gates wurden nach der frischen Installation auf dem oben genannten **finalen Commit** ausgeführt. Alle Exit-Codes sind 0.

| Gate | Ergebnis | Wall-Zeit |
|---|---|---|
| `bun check` | 0 Fehler / 1.344 Dateien | 0.62 s |
| `bun run lint --format json --output-file .tmp/final-lint-findings.json` | 0 Fehler / 168 bestehende Warnungen, 1.354 Dateien; 0 neue Warnungen | 64.98 s |
| `bun run test:ci` | 3.354 Unit pass / 0 fail, 26.002 Assertions, 339 Dateien; 775 DOM pass / 0 fail, 4.901 Assertions, 98 Dateien | 548.16 s |
| `bun run build` | Build erfolgreich; Compile 2,0 s; Typgate 0 Fehler / 1.344 Dateien; Standalone vorbereitet | 6.01 s |
| `bun run test:standalone-workers` | Build und Dateiprüfung erfolgreich; 197 erforderliche Dateien und genau 3 Worker-Entrypoints vorhanden | 4.79 s |

Gesamt: **4.129 Tests / 0 Fehler, 30.903 Assertions**, ohne Wiederholung oder bekannten LoginScreen-Flake. Die Runner melden 445,89 s für Unit und 99,33 s für DOM. Lint-Vergleich gegen die Basis: 0 neue/entfernte Meldungen nach Datei, Regel, Severity und Meldungsüberschrift; nur Quellzeilen verschieben sich durch die Migration. Bestehende Regelzahlen: refs 56, preserve-manual-memoization 53, set-state-in-effect 35, exhaustive-deps 15, purity 4, no-img-element 2, immutability 1, use-memo 1, unused-disable 1.

Build-Zeiten sind warme Builds und kein Vorher-/Nachher-Benchmark. Der erste kalte FullCalendar-7-Kandidatenbuild war ebenfalls grün (26,25 s). Die Standalone-Prüfung kontrolliert den lokalen Laufzeit-Dateigraph und die drei Skript-Entrypoints; sie startet keine Worker und ersetzt keinen Docker-Image-Test. Abschließendes `bun install --frozen-lockfile`: 1.081 Installationen / 1.084 Pakete geprüft, keine Änderungen.

Alle schweren Gates liefen einzeln mit `nice -n 15`, `TMPDIR=<worktree>/.tmp`. Build/Standalone verwendeten den synthetischen Block aus `go-live-runbook.md` §3.1: `NOCTUA_DATA_DIR=<worktree>/.tmp/build-data`, Watcher aus, DB-Credential-Storage, synthetische Auth-/IMAP-Schlüssel, Produktions-URL nur als Konfigurationswert, Telemetrie aus. Kein Server wurde gegen diese öffentliche URL angesprochen. Der Build-Typgate bleibt unverändert `next build → bun check → prepareStandaloneShutdown`.

Zusätzliche fokussierte Nachweise vor dem Abschlusscommit: MCP **22 pass / 0 fail, 296 Assertions, 8 Dateien** (10.56 s); Kalender-DOM **34 pass / 0 fail, 192 Assertions, 3 Dateien** (1.98 s); Kalender-Browser **8 pass / 0 fail** (41.91 s). Die Browserprüfung testet zugleich den aktualisierten Playwright-Runner und Chromium 156.0.8078.4. Keine Test- oder Lintregel wurde abgeschwächt.

## Risiken und Beobachtung auf der Preview

- FullCalendar 7 bringt ein anderes DOM und Theme mit. Bei der nächsten regulären Preview-Abnahme besonders Quellen-/Teilnahmefarben, kurze/Null-Dauer-Termine, aktuelle Zeit, Dark Mode, wiederkehrende Termine und mobile Wochen-/Tagesansichten ansehen. Die Kalenderbedienung wurde auf den genannten Viewports mit synthetischen Daten geprüft; seltene Layout-/Druck-/Zeitzonenkombinationen sind nicht vollständig abgedeckt.
- Die drei ESLint-Plugins laufen weiterhin außerhalb ihrer deklarierten ESLint-10-Peers. Vollständiges Lint ist grün, ihre Upstream-Freigabe bleibt offen.
- Node-26-Typen beschreiben mehr als die vorhandene Bun-/Node-Werkzeuglaufzeit. Dieser Branch fügt keine entsprechende neue Runtime-Abhängigkeit hinzu.
- TypeScript bleibt auf 6, bis eine kompatible Parser-/API-Lösung gemeinsam geprüft wird.

## Abschlusszustand

Git-Arbeitsbaum auf dem finalen Commit sauber. Alle eigenen Browser-/Fixture-/Probeprozesse beendet; auf Port 3919 bleibt kein Listener. Der komplette aufgabeneigene `.tmp`-Baum einschließlich temporärer node_modules, Browserdownloads, Logs, Screenshots und synthetischer Testdaten wurde nach Übernahme der Ergebnisse in diesen Bericht entfernt. Die regulären Buildartefakte und die frische node_modules-Installation bleiben uncommittet im Worktree erhalten.
