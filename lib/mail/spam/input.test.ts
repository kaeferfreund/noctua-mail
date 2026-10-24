import { describe, expect, test } from "bun:test";
import { simpleParser } from "mailparser";
import { buildSpamInput, buildSpamInputFromMessage, SPAM_TEXT_LIMIT, stripQuotedText } from "./input";

const source = [
  "Authentication-Results: mx.example.test; spf=pass smtp.mailfrom=example.test;",
  "  dkim=pass header.d=example.test; dmarc=pass",
  "X-Spam-Status: No, score=0.4",
  "X-Spam-Flag: NO",
  "From: \"Shop Team\" <News@Shop.Example.test>",
  "Reply-To: replies@example.test",
  "To: anna@example.test",
  "Subject: Angebot der Woche",
  "Date: Fri, 23 Oct 2026 10:00:00 +0000",
  "List-Id: <news.shop.example.test>",
  "List-Unsubscribe: <https://shop.example.test/unsubscribe>",
  "MIME-Version: 1.0",
  "Content-Type: multipart/mixed; boundary=b1",
  "",
  "--b1",
  "Content-Type: multipart/alternative; boundary=b2",
  "",
  "--b2",
  "Content-Type: text/plain; charset=utf-8",
  "",
  "Hallo Anna, siehe https://www.shop.example.test/deal?id=1",
  "",
  "Am 22.10.2026 um 09:00 schrieb Anna <anna@example.test>:",
  "> alte Nachricht",
  "--b2",
  "Content-Type: text/html; charset=utf-8",
  "",
  "<p>Hallo Anna, <a href=\"https://track.example.test/c\">hier</a> <img src=\"https://img.example.test/p.gif\"></p>",
  "--b2--",
  "--b1",
  "Content-Type: application/pdf; name=katalog.pdf",
  "Content-Disposition: attachment; filename=katalog.pdf",
  "Content-Transfer-Encoding: base64",
  "",
  "JVBERi0=",
  "--b1--",
  ""
].join("\r\n");

describe("buildSpamInput", () => {
  test("collects headers, link domains and attachments, without quoted text or HTML", async () => {
    const input = buildSpamInput(await simpleParser(source));
    expect(input.fromEmail).toBe("news@shop.example.test");
    expect(input.fromName).toBe("Shop Team");
    expect(input.replyTo).toContain("replies@example.test");
    expect(input.subject).toBe("Angebot der Woche");
    expect(input.listId).toBe("<news.shop.example.test>");
    expect(input.listUnsubscribe).toContain("unsubscribe");
    expect(input.authenticationResults).toEqual(["mx.example.test; spf=pass smtp.mailfrom=example.test; dkim=pass header.d=example.test; dmarc=pass"]);
    expect(input.spamHeaders).toEqual(["x-spam-status: No, score=0.4", "x-spam-flag: NO"]);
    expect(input.linkDomains).toEqual(expect.arrayContaining(["shop.example.test", "track.example.test"]));
    expect(input.linkDomains).not.toContain("img.example.test");
    expect(input.attachments).toEqual(["katalog.pdf (application/pdf)"]);
    expect(input.text).toBe("Hallo Anna, siehe https://www.shop.example.test/deal?id=1");
    expect(input.text).not.toContain("<");
  });

  test("caps the text and falls back to the stored row", () => {
    const input = buildSpamInputFromMessage({ from: "a@example.test", to: "b@example.test", subject: "S", body: "x".repeat(10_000) });
    expect(input.text).toHaveLength(SPAM_TEXT_LIMIT);
    expect(input.fromEmail).toBe("a@example.test");
  });

  test("stripQuotedText removes quote lines and the attribution tail", () => {
    expect(stripQuotedText("Neu\n> zitiert\nweiter\nOn Mon, 1 Jan 2026, Bob wrote:\nalt")).toBe("Neu\nweiter");
  });
});
