# MCP: several mailboxes per token + permission mode (no send)

User request 2026-10-23 ~22:40 UTC (German): "wir brauchen auch die Möglichkeit für den MCP mehrere (ggf. shared) Mailboxen zu verwenden und die Senden-Funktion zu sperren, dass MCP nur lesen und Entwürfe anlegen darf, wenn das im Web-UI so eingetragen ist."

Worktree: ROOT/wt-mcp-scopes, branch feat/mcp-multi-mailbox, base integration/stage 9523bbe. Rules: briefs/_rules-common.md, AGENTS.md in the worktree.

## Current state (read these first)
- lib/mcpServer.ts (27 tools; `resolveAccountContext` rejects any accountId other than the token's one; `list_accounts` lists every mailbox of the creator, not just the token's).
- lib/mcpAuth.ts (`validateMcpTokenRow`, `resolveMcpToolContextRow`, `mintMcpToken`: token bound to exactly one `accountId`; role resolved live from the creator's membership in that mailbox).
- lib/db/mcpTokens.ts, lib/db/rowParsers.ts (`mapMcpTokenRow`), lib/data.ts (`McpTokenMetadata`), lib/db/schema.ts (master DB; `mcp_tokens.scopes TEXT` exists, reserved and unenforced), lib/db/schema.master.test.ts, lib/db/accounts.ts:180 (cascade delete by accountId).
- app/api/accounts/[accountId]/mcp-tokens/route.ts (+ [tokenId]/route.ts, tests), lib/auth.ts `requireMcpAccountContext`, app/api/mcp/route.ts.
- UI: app/components/account-settings/tabs/McpTabContent.tsx (+ McpTabContent.dom.test.tsx, settingsAccess.ts: tab visible for editor/manager). i18n: doc/I18N.md, catalogs under lib/i18n (German is the primary UI language; keep English keys too).
- Outbound: lib/outboundAuthorization.ts (`authorizeOutbound`, used by the sender-identity tools). There is no MCP send tool today; `create_draft_message` saves drafts only.
- Docs: doc/API.md, doc/TEAM-INBOX.md (§ "token scopes reserved").

## Scope
1. **Several mailboxes per token.** When creating a token in the web UI the user picks one or more mailboxes they are a member of (own and shared ones; list = `listAccessibleAccountsForUser`). Store the set in the master DB (new table `mcp_token_accounts(tokenId, accountId)` with PK on both, created idempotently in lib/db/schema.ts; keep `mcp_tokens.accountId` as the primary/default mailbox for backwards compatibility and for existing tokens). Live role per mailbox stays what it is today: the creator's current membership role in that mailbox, re-read on every call; a mailbox the creator lost access to is simply not usable through the token any more (no error on other mailboxes).
   - `resolveAccountContext`/`resolveMcpToolContextRow`: accept any accountId in the token's set; default (no accountId given) = primary mailbox. `list_accounts` returns only the token's mailboxes with the live role.
   - Token list/delete routes: a token appears in the MCP tab of every mailbox it covers (manager sees all, editor only own). Deleting a mailbox removes it from tokens; a token with no mailbox left is deleted. Deleting a token deletes its mapping rows.
   - Existing tokens keep working unchanged (migration: nothing to backfill; treat an empty mapping as "primary only").
2. **Permission mode per token**, chosen in the web UI at creation (not editable afterwards; a new token is cheap): stored in `mcp_tokens.scopes` as a JSON array of scopes, enforced server-side in one central place.
   - `read`: only read tools (list_*, search, check_new_mail, get_*).
   - `drafts` (default for new tokens): read + create_draft_message + flags/todo/topics + thread collaboration (status, assign, comments). Sender-identity creation/update and sender preferences stay allowed only with `manage`.
   - `send`: reserved for sending; **no MCP send tool is added in this task**. The gate must exist so that any future send path through MCP (including anything that calls `authorizeOutbound` with a tokenId to actually transmit mail) is refused unless the token has `send`. `authorizeOutbound` must refuse real sends for tokens without `send`; identity management via MCP needs `manage`.
   - UI labels (German primary): "Nur lesen", "Lesen und Entwürfe anlegen (kein Senden)", "Vollzugriff (auch senden)". Show the mode and the mailboxes on each token row. Legacy tokens with `scopes = NULL` behave as "Lesen und Entwürfe" (no send) — document this.
   - A tool call outside the mode returns a clear MCP error (`Token has no <scope> permission`), never a silent no-op.
3. Tests: unit tests for scope enforcement (every tool classified; a test that fails when a new tool is registered without a scope), multi-mailbox resolution (allowed / not in set / lost membership), route tests (create with mailboxes + mode, list in each covered mailbox, cascade), DOM test for the tab. Update doc/API.md and doc/TEAM-INBOX.md (scopes are now enforced).

## Out of scope
- No MCP send tool, no OAuth, no editing of existing tokens' mode or mailbox set, no changes to the web UI send path, no shard DB changes.

## Gates (in the worktree, `nice -n 15`, one at a time)
`bun check` (0 errors), `bunx eslint <touched files>` (0 new warnings), focused tests: `bun test lib/mcpAuth lib/mcpServer lib/db/mcpTokens lib/db/schema.master.test.ts lib/outboundAuthorization app/api/mcp app/api/accounts/[accountId]/mcp-tokens`, `bun run test:dom -- McpTabContent` (or the project's DOM test command from package.json for that file). Screenshots of the MCP tab at desktop and 390 px width with synthetic data are welcome but not required.

## Deliverables
Commits on feat/mcp-multi-mailbox (explicit paths), report in briefs/mcp-multi-mailbox-report.md: what changed, schema change (table + column use), gate results with numbers, open points. Commit trailer: `Co-Authored-By: Codex GPT-6.1 Sol <noreply@openai.com>` instead of the Claude trailer from _rules-common.md.
