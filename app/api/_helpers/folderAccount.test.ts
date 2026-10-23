import { describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import type { Account } from "@/lib/data";
import { authenticatedTestCookie } from "@/lib/testAuthHarness";
import { dbModulePromise } from "@/lib/testDbHarness";
import { POST as sync } from "@/app/api/accounts/[accountId]/sync/route";
import { POST as candidates } from "@/app/api/accounts/[accountId]/sync/new-candidates/route";
import { GET as poll } from "@/app/api/accounts/[accountId]/imap/poll/route";
import { GET as stream } from "@/app/api/accounts/[accountId]/imap/stream/route";
import { GET as messages } from "@/app/api/accounts/[accountId]/messages/route";
import { GET as threads } from "@/app/api/accounts/[accountId]/threads/route";
import { POST as consistency } from "@/app/api/accounts/[accountId]/folders/[folderId]/consistency/route";
import { POST as rename } from "@/app/api/accounts/[accountId]/folders/[folderId]/rename/route";
import { POST as remove } from "@/app/api/accounts/[accountId]/folders/[folderId]/delete/route";
import { POST as create } from "@/app/api/accounts/[accountId]/folders/create/route";
import { POST as move } from "@/app/api/accounts/[accountId]/messages/move/route";
import { POST as recompute } from "@/app/api/accounts/[accountId]/threads/recompute/route";

const db = await dbModulePromise;

const routes = [
  { name: "sync", handler: sync, body: (folderId: string) => ({ folderId, mode: "full" }) },
  { name: "sync/new-candidates", handler: candidates, body: (folderId: string) => ({ folderIds: [folderId] }) },
  { name: "imap/poll?folderId", handler: poll, query: "folderId" },
  { name: "imap/poll?mailbox", handler: poll, query: "mailbox" },
  { name: "imap/stream", handler: stream, query: "activeFolderId" },
  { name: "messages", handler: messages, query: "folderId" },
  { name: "threads", handler: threads, query: "folderId" },
  { name: "folders/consistency", handler: consistency, body: () => ({}) },
  { name: "folders/rename", handler: rename, body: () => ({ name: "Renamed" }) },
  { name: "folders/delete", handler: remove, body: () => ({}) },
  { name: "folders/create", handler: create, body: (folderId: string) => ({ name: "Child", parentId: folderId }) },
  { name: "messages/move", handler: move, body: (folderId: string) => ({ destinationFolderId: folderId, messageIds: ["synthetic-message"] }) },
  { name: "threads/recompute", handler: recompute, body: (folderId: string) => ({ folderId }) }
];

describe("account folder request validation", () => {
  for (const route of routes) for (const kind of ["foreign", "unknown"] as const) {
    test(`${route.name} rejects ${kind} folder before IMAP or job launch`, async () => {
      const accountId = `synthetic-guard-${randomUUID()}`;
      const email = "synthetic@example.test";
      await db.upsertAccount({ id: accountId, name: "Synthetic", avatar: "", email,
        imap: { host: "imap.example.test", port: 993, secure: true, user: email, password: "synthetic" },
        smtp: { host: "smtp.example.test", port: 465, secure: true, user: email, password: "synthetic" }
      } as Account);
      await db.saveFoldersForAccount(accountId, [{ id: `${accountId}:INBOX`, accountId, name: "INBOX", count: 0 }]);
      const folderId = kind === "foreign" ? "synthetic-other:INBOX" : `${accountId}:missing`;
      const url = new URL(`http://localhost:3000/api/accounts/${accountId}/${route.name.split("?")[0]}`);
      if (route.query) url.searchParams.set(route.query, folderId);
      const request = new Request(url, {
        method: route.body ? "POST" : "GET",
        headers: { cookie: await authenticatedTestCookie(accountId), origin: "http://localhost:3000", "content-type": "application/json" },
        ...(route.body ? { body: JSON.stringify(route.body(folderId)) } : {})
      });
      const response = await route.handler(request, { params: Promise.resolve({ accountId, folderId }) });
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ ok: false, code: "folder_account_mismatch" });
    });
  }
});
