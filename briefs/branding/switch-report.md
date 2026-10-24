# Umstellung auf „Mail“ und neues Icon – Bericht (24.10.2026)

Branch `feat/app-branding`, Basis 9773e4e67. Name „Mail“, Icon Variante 1 „klassisch“ (weißer Umschlag auf `#FFB347 → #F37335`).

## Geänderte Dateien

**Name**
- `lib/appBranding.ts`: `BASE_APP_TITLE = "Mail"` (exportiert). Vorschau mit `APP_ENV_LABEL=Dev` → „Mail (Dev)“, Produktion „Mail“. Fenstertitel ohne Ordner (Anmeldung, Laden) heißen jetzt nur „Mail (Dev)“ statt „Mail — Mail (Dev)“.
- `deploy-scripts/container-entrypoint.sh`: `BASE_TITLE="Mail"` und Fallback.
- `messages/de.json`, `messages/en.json`: „Bei Mail anmelden“, „Weiter zu Mail“; App-Beschreibung „Webmail für persönliche und gemeinsame Postfächer“ (statt „Prototyp“).
- `app/manifest.ts`: Beschreibung aus dem Katalog (Deutsch), Icons versioniert.
- `app/reset-password/page.tsx`: Titel „Reset password · Mail …“ über `DEFAULT_APP_TITLE`.
- `lib/betterAuth.ts`: TOTP-Aussteller, `appName` und Passkey-`rpName` = „Mail“.
- `public/sw.js`: „Mail: Benachrichtigungen aktiv“, Fallback-Titel „Mail“.
- Unverändert (unsichtbar): `PRODID`, User-Agent, `MAILER_ID`, `X-Noctua-*`-Header, Cookie-Präfix, Env-Variablen, Paketname, Log-Präfixe, Repo-Doku.

**Icon**
- `public/icons/base.svg`: Variante 1 im alten Koordinatensystem (`viewBox="-100 -100 1800 1800"`, Hintergrund 1600 px mit `rx=350`), Umschlag von 1024 auf 1600 skaliert. Ids `iconBackground`, `envelope`, `envelopeFlapLine`, Maske `envelopeFlapCut` für das Mono-Badge.
- Neu erzeugt: `public/icons/icon-{16,32,48,64,72,96,128,144,152,180,192,256,512}.png`, `public/favicon.png`, `public/icons/apple-touch-180.png`, `public/icons/icon-96-mono.png` (weißer Umschlag, Klappenlinie ausgespart).
- `build-scripts/generate_icons.sh`: neu, erzeugt alles aus `base.svg` mit `rsvg-convert`. `build-scripts/generate_push_icons.sh` entfernt (in `generate_icons.sh` aufgegangen).

**Cache**
- `APP_ICON_VERSION = "2"` und `versionedIconUrl()` in `lib/appBranding.ts`; `?v=2` an Manifest-Icons, Seiten-Icon, Apple-Touch-Icon, Seitenleisten-Logo, Push- und Erinnerungs-Mitteilungen (`public/sw.js`, `useReminderNotifications.ts`).
- `app/icon.tsx` und `app/apple-icon.tsx` ersetzt durch explizite Links in `app/layout.tsx` (`/icons/badged/256?v=2`, neue Route `/icons/apple-touch?v=2`), weil Next die automatisch erzeugten Links nur bei Änderung der Quelldatei neu hasht. `/icons/badged/[size]` erlaubt dafür zusätzlich 256.
- Erinnerungs-Mitteilungen des Service Workers zeigten auf das nicht vorhandene `/icon.png` und auf das farbige Favicon als Badge; sie nutzen jetzt dieselben Icons wie Push.

**Doku**
- `doc/PUSH-NOTIFICATIONS.md` („iOS notes“): Hinweis für alle Nutzer – alte Home-Bildschirm-App löschen, neu hinzufügen, neu anmelden, Mitteilungen wieder einschalten.
- `doc/PWA.md`: neuer Abschnitt „App name and icon“ (Name, `base.svg`-Regeln, Icon-Befehl, Versionsnummer).

## Icons neu erzeugen

```sh
bash build-scripts/generate_icons.sh   # im Repo-Wurzelverzeichnis, braucht rsvg-convert
```

Danach `APP_ICON_VERSION` in `lib/appBranding.ts` **und** in `public/sw.js` erhöhen (`lib/push/serviceWorker.test.ts` schlägt fehl, wenn sie abweichen) und neu bauen.

## Prüfungen

- `bun check`: 0 Fehler (1.445 Dateien).
- ESLint auf allen geänderten Dateien: 0 Fehler, 0 Warnungen.
- Fokussierte Tests (Branding, Manifest, Push/Service Worker, Better Auth, next.config, Deep-Links, i18n inkl. Layout, html): 243 bestanden, 0 fehlgeschlagen.
- `bun run test:dom`: 837 bestanden, 0 fehlgeschlagen.
- `bun run build`: erfolgreich.
- Browser-Prüfung gegen den Produktions-Build mit synthetischen Daten (QA-Harness, `APP_ENV_LABEL=Dev`): 2/2 bestanden. Titel „Mail (Dev)“, Manifest `name`/`short_name` „Mail (Dev)“, Head-Links `/icons/badged/256?v=2` und `/icons/apple-touch?v=2`.

Belege in `briefs/branding/switch-evidence/`: `login-1280.png`, `login-390.png`, `sidebar-1280.png`, `sidebar-390.png`, `sidebar-logo-1280.png`, `apple-touch-180.png`, `apple-touch-dev.png`, `badged-192-dev.png`, `logo-svg-dev.png`, `logo-svg-prod.png`, `icon-96-mono-on-dark.png`, `head-and-manifest.json`, `signed-in-title.txt`.

## Offene Punkte

- iPhone/iPad: Name und Icon ändern sich erst nach Löschen und Neu-Anlegen der Home-Bildschirm-App; danach neu anmelden und Mitteilungen wieder einschalten. Android/Desktop übernehmen beides automatisch (meist innerhalb eines Tages).
- Bestehende Authenticator-Einträge heißen weiter „Noctua“ und funktionieren unverändert; neue Einrichtungen heißen „Mail“. Passkeys bleiben gültig (nur der Anzeigename für neue Passkeys ändert sich).
- Die Vorschau heißt „Mail (Dev)“ (10 Zeichen); iOS zeigt das ungekürzt.
- `lib/html.test.ts` nutzt „Subject - Noctua Mail“ als beliebigen Testtext; nicht geändert.
- `bun run test:ci` (voll) nicht gelaufen; nach dem Merge im stündlichen Lauf auf dem Stage-Stand.
