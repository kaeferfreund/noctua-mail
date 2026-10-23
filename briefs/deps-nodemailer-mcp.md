# nodemailer / MCP SDK implementation report

Worktree: `/home/monkey/code/noctua-mail/wt-deps-mailer`  
Branch: `chore/deps-nodemailer-mcp`, based on `9424150f5aa0a446ed9bc03ed199e6825129467d`  
Runtime: Bun 1.4.4. All installs, checks, builds, fixture/app commands ran under `nice -n 10`.

## Commits and changes

- `de89651` — `chore(deps): upgrade nodemailer to 10.x`: `^8.0.11` → `^10.2.1`; remove both local ambient declaration files; change the punycode import in `lib/senderIdentity.ts` to a namespace import because the new ESM package has named exports; correct the `connectionTimeout` comment without changing timeout values.
- `bd92941` — `chore(deps): upgrade @modelcontextprotocol/sdk to 1.32.x`: exact `1.29.0` → exact `1.32.1`; package and lockfile only.

Each step edited package.json first and ran `nice -n 10 bun install` (without frozen-lockfile). Registry queries confirmed 10.2.1 / 1.32.1 as the latest requested patch versions. No @types/nodemailer was added. Both deleted files existed and were the only local files declaring nodemailer modules (the main stub also declared addressparser and punycode).

Re-derived nodemailer imports: `lib/mail/smtp.ts` (transport, MailComposer, addressparser), `scripts/dev-fixture/fixture.test.ts` (transport), `lib/senderIdentity.ts` (addressparser, punycode), `lib/ownAddresses.ts`, `lib/mail/imap/parser.ts`, and `lib/db/messages/utility.ts` (addressparser). Only senderIdentity required a source typing/import correction. No changes were required in smtp.ts or fixture.test.ts. `lib/mail/smtp.ts`, `lib/mail/smtpError.ts`, `lib/outboundAuthorization.ts`, `lib/mcpServer.ts`, `app/api/mcp/**`, and `next.config.ts` remain byte-identical to the base. nodemailer remains in serverExternalPackages inside the existing next-intl wrapper.

## Actual dependency tree and lock delta

The spike's nested 8.0.5 prediction is obsolete for this base. `bun pm ls --all`, installed package manifests, and bun.lock agree:

```text
@modelcontextprotocol/sdk@1.32.1
imapflow@1.7.8                  # no nodemailer dependency
mailparser@3.12.3
  nodemailer@10.2.0             # exact pin, existing nested copy retained
nodemailer@10.2.1               # app imports resolve here
zod@4.6.7                      # one installed dependency, no zod 3
```

There are **zero nodemailer 8 copies**. Neither imapflow nor mailparser was bumped. Nodemailer step: 2 lock lines replaced (workspace range and resolved package/integrity). SDK step: 2 lock lines replaced, 3 redundant shadcn-nested package entries removed (SDK, ajv, json-schema-traverse); existing SDK-private ajv remains. Overall bun.lock: +4/-10 lines. No manual lockfile edits.

## SDK release/call-site review

Reviewed official [1.30.0](https://github.com/modelcontextprotocol/typescript-sdk/releases/tag/1.30.0), [1.30.1](https://github.com/modelcontextprotocol/typescript-sdk/releases/tag/1.30.1), [1.31.0](https://github.com/modelcontextprotocol/typescript-sdk/releases/tag/1.31.0), [1.32.0](https://github.com/modelcontextprotocol/typescript-sdk/releases/tag/1.32.0), and [1.32.1](https://github.com/modelcontextprotocol/typescript-sdk/releases/tag/1.32.1) release notes against current code, including the sender tools and actor-aware create_draft_message. Compared installed old/new declarations: registerTool/tool signatures unchanged; McpServer adds optional maxToolInputElements; Transport adds redirect helpers but no required interface methods; AuthInfo unchanged. SDK Zod range remains `^3.25 || ^4.0`.

The app creates a fresh McpServer per POST with a custom StatelessJsonResponseTransport and manually parses request.json(). SDK HTTP body/batch limits and SSE keepalives therefore do not harden this route. OAuth issuer changes and client redirect policy do not apply to the current server. Omitted tool arguments are now accepted where schemas permit them. No transport, tool/schema, authorization or Zod rewrite was needed; no new SDK option was enabled.

## Gates

For `TMPDIR=...` below, the exact value was `$PWD/.deps-scratch/tmp` in this worktree.

- `nice -n 10 bun run typecheck`: passed after each upgrade (0 errors in 1,173 files). Removing stubs initially found the punycode default-import error and consequent implicit-any diagnostic; the one-line namespace import fixes both.
- `nice -n 10 bun test lib/mail lib/outboundAuthorization.routes.test.ts lib/senderIdentity.test.ts lib/mcpAuth.identities.test.ts scripts/dev-fixture/fixture.test.ts`: **332 pass, 0 fail**, 995 assertions, 30 files (Bun substring matching also includes mailbox integration tests).
- `TMPDIR=... nice -n 10 bun test ./app/api/mcp/route.test.ts ./lib/mcpAuth.identities.test.ts`: **6 pass, 0 fail**, 146 assertions, 2 files.
- `TMPDIR=... nice -n 10 bun run lint`: exit 1, exactly baseline **1 error + 25 warnings**; existing `useCalendarConflicts.ts:58` react-hooks/set-state-in-effect. No unrelated lint edits.
- `TMPDIR=... nice -n 10 bun run build`: exit 0; compiled successfully; standalone includes nodemailer **10.2.1**, traces nodemailer under route NFT manifests, and produces `.next/standalone/noctua-server.mjs`.
- `nice -n 10 bun --env-file=.env.local --env-file=.deps-scratch/live.env scripts/checkGracefulShutdown.ts --port 3793 --data-dir /home/monkey/code/noctua-mail/data/noctua-data-wt-deps-mailer`: passed, exit **0**, graceful child exit 0 in **121 ms**, forced=false.
- First `TMPDIR=... nice -n 10 bun run test:ci`: **2753 pass, 1 fail**, 300 files, 636.63s; failed identities REST viewer-prefs test with SQLiteError SQLITE_BUSY in Better Auth fixture creation, so DOM phase did not run. Isolated exact-file retry: **3 pass, 0 fail**, 28 assertions, 5.04s. Full CI retry: **exit 0**, **2754 unit pass, 0 fail** (300 files, 489.87s) followed by **433 DOM pass, 0 fail** (52 files, 2553 assertions, 65.55s).
- Existing stress script is `test:stress` (no `stress` script); running `TMPDIR=... nice -n 10 bun run test:stress` → `bun test --timeout 20000 --randomize --seed=1337 --rerun-each=3`. **Exit 0: 8262 pass, 0 fail**, 33927 assertions, 300 files, 1422.20s.

Temporary test directories were placed on the worktree filesystem via TMPDIR to avoid filling /tmp. Test-owned sockets use the existing test harness ephemeral ports; the manual app/fixture check uses only 3793/3794.

## Live check

Used the dedicated `.env.local` data directory `/home/monkey/code/noctua-mail/data/noctua-data-wt-deps-mailer`. Temporary process-only auth configuration supplied an independent random Better Auth secret and exact local origin/RP ID; `.env.local` was unchanged. No real mailbox or external delivery was used.

Port allocation: production standalone app `127.0.0.1:3793` (canonical URL `http://localhost:3793`), fixture SMTP `127.0.0.1:3794`, fixture IMAP `127.0.0.2:3794`. The fixture imported the documented startImapServer/startSmtpSink entrypoints with the monkeydent seed and synthetic storage. Both protocols used the default synthetic demo credentials. This used only allowed ports 3793/3794; no control listener was needed.

Retrieved bootstrap invite with the documented stopped-application recovery CLI, signed up a synthetic admin, signed in normally, enrolled and verified real TOTP, created the mailbox through the admin HTTP API (including real IMAP and SMTP credential checks), granted manager membership and selected the account. Sent a mail with a text attachment through `/api/accounts/:accountId/smtp/send`. PASS: exactly one sink arrival; SMTP envelope.from and MIME From `demo@monkeydent.test`; correct recipient; exact filename and all 54 attachment bytes; successful Sent APPEND (`sentCopy=appended`).

Minted a five-minute MCP bearer through the real MFA-protected HTTP endpoint and called `/api/mcp` with `tools/call` → `list_sender_identities`. PASS: JSON-RPC success and validated structured output includes the synthetic sender. Revoked the token and signed out. Stopped all live app/fixture processes.

Setup corrections: the first shutdown attempt incorrectly passed the exported helper `noctua-server.mjs` as the executable and failed readiness; rerunning with the script's default `.next/standalone/server.js` passed (that launcher imports the helper). The first signup committed successfully but its setup sign-in used Next's localhost request origin while temporary canonical configuration used 127.0.0.1. Aligned canonical configuration to localhost, restarted, and used normal password login to continue; no auth bypass or app source change.

## Owners' review

- Identities owner: review the single punycode import change and nodemailer 10 addressparser behavior alongside upcoming sender work. SMTP composition, explicit envelope, beforeSend callback, smtpError mapping and outbound authorization were preserved. Re-run sender/outbound tests after later overlapping changes.
- SMTP owner: 10.1+ uses one setup budget covering DNS/TCP/TLS/greeting/STARTTLS; existing 10s connection/greeting/DNS and 60s socket values are unchanged. Review the shorter effective setup deadline on slow real providers separately. The synthetic check covers plaintext fixture delivery, not provider-specific TLS, DKIM or rewritten message IDs.
- MCP owner: re-run route/identity tests after the upcoming mcpServer.ts fix. Current six identity tools and actor-aware draft schemas work without edits. This bump does not add HTTP request-size/batch limits to the custom route.
- Dependency owner: preserve mailparser's exact nested 10.2.0; regenerate the lockfile with Bun when combining the sibling imapflow upgrade. The older spike's 8.0.5 assumptions must not be reintroduced.

No pushes, merges, rebases, stashes, PRs, other-worktree edits or real mailbox operations were performed. Both requested commits are complete. Working tree is clean and `git diff --check` passes. Temporary test databases, logs, scripts, invite/auth configuration and the first run’s `undefined/` fixture outbox were deleted. The initially empty dedicated live-data directory was restored to empty after recording proof. No app/test/fixture processes remain, and ports 3793/3794 have no listeners. Ignored installed dependencies and the requested production build remain available.
