import { describe, expect, test } from "bun:test";
import { createSharedShardFixture } from "@/lib/testSharedShardHarness";
import { createAuthenticatedTestSession } from "@/lib/testAuthHarness";
import { saveAttachmentData } from "@/lib/storage";
import { GET, DELETE } from "./route";

const origin = "http://localhost:3000";
const thread = "<attachment-shared@example.test>";
const bid = "synthetic-b-message";
const aid = "synthetic-b-attachment";
const filename = "private-project-B.pdf";

async function fixture(role: "viewer" | "editor" = "viewer") {
  const pair = await createSharedShardFixture();
  const user = await createAuthenticatedTestSession();
  await user.addMembership(user.user.id, pair.a.accountId, role);
  await pair.b.seed(pair.b.message(thread, { id: bid, imapUid: 7, mailboxPath: "INBOX", attachments: [
    { id: aid, filename, contentType: "application/pdf", size: 1, inline: false }
  ] }));
  function request(accountId: string, query = "", headers = {}, method = "GET") {
    return new Request(`${origin}/api/accounts/${accountId}/messages/${bid}/attachments/${aid}${query}`, {
      method, headers: user.jar.headers({ origin, ...headers })
    });
  }
  const params = (accountId: string) => ({ params: Promise.resolve({ accountId, messageId: bid, attachmentId: aid }) });
  return { ...pair, user, request, params };
}

describe("attachment ownership in a shared shard", () => {
  test("preview of another account's attachment returns 404 without its filename", async () => {
    const { a, request, params } = await fixture();
    expect(await a.api.getMessageById(a.accountId, bid)).toBeNull();
    expect(await a.api.getAttachmentMeta(a.accountId, bid, aid)).toBeNull();
    expect(await a.api.getAttachmentIds(a.accountId, bid)).toEqual([]);
    const response = await GET(request(a.accountId, "?preview=1"), params(a.accountId));
    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain(filename);
  });

  test("bytes and conditional requests check message ownership before the cache", async () => {
    const { a, b, user, request, params } = await fixture();
    await user.addMembership(user.user.id, b.accountId, "viewer");
    await saveAttachmentData(b.accountId, bid, aid, Buffer.from("B bytes"));
    const owned = await GET(request(b.accountId), params(b.accountId));
    expect(owned.status).toBe(200);
    expect(await owned.text()).toBe("B bytes");
    const etag = owned.headers.get("etag")!;
    expect(etag).toBeTruthy();
    expect((await GET(request(b.accountId, "", { "if-none-match": etag }), params(b.accountId))).status).toBe(304);
    // A stale account-local blob cannot authorize missing metadata, even when
    // its real ETag is supplied. A previously valid B ETag cannot authorize A.
    await saveAttachmentData(a.accountId, bid, aid, Buffer.from("stale bytes"));
    const { statAttachmentData } = await import("@/lib/storage");
    const { attachmentEntityTag } = await import("./route");
    const staleTag = attachmentEntityTag((await statAttachmentData(a.accountId, bid, aid))!);
    for (const headers of [{}, { "if-none-match": etag }, { "if-none-match": staleTag }]) {
      const response = await GET(request(a.accountId, "", headers), params(a.accountId));
      expect(response.status).toBe(404);
      expect(response.headers.get("etag")).toBeNull();
      expect(response.headers.get("content-disposition")).toBeNull();
      const text = await response.text();
      expect(text).not.toContain(filename);
      expect(text).not.toContain("bytes");
    }
    await b.api.removeUserAccountLink(user.user.id, b.accountId);
    expect((await GET(request(b.accountId, "", { "if-none-match": etag }), params(b.accountId))).status).toBe(403);
  });

  test("cross-account removal and cache cleanup cannot alter the owning message or attachment", async () => {
    const { a, b, request, params } = await fixture("editor");
    const response = await DELETE(request(a.accountId, "", {}, "DELETE"), params(a.accountId));
    expect(response.status).toBe(404);
    await a.api.removeMessageAttachment(a.accountId, bid, aid, { imapUid: 99 });
    await a.api.updateMessageImapUid(a.accountId, bid, 100);
    expect(await a.api.listMessageFileRefsByMessageIds(a.accountId, [bid])).toEqual([]);
    expect((await b.api.getMessageById(b.accountId, bid))?.imapUid).toBe(7);
    expect((await b.api.getAttachmentMeta(b.accountId, bid, aid))?.filename).toBe(filename);
    // Even if A has the same local message id, B's attachment id cannot patch A.
    await a.seed(a.message(thread, { id: bid, imapUid: 8, mailboxPath: "INBOX" }));
    await a.api.removeMessageAttachment(a.accountId, bid, aid, { imapUid: 101 });
    expect((await a.api.getMessageById(a.accountId, bid))?.imapUid).toBe(8);
    expect((await b.api.getAttachmentMeta(b.accountId, bid, aid))?.filename).toBe(filename);
  });
});
