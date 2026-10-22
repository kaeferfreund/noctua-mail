import { expect, test } from "bun:test";
import { NextResponse } from "next/server";
import { createMailboxSummaryHandler, mailboxSummarySessionGuard } from "@/app/api/_helpers/mailboxSummary";

test("summary rejects unauthenticated requests before opening shards", async () => {
  const handler = createMailboxSummaryHandler({
    requireActiveUserSession: () => new NextResponse("Unauthorized", { status: 401 }),
    getMailboxSummaries: async () => { throw new Error("Must not query any mailbox"); }
  });
  expect((await handler(new Request("http://example.test/api/accounts/summary"))).status).toBe(401);
});
test("summary passes exactly the session's account and disables response caching", async () => {
  const handler = createMailboxSummaryHandler({
    requireActiveUserSession: () => ({ userId: "synthetic-user", accountId: "owned" }),
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
    requireActiveUserSession: () => ({ userId: "synthetic-user" }),
    getMailboxSummaries: async (ids) => { expect(ids).toEqual([]); return []; }
  });
  expect(await (await handler(new Request("http://example.test/api/accounts/summary"))).json()).toEqual({ accounts: [] });
});

test("summary awaits an async denial before touching mailboxes", async () => {
  const handler = createMailboxSummaryHandler({
    requireActiveUserSession: async () => new NextResponse("Unauthorized", { status: 401, headers: { "Set-Cookie": "session=; Max-Age=0" } }),
    getMailboxSummaries: async () => { throw new Error("Must not query mailboxes"); }
  });
  const response = await handler(new Request("http://example.test/api/accounts/summary"));
  expect(response.status).toBe(401);
  expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
});

test("summary propagates async guard headers and enumerates only through the account seam", async () => {
  const handler = createMailboxSummaryHandler({
    requireActiveUserSession: async () => ({ userId: "synthetic", activeAccountId: "owned",
      responseHeaders: new Headers({ "Set-Cookie": "session=renewed; HttpOnly", "X-Session": "renewed" }) }),
    summaryAccountIds: async session => { expect(session.userId).toBe("synthetic"); return ["accessible"]; },
    getMailboxSummaries: async ids => { expect(ids).toEqual(["accessible"]); return []; }
  });
  const response = await handler(new Request("http://example.test/api/accounts/summary"));
  expect(response.headers.get("set-cookie")).toContain("session=renewed");
  expect(response.headers.get("x-session")).toBe("renewed");
});

for (const asyncGuard of [false, true]) {
  test(`summary adapter selects ${asyncGuard ? "team-auth async" : "legacy sync"} export and forwards headers`, async () => {
    const expected = { userId: "synthetic", responseHeaders: new Headers({ "X-Session": "kept" }) };
    const guard = mailboxSummarySessionGuard({
      ...(asyncGuard ? { requireActiveUserSession: async () => expected } : {}),
      requireSessionOr401: () => {
        if (asyncGuard) throw new Error("Retiring guard must not run when team-auth is present");
        return expected;
      }
    });
    const handler = createMailboxSummaryHandler({ requireActiveUserSession: guard, getMailboxSummaries: async () => [] });
    expect((await handler(new Request("http://example.test/api/accounts/summary"))).headers.get("x-session")).toBe("kept");
  });
}
