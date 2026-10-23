import { beforeAll, expect, test } from "bun:test";
import { dbModulePromise } from "./testDbHarness";
import { createAuthenticatedTestSession } from "./testAuthHarness";
import { identityTestAccount } from "./testFixtures/senderIdentities";
import { requireActiveUserSession, type ActiveUserSession } from "./auth";
import { mintMcpToken, resolveMcpToolContextRow, validateMcpTokenRow, listMcpTokenAccounts } from "./mcpAuth";
import { changeAccountMember } from "./accountMembers";
import { authorizeOutbound } from "./outboundAuthorization";
import { executeMcpHttpRequest } from "./mcpServer";
import { scopesForMcpMode, type McpPermissionMode } from "./mcpPermissions";

let principal: Awaited<ReturnType<typeof createAuthenticatedTestSession>>;
let session: ActiveUserSession;
const accountId = `mcp-scopes-${crypto.randomUUID()}`, sharedId = `${accountId}-shared`, otherId = `${accountId}-other`;
beforeAll(async () => {
  const db = await dbModulePromise;
  for (const id of [accountId, sharedId, otherId]) await db.upsertAccount(identityTestAccount(id));
  principal = await createAuthenticatedTestSession(accountId);
  await principal.addMembership(principal.user.id, sharedId, "editor");
  await principal.addMembership(principal.user.id, otherId, "manager");
  const active = await requireActiveUserSession(new Request("http://localhost:3000", { headers: principal.jar.headers() }));
  if (active instanceof Response) throw new Error("Synthetic session missing");
  session = active;
});

const mint = (mode: McpPermissionMode = "drafts") => mintMcpToken(session, accountId, "Synthetic scoped token", 3600, { mode, accountIds: [accountId, sharedId] });

test("resolves covered own/shared mailboxes with live roles; an unrelated mailbox is denied", async () => {
  const { token, tokenRecord } = await mint();
  expect(validateMcpTokenRow(principal.master, token)?.accountId).toBe(accountId);
  expect(resolveMcpToolContextRow(principal.master, tokenRecord.id).accountId).toBe(accountId);
  expect(resolveMcpToolContextRow(principal.master, tokenRecord.id, sharedId).role).toBe("editor");
  expect(() => resolveMcpToolContextRow(principal.master, tokenRecord.id, otherId)).toThrow("not covered");
  expect((await listMcpTokenAccounts(tokenRecord.id)).map(item => item.account.id).sort()).toEqual([accountId, sharedId].sort());
  principal.master.prepare("DELETE FROM user_accounts WHERE userId=? AND accountId=?").run(principal.user.id, accountId);
  try {
    expect(validateMcpTokenRow(principal.master, token)?.accountId).toBe(sharedId);
    expect(() => resolveMcpToolContextRow(principal.master, tokenRecord.id, accountId)).toThrow("Unauthorized");
    expect(() => resolveMcpToolContextRow(principal.master, tokenRecord.id)).toThrow("Unauthorized");
    expect(resolveMcpToolContextRow(principal.master, tokenRecord.id, sharedId).role).toBe("editor");
    expect((await listMcpTokenAccounts(tokenRecord.id)).map(item => item.account.id)).toEqual([sharedId]);
    const response = await executeMcpHttpRequest({ accountId: sharedId, account: identityTestAccount(sharedId), tokenRecord,
      body: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "list_sender_identities", arguments: {} } } });
    // No accountId still selects the primary, even if authentication uses another live member mailbox.
    expect(JSON.stringify(response.responses)).toContain("Unauthorized MCP token");
  } finally { await principal.addMembership(principal.user.id, accountId, "manager"); }
  principal.master.prepare("UPDATE user_accounts SET role='viewer' WHERE userId=? AND accountId=?").run(principal.user.id, sharedId);
  try {
    expect(resolveMcpToolContextRow(principal.master, tokenRecord.id, sharedId).role).toBe("viewer");
    expect(() => resolveMcpToolContextRow(principal.master, tokenRecord.id, sharedId, "editor")).toThrow("Insufficient mailbox role");
  } finally { principal.master.prepare("UPDATE user_accounts SET role='editor' WHERE userId=? AND accountId=?").run(principal.user.id, sharedId); }
});

for (const mode of ["read", "drafts", "full"] as const) test(`outbound ${mode}: send is denied without send, drafts/manage remain separate and assertions recheck scopes`, async () => {
  const { tokenRecord } = await mint(mode);
  expect(tokenRecord.scopes).toEqual(scopesForMcpMode(mode));
  const source = { tokenId: tokenRecord.id }, input = { accountId: sharedId, minRole: "editor" as const };
  for (const [purpose, scope] of [[undefined, "send"], ["draft", "drafts"], ["identity-management", "manage"]] as const) {
    if (!tokenRecord.scopes?.includes(scope)) {
      await expect(authorizeOutbound(source, { ...input, purpose })).rejects.toThrow(`Token has no ${scope} permission`);
    } else {
      const actor = await authorizeOutbound(source, { ...input, purpose });
      actor.assertCurrent(principal.master);
      principal.master.prepare("UPDATE mcp_tokens SET scopes='[]' WHERE id=?").run(tokenRecord.id);
      expect(() => actor.assertCurrent(principal.master)).toThrow(`Token has no ${scope} permission`);
      principal.master.prepare("UPDATE mcp_tokens SET scopes=? WHERE id=?").run(JSON.stringify(tokenRecord.scopes), tokenRecord.id);
    }
  }
});

test("legacy NULL scopes and empty mapping mean primary-only read/drafts without send or manage", async () => {
  const { token, tokenRecord } = await mint();
  principal.master.prepare("DELETE FROM mcp_token_accounts WHERE tokenId=?").run(tokenRecord.id);
  principal.master.prepare("UPDATE mcp_tokens SET scopes=NULL WHERE id=?").run(tokenRecord.id);
  const legacy = validateMcpTokenRow(principal.master, token);
  expect(legacy?.tokenRecord.accountIds).toEqual([accountId]);
  expect(legacy?.tokenRecord.scopes).toEqual(["read", "drafts"]);
  expect(() => resolveMcpToolContextRow(principal.master, tokenRecord.id, sharedId)).toThrow("not covered");
  await expect(authorizeOutbound({ tokenId: tokenRecord.id }, { accountId, minRole: "editor" })).rejects.toThrow("Token has no send permission");
  await expect(authorizeOutbound({ tokenId: tokenRecord.id }, { accountId, minRole: "manager", purpose: "identity-management" })).rejects.toThrow("Token has no manage permission");
});


test("real membership revoke retains multi-mailbox token and revokes single-mailbox token", async () => {
  const manager = await createAuthenticatedTestSession(accountId);
  const multi = await mint();
  const single = await mintMcpToken(session, accountId, "Synthetic single", 3600);
  await changeAccountMember(accountId, principal.user.id, manager.user.id, null);
  try {
    expect(validateMcpTokenRow(principal.master, multi.token)?.accountId).toBe(sharedId);
    expect(validateMcpTokenRow(principal.master, single.token)).toBeNull();
    expect((await listMcpTokenAccounts(multi.tokenRecord.id)).map(item => item.account.id)).toEqual([sharedId]);
    expect(resolveMcpToolContextRow(principal.master, multi.tokenRecord.id, sharedId).role).toBe("editor");
    // The primary moves to a remaining mailbox; the revoked one is no longer covered.
    expect(resolveMcpToolContextRow(principal.master, multi.tokenRecord.id).accountId).toBe(sharedId);
    expect(() => resolveMcpToolContextRow(principal.master, multi.tokenRecord.id, accountId)).toThrow("not covered");
    expect(principal.master.prepare("SELECT COUNT(*) AS n FROM mcp_token_accounts WHERE tokenId=? AND accountId=?").get(multi.tokenRecord.id, accountId)).toEqual({ n: 0 });
  } finally { await principal.addMembership(principal.user.id, accountId, "manager"); }
  // Re-adding the member does not restore the token's access to the revoked mailbox.
  expect(() => resolveMcpToolContextRow(principal.master, multi.tokenRecord.id, accountId)).toThrow("not covered");
  expect(validateMcpTokenRow(principal.master, single.token)).toBeNull();
  expect((await listMcpTokenAccounts(multi.tokenRecord.id)).map(item => item.account.id)).toEqual([sharedId]);
});
