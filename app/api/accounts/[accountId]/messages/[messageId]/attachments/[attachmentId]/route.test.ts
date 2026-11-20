import { createHash } from "node:crypto";
import { describe, expect, test } from "bun:test";
import type { Account, Folder, Message } from "@/lib/data";
import { authenticatedTestCookie } from "@/lib/testAuthHarness";
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

function attachmentRequest(
  cookie: string,
  accountId: string,
  messageId: string,
  attachmentId: string,
  headers?: HeadersInit
) {
  const url = `http://localhost:3000/api/accounts/${accountId}/messages/${messageId}/attachments/${attachmentId}`;
  return GET(new Request(url, { headers: { cookie, ...headers } }), {
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
    const cookie = await authenticatedTestCookie(accountId);

    const first = await attachmentRequest(cookie, accountId, message.id, attachmentId);
    expect(first.status).toBe(200);
    // Revalidated on every use: no max-age window in which a logged-out or revoked browser reads the cached bytes.
    expect(first.headers.get("cache-control")).toBe("private, no-cache");
    expect(first.headers.get("cache-control")).toBe(ATTACHMENT_CACHE_CONTROL);
    const etag = first.headers.get("etag");
    expect(etag).toMatch(/^"[0-9a-f.]+-[0-9a-f]+"$/i);
    expect(Buffer.from(await first.arrayBuffer())).toEqual(bytes);

    const cached = await attachmentRequest(cookie, accountId, message.id, attachmentId, {
      "if-none-match": etag ?? ""
    });
    expect(cached.status).toBe(304);
    expect(cached.headers.get("etag")).toBe(etag);
    expect(cached.headers.get("cache-control")).toBe(ATTACHMENT_CACHE_CONTROL);
    expect(await cached.text()).toBe("");

    const listed = await attachmentRequest(cookie, accountId, message.id, attachmentId, {
      "if-none-match": `W/"stale", ${etag}`
    });
    expect(listed.status).toBe(304);

    const missed = await attachmentRequest(cookie, accountId, message.id, attachmentId, {
      "if-none-match": `"0-0"`
    });
    expect(missed.status).toBe(200);
    expect(Buffer.from(await missed.arrayBuffer())).toEqual(bytes);

    const rewritten = Buffer.from("hello-image-rewritten");
    await saveAttachmentData(accountId, message.id, attachmentId, rewritten);
    const afterRewrite = await attachmentRequest(cookie, accountId, message.id, attachmentId, {
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
    const cookie = await authenticatedTestCookie(accountId);

    const previewUrl = `http://localhost:3000/api/accounts/${accountId}/messages/${message.id}/attachments/${attachmentId}?preview=1`;
    const preview = await GET(
      new Request(previewUrl, { headers: { cookie } }),
      { params: Promise.resolve({ accountId, messageId: message.id, attachmentId }) }
    );
    expect(preview.status).toBe(200);
    expect(preview.headers.get("cache-control")).toBe("no-store");
    expect(preview.headers.get("etag")).toBeNull();
    expect(await preview.text()).toContain("<iframe");

    const missing = await attachmentRequest(cookie, accountId, message.id, "att-missing");
    expect(missing.status).toBe(404);
    expect(missing.headers.get("cache-control")).not.toBe(ATTACHMENT_CACHE_CONTROL);
  });

  test("isolates active attachment types and the preview shell from the app origin", async () => {
    const accountId = `acc-attachment-isolation-${Date.now()}`;
    const folder = buildFolder(accountId);
    const message = buildMessage(accountId, folder.id, "att-pixel");
    message.attachments = [
      { id: "att-html", filename: 'Rechnung"; x=".html', contentType: "text/html", size: 60, inline: false },
      { id: "att-svg", filename: "logo.svg", contentType: "image/svg+xml", size: 60, inline: false },
      { id: "att-pdf", filename: "Rechnung.pdf", contentType: "application/pdf", size: 8, inline: false }
    ];
    await upsertAccount(buildAccount(accountId));
    await saveFoldersForAccount(accountId, [folder]);
    await upsertMessages(accountId, folder.id, [message], true);
    await saveAttachmentData(accountId, message.id, "att-html", Buffer.from('<form method="post" action="../not-suspicious"><button>x</button></form>'));
    await saveAttachmentData(accountId, message.id, "att-svg", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'));
    await saveAttachmentData(accountId, message.id, "att-pdf", Buffer.from("%PDF-1.4"));
    const cookie = await authenticatedTestCookie(accountId);

    for (const attachmentId of ["att-html", "att-svg"]) {
      const response = await attachmentRequest(cookie, accountId, message.id, attachmentId);
      expect(response.status).toBe(200);
      const policy = (response.headers.get("content-security-policy") ?? "").split(/;\s*/);
      expect(policy).toContain("sandbox");
      expect(policy).toContain("form-action 'none'");
      expect(policy).toContain("default-src 'none'");
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    }
    const html = await attachmentRequest(cookie, accountId, message.id, "att-html");
    expect(html.headers.get("content-disposition")).toBe(
      "inline; filename=\"Rechnung_; x=_.html\"; filename*=UTF-8''Rechnung%22%3B%20x%3D%22.html"
    );
    const pdf = await attachmentRequest(cookie, accountId, message.id, "att-pdf");
    expect(pdf.headers.get("content-security-policy")).toBe(
      "default-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'self'"
    );

    const shell = async (attachmentId: string) => {
      const url = `http://localhost:3000/api/accounts/${accountId}/messages/${message.id}/attachments/${attachmentId}?preview=1`;
      const response = await GET(new Request(url, { headers: { cookie } }),
        { params: Promise.resolve({ accountId, messageId: message.id, attachmentId }) });
      expect(response.status).toBe(200);
      const policy = response.headers.get("content-security-policy") ?? "";
      expect(policy).toMatch(/^default-src 'none'; style-src 'sha256-[A-Za-z0-9+/]+=*'; frame-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'$/);
      return response.text();
    };
    expect(await shell("att-html")).toContain(`attachments/att-html" sandbox="" referrerpolicy="no-referrer"></iframe>`);
    expect(await shell("att-svg")).toContain('sandbox=""');
    // Browsers do not run their PDF viewer in a sandboxed frame.
    expect(await shell("att-pdf")).toContain(`attachments/att-pdf" referrerpolicy="no-referrer"></iframe>`);
  });

  test("puts a light backdrop behind text attachments and allows exactly that style by hash", async () => {
    const accountId = `acc-attachment-backdrop-${Date.now()}`;
    const folder = buildFolder(accountId);
    const message = buildMessage(accountId, folder.id, "att-pixel");
    message.attachments = [
      { id: "att-md", filename: "notes.md", contentType: "text/markdown; charset=utf-8", size: 10, inline: false },
      { id: "att-txt", filename: "notes.txt", contentType: "TEXT/PLAIN", size: 10, inline: false },
      { id: "att-png", filename: "qrcode.png", contentType: "image/png", size: 10, inline: false },
      { id: "att-pdf", filename: "report.pdf", contentType: "application/pdf", size: 10, inline: false }
    ];
    await upsertAccount(buildAccount(accountId));
    await saveFoldersForAccount(accountId, [folder]);
    await upsertMessages(accountId, folder.id, [message], true);
    const cookie = await authenticatedTestCookie(accountId);

    const shell = async (attachmentId: string) => {
      const url = `http://localhost:3000/api/accounts/${accountId}/messages/${message.id}/attachments/${attachmentId}?preview=1`;
      const response = await GET(new Request(url, { headers: { cookie } }),
        { params: Promise.resolve({ accountId, messageId: message.id, attachmentId }) });
      expect(response.status).toBe(200);
      const html = await response.text();
      const style = /<style>([^<]*)<\/style>/.exec(html)?.[1] ?? "";
      const hash = createHash("sha256").update(style).digest("base64");
      // The inline style must match the hash the shell's CSP allows, or the browser drops it.
      expect(response.headers.get("content-security-policy")).toContain(`style-src 'sha256-${hash}';`);
      return style;
    };
    expect(await shell("att-md")).toContain("background:#fff");
    expect(await shell("att-txt")).toContain("background:#fff");
    expect(await shell("att-png")).toContain("background:#1f1d1a");
    expect(await shell("att-pdf")).toContain("background:#1f1d1a");
  });
});
