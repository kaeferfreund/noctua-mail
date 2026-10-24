import { describe, expect, test } from "bun:test";
import type { Account } from "@/lib/data";
import { authenticatedTestCookie, createAuthenticatedTestSession } from "@/lib/testAuthHarness";
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

describe("sender-icon route with an admin-uploaded domain icon", async () => {
  const { saveDomainIcon, resetDomainIcon } = await import("@/lib/domainIcons");
  const { normalizeDomainIcon } = await import("@/lib/domainIconImage");
  const sharp = (await import("sharp")).default;
  const domain = `brand-${crypto.randomUUID().slice(0, 8)}.example.test`;
  const png = await normalizeDomainIcon(await sharp({ create: { width: 8, height: 8, channels: 4, background: { r: 0, g: 128, b: 0, alpha: 1 } } }).png().toBuffer());
  const owner = await createAuthenticatedTestSession(undefined, "admin");

  test("the override wins over the favicon for the domain and its subdomains, with ETag revalidation", async () => {
    await saveDomainIcon(domain, png, owner.user.id);
    try {
      // The sidebar header request: the domain as `from`, the mailbox address as `fromEmail`.
      const header = await request(`from=${domain}&fromEmail=team%40${domain}&fallback=none&v=1`);
      expect(header.status).toBe(200);
      expect(header.headers.get("content-type")).toBe("image/png");
      expect(header.headers.get("cache-control")).toBe("private, no-cache");
      expect(Buffer.from(await header.arrayBuffer()).equals(png)).toBe(true);
      const etag = header.headers.get("etag")!;
      expect((await request(`from=${domain}&fromEmail=team%40${domain}&fallback=none`, { cookie, "if-none-match": etag })).status).toBe(304);

      // A message-list sender at a subdomain gets the root domain's override.
      const sender = await request(`from=${encodeURIComponent(`Ada <ada@mail.${domain}>`)}`);
      expect(sender.headers.get("content-type")).toBe("image/png");
      // Other domains keep the resolver (sender icons off here: initials SVG / 404).
      expect((await request("fromEmail=someone%40other.example.test&fallback=none")).status).toBe(404);
    } finally {
      await resetDomainIcon(domain, owner.user.id);
    }
    expect((await request(`from=${domain}&fromEmail=team%40${domain}&fallback=none`)).status).toBe(404);
  });

  test("a free-mail domain's override applies only to the mailbox's own address", async () => {
    await saveDomainIcon("gmail.com", png, owner.user.id);
    try {
      // Not this mailbox's address: every other gmail sender keeps its own icon.
      expect((await request("fromEmail=stranger%40gmail.com&fallback=none")).status).toBe(404);
      const freeAccountId = `acc-sender-icon-free-${crypto.randomUUID()}`;
      await upsertAccount({ ...account, id: freeAccountId, email: "household@gmail.com" });
      const freeCookie = await authenticatedTestCookie(freeAccountId);
      const own = await senderIcon(new Request(`http://localhost:3000/api/accounts/${freeAccountId}/sender-icon?from=gmail.com&fromEmail=household%40gmail.com&fallback=none`, { headers: { cookie: freeCookie } }),
        { params: Promise.resolve({ accountId: freeAccountId }) });
      expect(own.headers.get("content-type")).toBe("image/png");
    } finally {
      await resetDomainIcon("gmail.com", owner.user.id);
    }
  });
});
