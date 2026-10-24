# Verification: MCP multi-mailbox fix d9b31bc9 (finding P2-1 from mcp-multi-mailbox-review-r1)

Worktree `wt-mcp-scopes`, branch `feat/mcp-multi-mailbox`, head `d9b31bc9`. Read-only check. Only the fix commit was reviewed.

**Verdict: OK**: P2-1 is fixed. No P0, P1 or P2 findings. Three P3s go to `briefs/BACKLOG.md`.

## What the fix does
`lib/db/mcpTokens.ts:21-30` `deleteMcpTokenAccountRows(db, accountId, createdByUserId?)`:
1. Deletes the mapping rows for `accountId` (limited to the given user's tokens when an owner is passed).
2. Deletes tokens whose primary is `accountId` and that have no mapping rows left. This covers single-mailbox tokens, whose only row was just removed, and legacy tokens with no rows.
3. Moves the primary of the remaining tokens with primary `accountId` to `MIN(accountId)` of their remaining rows.

`lib/accountMembers.ts:49` calls it with `userId` inside the `.immediate()` revoke transaction, right after the `user_accounts` delete.

## Checks

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Revoke, then re-add, does not restore access | OK | Integration test: revoke U from A through `changeAccountMember`, then re-add through `changeAccountMember(..., "manager")`. Tokens that covered A still throw `not covered` for A. Deleted tokens stay deleted. A's MCP tab (`listMcpTokens(A)`) no longer lists U's tokens. A mutant test with the old revoke SQL reproduces the leftover mapping row. |
| 2 | A token whose primary was revoked gets a remaining mailbox as primary and keeps working | OK | Token [A primary, S]: primary moves to S. `resolveMcpToolContextRow(id)` without accountId resolves to S, and bearer validation resolves to S. Token [A, S, O]: primary moves to MIN(O, S), and O and S both resolve with live role `editor`. A token with primary S that also covers A keeps primary S and loses A. |
| 3 | Single-mailbox and legacy tokens of the removed user are deleted | OK | Single-mailbox token on A (row [A]) and legacy token on A (no rows) are both gone: no token row, no mapping rows, bearer validation returns `null`. |
| 4 | Other users' tokens and the removed user's other mailboxes are untouched | OK | V's tokens on A (multi [A, S], single A, legacy A) have the same token row and mapping rows before and after, and still resolve A. U's tokens that do not cover A ([S, O], legacy S) have the same rows. |
| 5 | Mailbox deletion path (no owner) behaves as before | OK | Differential test: 3,000 random token/mapping sets (4 mailboxes, 3 users, about 30 % legacy tokens) in in-memory SQLite with the real schema, FK and trigger. Base SQL and new function give identical tables in every case. Integration test through `deleteAccountControlPlane(X)`: sole-X tokens (mapped and legacy) are deleted, primaries move (X→S, X→O), and no rows or primaries point at X. |
| 6 | SQL is correct inside the immediate transaction | OK | Model test: 3,000 random revoke cases match a reference model exactly. In every case the user has no token that still covers the mailbox (as a mapping row or as primary), no orphan mapping rows remain, and no NULL primary appears. Step 3 cannot produce NULL: every token that reaches it with primary = revoked mailbox still has at least one mapping row, otherwise step 2 deleted it, and the revoked mailbox's row was removed in step 1. `mcp_tokens.accountId` is `NOT NULL`, so a NULL would abort the whole revoke rather than leave bad data. All three statements share the `changeAccountMember` `.immediate()` transaction, and `mintMcpToken` is also `.immediate()`, so a concurrent mint cannot interleave. |

Doc wording `doc/TEAM-INBOX.md:1086` matches the new behaviour. The updated assertions in `lib/mcpAuth.scopes.test.ts:94-102` (including revoke, then re-add) and in `lib/teamAuthSlice3.test.ts:154` are correct.

## Gates
- `bun check`: no type errors in 1,341 files.
- `bun test lib/mcpAuth.scopes.test.ts lib/db/mcpTokens lib/teamAuthSlice3.test.ts`: 39 pass, 1 fail. The failure is the known 5 s timeout in "absolute expiry and idle liveness", which also fails on the base commit.
- Extra: `lib/mcpServer.scopes.test.ts`, `app/api/accounts/[accountId]/mcp-tokens/*`, `lib/teamAuthContracts.test.ts`: 30 pass, 0 fail.
- ESLint on the 4 touched TS files: clean.
- Throwaway tests (`.tmp/verify/{sql,revoke,mutant}.test.ts`, run with a separate bunfig because `.tmp/**` is test-ignored) were removed afterwards.

## Findings

### P3-1 The new primary is the alphabetically first mailbox, not one with a suitable role
`lib/db/mcpTokens.ts:28`. `MIN(a.accountId)` can pick a remaining mailbox where the creator is only `viewer`, while minting requires `editor` on the primary. Calls without accountId then fail for draft-level tools, although another covered mailbox would allow them. This has the same effect as a role downgrade and is enforced at use time, so it is not a security issue.
Suggested fix (backlog): choose the remaining mailbox with the highest live role (tie: MIN), or leave it as is and document it.

### P3-2 `removeUserAccountLink` deletes a membership without token cleanup
`lib/db/users.ts:241`. This exported DB helper removes a `user_accounts` row and skips `deleteMcpTokenAccountRows`. Today only tests call it, so production is not affected. A future production caller would bring P2-1 back.
Suggested fix (backlog): call `deleteMcpTokenAccountRows(db, accountId, userId)` in it too, or mark it test-only.

### P3-3 Redundant `accountId IS NOT NULL` filter
`lib/db/mcpTokens.ts:25`. `mcp_tokens.accountId` is `NOT NULL`, so this filter is always true. Its only effect: on the deletion path, mapping rows whose token no longer exists are no longer deleted, which differs from the base. The FK cascade and the `mcp_token_accounts_delete_token` trigger prevent such rows, and the differential test showed no difference. This is a nit.
Suggested fix (backlog): write the subquery as `SELECT id FROM mcp_tokens WHERE 1=1${owner}`, or apply the owner filter only when an owner is given.

## Summary
- Verdict **OK**: d9b31bc9 fixes P2-1. Revoke followed by re-add no longer restores token access to the mailbox, and a revoked primary moves to a remaining mailbox.
- All six checks pass: real-API integration test (77 assertions), 3,000-case model test, 3,000-case differential test against the base deletion SQL, and a mutant test that reproduces the old bug.
- Other users' tokens and the removed user's other mailboxes are untouched. Single-mailbox and legacy tokens are deleted. No NULL primary and no leftover rows.
- Gates: `bun check` clean. Focused tests 39/40 (only the known slice-3 timeout), neighbouring MCP tests 30/30, lint clean.
- P0 0 / P1 0 / P2 0 / P3 3 (primary choice ignores role, test-only `removeUserAccountLink` skips cleanup, redundant NOT NULL filter): backlog only, merge can proceed.
