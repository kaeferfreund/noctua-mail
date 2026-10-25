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

Use the [authentication environment contract](AUTHENTICATION.md#final-environment): DB-only
credentials, independent `IMAP_SECRET_KEY` and `BETTER_AUTH_SECRET`, exact `BETTER_AUTH_URL` /
`PASSKEY_RP_ID` for this isolated local instance, and a dedicated `NOCTUA_DATA_DIR`. No legacy seal key.
Keep keys and runtime data out of git.

With the app stopped, retrieve the bootstrap invite using `scripts/recoverTeamAuth.ts
--application-stopped --confirm-personal-handover --bootstrap-invite`. Start the app, sign up with
a synthetic personal identity and a separate app password, then complete mandatory TOTP enrollment.
Bootstrap codes are no longer printed to startup logs. In Admin create the synthetic mailbox:

- Name `MonkeyDent`; email `demo@monkeydent.test`.
- IMAP `127.0.0.1:3789`, SMTP `127.0.0.1:3787`, security **None**.
- Both usernames `demo@monkeydent.test`, passwords `demo`.

Creation is admin-only; the creating admin becomes the owner and sees the mailbox in the sidebar.
Grant other synthetic identities membership in Admin → Mailboxes. The API derives its ID from email.

The HTTP proof now uses an already MFA-authenticated synthetic browser session. Supply its Cookie
header through the local `NOCTUA_FIXTURE_COOKIE` environment variable (never commit or log it), then:

```sh
bun scripts/dev-fixture/verify-http.ts --base-url http://localhost:3786
```

The verifier requires loopback, reads `/api/auth/me`, checks existing fixture membership and persists
mailbox selection through `/api/auth/switch-account`. It never signs up, logs credentials or bypasses
MFA. The retired login route is no longer used. Live IMAP browser acceptance remains release work;
this integration validates the protocol fixture and compiled auth harness separately.

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

The earlier pre-Better-Auth HTTP proof passed with 90 messages, 60 in INBOX, 25 conversations,
all expected folders and PDF/PNG/calendar attachment downloads. Its signup/login commands and printed
bootstrap codes are obsolete. The current MFA-session verifier has not been rerun against a live
mailbox in this integration; use the updated procedure above with isolated synthetic storage.

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
