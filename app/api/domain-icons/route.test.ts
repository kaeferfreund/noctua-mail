import { describe, expect, test } from "bun:test";
import sharp from "sharp";
import type { Account } from "@/lib/data";
import { createAuthenticatedTestSession } from "@/lib/testAuthHarness";
import { dbModulePromise } from "@/lib/testDbHarness";

const { upsertAccount } = await dbModulePromise;
const { GET } = await import("./route");
const { saveDomainIcon, resetDomainIcon } = await import("@/lib/domainIcons");
const { normalizeDomainIcon } = await import("@/lib/domainIconImage");

function mailbox(email: string): Account {
  return {
    id: `acc-domain-versions-${crypto.randomUUID()}`, name: email, email, avatar: "",
    imap: { host: "imap.example.test", port: 993, secure: true, user: email, password: "secret" },
    smtp: { host: "smtp.example.test", port: 465, secure: true, user: email, password: "secret" }
  };
}

describe("GET /api/domain-icons", () => {
  test("returns versions only for the domains of the caller's own mailboxes, keyed like the sidebar groups", async () => {
    const tag = crypto.randomUUID().slice(0, 8);
    const mine = mailbox(`team@Mine-${tag}.example.test`);
    const other = mailbox(`team@other-${tag}.example.test`);
    await upsertAccount(mine);
    await upsertAccount(other);
    const session = await createAuthenticatedTestSession(mine.id);
    const png = await normalizeDomainIcon(await sharp({ create: { width: 4, height: 4, channels: 4, background: { r: 1, g: 2, b: 3, alpha: 1 } } }).png().toBuffer());
    const saved = await saveDomainIcon(`mine-${tag}.example.test`, png, session.user.id);
    await saveDomainIcon(`other-${tag}.example.test`, png, session.user.id);
    try {
      const response = await GET(new Request("http://localhost:3000/api/domain-icons", { headers: { cookie: session.jar.header() } }));
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await response.json()).toEqual({ ok: true, icons: { [`mine-${tag}.example.test`]: saved.version } });
      expect((await GET(new Request("http://localhost:3000/api/domain-icons"))).status).toBe(401);
    } finally {
      await resetDomainIcon(`mine-${tag}.example.test`, session.user.id);
      await resetDomainIcon(`other-${tag}.example.test`, session.user.id);
    }
  });
});
