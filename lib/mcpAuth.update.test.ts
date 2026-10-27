import { beforeAll, expect, test } from "bun:test";
import { dbModulePromise } from "./testDbHarness";
import { createAuthenticatedTestSession } from "./testAuthHarness";
import { identityTestAccount } from "./testFixtures/senderIdentities";
import { requireActiveUserSession, type ActiveUserSession } from "./auth";
import { mintMcpToken, resolveMcpToolContextRow, updateMcpTokenAccounts, validateMcpTokenRow } from "./mcpAuth";

type Principal = Awaited<ReturnType<typeof createAuthenticatedTestSession>>;
let principal: Principal, colleague: Principal;
let session: ActiveUserSession, colleagueSession: ActiveUserSession;
const accountId = `mcp-update-${crypto.randomUUID()}`, sharedId = `${accountId}-shared`, otherId = `${accountId}-other`, foreignId = `${accountId}-foreign`;
async function activeSession(fixture: Principal) {
  const active = await requireActiveUserSession(new Request("http://localhost:3000", { headers: fixture.jar.headers() }));
  if (active instanceof Response) throw new Error("Synthetic session missing");
  return active;
}
beforeAll(async () => {
  const db = await dbModulePromise;
  for (const id of [accountId, sharedId, otherId, foreignId]) await db.upsertAccount(identityTestAccount(id));
  principal = await createAuthenticatedTestSession(accountId);
  await principal.addMembership(principal.user.id, sharedId, "editor");
  await principal.addMembership(principal.user.id, otherId, "manager");
  colleague = await createAuthenticatedTestSession(accountId);
  session = await activeSession(principal);
  colleagueSession = await activeSession(colleague);
});
const rows = (tokenId: string) => (principal.master.prepare("SELECT accountId FROM mcp_token_accounts WHERE tokenId=? ORDER BY accountId").all(tokenId) as { accountId: string }[]).map(row => row.accountId);
const primary = (tokenId: string) => (principal.master.prepare("SELECT accountId FROM mcp_tokens WHERE id=?").get(tokenId) as { accountId: string }).accountId;

test("adds and removes mailboxes; the token string, hash and primary stay unchanged", async () => {
  const { token, tokenRecord } = await mintMcpToken(session, accountId, "Synthetic editable", 3600);
  const hash = () => principal.master.prepare("SELECT tokenHash, tokenSuffix FROM mcp_tokens WHERE id=?").get(tokenRecord.id);
  const before = hash();
  const widened = await updateMcpTokenAccounts(session, accountId, tokenRecord.id, [accountId, sharedId]);
  expect(widened).toMatchObject({ id: tokenRecord.id, accountId, accountIds: [accountId, sharedId].sort() });
  expect(JSON.stringify(widened)).not.toContain("tokenHash");
  expect(hash()).toEqual(before);
  expect(validateMcpTokenRow(principal.master, token)?.tokenRecord.id).toBe(tokenRecord.id);
  expect(resolveMcpToolContextRow(principal.master, tokenRecord.id, sharedId).role).toBe("editor");
  expect((await updateMcpTokenAccounts(session, sharedId, tokenRecord.id, [sharedId, accountId, sharedId]))?.accountIds).toEqual([accountId, sharedId].sort());
  expect((await updateMcpTokenAccounts(session, accountId, tokenRecord.id, [accountId]))?.accountIds).toEqual([accountId]);
  expect(rows(tokenRecord.id)).toEqual([accountId]);
  expect(() => resolveMcpToolContextRow(principal.master, tokenRecord.id, sharedId)).toThrow("not covered");
});

test("a legacy primary-only token without mapping rows gets rows written", async () => {
  const { tokenRecord } = await mintMcpToken(session, accountId, "Synthetic legacy", 3600);
  principal.master.prepare("DELETE FROM mcp_token_accounts WHERE tokenId=?").run(tokenRecord.id);
  expect((await updateMcpTokenAccounts(session, accountId, tokenRecord.id, [accountId, sharedId]))?.accountIds).toEqual([accountId, sharedId].sort());
  expect(rows(tokenRecord.id)).toEqual([accountId, sharedId].sort());
  expect(primary(tokenRecord.id)).toBe(accountId);
});

test("only the creator may change the set; another member of the mailbox gets no token", async () => {
  const { tokenRecord } = await mintMcpToken(session, accountId, "Synthetic foreign creator", 3600);
  expect(await updateMcpTokenAccounts(colleagueSession, accountId, tokenRecord.id, [accountId])).toBeNull();
  expect(await updateMcpTokenAccounts(session, accountId, crypto.randomUUID(), [accountId])).toBeNull();
  expect(rows(tokenRecord.id)).toEqual([accountId]);
});

test("every selected mailbox needs the creator's membership and the route mailbox", async () => {
  const { tokenRecord } = await mintMcpToken(session, accountId, "Synthetic membership", 3600);
  await expect(updateMcpTokenAccounts(session, accountId, tokenRecord.id, [accountId, foreignId])).rejects.toThrow("Mailbox membership required");
  await expect(updateMcpTokenAccounts(session, accountId, tokenRecord.id, [sharedId])).rejects.toThrow("Mailbox membership required");
  await expect(updateMcpTokenAccounts(session, accountId, tokenRecord.id, [])).rejects.toThrow("Mailbox membership required");
  expect(rows(tokenRecord.id)).toEqual([accountId]);
});

test("the route mailbox must already be covered by the token", async () => {
  const { tokenRecord } = await mintMcpToken(session, accountId, "Synthetic uncovered", 3600);
  // sharedId is a member mailbox of the creator, but the token does not cover it yet.
  expect(await updateMcpTokenAccounts(session, sharedId, tokenRecord.id, [sharedId, accountId])).toBeNull();
  expect(rows(tokenRecord.id)).toEqual([accountId]);
});

test("deselecting the primary moves it to the creator's highest role, then by ID; a kept primary stays", async () => {
  // otherId sorts before sharedId; with viewer on otherId the editor mailbox must win.
  const { tokenRecord } = await mintMcpToken(session, accountId, "Synthetic primary", 3600, { accountIds: [accountId, otherId, sharedId] });
  principal.master.prepare("UPDATE user_accounts SET role='viewer' WHERE userId=? AND accountId=?").run(principal.user.id, otherId);
  try {
    expect((await updateMcpTokenAccounts(session, sharedId, tokenRecord.id, [sharedId, otherId]))?.accountId).toBe(sharedId);
    expect(resolveMcpToolContextRow(principal.master, tokenRecord.id)).toMatchObject({ accountId: sharedId, role: "editor" });
    expect((await updateMcpTokenAccounts(session, sharedId, tokenRecord.id, [sharedId, otherId, accountId]))?.accountId).toBe(sharedId);
  } finally {
    principal.master.prepare("UPDATE user_accounts SET role='manager' WHERE userId=? AND accountId=?").run(principal.user.id, otherId);
  }
  expect(primary(tokenRecord.id)).toBe(sharedId);
});
