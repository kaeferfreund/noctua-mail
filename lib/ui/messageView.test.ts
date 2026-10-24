import { describe, expect, it } from "bun:test";
import {
  getImapFlagBadges,
  hasHtmlContent,
  hasMeaningfulHtmlText,
  hasTextContent,
  needsMessageContentHydration
} from "./messageView";
import type { Message } from "@/lib/data";

describe("hasMeaningfulHtmlText", () => {
  it("returns true for regular html content", () => {
    expect(hasMeaningfulHtmlText("<p>Hello Simon</p>")).toBe(true);
  });

  it("returns false for apple mail style empty html fragments", () => {
    const html = [
      '<html><body><div><blockquote type="cite"><div><div>',
      '<meta http-equiv="content-type" content="text/html; charset=us-ascii">',
      '<p class="MsoNormal" style="margin:0"></p>',
      "<div><br></div>",
      "</div></div></blockquote></div></body></html>"
    ].join("");

    expect(hasMeaningfulHtmlText(html)).toBe(false);
  });

  it("returns false for image-only html", () => {
    const html = '<div><img src="https://example.com/test.png" alt=""></div>';

    expect(hasHtmlContent(html)).toBe(true);
    expect(hasMeaningfulHtmlText(html)).toBe(false);
  });
});

describe("message content hydration state", () => {
  it("treats empty attachment-only messages with source as loaded", () => {
    expect(
      needsMessageContentHydration({
        body: "",
        htmlBody: undefined,
        hasSource: true,
        mailboxPath: "INBOX",
        imapUid: 42
      })
    ).toBe(false);
  });

  it("treats metadata-only IMAP messages without source as hydratable", () => {
    expect(
      needsMessageContentHydration({
        body: "",
        htmlBody: undefined,
        hasSource: false,
        mailboxPath: "INBOX",
        imapUid: 42
      })
    ).toBe(true);
  });

  it("treats empty local messages without IMAP metadata as settled", () => {
    expect(
      needsMessageContentHydration({
        body: "",
        htmlBody: undefined,
        hasSource: false,
        mailboxPath: undefined,
        imapUid: undefined
      })
    ).toBe(false);
  });

  it("detects non-empty text bodies", () => {
    expect(hasTextContent("Hello")).toBe(true);
    expect(hasTextContent("")).toBe(false);
  });
});

describe("getImapFlagBadges", () => {
  const message = { id: "m1", flags: ["\\Seen", "\\Answered", "\\Deleted", "\\Draft", "$Custom"] } as unknown as Message;
  it("QA-215: labels IMAP system flags in the UI language and keeps custom keywords", () => {
    expect(getImapFlagBadges(message, "de").map(({ kind, label }) => `${kind}:${label}`))
      .toEqual(["seen:Gelesen", "answered:Beantwortet", "deleted:Gelöscht", "draft:Entwurf", "custom:$Custom"]);
    expect(getImapFlagBadges(message, "en").map(({ label }) => label)).toEqual(["Seen", "Answered", "Deleted", "Draft", "$Custom"]);
  });
});
