// @ts-expect-error bun:test is provided by the runner and is absent from this tsconfig.
import { describe, expect, test } from "bun:test";
import type { Account, Folder, Message } from "@/lib/data";
import { sealSession, type SessionData } from "@/lib/auth";
import { saveAttachmentData } from "@/lib/storage";
import { dbModulePromise } from "@/lib/testDbHarness";
import { ATTACHMENT_CACHE_CONTROL, ifNoneMatchMatches } from "./route";

const { saveFoldersForAccount, upsertAccount, upsertMessages } = await dbModulePromise;
const { GET } = await import("./route");

function buildAccount(accountId: string): Account {
  return {
    id: accountId,
    name: "Attachment Route Test",
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
    id: `${accountId}:Inbox`,
    accountId,
    name: "Inbox",
    count: 1,
    unreadCount: 0,
    specialUse: "\\Inbox"
  };
}

function buildMessage(accountId: string, folderId: string, attachmentId: string): Message {
  return {
    id: `${accountId}-message-1`,
    accountId,
    folderId,
    threadId: `${accountId}-thread-1`,
    messageId: `<${accountId}-message-1@example.test>`,
    subject: "Inline image",
    from: "alice@example.test",
    to: "owner@example.test",
    preview: "Inline image",
    date: new Date(Date.UTC(2026, 3, 10, 12, 0, 0)).toISOString(),
    dateValue: Date.UTC(2026, 3, 10, 12, 0, 0),
    body: "Inline image",
    attachments: [
      {
        id: attachmentId,
        filename: "pixel.png",
        contentType: "image/png",
        size: 5,
        inline: true
      }
    ]
  };
}

function buildCookieHeader(accountId: string) {
  const session: SessionData = {
    userId: "user-attachment-route",
    accountId,
    exp: Math.floor(Date.now() / 1000) + 60 * 60
  };
  return `noctua_session=${encodeURIComponent(sealSession(session))}`;
}

function attachmentRequest(accountId: string, messageId: string, attachmentId: string, headers?: HeadersInit) {
  const url = `http://localhost/api/accounts/${accountId}/messages/${messageId}/attachments/${attachmentId}`;
  return GET(new Request(url, { headers: { cookie: buildCookieHeader(accountId), ...headers } }), {
    params: Promise.resolve({ accountId, messageId, attachmentId })
  });
}

describe("attachment byte cache", () => {
  test("matches If-None-Match weakly and ignores other tags", () => {
    const etag = `"abc-10"`;
    expect(ifNoneMatchMatches(null, etag)).toBe(false);
    expect(ifNoneMatchMatches(etag, etag)).toBe(true);
    expect(ifNoneMatchMatches(`W/${etag}`, etag)).toBe(true);
    expect(ifNoneMatchMatches(`"other", ${etag}`, etag)).toBe(true);
    expect(ifNoneMatchMatches(`"other"`, etag)).toBe(false);
  });

  test("sends a private mtime etag and answers If-None-Match with 304", async () => {
    const accountId = `acc-attachment-cache-${Date.now()}`;
    const folder = buildFolder(accountId);
    const attachmentId = "att-pixel";
    const message = buildMessage(accountId, folder.id, attachmentId);
    const bytes = Buffer.from("hello-image");

    await upsertAccount(buildAccount(accountId));
    await saveFoldersForAccount(accountId, [folder]);
    await upsertMessages(accountId, folder.id, [message], true);
    await saveAttachmentData(accountId, message.id, attachmentId, bytes);

    const first = await attachmentRequest(accountId, message.id, attachmentId);
    expect(first.status).toBe(200);
    expect(first.headers.get("cache-control")).toBe(ATTACHMENT_CACHE_CONTROL);
    expect(first.headers.get("cache-control")).not.toContain("immutable");
    const etag = first.headers.get("etag");
    expect(etag).toMatch(/^"[0-9a-f.]+-[0-9a-f]+"$/i);
    expect(Buffer.from(await first.arrayBuffer())).toEqual(bytes);

    const cached = await attachmentRequest(accountId, message.id, attachmentId, {
      "if-none-match": etag ?? ""
    });
    expect(cached.status).toBe(304);
    expect(cached.headers.get("etag")).toBe(etag);
    expect(cached.headers.get("cache-control")).toBe(ATTACHMENT_CACHE_CONTROL);
    expect(await cached.text()).toBe("");

    const listed = await attachmentRequest(accountId, message.id, attachmentId, {
      "if-none-match": `W/"stale", ${etag}`
    });
    expect(listed.status).toBe(304);

    const missed = await attachmentRequest(accountId, message.id, attachmentId, {
      "if-none-match": `"0-0"`
    });
    expect(missed.status).toBe(200);
    expect(Buffer.from(await missed.arrayBuffer())).toEqual(bytes);

    const rewritten = Buffer.from("hello-image-rewritten");
    await saveAttachmentData(accountId, message.id, attachmentId, rewritten);
    const afterRewrite = await attachmentRequest(accountId, message.id, attachmentId, {
      "if-none-match": etag ?? ""
    });
    expect(afterRewrite.status).toBe(200);
    expect(afterRewrite.headers.get("etag")).not.toBe(etag);
    expect(Buffer.from(await afterRewrite.arrayBuffer())).toEqual(rewritten);
  });

  test("keeps the preview shell and missing attachments uncacheable", async () => {
    const accountId = `acc-attachment-preview-${Date.now()}`;
    const folder = buildFolder(accountId);
    const attachmentId = "att-pixel";
    const message = buildMessage(accountId, folder.id, attachmentId);

    await upsertAccount(buildAccount(accountId));
    await saveFoldersForAccount(accountId, [folder]);
    await upsertMessages(accountId, folder.id, [message], true);

    const previewUrl = `http://localhost/api/accounts/${accountId}/messages/${message.id}/attachments/${attachmentId}?preview=1`;
    const preview = await GET(
      new Request(previewUrl, { headers: { cookie: buildCookieHeader(accountId) } }),
      { params: Promise.resolve({ accountId, messageId: message.id, attachmentId }) }
    );
    expect(preview.status).toBe(200);
    expect(preview.headers.get("cache-control")).toBe("no-store");
    expect(preview.headers.get("etag")).toBeNull();
    expect(await preview.text()).toContain("<iframe");

    const missing = await attachmentRequest(accountId, message.id, "att-missing");
    expect(missing.status).toBe(404);
    expect(missing.headers.get("cache-control")).not.toBe(ATTACHMENT_CACHE_CONTROL);
  });
});
