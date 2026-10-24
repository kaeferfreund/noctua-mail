# A2 — Reader-Karten isolieren

Stand: 2026-10-23. Umsetzung abgeschlossen auf `perf/reader-card-isolation`.

- Worktree: `/home/monkey/code/noctua-mail/wt-ui-perf-a2`
- Ausgangsstand: `34dd18e59c975bdc9f4351b21be54a9ea6a9e022`
- Commit: `074a72c777ad74eb4d6ef06443a951e690926fa6`

## Änderung

`ThreadView` schneidet Collapse-, Tab-, Lade-, Font-, Zoom-, Pending- und Übersetzungszustand pro Nachricht zu. Statt der gesamten Reply-Lookup-Map erhält jede Karte nur ihr aufgelöstes Reply-Ziel und die zugehörigen skalaren Angaben. Unveränderte Geschwister behalten dadurch identische Props.

`ThreadMessageCard` nutzt normales `React.memo` ohne eigenen Comparator. Alle Props einschließlich Callbacks und optionaler Berechtigungshandler werden berücksichtigt. Der Markdown-Renderer verwendet einen skalaren Fontwert statt einer Closure über die gesamte Fontmap. Das separate Nachrichtenfenster und der vorhandene Testhelfer sind an diese Schnittstelle angepasst. Die bisherige Standardskalierung übersetzten Markdowns bleibt erhalten.

Der Orchestrator memoisiert den um aktive Threadnachrichten ergänzten Message-ID-Lookup und seine gemeinsame Props-Zusammenstellung. Die vorhandenen stabilen Zustandssetter sowie Zoom-/Übersetzungshandler bleiben stabil. `MailClient.tsx` wurde nicht geändert.

## Messung vor / nach

Synthetischer Thread mit 200 Nachrichten, sechs ausgeklappt und 194 kompakt eingeklappt. Pro Schritt wird genau ein Nachrichtenzustand bzw. eine immutable Geschwisternachricht geändert. Gezählt werden Karten-Funktionsaufrufe über `getImapFlagBadges`, das in beiden Darstellungen einmal pro Kartenrender aufgerufen wird. Beide Stände verwenden dieselbe Messanordnung. Der Regressionstest scheitert am Ausgangsstand erwartungsgemäß an der Isolationsassertion; die vollständigen Vorherzahlen werden davor protokolliert.

| Änderung | Vorher | Nachher |
| --- | ---: | ---: |
| Collapse einer Karte | 200 | 1 |
| Tab einer Karte | 200 | 1 |
| Zoom einer Karte | 200 | 1 |
| Schriftgröße einer Karte | 200 | 1 |
| Pending-Status einer Karte | 200 | 1 |
| Ladezustand einer Karte | 200 | 1 |
| Übersetzungseintrag einer Karte | 200 | 1 |
| Collaboration-Metadaten eines Geschwisters | 200 | 1 |
| Gemeinsame Callback-/Mailbox-Props geändert | 200 | 200 |

Damit entfallen bei den lokalen Änderungen jeweils 199 von 200 Kartenrenders (99,5 %). Änderungen gemeinsamer Callback-Props invalidieren bewusst alle Karten. Die Messung isoliert Readerzustand und Geschwisternachrichten bei stabilen gemeinsamen Callbacks; neu erzeugte Callback-Closures der aufrufenden Shell werden nicht herausgefiltert.

Zusätzlich prüft ein Integrationstest über den echten Orchestrator die Bedienung von Collapse, Tab, Font, Zoom und Übersetzung an sechs HTML-Nachrichten: Nur die betroffene Karten-ID erscheint im Renderzähler. Weitere Regressionen prüfen neue Callback-Closures, das Entfernen einer rollenabhängigen Aktion, den aktuellen Nachrichten-/Mailboxbezug, geänderte Übersetzungsresultate und das aktualisierte Reply-Ziel samt Auswahlaktion. Das Freigeben externer Bilder aktualisiert das HTML innerhalb der memoisierten Karte; ein Mailboxwechsel blockiert sie erneut.

Der bestehende `HtmlMessage.memo.dom.test.tsx` bleibt grün: Nach der ersten Sanitization verursachen unveränderte HTML-Bodies bei Dark-Mode-/Font-/Zoom-Änderungen **0 zusätzliche Sanitizations**. Ein geänderter HTML-Body erhöht den Zähler von 1 auf 2.

## Gates

- `bun check`: **0 Typfehler**; auch der Build-interne Check ist grün (1.307 Dateien).
- ESLint auf allen sieben geänderten Dateien: **0 Fehler, 0 neue Warnungen**. Vorher/nachher dieselben acht bestehenden Warnungen im Orchestrator (`react-hooks/refs` und `react-hooks/set-state-in-effect`). Keine Lintkonfiguration oder Suppressions geändert.
- Gezielte DOM-Tests: **54 bestanden, 0 fehlgeschlagen**, 216 Assertions. Enthält die vier neuen Isolations-/Aktionsregressionen, Reader-Korrekturen, Anzeigeoptionen sowie HTML-Memo-/Privacy-Tests.
- `bun run build`: **Exit 0**, Produktionsbundle und nachgelagerte Typ-/Standalone-Prüfung erfolgreich.
- `git diff --check`: **grün**; Worktree nach Commit sauber.

Reproduzierbare DOM-Prüfung im Worktree:

```sh
bun test --config=bunfig.dom.toml app/components/mailclient/message/ThreadView.isolation.dom.test.tsx app/components/mailclient/message/ReviewCorrections.dom.test.tsx app/components/mailclient/message/MessageDisplayOptionsMenu.dom.test.tsx app/components/HtmlMessage.memo.dom.test.tsx app/components/HtmlMessage.privacy.dom.test.tsx
```

## Visuelle Prüfung und Belege

Screenshots mit zwei synthetischen Reader-Karten, deutschem UI und deaktivierten Sendericons. Viewports: Desktop 1280 × 800 und Mobil 390 × 844 CSS-Pixel. Vorher/nachher sind die dekodierten RGB-Bilddaten an beiden Größen **pixelgleich** (0 unterschiedliche Farbkanäle). Die Mobilbilder haben wegen Device-Pixel-Ratio 2 die PNG-Größe 780 × 1688.

- [Desktop vorher](package-a-evidence/a2-before-desktop.png) / [nachher](package-a-evidence/a2-after-desktop.png)
- [390 px vorher](package-a-evidence/a2-before-390.png) / [nachher](package-a-evidence/a2-after-390.png)
- [Renderzahlen am Ausgangsstand](package-a-evidence/a2-before-render.log)
- [DOM-Gate einschließlich Nachherzahlen](package-a-evidence/a2-focused-dom.log)
- [Build-Gate](package-a-evidence/a2-build.log)
- [Lint-Vergleich](package-a-evidence/a2-lint-summary.json)

Die temporäre Screenshot-Route und Scratchdaten wurden entfernt. Der ausschließlich für diese Prüfung gestartete Prozess auf `127.0.0.1:4020` ist beendet; Port 4020 ist frei. Verwendet wurden nur lokale synthetische Daten unter dem Worktree. Kein Push, PR, Merge, Deployment oder Zugriff auf Port 3790 bzw. ROOT/data.
