import { describe, expect, test } from "bun:test";
import type { Account } from "@/lib/data";
import { authenticatedTestCookie } from "@/lib/testAuthHarness";
import { dbModulePromise } from "@/lib/testDbHarness";

const { upsertAccount } = await dbModulePromise;
const { GET: senderIcon } = await import("@/app/api/accounts/[accountId]/sender-icon/route");

// Sender icons off for the mailbox: the resolver never goes to the network and
// answers with its initials SVG, which `fallback=none` turns into a 404.
const accountId = `acc-sender-icon-${crypto.randomUUID()}`;
const account: Account = {
  id: accountId, name: "Sender icon", email: "owner@example.test", avatar: "",
  settings: { appearance: { senderIcons: false } },
  imap: { host: "imap.example.test", port: 993, secure: true, user: "owner@example.test", password: "secret" },
  smtp: { host: "smtp.example.test", port: 465, secure: true, user: "owner@example.test", password: "secret" }
};
await upsertAccount(account);
const cookie = await authenticatedTestCookie(accountId);

const request = (query: string, headers: HeadersInit = { cookie }) =>
  senderIcon(new Request(`http://localhost:3000/api/accounts/${accountId}/sender-icon?${query}`, { headers }),
    { params: Promise.resolve({ accountId }) });

describe("sender-icon route", () => {
  test("answers the initials SVG by default and 404 with fallback=none when no logo exists", async () => {
    const svg = await request("from=Sender%20icon&fromEmail=owner%40example.test");
    expect(svg.status).toBe(200);
    expect(svg.headers.get("content-type")).toBe("image/svg+xml");

    const none = await request("from=Sender%20icon&fromEmail=owner%40example.test&fallback=none");
    expect(none.status).toBe(404);
    expect(none.headers.get("cache-control")).toBe("private, max-age=21600");
    expect(await none.text()).toBe("");
  });

  test("keeps the session guard for fallback=none", async () => {
    const res = await request("fromEmail=owner%40example.test&fallback=none", {});
    expect(res.status).toBe(401);
  });
});
