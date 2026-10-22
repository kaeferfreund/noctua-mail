// Run from REVIEW_CHECKOUT with: bun test --config <probe-dir>/bunfig.toml <this-file>
// Synthetic data only. Each regression asserts the required fixed behavior.
import { test, expect, spyOn } from "bun:test";
const root = process.env.REVIEW_CHECKOUT ?? "/home/monkey/code/noctua-mail/wt-review-collab";
const { dbModulePromise } = await import(`${root}/lib/testDbHarness.ts`);
const db = await dbModulePromise;
const { getDb, getAccountDb } = await import(`${root}/lib/db/connection.ts`);
const { identityTestAccount } = await import(`${root}/lib/testFixtures/senderIdentities.ts`);
const { createAuthenticatedTestSession } = await import(`${root}/lib/testAuthHarness.ts`);
const { createSenderIdentity } = await import(`${root}/lib/senderIdentities.ts`);
const { parseDeliveryMetadata } = await import(`${root}/lib/mail/imap/parser.ts`);
const { resolveComposeIdentity } = await import(`${root}/lib/senderIdentitySelection.ts`);
const { PUT } = await import(`${root}/app/api/accounts/[accountId]/identities/route.ts`);
async function fixture() {
  const accountId = `review-${crypto.randomUUID()}`;
  await db.upsertAccount(identityTestAccount(accountId));
  const folderId = `${accountId}:INBOX`;
  await db.saveFoldersForAccount(accountId, [{ id: folderId, accountId, name: "INBOX", count: 0 }]);
  const message = { id: `imap-${crypto.randomUUID()}`, messageId: `<${crypto.randomUUID()}@example.test>`, accountId, folderId,
    threadId: `thread-${crypto.randomUUID()}`, from: "customer@example.test", to: "primary@example.test", subject: "Synthetic", preview: "Synthetic", body: "Synthetic",
    date: new Date(1000).toISOString(), dateValue: 1000, imapUid: 1, mailboxPath: "INBOX" };
  return { accountId, folderId, message };
}
test("R1 from:me and with:me match any historical own address rather than requiring all", async () => {
  const f = await fixture(); const auth = await createAuthenticatedTestSession(f.accountId);
  await createSenderIdentity(f.accountId, { email: "alias@example.test", displayName: "Alias" }, { userId: auth.user.id }, await getDb());
  await db.upsertMessages(f.accountId, f.folderId, [
    { ...f.message, from: "primary@example.test", to: "customer@example.test" },
    { ...f.message, id: `${f.message.id}-alias`, messageId: `<alias-${crypto.randomUUID()}@example.test>`, imapUid: 2, from: "alias@example.test", to: "customer@example.test" }
  ]);
  const outputs = await Promise.all(["from:me", "with:me"].map(search => db.listMessages({ accountId: f.accountId, query: search, page: 1, pageSize: 10 })));
  expect(outputs.map(output => output.total)).toEqual([2, 2]);
});
test("R2 repeated manager recompute retries coalesce while a job is running", async () => {
  const f = await fixture(); const auth = await createAuthenticatedTestSession(f.accountId);
  const spawn = spyOn(Bun, "spawn").mockImplementation(() => ({ pid: process.pid, exited: new Promise(() => {}), stderr: null }) as any);
  try {
    const results = [];
    for (let i = 0; i < 3; i++) {
      const request = new Request(`http://localhost:3000/api/accounts/${f.accountId}/identities`, { method: "PUT", headers: auth.jar.headers({ origin: "http://localhost:3000", "content-type": "application/json" }), body: JSON.stringify({ recompute: true }) });
      const response = await PUT(request, { params: Promise.resolve({ accountId: f.accountId }) });
      expect(response.status).toBe(202); results.push(await response.json());
    }
    expect(new Set(results.map(result => result.recomputeJob.id)).size).toBe(1);
    expect(spawn).toHaveBeenCalledTimes(1);
  } finally { spawn.mockRestore(); }
});
test("R3 shared-shard envelope replacement preserves B metadata after A's base copy disappears", async () => {
  const a = await fixture(); const b = await fixture();
  const shard = await getAccountDb(a.accountId);
  const { getDefaultAccountDbPath } = await import(`${root}/lib/runtimePaths.ts`);
  (await getDb()).prepare("UPDATE accounts SET dbPath=? WHERE id=?").run(getDefaultAccountDbPath(a.accountId), b.accountId);
  const bMessage = { ...b.message, id: a.message.id, messageId: a.message.messageId };
  await db.upsertMessages(a.accountId, a.folderId, [{ ...a.message, deliveredTo: ["a@example.test"] }]);
  await db.upsertMessages(b.accountId, b.folderId, [{ ...bMessage, deliveredTo: ["b@example.test"], originalTo: ["alias@example.test"], senderIdentityId: "b-identity" }]);
  shard.prepare("DELETE FROM messages WHERE accountId=?").run(a.accountId);
  await db.upsertMessages(b.accountId, b.folderId, [bMessage], true);
  expect(await db.getMessageById(b.accountId, bMessage.messageId)).toMatchObject({ deliveredTo: ["b@example.test"], originalTo: ["alias@example.test"], senderIdentityId: "b-identity" });
});
test("R4 valid recipient comments retain Bcc-only alias evidence and select that alias", () => {
  const metadata = parseDeliveryMetadata(Buffer.from("Delivered-To: primary@example.test\r\nX-Original-To: alias@example.test (original recipient)\r\n\r\n"));
  const identities = ["primary", "alias"].map((id, i) => ({ id, accountId: "a", email: `${id}@example.test`, displayName: id, enabled: true, isDefault: i === 0, createdBy: null, createdAt: 1, updatedAt: 1 }));
  const result = resolveComposeIdentity({ accountId: "a", identities, mode: "reply", message: { from: "customer@example.test", to: "", ...metadata } });
  expect({ originalTo: metadata.originalTo, selection: result.identity?.id }).toEqual({ originalTo: ["alias@example.test"], selection: "alias" });
});
test("R5 MCP ignores historical alias exclusion while a configured rebuild is pending or failed", async () => {
  const f = await fixture(); const auth = await createAuthenticatedTestSession(f.accountId);
  const { createTopic, setThreadTopics, getTopicSuggestionsForThreads } = await import(`${root}/lib/topics/index.ts`);
  const topic = await createTopic(f.accountId, "Synthetic", "blue");
  const training = { ...f.message, id: `${f.message.id}-training`, messageId: `<training-${crypto.randomUUID()}@example.test>`, threadId: `${f.message.threadId}-training`, from: "trainer@training.test", to: "alias@example.test", subject: "Training", imapUid: 2 };
  const target = { ...f.message, from: "target@target.test", to: "alias@example.test", subject: "Target" };
  await db.upsertMessages(f.accountId, f.folderId, [training, target]);
  await setThreadTopics(f.accountId, training.threadId, [topic.id]);
  // Offline mutation models the documented state after configuration commits and its worker fails.
  await createSenderIdentity(f.accountId, { email: "alias@example.test", displayName: "Alias" }, { userId: auth.user.id }, await getDb());
  const fullAccount = await db.getAccountById(f.accountId);
  const { getOwnAddresses } = await import(`${root}/lib/ownAddresses.ts`);
  const correct = await getTopicSuggestionsForThreads(f.accountId, [target.threadId], { accountEmail: getOwnAddresses(fullAccount!) });
  expect(correct.get(target.threadId) ?? []).toEqual([]);
  const { requireActiveUserSession } = await import(`${root}/lib/auth.ts`);
  const { mintMcpToken } = await import(`${root}/lib/mcpAuth.ts`);
  const { POST } = await import(`${root}/app/api/mcp/route.ts`);
  const session = await requireActiveUserSession(new Request("http://localhost:3000", { headers: auth.jar.headers() }));
  expect(session).not.toBeInstanceOf(Response);
  const minted = await mintMcpToken(session as any, f.accountId, "Synthetic review", 3600);
  const response = await POST(new Request("http://localhost:3000/api/mcp", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${minted.token}` }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "search_messages", arguments: { threadIds: [target.threadId] } } }) }));
  const body = await response.json();
  expect(body.result?.isError).not.toBe(true);
  expect(body.result.structuredContent.items[0].topicSuggestions).toEqual([]);
});

test("R6 first recompute repairs IDN legacy authors before deriving latest-received dates", async () => {
  const f = await fixture(); const auth = await createAuthenticatedTestSession(f.accountId);
  const outbound = { ...f.message, id: `${f.message.id}-out`, messageId: `<out-${crypto.randomUUID()}@example.test>`, from: "alias@bücher.example", dateValue: 2000, imapUid: 2 };
  await db.upsertMessages(f.accountId, f.folderId, [f.message, outbound]);
  const shard = await getAccountDb(f.accountId);
  shard.prepare("UPDATE messages SET fromEmail=NULL WHERE accountId=? AND id=?").run(f.accountId, outbound.id);
  await createSenderIdentity(f.accountId, { email: "alias@bücher.example", displayName: "IDN alias" }, { userId: auth.user.id }, await getDb());
  await db.recomputeThreadsForAccount(f.accountId);
  expect(shard.prepare("SELECT fromEmail FROM messages WHERE accountId=? AND id=?").get(f.accountId, outbound.id)).toEqual({ fromEmail: "alias@xn--bcher-kva.example" });
  expect(shard.prepare("SELECT latestReceivedDateValue FROM threads WHERE accountId=? AND threadId=?").get(f.accountId, f.message.threadId)).toEqual({ latestReceivedDateValue: 1000 });
});
