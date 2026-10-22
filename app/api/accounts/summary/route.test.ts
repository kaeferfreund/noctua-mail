import { expect, test } from "bun:test";
import { NextResponse } from "next/server";
import { createMailboxSummaryHandler } from "@/app/api/_helpers/mailboxSummary";

test("summary rejects unauthenticated requests before opening shards", async () => {
  const handler = createMailboxSummaryHandler({
    requireSessionOr401: () => new NextResponse("Unauthorized", { status: 401 }),
    getMailboxSummaries: async () => { throw new Error("Must not query any mailbox"); }
  });
  expect((await handler(new Request("http://example.test/api/accounts/summary"))).status).toBe(401);
});
test("summary passes exactly the session's account and disables response caching", async () => {
  const handler = createMailboxSummaryHandler({
    requireSessionOr401: () => ({ userId: "synthetic-user", accountId: "owned", exp: 9999999999 }),
    getMailboxSummaries: async (ids) => {
      expect(ids).toEqual(["owned"]);
      return [{ accountId: "owned", unreadInbox: 2, lastSyncAt: null, watcherState: "disabled" }];
    }
  });
  const response = await handler(new Request("http://example.test/api/accounts/summary?accountId=foreign"));
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({ accounts: [{ accountId: "owned", unreadInbox: 2, lastSyncAt: null, watcherState: "disabled" }] });
});
test("summary does not enumerate mailboxes for a session without an active account", async () => {
  const handler = createMailboxSummaryHandler({
    requireSessionOr401: () => ({ userId: "synthetic-user", exp: 9999999999 }),
    getMailboxSummaries: async (ids) => { expect(ids).toEqual([]); return []; }
  });
  expect(await (await handler(new Request("http://example.test/api/accounts/summary"))).json()).toEqual({ accounts: [] });
});
