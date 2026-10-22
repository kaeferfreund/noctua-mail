<!-- Purpose: reviewable go-live operations index and decisions; runbook §2–§7; REVIEW BEFORE USE. -->
# Noctua operations scaffolding

**REVIEW BEFORE USE.** This is a review artifact, not an installation or a completed
go-live. No service, DNS, package, mailbox, real environment or secret was changed or
read while preparing it. Operational execution is separate. Nothing starts/enables
on checkout; both timers remain disabled until manually approved. Existing tracked
`ops/deploy-dev.sh`, `ops/noctua-dev.service` and `ops/noctua-fixture.service` were
left untouched; the new production scaffolding lives alongside them.

## Index

| File | Purpose |
|---|---|
| [systemd/noctua.service](systemd/noctua.service) | Single hardened production Bun server |
| [systemd/noctua-backup.service](systemd/noctua-backup.service) | Root oneshot, consistent app snapshot and NAS upload |
| [systemd/noctua-backup.timer](systemd/noctua-backup.timer) | Proposed 03:15 UTC daily app backup |
| [systemd/noctua-mailarchive.service](systemd/noctua-mailarchive.service) | Separate archive-host pull-only mbsync, locked |
| [systemd/noctua-mailarchive.timer](systemd/noctua-mailarchive.timer) | Proposed 01:00 UTC daily Maildir archive |
| [env/noctua.env.example](env/noctua.env.example) | Slice-6 runtime contract and watcher defaults/overrides |
| [caddy/Caddyfile](caddy/Caddyfile) | Tailnet bind, DNS-01, sanitized proxy headers and access logs |
| [caddy/README.md](caddy/README.md) | ARM plugin build, secrets, 443 conflict, log verification |
| [release/build-release.sh](release/build-release.sh) | Assemble a verified existing flat standalone tree |
| [release/verify-artifacts.py](release/verify-artifacts.py) | Evidence checksum coverage and symlink rejection |
| [release/activate-release.sh](release/activate-release.sh) | Pre-start backup, atomic symlink switch and 200/401 gate |
| [release/rollback.sh](release/rollback.sh) | Explicitly compatible code-only rollback |
| [release/README.md](release/README.md) | Clean build prerequisites, evidence format and privileges |
| [lib/operations.sh](lib/operations.sh) | Shared operation lock, evidence/link/health helpers |
| [backup/restic-backup.sh](backup/restic-backup.sh) | Stopped WAL-safe snapshot, restic upload/check and retention preview |
| [backup/db-manifest.py](backup/db-manifest.py) | Actual shard paths, SQLite checks and scratch-only rebasing |
| [backup/restic-restore-drill.sh](backup/restic-restore-drill.sh) | Download, verify, restore/rebase and isolated startup probe |
| [backup/README.md](backup/README.md) | Backup/archive configuration, manual retention and restore acceptance |
| [migration/imapsync-plan.md](migration/imapsync-plan.md) | Mailbox/folder/count templates, POP3 gate and rollback |
| [migration/imapsync-run.sh.example](migration/imapsync-run.sh.example) | Passfile-only dry-run/import/delta example |

## Order and privileges

1. Resolve runbook §8 inventory/questions and every integration gate; approve a
   release SHA, schema compatibility and evidence. Read the final slice-6
   `wt-auth-activation/doc/AUTHENTICATION.md`/`DEPLOYMENT.md` as read-only authorities.
   The slice-6 branch itself calls out unresolved Slice-5 shared-lock integration
   (AUTHENTICATION.md lines 757–764); these ops locks do not fix application locks.
2. Operator provisions ARM64 tools, accounts, directories and private files using
   runbook §2, adjusting the explicit path overrides below. App identity is `noctua`;
   Caddy uses `caddy`; archive host uses separately provisioned `noctua-archive`.
   `/srv/noctua/data` and `/var/cache/noctua` are private writable app directories;
   release, binary, env parent and installed ops tree are root-owned. Store runtime
   env root:root 0600 in parent 0700; no values go in git or review output.
3. Resolve Serve 443 ownership, tailnet DNS/device access and canonical origin;
   build/pin/validate Caddy, prove log redaction and DNS-01 renewal independently.
4. Set up NAS SFTP/SSH, restic repository, offline keys/second medium and pull-only
   Maildir archive with folder coverage. Complete initial backup/isolated restore
   acceptance and failure reporting. Both timers remain disabled until these pass.
5. In a separate clean integration checkout, build and record reviewed evidence.
   Package with `build-release.sh`; default dry run verifies without writing.
   Production secrets never enter builds. Retain old matching Bun binaries.
6. During the agreed maintenance window exclude every other writer, export backup
   configuration privately, review activation dry run, and later execute as root.
   Activation's off-box pre-deploy backup is mandatory, including initial empty setup.
7. Follow §4/§7: last MailPlus POP3 fetch then disable **all** POP3 fetches before
   INBOX import or Noctua mailbox creation; mapping dry run/import/delta/counts;
   final-contract signup/admin provisioning, offline full-folder Noctua indexing,
   counts, then watcher opt-in. Complete both persons' MFA, role, device, send/Sent
   and recovery acceptance before declaring go-live. MX remains at netcup.
8. Enable reviewed daily jobs manually, monitor them and certificate expiry; keep
   first-week/day-7 checks and immutable MailPlus history. Retention/decommission
   require their own successful restore and user approval.

Reading/dry runs need access only to specified paths. Assembly requires root writes
to `/srv/noctua/releases`; activation/rollback/backup require root for systemd,
private config/TLS, staging and links. Restore execution requires root **on a separate
isolated host**, for private network/mount sandbox and namespace HTTP probes.
Migration runs as a normal LAN operator with private passfiles. Scripts never invoke
sudo; the operator chooses the appropriate privileged session. Never run them with
xtrace, raw environment dumps, recordings or production secrets in arguments.

## Assumptions and explicit deviations

Runbook line numbers refer to the original 1,076-line file at docs HEAD `09e98f2`.
These are templates and targets; no runtime behavior has been demonstrated here.

| ID | Choice / assumption | Source |
|---|---|---|
| A01 | ARM64 Ubuntu and Bun **1.4.4**; operator supplies executable matching binary at `/opt/noctua/bin/bun`, preserves old versions | Task facts; runbook 31–33, 133, 474 |
| A02 | Flat Next 16 standalone, `current/server.js`, `/srv/noctua/releases/<full-sha>`; no timestamp ID or `/app` link | Task override; supersedes runbook 149–150, 215–226, 434–474 |
| A03 | Runtime env `/srv/noctua/env/noctua.env`, parent 0700/file root:root 0600 | Task override; replaces runbook 158, 172, 224, 808 |
| A04 | Port 3654, IPv4 loopback, data `/srv/noctua/data`, writable cache `/var/cache/noctua` | Runbook 7, 175–193, 237–248 |
| A05 | Canonical origin remains `https://mails.monkeymed.de`, RP ID hostname only, tailnet IP `100.92.134.1` | Runbook 7, 181–182, 331–350; slice-6 final environment |
| A06 | Alternative Caddy port 8443 is only a proposal; check availability and get origin/callback exception first | Assumed port, task permits alternative; conflicts with portless requirement at runbook 266 |
| A07 | Moving existing Serve endpoint to 8446/other host needs its owner's agreement; preserve unrelated endpoints | Runbook 266–278, 1070 |
| A08 | 64 MB whole request limit, 15-minute header/body limits, indefinite SSE; validate pinned Caddy version | Runbook 319–363; proposed values, not proven maxima |
| A09 | Netcup Legacy DNS credentials and `/var/lib/caddy` state, own `caddy` service; provider/version not yet approved | Runbook 280–313, 809 |
| A10 | Suppress Caddy runtime diagnostics and omit all access URIs/headers/TLS metadata; prove synthetic redaction before enabling access logs | Slice-6 nginx-auth.conf; assumed stricter Caddy implementation, runbook 363/395 requires proof |
| A11 | Start watcher off; cap worker concurrency at **1** despite code default **2**; all intervals retain documented defaults | Runbook 187–193/712; watcher DEPLOYMENT env table/reconnect paragraph |
| A12 | Assemble existing evidence-bound artifacts, no build/install in packaging; all build/tests/approval occur separately | Assumed workflow split; runbook 403–428 requires evidence; task prohibits running builds here |
| A13 | Evidence is operator attestation; SHA256 coverage and no symlinks in artifacts conservatively gate packaging | Assumed guardrails; runbook 430/474–476 requires release proof |
| A14 | Install this ops tree at `/opt/noctua/ops`; GNU Linux shell tools, Python **3.11+**, systemd namespaces/PrivateNetwork and nsenter available | Assumed installation path/version capabilities; runbook 133 requires Python/tools, not exact version |
| A15 | Shared operations flock, root-only review markers and explicit no-writers confirmation; manual writers still excluded separately | Assumed guardrails; runbook 482, 818, 873–894 requires global writer stop |
| A16 | App backup stops app/Caddy, captures full data with residual WAL/SHM, includes all in-root actual shards and rejects external paths/symlinks | Runbook 793–833/848–894; conservative fail-closed path policy assumed |
| A17 | Restic SFTP repository already initialized, private SSH/hostkey and password file ready; Caddy paths/drop-in and empty first-install data must exist | Runbook 839–848/894; initial-release empty snapshot behavior assumed |
| A18 | Daily app backup 03:15 UTC + 5m jitter, retention **preview** 14 daily/8 weekly/12 monthly; deletion/prune manual after restore approval | Runbook 837, 915–933 |
| A19 | Daily archive at **01:00 UTC**, maximum run 6h, archive identity `noctua-archive`, NAS path `/volume1/noctua-mail-archive`; archive host needs Linux/systemd or a separately adapted NAS scheduler | Time/account/host requirements assumed; proposed volume and daily pull runbook 939–971 |
| A20 | Cross-host archive completion is an operator gate; service ordering cannot guarantee NAS job completion | Assumed explicit limitation; runbook 837/923 asks backup after archive |
| A21 | RPO ≤24h, RTO 2h, six-month MailPlus preservation, two successful local stages and 12 monthly mail generations are proposals needing sign-off | Runbook 837, 933, 971, 1058–1060 |
| A22 | Restore is on a dedicated isolated host, new `/srv/noctua-drills/<name>` scratch, port **3796**, copied shard rebasing, transient systemd sandbox; auth/device/content acceptance remains manual | Scratch/port/sandbox assumed; runbook 979–1000 requires isolation and scratch rebase |
| A23 | Health gate 200 at `/api/ba/ok`, unauthenticated 401 at `/api/auth/me`, 30 retries at 2s with 3s request timeouts; only loopback HTTP, no full readiness claim | Endpoints per task/slice 6/runbook 504; timing assumed |
| A24 | No automatic rollback after startup/schema changes; explicit schema/key/Bun compatibility, preserve previous anchor and newer data | Runbook 506–508; retaining anchor instead of swapping previous assumed |
| A25 | Per-mailbox serial imapsync, passfiles, TLS verification, no expunge/deletes; signed mapping/POP3/dry-run markers, including POP3 sign-off even before the example dry-run | Runbook 514–520/524–612; conservative sign-off markers assumed |
| A26 | Migration account/folder/log/count inventory is private; actual endpoints/logins/shared namespace and folder encoding remain unknown | Runbook 30, 46, 537–549, 606–610, questions 1/2/4 |
| A27 | Security header choices: no-referrer, nosniff, DENY framing, HSTS max-age=31536000 (no includeSubDomains), remove Server; validate app behavior | no-referrer from final nginx-auth.conf; other concrete header values assumed to satisfy requested security headers |
| A28 | Metadata repository check after each upload, full read-data check in drill, no automatic prune; archive/private backup paths must exist first | Check cadence assumed; runbook 925–933 requires repository/restore verification |

## Final slice-6 differences from the older runbook

There is **no direct contradiction in the environment assignments** at runbook
175–195: required final auth variables, DB storage, canonical origin, independent
keys, telemetry off and unset list agree. Watcher and runtime entries are additional
operational settings. `TRUSTED_PROXY_HOPS=1` alone still does not configure every
Better Auth behavior; slice 6 confirms the pinned reader uses sanitized XFF.

The surrounding deployment/provisioning instructions are stale:

- Runbook 29, 170, 200, 718 and 734 treat slice-6 activation/proxy/migration as
  unavailable; the supplied final branch documents an activated handler, final env,
  migration/recovery commands, **and** a remaining Slice-5 lock integration prerequisite.
  Availability on that branch does not prove integration/household go-live readiness.
- Runbook 260, 395 and 724–727 expect a bootstrap invite in startup journal. Slice 6
  logs readiness only: retrieve privately with the stopped-app `recoverTeamAuth.ts`
  bootstrap-invite command in AUTHENTICATION.md, never grep ordinary startup logs.
- Runbook 750 and 766 describe self-service `POST /api/accounts` creation. Final
  slice 6 makes it repair-only (`account_not_found` for absent mailboxes); creation
  uses invite signup or the ownerless admin route. Personal ownership planning must
  be reconciled with final route behavior before actual provisioning.
- Runbook 363 leaves access logging off until token redaction is proven. The supplied
  Caddy template is reviewable redaction/omission scaffolding, **not** that proof;
  its README requires synthetic validation before logging is enabled in production.
- The alternative :8443 site changes the exact production origin/reset callback and
  needs explicit acceptance; default files keep slice-6's portless production origin.

Only a short cross-reference was appended to the runbook, per task scope; these stale
instructions were not silently rewritten. Read the final auth contract before use.

## Open user decisions

Runbook §8 **questions 1–9 remain open**: mailbox/sender/role inventory; NAS owners,
namespace/folders/history/sizes; labels/rules/signatures/contacts/calendars and English
UI acceptance; netcup quotas/UIDPLUS/limits; Serve owner/port choice and device DNS;
SFTP target/backup identity/offline medium/retention/RPO/RTO; maintenance windows and
MailPlus lifetime; actual devices/factors/recovery operator/key custody; attachment
maximum and parallel clients. Additionally approve exact Caddy/provider/tool versions,
archive execution host/path/time, alert recipient/mechanism, evidence reviewer and
the final integration SHA. No secret answers belong in chat or git.

## What is NOT automated

- Packages, user/group creation, installation of binaries/units/ops files, ownership,
  permissions, service reload/enable, timers, firewall, Tailnet ACLs/DNS or Serve changes.
- Reading/creating secrets, key rotation, offline custody, netcup DNS API provisioning,
  restic init, SSH hostkey/identity setup, NAS volumes/snapshot/offline jobs.
- Running application install/tests/builds, merging branches or closing auth shared-lock
  prerequisites, signing evidence, validating Caddy with DNS credentials or renewing TLS here.
- Mailbox inventory, POP3 stopping/proof, rules/aliases/sender decisions, remote cleanup,
  Noctua fullsync, personal onboarding/ownership/MFA/recovery or household acceptance.
- Cross-host archive completion checks, alerts, certificate expiry monitoring, retention
  deletion/prune, old-release/staging cleanup, production data restore/schema rollback,
  physical phone/passkey/content restore acceptance or MailPlus decommissioning.
- Pushes, PRs, deployments or any network call as part of preparing these files.

## Validation of this change

ShellCheck (`-x -P SCRIPTDIR`) passed for every new shell file, including the sourced
helper and migration example. Bash syntax checks, Python AST parsing, required header
checks and git whitespace checks passed. No application installs/tests/builds, Caddy
validation, systemd execution, backup/restore, migration, DNS or other network calls
were run. Runtime tool/version compatibility and all live acceptance remain open.

## Dry-run 2026-10-22: production build and synthetic operations

This supersedes the syntax-only validation statement above for the paths exercised
here. Full command/result evidence is in
[release/dry-run-2026-10-22.json](release/dry-run-2026-10-22.json).
Build checkout: detached `164a57e0224ad48a1a0843947fcd19efeb59ae4f`; no git changes
or commits there. All execution/staging used `release-dryrun-scratch/` under the
project root, synthetic data/keys, installed tools and `nice -n 10`; no installs,
external network, production paths, sudo, systemd or Caddy operations. Local HTTP
used newly assigned ports **3822/3823** after an unrelated process occupied the
initial allocation; that process was never signaled.

- `timeout 1200 bun run build` and standalone worker verification passed. Runtime
  config generation passed with `ENV_FILE=/dev/null APP_ENV_LABEL=Production`.
  `test:ci` was not run. Actual lint failed with one existing calendar-hook error
  and 27 warnings. Evidence containing `test:ci=dry-run: tests not executed` was
  rejected (exit 1); a separate file explicitly labelled SYNTHETIC was accepted
  solely to test packaging. No release approval was issued.
- Flat assembly, exact static/public copies, all six Inter font subsets, traced
  dependencies, external Bun 1.4.4 and source/package checksum coverage passed.
  A tampered public file failed verification (exit 1); restoring its bytes passed.
  Six generated dependency symlinks required explicit `cp -aL` in scratch. The
  assembler now supports scratch paths and records an assembled-layout manifest;
  activation/rollback verify it. Checkout-root synthetic `.env.local` is excluded
  without blocking assembly; environment files inside packaged trees remain forbidden.
- Activation and rollback exercised real packaged Bun servers and atomic links,
  but the required HTTP gate **failed**, correctly leaving the owned server stopped.
  The requested localhost RP ID with a 127.0.0.1 URL first failed instrumentation;
  with RP ID corrected to 127.0.0.1, actual HTTP was **503/401**, not 200/401.
  The supplied app deliberately returns `auth_integration_pending` on BA routes;
  its AUTHENTICATION.md lacks the promised final Slice-6 environment section.
  The required gate was preserved. A synthetic second revision reused the same
  build; no cross-version/schema compatibility was claimed.
- Restic and Caddy are absent. No repository was initialized or downloaded. An
  explicitly labelled local PATH test double exercised backup/check/forget and
  restore flow only. Injected restic-check failure (exit 42) resumed the original
  app, and the operation lock did not leak into its child process. Restore verified
  all eight archive checksums, rebased the master + encoded synthetic account shard,
  passed SQLite integrity/foreign keys, then failed the same 503/401 HTTP gate on
  port 3823 and stopped its process. A real defect was fixed: GNU tar emitted 309
  valid dependency hardlinks that restore previously rejected; regular in-archive
  hardlink targets are now validated and accepted. No real encrypted repository,
  off-box durability or systemd namespace isolation was proven by the stub.

ShellCheck, Bash syntax, Python AST and git whitespace checks pass for the changed
scripts. The scratch environment parser rejects duplicate assignments and treats
command substitution as literal text. The actual `db/main.db` and
`db/accounts/<encodeURIComponent(id)>.db` layout passed unchanged `db-manifest.py`;
no database path workaround was needed. Scratch data, archives, runtime PIDs, stub
and build logs are removed after copying this short evidence record. Build outputs
remain in the designated build checkout as authorized.

Operator work remains: supply the final activated Slice-6 integration build, resolve
lint, run the full test/acceptance gates, generate honest reviewed evidence, and
repeat successful 200/401 activation/rollback. On the separate prepared production
and restore hosts, provision/review the pinned ARM64 Bun and Caddy/plugin versions,
private runtime/backup files and SSH host keys, initialize the intended restic
repository separately, run real backup/check/read-data/restore plus household
acceptance, validate units/isolation, TLS/DNS/proxy redaction/renewal and alerting,
and approve timers only after those checks. Nothing here enables jobs or authorizes
a production deployment. Use the exact release and backup procedures linked above.
