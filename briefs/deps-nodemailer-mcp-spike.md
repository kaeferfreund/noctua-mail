# Spike: nodemailer 10.2.1 + @modelcontextprotocol/sdk 1.32.1

Worktree `/home/monkey/code/noctua-mail/wt-probe-mail`, detached `c1652ec`. Spike only. Tree restored afterwards (`git status` clean, nodemailer 8.0.5, SDK 1.29.0, zod 4.3.6). No commit.

Baseline tsc on this tree before either bump: **355** `error TS` lines, exit 2. After each bump the set was identical (0 added, 0 removed). The stated ~354 is this same pre-existing noise (204 of the 355 are `TS2307`). Do not try to fix them.

`test:ci` was run only on the combined bump, not again on the original lockfile. Given baseline was ~1681 unit + 48 DOM. This run was **1698 pass / 0 fail** (196 files, 10.10s) then **48 pass / 0 fail** DOM (8 files, 15.72s). The upgrade cannot add tests; the ~1681 figure was not re-measured here.

---

## nodemailer

### Summary

`^8.0.5` → `^10.2.1` (published 2026-10-22). Direct imports keep working. No application source change is required for tsc or tests. Shipped types replace the local ambient stubs; `@types/nodemailer` must not be added. imapflow 1.3.2 and mailparser 3.9.8 depend on nodemailer **exactly 8.0.5**, so Bun nests that copy under those two packages. The app's `import "nodemailer"` resolves to 10.2.1.

### Findings

**Versions.** `npm view` / GitHub releases: line is 8.0.0 … 8.0.11, 9.0.0 … 9.1.1, 10.0.0 … 10.2.1. Target used: **10.2.1**.

**Not ESM-only.** `package.json` is `"type": "module"` with a dual build. `main` is `./dist/cjs/nodemailer.js`. `exports["."].import` is `./dist/esm/nodemailer.js`, `exports["."].require` is the CJS file. `./lib/mail-composer` and `./lib/*.js` both exist, so `nodemailer/lib/mail-composer/index.js` still resolves. `engines.node` is `>=20.0.0`. This spike ran on **Bun 1.4.4** (suite green). Machine Node is v24.22.1; the tests themselves ran under Bun. Bun is outside the engines field.

**Types.** 8.0.5 has no types (`types` absent, no `@types/nodemailer` in this repo). 10.2.1 ships `.d.ts` beside `dist/esm` and `dist/cjs`. The installed `package.json` has **no** top-level `types` key; it has `typesVersions["*"]["lib/*"]` → `dist/cjs/*/index.d.ts`. The registry document still advertises `types: ./dist/cjs/nodemailer.d.ts`. `moduleResolution: bundler` finds `dist/esm/nodemailer.d.ts` from the import. `@types/nodemailer@latest` is **8.0.2** (DefinitelyTyped for v8). Adding it would fight the shipped types. Do not add it.

Local stubs, both redundant once 10 is installed:

- `types/nodemailer.d.ts` redeclares `createTransport` / `sendMail(message: any): Promise<void>`.
- `lib/types/nodemailer-mail-composer.d.ts` is an empty `declare module` for `nodemailer/lib/mail-composer` and `.../index.js`.

tsc was 355 with the stubs kept (nodemailer 10, then again with SDK 1.32.1) and 355 with both stubs moved aside (that run was nodemailer 10 + SDK still 1.29.0). Delete them so `sendMail` is `SentMessageInfo`, not `Promise<void>`. No call site needed a type fix after deletion.

**Call sites** (`app`, `lib`, `scripts` only):

| File | Use |
| --- | --- |
| `lib/mail/smtp.ts` | `createTransport`, `sendMail`, `MailComposer` |
| `scripts/dev-fixture/fixture.test.ts` | `createTransport` + `verify` + `sendMail` against the sink |
| `next.config.ts` | `serverExternalPackages` already lists `nodemailer` (leave it) |
| `lib/mail/smtpTimeouts.ts` | passes `connectionTimeout`, `greetingTimeout`, `socketTimeout`, `dnsTimeout` |
| `lib/mail/smtpError.ts` | classifies `code` + message text; no nodemailer import |
| `scripts/dev-fixture/smtp-sink.ts` | raw `node:net` server. Does not import nodemailer |

`sendSmtpMessage` / `sendRawSmtpMessage` are what `smtp/send/route.ts`, the calendar RSVP route, and `lib/drafts.ts` call. Nothing else imports the `nodemailer` package.

**`sendMail` result.** `SentMessageInfo` still has `messageId: string`, plus `envelope`, optional `accepted` / `rejected` / `pending` / `response`. The app already does `let info: unknown` and `(info as any)?.messageId`. 10.2.0 adds optional `serverMessageId` on the SMTP info object: the id a server names in the final 250 when it **replaces** the Message-ID (Microsoft 365, Outlook.com, Amazon SES, per the d.ts). This app does not read it. The Sent APPEND is the locally composed raw, so those hosts can still store a different id than the one returned to the client. Not a compile break.

**Timeouts (10.1.0, confirmed in the 10.2.1 `smtp-connection` source).** `connectionTimeout` is now **one budget** for DNS, every resolved address, TCP, TLS, the greeting, and STARTTLS. It is no longer applied per address. `greetingTimeout` still caps the greeting and the STARTTLS handshake, but only with time left on that budget (`Math.min(greetingTimeout, remaining)`, floor 1ms). If that timer fires, the message is still `Greeting never received`. `dnsTimeout` still exists (default 30s) and still bounds the lookup itself. All four option names the app passes are still on `SMTPConnectionOptions`.

Timeout errors are still `code: ETIMEDOUT`. 10.1.0 adds `timeoutType` and `originalCode`. Messages in 10.2.1:

| `timeoutType` | `message` | current `getSmtpHttpError` bucket |
| --- | --- | --- |
| `CONNECT_TIMEOUT` | `Connection timeout` | `smtp_connection_timeout` |
| `GREETING_TIMEOUT` | `Greeting never received` | `smtp_greeting_timeout` |
| `SOCKET_TIMEOUT` | `Timeout` | `smtp_server_timeout` (substring `timeout`) |
| `UPGRADE_TIMEOUT` | `TLS handshake timed out` | `smtp_server_timeout` (substring `timed out`) |

`lib/mail/smtpError.test.ts` builds fake errors; it does not assert live nodemailer strings. Those strings still match. 10.2.0 also sets `err.permanent` for SMTP 5yz. The classifier ignores it.

Practical effect with the app's 10s/10s/60s/10s defaults: setup can no longer spend 10s on DNS **plus** 10s per address **plus** 10s of greeting. The whole setup shares 10s. Failures return sooner. A slow dual-stack host that used to fit in the old sum can now fail inside one 10s budget, and a connect that eats the budget leaves the greeting timer ~1ms, which then reports `Greeting never received` rather than `Connection timeout`. The comment in `smtpTimeouts.ts` ("per resolved address") becomes false. Update the comment. Do not change the numbers unless product wants the old wall-clock budget back (raise `SMTP_CONNECTION_TIMEOUT_MS` only).

**TLS.** v9.0.0 breaking change is certificate checks for **remote HTTPS fetches** (attachment `href`/`path` URLs, OAuth token URLs, HTTP proxy CONNECT). Opt out with `tls.rejectUnauthorized: false` on the transport or per attachment. This app passes `content: Buffer` attachments, no OAuth, no proxy, so it does not hit that path. SMTP `secure: false` is still plaintext. `opportunisticTLS` is opt-in and off; the 10.1 note about skipping AUTH after a failed STARTTLS applies only when that flag is set. The fixture sink is `node:net` (no STARTTLS) on `127.0.0.1` with security None. The fixture test authenticated and sent dot-stuffed mail on nodemailer 10 (54ms).

**DKIM.** v10.0.0 changes relaxed canonicalization. `smtp.ts` never passes `dkim`. No impact.

**DNS.** v8 already failed over to alternate addresses (this tree is on 8.0.5, so that is already in production). v10.0.0 fixes lookup when the runtime has no interface table. v10.1.0 stops reading the environment and the interface table **on import**. `127.0.0.1` does not resolve. `dnsTimeout` remains.

**Other 9.x/10.x items that do not touch this code:** addressparser rewrite, header encoding, `maxRecipients` (opt-in), pooled `idleTimeout` of 4 minutes (app does not use a pool), envelope PIPELINING, `421` ends the session, `ESTREAM` on an already-consumed content stream. `keepBcc` is still a public boolean on `MimeNode`; the cast in `buildRawMessage` still works.

**Nested 8.0.5.** After `bun install`, `node_modules/nodemailer` is 10.2.1, and both of these exist:

- `node_modules/imapflow/node_modules/nodemailer` 8.0.5 (`imapflow@1.3.2` depends on `nodemailer@8.0.5`, exact)
- `node_modules/mailparser/node_modules/nodemailer` 8.0.5 (`mailparser@3.9.8`, same pin)

Do not force a single copy. Parsing stays on mailparser's own 8.0.5. Sending goes through the top-level 10.2.1.

### Migration recipe

No edit under `lib/mail` is required for a green suite. Apply the pin, install, then delete the two stubs.

`package.json`:

```diff
-    "@modelcontextprotocol/sdk": "1.29.0",
+    "@modelcontextprotocol/sdk": "1.32.1",
```

```diff
-    "nodemailer": "^8.0.5",
+    "nodemailer": "^10.2.1",
```

The SDK line is the other half of this spike. Land them together or the lockfile will thrash. Then:

```bash
nice -n 10 bun install
```

`bun.lock` from that install is 18 lines. It rewrites the two version strings, points the top-level packages at 10.2.1 (`sha512-ZrDNsPFoDMwefNs7sJwrYiEJ/CG4ClJWDZv05iNJsEBWa8GRDry1QJHTJxsuTAY9eDDKjX4k+q3SxslXJOao7w==`) and SDK 1.32.1 (`sha512-2DdE+SJDtzLEEWzY1ZjY7Q+VcPhcV1KisD3zI4u0XZyktsjHum1mwbMI+JaulUBi2OZk+KJAi2uPXzxichPkdw==`), **adds** `imapflow/nodemailer` and `mailparser/nodemailer` at 8.0.5, and **drops** the nested `shadcn/@modelcontextprotocol/sdk@1.32.1` (and its private ajv) because the app pin now matches `shadcn@4.22.1`'s `^1.32.0`. Do not hand-edit the lockfile; re-run `bun install` if the hunk does not apply.

Delete these files (whole contents). tsc stayed 355 without them:

`types/nodemailer.d.ts`

```ts
declare module "nodemailer" {
  export function createTransport(options: any): {
    sendMail(message: any): Promise<void>;
  };
}
```

`lib/types/nodemailer-mail-composer.d.ts`

```ts
declare module "nodemailer/lib/mail-composer";
declare module "nodemailer/lib/mail-composer/index.js";
```

Recommended comment-only edit in `lib/mail/smtpTimeouts.ts`. Not applied during the spike. The green run is without it.

```diff
 /**
- * Nodemailer applies `connectionTimeout` to each resolved address in turn.
- * Keeping it short prevents a dual-address SMTP endpoint from holding the
- * compose UI for several minutes when outbound SMTP is blocked upstream.
+ * Nodemailer 10.1+ uses `connectionTimeout` as one budget for DNS, every
+ * resolved address, TCP, TLS, the greeting and STARTTLS. `greetingTimeout`
+ * still caps the greeting and STARTTLS, but only with time left in that
+ * budget. `dnsTimeout` bounds the lookup itself. Keeping the budget short
+ * stops a blocked SMTP server from holding the compose UI open.
  */
```

Do not change `smtp.ts`, `smtpError.ts`, `fixture.test.ts`, or `next.config.ts`.

### Verification

| Command | When | Result |
| --- | --- | --- |
| `nice -n 10 bunx tsc --noEmit --pretty false --incremental false` | before bump | exit 2, **355** errors |
| same | nodemailer 10.2.1, stubs kept, SDK 1.29.0 | exit 2, **355**, 0 added, 0 removed |
| same | stubs moved aside, nodemailer 10.2.1, SDK 1.29.0 | exit 2, **355**, 0 added, 0 removed |
| `nice -n 10 bun test lib/mail` | nodemailer 10.2.1, SDK still 1.29.0 | **172 pass, 0 fail**, 435 expects, 18 files, 608ms |
| `nice -n 10 bun run test:ci` | both bumps, stubs kept | **1698 pass, 0 fail**, 4194 expects, 196 files, 10.10s; then DOM **48 pass, 0 fail**, 295 expects, 8 files, 15.72s. Exit 0 |
| fixture test inside that run | nodemailer 10 → plaintext sink | `nodemailer verifies, authenticates, sends dot-stuffed mail, persists and round-trips` pass, 54.09ms |

`lib/mail` does not import nodemailer except `smtp.ts`, and no unit test drives `sendSmtpMessage` through a live socket. The live client check is `scripts/dev-fixture/fixture.test.ts`. `bun run build` was not run.

### Overlap with in-flight branches

`git -C repo diff --stat ad6db7a..feat/thread-collaboration -- lib/mail lib/mcpServer.ts app/api/mcp` (`feat/thread-collaboration` = `beb8dd5`):

```
app/api/mcp/route.test.ts
lib/mail/completeSend.ts          | new, IMAP sent-copy after SMTP. No nodemailer import
lib/mail/imap/connectionPool.ts
lib/mail/imap/index.ts
lib/mail/imap/mutations.ts
lib/mail/imap/sentCopy.ts
lib/mcpServer.ts
```

That range does **not** touch `package.json`, `bun.lock`, `lib/mail/smtp.ts`, `smtpTimeouts.ts`, `smtpError.ts`, or either ambient `.d.ts`. `completeSend` starts only after SMTP acceptance.

`git diff --stat 11c322b..feat/team-auth` for `lib/mail` is empty. team-auth does not touch nodemailer files.

Lockfile contention is with other dep spikes (for example a worktree already on `nodemailer@^8.0.11`), not with these two branches.

### Risks & recommendation

Apply `^10.2.1`. It is a version bump plus deleting two stub files. 10.2.1 was published the day of this spike; the suite covered it, including the plaintext fixture.

The behavior change to plan for is the single `connectionTimeout` budget. Update the comment. Leave the 10s numbers unless a real host starts failing greetings that used to succeed. Do not install `@types/nodemailer`. Leave the nested 8.0.5 copies under imapflow and mailparser. Ignore `serverMessageId` until a host that rewrites Message-ID shows up. `err.timeoutType` / `err.permanent` are available later; the current message matching still works.

---

## @modelcontextprotocol/sdk

### Summary

Exact pin `1.29.0` → `1.32.1` (2026-10-05). No source change. `McpServer`, `registerTool`, `server.tool`, `Transport`, `AuthInfo`, `ErrorCode`, and `JSONRPCMessageSchema` stay compatible with `lib/mcpServer.ts` and `app/api/mcp/route.ts`. Zod stays a single top-level **4.3.6**. The SDK accepts zod 3.25 or 4, so a later move to `zod@^4.6.7` does not pull zod 3.

### Findings

**Releases 1.29.0 → 1.32.1** (tags `1.30.0`, `1.30.1`, `1.31.0`, `1.32.0`, `1.32.1`; no other 1.29–1.32 tags):

- **1.30.0** (2026-07-27): zod issue formatting; Streamable HTTP server sends SSE keep-alive comments (timer lifecycle fixed in the same release); Content-Type checked as a parsed media type; Zod 3.25 method-literal support; stdio buffer limit.
- **1.30.1** (2026-09-23): SDK HTTP transports limit request body size and JSON-RPC batch length.
- **1.31.0** (2026-09-28): stored OAuth credentials gain `issuer`. `ClientCredentialsProvider` / private-key JWT providers want `expectedIssuer` (deprecated without it).
- **1.32.0** (2026-10-02): HTTP **client** transports follow redirects only on the same origin unless `redirectPolicy: 'follow'`. New opt-in `maxToolInputElements` on `McpServer`. New opt-in `expectedResource` on `requireBearerAuth`. `tools/call` and `prompts/get` may omit `arguments`.
- **1.32.1** (2026-10-05): docs only.

**Type diff that matters.** `dist/esm/server/mcp.d.ts` 1.29.0 vs 1.32.1 adds only `McpServerOptions`, which is `ServerOptions & { maxToolInputElements?: number }`. Unset means no limit. `registerTool` / `tool` / `outputSchema` signatures are unchanged. `server/auth/types.d.ts` (`AuthInfo`) is identical. `Transport` already had optional `setProtocolVersion` in 1.29.0; 1.32 adds same-origin redirect helpers and does not add a required method. `StatelessJsonResponseTransport` still implements the interface (`start`, `send`, `close`, optional callbacks, `sessionId = undefined`).

**Zod.** Both 1.29.0 and 1.32.1:

```json
"dependencies": { "zod": "^3.25 || ^4.0" }
"peerDependencies": { "zod": "^3.25 || ^4.0" }
```

`zod-to-json-schema@3.25.1` peers `zod@^3.25 || ^4` and does not depend on zod directly. `zod@^4.6.7` satisfies `^4.0` (4.6.7 is the current 4.x latest as of this spike).

`bun pm ls --all` after the SDK bump, with the app still on `zod@^4.3.6`:

- one install: `zod@4.3.6` (top-level)
- `zod-to-json-schema@3.25.1` and `zod-validation-error@4.0.2` (SDK deps, not a second zod)
- no nested `zod@3`
- `node_modules/next/dist/compiled/zod` is Next's private bundle (no `version` field). It was already there. It is not an SDK install.

This spike did **not** install zod 4.6.7 and re-run tests. Compatibility is the peer range plus a single resolved zod 4.3.6.

**What the app actually uses.** `lib/mcpServer.ts` (1187 lines): `McpServer`, custom `StatelessJsonResponseTransport`, `JSONRPCMessageSchema.safeParse`, `registerTool` (with `outputSchema`) and legacy `server.tool` (raw zod shapes). `app/api/mcp/route.ts`: `AuthInfo`, `ErrorCode`, then `executeMcpHttpRequest`. One new `McpServer` per POST. No SDK HTTP transport, no sessions, no OAuth provider, no elicitation.

**Useful in 1.32, not worth taking in this upgrade:**

- **Streamable HTTP.** `WebStandardStreamableHTTPServerTransport` is the Bun/web-standard one; `StreamableHTTPServerTransport` wraps it for Node. `SSEServerTransport` is deprecated. SSE keep-alives, body-size limits, and batch caps live on **those** transports. This route reads `request.json()` itself and answers one JSON body through `StatelessJsonResponseTransport`. None of the 1.30 HTTP hardening applies until the route switches transports. Same-origin redirects are a **client** transport change. This app is not an MCP client.
- **Output schemas.** Already used for `list_accounts`, `list_folders`, `list_mailing_list_aliases`, `search_messages`. The 1.30 zod-error formatting did not break `route.test.ts` (including the ambiguous-topic error test). No schema rewrite.
- **Elicitation.** `Server.elicitInput` and `createElicitationCompletionNotifier` exist on the low-level server. They are not in the 1.30–1.32 notes, so they are not a reason to bump. A stateless one-shot POST cannot pause for a client round-trip anyway.
- **Sessions.** `sessionId` stays unset. 1.32's session-map caps are in the SDK examples for the streamable transport. `maxToolInputElements` is the one new knob that fits this server (cap array-heavy tools such as topic assignment). Default off. `expectedResource` / `expectedIssuer` apply to SDK bearer and OAuth helpers this app does not call. Auth stays in `requireMcpAccountContext`.
- **Omitted `arguments`.** 1.32 accepts `tools/call` without an arguments object. Tools whose shape is all optional (`accountId` only) can succeed where 1.29 might have rejected the call. Tools with required fields still fail zod. Relaxation, not a break. The route tests passed.

**shadcn already wanted this SDK.** `shadcn@4.22.1` depends on `@modelcontextprotocol/sdk@^1.32.0`. On 1.29.0 that copy was nested at `shadcn/node_modules`. Pinning 1.32.1 hoists one copy. The app imports the package by name, so it picks up the hoisted 1.32.1.

### Migration recipe

`package.json` (same hunk as the nodemailer section):

```diff
-    "@modelcontextprotocol/sdk": "1.29.0",
+    "@modelcontextprotocol/sdk": "1.32.1",
```

Keep the exact pin (no caret). Then `nice -n 10 bun install`. No edit to `lib/mcpServer.ts` or `app/api/mcp/route.ts`.

Do not, as part of this bump: switch the route to `WebStandardStreamableHTTPServerTransport`, add elicitation, or set `maxToolInputElements`. If a cap is wanted later, the only call-site change is the existing constructor:

```ts
const server = new McpServer(
  { name: "mywebmail-mcp", version: "0.1.0" },
  { capabilities: { tools: {} }, maxToolInputElements: /* chosen limit */ }
);
```

That was not tested with a number set. Leave it unset.

### Verification

| Command | Result |
| --- | --- |
| `nice -n 10 bunx tsc --noEmit --pretty false --incremental false` | both bumps, stubs kept: exit 2, **355** errors, 0 added, 0 removed vs pre-bump |
| `nice -n 10 bun test lib/mcpServer app/api/mcp` | **5 pass, 0 fail**, 89 expects, 722ms. Only `app/api/mcp/route.test.ts`. There is no `lib/mcpServer*.test.ts` |
| `nice -n 10 bun run test:ci` | same combined run as nodemailer: **1698 + 48 pass, 0 fail** |
| `bun pm ls --all` | `zod@4.3.6` once. No `zod@3` |

`npm view @modelcontextprotocol/sdk@1.32.1` peer and dependency zod range: `^3.25 || ^4.0`. `engines.node` is `>=18`.

### Overlap with in-flight branches

**feat/thread-collaboration** (`ad6db7a..beb8dd5`) edits `lib/mcpServer.ts` (1187 → 1230 lines) and `app/api/mcp/route.test.ts`. The new tools use the same `server.registerTool(name, { description, inputSchema, outputSchema }, handler)` plus zod raw shapes (`z.object`, `z.enum`, `.min`/`.max`). Those signatures did not change in 1.32.1. The branch does not edit `package.json` / `bun.lock`. A version-only bump does not conflict with the new tools. Re-test `route.test.ts` and the collab MCP tests after the branch lands; do not retouch the tool registrations for this upgrade.

**feat/team-auth** (`11c322b..8ff60ed`, head `8ff60ed`). The requested path filter:

```
app/api/mcp/route.test.ts | 149 ++--
app/api/mcp/route.ts      |  56 +--
```

`lib/mcpServer.ts` is **not** in that diff (still 1187 lines on the branch). Wider stat, same range: `lib/auth.ts` 421 lines changed. The branch deletes the `AuthInfo` import and the inline auth object from `route.ts`; `POST` returns `requireMcpAccountContext(request)` and no longer calls `executeMcpHttpRequest` in the route file. `AuthInfo` is unchanged between SDK 1.29.0 and 1.32.1, so the base route needs no type edit, and team-auth's deletion of that block does not collide with a pin-only bump.

Neither branch is a reason to edit MCP call sites for 1.32.1. They are a reason not to rewrite `mcpServer.ts` while they are open.

### Risks & recommendation

Pin `1.32.1` with no code change. Zod 4 stays deduped; do not add a zod 3 override. The body-size limit from 1.30.1 does **not** cover this endpoint, because the route never uses the SDK HTTP transport. Do not describe the bump as having closed that. Elicitation, sessions, and Streamable HTTP are not useful until the transport stops being one stateless JSON POST.

Apply this pin and the nodemailer pin in one `bun install` after feat/thread-collaboration and feat/team-auth merge, or before them: those branches do not edit `package.json`, `bun.lock`, `smtp.ts`, or the ambient nodemailer stubs. The only shared files are `lib/mcpServer.ts` and `app/api/mcp/route.ts`, and this upgrade does not modify them. Other in-flight dependency bumps will conflict on `bun.lock`; rebase the lockfile, do not combine the package pins by hand.

---

## Restore

```bash
cd /home/monkey/code/noctua-mail/wt-probe-mail
git checkout -- .
git clean -fd -e node_modules
nice -n 10 bun install --frozen-lockfile
```

Result: `git status` clean, detached `c1652ec`, nothing to commit. Installed again: nodemailer **8.0.5**, `@modelcontextprotocol/sdk` **1.29.0**, zod **4.3.6**.
