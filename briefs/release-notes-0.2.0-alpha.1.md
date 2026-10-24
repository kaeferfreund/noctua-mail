# Noctua Mail 0.2.0-alpha.1 (Fork kaeferfreund/noctua-mail)

Erstes integriertes Alpha-Release des Forks als Ersatz für Synology MailPlus im Haushalt. Stand integration/stage 8aae8ba + Versionsbump. Nicht für den Produktivbetrieb freigegeben; Go-live folgt nach dem Runbook (briefs/go-live-runbook.md).

## Neu gegenüber dem Upstream-Stand (main 0f40e02)
- Team-Postfach: eigene Logins mit Passwort und zweitem Faktor, Rollen (Betrachter, Bearbeiter, Verwalter), geteilte Postfächer, Einladungen, Admin-Bereich mit Audit.
- Zusammenarbeit: Status, Zuweisung und interne Kommentare pro Konversation; gemeinsamer Gesendet-Ordner; Absender-Identitäten, Signaturen und Absender-Vorgaben.
- Deutsche Oberfläche (Compose, Einstellungen, Leseansicht, Admin); Deep Links auf Mails, Postfächer und Ansichten mit kurzen Adressen.
- Mobile: kompakte Leseansicht, Statusleiste, Sidebar- und Kopfzeilen-Überarbeitung, PWA-tauglich.
- Leistung: schnellerer Postfachwechsel mit Listen-Cache, Fensterung langer Konversationen, gzip für API-Antworten, Volltextsuche v3 mit deutscher Faltung, Mailbox-Watcher.
- MCP: Tokens für mehrere (auch geteilte) Postfächer mit Berechtigungsstufe „Nur lesen“, „Lesen und Entwürfe“ oder „Vollzugriff“; Senden ohne Freigabe serverseitig gesperrt.
- Sync: Anhänge ohne Inhaltstyp blockieren den Sync nicht mehr.
- Abhängigkeiten aktualisiert (Next 16, imapflow 2, mailparser, htmlparser2 12 u. a.).

## Bekannt / offen
- P3-Liste in briefs/BACKLOG.md; Go-live-Schritte (Produktionshost, Caddy, DNS, Import, Backup-Drill) in briefs/go-live-runbook.md.
