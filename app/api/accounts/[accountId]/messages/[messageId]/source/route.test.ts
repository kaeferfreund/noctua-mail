import { describe, expect, test } from "bun:test";
import { NextResponse } from "next/server";
import type { Account, Folder, Message } from "@/lib/data";
import { authenticatedTestCookie } from "@/lib/testAuthHarness";
import { saveMessageSource } from "@/lib/storage";
import { dbModulePromise } from "@/lib/testDbHarness";

const { saveFoldersForAccount, upsertAccount, upsertMessages } = await dbModulePromise;
const { handleGetMessageSourceRequest, MESSAGE_SOURCE_CACHE_CONTROL } = await import("./route");

function buildAccount(accountId: string): Account {
  return {
    id: accountId,
    name: "Source Route Test",
    email: "owner@example.test",
    avatar: "",
    imap: {
      host: "imap.example.test",
      port: 993,
      secure: true,
      user: "owner@example.test",
      password: "secret-imap"
    },
    smtp: {
      host: "smtp.example.test",
      port: 465,
      secure: true,
      user: "owner@example.test",
      password: "secret-smtp"
    }
  };
}

function buildFolder(accountId: string): Folder {
  return {
    id: `${accountId}:Sent`,
    accountId,
    name: "Sent",
    count: 1,
    unreadCount: 0,
    specialUse: "\\Sent"
  };
}

function buildMessage(accountId: string, folderId: string): Message {
  return {
    id: "imap-2106950294a9471126b68324-d38b2fe765ff",
    accountId,
    folderId,
    threadId: `${accountId}-thread-1`,
    subject: "Self test",
    from: "owner@example.test",
    to: "owner@example.test",
    preview: "",
    date: new Date(Date.UTC(2026, 2, 26, 9, 0, 0)).toISOString(),
    dateValue: Date.UTC(2026, 2, 26, 9, 0, 0),
    body: "",
    mailboxPath: "Sent",
    imapUid: 1,
    attachments: [],
    unread: false,
    flags: [],
    seen: true,
    answered: false,
    flagged: false,
    deleted: false,
    draft: false,
    recent: false,
    hasSource: true
  };
}

async function buildCookieHeader(accountId: string | undefined) { return authenticatedTestCookie(accountId); }

describe("handleGetMessageSourceRequest", () => {
  test("loads stored source for an authorized message", async () => {
    const accountId = "acc-source-route";
    const folder = buildFolder(accountId);
    const message = buildMessage(accountId, folder.id);
    await upsertAccount(buildAccount(accountId));
    await saveFoldersForAccount(accountId, [folder]);
    await upsertMessages(accountId, folder.id, [message]);
    await saveMessageSource(accountId, message.id, "raw source");

    const response = await handleGetMessageSourceRequest(
      new Request("http://localhost/api/source", {
        headers: {
          cookie: await buildCookieHeader(accountId)
        }
      }),
      {
        accountId,
        messageId: message.id
      }
    );

    expect(response).toBeInstanceOf(NextResponse);
    const body = (await response.json()) as { ok?: boolean; source?: string };
    expect(body.ok).toBe(true);
    expect(body.source).toBe("raw source");
  });

  test("sends a private mtime etag and answers If-None-Match with 304", async () => {
    const accountId = `acc-source-cache-${Date.now()}`;
    const folder = buildFolder(accountId);
    const message = buildMessage(accountId, folder.id);
    await upsertAccount(buildAccount(accountId));
    await saveFoldersForAccount(accountId, [folder]);
    await upsertMessages(accountId, folder.id, [message]);
    await saveMessageSource(accountId, message.id, "raw source v1");
    const cookie = await buildCookieHeader(accountId);

    const sourceRequest = (headers?: HeadersInit, messageId = message.id) =>
      handleGetMessageSourceRequest(
        new Request("http://localhost/api/source", { headers: { cookie, ...headers } }),
        { accountId, messageId }
      );

    const first = await sourceRequest();
    expect(first.status).toBe(200);
    // Revalidated on every use: no max-age window in which a logged-out or revoked browser reads the cached source.
    expect(first.headers.get("cache-control")).toBe("private, no-cache");
    expect(first.headers.get("cache-control")).toBe(MESSAGE_SOURCE_CACHE_CONTROL);
    const etag = first.headers.get("etag");
    expect(etag).toMatch(/^"[0-9a-f.]+-[0-9a-f]+"$/i);
    const firstBody = (await first.json()) as { ok?: boolean; source?: string };
    expect(firstBody.source).toBe("raw source v1");

    const cached = await sourceRequest({ "if-none-match": etag ?? "" });
    expect(cached.status).toBe(304);
    expect(cached.headers.get("etag")).toBe(etag);
    expect(cached.headers.get("cache-control")).toBe(MESSAGE_SOURCE_CACHE_CONTROL);
    expect(await cached.text()).toBe("");

    const listed = await sourceRequest({ "if-none-match": `W/"stale", ${etag}` });
    expect(listed.status).toBe(304);

    const missed = await sourceRequest({ "if-none-match": `"0-0"` });
    expect(missed.status).toBe(200);

    await saveMessageSource(accountId, message.id, "raw source v2 with more bytes");
    const afterRewrite = await sourceRequest({ "if-none-match": etag ?? "" });
    expect(afterRewrite.status).toBe(200);
    expect(afterRewrite.headers.get("etag")).not.toBe(etag);
    const rewrittenBody = (await afterRewrite.json()) as { source?: string };
    expect(rewrittenBody.source).toBe("raw source v2 with more bytes");

    const missing = await sourceRequest(undefined, "missing-message-id");
    expect(missing.status).toBe(404);
    expect(missing.headers.get("cache-control")).not.toBe(MESSAGE_SOURCE_CACHE_CONTROL);
    expect(missing.headers.get("etag")).toBeNull();
  });
});
