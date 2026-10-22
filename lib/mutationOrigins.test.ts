import { beforeAll, describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createAuthenticatedTestSession } from "./testAuthHarness";
import { dbModulePromise } from "./testDbHarness";

const root = path.resolve("app/api");
const inventory: Array<{ file: string; method: string }> = [];
function walk(dir: string) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (entry.name === "route.ts") {
      const source = readFileSync(file, "utf8");
      const methods = new Set([...source.matchAll(/export (?:async function|const) (POST|PUT|PATCH|DELETE)\b/g),
        ...source.matchAll(/\bas (POST|PUT|PATCH|DELETE)\b/g)].map(m => m[1]));
      for (const method of methods) inventory.push({ file: path.relative(root, file), method });
    }
  }
}
walk(root);
let fixture: Awaited<ReturnType<typeof createAuthenticatedTestSession>>;
const accountId = `origin-${crypto.randomUUID()}`;
beforeAll(async () => {
  const db = await dbModulePromise;
  await db.upsertAccount({ id: accountId, name: "Synthetic origin inventory", email: "origin@example.test", avatar: "",
    imap: { host: "imap.example.test", port: 993, secure: true, user: "origin@example.test", password: "synthetic" },
    smtp: { host: "smtp.example.test", port: 465, secure: true, user: "origin@example.test", password: "synthetic" } });
  fixture = await createAuthenticatedTestSession(accountId, "admin");
  await db.upsertAccount({ ...(await db.getAccountById(accountId))!, ownerUserId: fixture.user.id });
});

describe("complete API mutation origin inventory", () => {
  test.each(inventory)("foreign Origin plus text/plain rejected by $method $file", async ({ file, method }: { file: string; method: string }) => {
    const route = await import(path.join(root, file));
    const params = { accountId, messageId: "synthetic-message", attachmentId: "synthetic-attachment", folderId: `${accountId}:INBOX`, userId: "synthetic-user", tokenId: "synthetic-token", eventId: "synthetic-event", topicId: "synthetic-topic", aliasId: "synthetic-alias", draftId: "synthetic-draft" };
    const request = new Request(`http://localhost:3000/api/${file}`, { method, headers: fixture.jar.headers({ origin: "https://foreign.example.test", "content-type": "text/plain" }), body: '{"data":{"replace":true}}' });
    const response: Response = await route[method](request, { params: Promise.resolve(params) });
    // Retired/unactivated authentication and bearer-only MCP cannot mutate via cookies.
    if (file === "auth/login/route.ts") expect(response.status).toBe(410);
    else if (file === "auth/signup/route.ts" || file === "ba/[...all]/route.ts") expect(response.status).toBe(503);
    else if (file === "mcp/route.ts") expect(response.status).toBe(method === "DELETE" ? 405 : 401);
    else {
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "invalid_origin" });
    }
  });
});
