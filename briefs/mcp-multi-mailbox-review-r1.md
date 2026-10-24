# Review r1: MCP multi-mailbox tokens + permission modes

- Branch `feat/mcp-multi-mailbox`, commit `3d82d1ee` on `integration/stage` `9523bbe` (26 files, +591/−80)
- Lenses: security/permissions + correctness (one report)
- Reviewer: Claude Opus 5.5, read-only; no repo files changed, scratch under `.tmp` removed

## Verdict: FIX (one P2, fix once in the branch; P3 to backlog)

No P0/P1 found. The central scope gate, mailbox-set resolution, mint validation, mailbox cascade and
`authorizeOutbound` send default behave as described. One P2 in the membership-revoke path (permissions
area → one verification after the fix, per AGENTS.md rule 2).

## Gates re-run (worktree, `nice -n 15`, `TMPDIR=<worktree>/.tmp`)

| Gate | Result |
| --- | --- |
| `bun check` | 0 type errors, 1,341 files |
| Focused server tests (report command, 11 files) | 39 pass / 0 fail, 403 assertions, 29.8 s |
| DOM tests (`McpTabContent`, `SettingsTabsB.i18n`) | 8 pass / 0 fail, 32 assertions |
| Extra review tests (`.tmp`, removed) | 3 pass; results below |
| `messages/de.json`, `messages/en.json` | valid JSON, no duplicate keys |

The report's gate numbers match.

Extra checks run in `.tmp`:
- `drafts` token via `tools/call` batch: `create_sender_identity`, `update_sender_identity`, `set_sender_preferences` → `Token has no manage permission`; `list_folders` in the same batch succeeds.
- Legacy token (`scopes = NULL`): `create_sender_identity` → `Token has no manage permission`.
- `read` token: `flag_message` → `Token has no drafts permission`, also with `params.name` as an array (`["flag_message"]`); read call in the same batch succeeds.
- `full` token with an extra mailbox where the creator is viewer: `flag_message` on that mailbox → `Insufficient mailbox role`.
- Mint with a viewer-role mailbox as primary → rejected.
- Membership revoke on a non-primary covered mailbox, then re-add → access comes back (see P2-1).

## Verified claims (no finding)

- **Central gate** (`lib/mcpServer.ts:931`): every JSON-RPC request with `method === "tools/call"` is checked against stored scopes before dispatch, including batches. Unknown tool names (including prototype keys such as `toString`) are denied. The server only declares the `tools` capability; there are no resources, prompts or completion handlers to bypass the gate. `authInfo.scopes` is not used for enforcement.
- **Scope storage**: modes cannot be edited, so checking the scope at entry has no TOCTOU problem. `parseMcpScopes`: NULL → `read,drafts`; invalid JSON, unknown entries or non-arrays → `[]` (denies everything, including `list_accounts`).
- **Mailbox set** (`lib/mcpAuth.ts` `liveToken`): an `accountId` outside the set throws `Mailbox is not covered by MCP token`; a covered mailbox without live membership returns `Unauthorized MCP token`; leaving out `accountId` selects the primary. All handlers use the live `ctx` from `resolveAccountContext` (`{...baseContext, ...live}`), not the base context. The only direct base-context use is `listMcpTokenAccounts(context.tokenRecord.id)`, which only reads the token ID. No path found that returns data of mailbox B under A.
- **Roles**: `resolveAccountRoleRow` needs real membership or ownership (no admin bypass). A viewer extra mailbox stays viewer for every tool; editor/manager tool minimums still apply on top of the scope.
- **Mint**: editor or higher is needed on the primary (route mailbox), and membership for every selected mailbox is checked inside the mint transaction. The route requires `accountIds` to include the route mailbox and to be a non-empty array of strings. Duplicates are removed.
- **Outbound**: `authorizeOutbound` with `tokenId` and no `purpose` requires `send`, and `assertCurrent` checks the scope again. `sendDraft` (`lib/drafts.ts:576`) uses the default and so needs `send`. `saveDraftForAccount` uses `purpose: "draft"`. Identity/preference writes use `"identity-management"` → `manage`. The web-session paths are unchanged. `create_draft_message` has no send or schedule option.
- **Token list/delete**: an editor sees and deletes only their own tokens in each covered mailbox; a manager sees all tokens covering the mailbox. The DELETE route looks up the token through `listMcpTokens(context.accountId)` before deleting.
- **Cascade**: `deleteAccountControlPlane` → `deleteMcpTokenAccountRows` removes the mapping rows, deletes tokens with no mailbox left (including legacy tokens with no mapping rows) and moves the primary to `MIN(accountId)` of the remaining mailboxes. Deleting a token removes its mapping rows (FK `ON DELETE CASCADE` with `foreign_keys = ON` in `lib/db/connection.ts:91`, plus the AFTER DELETE trigger). User delete, security-generation bump, password/MFA reset, credential change and the team-auth cutover all delete from `mcp_tokens`, so the trigger covers them.
- **Migration**: `CREATE TABLE/INDEX/TRIGGER IF NOT EXISTS` on the master schema only. `mcp_tokens.id` is `TEXT PRIMARY KEY`, so the FK target is valid. The legacy-install test runs the migration twice with an existing token row and keeps `scopes NULL` and no mapping rows. No shard change.
- **Docs**: `doc/API.md` and `doc/TEAM-INBOX.md` describe the implemented behaviour, including legacy NULL → read/drafts and invalid JSON → no permissions.

## Findings

### P2-1 Membership revoke leaves mapping rows; re-adding the member silently re-enables the token for that mailbox
`lib/accountMembers.ts:47` (with `lib/db/mcpTokens.ts:27` listing and `lib/mcpAuth.ts` `liveToken`)

`changeAccountMember(..., null)` deletes only tokens whose primary is the revoked mailbox and that have no other mapping. For multi-mailbox tokens, the `mcp_token_accounts` row for the revoked mailbox stays (and so does `mcp_tokens.accountId` if it was the primary). Effects, reproduced in `.tmp`:
1. Token covers A (primary) and B. Remove the creator from B, then add them back → `resolveMcpToolContextRow(token, B)` succeeds again. A single-mailbox token in the same scenario stays revoked. Before this change, a membership revoke permanently revoked the token for that mailbox (`doc/TEAM-INBOX.md` used to say "Membership revoke deletes that user/account's tokens").
2. While the creator is removed, the manager of B still sees the creator's token in B's MCP tab, with B listed as a covered mailbox.
3. If the revoked mailbox was the primary, the token keeps an unusable primary, so every call without `accountId` fails with `Unauthorized MCP token`, although other mailboxes are still covered. The cascade on mailbox deletion moves the primary instead.

Suggested fix: in the revoke transaction, run the same steps as `deleteMcpTokenAccountRows`, limited to `createdByUserId = userId`: delete that user's mapping rows for the mailbox, delete tokens with no mailbox left (and primary-only legacy tokens), and move the primary of the remaining tokens. Add a revoke → re-add test, and update the `doc/TEAM-INBOX.md:1086` wording.

### P3-1 `tools/list` advertises tools the token's mode cannot call
`lib/mcpServer.ts:931` (gate exists only on `tools/call`)

A `read` token still gets all 27 tools in `tools/list`. MCP clients and LLM agents will try the mutation tools and receive errors. Not a security issue, because the call is refused.
Suggested fix: filter the `tools/list` response with `MCP_TOOL_SCOPES` and the stored scopes, or register only the permitted tools per request.

### P3-2 Token rows show raw IDs of mailboxes the viewer cannot access; GET returns them
`app/components/account-settings/tabs/McpTabContent.tsx:427`, `lib/db/mcpTokens.ts:17`

A manager of B who lists another member's token covering A, B and C receives `accountIds` for A and C and sees them as raw IDs in the row. This shows which other mailboxes that member connected.
Suggested fix: in the GET route, keep only the IDs the requester can access and add a count (e.g. "+2 weitere Postfächer").

### P3-3 Delete from one mailbox tab revokes the token for every covered mailbox
`app/api/accounts/[accountId]/mcp-tokens/[tokenId]/route.ts:29`

A manager of B can revoke another member's token, including that token's access to A and C, where the manager has no rights. This matches the report ("widerruft das gesamte Token") and may be intended, but the UI does not tell the manager.
Suggested fix: either remove only the current mailbox when the caller is not the creator, or add a short hint to the delete confirmation.

### P3-4 Stale schema comment
`lib/db/schema.ts:165`: "Reserved, not enforced yet (NULL = legacy behaviour)." Scopes are enforced now.
Suggested fix: update the comment to "NULL = legacy read+drafts".

### P3-5 UI shows a token with invalid stored scopes as "Nur lesen"
`app/components/account-settings/tabs/McpTabContent.tsx:426`

`mcpPermissionMode([])` returns `read`, but such a token cannot call anything. This only happens with corrupted DB data.
Suggested fix: show an "ungültig" label when `scopes` is empty.

### P3-6 Test gaps
- No committed test sends manage tools through `tools/call` with a `drafts` or legacy token (only `authorizeOutbound` is tested directly). The review checked this manually, and it passes.
- No revoke → re-add test (see P2-1).
- No screenshot or 390 px check of the new mailbox and mode controls. The markup uses `overflowWrap: anywhere` and column flex, so no problem is expected, but this review did not check it visually.

Suggested fix: add the first two cases to `lib/mcpServer.scopes.test.ts` and `lib/mcpAuth.scopes.test.ts` while fixing P2-1.

## Informational (no finding)

- Existing tokens (`scopes = NULL`) lose sender-identity and sender-preference management, which they had before if the creator was a manager. This follows the brief and is documented. The user may need to know that an existing token used for identity management must be replaced by a "Vollzugriff" token.
- After a token is created, the mailbox selection and mode are not reset (only the label is). Harmless.

## Summary

- Verdict: **FIX**. Fix P2-1 once in the branch, then run one verification (permissions area); P3s go to `briefs/BACKLOG.md`.
- P0: 0
- P1: 0
- P2: 1 (revoke leaves mapping rows: re-add re-enables the token, it stays listed, and the primary is not moved)
- P3: 6 (tools/list not filtered, foreign mailbox IDs visible, delete scope across mailboxes, stale comment, invalid-scope label, test gaps)
