import { beforeAll, describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "fs";
import path from "path";
import { accountRouteRoles } from "./accountRouteRoles.testData";
import { createAuthenticatedTestSession } from "./testAuthHarness";
import { dbModulePromise } from "./testDbHarness";
import type { Account } from "./data";

let fixture: Awaited<ReturnType<typeof createAuthenticatedTestSession>>;
const accountId = `route-roles-${crypto.randomUUID()}`;
beforeAll(async () => {
  await (await dbModulePromise).upsertAccount({ id: accountId, name: "Synthetic role inventory", email: "inventory@example.test", avatar: "",
    imap: { host: "imap.example.test", port: 993, secure: true, user: "inventory@example.test", password: "synthetic" },
    smtp: { host: "smtp.example.test", port: 465, secure: true, user: "inventory@example.test", password: "synthetic" } } satisfies Account);
  fixture = await createAuthenticatedTestSession(accountId);
});

describe("complete account route role inventory", () => {
  test("every exported HTTP route is recorded", () => {
    const root = path.resolve("app/api/accounts/[accountId]");
    const actual: string[] = [];
    function walk(dir: string) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const file = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(file);
        else if (entry.name === "route.ts") {
          for (const match of readFileSync(file, "utf8").matchAll(/export async function (GET|POST|PUT|DELETE|PATCH)\(/g)) {
            const route = path.relative(root, dir);
            actual.push(`${match[1]} ${route === "." ? "" : route}`);
          }
        }
      }
    }
    walk(root);
    expect(accountRouteRoles.map(r => `${r.method} ${r.path}`).sort()).toEqual(actual.sort());
  });
  for (const required of ["editor", "manager"] as const) {
    test.each(accountRouteRoles.filter(r => r.minRole === required))(`${required === "editor" ? "viewer" : "editor"} denied by $method $path`, async (row: (typeof accountRouteRoles)[number]) => {
      const role = required === "editor" ? "viewer" : "editor";
      await (await dbModulePromise).setUserAccountRole(fixture.user.id, accountId, role, fixture.user.id);
      const route = await import(`../app/api/accounts/[accountId]/${row.path ? `${row.path}/` : ""}route.ts`);
      const params = { accountId, messageId: "synthetic-message", folderId: `${accountId}:INBOX`, eventId: "synthetic-event", draftId: "synthetic-draft", scheduleId: "synthetic-schedule", identityId: "synthetic-identity", topicId: "synthetic-topic", aliasId: "synthetic-alias", tokenId: "synthetic-token", userId: "synthetic-user" };
      const payload = { accountId, messageId: params.messageId, messageIds: [params.messageId], folderId: params.folderId,
        destinationAccountId: "synthetic-destination", destinationFolderId: "synthetic-destination:INBOX", targetFolderId: "synthetic-folder",
        flag: "seen", value: true, name: "Synthetic", password: "synthetic", text: "Synthetic", label: "Synthetic", role: "viewer",
        to: "synthetic@example.test", subject: "Synthetic", action: "accept", resolution: "remote", eventId: params.eventId };
      const url = `http://localhost:3000/api/accounts/${accountId}/${row.path}?messageId=synthetic-message&folderId=${params.folderId}&tokenId=synthetic-token&eventId=synthetic-event`;
      const request = new Request(url, { method: row.method, headers: fixture.jar.headers({ origin: "http://localhost:3000", "content-type": "application/json" }),
        ...(row.method !== "GET" && (row.method !== "DELETE" || row.path === "calendar/events") ? { body: JSON.stringify(payload) } : {}) });
      const response = await route[row.method](request, { params: Promise.resolve(params) });
      expect({ status: response.status, body: await response.json() }).toMatchObject({ status: 403, body: { message: "Insufficient mailbox role", requiredRole: required } });
    });
  }
});
