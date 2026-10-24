# App-Name und Icon – Vorschläge (Stand 24.10.2026)

Vorschau: `briefs/branding/proposals.html` (eigenständig, Bilder eingebettet).
Neu erzeugen: `bun briefs/branding/build.ts` im Repo-Root (braucht `rsvg-convert`).

## Namen

Geprüft wurde per Websuche (App Store, Anbieter im deutschen Markt). Das ist keine Markenrecherche beim DPMA/EUIPO.

| Name | Zeichen | Vorteile | Nachteile | Namenskonflikt |
|---|---|---|---|---|
| **Hauspost** | 8 | warm, deutsch, passt zu Haushalt und Büro; liest sich gut als „von Hauspost“ | klingt eher privat als geschäftlich | keine App dieses Namens gefunden; das Wort steht auch für Mitarbeiterzeitungen (Gattungsbegriff) |
| **Postkontor** | 10 | „Kontor“ passt zu kleinem Betrieb und Kanzlei, eigenständig | etwas altmodisch, 10 Zeichen | nichts gefunden |
| **ProMail** | 7 | kurz, international, Wunsch des Nutzers | generisch; liegt nah an „Proton Mail“ | **Konflikt:** „ProMail“ ist ein Bezahltarif von mail.de (deutscher Mailanbieter); eine Android/iOS-App „Pro Mail“ (Craigpark) gibt es auch |
| **Mailstube** | 9 | gemütlich, eigen, gut merkbar | Mischung aus Englisch und Deutsch | nichts gefunden |
| **MailHaus** | 8 | klar, „Haus“ passt zu gemeinsamen Postfächern | Mischung aus Englisch und Deutsch | nichts gefunden (nur „Mail Hub“, anderer Name) |
| **Postbote** | 8 | sofort verständlich, freundlich | eher ein Bote als ein Ort, wirkt verspielt | nur ein Kinderspiel „Dr. Panda's Postbote“, keine Mail-App |
| **Briefkasten** | 11 | sehr klar | genau an der Grenze, unter dem Icon knapp; Gattungsbegriff | myMail wirbt im App Store mit „Briefkasten“, keine App dieses Namens |
| **Postfach** | 8 | klar, neutral | Gattungsbegriff, wenig eigen | **Verwechslung:** die Anwalts-App „beA Postfach“ (relevant für eine Kanzlei) |

Empfehlung: **Hauspost**. Für einen eher geschäftlichen Klang: **Postkontor**. Von **ProMail** rate ich ab, weil der Name schon als Mail-Produkt am deutschen Markt vergeben ist.

## Icon

Fünf eigene Zeichnungen (weißer Umschlag nach dem Vorbild von Apple Mail, nichts von Apple übernommen) auf 1024×1024 ohne Rand, in `briefs/branding/icons/` als SVG plus PNG in 180 und 512 px:

1. `v1-klassisch` – unser Verlauf `#FFB347 → #F37335` von oben nach unten, feine graue Klappe
2. `v2-diagonal` – schräger Verlauf, flacherer Umschlag, Falze unten
3. `v3-tief` – dunkleres Orange, Klappe als eigene Fläche mit Schatten
4. `v4-hell` – helleres Orange, orange Kontur und Klappe
5. `v5-siegel` – wie 1, dazu ein oranger Punkt an der Klappenspitze

Empfehlung: **Variante 1**. Sie nutzt genau die bisherigen Farben (sie passen auch zum Badge-Orange `#c94f00` und zu bestehenden Screenshots), ist bei 60 px am ruhigsten und kommt dem Apple-Mail-Vorbild am nächsten. Variante 5 ist die Alternative, wenn die App sich auf dem Home-Bildschirm klarer von Apple Mail abheben soll: Der Punkt bleibt auch bei 60 px sichtbar.

## Schritte für die spätere Umstellung (eigener Branch, nicht in dieser Runde)

**Name**
1. `lib/appBranding.ts`: `BASE_APP_TITLE` auf den neuen Namen setzen. Daraus kommen `name`/`short_name` im Manifest (`app/manifest.ts`), `appleWebApp.title` (Name auf dem iOS-Home-Bildschirm, `app/layout.tsx`) und alle Fenstertitel.
2. `deploy-scripts/container-entrypoint.sh`: `BASE_TITLE` und den Fallback `"Noctua Mail"` mit anpassen (Docker-Weg über den Platzhalter `__NOCTUA_APP_TITLE__`).
3. Die Variable `NOCTUA_STATIC_APP_TITLE` würde zwar ohne Codeänderung reichen, ersetzt aber den Titel komplett und lässt den Zusatz aus `APP_ENV_LABEL` weg. Für eine dauerhafte Umbenennung ist die Konstante deshalb der richtige Ort.
4. Der Titel wird beim Build festgelegt (Manifest und Layout sind statisch). Nach der Änderung muss also neu gebaut werden, ein Neustart allein reicht nicht.
5. Achtung Vorschau: Mit `APP_ENV_LABEL=Dev` heißt die App „Hauspost (Dev)“ (14 Zeichen), iOS kürzt das. Überlegenswert: `short_name` nur der Grundname, oder ein kürzeres Label.
6. Gleich mit erledigen: `description` im Manifest ist noch „Modern webmail client prototype“ → deutsch. Technische Kennungen (`PRODID:-//Noctua Mail//…`, User-Agent, `MAILER_ID` in `lib/mail/smtp.ts`) sind unsichtbar und können bleiben oder bewusst mit umbenannt werden.

**Icon**
1. `public/icons/base.svg` durch die gewählte Variante ersetzen, dabei **das bisherige Koordinatensystem beibehalten**: `viewBox="-100 -100 1800 1800" width="1600" height="1600"` und der Hintergrund als `<rect … width="1600" height="1600" rx="350" ry="350">`. Davon hängen ab: das Umgebungsband in `app/icons/logo.svg/route.ts` (Logo in der Seitenleiste) und die `sed`-Ersetzungen in `build-scripts/generate_push_icons.sh`. Die Umschlag-Grafik also von 1024 auf 1600 skalieren.
2. `build-scripts/generate_push_icons.sh` erzeugt `apple-touch-180.png` (ohne Rand, deckend) und `icon-96-mono.png` (weiße Silhouette für Android-Badges). Für das Mono-Badge muss die Ersetzung `fill="#3f5b69"` auf die neue Grafik angepasst werden: Der Umschlag wird weiß, die Klappenlinie ausgespart.
3. `build-scripts/generate_icons.sh` ist veraltet (Quelle `my-assets/silhouette copy.svg`, ImageMagick). Die Größen `public/icons/icon-{16,32,48,64,72,96,128,144,152,180,192,256,512}.png` und `public/favicon.png` besser aus `base.svg` mit `rsvg-convert` erzeugen; das Skript dabei auf `base.svg` umstellen.
4. Abhängige Stellen ohne Codeänderung: `app/icon.tsx`, `app/apple-icon.tsx` und `/icons/badged/[size]` lesen die PNGs aus `public/icons`; `public/sw.js` nutzt `icon-192.png` und `icon-96-mono.png` für Push-Mitteilungen.

**Caches**
- `/icons/icon-*.png` und `base.svg` werden laut `next.config.ts` einen Tag gecacht (`max-age=86400`, `stale-while-revalidate` 7 Tage). Browser und Push-Mitteilungen zeigen das alte Icon also bis zu einem Tag weiter. Wer das vermeiden will, gibt den Dateien neue Namen, z. B. `icon-192-v2.png` (Manifest, `sw.js`, Route anpassen).
- Badged-Route, `apple-icon`, `icon` und `logo.svg` laufen mit `must-revalidate` und sind sofort aktuell.
- Der Service Worker cacht keine Icons; ein neues `sw.js` wird beim nächsten Laden übernommen.

**Geräte**
- **iPhone/iPad:** iOS übernimmt Name und Icon nur beim „Zum Home-Bildschirm“. Danach ändert sich nichts mehr. Alle müssen die alte App löschen und über Safari → Teilen → „Zum Home-Bildschirm“ neu anlegen. Das Push-Abo gehört zur installierten App: Nach dem Neu-Anlegen in der App die Mitteilungen wieder einschalten. Das alte Abo meldet der Apple-Dienst beim nächsten Versand als ungültig (404/410), der Server entfernt es dann selbst (`lib/push/send.ts`).
- **Android/Desktop (Chrome, Edge):** Die Manifest-`id` bleibt `/`. Name und Icon werden beim nächsten Manifest-Abgleich automatisch übernommen (Chrome prüft etwa täglich; bei einer Namensänderung fragt Android eventuell nach). Neu installieren ist nicht nötig, Push bleibt aktiv.
- Login-Cookies hängen an der Domain, nicht an der App. Nach dem Neu-Anlegen auf dem iPhone muss man sich aber einmal neu anmelden (iOS trennt den Speicher jeder Home-Bildschirm-App).
