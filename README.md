# Noctua Mail

Noctua Mail is a self-hosted IMAP/SMTP web client for a household with personal
and shared mailboxes. This standalone fork of
[paulwellnerbou/noctua-mail](https://github.com/paulwellnerbou/noctua-mail) is being
adapted as a replacement for Synology MailPlus. People sign in with their own
application identity and receive access to specific mailboxes; sharing a mailbox
does not require sharing an application login. The installed app is named **Mail**.

The fork lives at [kaeferfreund/noctua-mail](https://github.com/kaeferfreund/noctua-mail).
Implemented features below describe this checkout, not completed household
migration or production acceptance. The package version is `1.0.7`.

## Features

- **Team inboxes:** personal and shared mailboxes, mailbox switching, unread and
  assignment summaries, and live updates. Mailbox roles are `viewer` (read),
  `editor` (mail and collaboration actions) and `manager` (also mailbox settings
  and membership). Ownership grants manager access; instance administrators do
  not automatically get access to every mailbox.
- **Personal authentication:** Better Auth application passwords, mandatory TOTP
  enrollment before mailbox access, recovery codes, optional passkeys with user
  verification, session management and administrator invitations. Password reset
  links are handed over personally; recovery does not send email. Optional IMAP
  first-factor login is disabled by default and restricted to eligible personal
  mailboxes on an explicit host allowlist.
- **Collaboration:** thread status (`open`, `in_progress`, `waiting`, `closed`),
  assignments, internal Markdown notes, activity history and sender attribution.
  Shared Sent copies and reply/forward flags help coordinate work. Sending does
  not automatically close a thread.
- **German and English UI:** next-intl catalogs, personal language preferences,
  device/browser language resolution and German fallback. The responsive shell
  has phone navigation, desktop split/focus reading, dark mode and deep links.
- **Mail:** IMAP folder synchronization, SMTP send/reply/forward, attachments,
  cross-folder threads, drafts and rich-text, plain-text or Markdown composing.
  Reader modes include HTML, text, Markdown and source. Remote images start
  blocked; users can load once or allow a recognized sender. Remote CSS resources
  stay blocked after image opt-in. An opened unread message is marked read after a
  personal delay (default 1 second; immediately, 3 seconds or never). `\Seen` is
  shared IMAP state, so the read status applies to every member of the mailbox.
- **Sender identities:** mailbox aliases with display name and Reply-To, manager
  configuration, personal defaults and signatures, and a From selector in the
  composer. Outbound validation covers drafts, SMTP and calendar replies;
  identities use the mailbox transport rather than creating separate IMAP logins.
- **Search and organization:** SQLite FTS5, field operators, folder/all-folder
  search within a mailbox, related messages (`related:`), invitation UID search
  (`invite:` / `event:`), topics with learned suggestions, and newsletter,
  notification and transactional categories with feedback learning. Workflow
  views include Focused, Action Queue, Invite Deck and collaboration queues.
- **Spam detection:** optional Anthropic classification with feedback examples,
  authenticated trusted-sender profiles, correspondent/own-address allowlists
  and static rules. Suspicious mail can be reviewed and corrected. Automatic
  movement to Junk is a separate mailbox option, off by default. Enabling model
  classification sends selected headers, text excerpts and attachment metadata
  to the configured provider; it is not a purely local classifier.
- **Calendar:** local events, ICS invitation import and responses, recurring
  events, reminders, and optional CalDAV synchronization with conflict handling.
  Invitation updates/cancellations feed calendar and reminder state.
- **PWA and Web Push:** installable on phones and desktops, device subscriptions,
  mailbox selection, quiet hours, subject visibility and unread badges where
  supported. New-mail push can reach a closed app when server and device are
  configured; iOS needs a home-screen installation. Invitation reminders also
  have service-worker notification handling.
- **MCP:** authenticated HTTP endpoint at `/api/mcp` with mailbox-scoped tokens
  for search, retrieval, drafts, topics, flags and collaboration. Tokens can
  cover several accessible mailboxes and narrow permissions with read/drafts/full
  modes. There is currently **no MCP send tool**, including in full mode. The
  server introduces itself as "Noctua Mail" with instructions that tell AI clients
  such as Claude to use it for the user's e-mail, and results link to the created or
  changed item in the app (see [API](doc/API.md#mcp-server-identity-tool-metadata-and-links)).

See the [documentation index](#documentation-index) for contracts and limitations.

## Stack

Versions and ranges below are declared in [package.json](package.json);
[bun.lock](bun.lock) resolves dependency ranges.

| Component | Declared version / implementation |
| --- | --- |
| Runtime / package manager | Bun `1.4.4` (`bun:sqlite` is required; Node alone is insufficient) |
| Framework | Next.js `16.4.3`, App Router, standalone output |
| UI | React / React DOM `19.3.1`, Radix Themes `^3.3.0`, shadcn components, Tailwind CSS `^4.3.3` |
| Language / localization | TypeScript `^6.0.3`, next-intl `4.14.9` |
| Authentication | better-auth and `@better-auth/passkey` `1.7.12` |
| Mail | ImapFlow `^2.9.1`, Nodemailer `^10.2.1`, mailparser `^3.12.4` |
| Storage | SQLite master plus account shards, WAL, FTS5 with the v3 identity map |
| Editor / calendar | Lexical `^0.52.0`, FullCalendar React `^7.1.3`, tsdav `^2.5.0` |
| Integrations | MCP SDK `1.32.2`, AI SDK `7.0.152`, web-push `^3.6.7` |

## Getting started

Use Bun 1.4.4 and a separate data directory for each installation. From the
checkout root:

```sh
bun install --frozen-lockfile
```

Create a private `.env.local` using the example below. Replace both secret
placeholders with independent random values of at least 32 characters. Keep an
existing installation's encryption key when upgrading; replacing it makes stored
credentials unreadable. These are local development settings, not production keys:

```dotenv
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=REPLACE_WITH_AN_INDEPENDENT_RANDOM_AUTH_SECRET
IMAP_SECRET_KEY=REPLACE_WITH_AN_INDEPENDENT_RANDOM_ENCRYPTION_KEY
IMAP_CREDENTIALS_STORAGE=db
BETTER_AUTH_TELEMETRY=0
NOCTUA_DATA_DIR=./.data
TRUSTED_PROXY_HOPS=0
```

```sh
bun run dev
```

Open `http://localhost:3000`, Next's default development port. If you change the
port, update `BETTER_AUTH_URL` to match. The scripts read `.env.local` by default;
`ENV_FILE` selects another environment file for `dev` and `start`.

A new installation needs the initial administrator invitation. After the first
startup, stop the application and follow the
[offline bootstrap procedure](doc/AUTHENTICATION.md#offline-migration-and-bootstrap-runbook)
to retrieve it in a private terminal. Restart, register the personal administrator,
complete TOTP enrollment and keep recovery codes offline. Then create mailboxes
and grant access in administration. An IMAP mailbox password alone is not an
application login. Existing installations must follow the migration procedure
rather than bootstrap again.

For local mail development, `bun run dev:fixture` starts synthetic loopback IMAP,
SMTP and control services; it does not start the web application or bypass auth.
Read [DEV-FIXTURES.md](doc/DEV-FIXTURES.md) for ports, mailbox provisioning and
isolated storage before using it. Never point fixture tooling at real mail data.

### Commands and tests

| Command | Purpose |
| --- | --- |
| `bun run dev` | Generate runtime branding and start Next development mode |
| `bun run dev:fixture` | Run the synthetic mail fixture alongside a separately configured app |
| `bun check` | Bun typecheck, also used by CI and the `typecheck` script |
| `bun run lint` | Run ESLint across the checkout |
| `bun run test` | Run backend tests, then the DOM test suite |
| `bun run test:dom` | Run DOM tests with `bunfig.dom.toml` |
| `bun run test:ci` | Run the same backend-plus-DOM command used in CI |
| `bun run build` | Generate build identity, build Next, typecheck and prepare standalone shutdown |
| `bun run start` | Generate runtime branding and serve the built application via Next |

`bun test` by itself runs the Bun backend suite; use `bun run test` for both
backend and DOM tests. Browser tests are separate; see the focused procedures in
[AUTHENTICATION.md](doc/AUTHENTICATION.md#browser-acceptance),
[DEEP-LINKS.md](doc/DEEP-LINKS.md#focused-verification) and
[HTML-MAIL-PRIVACY.md](doc/HTML-MAIL-PRIVACY.md).

[CI](.github/workflows/ci.yml) runs typecheck, lint, backend/DOM tests and a
production build on pull requests and pushes to `main`, `team-inbox`,
`integration/stage` and `deploy/dev-stage`. Build secrets there are synthetic.
Inherited GitHub deployment workflows are guarded for upstream and do not deploy
this fork.

## Configuration

This inventory covers application-owned runtime/build settings read by the
source, including `env.NAME` and the computed spam authserv-id lookup, not just
literal `process.env.NAME` accesses. Test-harness variables and framework-private
variables are not deployment settings. Defaults mean unset values. Mailbox
IMAP/SMTP, CalDAV and translation settings are stored through the application;
there are no invented global mail-server environment variables here.

### Required authentication and credential settings

| Variable | Default | Purpose |
| --- | --- | --- |
| `BETTER_AUTH_URL` | none; required | Explicit canonical HTTPS origin; HTTP is allowed only on loopback development hosts |
| `BETTER_AUTH_SECRET` | none; required | Independent auth secret, at least 32 characters |
| `IMAP_SECRET_KEY` | none; required | Mailbox credential encryption key, at least 32 characters; retain with backups |

### Optional authentication and runtime settings

| Variable | Default | Purpose |
| --- | --- | --- |
| `IMAP_CREDENTIALS_STORAGE` | `db` | Encrypted DB credentials; `both` is a deprecated DB-only alias, `cookie` is rejected |
| `PASSKEY_RP_ID` | canonical URL hostname | Passkey relying-party ID; must equal that hostname |
| `BETTER_AUTH_TELEMETRY` | unset; disabled in auth options | May be unset or `0`; other nonempty values are rejected |
| `BETTER_AUTH_TELEMETRY_ENDPOINT` | unset | Must remain unset; custom telemetry endpoints are rejected |
| `NOCTUA_TRUSTED_ORIGINS` | canonical origin only | Optional comma-separated canonical origin; any additional origin is rejected |
| `NOCTUA_IMAP_LOGIN_HOSTS` | empty; login off | Exact host allowlist for eligible personal IMAP first-factor login; never shared mailboxes |
| `NOCTUA_DESKTOP_MODE` | unset; server mode | `true` is rejected; native desktop mode is unsupported |
| `TRUSTED_PROXY_HOPS` | `1` | Trusted forwarding hops for Noctua's rate limits; `0` ignores forwarded IPs and uses one unknown-client bucket |
| `NOCTUA_DATA_DIR` | `../noctua-data` from working directory | Runtime storage root; use an absolute path in production |
| `ACCOUNT_DB_IDLE_MS` | `300000` | Close idle shard connections after this interval; `0` disables idle closing |
| `ACCOUNT_DB_CACHE_KIB` | `32768` | SQLite cache budget per shard connection; invalid values or values below 2000 use the default |
| `ENV_FILE` | `.env.local` | Environment file selected by `dev`/`start` and the runtime-config generator |
| `APP_ENV_LABEL` | empty | Branding suffix; runtime-config generation also reads it from the selected env file |
| `NOCTUA_STATIC_APP_TITLE` | empty; derived title | Static title override used for Docker's build-time title placeholder |
| `APP_TITLE` | derived from `Mail` and environment label | Internal Docker entrypoint handoff for title replacement; not an independent operator override |
| `NOCTUA_BUILD_HASH` | absent | Build commit identity; falls back to `NEXT_PUBLIC_BUILD_HASH` |
| `NOCTUA_BUILD_TIME` | absent | Build timestamp; falls back to `NEXT_PUBLIC_BUILD_TIME` |
| `NEXT_PUBLIC_BUILD_HASH` | absent | Compatibility build-hash input, also set by Docker build arguments |
| `NEXT_PUBLIC_BUILD_TIME` | absent | Compatibility build-time input, also set by Docker build arguments |

Auth parsing is in [lib/betterAuth.ts](lib/betterAuth.ts), credentials in
[lib/secret.ts](lib/secret.ts), paths in [lib/runtimePaths.ts](lib/runtimePaths.ts),
cache defaults in [lib/db/connection.ts](lib/db/connection.ts), and branding/build
identity in [lib/appBranding.ts](lib/appBranding.ts) and
[lib/buildVersion.ts](lib/buildVersion.ts). Build identity normally comes from the
packaged artifact; runtime environment is the fallback and the development source.
Bind production to loopback behind a proxy that overwrites Host and forwarded
headers; the auth library's IP handling is separate from `TRUSTED_PROXY_HOPS`.

### Background synchronization and search

| Variable | Default | Purpose |
| --- | --- | --- |
| `NOCTUA_MAILBOX_WATCHER` | off | Exactly `1` enables background INBOX IDLE and periodic checks on the server |
| `NOCTUA_WATCHER_INTERVAL_MS` | `300000` | Per-mailbox fallback check interval |
| `NOCTUA_WATCHER_ACCOUNTS_INTERVAL_MS` | `30000` | Reload mailbox definitions and credentials |
| `NOCTUA_WATCHER_RECONNECT_MIN_MS` | `60000` | Minimum watcher reconnect backoff |
| `NOCTUA_MAX_SYNC_WORKERS` | `2` | Shared sync subprocess concurrency limit |
| `NOCTUA_SYNC_WORKER_TIMEOUT_MS` | `600000` | Sync worker execution deadline |
| `NOCTUA_FTS_DRIVEN_MAX_CANDIDATES` | `2000` | Candidate limit for FTS-driven searches; maximum 32000, larger searches use the legacy query path |
| `NOCTUA_DISABLE_FTS_DRIVEN_SEARCH` | unset | Exactly `1` forces the legacy query path without changing the index |

The worker launcher supplies `NOCTUA_SYNC_LEASE_JOB_ID` (unset by default, lease
job ID), `NOCTUA_SYNC_LEASE_OWNER` (unset, lease owner) and
`NOCTUA_SYNC_WORKER_SOURCE` (unset; `watcher` disables worker-local rapid retries)
to child processes. These are internal handoff values, not operator settings.
Sources: [watcher](lib/mailboxWatcher.ts), [sync jobs](lib/syncJobs.ts),
[worker](lib/workers/runSyncJob.ts), [search](lib/db/messages/query.ts).

### Spam detection and Web Push

| Variable | Default | Purpose |
| --- | --- | --- |
| `NOCTUA_SPAM_ENABLED` | off | `1` or `true` enables detection unless overridden in admin settings |
| `NOCTUA_SPAM_PROVIDER` | `anthropic` | Only implemented model provider |
| `NOCTUA_SPAM_MODEL` | `claude-haiku-5-5` | Model ID; admin settings can override |
| `NOCTUA_SPAM_THRESHOLD` | `0.85` | Spam confidence threshold, valid range 0.5–1; admin/mailbox settings can override |
| `ANTHROPIC_API_KEY` | unset | Required for model calls (spam detection, AI reply drafts); allowlist, static and trusted-sender checks can work without it |
| `NOCTUA_AI_REPLY_MODEL` | `claude-opus-5-5` | Model for the reader's „KI-Antwort“ draft ([AI-REPLY.md](doc/AI-REPLY.md)) |
| `NOCTUA_SPAM_RULES_FILE` | `<data-dir>/spam-static-rules.json` | Static rules file; missing/unreadable file means no static rules |
| `NOCTUA_SPAM_AUTHSERV_ID` | empty; infer receiving server | Comma-separated exact receiving authserv-ids used to select Authentication-Results |
| `NOCTUA_VAPID_PUBLIC_KEY` | unset; push off | Base64url VAPID public key; all three VAPID values must be valid |
| `NOCTUA_VAPID_PRIVATE_KEY` | unset; push off | Private VAPID key; keep stable and private |
| `NOCTUA_VAPID_SUBJECT` | unset; push off | Push-service contact URI (`mailto:` or `https:`) |

Sources: [spam configuration](lib/mail/spam/config.ts),
[static rules](lib/mail/spam/staticRules.ts), [header input](lib/mail/spam/input.ts),
[push configuration](lib/push/server.ts). See
[SPAM-DETECTION.md](doc/SPAM-DETECTION.md) and
[PUSH-NOTIFICATIONS.md](doc/PUSH-NOTIFICATIONS.md) before enabling them.

### Mail transport tuning

All timeout values are milliseconds. Normally leave these unset.

| Variable | Default | Purpose |
| --- | --- | --- |
| `IMAP_LOG_LEVEL` | `info` | IMAP logging level |
| `IMAP_CONNECTION_TIMEOUT_MS` | `90000` | IMAP connection budget |
| `IMAP_GREETING_TIMEOUT_MS` | `16000` | IMAP greeting budget |
| `IMAP_SOCKET_TIMEOUT_MS` | `480000` | IMAP socket timeout |
| `IMAP_CONNECT_RETRY_COUNT` | `2` | Additional connection attempts; `0` disables retries |
| `IMAP_CONNECT_RETRY_BASE_DELAY_MS` | `250` | Initial retry delay |
| `IMAP_CONNECT_RETRY_MAX_DELAY_MS` | `2000` | Maximum retry delay |
| `IMAP_CONNECT_BREAKER_THRESHOLD` | `3` | Failed connect sequences before opening the circuit; `0` disables it |
| `IMAP_CONNECT_BREAKER_COOLDOWN_MS` | `30000` | Circuit cooldown |
| `SMTP_CONNECTION_TIMEOUT_MS` | `10000` | SMTP connection budget |
| `SMTP_GREETING_TIMEOUT_MS` | `10000` | SMTP greeting budget |
| `SMTP_SOCKET_TIMEOUT_MS` | `60000` | SMTP socket timeout |
| `SMTP_DNS_TIMEOUT_MS` | `10000` | SMTP DNS lookup budget |
| `NOCTUA_POST_SEND_TIMEOUT_MS` | `30000` | Absolute deadline for post-send IMAP work; a Sent-copy warning does not mean SMTP failed |

Sources: [IMAP options](lib/mail/imapClientOptions.ts),
[IMAP logger](lib/mail/imapLogger.ts), [SMTP options](lib/mail/smtpTimeouts.ts),
[post-send deadline](lib/mail/imapCancellation.ts).

## Data and deployment

Paths from [lib/runtimePaths.ts](lib/runtimePaths.ts), relative to `NOCTUA_DATA_DIR`:

```text
db/main.db                                master: identities, memberships, credentials, tokens, devices
db/accounts/<accountId>.db                default account shard: mail, FTS, collaboration, calendar
sources/<accountId>/<messageId>.eml        cached RFC 822 sources
attachments/<accountId>/<messageId>/       cached attachment files
spam-static-rules.json                     optional operator-supplied spam rules
```

Account/message path segments are URL-component encoded. The shard path in
`accounts.dbPath` is authoritative: several accounts may share a physical shard,
and shards can live outside the default directory. SQLite creates WAL/SHM
sidecars. The master is **`db/main.db`**, despite the older `mail.db` wording in
[STORAGE.md](doc/STORAGE.md). Current shards use format 3 and `message_fts_v3`
plus `message_fts_identity`; the old FTS names are compatibility views.

Back up the master, every actual shard path, source/attachment files and matching
auth/encryption secrets as a coordinated stopped snapshot. Local collaboration,
calendar and learning state is not recoverable just by syncing IMAP. Missing
cache files can require explicit resync; do not assume every read repairs them.
Follow [FTS-V3-MIGRATION.md](doc/FTS-V3-MIGRATION.md) for format upgrades and rollback.

[DEPLOYMENT.md](doc/DEPLOYMENT.md) covers standalone packaging, reverse proxy,
shutdown, watcher sizing and recovery. Household preview and production
deployments are driven by operator scripts and runbooks kept outside the
repository, in an `ops/` workspace next to the checkout. The repository itself
ships only the generic deployment guide linked above.

## Documentation index

Checked against this checkout (base `684bb647d`). **Current** means the main
contract matches inspected code, not that production acceptance was performed.
**Partial** means useful reference with identified stale sections. **Plan** and
**History** are not statements of implemented or deployed behavior.

| Document | Scope and freshness |
| --- | --- |
| [API](doc/API.md) | **Partial:** collaboration, summaries, send and MCP contracts; old integration-seam instructions remain |
| [Authentication](doc/AUTHENTICATION.md) | **Current:** personal login, MFA, roles, administration, offline migration/recovery; dated verification records are historical |
| [Categorization](doc/CATEGORIZATION.md) | **Partial:** heuristic/feedback categories; removed `lib/mail/imap.ts` path and older implementation locations remain |
| [Deep links](doc/DEEP-LINKS.md) | **Current:** shell URL encoding, history and authorized message restoration |
| [Deployment](doc/DEPLOYMENT.md) | **Partial:** packaging, shutdown, proxy and watcher; cache claims and old implementation notes need follow-up |
| [Development fixtures](doc/DEV-FIXTURES.md) | **Current:** synthetic local mailbox setup and limitations; old verification counts are historical |
| [FTS v3 migration](doc/FTS-V3-MIGRATION.md) | **Current:** stopped backup, shard inventory, format upgrade, validation and rollback |
| [HTML mail privacy](doc/HTML-MAIL-PRIVACY.md) | **Partial:** remote resources and sender provenance; references the older shard v2 contract |
| [Internationalization](doc/I18N.md) | **Partial:** locale policy and migration records; opening slice/formatting status predates later integrations |
| [Push notifications](doc/PUSH-NOTIFICATIONS.md) | **Current:** VAPID, subscriptions, device settings, delivery rules and privacy limits |
| [PWA](doc/PWA.md) | **Partial:** installation and branding; subscription-change and badge descriptions predate current settings preservation |
| [Sender identities](doc/SENDER-IDENTITIES.md) | **Partial:** identity, draft and send contracts; opening text still treats the implemented UI as future work |
| [Sender identities R5](doc/SENDER-IDENTITIES-R5.md) | **History:** bounded-write performance investigation and validation evidence |
| [Shell](doc/SHELL.md) | **Partial:** reader, status and responsive shell; old URL notes coexist with newer compact deep links and historical gate logs |
| [Spam detection](doc/SPAM-DETECTION.md) | **Current:** classifier, feedback, static rules, trusted senders and evaluation tooling |
| [Storage](doc/STORAGE.md) | **Partial:** architecture/loss impact; master path, credential modes and FTS format are stale |
| [Team auth plan](doc/TEAM-AUTH-PLAN.md) | **Plan:** seven-slice Better Auth implementation contract, not a current completion checklist |
| [Team auth review log](doc/TEAM-AUTH-REVIEW-LOG.md) | **History:** design review findings and decisions from 2026-10-22 |
| [Team inbox design](doc/TEAM-INBOX.md) | **Plan:** roles, collaboration, shell and go-live requirements; dated schema/scope assumptions need code cross-checks |

The nested [sender-identities evidence README](doc/sender-identities-r5/README.md)
is **History**, an index of the R5 measurement artifacts.

## Current limitations

- Noctua is a client, not an incoming mail server or a MailPlus migration tool.
  Keep IMAP/SMTP service, mailbox aliases, forwarding and server-side rules with
  the mail provider. Household cut-over still needs operational/device acceptance.
- Message browsing selects one mailbox. Summaries span accessible mailboxes;
  there is no unified all-mailboxes message list.
- Native desktop and cookie-only mailbox credential modes are unsupported.
  The PWA does not turn the app into a complete offline mailbox client.
- Push needs valid server VAPID configuration, device permission and reachable
  browser push services. It is triggered by sync; closed-app delivery requires
  background sync such as the opt-in watcher. In-memory notification baselines
  reset on restart; they do not replay mail that arrived during server downtime.
- The initial watcher sync loads INBOX history; other folders need explicit full
  synchronization for historical messages. Provider connection limits still apply.
- Sender identity configuration does not grant SMTP-provider permission to send
  as that address. MCP's full mode still has no send tool.
- Single-host/process coordination and local SQLite storage are the supported
  deployment model; the local leases are not a distributed multi-host scheduler.

## Fork and license

This fork is maintained independently and does not target upstream pull requests.
Credit to Paul Wellner Bou and the upstream contributors for Noctua Mail.
The repository retains the [Elastic License 2.0](LICENSE); read that file for the
license terms, including its managed-service restriction.
