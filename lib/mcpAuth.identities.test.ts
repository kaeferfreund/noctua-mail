import { test, expect } from "bun:test";
import { dbModulePromise } from "./testDbHarness";
import { identityTestAccount } from "./testFixtures/senderIdentities";
import { createAuthenticatedTestSession } from "./testAuthHarness";
import { getDb } from "./db/connection";
import { createSenderIdentity } from "./senderIdentities";
import { requireActiveUserSession } from "./auth";
import { mintMcpToken, validateMcpToken } from "./mcpAuth";
import { createTopic, setThreadTopics } from "./topics/index";
import { POST } from "../app/api/mcp/route";
import { GET } from "../app/api/accounts/[accountId]/identities/route";
const db = await dbModulePromise;

test("live viewer MCP topic context includes historical identities, excludes foreign mailbox identities and exposes no private configuration", async () => {
  const accountId = `mcp-identities-${crypto.randomUUID()}`, foreignId = `${accountId}-foreign`;
  await db.upsertAccount(identityTestAccount(accountId)); await db.upsertAccount(identityTestAccount(foreignId));
  const auth = await createAuthenticatedTestSession(accountId);
  const foreignAuth = await createAuthenticatedTestSession(foreignId);
  const master = await getDb();
  const folderId = `${accountId}:INBOX`;
  await db.saveFoldersForAccount(accountId, [{ id: folderId, accountId, name: "INBOX", count: 0 }]);
  const targets: Array<{ id: string; threadId: string; own: boolean }> = [];
  for (const [index, email] of ["alias@example.test", "disabled@example.test", "foreign@example.test"].entries()) {
    const topic = await createTopic(accountId, `Synthetic ${index}`, "blue");
    const base = { accountId, folderId, subject: `Synthetic ${index}`, preview: "Synthetic", body: "Synthetic", date: new Date(1000).toISOString(), dateValue: 1000, to: email, mailboxPath: "INBOX" };
    const training = { ...base, id: `${accountId}-training-${index}`, messageId: `<training-${index}-${accountId}@example.test>`, threadId: `${accountId}-training-${index}`, from: `trainer${index}@training.test`, imapUid: index * 3 + 1 };
    const target = { ...base, id: `${accountId}-target-${index}`, messageId: `<target-${index}-${accountId}@example.test>`, threadId: `${accountId}-target-${index}`, from: `target${index}@target.test`, imapUid: index * 3 + 2 };
    await db.upsertMessages(accountId, folderId, [training, target]);
    await setThreadTopics(accountId, training.threadId, [topic.id]);
    targets.push({ id: target.id, threadId: target.threadId, own: index < 2 });
  }
  // Configure after learning, retaining stale alias signals to model a failed rebuild.
  await createSenderIdentity(accountId, { email: "alias@example.test", displayName: "Private alias label" }, { userId: auth.user.id }, master);
  const disabled = await createSenderIdentity(accountId, { email: "disabled@example.test", displayName: "Disabled label", enabled: false }, { userId: auth.user.id }, master);
  await createSenderIdentity(foreignId, { email: "foreign@example.test", displayName: "Foreign label", enabled: false }, { userId: foreignAuth.user.id }, master);
  const session = await requireActiveUserSession(new Request("http://localhost:3000", { headers: auth.jar.headers() }));
  if (session instanceof Response) throw new Error("Synthetic session unavailable");
  const minted = await mintMcpToken(session, accountId, "Synthetic", 3600);
  master.prepare("UPDATE user_accounts SET role='viewer' WHERE userId=? AND accountId=?").run(auth.user.id, accountId);
  await db.mergeUserAccountPrefs(auth.user.id, accountId, { signatureOverride: "Private personal signature" });
  const context = await validateMcpToken(minted.token);
  expect(context?.role).toBe("viewer");
  expect(context?.account.ownAddresses).toEqual(["primary@example.test", "alias@example.test", "disabled@example.test"]);
  // REST viewer visibility is the reference policy: disabled mailbox identities
  // are readable, while other mailboxes and another member's prefs are not.
  const list = await GET(new Request(`http://localhost:3000/api/accounts/${accountId}/identities`, { headers: auth.jar.headers() }), { params: Promise.resolve({ accountId }) });
  expect((await list.json()).identities).toContainEqual(expect.objectContaining({ id: disabled.id, enabled: false }));
  const call = async (args: Record<string, unknown>) => (await POST(new Request("http://localhost:3000/api/mcp", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${minted.token}` }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "search_messages", arguments: args } }) }))).json();
  for (const target of targets) {
    for (const args of [{ threadIds: [target.threadId] }, { relatedId: target.id }]) {
      const body = await call(args);
      expect(body.result?.isError).not.toBe(true);
      const items = body.result.structuredContent.items as Array<{ id: string; topicSuggestions?: unknown[] }>;
      expect(items.length).toBeGreaterThan(0);
      const item = items.find(item => item.id === target.id) ?? items[0];
      expect((item.topicSuggestions ?? []).length > 0).toBe(!target.own);
      const wire = JSON.stringify(body);
      for (const privateValue of ["Private alias label", "Disabled label", "Foreign label", "Private personal signature", disabled.id]) expect(wire).not.toContain(privateValue);
    }
  }
  expect((await call({ accountId: foreignId })).result.isError).toBe(true);
}, 20000);
