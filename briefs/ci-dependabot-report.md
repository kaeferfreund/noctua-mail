# CI und Dependabot – Implementierungsbericht

Worktree: `/home/monkey/code/noctua-mail/wt-ci-setup`  
Branch: `chore/ci-dependabot`  
Basis: `bdde6c9e` (`0.2.0-alpha.1`)  
Implementierungscommit: `a42a85a27126afc05da5338bcfbf81bba03aaac7`  
Basis-Commit (vollständig): `bdde6c9eac4f24bd5d4826860ae0c183ef3561f2`

## Geänderte Dateien und Entscheidungen

- `.github/workflows/ci.yml`: vier unabhängige Jobs `Typecheck`, `Lint`, `Tests`, `Build` auf `ubuntu-latest`. Push auf `main`, `team-inbox`, `integration/stage`, `deploy/dev-stage`; Pull Requests ohne Branchfilter. Bun exakt `1.4.4`, passend zu `packageManager` (keine `.bun-version` vorhanden), Installation jeweils mit `--frozen-lockfile`. Cache ausschließlich für `~/.bun/install/cache`, nach OS, Architektur, Bun-Version und `bun.lock` getrennt. `contents: read`, Abbruch überholter Runs je Ref/PR, Zeitlimits 10/15/30/20 Minuten.
- Tests führen unverändert `bun run test:ci` aus: Unit-Tests mit 20 Sekunden Testtimeout, danach DOM-Tests in deren eigener Bun-Konfiguration. Bash `pipefail` erhält den Fehlerstatus bei Logausgabe über `tee`; bei Fehlern wird `.tmp/test-ci.log` für sieben Tage hochgeladen, einschließlich des versteckten Pfads.
- Build nutzt ausschließlich die synthetischen Build-Werte aus dem Go-live-Runbook §3.1, Watcher aus, Daten unter `.tmp/build-data`. Vor `bun run build` wird die synthetische öffentliche Runtime-Konfiguration erzeugt. Keine Repository-Secrets erforderlich. Native SQLite-Unterstützung kommt aus `bun:sqlite`; für diese Jobs wurde kein zusätzlicher Systempaketbedarf identifiziert. Sharp wird über die Lockdatei plattformspezifisch installiert.
- `.github/dependabot.yml`: natives `package-ecosystem: bun`, statt `npm`. GitHub unterstützt Bun ab 1.1.39 und die vorhandene Textdatei `bun.lock`; das alte Binärformat `bun.lockb` ist nicht unterstützt. Quelle: [GitHub: unterstützte Ökosysteme](https://docs.github.com/en/code-security/reference/supply-chain-security/supported-ecosystems-and-repositories#bun).
- Bun- und `github-actions`-Versionsupdates laufen montags um 06:00 UTC, beide mit Ziel `integration/stage`. Minor/Patch gemeinsam je Ökosystem, Majors einzeln; offene Versions-PRs begrenzt auf fünf für Bun und drei für Actions. Kein Auto-Merge. Sicherheitsupdates verwenden unabhängig von `target-branch` weiterhin den Default-Branch und dessen Sicherheitsupdate-Einstellungen. Quelle: [GitHub: target-branch](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference#target-branch).
- `.github/workflows/build-and-push.yml`, `deploy-dev.yml`, `deploy-prod.yml`: erhalten, alle Jobs durch `github.repository == 'paulwellnerbou/noctua-mail'` für diesen Fork gesperrt, auch bei manuellem Start. Der bestehende Erfolgs-/Manuell-Filter von `deploy-dev` bleibt zusätzlich erhalten. Der Containerworkflow enthält automatische Registry-Pushes und zusätzliche lange Gates; er wird deshalb nicht als Fork-CI weiterverwendet. Keine neuen Deploy-Workflows.
- `README.md`: kurzer CI-Abschnitt mit Badge für `ci.yml` auf `main`, Prüfungsumfang, Fehlerlogs, manuelle Deployments und Dependabot.

## Lokale Prüfungen

Alle schweren Prüfungen nacheinander mit `nice -n 15`, `TMPDIR=<worktree>/.tmp`, Bun `1.4.4`:

- `bun check`: erfolgreich, 1.342 Dateien, keine Typfehler.
- `bun run lint`: Exit 0, 0 Fehler, 168 Warnungen in unveränderten Anwendungsdateien; keine Diagnosen für die geänderten Dateien. Keine Warnungsregeln geändert.
- `bun test lib/db/schema.master.test.ts`: einmal ausgeführt, 8 bestanden, 0 fehlgeschlagen, 43 Assertions.
- `bun --bun build-scripts/generateRuntimeConfig.ts` und `bun run build` mit dem synthetischen Runbook-Environment: erfolgreich, inklusive Next.js-Produktionsbuild, anschließender Typprüfung (1.343 Dateien, keine Typfehler) und `prepareStandaloneShutdown.ts`.
- `actionlint` 1.7.7 mit installiertem ShellCheck auf allen vier `.github/workflows/*.yml`: erfolgreich, keine Diagnosen. Validator nur nach `.tmp` heruntergeladen.
- Dependabot-YAML mit Buns YAML-Parser gelesen, Struktur und Optionen gegen GitHub-Dokumentation geprüft. `git diff --check`: erfolgreich.

`test:ci`, Stress-, Browser-, Docker- und zusätzliche Standalone-Worker-Tests wurden nicht lokal ausgeführt. Der Auftrag belässt die vollständige Testsuite beim Orchestrator auf Stage. Playwright/Auth-Browserprüfungen sind ein separater bestehender Release-Gate und kein Bestandteil dieser CI. Ein tatsächlicher GitHub-Actions-Run konnte lokal nicht ausgeführt werden; Runner-Kompatibilität und Dependabot-Ausführung sind nach dem Merge erstmals auf GitHub zu bestätigen. Der bekannte LoginScreen-DOM-Flake bleibt unverändert.

Generierte Build-Version wurde auf den vorgefundenen Inhalt zurückgesetzt. Die neu erzeugten lokalen Build-/Runtime-/Scratch-Artefakte wurden entfernt. Keine App-Code-, Manifest- oder Lockdateiänderungen; keine realen Secrets, externen Mailverbindungen, Pushes, PRs, Deployments oder Serviceänderungen.

## Nach dem Merge durch den Orchestrator

1. `test:ci` auf dem integrierten Stage-Stand gemäß Projektregeln ausführen. Die Dateien bei der Release-Übernahme auch nach `main` bringen: die Dependabot-Konfiguration muss auf dem Default-Branch vorhanden sein. `integration/stage` muss als Update-Ziel bestehen bleiben.
2. GitHub Actions für `kaeferfreund/noctua-mail` aktivieren, falls der Fork sie noch deaktiviert hat (Actions-Tab bzw. Settings → Actions → General). Die verwendeten Actions `actions/checkout`, `actions/cache`, `actions/upload-artifact`, `oven-sh/setup-bun` zulassen; keine Schreibrechte oder Deploy-Secrets für die neue CI erforderlich. Ersten Push-/PR-Run auf GitHub prüfen.
3. Im Fork unter Settings → Advanced Security → Dependabot → **Dependabot version updates** explizit aktivieren. Eine vorhandene YAML-Datei allein aktiviert Versionsupdates auf Forks nicht. Dependency Graph und Dependabot Alerts prüfen/aktivieren; Security Updates nach gewünschter Repo-Policy aktivieren. Unter Insights → Dependency graph → Dependabot beide Update-Jobs und deren Logs kontrollieren. Quelle: [GitHub: Versionsupdates auf Forks aktivieren](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/secure-your-dependencies/configure-version-updates#enabling-version-updates-on-forks).
4. Nach dem ersten erfolgreichen GitHub-Run Branchschutz/Rulesets für `main` und `integration/stage` einrichten: die vier Checks **Typecheck**, **Lint**, **Tests**, **Build** als Pflichtchecks aus dem CI-Workflow auswählen. Den gewünschten Review-/Bypass-Modus an die bestehenden Fast-Forward- und manuellen Integrationsabläufe anpassen; die drei gesperrten Upstream-Jobs nicht als Pflichtchecks wählen.

Der Bericht liegt wie beauftragt außerhalb des Worktree-Git-Repositories und ist nicht Teil des Implementierungscommits. Repository-Einstellungen wurden nicht verändert.
