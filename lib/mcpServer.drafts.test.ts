import { expect, test } from "bun:test";
import { createCollabFixture } from "./testThreadCollabHarness";
import { createAuthenticatedTestSession } from "./testAuthHarness";
import { requireActiveUserSession } from "./auth";
import { mintMcpToken } from "./mcpAuth";
import { executeMcpHttpRequest } from "./mcpServer";

test("MCP draft errors expose 409 for stale edits, missing body and missing attachments", async () => {
  const f = await createCollabFixture();
  const folderId = `${f.accountId}:Drafts`;
  await f.api.saveFoldersForAccount(f.accountId, [{ id: folderId, accountId: f.accountId, name: "Drafts", specialUse: "\\Drafts", count: 0 }]);
  const fixture = await createAuthenticatedTestSession(f.accountId);
  const session = await requireActiveUserSession(new Request("http://localhost:3000", { headers: fixture.jar.headers() }));
  if (session instanceof Response) throw new Error("Synthetic session missing");
  const tokenRecord = (await mintMcpToken(session, f.accountId, "Synthetic draft errors", 3600, { mode: "drafts" })).tokenRecord;
  const message = f.message("<draft-errors@example.test>", { folderId, flags: ["\\Draft"], draft: true, from: f.account.email });
  await f.api.upsertMessages(f.accountId, folderId, [message]);
  const call = async (args: Record<string, unknown>) => {
    const response = await executeMcpHttpRequest({ accountId: f.accountId, account: f.account, tokenRecord,
      body: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "update_draft_message", arguments: { draftId: message.id, ...args } } } });
    return (response.responses[0] as unknown as { result: unknown }).result;
  };
  expect(await call({ subject: "Stale", expectedUpdatedAt: message.dateValue - 1 })).toMatchObject({ isError: true,
    structuredContent: { ok: false, code: "draft_changed", status: 409 } });
  f.db.prepare("UPDATE messages SET body='', htmlBody=NULL, hasSource=0 WHERE id=?").run(message.id);
  expect(await call({ subject: "Missing body" })).toMatchObject({ isError: true,
    structuredContent: { ok: false, code: "invalid_draft", status: 409 } });
  await f.api.upsertMessages(f.accountId, folderId, [{ ...message, attachments: [
    { id: "missing", filename: "absent.txt", contentType: "text/plain", size: 4, inline: false }
  ] }]);
  const missingAttachment = await call({ text: "Replacement" });
  expect(missingAttachment).toMatchObject({ isError: true, structuredContent: { ok: false, status: 409 } });
  expect(JSON.stringify(missingAttachment)).toContain("not available locally");
});
