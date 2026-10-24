# MCP: mehrere Postfächer und Token-Berechtigungen

Stand: 2026-10-23. Implementierung abgeschlossen.

- Worktree: `/home/monkey/code/noctua-mail/wt-mcp-scopes`
- Branch: `feat/mcp-multi-mailbox`
- Basis: `9523bbeebbca264868638bf2907d08677b335548`
- Commit: `3d82d1eea2e67c4ad9666b812f2a4ec397885f29` — `feat(mcp): support mailbox sets and enforce token permission modes`
- Trailer: `Co-Authored-By: Codex GPT-6.1 Sol <noreply@openai.com>`

## Verhalten

- Beim Erstellen werden eigene/gemeinsame Postfächer aus `listAccessibleAccountsForUser` und einer von drei Modi gewählt. Das Postfach des geöffneten Tabs bleibt ausgewählt und ist das Standardpostfach. Die API validiert alle ausgewählten Mitgliedschaften atomar bei der Token-Erstellung; zusätzliche Postfächer dürfen auch eine Leserrolle haben.
- Jedes Werkzeug mit `accountId` akzeptiert ein abgedecktes Postfach. Ohne Angabe gilt das primäre Postfach. Auch `list_mailbox_summary` unterstützt jetzt die Auswahl eines abgedeckten Postfachs.
- Rollen und Mitgliedschaften werden live gelesen. Der Verlust der primären Mitgliedschaft sperrt dieses Postfach, lässt aber andere abgedeckte Postfächer nutzbar. Ohne explizite Auswahl wird weiterhin das primäre Postfach geprüft. `list_accounts` verwendet die gespeicherte Erstelleridentität und zeigt ausschließlich abgedeckte, aktuell zugängliche Postfächer samt Rolle.
- Token-Listen zeigen das Token in allen abgedeckten Postfächern; Verwalter sehen alle, Bearbeiter ihre eigenen Tokens. Löschen in einem dieser Tabs widerruft das gesamte Token. Jede Zeile zeigt Modus und Postfächer. Deutsche und englische Texte sind ergänzt.
- `read`: ausschließlich Lesewerkzeuge einschließlich `check_new_mail`. `drafts`: zusätzlich Entwürfe, Flags/To-do/Themen und Zusammenarbeit. `full`: zusätzlich `manage` und `send`. Identitäten und Absenderpräferenzen schreiben benötigt `manage`; bestehende Rollenanforderungen gelten zusätzlich.
- Alle 27 registrierten Werkzeuge sind in `MCP_TOOL_SCOPES` eingestuft. Der zentrale `tools/call`-Eingang prüft die gespeicherten Berechtigungen für jeden Aufruf, auch im Batch. Unbekannte Werkzeuge werden abgelehnt; fehlende Rechte ergeben `Token has no <scope> permission`. Ein Test vergleicht die echte SDK-Werkzeugliste mit der vollständigen Einstufung.
- `authorizeOutbound` verlangt bei Token-Aufrufen standardmäßig `send`. Ausschließlich explizite Entwurfs- bzw. Identitätsverwaltungspfade verwenden `drafts` bzw. `manage`; die finale synchrone Autorisierung prüft die Berechtigung erneut. Es wurde kein MCP-Sendewerkzeug ergänzt. Die sitzungsbasierte Web-Sendeautorisierung bleibt unverändert.

## Schema und Lebenszyklus

Nur Master-Schema, keine Shard-Änderung:

- Neue idempotente Tabelle `mcp_token_accounts(tokenId, accountId)` mit zusammengesetztem Primärschlüssel und Index `(accountId, tokenId)`.
- Fremdschlüssel auf `mcp_tokens` mit `ON DELETE CASCADE`; ein zusätzlicher Löschtrigger bereinigt Mapping-Zeilen auch ohne aktivierte SQLite-Fremdschlüsselprüfung, einschließlich bestehender Sicherheits-/Benutzer-Löschpfade.
- Bestehendes `mcp_tokens.accountId` bleibt primär. Beim Löschen dieses Postfachs wird ein verbleibendes Postfach deterministisch als neues primäres gewählt. Tokens ohne verbleibendes Postfach werden gelöscht.
- Bestehendes `mcp_tokens.scopes TEXT` speichert JSON-Arrays: `["read"]`, `["read","drafts"]` oder `["read","drafts","manage","send"]`.
- Keine Rückbefüllung: leeres Mapping bedeutet nur primäres Postfach. `scopes=NULL` bedeutet Lesen/Entwürfe ohne `manage` oder `send`. Ungültiges Scope-JSON gewährt keine Berechtigungen.
- Der bestehende Mitgliedschaftsentzug in `lib/accountMembers.ts` wurde angepasst: Einzelpostfach-Tokens werden weiterhin widerrufen, Mehrpostfach-Tokens behalten die anderen Mitgliedschaften. Der echte Entzugspfad wird getestet.

## Gates

Alle ausgeführten schweren Prüfungen liefen einzeln mit `TMPDIR` unter dem Worktree und `nice -n 15`. Zeiten sind die gemessene reale Laufzeit des abschließenden jeweiligen Durchlaufs.

| Gate | Ergebnis | Laufzeit |
| --- | --- | --- |
| `bun check` | Exit 0; 1.341 Dateien, 0 Typfehler | 0,528 s |
| `bunx eslint <22 geänderte/neue TS-/TSX-Dateien>` | Exit 0; 0 Fehler, 0 Warnungen | 3,482 s |
| Fokussierte Servertests inklusive zweier angrenzender Regressionstests | Exit 0; 39 bestanden, 0 fehlgeschlagen, 403 Assertions, 11 Dateien | 29,479 s (Bun: 29,29 s) |
| DOM-Tests für MCP-Tab und angrenzende deutsche/englische Einstellungen | Exit 0; 8 bestanden, 0 fehlgeschlagen, 32 Assertions, 2 Dateien | 1,406 s (Bun: 1,383 s) |
| `git diff --check` | Exit 0; keine Whitespace-Fehler | — |

Serverbefehl:

```sh
nice -n 15 bun test lib/mcpAuth lib/mcpServer lib/db/mcpTokens lib/db/schema.master.test.ts lib/outboundAuthorization app/api/mcp 'app/api/accounts/[accountId]/mcp-tokens' lib/sendIdentity.routes.test.ts lib/mailboxSummary.mcp.test.ts
```

DOM-Befehl (gezielte Dateiauswahl mit der Projekt-DOM-Konfiguration):

```sh
nice -n 15 bun test --config=bunfig.dom.toml ./app/components/account-settings/McpTabContent.dom.test.tsx ./app/components/account-settings/SettingsTabsB.i18n.dom.test.tsx
```

Abgedeckt sind Modi/Standardmodus, Ablehnung aller schreibenden Werkzeuge für Lesetokens, Live-Scopes statt übergebener Metadaten, unbekannte Werkzeuge, Mehrpostfach-Auflösung/Standardpostfach, fremdes Postfach, Rollenwechsel und Mitgliedschaftsentzug, Legacy-Tokens, Sendesperre und finale Wiederholungsprüfung, Listen-/Löschrechte, echte Postfachlöschung mit Kaskade sowie UI-Auswahl und Anzeige.

Entwicklungsvorläufe: Die erste Typprüfung meldete 7 Typfehler (fehlender Rückgabetyp einer SQLite-Transaktion); behoben. Der erste Lintlauf meldete 2 Importfehler und 2 Hook-Warnungen; behoben bzw. die notwendige bestehende API-Lade-Effect-Ausnahme eng kommentiert. Die erste Serverauswahl hatte 35 bestandene Tests und 1 Fehler wegen des alten Einzelpostfach-Fehlertexts; die Assertion wurde auf die neue Mengenprüfung angepasst. Ein gezielter Zwischenlauf bestand mit 17/0 Tests; die oben stehenden finalen Gates sind vollständig grün.

## Geänderte Dateien

26 Dateien im Commit:

- `app/api/accounts/[accountId]/mcp-tokens/multi-mailbox.test.ts`
- `app/api/accounts/[accountId]/mcp-tokens/route.ts`
- `app/api/mcp/route.test.ts`
- `app/api/mcp/route.ts`
- `app/components/account-settings/McpTabContent.dom.test.tsx`
- `app/components/account-settings/tabs/McpTabContent.tsx`
- `doc/API.md`
- `doc/TEAM-INBOX.md`
- `lib/accountMembers.ts`
- `lib/data.ts`
- `lib/db/accounts.ts`
- `lib/db/mcpTokens.ts`
- `lib/db/rowParsers.ts`
- `lib/db/schema.master.test.ts`
- `lib/db/schema.ts`
- `lib/drafts.ts`
- `lib/mcpAuth.scopes.test.ts`
- `lib/mcpAuth.ts`
- `lib/mcpPermissions.ts`
- `lib/mcpServer.scopes.test.ts`
- `lib/mcpServer.ts`
- `lib/outboundAuthorization.ts`
- `lib/testFixtures/verifyOutboundAuthorization.ts`
- `lib/testFixtures/verifySenderIdentity.ts`
- `messages/de.json`
- `messages/en.json`

## Offene Punkte und Übergabe

Keine bekannten funktionalen Blocker. Mailboxmenge und Modus sind nach Erstellung unveränderlich; Änderungen erfolgen über ein neues Token. Vollzugriff enthält die reservierte Sendeberechtigung, ergänzt aber keine MCP-Sendefunktion.

Build, vollständiges `test:ci` und optionale Browser-Screenshots wurden nicht ausgeführt; die Pflichtgates dieses Briefs sind bestanden. Es gab keine Pushes, PRs, Deployments oder Service-Neustarts. Alle Änderungen liegen im angegebenen Worktree; nur dieser Bericht wurde am ausdrücklich erlaubten Pfad außerhalb geschrieben. Temporäre Implementierungsskripte, Gate-Logs und synthetische Testdaten unter `.tmp` wurden nach der Berichterstellung entfernt.
