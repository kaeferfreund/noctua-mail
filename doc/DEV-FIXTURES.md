# Local synthetic mailbox

Run from the repository root with Bun and dependencies installed (`bun install --frozen-lockfile`). No application code or security defaults change.

```sh
bun run dev:fixture
# Optional: freeze dates and select a reproducible seed:
bun run dev:fixture --seed monkeydent --date 2026-10-22
```

In another terminal:

```sh
ENV_FILE=.env.local bun --bun build-scripts/generateRuntimeConfig.ts
bun --env-file=.env.local --bun next dev -p 3786
```

`.env.local` needs `IMAP_CREDENTIALS_STORAGE=db`, distinct 64-hex `IMAP_SECRET_KEY` and `SESSION_SEAL_KEY`, and a dedicated `NOCTUA_DATA_DIR` (this worktree uses `../noctua-data-fixture`). Keep keys and runtime data out of git.

Sign up at http://localhost:3786 with these exact values:

- Name: `MonkeyDent`; email: `demo@monkeydent.test`
- IMAP: host `127.0.0.1`, port `3789`, security **None**
- SMTP: host `127.0.0.1`, port `3787`, security **None**
- Username for both: `demo@monkeydent.test`; password for both: `demo`

On a fresh database, the app prints `Admin invite code: <uuid>`. Opening the app or `curl http://localhost:3786/api/auth/me` initializes storage and prints it. If missed, read the local invitations:

```sh
bun --env-file=.env.local -e 'import {getInviteCodes} from "./lib/db"; console.log(await getInviteCodes())'
```

The API derives the account ID from the email; a client-supplied ID is ignored. After signup, use the app's sync control. To populate **every** folder without a browser, run the HTTP proof below; ordinary account sync initially selects INBOX.

```sh
# New database: signs up, logs in, syncs all folders and checks the real HTTP APIs.
bun scripts/dev-fixture/verify-http.ts --invite-code <printed-uuid>
# Existing demo account: logs in and repeats checks.
bun scripts/dev-fixture/verify-http.ts
```

The proof expects the untouched default seed. It asserts folder/message counts, thread IDs and references, flags, both senders in Sent, draft flags, newsletter HTML, and actual PDF/PNG/calendar attachment downloads. The threads API returns flattened messages, including related Sent replies: its `total` is not the conversation count.

## Injection, reset and SMTP

```sh
curl http://127.0.0.1:3788/status
curl -X POST http://127.0.0.1:3788/inject -H 'Content-Type: application/json' \
  -d '{"subject":"Neue Terminanfrage","text":"Synthetische Anfrage für Dienstag."}'
curl -X POST http://127.0.0.1:3788/reset
```

Injection also accepts `source` (raw RFC822 string), `folder` and `flags`. Selected connections receive EXISTS, including during IDLE. Reset restores the seed, increases UIDVALIDITY and disconnects IMAP clients so they reconnect. Every fixture start also allocates new UIDVALIDITY values, so Noctua invalidates cached UIDs and re-syncs rebuilt messages, even when a different seed reuses UID 1. It does not reset Noctua's database or delete captured outbox files.

SMTP accepts authenticated mail for any recipient, captures it in memory and writes `.eml` files under `NOCTUA_DATA_DIR/fixture-outbox/`. Messages addressed to the demo user also enter INBOX. No mail leaves the machine. Restarting the fixture resets IMAP and in-memory SMTP state; outbox files remain. Only the UIDVALIDITY high-water mark persists in `NOCTUA_DATA_DIR/fixture-uidvalidity.sqlite` (default `.data/fixture-uidvalidity.sqlite`), using Bun’s built-in SQLite with no additional dependency. Keep that file across restarts: it serializes allocations across processes and guarantees increasing values even for rapid restarts or a clock moving backward. Mailbox contents are still in memory.

Standalone processes and overrides:

```sh
bun scripts/dev-fixture/imap-server.ts --host 127.0.0.1 --port 3789 --control-port 3788 --user demo@monkeydent.test --pass demo --seed monkeydent
bun --env-file=.env.local scripts/dev-fixture/smtp-sink.ts --port 3787 --imap-control http://127.0.0.1:3788
# Combined runner overrides: --out /absolute/outbox --smtp-port 3787 --control-port 3788
```

## Verification record (2026-10-22)

Commands above started the final fixture with `--date 2026-10-22` and the app on 3786. `curl http://localhost:3786/api/auth/me` returned 401 and the app printed `Admin invite code: 42c05ea8-c1b3-4ea9-98b0-ff5fe354d17f` (a consumed, local-only test invitation). Then:

```sh
bun scripts/dev-fixture/verify-http.ts --invite-code 42c05ea8-c1b3-4ea9-98b0-ff5fe354d17f
```

Output (exit 0):

```text
signup {"ok":true,"accountId":"acc-0357e6dc07a93be003c3321b"}
login {"ok":true,"accountId":"acc-0357e6dc07a93be003c3321b"}
sync INBOX: done count=60
sync Sent: done count=15
sync Drafts: done count=3
sync Archive: done count=4
sync Junk: done count=2
sync Trash: done count=3
sync Projekte: done count=0
sync Projekte/Website: done count=3
folders INBOX (\Inbox), Sent (\Sent), Drafts (\Drafts), Archive (\Archive), Junk (\Junk), Trash (\Trash), Projekte, Projekte/Website
messages=90; INBOX=60; threads API: 25 conversations / 75 messages (total=60); unread=20; flagged=8; sent team members=2; drafts=3
attachment downloads verified: application/pdf, image/png, text/calendar; newsletter HTML + inline image verified
```

The helper POSTs `/api/auth/signup` with `{inviteCode, account:{id,name,email,avatar,imap:{host,port,secure:false,user,password},smtp:{host,port,secure:false,user,password}}}`, POSTs `/api/auth/login` with `{email,password}`, POSTs `/api/accounts/<id>/sync` with `{folderId:"<id>:<path>",mode:"full"}`, polls `/sync/status?jobId=…`, then reads `/folders`, `/messages`, `/threads`, message details and attachment routes. These use Noctua's real credential validation, worker, SQLite storage, MIME parsing and thread recomputation. Both servers were stopped by their own PIDs after verification.

## Tests and limits

```sh
bun test scripts/dev-fixture/fixture.test.ts --timeout 10000
timeout 900 bun run test:ci
timeout 600 bun run lint
bunx tsc --noEmit 2>&1 | grep -v bun:test
```

Fixture tests use ephemeral ports and temporary outbox directories. They cover real imapflow connections, Noctua's `verifyImapCredentials`, multipart source/structure/parts, SEARCH, flags, COPY/MOVE, APPEND, expunge, IDLE, reset, mailbox CRUD/modified UTF-7, atomic rename collision rejection, literal-like mailbox names, typed and fragmented literal framing, malformed-command recovery, process restart/UIDVALIDITY cache invalidation, UTF-8 B/Q encoded-word and base64/quoted-printable SEARCH, and nodemailer PLAIN/LOGIN verification, sending and round-trip delivery.

Plaintext only: neither server advertises STARTTLS. Noctua's `secure:false` and both installed clients accept this without overrides; TLS identity checks, timeouts and the connection breaker remain unchanged. No `--tls` option is needed or provided. IMAP advertises IMAP4rev1, LITERAL+, UIDPLUS, MOVE, SPECIAL-USE, IDLE, NAMESPACE, ID, ENABLE, UNSELECT, AUTH=PLAIN and SASL-IR; it does not advertise CONDSTORE/QRESYNC or UTF8=ACCEPT. MIME covers the fixture's text, multipart and attachment parts; this is not a general-purpose IMAP/MIME implementation (e.g. embedded message/rfc822 structures and all SEARCH extensions are outside scope). Unknown commands/search keys fail explicitly. No mailbox persistence, external delivery, multiple accounts or production hosting. Control HTTP has no authentication; keep the default loopback binding.

Seed bytes are stable for a seed name and UTC anchor day; omit `--date` for dates relative to today. All people and suppliers are invented. There are 60 INBOX messages in 25 conversations, 15 Sent, 3 Drafts, 4 Archive, 3 Trash, 2 Junk and 3 Projekte/Website messages. PDF invoices exceed Noctua's 1 KB attachment-badge threshold; calendar and inline-image badges follow the app's own rules.

Checked on Bun 1.4.3 / imapflow 1.3.2 / nodemailer 8.0.5: fixture tests **10 pass, 0 fail, 86 assertions**; `timeout 900 bun run test:ci` exit **0** (**1,670 pass + 12 DOM pass, 0 fail**); fixture-only ESLint exit **0**. `timeout 600 bun run lint` exit **1**, with the unchanged baseline **1 error** (`useCalendarConflicts.ts:58`, `react-hooks/set-state-in-effect`) and **27 warnings**, none in fixture files. The requested filtered TypeScript command still reports existing project errors (331 output lines); **no errors in scripts/dev-fixture/** after excluding the repository-wide missing `bun:test` declarations. `git diff --check` passed.

Round 1 fixes verified on Bun 1.4.4: `bun test scripts/dev-fixture --rerun-each=3` exit **0** (**51 pass, 0 fail, 360 assertions**); `timeout 900 bun run test:ci` exit **0** (**1,677 pass + 12 DOM pass, 0 fail**); fixture/type-declaration ESLint exit **0**. Full lint retains exactly the baseline **1 error and 27 warnings** (exit **1**). Filtered TypeScript output is byte-for-byte identical to the pre-fix HEAD baseline (**331 lines, no new diagnostics**, TypeScript exit **2**). `git diff --check` passed. The optional HTTP proof was not repeated for this round; all new network tests used ephemeral ports, and the existing fixture services were left running. Restart a service using this worktree to load the fixes.
