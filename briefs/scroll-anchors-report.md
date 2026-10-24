# Scroll-Anker für Zurück/Vorwärts und erneute Besuche — Bericht

Commit `57746153` auf `feat/scroll-anchors` (Basis `integration/stage` 56840ce). Nur lokaler Commit; kein Push, Merge, Deploy oder Dienst-Neustart.

## Umsetzung

- **`lib/ui/scrollAnchors.ts`** (neu): Anker = ID des ersten Elements an der Oberkante des Viewports + Versatz in dieses Element + `scrollTop` als Pixel-Fallback (+ beim Reader der Ein-/Ausklappzustand der Thread-Nachrichten). LRU-Speicher mit je 50 Einträgen. Panes ohne Geometrie (`display:none`, Höhe 0) werden nie gemessen.
- **`app/components/mailclient/useScrollAnchors.ts`** (neu): zwei Speicher — pro History-Eintrag (`history.state.noctuaEntry` + Ort) und pro Ort (Liste: Konto + vollständiger Listenschlüssel `messagesKey` mit Ordner/Ansicht/Suche/Gruppierung/Filtern; Reader: Konto + Nachricht).
  - Rangfolge: explizites neues Nachrichtenziel per URL (Link, Benachrichtigung, Neuladen) → gespeicherter Anker des Zurück/Vorwärts-Eintrags → letzter Anker des Orts → oben.
  - Speichern nur bei echten Scroll-Ereignissen auf sichtbaren Panes. Während einer Wiederherstellung oder einer URL-Transaktion ist das Speichern ausgesetzt, damit Browser-Clamp-Scrolls nichts überschreiben.
  - Wiederherstellung per `requestAnimationFrame`, sobald Geometrie da ist (gecachte Zeilen, Einblenden auf dem Telefon, aufgeklappte Nachricht). Ist die Zeile in der virtuellen Liste noch nicht gerendert, setzt der Pixel-Fallback zuerst das Fenster, danach wird exakt auf die Zeile positioniert. Ende nach 3 stabilen Frames oder spätestens nach 3 s. Danach wird späte HTML-/iframe-Höhe einmal nachgeprüft (ResizeObserver, höchstens 3 Korrekturen innerhalb von 2 s).
  - Abbruch bei Touch, Rad, Zeiger, Scroll-Tasten (nicht in Eingabefeldern) und bei Zielwechsel. Nach einem Abbruch scrollt auch die spätere Auswahl-Positionierung des Readers nicht zurück.
  - Telefon: Wird die Liste wieder eingeblendet (z. B. Zurück ohne History-Eintrag), stellt der Hook ihren zuletzt sichtbar gespeicherten Anker wieder her.
- **`useDeepLinks.ts`**: bleibt der einzige History-Besitzer und erzeugt keine zusätzlichen Einträge. Jeder Push erhält eine Eintrags-ID `noctuaEntry`, Replace behält sie. Neue Option `onTransaction` meldet Beginn und Abschluss jeder URL → UI-Transaktion mit Herkunft `initial` / `history` / `link`.
- **`MailClient.tsx`** (+15 Zeilen): Aufruf des Hooks und Übergabe von `onTransaction`. `scrollActiveMessageIntoView` fragt `readerPlacement()` ab: `skip`, wenn ein wiederhergestellter Anker den Reader übernimmt; `instant` (kein Smooth-Scroll) bei Zurück/Vorwärts ohne gespeicherte Position; sonst unverändert.
- **`MessageViewOrchestrator.tsx`**: neue Handle-Methode `restoreCollapsedMessages`. **`MessageViewPane.tsx`**: Attribut `data-reader-scroll` am Reader-Scrollcontainer.
- `useReaderFocusPlacement` (Desktop-Fokusmodus) ist unverändert. Die Reveal-Wiederherstellung des neuen Hooks greift nur auf dem Telefon, damit sich die beiden nicht in die Quere kommen.

## Gates

| Prüfung | Ergebnis |
| --- | --- |
| `bun check` | 0 Fehler, 1.334 Dateien |
| ESLint, angefasste Dateien | 0 Fehler, 0 neue Warnungen (MailClient 66 = Basis 66; MessageViewOrchestrator dieselben 8 bestehenden Warnungen; neue Dateien und Tests sauber) |
| Vollständige DOM-Suite (`bun run test:dom`) | 762 bestanden, 0 fehlgeschlagen (96 Dateien) |
| Neue DOM-Tests `useScrollAnchors.dom.test.tsx` | 6/6: Listen-Anker bei Zurück (Eintrag schlägt neuere Position desselben Orts) und bei erneutem Besuch; Zeilen-Anker statt Pixel bei verschobenen Zeilen; Reader-Anker + Ein-/Ausklappzustand bei Zurück/Vorwärts, Auswahl-Scroll weicht (`skip`); expliziter Link schlägt gespeicherten Reader-Anker, History ohne Anker → `instant`; Nutzereingabe bricht ausstehende Wiederherstellung ab, ohne späteres Zurückspringen; verdecktes Telefon-Pane wird nie gespeichert, Wiederherstellung nach dem Einblenden |
| `useDeepLinks.dom.test.tsx` | 16/16, davon neu: Eintrags-ID pro Push, beibehalten bei Replace, Transaktionsherkunft |
| Gegenprobe | Mit deaktivierter Wiederherstellung schlagen 2 DOM-Tests und beide Browserfälle fehl |
| `bun test lib/navigation` | 10 bestanden |
| `bun run build` | erfolgreich |
| Playwright `qa-scroll-anchors.spec.ts` (neu, 300 synthetische Nachrichten) | 2/2. **390 px**: weit scrollen → Mail öffnen → mobiler Zurück-Knopf → dieselbe oberste Zeile mit demselben Versatz; Vorwärts/Zurück; aus dem Reader per Seitenleiste in ein anderes Postfach → zweimal Zurück → dieselben Zeilen. **1440 px**: weit scrollen → Mail öffnen → anderes Postfach (Liste oben) → Zurück → dieselben Zeilen; erneuter Besuch per Klick → dieselben Zeilen |
| Playwright `qa-deep-links.spec.ts` | 9/9 (erster Lauf 8/9: Zeitüberschreitung im `beforeEach` beim Warten auf `folderId`; Wiederholung grün) |
| Playwright `qa-mobile-reader.spec.ts` | bestanden |
| Playwright `qa-reader-focus.spec.ts` (Round-2-Fixture) | 6/8. Die 2 Fehlschläge treten **identisch auf der unveränderten Basis 56840ce** auf (gegengeprüft): Nach `page.reload()` mit gespeichertem Fokuslayout öffnet die URL (`openMessageId`, seit den Deep Links) die Nachricht wieder im Fokusmodus, die Liste bleibt verborgen, und der Klick auf die erste Zeile läuft in die Zeitüberschreitung. Nicht durch diese Änderung verursacht; Vorschlag für BACKLOG.md: „reader focus / deep links | qa-reader-focus Fälle 1+2 erwarten nach Reload die Liste, URL öffnet aber den Reader im Fokus | briefs/scroll-anchors-report.md“ |
| `git diff --check` | sauber |

`bun run test:ci` wurde nicht ausgeführt (laut Regel stündlich auf dem Stage-Stand).

Ports: App 4100, Fixtures 4101–4103. Nur synthetische Daten; der Runner hat Server und Scratch-Daten selbst entfernt. Kein Zugriff auf Port 3790, ROOT/data oder externe Mailserver.

## Screenshots (synthetisch)

- [390 px, Liste nach Zurück](scroll-anchors-evidence/phone-list-after-back-390.png)
- [1440 px, Liste nach Zurück](scroll-anchors-evidence/desktop-list-after-back.png)

## Nicht abgedeckt / Grenzen

- Anker liegen nur im Speicher des Tabs. Nach einem Neuladen gilt das explizite URL-Ziel oder die Standardposition.
- Kein Browserfall für den Reader-Anker: Die Fixture-Nachrichten sind zu kurz zum Scrollen. Der Reader-Anker ist per DOM-Test abgedeckt.
- Der Ein-/Ausklappzustand von Listengruppen wird nicht im Anker gespeichert; er bleibt wie bisher in MailClient.
- Ein Wechsel des Listenschlüssels ohne Navigation (z. B. andere Sortierung oder Gruppierung) beginnt oben oder beim gespeicherten Anker dieses Schlüssels; vorher blieb die alte Pixelposition stehen, während die Liste neu lud.
- Echte iOS-/Android-PWA und Orientierungswechsel nicht geprüft; geprüft wurde 390 px Chromium.
