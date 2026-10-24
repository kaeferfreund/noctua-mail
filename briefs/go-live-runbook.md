# Go-live: Synology MailPlus → Noctua / netcup

Stand: 2026-10-22. Zielgruppe: zwei Personen, ca. zwölf echte Postfächer auf `monkeymed.de`, `advoria.de`, `c2konzepte.de`, `rc-portal.com`, davon acht gemeinsam. Dieses Dokument ist ein **Betriebsplan**. Die Schreib-, Import-, Dienst- und DNS-Befehle unten wurden bei seiner Erstellung **nicht ausgeführt**. Platzhalter `<…>` vor Ausführung ersetzen. Secrets nur im privaten Terminal/Secret Store eingeben; keine Passwörter, Invite-Codes, QR-Codes oder Reset-Links in dieses Dokument übernehmen.

## 0. Entscheidung, Quellen und aktuelle Sperren

Empfehlung: `/srv/noctua` für Produktion, eigener Unix-Benutzer `noctua`, **systemweite systemd-Unit**, ein Bun/Next-Server mit `bun:sqlite` und begrenzten kurzlebigen Sync-Unterprozessen. Kein Docker, kein Cluster/PM2, keine zweite Serverinstanz auf denselben Daten. Caddy mit `caddy-dns/netcup` übernimmt DNS-01 und HTTPS ausschließlich auf `100.92.134.1:443`; Next hört auf `127.0.0.1:3654`. DNS/MX, SMTP und IMAP bleiben bei netcup. Nachtbackup mit restic per SFTP auf die vorhandene NAS, zusätzlicher unabhängiger Maildir-Export; Schlüssel zusätzlich offline. Werte für Retention, Limits und Zeitfenster unten sind **Vorschläge**, keine bereits eingerichteten Eigenschaften. Quellen: [D] §8–9, [W] „Connection and memory sizing“, [U] „Standalone (Bun)“.

### 0.1 Quellenkürzel (Pfade sind absolut auf diesem Host)

| Kürzel | Maßgebliche Quelle |
|---|---|
| [D] | `/home/monkey/code/noctua-mail/repo/doc/TEAM-INBOX.md`, Design v5; insbesondere §1.1 Go-live-Kriterien, §4.3–4.6, §5, §8.1–8.2, §9 und §11 |
| [A] | `/home/monkey/code/noctua-mail/repo/doc/TEAM-AUTH-PLAN.md`, Slices 3–7; Slice 7 gehört zur UI-/Integrationsarbeit |
| [R] | `/home/monkey/code/noctua-mail/briefs/requirements-fit-report.md`, §2 Punkte 17–18 und §5; alte SESSION_SEAL_KEY-/generiertes-Passwort-Anweisungen sind durch [D] §8/§11 und [A] ersetzt |
| [U] | `/home/monkey/code/noctua-mail/repo/doc/DEPLOYMENT.md`, „Standalone (Bun)“, „Storage Requirements“, „Health Checks“, „Backup & Restore“; einige Pfadangaben sind überholt, siehe §6 unten |
| [W] | `/home/monkey/code/noctua-mail/wt-mailbox-watcher/doc/DEPLOYMENT.md`, „Background mailbox watcher (team deployments)“, Env-Tabelle, Sizing und Summary-Vertrag |
| [DEV] | `/home/monkey/code/noctua-mail/ops/deploy-dev.sh`, `/home/monkey/.config/systemd/user/noctua-dev.service`, `/home/monkey/.config/systemd/user/noctua-fixture.service` |
| [N] | `/home/monkey/code/infra/tools/netcup/README.md`, „Klassisches netcup-DNS (Legacy-API)“, „Sicherungen“, Setup/Account-Zuordnung |
| [C] | Code unter `/home/monkey/code/noctua-mail/repo/`; jeweils konkrete Datei/Funktion im Text. Watcher- und Auth-Code aus deren Worktrees ist ausdrücklich als Branchstand bezeichnet. |
| [H] | Read-only-Hostbeobachtung am 2026-10-22: `uname -m`, `nproc`, `free -h`, `df -h`, `command -v`, `file`, `systemctl --user show`, `ss -ltn`, `tailscale serve status`, `getent`; DNS zusätzlich per Google-DNS-over-HTTPS gelesen. Ergänzend die vom Auftraggeber als heute geprüft gelieferten Umgebungsdaten. |

Externe Primärquellen für Syntax (am 2026-10-22 gelesen): [Caddy/netcup README](https://github.com/caddy-dns/netcup), [Caddy reverse_proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy), [request_body](https://caddyserver.com/docs/caddyfile/directives/request_body), [Caddy globale Optionen](https://caddyserver.com/docs/caddyfile/options), [Next standalone/output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output), [imapsync README](https://imapsync.lamiral.info/README), [imapsync Flags](https://imapsync.lamiral.info/FAQ.d/FAQ.Flags.txt), [SQLite Online Backup](https://www.sqlite.org/backup.html), [mbsync](https://isync.sourceforge.io/mbsync.html), [restic SFTP/Repository](https://restic.readthedocs.io/en/stable/030_preparing_a_new_repo.html), [restic Retention](https://restic.readthedocs.io/en/stable/060_forget.html), [netcup Webhosting-Oberfläche](https://www.netcup.com/en/helpcenter/documentation/web-hosting/interface), [Tailscale Serve](https://tailscale.com/docs/features/tailscale-serve), [journald](https://www.freedesktop.org/software/systemd/man/latest/journald.conf.html). Installierte Versionen und deren `--help` haben vor Ausführung Vorrang; dieses Dokument behauptet keinen erfolgreichen Live-Test dieser Tools.

### 0.2 Istzustand und Go/no-go

| Befund | Konsequenz / Verifikation | Rückweg |
|---|---|---|
| Integration `repo`, Branch `team-inbox`, beim Lesen HEAD `c1652ec`; Auth-Worktree HEAD `8ff60ed`, Slice 2. Dort antworten `app/api/auth/signup/route.ts` und `app/api/ba/[...all]/route.ts` absichtlich 503. | **NO-GO** bis team-auth Slices 3–6 und UI Slice 7 integriert und abgenommen sind. Neue Commits vor Release erneut prüfen. | MailPlus bleibt Produktivclient; keinen 503-Stand aktivieren. Quellen [A], Auth-Worktree-Routen. |
| `briefs/mailplus-facts` war nicht vorhanden. NAS-Hostname, IMAP-Loginstruktur, konkrete Adressen und Fähigkeiten wurden nicht live geprüft. | Inventar und §1/§4 ausfüllen; keine angenommenen Ordnernamen importieren. | Nur Probe/Dry-run, Original unverändert. Quellen [H], [R] §5. |
| Ubuntu ARM/aarch64; Auftrag nennt sechs Kerne, `nproc` meldet zwölf logische CPUs; ca. 23 GiB RAM, 8 GiB Swap, 102 GiB frei auf `/`. | Reicht als Ausgangspunkt, kein Lastnachweis; Speicher-/Quotabedarf inklusive NAS-Archive, Builds und Backups messen. | Workerzahl 1 halten, große Arbeiten seriell. Quelle [H]. |
| Bun 1.4.4 vorhanden, `repo/package.json` nennt `bun@1.3.12` und Next 16.2.4. | Für Release eine getestete Bun-Version pinnen; Unterschiede protokollieren. | Vorherige Bun-Binärdatei gemeinsam mit Release aufbewahren. Quellen [H], [C] `package.json`. |
| Kein `caddy`, `xcaddy`, `imapsync`, `mbsync`, `restic` oder `dig` im PATH. `sqlite3` zeigt auf Android-SDK **x86-64**, nicht ARM. | Werkzeuge später durch Operator passend für ARM bereitstellen; `sqlite3 -version` muss tatsächlich laufen. Keine Installation bei dieser Recherche. | Tools nicht blind ausführen; MailPlus weiterverwenden. Quelle [H]. |
| `noctua-dev` und Fixture laufen als User-Units. Preview ist `https://remote-arm.tail31b4a1.ts.net:3790`. Tailscale Serve belegt außerdem **Tailnet-Port 443** und leitet dort auf `127.0.0.1:4173`. | **NO-GO für Caddy-Bind auf 443**, bis der bestehende Serve-Endpunkt geplant verlegt ist (§2.4). `ss` und Serve-Status prüfen. | Vorherige Serve-Konfiguration erhalten; weder `serve reset` noch global Funnel/Serve abschalten. Quellen [DEV], [H]. |
| Öffentliches DNS-over-HTTPS: `mails A 100.92.134.1`, TTL 21600; lokales `getent` lieferte noch `76.76.21.21` aus dem Wildcard-Ziel. | **NO-GO für Geräteabnahme**, bis beide Personen auf allen Geräten die Tailnet-IP auflösen. `curl --resolve` ist nur Diagnose. | TTL abwarten/Resolver klären; vorhandenen A-Record nicht überschreiben. Quelle [H]. |
| `monkeymed.de MX`: 10 `mail.monkeymed.de`, 50 `mxf9a0.netcup.net`; `mail.monkeymed.de A 46.38.249.160` im DNS-over-HTTPS. Public IPv4 des App-Hosts laut Auftrag: `130.61.177.119`. | MX gehört zum netcup-Maildienst; **nicht** auf Noctua zeigen lassen. MX der drei anderen Domains noch prüfen. | Unveränderte MX-Zone ist der Rückweg. Quellen [H], Auftrag. |

Abhängigkeiten werden hier immer mit **TODO [Branch / Slice]** markiert. Auch ein fertig wirkender Worktree gilt erst nach Integration und Release-Nachweis als verfügbar. Alle 18 Zeilen aus [D] §1.1 müssen einzeln unterschrieben sein; Auth allein ist keine Freigabe.

## 1. Pre-flight: Inventar, netcup und vorhandene Funktionen

### 1.1 Adress- und Rollenliste gemeinsam ausfüllen

**Schritt:** In netcup CCP/WCP/Plesk alle vier Domains, echte Mailboxen, Aliase, Weiterleitungen, Catch-all und Quoten mit der MailPlus-Konfiguration vergleichen. Keine Passwörter ins Inventar. Pro **echter** Mailbox genau ein Noctua-Account; ein Alias ist kein zusätzlicher IMAP-Account. Gemeinsam genutzte MailPlus-Ansicht auf genau ein netcup-Postfach abbilden; auf persönlichen Exportläufen nochmals eingeblendete Shared-Ordner ausschließen. Quellen [R] §5.1, [D] §11.1/§5.3.

| Domain | Vollständige Adresse | Typ: Mailbox/Alias/Forward/Catch-all | Zieladresse / echte Login-Mailbox | Tatsächlicher IMAP-Username | MailPlus-Login + Pfad/Shared-Prefix | Empfang / Versand nötig? | Noctua `email` / `name` | Owner | Person A Rolle | Person B Rolle | Größe/Quota | POP3 keep/delete | Ergebnis |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| monkeymed.de | `<address>` | `<type>` | `<target>` | `<login>` | `<path>` | `<receive/send>` | `<email/name>` | `<A/B/none>` | `<manager/editor/viewer/none>` | `<role>` | `<GiB>` | `<mode>` | `<approved>` |
| advoria.de | `<address>` | | | | | | | | | | | | |
| c2konzepte.de | `<address>` | | | | | | | | | | | | |
| rc-portal.com | `<address>` | | | | | | | | | | | | |

Eine Zeile **je Adresse**, nicht vier Sammelzeilen lassen. Zusätzlich Geräte/IMAP-Clients, SMTP-Senderberechtigungen und tägliches Versandvolumen notieren. `account.email` bestimmt ID und Absender und ist später unveränderlich; `account.name` ist auch der From-Anzeigename gegenüber Kunden. Keine rein internen Sidebar-Namen verwenden. Falls Versand als Alias nötig bleibt: **TODO [feat/sender-identities, Stage 3]**, Go-live bis zur Implementierung oder akzeptierten Umwandlung in echte Mailbox blockieren. Aliase in Noctuas bisherigen Kontakt-/Empfängerlisten sind keine Senderidentitäten. Quellen [C] `lib/accountId.ts`, `lib/mail/smtp.ts`, [D] §1.1 Fit 16 / §5.3 / §9.

**Prüfen:** Anzahl echter Mailboxen ≈12, gemeinsame ≈8; jede Adresse hat genau einen Empfangspfad, jede erforderliche From-Adresse einen getesteten Versandpfad; kein Shared-Forward führt zusätzlich in beide persönliche INBOXen. Beide Personen bestätigen persönliche Zugriffsgrenzen.

DNS-Bestand zusätzlich nur lesend sichern/prüfen; für die Legacy-Zone weder `--revision` noch einen CloudDNS-TTL-Parameter verwenden. Der CLI-Aufruf liest laut [N] die Credentials aus Doppler, nicht aus diesem Runbook:

```bash
cd /home/monkey/code/infra
./scripts/netcup dns list monkeymed.de --account 1
```

`mails A 100.92.134.1` neben `* A 76.76.21.21` prüfen; keine dieser Zeilen und keinen MX für den Cut-over ändern. Für die anderen Domains zuerst den tatsächlichen netcup-Account aus dem Inventar bestimmen, nicht pauschal Account 1 annehmen. Verifikation: DNS-Zonenliste passt zu autoritativen Antworten und Geräteauflösung; Rückweg bei reinem Lesen entfällt. [N], [H].

**Rollback:** Liste korrigieren, keine Mailbox löschen/umbenennen. Vor einer späteren Forward-/Aliasänderung alte Plesk-Einstellung sichern und genau diese zurücksetzen.

### 1.2 MailPlus-Funktionen und netcup-Regeln erfassen

**Schritt:** Je MailPlus-Benutzer/Postfach Labelnamen und Treffer, Filterreihenfolge/Zielordner, freigegebene Ordner, Signaturen, Vacation/Autoresponder, Weiterleitungen, lokale Kalender/Kontakte, Regeln und Sonderordner erfassen. Labels vorher bewusst in Ordner überführen oder Verlust schriftlich akzeptieren; Noctua-Topics werden lokal gespeichert und sind kein MailPlus-Labelimport. Regeln/Autoresponder im **netcup-WCP** nachbauen; Noctua ist kein eingehender Mailserver und bietet hier keinen bestätigten Vacation-/Sieve-Ersatz. ManageSieve auf Port 4190 ist zu prüfen, kein vorausgesetztes Feature. Quellen [R] §1/§5.2, [D] §1.1/§11.1–3.

Im WCP je echter Mailbox Spamfilter so konfigurieren, dass Spam **in den tatsächlichen Junk-/Spam-Ordner verschoben** wird; bloß Betreff markieren reicht nicht für Ordneranzeige. netcup dokumentiert zusätzlich einen eigenen standardmäßig aktiven Webhosting-Spamfilter; beide Ebenen bei GTUBE-Misserfolg prüfen. Autoresponder-Zeitfenster, tägliche Wiederholgrenze und Weiterleitungsziel übernehmen. Quelle: [netcup Webhosting-Oberfläche](https://www.netcup.com/en/helpcenter/documentation/web-hosting/interface), „Email Addresses“ / „Spam Filter“ / „Auto-Reply“; [R] §5.2.

**Prüfen:** Mit einer externen Testadresse genau eine Antwort und richtige Regelablage testen, anschließend Autoresponder wieder in den vorgesehenen Status setzen. GTUBE-Test an eine freigegebene Testmailbox muss im vorgesehenen Spam-Ordner erscheinen; keinen Versand an Kunden. Kalender-/Kontakt-System of Record schriftlich festlegen.

**Rollback:** Alte Regeln wiederherstellen, neue testweise deaktivieren; nicht parallel MailPlus- und netcup-Autoresponder laufen lassen. Labelentscheidung vor Migration rückgängig machen, Originalbestand erhalten.

### 1.3 TLS und Fähigkeiten je echter Mailbox – ohne Fixture

**Schritt:** Vom späteren Produktionshost **jede** Login-Mailbox prüfen, nicht die lokale Fixture auf 3797. Diese interaktive Sitzung gehört in ein privates, nicht aufgezeichnetes Terminal. Die IMAP-Zeilen nach Start von `openssl` eingeben, nicht in Bash; Passwort nicht als Prozessargument verwenden. IMAP-Quoted-Strings erfordern `\` und `"` zu escapen; bei problematischen Zeichen einen etablierten IMAP-Client statt improvisierter Auth-Skripte verwenden.

```bash
openssl s_client -connect mxf9a0.netcup.net:993 \
  -servername mxf9a0.netcup.net -verify_hostname mxf9a0.netcup.net \
  -verify_return_error -CApath /etc/ssl/certs -crlf -quiet
```

```text
a01 CAPABILITY
a02 LOGIN "<actual-imap-username>" "<password-entered-privately>"
a03 CAPABILITY
a04 NAMESPACE
a05 LIST "" "*"
a06 LIST (SPECIAL-USE) "" "*"
a07 STATUS "INBOX" (MESSAGES UNSEEN UIDNEXT UIDVALIDITY)
a08 STATUS "<actual-sent-path>" (MESSAGES UNSEEN UIDNEXT UIDVALIDITY)
a09 LOGOUT
```

`LIST (SPECIAL-USE)` nur bei entsprechender Fähigkeit erwarten; bei BAD bleibt `LIST "" "*"` zur Bestandsaufnahme. Ein BAD auf NAMESPACE bedeutet fehlende Erweiterung, nicht fehlenden Mailbestand. Auch NAS-IMAPS mit deren zertifiziertem Hostnamen genauso prüfen; keine öffentliche NAS-Freigabe für die Migration anlegen. Quellen [R] §5.2/4, [D] §11.3/5; für Noctuas TLS-Prüfung [C] `lib/mail/imapClientOptions.ts`.

| Mailbox-ID | TLS/Hostname OK | UIDPLUS | SPECIAL-USE/LIST-EXTENDED | NAMESPACE/Delimiter | INBOX | **ein** Sent (`\Sent`) | Drafts (`\Drafts`) | Trash (`\Trash`) | Junk (`\Junk`) | Archive (`\Archive`) | Quota frei | Limitnachweis |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `<inventory-id>` | | | | | | | | | | | | |

**Prüfen:** UIDPLUS muss auf allen produktiven Mailboxen vorhanden sein: bestehender Draft-Code benötigt die UID aus APPEND. Fehlendes UIDPLUS = **NO-GO**, bis getesteter Codeersatz existiert. Genau **einen vorgesehenen** Sent-Ordner und einen Drafts-Ordner festlegen; alternative leere „Gesendet“-/„Sent Messages“-Ordner später kontrolliert zusammenführen, keine automatische Löschung. Sent-Erkennung nach SPECIAL-USE ist **TODO [feat/thread-collaboration, Stage 2]**; Branch `feat/mailbox-watcher` enthält ebenfalls Änderungen dazu, Integration/Konfliktauflösung prüfen. Quellen [R] §2 Fit 13 / §5.2, [D] §1.1 Fit 12–13, [W] erster Absatz, [C] `lib/drafts.ts`, `lib/specialFolders.ts`.

**Rollback:** Nur CAPABILITY/LIST/STATUS/LOGOUT ändern keine Mail. Bei falsch angelegten Zielordnern Import stoppen, Bestand prüfen, Ordner erst nach gesichertem Merge zurückbauen; niemals vorhandene Mailboxen „bereinigen“.

### 1.4 IMAP-Verbindungen und Loginrate messen

**Bekannt:** Ein Watcher hält pro Account eine INBOX-IDLE-Verbindung; zwölf Accounts bedeuten ca. zwölf dauerhafte Sockets, dazu ein Sync-Worker bei Startwert 1, kurzlebige Pool-Verbindungen und Browser-IDLEs/andere Clients. Der Worker-Cap begrenzt nicht sämtliche IMAP-Sockets. `maxIdleSessions=1` reduziert Browserlast, garantiert wegen INBOX-/Aktivordner-Verhalten aber keine exakt eine Verbindung. Auth-Fehler suspendieren den Watcher für diese gespeicherte Identität; normales Backoff beginnt bei 60 s und wächst bis 30 min. Quellen [W] Env-Tabelle, Reconnects und Sizing; `wt-mailbox-watcher/lib/mailboxWatcher.ts`.

**Unbekannt:** verbindliche netcup-Grenzen je User, User+IP, Quell-IP und Hostingpaket sowie Login-/Fehlversuchsrate. In der gelesenen netcup-WCP-Doku steht kein belastbarer Zahlenwert. Werte anderer Hoster oder Dovecot-Defaults nicht übertragen. Beim Support die Grenzen für **dieses Paket und `mxf9a0.netcup.net`** erfragen; keine Supportnachricht wurde hier versendet.

**Schritt:** Ein Testpostfach mit korrektem Passwort verwenden, andere Clients dieses Postfachs schließen. Mit §1.3 in getrennten privaten Terminals eine, dann zwei, dann höchstens vier parallele authentifizierte Sitzungen öffnen; je eine Minute halten, mit `NOOP` prüfen und jeweils `LOGOUT`. 15 s Abstand zwischen neuen Logins, bei erstem NO/BYE/Timeout abbrechen. Das belegt nur „mindestens N“, keine Providerobergrenze. Danach den realen Test mit zwei Personen, Watcher und Worker durchführen, keine absichtliche Passwortfehler-Schleife.

```bash
# Hostweite tatsächlich offene TCP-Verbindungen zu 993; nur Momentaufnahme.
ss -tn state established '( dport = :993 )'
journalctl -u noctua.service --since '30 minutes ago' --no-pager \
  | rg -i 'too many|maximum.*connection|auth_failed|backoff|breaker|BYE|LOGIN|APPEND'
```

**Prüfen:** Testtabelle um Datum, Paket, Quell-IP, Zahl gehaltene Sitzungen, Latenz und exakte redigierte Fehlermeldung ergänzen. Alltagsbetrieb mit zwölf Accounts und zwei Personen mindestens 30 Minuten, idealerweise einen Arbeitstag ohne Verbindungs-/Loginprobleme. Mit Watcher=0 starten, dann 1 aktivieren; `NOCTUA_MAX_SYNC_WORKERS=1`, Intervall 300000 ms. Limitprobleme: Tabs/weitere Clients reduzieren, Intervall auf 600000 erhöhen und erneut messen. Quelle für Stellschrauben [W].

**Rollback:** Sitzungen mit LOGOUT schließen, Watcher vorübergehend deaktivieren und Dienst neu starten (§3); MailPlus-POP3 nach Import **nicht** reflexartig einschalten. Kein Brute-Force-Ermitteln der Providerobergrenze.

## 2. Produktionshost, Secrets, systemd und HTTPS

### 2.1 Verzeichnisse, Benutzer und Werkzeuge

**Schritt (späterer Operator, privilegiert):** `/srv/noctua` trennt Produktion von Build-Worktrees/Fixture und verhindert versehentliche Dev-Resets. `/home/monkey/code/noctua-mail` bleibt Entwicklungs-/Buildort. Eigenes Servicekonto, getestetes ARM-Bun unter `/opt/noctua/bin/bun` bereitstellen; nicht auf eine Binärdatei in `/home/monkey` verlinken, da `ProtectHome=true` gilt. Weitere Voraussetzungen: Caddy mit Provider, native ARM-sqlite3, Python 3, rsync/tar, restic, IMAP-Tools auf dem LAN-Migrationsrechner. Installation ist ein eigener Operator-Schritt, nicht Bestandteil der ausgeführten Recherche. Empfehlung auf Basis [DEV], [D] §8.2, [U].

```bash
sudo useradd --system --user-group --home-dir /srv/noctua --shell /usr/sbin/nologin noctua
sudo install -d -o root -g root -m 0755 /srv/noctua /srv/noctua/releases /opt/noctua/bin
sudo install -d -o noctua -g noctua -m 0700 /srv/noctua/data
sudo install -d -o root -g root -m 0700 /etc/noctua /srv/noctua/backups /srv/noctua/migration
# Copy the previously tested ARM Bun binary; replace the placeholder source.
sudo install -o root -g root -m 0755 '<tested-arm-bun-binary>' /opt/noctua/bin/bun
/opt/noctua/bin/bun --version
sqlite3 -version
```

Bei vorhandenem Benutzer `id noctua` prüfen und `useradd` überspringen. Layout:

```text
/srv/noctua/releases/<utc>-<gitsha>/      complete standalone tree + release metadata
/srv/noctua/releases/<id>/app            relative symlink to actual standalone app root
/srv/noctua/current                     symlink to one release
/srv/noctua/previous                    symlink to last working release
/srv/noctua/data/db/main.db             current master (not the old documented mail.db)
/srv/noctua/data/db/accounts/*.db        default shards; accounts.dbPath is authoritative
/srv/noctua/data/sources/                raw-message cache
/srv/noctua/data/attachments/            attachment cache
/var/cache/noctua/                      writable Next cache
/etc/noctua/noctua.env                   root-only production secrets
/etc/caddy/Caddyfile                    canonical proxy
/etc/caddy/netcup.env                   root-only legacy DNS credentials
/srv/noctua/backups/                    local staging, never the sole backup
```

**Prüfen:** `id noctua`, `namei -l /srv/noctua/data`, `file /opt/noctua/bin/bun`, freier Speicher und Quoten. Für 10 GB Mail als erste Planung ≥25 GB Datenspeicher **plus** Build-/Backup-/Archivreserve ansetzen; 2.5× ist nur [R]s Schätzung, keine gemessene Obergrenze. Sources/Attachments wachsen, RAM anhand großer MIME-Mails messen. Datenpfade: [C] `lib/runtimePaths.ts`, `lib/db/connection.ts`.

**Rollback:** Noch keine Produktivmail betroffen; nur neu angelegte leere Verzeichnisse/Benutzer nach Kontrolle entfernen. Nie `/srv/noctua/data` mit Restore-/Importdaten entfernen.

### 2.2 Produktionsumgebung – erst Schlüssel, dann erster Start

**TODO [feat/team-auth Slices 3–6; feat/ui-shell Slice 7]:** Diese Umgebung ist das **Ziel nach Integration**, nicht kompatibel mit unverändertem Legacy-Auth. [U]s SESSION_SEAL_KEY ist dort ersetzt; kein Prod-SESSION_SEAL_KEY und keine Cookie-Credentials neu anlegen. Bestehende echte IMAP_SECRET_KEY behalten, wenn schon reale Daten verschlüsselt wurden. Dev-/Fixture-Daten und deren Schlüssel niemals übernehmen. Quellen [D] §8/§8.1, [A] Slice 6.

`/etc/noctua/noctua.env` mit `sudoedit` anlegen, anschließend `sudo chmod 0600 /etc/noctua/noctua.env`. Shell-kompatible `KEY=value`-Syntax ohne `export` verwenden:

```dotenv
NODE_ENV=production
HOSTNAME=127.0.0.1
PORT=3654
NOCTUA_DATA_DIR=/srv/noctua/data
NEXT_TELEMETRY_DISABLED=1
BETTER_AUTH_SECRET=<independent-random-secret-at-least-32-characters>
BETTER_AUTH_URL=https://mails.monkeymed.de
PASSKEY_RP_ID=mails.monkeymed.de
BETTER_AUTH_TELEMETRY=0
IMAP_SECRET_KEY=<independent-64-hex-key-or-preserved-existing-key>
IMAP_CREDENTIALS_STORAGE=db
TRUSTED_PROXY_HOPS=1
# Initial load / migration: off. Change to 1 only after counts pass.
NOCTUA_MAILBOX_WATCHER=0
NOCTUA_MAX_SYNC_WORKERS=1
NOCTUA_WATCHER_INTERVAL_MS=300000
NOCTUA_WATCHER_ACCOUNTS_INTERVAL_MS=30000
NOCTUA_WATCHER_RECONNECT_MIN_MS=60000
NOCTUA_SYNC_WORKER_TIMEOUT_MS=600000
# Intentionally UNSET: NOCTUA_TRUSTED_ORIGINS, NOCTUA_IMAP_LOGIN_HOSTS,
# NOCTUA_DESKTOP_MODE, BETTER_AUTH_TELEMETRY_ENDPOINT, SESSION_SEAL_KEY.
```

Erzeugung nur bei Neueinrichtung im privaten Terminal: zweimal **unabhängig** `openssl rand -hex 32`, direkt in die private Datei übernehmen, nicht hier/ins Journal kopieren. BETTER_AUTH_SECRET sichert auch TOTP-/Backup-Code-Verschlüsselung; beide Schlüssel offline verwahren. Kein Reset-SMTP-Environment nötig. Quellen [D] §8.1–8.2.

**Zusätzliche Code-Konfiguration, kein erfundenes Env:** Better Auth `trustedOrigins=["https://mails.monkeymed.de"]`, `advanced.ipAddress.ipAddressHeaders=["x-forwarded-for"]`, `advanced.ipAddress.trustedProxies=["127.0.0.1/32"]`, Origin/CSRF-Prüfungen aktiv. Caddy spricht Next explizit per IPv4-Loopback an. Diese Proxy-Einstellungen sind in [D] §4.6/§8.1 vorgeschrieben; im gelesenen `wt-team-auth/lib/betterAuth.ts` waren sie noch nicht vollständig verdrahtet. **TODO [feat/team-auth Slice 6]**: im finalen `doc/AUTHENTICATION.md` verifizieren, mit finaler Better-Auth-Version testen; `TRUSTED_PROXY_HOPS=1` allein konfiguriert Better Auth nicht. Optionaler IMAP-Personenlogin bleibt gemäß Haushaltsentscheidung **aus**.

**Prüfen:** Schlüssel-/Dateirechte ohne Ausgabe der Werte prüfen; Startup muss Cookie-/Desktopmode ablehnen. Nach §2.4 müssen gefälschtes XFF und fremder Origin die Rate-/Origin-Prüfung nicht umgehen. `/api/ba/ok` muss nach Slice 6 verfügbar sein. Canonical-URL/RP-ID auf beiden Geräten bestätigen. Nicht `systemctl show ... -p Environment` oder Shell `set -x` mit Secrets verwenden.

**Rollback:** Dienst stoppen; vorherige Env-Version zusammen mit zugehörigem Backup verwenden. Keine Schlüsselrotation als Fehlerbehebung improvisieren; bestehende Daten benötigen den passenden IMAP-/Auth-Schlüssel.

### 2.3 Systemweite App-Unit

**Schritt:** Folgendes später als `/etc/systemd/system/noctua.service` ablegen. System-Unit statt User-Unit: Start unabhängig von Login/Linger, eigenes Konto und klarer Stop aller Kinder. Die Dev-Units [DEV] bleiben separat. „Ein Prozess“ bedeutet ein dauerhafter App-Server; [W] benötigt weiterhin begrenzte Bun-Sync-Unterprozesse.

```ini
[Unit]
Description=Noctua production mail client
Wants=network-online.target
After=network-online.target
ConditionPathExists=/srv/noctua/current/app/server.js
StartLimitIntervalSec=300
StartLimitBurst=5

[Service]
Type=simple
User=noctua
Group=noctua
WorkingDirectory=/srv/noctua/current/app
EnvironmentFile=/etc/noctua/noctua.env
Environment=PATH=/opt/noctua/bin:/usr/local/bin:/usr/bin:/bin
ExecStart=/opt/noctua/bin/bun --bun server.js
Restart=on-failure
RestartSec=10s
KillMode=control-group
TimeoutStopSec=120s
UMask=0077
LimitNOFILE=65536
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=strict
ReadWritePaths=/srv/noctua/data
CacheDirectory=noctua
CacheDirectoryMode=0700
StandardOutput=journal
StandardError=journal
SyslogIdentifier=noctua

[Install]
WantedBy=multi-user.target
```

`CacheDirectory` ist im Schutzmodus automatisch schreibbar; Release-Assembly verlinkt `.next/cache` dorthin. Kein `MemoryDenyWriteExecute`: Bun benötigt JIT. Kein fester niedriger MemoryMax ohne Lastmessung großer Anhänge. Werte sind Betriebsvorschläge, Prozessmodell aus [W], Schutz-/Startmuster aus [DEV].

```bash
sudo systemd-analyze verify /etc/systemd/system/noctua.service
sudo systemctl daemon-reload
# Only after a release, environment, backups and auth gates are ready:
sudo systemctl enable --now noctua.service
systemctl is-active noctua.service
systemctl show noctua.service -p MainPID -p LimitNOFILE -p ControlGroup
ss -ltn '( sport = :3654 )'
```

**Prüfen:** Nur `127.0.0.1:3654`, MainPID ist Bun, keine zweite Produktionsinstanz. `journalctl -u noctua.service -n 80` privat lesen; frisch erzeugter Admin-Invite ist sensitiv. Start/Stop/Neustart einmal mit synthetischen Daten prüfen, keine verwaisten Worker.

**Rollback:** `sudo systemctl stop noctua.service`; vorheriges Release wie §3 aktivieren. Bei Unit-Fehler vorherige Unit-Datei zurückkopieren und daemon-reload; weder Dev- noch Fixture-Unit umschreiben.

### 2.4 Caddy, DNS-01 und bestehende Tailnet-Belegung

**Schritt A – Konflikt auflösen, bevor Caddy startet:** `tailscale serve status` und `ss -ltn` beweisen aktuell die Belegung von `100.92.134.1:443` durch den vorhandenen ts.net-Endpunkt → 4173. Dieser Endpunkt muss vorab nach abgestimmtem Plan auf einen freien Port oder separaten Tailnet-Host umziehen. Die kanonische URL erhält **keinen** Ausweichport. Beispiel **nur nach Bestätigung des Besitzers von 4173** und Prüfung von 8446:

```bash
tailscale serve status
tailscale serve status --json > /srv/noctua/migration/tailscale-serve-before.json
# Run the redirection changes as the existing Tailscale operator, not noctua.
tailscale serve --bg --https=8446 http://127.0.0.1:4173
curl -fsS https://remote-arm.tail31b4a1.ts.net:8446/ -o /dev/null
tailscale serve --https=443 off
ss -ltn '( sport = :443 )'
```

Die Sicherungsdatei als root in das geschützte Verzeichnis schreiben, falls der aktuelle Benutzer dort kein Schreibrecht hat (`sudo sh -c 'tailscale serve status --json > /srv/noctua/migration/tailscale-serve-before.json'`). Nicht `tailscale serve reset` verwenden; 3790 und bestehende Funnel-Webhooks bleiben bestehen. Quelle [H], lokale `tailscale serve --help`, [Tailscale-Doku](https://tailscale.com/docs/features/tailscale-serve). **Prüfen:** Verlegter Dienst funktioniert, 443 frei. **Rollback:** Caddy stoppen, `tailscale serve --bg --https=443 http://127.0.0.1:4173`; erst dann den neuen 8446-Endpunkt gezielt mit `tailscale serve --https=8446 off` entfernen. Die übrigen Serve-Pfade gegen Sicherung vergleichen.

**Schritt B – Providerbinary/Secrets vorbereiten:** Caddy mit `dns.providers.netcup` für ARM bauen/beschaffen und Version/Prüfsumme pinnen. Beispiel des Providerprojekts, später auszuführen, nicht hier installiert:

```bash
xcaddy build '<approved-caddy-version>' \
  --with 'github.com/caddy-dns/netcup@<approved-provider-commit>'
./caddy version
./caddy list-modules | rg '^dns.providers.netcup$'
```

Das klassische DNS von `monkeymed.de` benötigt die **Legacy**-Credentials. Caddy-Provider `NETCUP_API_KEY` muss den Wert von Dopplers **`NETCUP_LEGACY_API_KEY`**, nicht den neuen REST-/CloudDNS-Key enthalten; `NETCUP_API_PASSWORD` entspricht **`NETCUP_LEGACY_API_PASSWORD`**. Kundennummer entsprechend `NETCUP_CUSTOMER_NUMBER`. [N] Account 1 = `infra/prd_account1`. Über freigegebenen Secret-Workflow in `/etc/caddy/netcup.env` übertragen, root:root 0600, keine Schlüssel hier lesen oder loggen:

```dotenv
NETCUP_CUSTOMER_NUMBER=<legacy-customer-number>
NETCUP_API_KEY=<legacy-api-key-not-the-new-rest-key>
NETCUP_API_PASSWORD=<legacy-api-password>
```

Drop-in `/etc/systemd/system/caddy.service.d/netcup.conf` für eine vorhandene, geprüfte Caddy-System-Unit:

```ini
[Unit]
Wants=network-online.target
After=network-online.target tailscaled.service

[Service]
EnvironmentFile=/etc/caddy/netcup.env
LimitNOFILE=65536
Restart=on-failure
RestartSec=10s
```

Caddy läuft unter eigenem `caddy`-Konto, mit Bind-Capability für 443 und persistentem State unter `/var/lib/caddy` gemäß installierter Unit. Nicht unter dem App-Konto starten. DNS-Zugang bleibt außerhalb der App. Entscheidung für Caddy statt zusätzlichem ACME-Timer: Renewal und Proxy liegen in einem Dienst; DNS-01 benötigt keine öffentliche HTTP-Freigabe. Provider-Syntax/Propagation: [Caddy/netcup](https://github.com/caddy-dns/netcup); Secret-/API-Zuordnung [N].

**Kompression (Pflicht, 2026-10-23):** Die App schickt JSON-Antworten unkomprimiert (Listen-Seite großes Postfach 861 KB → gzip-5 50 KB; erste Zeilen bei 5 Mbit/s 1,6 s → 0,3 s). Im Site-Block `encode` mit expliziter Content-Type-Liste setzen, **nie `text/event-stream`** (SSE `/api/me/events`, `/imap/stream`). Snippet, Risiken und Prüfung: `briefs/switch-ideas/V3-report.md` §1. Go-live-Prüfung: Test-Mail und Collab-Ereignis kommen live durch Caddy an; `curl -sI -H "Accept-Encoding: gzip"` auf eine Listen-Abfrage zeigt `Content-Encoding`. Caddy liefert zugleich HTTP/2 (hebt das 6-Verbindungs-Limit für zwei SSE-Streams pro Tab auf).

**Prüfen:** Provider in installiertem Binary gelistet; beide Secretdateien nur root lesbar; Caddy-Unit-Statepfad und Schreibrechte geprüft. **Rollback:** Vorheriges Caddy-Binary/Drop-in zurück; bestehende Zertifikate behalten.

**Schritt C – `/etc/caddy/Caddyfile`:**

```caddyfile
{
    auto_https disable_redirects
    servers {
        timeouts {
            read_header 15s
            read_body 15m
            write 0
            write_idle -1s
            idle 5m
        }
    }
}

https://mails.monkeymed.de {
    bind 100.92.134.1
    tls {
        dns netcup {
            customer_number {env.NETCUP_CUSTOMER_NUMBER}
            api_key {env.NETCUP_API_KEY}
            api_password {env.NETCUP_API_PASSWORD}
        }
        propagation_delay 600s
        propagation_timeout 1200s
        resolvers 1.1.1.1 8.8.8.8
    }
    request_body {
        max_size 64MB
    }
    reverse_proxy 127.0.0.1:3654 {
        header_up Host mails.monkeymed.de
        header_up X-Forwarded-Host mails.monkeymed.de
        header_up X-Forwarded-Proto https
        header_up X-Forwarded-For {remote_host}
        header_up -Forwarded
        flush_interval -1
        transport http {
            dial_timeout 5s
            response_header_timeout 15m
        }
    }
}
```

64 MB ist ein vorgeschlagenes **gesamtes Requestlimit**, kein zugesagtes Anhangslimit: base64 benötigt ca. 4/3 der Rohdaten plus JSON/MIME; netcups SMTP-Grenze und Noctuas tatsächliche Route separat testen. 10-MB-Testanhang ist Pflicht; gewünschtes Maximum gemeinsam festlegen. API Route Handler sind nicht automatisch durch ein Server-Actions-Limit repariert. Quellen [R] §5.3/8, [C] `app/api/accounts/[accountId]/smtp/send/route.ts`, [request_body](https://caddyserver.com/docs/caddyfile/directives/request_body).

SSE `/api/accounts/[accountId]/imap/stream` und **TODO [feat/collab-ui]** `/api/me/events` dürfen nicht nach pauschal 60 s enden. Kein Responsebuffer, kein absoluter Write-/Streamtimeout; `response_header_timeout=15m` betrifft die erste Antwort, nicht die Lebenszeit eines geöffneten Streams. `write_idle -1s` deaktiviert auch das Idle-Write-Limit aktueller Caddy-Versionen; die ausgewählte Binärversion muss diese Syntax bei `validate` akzeptieren. Lange Send-Requests dürfen auf Proxyebene 15 min auf Antwort warten; die App hat eigene SMTP-Timeouts (standardmäßig Socket 60000 ms, Verbindung/Greeting/DNS je 10000 ms, siehe [C] `lib/mail/smtpTimeouts.ts`). Diese erst bei einem nachgewiesenen Bedarf über deren `SMTP_*_TIMEOUT_MS`-Variablen ändern. Keine automatische POST-Wiederholung nach unklarem SMTP-Ausgang. Vorschläge auf Basis [Caddy reverse_proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy), [globale Timeouts](https://caddyserver.com/docs/caddyfile/options), [D] §9. Kein Caddy-Access-Log aktivieren, solange Reset-Token-Pfad-/Query-Redaktion nicht nachgewiesen ist; auch App-Fehlerlogs darauf testen ([D] §4.4).

```bash
# Validate privately; don't print adapted JSON with resolved credential values.
sudo bash -c 'set -a; source /etc/caddy/netcup.env; set +a; caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile'
sudo systemctl daemon-reload
sudo systemctl enable --now caddy.service
ss -ltn '( sport = :443 or sport = :80 or sport = :3654 )'
curl --resolve mails.monkeymed.de:443:100.92.134.1 \
  -fsS https://mails.monkeymed.de/ -o /dev/null
openssl s_client -connect 100.92.134.1:443 -servername mails.monkeymed.de \
  -verify_hostname mails.monkeymed.de -verify_return_error </dev/null
```

**Prüfen:** Öffentlich vertrauenswürdiges Zertifikat mit SAN `mails.monkeymed.de`, keine TLS-Warnung auf beiden Telefonen. Netcup-Propagation kann lang dauern; im Wartungsfenster 20–30 min einplanen. Reguläres `curl https://mails.monkeymed.de/` ohne `--resolve` muss anschließend ebenfalls gelingen. Von außerhalb Tailnet ist Noctua unerreichbar; 3654 nur Loopback, kein öffentlicher Listener auf `130.61.177.119`. Nicht pauschal andere öffentliche Hostdienste abschalten. Tailnet-ACLs/Grants auf die beiden Personen/Administratoren begrenzen und mit fremdem Tailnet-Testgerät prüfen. Certificate-Renewal-Logs/Restlaufzeit überwachen; initiales Zertifikat plus Neustart beweisen noch keine spätere Renewal-Ausführung.

**Rollback:** Vorherige Caddyfile wiederherstellen/reload; bei Bindproblem Caddy stoppen und Schritt A zurückrollen. Kein MX-Rollback nötig. DNS A bleibt unverändert. Spätere öffentliche Bereitstellung ist ein eigener Change: Host-/Oracle-Firewall, Bind-Adresse, A/AAAA und Origin/IP-Tests neu prüfen; Hostname und RP-ID beibehalten, kein Noctua-Funnel jetzt.

### 2.5 Journald, Dateilimits und Monitoring

**Schritt:** App/Caddy nach journald loggen; vorgeschlagenes Host-Drop-in `/etc/systemd/journald.conf.d/60-noctua-retention.conf`:

```ini
[Journal]
Storage=persistent
SystemMaxUse=512M
RuntimeMaxUse=128M
MaxRetentionSec=14day
```

Dies betrifft das **gesamte Hostjournal**, nicht nur Noctua; vorhandene Hostpolicy vor Übernahme prüfen. Rotation erledigt journald, keine zweite logrotate-Regel für Journaldateien. [journald-Doku](https://www.freedesktop.org/software/systemd/man/latest/journald.conf.html). App-/Caddy-Limit 65536 aus den obigen Units ist ein Startvorschlag.

**Prüfen:** `journalctl --disk-usage`, `systemctl show noctua.service -p LimitNOFILE`, freier Platz täglich; nach Bootstrap Journalzugang als privilegierten Secretzugang behandeln. Reset-/Invite-/TOTP-Werte dürfen nicht in gewöhnlichen Logs auftauchen; [D] §4.4–4.5 fordert Redaktion, einzig Bootstrap-Invite hat den ausdrücklich vorgesehenen privaten Startup-Pfad.

**Rollback:** Drop-in zurücknehmen, Diensteinstellungen zurücksetzen; vorhandene Logs nicht zur Fehlerbehebung löschen. Journald-Neustart für Policyänderung nur im geplanten Host-Wartungsschritt.

## 3. Releases bauen, aktivieren und zurückrollen

### 3.1 Release-Gate und Build

**TODO [feat/team-auth Slices 3–6, feat/ui-shell Slice 7, feat/mailbox-watcher, feat/thread-collaboration, feat/collab-ui; ggf. feat/sender-identities]:** Erst einen geprüften Integrationscommit bauen, der [D] §1.1 erfüllt. Kein Deployment direkt aus einem Agenten-Worktree. Testnachweis nach [A] Slice 6/7 und [D] §8.2/§10: `test:ci`, relevante `test:stress`, Build, Standalone-Worker-Prüfung, Auth-Browserharness, gezieltes Lint, dokumentierter tsc-Baselinevergleich. Nicht hier ausgeführt. Browserharness und Phoneabnahme fehlen bis Slice 4/7; ausstehenden Nachweis als NO-GO behandeln.

**Schritt:** Sauberen Buildcheckout des freigegebenen SHA verwenden, `.env.local`/Fixture dort ausschließen. Produktionssecrets erst im Laufzeitdienst verwenden. Build-Env bei Bedarf mit synthetischen Schlüsseln, kanonischer URL und leerem Build-Datendir setzen, nie reales Datenverzeichnis. `bun install --frozen-lockfile`; das verändert nur den späteren Buildcheckout.

```bash
cd '<clean-release-build-checkout>'
test -z "$(git status --porcelain)"
test ! -e .env.local
export NEXT_TELEMETRY_DISABLED=1
export BETTER_AUTH_URL=https://mails.monkeymed.de
export PASSKEY_RP_ID=mails.monkeymed.de
export BETTER_AUTH_TELEMETRY=0
export IMAP_CREDENTIALS_STORAGE=db
export NOCTUA_MAILBOX_WATCHER=0
export NOCTUA_DATA_DIR="$PWD/.build-data"
# Synthetic BUILD ONLY values, never copy these to production.
export BETTER_AUTH_SECRET=build-only-synthetic-secret-000000000000000000000000
export IMAP_SECRET_KEY=0000000000000000000000000000000000000000000000000000000000000001
export APP_ENV_LABEL=Production
bun install --frozen-lockfile
bun --bun build-scripts/generateRuntimeConfig.ts
bun run test:ci
bun run build
```

`generateRuntimeConfig.ts` muss vor dem Public-Copy laufen; `bun run build` generiert es nicht selbst ([DEV], [C] `package.json`, `build-scripts/generateRuntimeConfig.ts`). Zusätzlich die im Release-Gate geforderten Tests/Browserchecks im sauberen Testkontext durchführen. Kein synthetisches `.build-data` ins Runtimepaket aufnehmen.

**Prüfen:** SHA/Bun-Version/Testergebnisse protokollieren, keine neuen undokumentierten Lint-/Typefehler. **Rollback:** Bei Buildfehler laufende Produktion unverändert lassen.

### 3.2 Standalone korrekt zusammensetzen

**Problem:** [DEV] findet `server.js` verschachtelt, aktuell z.B. `.next/standalone/code/noctua-mail/wt-deploy-dev/server.js`. Nur dessen Verzeichnis herauszukopieren kann übergeordnete `node_modules` verlieren. **TODO [Deployment-Integration / chore/mailplus-cutover]:** In `next.config.ts` `outputFileTracingRoot` explizit auf das Projektroot setzen (z.B. `path.resolve(__dirname)` mit `node:path`-Import), keine Workspace-Autodetektion. Bestehende `outputFileTracingIncludes` für Worker behalten. Die Fixzeile war beim Lesen noch nicht vorhanden. [C] `next.config.ts`, `build-scripts/workerRuntimeTraceFiles.ts`; [Next standalone-Doku](https://nextjs.org/docs/app/api-reference/config/next-config-js/output).

**Schritt:** Bis zum Fix die **gesamte** Standalone-Hierarchie kopieren und einen stabilen `app`-Link auf den gefundenen App-Pfad setzen. Nach dem Fix ist dieser Pfad `.`; Unit bleibt gleich. Folgendes als root in Bash ausführen; `BUILD` ersetzen:

```bash
set -euo pipefail
BUILD='<absolute-clean-build-checkout>'
cd "$BUILD"
mapfile -d '' -t servers < <(find .next/standalone -type f -name server.js \
  -not -path '*/node_modules/*' -print0)
test "${#servers[@]}" -eq 1
SA=$(dirname "${servers[0]}")
APP_REL=${SA#.next/standalone}
APP_REL=${APP_REL#/}
APP_REL=${APP_REL:-.}
RELEASE_ID="$(date -u +%Y%m%dT%H%M%SZ)-$(git rev-parse --short=12 HEAD)"
RELEASE="/srv/noctua/releases/$RELEASE_ID"
test ! -e "$RELEASE"
install -d -m 0755 "$RELEASE"
cp -a .next/standalone/. "$RELEASE/"
DEST="$RELEASE/$APP_REL"
install -d "$DEST/.next/static" "$DEST/public"
cp -a .next/static/. "$DEST/.next/static/"
cp -a public/. "$DEST/public/"
test -f "$DEST/server.js"
test -f "$DEST/scripts/runSyncJob.ts"
test -f "$DEST/tsconfig.json"
test ! -e "$RELEASE/app"
ln -s "$APP_REL" "$RELEASE/app"
if test -e "$DEST/.next/cache" || test -L "$DEST/.next/cache"; then
  mv "$DEST/.next/cache" "$DEST/.next/cache.build"
fi
ln -s /var/cache/noctua "$DEST/.next/cache"
git rev-parse HEAD > "$RELEASE/REVISION"
bun --version > "$RELEASE/BUN_VERSION"
printf '%s\n' "$APP_REL" > "$RELEASE/APP_PATH"
chown -R root:root "$RELEASE"
chmod -R go-w "$RELEASE"
```

Provider-/Bun-Binary separat versionieren; `BUN_VERSION` allein enthält nicht die ausführbare alte Version. Read/Execute-Rechte für `noctua` prüfen. Keine `.env*`-Secrets in den Releasebaum kopieren. Die Bestandsprüfung `build-scripts/verifyStandaloneWorkerBuild.ts` erwartet **flaches** `.next/standalone`; bis TracingRoot-Fix ist ihr Fehlschlag nicht „bestanden“. Nach dem Fix `bun --bun build-scripts/verifyStandaloneWorkerBuild.ts` ausführen; kompletter `test:standalone-workers` baut nochmals. Ein Runtime-Smoketest mit synthetischer Mailbox muss TS-Imports, `@/`-Auflösung, MIME-Abhängigkeiten, Datenzugriff und Cachelink aus dem **Release**, nicht aus dem Checkout, nachweisen. Quellen [C] `build-scripts/verifyStandaloneWorkerBuild.ts`, `lib/workers/entrypoints.ts`, [U] „Standalone“.

**Prüfen:** Server, statische Assets, Public-Dateien, Worker und externe Dependencies vorhanden; unabhängige Testdaten, anderer Port (z.B. 3785), keine Produktiv-IMAP-Zugangsdaten. [A] Slice 6 verlangt Produktionsbuild-Smoke und zweiten Start.

**Rollback:** Fehlendes Paket nicht aktivieren; unvollständigen neuen Releasebaum nach Kontrolle entfernen. Laufender Build bleibt bestehen.

### 3.3 Aktivierung, Healthcheck, N Builds

**Schritt:** Wartungsfenster, User abmelden/Schreibstopp. **Vor** Start neuer Schema-/Auth-Version §6-Backup und Release-/Env-/Bun-Zuordnung sichern. [D] §8.2 erlaubt hier keine parallelen Schema-Upgrader. Für erste Aktivierung `previous` überspringen; später:

```bash
sudo systemctl stop noctua.service
# Run and verify the pre-deploy backup from section 6 now.
# Set the exact assembled release; don't use "latest" from an unreviewed list.
RELEASE='/srv/noctua/releases/<approved-id>'
test -f "$RELEASE/app/server.js"
if test -L /srv/noctua/current; then
  OLD=$(readlink -f /srv/noctua/current)
  sudo ln -s "$OLD" /srv/noctua/previous.new
  sudo mv -Tf /srv/noctua/previous.new /srv/noctua/previous
fi
sudo ln -s "$RELEASE" /srv/noctua/current.new
sudo mv -Tf /srv/noctua/current.new /srv/noctua/current
sudo systemctl start noctua.service
systemctl is-active noctua.service
curl -fsS -H 'Host: mails.monkeymed.de' http://127.0.0.1:3654/ -o /dev/null
curl -fsS https://mails.monkeymed.de/ -o /dev/null
curl -fsS https://mails.monkeymed.de/api/ba/ok
```

**Prüfen:** `/` ist laut [U] der vorhandene HTML-Livenesscheck, kein DB/IMAP-/Auth-Gesundheitsnachweis. Nach Slice 6 zusätzlich `/api/ba/ok`, persönlicher MFA-Login, `/api/auth/me`, Rollen, eine synthetische Lese-/Sendefunktion und Watcherstatus prüfen. Keine erfundene `/healthz`-Route. `journalctl -u noctua.service --since '10 minutes ago'` privat lesen. SSH-Verbindung schließen und Dienstfunktion weiter prüfen; System-Unit soll ohne Userlogin laufen.

**Rollback ohne Schemabruch:** Dienst stoppen, `readlink -f /srv/noctua/previous` prüfen, `current.new` auf diesen Pfad setzen und atomar über `current` verschieben, passende Bun-/Env-Version auswählen, Dienst starten und gleiche Checks. **Mit Schemaänderung/unklarer Rückwärtskompatibilität:** erst aktuelle Daten nochmals sichern, dann **gemeinsam** passenden Pre-Deploy-Datenstand, Secrets und Build nach §6 zurückspielen. Nur den Code zurückzusetzen ist kein sicherer Schema-Rollback. Neue Kommentare/Zuweisungen seit Backup sonst verloren; separat sichern und fachlich abgleichen. Quellen [D] §8, [R] §2.18.

**Retention:** N=5 freigegebene Releases samt Binärversion, mindestens 30 Tage plus letzter nachweislich restaurierbarer Schemastand. Erst nach erfolgreichem Nachtbackup und Abnahme manuell alte Builds löschen; `current`, `previous` und das Release zum letzten Restorepunkt ausschließen. Zero-downtime ist nicht erforderlich.

## 4. Datenmigration: MailPlus → netcup → Noctua

### 4.1 Reihenfolge und POP3-Falle – verbindlich

**Schritt:** Vor **jedem INBOX-Import und vor Noctua-Accountanlage**: MailPlus noch einmal manuell alle POP3-Konten abholen lassen; Uhrzeit/Keep-/Delete-Modus dokumentieren, pro Konto den Abruf **und** den globalen POP3-Abruf deaktivieren. NAS-MailPlus danach als ruhende Quelle/Archiv nutzen. MailPlus-Senden/Regeländerungen im finalen Fenster stoppen. Vorherige Vorabkopien dürfen ausschließlich nicht-INBOX-Ordner betreffen, etwa mit `--exclude '^INBOX$'`; dies im Dry-run überprüfen. Quellen [R] §5.0, [D] §11.2/5.

Importierte Nachrichten bekommen neue POP3-UIDLs. Ein wieder aktivierter Abruf kann sie erneut herunterladen und im Delete-Modus bei netcup löschen; Noctua spiegelt diese Löschung. „Erst nach finalem Delta POP3 aus“ wäre zu spät. **MX bleibt bei netcup; keine DNS-/MX-Umschaltung gehört zur Mailmigration.** `mail.monkeymed.de` und `mails.monkeymed.de` unterscheiden. Vier Domain-MX vorab dokumentieren ([H], [D] §11, [C] `lib/syncOperation.ts`, `app/api/accounts/[accountId]/imap/stream/route.ts`).

**Prüfen:** Screenshots/Export der deaktivierten Einzelabrufe und globalen Einstellung, mindestens zwei frühere Pollintervalle lang kein POP3-Abruf im NAS-Log; neue externe Testmail bleibt in netcup liegen. MailPlus-Historie und gesendete Mail auf NAS vorab gesichert, zugehörige Quotas ausreichend.

**Rollback:** Vor erstem Import kann ursprünglicher Abruf wieder eingeschaltet werden. Nach Import standardmäßig **POP3 aus lassen**, netcup-Webmail/anderer IMAP-Client als Ersatz. Nur bewusstes Keep-copy-Verfahren nach Archiv-/Duplikatprüfung wäre ein Rückweg; keine massenhafte INBOX-Löschung als automatischer Rollback.

### 4.2 imapsync vorbereiten und Ordnerabbildung abnehmen

**Schritt:** imapsync auf einem LAN-Rechner mit NAS-Zugriff ausführen; keine NAS-Ports ins Internet öffnen. Je echter Zielmailbox NAS-Ownerlogin bestimmen. Shared-Präfixe auf persönlichen Läufen ausschließen, gemeinsame Mail genau einmal aus Owner-Sicht kopieren. Source-/Target-Passwörter in zwei geschützten Dateien 0600 auf diesem Rechner speichern, nicht `--password1/2` als Kommandoargument. Toolversion und Optionen zuerst lesen:

```bash
imapsync --version
imapsync --help | less
umask 077
install -d -m 0700 "$HOME/noctua-migration"
# Populate these files privately; each contains one password line.
test -s "$HOME/noctua-migration/nas.pass"
test -s "$HOME/noctua-migration/netcup.pass"
chmod 0600 "$HOME/noctua-migration/"*.pass
```

Ordnernamen sind Beispiele, **kein** Netcup-Namensversprechen. Exakten Namespace und Delimiter aus §1.3 nehmen. Je Zeile **einen tatsächlich vorhandenen** Quellpfad auswählen; nicht alle Übersetzungen zusätzlich erzeugen.

| Zweck | Mögliche MailPlus-Quellnamen | Ziel: genau ermittelter netcup-Pfad | Beispielargument nach Bestätigung |
|---|---|---|---|
| Eingang | `INBOX` | `INBOX` | unverändert |
| Gesendet | `Sent`, `Sent Items`, `Sent Messages`, `Gesendet`, `Gesendete Elemente` | `<netcup-sent>` mit `\Sent` | `--f1f2 'Gesendet=Sent'` |
| Entwürfe | `Drafts`, `Entwürfe`, `Entwuerfe` | `<netcup-drafts>` | z.B. `--f1f2 'Entw&APw-rfe=Drafts'`, falls Listing dieses IMAP-UTF-7 liefert |
| Papierkorb | `Trash`, `Deleted Items`, `Papierkorb` | `<netcup-trash>` | `--f1f2 'Papierkorb=Trash'` |
| Spam | `Junk`, `Spam`, `Junk-E-Mail` | `<netcup-junk>` | `--f1f2 'Spam=Junk'` |
| Archiv | `Archive`, `Archives`, `Archiv` | `<netcup-archive>` | `--f1f2 'Archiv=Archive'` |
| Filterablage | MailPlus-only Pseudopostfach/Ordner | Unterordner der echten Zielmailbox | separater geprüfter Lauf, z.B. `--subfolder2 'Legacy/Filtername'` |

`--f1f2` ist laut Tool ein 1:1-Mapping vollständiger Pfade; mehrere alte Sent-Ordner nicht ungetestet auf denselben Zielordner legen. Für Umlaute die **linke, für CLI bestimmte Spalte** des imapsync-Listings übernehmen, nicht blind den rechts angezeigten UTF-8-Namen; je Server/Protokoll kann modified UTF-7 nötig sein. Zusätzliche Altordner ggf. zunächst unter `Legacy/...` erhalten, später kontrolliert mergen. Shared-ACLs und MailPlus-Labels werden dadurch nicht in Noctua-Mitgliedschaften/Topics umgewandelt. Quellen [D] §11.1/5, [R] §5.4, [imapsync Ordner-Mapping](https://imapsync.lamiral.info/FAQ.d/FAQ.Folders_Mapping.txt).

Template in Bash; alle Pfade/Namen aus Inventar ersetzen:

```bash
set -euo pipefail
NAS_IMAP='<nas-imap-hostname-matching-certificate>'
NAS_USER='<mailplus-owner-login>'
TARGET_USER='<actual-netcup-login>'
MIG="$HOME/noctua-migration"
common=(
  --host1 "$NAS_IMAP" --port1 993 --ssl1
  --user1 "$NAS_USER" --passfile1 "$MIG/nas.pass"
  --host2 mxf9a0.netcup.net --port2 993 --ssl2
  --user2 "$TARGET_USER" --passfile2 "$MIG/netcup.pass"
  --sslargs1 SSL_verify_mode=1 --sslargs1 "SSL_verifycn_name=$NAS_IMAP"
  --sslargs2 SSL_verify_mode=1 --sslargs2 SSL_verifycn_name=mxf9a0.netcup.net
  --syncinternaldates --useheader Message-Id --addheader
  --noexpunge1 --noexpunge2
)
maps=(
  --f1f2 '<actual-source-sent>=<actual-target-sent>'
  --f1f2 '<actual-source-drafts>=<actual-target-drafts>'
  --f1f2 '<actual-source-trash>=<actual-target-trash>'
  --f1f2 '<actual-source-junk>=<actual-target-junk>'
  --f1f2 '<actual-source-archive>=<actual-target-archive>'
)
# On PERSONAL runs only; replace with the exact anchored shared namespace.
# excludes=(--exclude '^<escaped-shared-prefix>')
excludes=()
imapsync "${common[@]}" "${maps[@]}" "${excludes[@]}" \
  --dry --justfolders --logfile "$MIG/folders-dry.log"
imapsync "${common[@]}" "${maps[@]}" "${excludes[@]}" \
  --dry --logfile "$MIG/messages-dry.log"
```

TLS-Verifikation über die installierte IO::Socket::SSL-/imapsync-Version kontrollieren; bei privater NAS-CA deren vertrauenswürdige CA hinzufügen, nicht `SSL_verify_mode=0`. Dry-run darf nichts übertragen/Ordner erzeugen. Prüfen, dass persönliche Shared-Pfade wirklich ausgeschlossen und `--subfolder2` nicht versehentlich auf die komplette Hauptmailbox angewendet sind. Sources mit fehlendem/mehrdeutigem Message-ID vorab untersuchen: Header-basierte Erkennung kann Duplikate anders behandeln als Quellanzahl; `--addheader` hilft identifikationslosen Nachrichten, erhält aber keine alten UIDs. Quellen [imapsync Duplikaterkennung](https://imapsync.lamiral.info/FAQ.d/FAQ.Duplicates.txt), [imapsync README](https://imapsync.lamiral.info/README), [D] §11.5.

**Prüfen:** Dry-run-Ordnerliste pro Account unterschreiben; netcup vor/nach Probe unverändert. Mit kleiner repräsentativer Mailbox zuerst Testimport und zweite Ausführung auf Idempotenz prüfen. Keine `--delete*`, `--expunge*`, `--delete2duplicates` oder ungeprüfte automatische Deduplizierung verwenden.

**Rollback:** Dry-run benötigt keinen Rückweg. Bei echtem Testimport Logs/übertragene IDs erhalten, weitere Läufe stoppen; Quellbestand bleibt unberührt. Falsch importierte Zielmail nur gezielt nach Sicherung und Prüfung entfernen, nicht die ganze Ziel-INBOX leeren.

### 4.3 Erstlauf, Delta und Zählvergleich

**Schritt:** Nach bestätigtem POP3-Aus und MailPlus-Schreibstopp das freigegebene Template **ohne `--dry`** ausführen, eine Mailbox nach der anderen. Jeder Run eigenes Log, anschließend identischer zweiter Lauf. Beispiel in derselben Bash mit den Arrays aus §4.2:

```bash
imapsync "${common[@]}" "${maps[@]}" "${excludes[@]}" \
  --logfile "$MIG/import-$(date -u +%Y%m%dT%H%M%SZ).log"
imapsync "${common[@]}" "${maps[@]}" "${excludes[@]}" \
  --logfile "$MIG/delta-$(date -u +%Y%m%dT%H%M%SZ).log"
```

UIDs/UIDVALIDITY ändern sich am Ziel; weder Noctua-IDs noch alte POP3-UIDLs übertragen. INTERNALDATE soll erhalten bleiben, Flags wie Seen/Answered/Flagged nach Serverunterstützung; benutzerdefinierte Labels/ACLs nicht voraussetzen. Auch `\Deleted` ist ein Flag: roh gezählte Nachrichten und sichtbare Nachrichten können deshalb abweichen. Belege: [imapsync Flags](https://imapsync.lamiral.info/FAQ.d/FAQ.Flags.txt), [C] `lib/messageIds.ts`, `lib/syncOperation.ts`.

**Prüfen:** Exitcode 0, keine Transferfehler/unidentified messages, zweiter Run bei ruhender Quelle null neue Transfers. Pro gemapptem Ordner source-/target-Zahlen sowie Datum/älteste und neueste Nachricht, Flagproben, Anhänge und Sent-Beispiele prüfen; neu eingegangene Zielmail separat erklären. Message-ID-Duplikate bewusst dokumentieren, keine pauschale Gleichsetzung „gleich viele Bytes = korrekt“. Zählprotokoll:

| Account | Sourcefolder → Targetfolder | Quelle MESSAGES / UNDELETED | Ziel vorher | Übertragen / bereits vorhanden | Ziel nachher MESSAGES / UNDELETED | Noctua rows / visible | Erklärung / Sign-off |
|---|---|---|---|---|---|---|---|
| `<id>` | `<mapping>` | | | | | | |

Mit `EXAMINE "<folder>"`, `UID SEARCH ALL`, `UID SEARCH UNDELETED` bzw. einem read-only IMAP-Client zählen; nicht SELECT+EXPUNGE einsetzen. Bei Zusammenführung mehrerer Quellordner und vorbestehender Zielmail zählt die dokumentierte vereinigte Menge, nicht blind Source=Target. Details aus [D] §11.5/7, [R] §5.7.

**Delta Tag 1/7:** Nach Produktivstart nur bei tatsächlichen Nachzüglern; vorab Dry-run, dann **`--noresyncflags`** ergänzen. Sonst würde der standardmäßige Flags-Resync neue Gelesen-/Answered-Zustände am Ziel mit altem MailPlus-Stand überschreiben. Bewegte Zielnachrichten können durch erneuten Ordnerimport als Duplikate zurückkommen: Unterschiede erst erklären, im Zweifel nur benannte fehlende Ordner/Nachrichten übertragen. Quelle [imapsync README, flags](https://imapsync.lamiral.info/README).

**Rollback:** Import abbrechen/pausieren, Logs sichern und korrigiertes Mapping erneut dry-run. Keine Rücksynchronisation netcup→MailPlus mit Löschoptionen. Netcup-Webmail bleibt arbeitsfähig; Original NAS bleibt Archiv.

**Zeitplanung für ~10 GB:** reine Transferuntergrenze bei 10/50/100 Mbit/s etwa 2 h 13 min / 27 min / 13 min; IMAP-Roundtrips, große Ordner, Quoten und MIME-Verarbeitung kommen hinzu. Als vorläufiges Fenster 2–12 h für den Upload plus zusätzliche Stunden für vollständige Noctua-Syncs, einen ganzen ruhigen Tag reservieren. Das ist eine Planungsschätzung, kein Benchmark. Erst 0.5–1 GB repräsentativ testen, gemessene Nachrichten/s und GB/h auf den Bestand hochrechnen; bei vielen kleinen Nachrichten eher Nachrichtenrate verwenden. [R] §5 verlangt explizite Full-Syncs; [W] weist auf Parser-RAM hin.

### 4.4 Vollständiger lokaler Sync **je Ordner**

**Voraussetzung:** Accounts aus §5 vorhanden, imapsync beendet, Browser geschlossen, `noctua.service` gestoppt und alle Kinder beendet. Watcher=0. CLI ist lokales Operatorrecht; kein zweiter App-Prozess. Direkter `runSyncJob.ts`-Aufruf umgeht die Queue-Zulassung, daher **streng seriell**, Worker-Cap allein schützt diesen Operatorpfad nicht. Auf dem Release benutzen, nicht wechselnd auf einem Worktree. Quellen [C] `scripts/runSyncJob.ts`, `lib/workers/runSyncJob.ts`, [W] Worker-Leases.

Ein einzelner tatsächlicher Ordner:

```bash
sudo systemctl stop noctua.service
sudo systemd-run --wait --pipe --collect --unit=noctua-fullsync \
  --property=User=noctua --property=Group=noctua \
  --property=WorkingDirectory=/srv/noctua/current/app \
  --property=EnvironmentFile=/etc/noctua/noctua.env \
  --setenv=PATH=/opt/noctua/bin:/usr/local/bin:/usr/bin:/bin \
  --property=UnsetEnvironment=NOCTUA_MAILBOX_WATCHER \
  /opt/noctua/bin/bun --bun scripts/runSyncJob.ts \
  '{"accountId":"<real-account-id>","folderId":"<real-account-id>:INBOX","mode":"full","fullSync":true}'
```

Für Sent und **jeden** importierten Ordner wiederholen. Nicht nur den UI-Erstsync benutzen: INBOX voll, sonst typischerweise 30 Tage; Watcher liefert historische andere Ordner ebenfalls nicht automatisch nach. API-Alternative ist `POST /api/accounts/<id>/sync` mit `{folderId,mode:"full",fullSync:true}` und anschließend `GET /api/accounts/<id>/sync/status?jobId=…`; persönlich autorisierte Cookies, kanonischer Origin und nach Slice 3 aktuelle Rolle erforderlich. HTTP 202 ist nur Annahme, nicht Abschluss. Parent-Workerdeadline standardmäßig 600000 ms; keine fertige Syncmeldung behaupten, wenn der Worker abgebrochen wurde. Quellen [C] `app/api/_helpers/syncJobs.ts`, `app/api/accounts/[accountId]/sync/status/route.ts`, [W] Env-Tabelle.

Für ca. zwölf Mailboxen den Plan ohne Secrets aus der tatsächlichen Master-/Shardstruktur generieren. Erst INBOX jedes Accounts ausführen, damit Ordnerliste entdeckt wird, danach kompletten Plan erzeugen. Folgende Python-Phase schreibt nur JSON-Payloads, keine Datenbank:

```bash
# Write a private plan file; this block does not modify the databases.
sudo bash -c 'umask 077; exec python3 - > /srv/noctua/migration/inbox-plan.jsonl' <<'PY'
import json, sqlite3
from pathlib import Path
p = Path('/srv/noctua/data/db/main.db')
db = sqlite3.connect(p.as_uri() + '?mode=ro', uri=True)
for (aid,) in db.execute('SELECT id FROM accounts ORDER BY id'):
    print(json.dumps(dict(accountId=aid, folderId=aid+':INBOX', mode='full', fullSync=True)))
PY
```

Plan jeweils so seriell ausführen (zuerst `inbox-plan.jsonl`, später `folders-plan.jsonl`). `UnsetEnvironment` entfernt den Watcherflag nach Einlesen der Env-Datei; ein einfaches `--setenv=…=0` würde von `EnvironmentFile` mit möglicherweise schon gesetztem `1` überschrieben ([systemd.exec](https://www.freedesktop.org/software/systemd/man/latest/systemd.exec.html), EnvironmentFile/UnsetEnvironment):

```bash
sudo bash <<'SH'
set -euo pipefail
while IFS= read -r payload; do
  systemd-run --wait --pipe --collect --unit=noctua-fullsync \
    --property=User=noctua --property=Group=noctua \
    --property=WorkingDirectory=/srv/noctua/current/app \
    --property=EnvironmentFile=/etc/noctua/noctua.env \
    --setenv=PATH=/opt/noctua/bin:/usr/local/bin:/usr/bin:/bin \
    --property=UnsetEnvironment=NOCTUA_MAILBOX_WATCHER \
    /opt/noctua/bin/bun --bun scripts/runSyncJob.ts "$payload"
done < /srv/noctua/migration/inbox-plan.jsonl
SH
```

Danach vollständigen Ordnerplan generieren und den Dateinamen im obigen Loop durch `folders-plan.jsonl` ersetzen:

```bash
sudo bash -c 'umask 077; exec python3 - > /srv/noctua/migration/folders-plan.jsonl' <<'PY'
import json, sqlite3
from pathlib import Path
from urllib.parse import quote
base = Path('/srv/noctua/data')
def ro(p):
    return sqlite3.connect(Path(p).as_uri() + '?mode=ro', uri=True)
master = ro(base/'db/main.db')
for aid, path in master.execute('SELECT id, dbPath FROM accounts ORDER BY id'):
    shard = Path(path) if path else base/'db/accounts'/(quote(aid, safe="~()*!.'-")+'.db')
    if not shard.is_absolute() or not shard.is_file():
        raise SystemExit('Review missing/relative shard path for '+aid)
    db = ro(shard)
    for (fid,) in db.execute('SELECT id FROM folders WHERE accountId=? ORDER BY id', (aid,)):
        print(json.dumps(dict(accountId=aid, folderId=fid, mode='full', fullSync=True)))
    db.close()
PY
```

Die Fallback-Pfadkodierung entspricht `encodeURIComponent`; vorhandenes `accounts.dbPath` hat Vorrang. Vor Ausführung Plan mit dem IMAP-LIST-Inventar vergleichen, `\Noselect`-Container ausschließen und sämtliche importierten selektierbaren Ordner abdecken. Nicht auf Anzeigenamen raten. Quellen [C] `lib/runtimePaths.ts`, `lib/db/connection.ts`, `lib/db/folders.ts`.

**Prüfen:** Jeder CLI-Run Exit 0 **und** abschließende `__noctua_sync_result__:`-Zeile ([C] `lib/workers/syncProtocol.ts`). Retries nutzen nur im laufenden CLI-Prozess den höchsten verarbeiteten UID-Checkpoint bei `fullSync:true`; nach Prozessabbruch ist dieser nicht automatisch dauerhaft als Fortsetzungsplan gespeichert. Erneuten Full-Sync oder bewusst `resumeFromUid` erst nach Fehleranalyse nutzen. Kein Watcher parallel.

Zählabfrage auf dem **tatsächlichen** Shard, je Account-ID ersetzen; bei `deleted` sowohl rohe als auch sichtbare Werte dokumentieren:

```bash
sqlite3 -readonly '<actual-shard-path>' <<'SQL'
.headers on
.mode column
SELECT f.id, COUNT(m.id) AS rows,
       SUM(CASE WHEN m.id IS NOT NULL AND COALESCE(m.deleted,0)=0 THEN 1 ELSE 0 END) AS visible,
       SUM(CASE WHEN m.id IS NOT NULL AND COALESCE(m.deleted,0)=0 AND m.unread=1 THEN 1 ELSE 0 END) AS unread
FROM folders f LEFT JOIN messages m ON m.folderId=f.id AND m.accountId=f.accountId
WHERE f.accountId='<actual-account-id>'
GROUP BY f.id ORDER BY f.id;
SQL
```

Mit NAS/netcup-Tabelle aus §4.3 vergleichen; bei Mismatch zuerst vollständigen Abschluss, Foldermapping, neue Zielmail und Deleted-Filter prüfen. Die alte `diagnoseSyncState.ts` deckt primär INBOX ab und ersetzt die Tabelle nicht ([R] §5.7, [C] `lib/db/schema.ts`, `lib/db/folders.ts`).

**Rollback:** CLI mit `sudo systemctl stop noctua-fullsync.service` beenden, auf Exit warten. Remote-Mail wird durch diesen lokalen Indexaufbau nicht aus der NAS gelöscht; bestehende lokale Daten vor Reparatur sichern. Kein manuelles Leeren von Shards mit Kollaborationsdaten. Erst nach bestandenen Counts Watcher=1 setzen und App starten; **TODO [feat/mailbox-watcher + team-auth Slice 3/6 Integration]**. Verifikation: alle Accounts idling/erwarteter Zustand, neue Testmail auch bei geschlossenen Browsern und Sent-Aktualisierung nach Öffnen sichtbar. Rückweg: Watcher=0 und Neustart.

## 5. Personen, Faktoren und Postfächer in Noctua

### 5.1 Auth aktivieren / Altinstallation migrieren

**TODO [feat/team-auth Slice 6]:** Bei bestehender **realer** Noctua-Installation vor Aktivierung Master/Shards/Keys sichern; `scripts/migrateTeamAuth.ts` soll stabile IDs, bestehende Mitgliedschaften, Rollen, gewählte Passwort-Hashes und Deaktivierungen übernehmen sowie alte Cookies/MCP-Tokens entwerten. Case-/Whitespace-Duplikate und Shared-Address-User manuell auflösen. Das Script war noch nicht vorhanden; **keine erfundenen CLI-Flags ausführen**. Nach Umsetzung `bun scripts/migrateTeamAuth.ts --help` und `doc/AUTHENTICATION.md` lesen, explizite Mappingdatei prüfen, Migration an Kopie zweimal testen. Frische Produktion aus leerem Datendir braucht keine Übernahme von Fixture-Benutzern. Quellen [D] §8, [A] Slice 6.

**Prüfen:** Backend `/api/ba/ok` verfügbar, kein 503; alte Sessions ungültig; zwei Starts und idempotenter Migrationstest dokumentiert. **Rollback:** Gesamten Pre-Migration-Daten-/Key-/Buildsatz restaurieren, keine halbe Tabellenmigration rückwärts per SQL improvisieren.

### 5.2 Erster Admin und zweite Person

**TODO [feat/team-auth Slices 4–6; feat/ui-shell Slice 7; Admin-UI feat/collab-ui]:** Ersten Start privat verfolgen. Bei leerer Users-Tabelle erscheint der **Admin-Invite-Code** im Startup-Journal (`[C] lib/db/schema.ts`, [D] §4.3); nur lokal lesen und der ersten Person persönlich geben:

```bash
sudo journalctl -u noctua.service -b --no-pager | rg 'Admin invite code'
```

1. An `https://mails.monkeymed.de` Signup mit Invite, persönlicher E-Mail, Name und **selbst gewähltem App-Passwort**. Vertrag: `POST /api/auth/signup` JSON `{inviteCode,email,password,name,account?}`. Passwort 10–256 Zeichen; Mailboxcredentials sind eigene Felder und nicht das App-Passwort. Am einfachsten ohne `account` bootstrappen, dann MFA und Mailboxanlage getrennt. Kein vorhandenes IMAP-Passwort darf ohne Invite Admin werden.
2. Admin durchläuft eingeschränkte MFA-Einrichtung: Passwortnachweis → TOTP-QR → echten aktuellen Code prüfen → Backup-Codes einmal anzeigen und offline sichern → Passkey hinzufügen. Vorher kein Maildatenzugriff. TOTP ist verpflichtend auch bei späterem Passkey-Login; es muss nicht zusätzlich zu jeder UV-Passkey-Anmeldung abgefragt werden ([D] §4.1/§4.4).
3. Admin erstellt **zielgebundenen Single-use-Invite**, kein fremdes Passwort. Vertrag `POST /api/admin/users` `{email,name,role:"user"}`. Die autorisierte Antwort zeigt den Invite einmal für persönliche Übergabe. Zweite Person löst ihn über denselben Signup ein, wählt ihr Passwort und richtet eigene Faktoren ein. Generic-Invite-Verwaltung über `/api/admin/invites` ersetzt nicht den Slice-5-Nachweis für zielgebundenes Onboarding.

Die genannten POST-Verträge sind **Design**, noch keine bestätigten produktiven Endpunkte; im gelesenen Auth-Stand existiert bei `/api/admin/users` nur GET und Signup ist 503. Keine alten „Admin erzeugt temporäres Passwort“-Schritte übernehmen. Quellen [D] §4.3/§4.5, [A] Slices 5–7, `wt-team-auth/app/api/admin/users/route.ts`.

**Prüfen:** Beide Personen melden sich unabhängig an; ohne fertige TOTP-Verifikation nur Enrollment. Invite-Wiederverwendung und falsche Zieladresse schlagen fehl; erste Person Admin, zweite regulärer User, keine gemeinsam genutzte Appidentität.

**Rollback:** Bei unvollständigem Provisioning Slice-5-Reconciliation verwenden; keine manuelle Invite-/User-Reparatur auf live DB. Vor produktiver Nutzung frischen Setupstand notfalls vollständig aus Backup zurücknehmen; NAS bleibt unberührt.

### 5.3 TOTP und Passkeys auf Telefonen und Desktops

**TODO [feat/team-auth Slice 4/6; feat/ui-shell Slice 7]:** TOTP pro Person einrichten; bei mehreren gewünschten Authenticator-Geräten denselben neuen Seed nur während der erstmaligen autorisierten Einrichtung auf den eigenen Geräten registrieren, danach keine Seed-Exportfunktion erwarten. Geräteuhren automatisch synchronisieren. Pro Person mindestens einen Passkey am Telefon und einen am Desktop beziehungsweise geprüften synchronisierten Passkey registrieren. Neue Faktoren brauchen frischen Nachweis nach [D] §4.4; reine Session reicht nicht.

**Prüfen:** rpID exakt `mails.monkeymed.de`, HTTPS-Origin exakt `https://mails.monkeymed.de`; auf beiden Telefonen (tatsächliche Systeme vorher bestätigen) PWA installieren, Passwort+TOTP und UV-Passkey testen. Desktopbrowser ebenfalls testen. Preview `remote-arm.tail31b4a1.ts.net:3790` verwendet andere Daten/Origin/RP-ID und kann **keine** kanonischen Passkeys übernehmen. Login, Mailboxwechsel, Lesen, Antworten, Kameraanhang und separaten Compose-Dialog testen. Echte Telefonabnahme ersetzt kein virtueller WebAuthn-Test. Quellen [D] §8.1/§1.1 Fit 10, [A] Slice 7.

**Rollback:** Fehlerhaften neuen Passkey über nachweisgeschützte Security-UI entfernen, vorher funktionierende Faktoren behalten. Bei verlorenem Telefon Recovery aus §5.5; verpflichtende MFA nicht abschalten.

### 5.4 ~12 Mailboxen, acht gemeinsame: Ownership vor Mitgliedschaften

**TODO [feat/team-auth Slice 3/6; Managementoberfläche feat/collab-ui]:** Jede Person legt ihre persönlichen Mailboxen selbst über „Add mailbox“ / `POST /api/accounts` neu an. Dadurch entsteht deren `ownerUserId`; nicht alle privaten Mailboxen vorab ownerlos als Admin anlegen. Keine andere Person bekommt dort Mitgliedschaft, sofern nicht ausdrücklich vereinbart. Admin bleibt laut Design dennoch ein privilegierter Accountverwalter. Quellen [D] §5.3–5.4, [R] §5.5.

IMAP/SMTP je Mailbox mit tatsächlichem Login, `secure:true`, `mxf9a0.netcup.net:993` und `mxf9a0.netcup.net:465`. Passwort encrypted in DB, `IMAP_CREDENTIALS_STORAGE=db`. Schemabeispiel für Accountanlage (nicht direkt mit Klartextsecrets in Shellhistory posten):

```json
{
  "name": "<customer-facing-display-name>",
  "email": "<actual-mailbox-address>",
  "avatar": "",
  "imap": {"host":"mxf9a0.netcup.net","port":993,"secure":true,"user":"<actual-login>","password":"<secret>"},
  "smtp": {"host":"mxf9a0.netcup.net","port":465,"secure":true,"user":"<actual-login>","password":"<secret>"}
}
```

Accountform aus [C] `lib/data.ts`; Host/Ports laut Auftrag, je Account durch §1.3/SMTP-Sendtest bestätigen. Ein Login muss nicht zwangsläufig die sichtbare E-Mail sein.

Gemeinsame Mailboxen per `POST /api/admin/accounts` mit derselben Accountform ohne id anlegen; `ownerUserId=null`, **nicht automatisch verknüpft**. Danach über `PUT /api/admin/accounts/<accountId>/members/<userId>` mit `{role:"manager"}` oder `{role:"editor"}` beide Personen gezielt zuordnen. Persönliche Mailboxen über Selbstanlage, gemeinsame über Adminanlage verhindert versehentliche Ownership. Mitgliederverwaltung auch als Manager über `/api/accounts/<accountId>/members/<userId>` ([D] §5.4).

Vorschlag pro gemeinsamer Mailbox: eine betrieblich zuständige Person `manager`, die andere `editor`; beide `manager` nur wenn beide Credentials/Ordner/Mitglieder verwalten sollen. `viewer` darf lesen/syncen, nicht senden, verschieben, kommentieren oder zuweisen; `editor` darf dies, aber keine Credentials/Ordnerstruktur/Mitglieder verwalten; `manager` zusätzlich Verwaltung, Löschung dennoch owner/admin. „Admin“ ist eine Personenrolle, `manager/editor/viewer` sind Mailboxrollen. Quelle [D] §5.2.

**Prüfen:** Inventar mit `GET /api/accounts`, `GET /api/admin/accounts`, Members und tatsächlich angezeigtem `isOwner/shared/accessRole` vergleichen. Jede persönliche Mailbox nur für vorgesehene Person sichtbar; beide sehen genau eine gemeinsame Sent-Ablage. Viewer-Direkt-POST zum Send verweigert, Editor-Relogin verweigert, Manager repariert nach Providerpasswortwechsel beide gekoppelten IMAP-/SMTP-Zugangsdaten. Rollenentzug beendet auch offene Streams/MCP-Zugriff. [D] §1.1 Fit 1/6, [A] Slice 3.

**Rollback:** Falsche Mitgliedschaft sofort entziehen und offene Streams prüfen; keine Mailbox löschen, weil das deren lokale Metadaten/Cache entfernen kann. Ownership nicht per ad-hoc SQL reparieren; fehlende Transfermöglichkeit vor Anlage lösen.

### 5.5 Persönliche Reset-Link-Übergabe und Geräteverlust

**TODO [feat/team-auth Slice 5 Ausgabe, Slice 6 Aktivierung; feat/ui-shell Slice 7 Resetseite; Admin-UI feat/collab-ui]:**

1. Identität der betroffenen Person persönlich prüfen. Eingeloggter Admin weist App-Passwort + frischen Faktor nach (`admin.recovery`). `POST /api/admin/users/<userId>/recovery` erzeugt den einmal sichtbaren, 15 Minuten gültigen Single-use-Link. Admin gibt ihn **persönlich** weiter; kein SMTP, kein öffentlicher Reset-Anforderungsendpunkt.
2. Sind alle Adminsessions/Faktoren verloren, ist `scripts/recoverTeamAuth.ts --user-id <id>` der geplante lokal auditierte Operatorweg. Script war nicht vorhanden. **TODO [Slice 6]**: finale Usage/Authority-MFA-Reset-Optionen erst aus `--help` und `doc/AUTHENTICATION.md` übernehmen. Keinen erfundenen SQL-Passwortreset ausführen.
3. Der Link führt über öffentliche Token-Redemption `GET /api/ba/reset-password/:token` mit festem Callback `https://mails.monkeymed.de/reset-password`. UI nimmt Token nur kurz in Memory, entfernt es aus der Adresszeile und sendet `POST /api/ba/reset-password` JSON `{token,newPassword}`. Die reine Page ist erst Slice 7 verfügbar; Links erst dann an Personen aushändigen.
4. Reset meldet nicht automatisch an, entwertet alte Sessions/MCP/Challenges, **erhält MFA**. Neues Passwort plus bestehender Faktor erforderlich. Bei verlorenem TOTP-Gerät entweder Backup-Code-Flow (zwei unterschiedliche Codes für Login und nachfolgende TOTP-Ersetzung nötig) oder separat auditierter Admin-MFA-Reset `/api/admin/users/<id>/mfa-reset`; neuer TOTP muss wieder eingeschränkt eingerichtet und echt geprüft werden.

Quelle [D] §4.4/§4.5, [A] Slices 4–7. Es gibt keinen hier bestätigten einsatzfähigen Recovery-CLI. `/api/auth/recovery/request` und rohes `/api/ba/request-password-reset` sind ausdrücklich kein öffentlicher Ausgabepfad.

**Prüfen:** Vor Freigabe mit synthetischem User Ausgabe, persönliche Übergabe, ausgeloggte Redemption, Ablauf nach 15 min, erneute Benutzung und Login mit altem Passwort testen; Log-/Referrer-/History-Tokenlecks ausschließen. Auf der kanonischen Produktiv-UI mit beiden Personen einen vereinbarten Recovery-Nachweis durchführen, ohne ihre Backup-Codes aufzuzeichnen.

**Rollback:** Ungenutzten Link verfallen lassen/gezielt ersetzen; bei Fehler nach Passwortcommit neues Passwort zum Login versuchen, nicht blind Redemption wiederholen. Lockout über auditierten Operator beheben, keine Auth-Tabellen oder MFA-Gates deaktivieren.

## 6. Backups, Mailarchiv und Restore-Drill

### 6.1 Was zusammen gehört – Pfadkorrektur

**Schritt:** Sicherungsmanifest aus tatsächlichen Pfaden erzeugen. [U] und [R] nennen `mail.db`; **aktueller Code** `lib/runtimePaths.ts:getMainDbPath()` liefert `$NOCTUA_DATA_DIR/db/main.db`. `lib/db/connection.ts` liest Shards aus `accounts.dbPath`, bei Bedarf Default `db/accounts/<encodeURIComponent(accountId)>.db`; sogar gemeinsam genutzte/abweichende DB-Pfade sind möglich. Nicht nur `mail.db` sichern und nicht nur per Glob alle Standardshards vermuten. Existierende Legacy-`mail.db` ebenfalls erhalten, bis ihr Status geklärt ist. Quelle [C] genannte Funktionen, [D] §3/§8/§11.9.

```bash
sudo sqlite3 -readonly /srv/noctua/data/db/main.db \
  'SELECT id,email,dbPath FROM accounts ORDER BY id;'
sudo find /srv/noctua/data -type f \( -name '*.db' -o -name '*-wal' -o -name '*-shm' \)
```

Pfad außerhalb `/srv/noctua/data` = **NO-GO für untenstehendes pauschales Tar**, bis dieser Pfad zusätzlich im Backup/Restore-Manifest enthalten ist. Nicht stillschweigend im aktiven Betrieb umschreiben. Gleiche reale Sharddatei nur einmal sichern, ihre Referenzen aber erhalten.

| Zu sichern | Warum / Quelle |
|---|---|
| Master `db/main.db`, vorhandene Legacy-`mail.db`, ggf. weitere tatsächliche Masterpfade | Personen/Auth/MFA/Passkeys, Rollen, Credentials, Audit, Invites, Prefs, Journale; [D] §3.1/§8, [C] runtimePaths |
| Alle tatsächlichen Account-Shards, auch abweichende `dbPath` | Mailindex **plus nicht aus IMAP regenerierbare** Kommentare, Zuweisungen, Topics, Kalender, Reminders; [D] §3.2, [R] §2.18 |
| Ganzes `sources/` und `attachments/` | Vollbackup empfohlen für schnelle Wiederherstellung; offiziell Cache, kein garantiert vollständiges Mailarchiv; [U] Storage |
| `/etc/noctua/noctua.env` mit IMAP_SECRET_KEY und BETTER_AUTH_SECRET, offline Kopie | Ohne Keys Credentials/TOTP/Codes nicht rekonstruierbar; [D] §8.1 |
| App-Unit, Caddyfile/Drop-in, `/etc/caddy/netcup.env`, ganz `/var/lib/caddy` | TLS-/ACME-State und DNS-Renewal wiederherstellen; tatsächlicher Caddy-Statepfad anhand installierter Unit prüfen |
| Release-Manifest + freigegebenes Standalone/Bun-Binary | Schema-/Code-/Runtimezuordnung für Restore und Rollback; §3 |
| Separates NAS-Mailarchiv und dessen Snapshotgenerationen | Nach MailPlus-Ende liegt sonst einzig netcup der vollständige Mailbestand vor; [R] §2.18 |
| restic-Passwort + NAS-SSH-Zugang separat/offline | Backup nicht nur mit demselben verlorenen Host wiederherstellbar; [restic Repository-Doku](https://restic.readthedocs.io/en/stable/030_preparing_a_new_repo.html) |

**Prüfen:** Alle aktiven DB-Pfade im Manifest, verschlüsselte Secrets offline auffindbar, Backupaccount hat keinen unnötigen Zugang zu MailPlus-Produktivdaten. **Rollback:** Fehlendes Manifest vor Sicherung korrigieren; vorhandene Generationen behalten.

### 6.2 SQLite laufend sichern versus konsistenter Gesamtsnapshot

**Schritt:** `.backup` oder `VACUUM INTO` sichern jeweils **eine** SQLite-DB einschließlich ihres gültigen WAL-Zustands. Einzeln sind sie online konsistent, aber zeitlich versetzte Snapshots von Master und Shards sind **kein atomarer Applikationsstand**. Daher für diesen kleinen Haushalt nachts wenige Minuten stoppen; alle CLI-Writer/Syncs/Importe ebenfalls beenden. Keine implementierte globale Quiesce-/Backup-Sperre voraussetzen. Quellen [SQLite Backup](https://www.sqlite.org/backup.html), [D] §11.9, [R] §2.18.

Online-Einzelbeispiel, **nicht** als vollständiges Team-Backup etikettieren; Ziel muss neu sein, Verzeichnis privat:

```bash
sqlite3 -readonly /srv/noctua/data/db/main.db \
  ".backup '/srv/noctua/backups/<unique-generation>/main.db'"
# Alternative, not in addition to the same target:
sqlite3 -readonly /srv/noctua/data/db/main.db \
  "VACUUM INTO '/srv/noctua/backups/<other-unique-generation>/main.db';"
sqlite3 -readonly /srv/noctua/backups/<unique-generation>/main.db 'PRAGMA integrity_check;'
```

Für jeden tatsächlich referenzierten Shard separat möglich. **Prüfen:** `integrity_check=ok`, Dateien nicht leer; cross-DB-Wiederherstellbarkeit erst nach globalem Schreibstopp bewerten. **Rollback:** Fehlerhafte neue Generation verwerfen, letzte valide Generation behalten.

Ein Dateikopierjob gegen laufende DBs ist auch mit mitkopierten `-wal`/`-shm` nicht zuverlässig, wenn Dateien währenddessen wechseln. WAL nicht manuell löschen. Für den empfohlenen gestoppten Gesamtsnapshot das gesamte Datendir einschließlich verbliebener Sidecars archivieren; vor sauberem Shutdown sind Sidecars Bestandteil des gültigen Zustands ([U] WAL-Hinweise präzisiert durch [SQLite Backup](https://www.sqlite.org/backup.html)).

### 6.3 Nachtbackup und off-box-Kopie (NAS via restic)

**Vorgeschlagene Policy:** Appbackup täglich 03:15 nach abgeschlossenem Mailarchiv, RPO höchstens 24 h, zusätzlich vor jedem Deploy/Import; RTO-Ziel 2 h **erst durch Drill bestätigen**. 14 tägliche, 8 wöchentliche, 12 monatliche Generationen; manueller Pre-Go-live-Snapshot bleibt separat markiert. Alle drei Monate verschlüsselte Offlinekopie auf getrenntem Medium. Kein neues Cloudkonto nötig: vorhandene NAS als SFTP-Ziel, MailPlus-Abschaltung darf deren Backupdienst nicht entfernen. Quellen [R] §2.18, [D] §11.9; Policy ist Vorschlag.

Privates `/etc/noctua/backup.env`:

```dotenv
RESTIC_REPOSITORY=sftp:<backup-user>@<nas-tailnet-or-lan-host>:/<dedicated-restic-repository>
RESTIC_PASSWORD_FILE=/etc/noctua/restic-password
```

Dateien root:root 0600; SSH-Hostkey vorher unabhängig prüfen, dedizierten Schlüssel und restriktiven NAS-Benutzer einrichten. Keine Secrets in `RESTIC_REPOSITORY`/argv. Später einmalig `restic init` nur für **leeres neues** Repository. Bestehendes Repository mit `restic snapshots` prüfen, nicht neu initialisieren. [restic SFTP-Doku](https://restic.readthedocs.io/en/stable/030_preparing_a_new_repo.html).

**TODO [chore/mailplus-cutover]:** Produktionsscript `scripts/backupTeamInbox.ts`, Restore-Acceptance und Timer aus [D] §9/§11 existieren noch nicht als bestätigte Funktion. Folgendes ist eine konkrete **Shell-Vorlage** für `/usr/local/sbin/noctua-backup` (root 0750), später anzulegen. Voraussetzungen: alle Shards innerhalb Datendir, keine CLI-/Importwriter, Release-Verzeichnisse immutable, verifizierter Caddy-Statepfad `/var/lib/caddy`. Caddy-Stop verhindert Änderungen an TLS-State während seiner Kopie. Unterbrechung bewusst kurz, restic-Upload danach bei wieder laufender App:

```bash
#!/usr/bin/env bash
set -euo pipefail
umask 077
exec 9>/run/lock/noctua-backup.lock
flock -n 9
set -a
source /etc/noctua/backup.env
set +a
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
STAGE="/srv/noctua/backups/$STAMP"
install -d -m 0700 "$STAGE"
APP_WAS_ACTIVE=0
PROXY_WAS_ACTIVE=0
systemctl is-active --quiet noctua.service && APP_WAS_ACTIVE=1
systemctl is-active --quiet caddy.service && PROXY_WAS_ACTIVE=1
resume_services() {
  if test "$APP_WAS_ACTIVE" = 1; then systemctl start noctua.service; fi
  if test "$PROXY_WAS_ACTIVE" = 1; then systemctl start caddy.service; fi
}
trap resume_services EXIT
systemctl stop noctua.service
systemctl stop caddy.service
# Check no transient sync/migration writer remains before archiving.
if systemctl is-active --quiet noctua-fullsync.service; then
  echo 'Full-sync writer still active; refusing snapshot' >&2
  exit 1
fi
tar -C /srv/noctua -czf "$STAGE/data.tgz" data
tar -C / -czf "$STAGE/config-tls.tgz" \
  etc/noctua etc/caddy var/lib/caddy \
  etc/systemd/system/noctua.service etc/systemd/system/caddy.service.d
readlink -f /srv/noctua/current > "$STAGE/RELEASE_PATH"
cp /srv/noctua/current/REVISION /srv/noctua/current/BUN_VERSION "$STAGE/"
tar -C /srv/noctua/releases -czf "$STAGE/release.tgz" \
  "$(basename "$(readlink -f /srv/noctua/current)")"
cp /opt/noctua/bin/bun "$STAGE/bun"
(cd "$STAGE" && sha256sum data.tgz config-tls.tgz release.tgz bun > SHA256SUMS)
resume_services
trap - EXIT
restic backup --tag noctua-app "$STAGE"
restic snapshots --tag noctua-app
```

Diese Tarvorlage enthält Secrets: lokale Stagingdateien nur root, off-box nur verschlüsselt. Zusätzliche tatsächliche Config-/Shardpfade ergänzen; Script soll bei fehlendem Pfad fehlschlagen statt still weiterzumachen. Bei manueller Nutzung im Cut-over darf es Dienste, die vorher gestoppt waren, nicht unerwartet starten. Check auf `noctua-fullsync` ersetzt keine Prüfung auf andere manuell gestartete Writer.

Systemd-Vorlage `/etc/systemd/system/noctua-backup.service` und `noctua-backup.timer`:

```ini
# noctua-backup.service
[Unit]
Description=Consistent Noctua snapshot and encrypted NAS backup
After=network-online.target
Wants=network-online.target
[Service]
Type=oneshot
ExecStart=/usr/local/sbin/noctua-backup
TimeoutStartSec=6h
UMask=0077
```

```ini
# noctua-backup.timer
[Unit]
Description=Nightly Noctua backup
[Timer]
OnCalendar=*-*-* 03:15:00 UTC
RandomizedDelaySec=5m
Persistent=true
[Install]
WantedBy=timers.target
```

Später: `sudo systemd-analyze verify ...` mit beiden vollständigen Pfaden, daemon-reload, manueller erster Lauf und Restore, erst danach `sudo systemctl enable --now noctua-backup.timer`. [D] §9/§11 fordert Timer; Zeitplan hier vorgeschlagen. NAS-Mailarchivjob mit eigenem Lock gegen Überlappung schützen.

**Prüfen:** `systemctl list-timers noctua-backup.timer`, Erfolg des letzten Laufs und restic-Snapshotalter <24 h; Ausfallmeldung sichtbar für Operator. `restic check`, regelmäßig mit `--read-data-subset=10%`, einmal vollständig im Drill. Retention zunächst dry-run, nur nach erfolgreicher Wiederherstellung endgültig:

```bash
restic forget --tag noctua-app --group-by host,tags \
  --keep-daily 14 --keep-weekly 8 --keep-monthly 12 --dry-run
# After review, same command without --dry-run; prune in a separate quiet window.
```

Explizites `--group-by host,tags` verhindert, dass täglich wechselnde Stagingpfade jede Generation in eine eigene Retentiongruppe stecken. Neueste zwei **erfolgreich off-box gesicherte** lokale Stagingstände behalten, ältere erst nach geprüftem Restore manuell entfernen. Quelle [restic Retention](https://restic.readthedocs.io/en/stable/060_forget.html).

**Rollback:** Bei Backupfehler Trap muss ursprüngliche Dienste wieder starten; `systemctl is-active` und HTTPS prüfen. Fehlgeschlagene Generation nicht als erfolgreich markieren, letzte gute Sicherung nicht prunen. Timer bei Überlappung aussetzen, Ursache beheben; Datenbank nicht „reparieren“, um Backup grün zu bekommen.

### 6.4 Unabhängiges Mailarchiv nach MailPlus

**Schritt:** MailPlus sechs Monate als unverändertes Archiv erhalten, POP3 und Benutzer-Senden aus. Es enthält nach T0 **keine neuen Mails**, ersetzt also kein neues Archiv. Für die laufende netcup-Mail einen separaten Maildir-Export auf der NAS betreiben: Empfehlung **nächtlich**, mindestens vor endgültiger NAS-MailPlus-Abschaltung ein monatlicher Vollständigkeitsnachweis plus geschützte Generationen. Imapsync kopiert zwischen IMAP-Servern, **nicht direkt in Maildir**; hierfür `mbsync`/isync verwenden oder einen separaten lokalen Archiv-IMAP-Server. Kein Mailarchiv mit Noctuas `sources/` verwechseln. Quellen [R] §2.18/§5.3, [mbsync](https://isync.sourceforge.io/mbsync.html).

Beispiel **für eine** Mailbox auf dem NAS-/Archivhost, aktuelle mbsync-Syntax; pro Mailbox separater Store/Channel und privates Passwortfile. Falls installierte ältere Version `SSLType` statt `TLSType` verwendet, anhand ihrer Manpage anpassen, nicht TLS abschalten:

```text
IMAPAccount netcup-household-01
Host mxf9a0.netcup.net
Port 993
User <actual-imap-username>
PassCmd "cat /etc/noctua-archive/mailbox-01.pass"
TLSType IMAPS
SystemCertificates yes

IMAPStore netcup-01
Account netcup-household-01

MaildirStore archive-01
SubFolders Verbatim
Path /volume1/noctua-mail-archive/mailbox-01/
Inbox /volume1/noctua-mail-archive/mailbox-01/INBOX

Channel household-01
Far :netcup-01:
Near :archive-01:
Patterns *
Create Near
Remove None
Expunge None
Sync Pull New Flags
SyncState *
```

Verzeichnis vorher privat anlegen. `mbsync -c <private-config> -l household-01` listet, `mbsync -c <private-config> household-01` archiviert. Pull-only, keine Zielmail zurück nach netcup schreiben, keine Löschungen/Gone übernehmen. `Flags` kann Deleted-Markierungen lokal nachziehen, Expunge bleibt None. NAS-Archivpfad ist **Vorschlag**, tatsächliches Volume prüfen. Mit Snapshotgenerationen schützt man auch vor Fehlbedienung oder beschädigtem Synchronisationszustand. Optional monatlich immutable/read-only NAS-Snapshot und off-site/offline Kopie, mindestens 12 Monatsstände.

**Prüfen:** Pro Account Source-/Maildir-Ordnerabdeckung, älteste/neuste Mail und Anhang; monatlich ausgewählte EML ohne netcup-Verbindung öffnen. Testmail nach Archivierung am **Testkonto** remote löschen, lokales Archiv muss sie behalten. Keine Produktivmail für Löschtest verwenden. Backup des Archivs auf ein zweites Medium; NAS-Snapshot allein schützt nicht vor NAS-Verlust.

**Rollback:** Archivjob stoppen; bestehende Maildirs/Snapshots nicht löschen und niemals einen bidirektionalen Wiederherstellungslauf auf produktive Mailboxen starten.

### 6.5 Restore-Drill vor Freigabe

**Schritt:** Nicht in Produktionspfade entpacken. Isolierte Test-VM/Netznamespace ohne IMAP-/SMTP-/CalDAV-Egress verwenden; keine zweite aktive Instanz mit kopierten realen Credentials. Watcher=0 genügt nicht, weil Login/UI/Worker ebenfalls Netzzugriffe auslösen können. Bei Original-Origin-Tests nur isolierten Testclient per hosts/DNS an Restorehost binden; canonical URLs/RP-ID nicht global verändern. [D] §11.9, [A] Slice 6/7.

```bash
# In the isolated restore environment, after loading backup credentials privately:
restic snapshots --tag noctua-app
restic restore '<chosen-snapshot-id>' --target /srv/noctua-restore-download
# Locate the original /srv/noctua/backups/<generation> below that directory.
cd '<restored-generation-directory>'
sha256sum -c SHA256SUMS
tar -tzf data.tgz | head
tar -tzf config-tls.tgz | head
```

1. Generation, Git-SHA, Bun-Version, Env/Keys, Master und tatsächliche Shardreferenzen gemeinsam auswählen; neue leere Restorepfade anlegen, Tar zuerst auflisten, nie über laufende Produktion extrahieren.
2. Im Drill ursprüngliche absolute `/srv/noctua/data`-Pfade innerhalb isolierter VM nachbilden. Bei anderem Root **offline** alle `accounts.dbPath`-Referenzen auf gesicherter Kopie prüfen/anpassen; sonst könnte Restore auf Originaldateien zeigen. Relative Pfade/Shared-Shards bewusst auflösen.
3. Mit gestoppter Test-App alle extrahierten DBs `PRAGMA integrity_check` und `PRAGMA foreign_key_check` prüfen, Berechtigungen/Keys wiederherstellen. Vorhandene WAL-/SHM-Sätze aus demselben gestoppten Snapshot zusammenhalten; nicht mit Dateien einer anderen Generation mischen.
4. App mit passender Bun-/Releaseversion, kanonischem Origin und Keys starten, Watcher=0/Egress gesperrt. Benutzer-/Mailboxanzahl, Rollen/Owner, Audit, Prefs, Kommentare/Zuweisungen/Topics, Kalender/Reminder prüfen; gespeicherte Nachricht mit Anhang offline lesen.
5. Beide Personen können im vereinbarten Drill TOTP-/Passkey-Authentisierung nachweisen; Tests müssen zum echten RP-ID/Origin passen. Falls dies im isolierten Aufbau nicht möglich ist, genau diese Lücke dokumentieren, nicht als bestanden abhaken.
6. Schreib-/Sendetest nur mit **synthetischer** Mailbox gegen Fixture beziehungsweise freigegebene Test-Infrastruktur; kopierte realen Credentials nie aus dem Restore ansprechen. Danach isolierten Restorestand herunterfahren/sicher verwahren.
7. Restorezeit, letztes enthaltenes Ereignis/RPO, fehlende Daten und Prüfer protokollieren. Erfolg ist Go-live-Gate, nicht eine zukünftige Zusage. Produktionsrestore erst im Ausfall: Dienste stoppen, aktuellen Stand zusätzlich sichern, geprüften Satz gemeinsam einspielen, Zuordnung/Pfade prüfen, TLS/Login/Counts prüfen, dann kontrolliert Egress/Watcher freigeben.

**Prüfen:** Kein Netzverkehr zu realem netcup aus Drill, keine Produktionsdatei berührt, SQLite-Checks sauber, fachliche Stichproben und beide User bestätigt. **Rollback:** Testumgebung stoppen; Produktion bleibt unverändert. Bei fehlgeschlagenem echtem Restore aktuellen gesicherten Ausgangsstand wiederherstellen und letzten guten Satz prüfen, keine Generationen vermischen.

## 7. Cut-over-Tag, erste Woche und MailPlus-Ende

### 7.1 Geordnete Checkliste mit Gates

Jede Zeile mit Uhrzeit, Prüfer und Beleg ausfüllen. „Rollback“ verweist auf den oben beschriebenen sicheren Rückweg, nicht auf automatische Remote-Löschung.

| Nr. | Aktion / Go-Gate | Verifikation / Freigabe | Rollback / Abhängigkeit |
|---|---|---|---|
| 1 | Inventar §1 und alle 18 Kriterien [D] §1.1 vollständig | Zwei Personen bestätigen Adressen, Rollen, Features, Sender, Quoten, Limits | NO-GO bei offenem Muss; MailPlus bleibt. TODO alle relevanten Branches aus §0/§3 |
| 2 | Freigegebener Build, Auth-/UI-/Watcher-/Sent-/Collab-Nachweise | Kein 503, Browserharness und echte Phoneabnahme geplant/vorab geprobt | TODO team-auth 3–6, ui-shell 7, collab-ui, watcher, thread-collaboration; ggf. sender-identities |
| 3 | Host, freier Tailnet-443, DNS auf allen Geräten, DNS-01/TLS | §2: richtiger Resolver, SAN, Tailnetzugriff; öffentliche App-Ports geschlossen | §2.4: Caddy-/Serve-Rückweg, kein MX-Change |
| 4 | NAS-/MailPlus-Backup + getesteter Backup/Restoreweg vorhanden | Off-box-Snapshot/Schlüssel unabhängig lesbar, Restore-Drill bestanden | §6; NO-GO ohne Kopie der NAS-only-Historie |
| 5 | Benutzer über Fenster informieren, MailPlus-Senden/Regeländerungen beenden | Beide arbeiten während Migration nicht in MailPlus | Weiter im bestehenden Client, solange noch kein INBOX-Import |
| 6 | Letzter POP3-Fetch, **alle Einzelabrufe und global POP3 AUS** | Logs über zwei Pollintervalle, neue netcup-Testmail bleibt dort | §4.1; nach Import POP3 aus lassen |
| 7 | Pro Mailbox Dry-run freigeben, Import und finalen Delta durchführen | Exit 0, Mapping/Sent eindeutig, zweite ruhende Ausführung null Transfers, Counts erklärt | §4.2–4.3; Original NAS bleibt |
| 8 | Erster Admin, zweite Person, beide TOTP/Backupcodes/Passkeys | Unabhängige Login-/Recovery-Tests; nur kanonische Origin | §5; TODO team-auth 4–6, ui-shell 7, collab-ui Admin |
| 9 | Persönliche Accounts als Owner, Shared-Accounts mit Rollen anlegen | Ownership/Members/SMTP/keine privaten Freigaben korrekt | §5.4; TODO team-auth 3/6, collab-ui |
| 10 | App/Browser/Watcher/Importer pausieren; Full-Sync jedes Ordners | Alle CLI-Results, NAS/netcup/Shard-Counts, Historie inkl. ältester Sent/Anhänge | §4.4; NO-GO bei unerklärtem Verlust |
| 11 | App starten, Watcher=1; alle ~12 Accounts testen | Keine Login-/Connection-Stürme; Hintergrundsync ohne Browser | §4.4; TODO watcher + team-auth 3/6 Integration |
| 12 | Fachliche Abnahme beider Personen | Je Mailbox Empfang/Versand und genau ein Sent; A antwortet/draft-sendet/calendar-replied, B sieht Sent/Answered ohne aktives A-Tab; App zeigt APPEND-Fehler sichtbar | TODO thread-collaboration; nicht erneut senden bei SMTP-erfolgreich/Sent-copy-fehlgeschlagen |
| 13 | UI-/Zusammenarbeitsabnahme | Unread/Assigned/Open-Badges aller Mailboxen, SSE, persönliche Signaturen, From sichtbar; Viewer/Editor/Manager-Negativtests, Privatgrenzen | TODO collab-ui, ui-shell 7, team-auth 3; fehlendes Muss = NO-GO |
| 14 | Telefone/PWA, Spam/Regeln/Autoresponder, Anhänge | TOTP/Passkey, Wechsel/Lesen/Antwort/Kamerafoto; 10-MB-Anhang, GTUBE, externe Autoantwort; englische UI akzeptiert | §1.2/§2.4/§5.3; TODO ui-shell 7 für Auth |
| 15 | Post-Cut-over-Appbackup + unabhängiges Mailarchiv | Snapshot/Archive off-box, Nachtjobs aktiv, verantwortliche Person benannt | §6; TODO chore/mailplus-cutover Automatisierung |
| 16 | Beide unterschreiben [D] §1.1 einzeln, Tagesprotokoll abschließen | Erst jetzt Noctua als Alltagsclient freigeben | netcup-Webmail/IMAP-Ersatz statt POP3-Reaktivierung |

Gate 12 bei Sent-copy-Fehler: SMTP kann bereits erfolgreich gewesen sein. Kundenmail **nicht erneut senden**; Message-ID prüfen und gezielt Sent-Kopie reparieren. Entsprechende UI-Warnung/Server-Ingest ist [D] Fit 12 und **TODO [feat/thread-collaboration + feat/collab-ui]**; bei still verschluckter Warnung keine Freigabe.

### 7.2 Erste Woche

**Schritt:** Tag 0 stündlich, Tag 1–2 morgens/abends, anschließend täglich prüfen; beide Personen melden fehlende Mail/Antworten sofort mit Account/Ordner/Zeit, nicht mit Passwort oder Reset-Link. Quellen [D] §11.8–10, [W] Zustands-/Summaryvertrag.

```bash
systemctl is-active noctua.service caddy.service
journalctl -u noctua.service --since '2 hours ago' --no-pager \
  | rg -i 'watcher|auth_failed|backoff|APPEND|sentCopy|too many|maximum.*connection|SQLITE_BUSY|ENOSPC|timeout|error'
ss -tn state established '( dport = :993 )'
df -h /srv/noctua
systemctl list-timers noctua-backup.timer
```

| Beobachtung | Soll / Handlung | Rollback |
|---|---|---|
| Watcherstatus je Mailbox, lastSyncAt, Anzahl Verbindungen | Keine dauerhaft vergessene/inaktive Mailbox; Zustände idling oder erklärtes Backoff. `/api/accounts/summary` im Watcherbranch zeigt nur aktiven Account; produktive nutzerbezogene `/api/me/mailboxes/summary` ist TODO collab-ui | Watcher=0, Fehler beheben, kontrolliert 1; nie unkontrollierte Loginretry-Schleife |
| Auth_failed / netcup-Limit / SMTP nach Passwortwechsel | Manager repariert gespeicherte Credentials; Watcher dauerhaft suspendierte Identität braucht geänderte Credentials/expliziten Retry, Neustart allein reicht nicht zwingend | Worker 1, Tabs/weitere Clients reduzieren; persönlichen App-Login behalten; TODO team-auth 3 |
| Sent-copy / APPEND / fehlender Answered-Status | Serverannahme prüfen, Message-ID vergleichen, Kopie reparieren; keine neue Kundensendung | Sendefunktion vorübergehend über netcup-Webmail, fachlichen Doppelversand vermeiden; TODO thread-collaboration/collab-ui |
| TOTP-Lockout, Uhrzeit, verlorenes Gerät | Admin persönlich prüfen, §5.5 nutzen; Backupcodeverbrauch beachten | Auditiertes Recovery, keine MFA-Abschaltung; TODO team-auth 4–6, UI 7 |
| Speicher, SQLITE_BUSY, Workerqueue/-Timeouts | Keine ENOSPC; Cache/Backup-/Buildreserve erhalten, lange Vollsyncs seriell. CPU/RAM mit repräsentativen Anhängen messen | Nicht Shards/Quellmail löschen; alten Build nur mit passendem Schema zurück |
| Backup-/Archiv-Alter, NAS-Erreichbarkeit, Zertifikat | Snapshot <24 h, Mailarchiv aktuell, Zertifikatsablauf früh genug gemeldet; Renewal-Logs kontrollieren | Letzte gute Generation behalten, Backupfehler vor weiteren Deploys beheben |
| Tag-1-/Tag-7-Differenzen | Nur geprüfte Nachzügler importieren, `--noresyncflags`, Counts erneut vergleichen (§4.3) | Bei unerklärten Änderungen Lauf stoppen, NAS ruhend lassen |

**Prüfen:** An Tag 1 und Tag 7 fachliche Nachkontrolle/Signed-off-Counts beider Personen, letzte Nachtbackups und Stichprobenrestore. Nach Programmneustart wieder alle zwölf Mailboxen beobachten, nicht nur aktive Browsermailbox. Ein falsches IMAP-Passwort darf nicht persönliche Appsessions ausloggen ([A] Slice 3/7).

**Rollback:** Aktuellen Noctua-Stand samt Kollaborationsdaten zuerst sichern; App stoppen und netcup-Webmail/IMAP-Client benutzen oder §3/§6-Restore. POP3 bleibt aus. Fehlen Daten auf netcup, gezielt aus geschützter NAS-/Maildir-Generation restaurieren, niemals unkontrollierter bidirektionaler Sync.

### 7.3 MailPlus dekommissionieren

**Schritt:** Mindestens erste sieben Tage komplette Historie unverändert erhalten; Empfehlung **sechs Monate** MailPlus als ruhendes, für Benutzer organisatorisch read-only Archiv aufbewahren. Falls Synology keinen passenden echten Read-only-Zugriff bietet, Logins auf Archivnutzung beschränken und Konfig-/Volume-Snapshot sperren; das ist kein technisch bewiesener ACL-Ersatz. POP3, SMTP-Nutzung und Autoresponder bleiben aus; NAS-Mailarchiv-/Restic-/Contacts-Dienste separat behandeln. [D] §11.2/10, [R] §5.9–10.

**Prüfen vor endgültiger Entfernung nach sechs Monaten:** Tag 7 und Monatsabnahmen abgeschlossen, vollständige historische NAS-Mail inklusive Sent im Ziel/Archiv nachgewiesen, zwölf laufende Maildir-Archive, mindestens ein jüngster erfolgreicher Restore samt Schlüsseln und zwei unabhängige Sicherungsmedien. Beide Personen bestätigen keine weiter benötigten MailPlus-only-Regeln/Labels/Kalender/Kontakte. Rechtliche Aufbewahrungsanforderungen gegebenenfalls separat klären; sechs Monate hier ist nur der technische Rollbackvorschlag.

**Rollback:** Vor Paket-/Volumeentfernung unveränderliches NAS-Archiv/Export und Schlüssel sichern. Bei Archivbedarf aus diesem Stand **ohne POP3-/SMTP-Aktivierung** lesen; unabhängige laufende Mailarchive nicht mit MailPlus entfernen.

## 8. Noch zu entscheiden / nicht verifiziert (maximal zehn Fragen)

1. Welche vollständigen Adressen, Aliase, Forwarder und Catch-alls gibt es auf den vier Domains, welche müssen als Absender nutzbar bleiben, und wer erhält welche Owner-/Mailboxrolle?
2. Wie heißen NAS-IMAP-Host, Ownerlogins, Shared-Namespace und tatsächliche Sonderordner; sind alle historischen Sent-/Archivbestände darüber sichtbar und wie groß sind die einzelnen Mailboxen?
3. Welche MailPlus-Labels, Filter, Autoantworten, Signaturen, Kontakte/Kalender müssen erhalten bleiben; ist die englische Noctua-UI zum Start akzeptiert?
4. Welches netcup-Webhostingpaket/Quota gilt je Mailbox, und bestätigt netcup die benötigten IMAP-Verbindungs-/Login- und SMTP-Größen-/Versandgrenzen? Live-CAPABILITY/UIDPLUS/SPECIAL-USE noch ausstehend.
5. Wem gehört der bestehende Tailscale-Serve-Endpunkt 443 → 4173, und kann er auf 8446 beziehungsweise einen separaten Host umziehen? Sind beide Personen auf allen vorgesehenen Geräten im Tailnet und löst dort `mails.monkeymed.de` richtig auf?
6. Welcher konkrete NAS-SFTP-Pfad, Backupbenutzer und zweites/offline Medium stehen zur Verfügung; sind 14 tägliche / 8 wöchentliche / 12 monatliche Backups, tägliches Mailarchiv und vorgeschlagenes RPO 24 h/RTO 2 h passend?
7. Welches Cut-over-/Nachtwartungsfenster ist akzeptabel, und darf MailPlus sechs Monate als ruhendes Archiv bestehen bleiben?
8. Welche Telefone/Desktopbrowser/Authenticatoren werden tatsächlich genutzt, wer ist der zweite benannte Recovery-Operator, und wo werden die getrennten Offline-Schlüssel/Backup-Codes verwahrt? Keine Secrets als Antwort in Chat senden.
9. Welche maximale **gesamte Anhangsgröße pro Mail** muss zuverlässig funktionieren, und welche zusätzlichen IMAP-Clients/Tabs bleiben parallel aktiv?

Nicht live verifiziert: echte Mailboxfähigkeiten/Ordner/Counts/Quoten/Limits, NAS-Zugriff und imapsync-Läufe, GTUBE/Autoresponder, TLS-Ausstellung/Renewal, endgültige Caddy-/Bun-/SQLite-/Archivtoolversionen, Auth Slices 3–7 und collab-ui-Endpunkte, Realgeräte/Passkeys, Backup-/Restorelauf und Versand. Die gelesenen Dateien und read-only Host-/DNS-Befunde belegen den Plan, **keinen abgeschlossenen Go-live**. Einzige bei dieser Recherche neu angelegte Datei ist dieses Runbook; es wurden keine Dienste/DNS/Packages/Produktivmail geändert.
