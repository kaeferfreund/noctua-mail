import { describe, expect, test } from "bun:test";
import { classifyAttachment, decodeAttachmentText } from "./mcpAttachments";

describe("decodeAttachmentText", () => {
  // The sync stores bare types ("text/csv"), so the charset has to come from the bytes.
  test("reads a Windows-1252 file stored without a charset", () => {
    const data = Buffer.from("Empfänger;Betrag\nMüller;12,50 €\n".replace("€", "\u0080"), "latin1");
    expect(decodeAttachmentText(data, "text/csv")).toBe("Empfänger;Betrag\nMüller;12,50 €\n");
  });

  test("keeps valid UTF-8 without a charset", () => {
    expect(decodeAttachmentText(Buffer.from("Größe – 5 €", "utf8"), "text/plain")).toBe("Größe – 5 €");
  });

  test("falls back when a declared UTF-8 file is not UTF-8", () => {
    expect(decodeAttachmentText(Buffer.from("Grüße", "latin1"), "text/plain; charset=utf-8")).toBe("Grüße");
  });

  test("uses a declared charset", () => {
    expect(decodeAttachmentText(Buffer.from("Grüße", "latin1"), "text/plain; charset=ISO-8859-1")).toBe("Grüße");
  });

  test("a byte-order mark wins and is not part of the text", () => {
    const utf16 = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from("Käse", "utf16le")]);
    expect(decodeAttachmentText(utf16, "text/plain")).toBe("Käse");
    const utf8 = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("Käse", "utf8")]);
    expect(decodeAttachmentText(utf8, "text/csv; charset=ISO-8859-1")).toBe("Käse");
  });

  test("content with NUL bytes is not text", () => {
    expect(decodeAttachmentText(Buffer.from([0x41, 0x00, 0x42]), "text/plain")).toBeNull();
  });
});

describe("classifyAttachment", () => {
  test("generic binary types follow the file extension", () => {
    expect(classifyAttachment("application/octet-stream", "scan.PDF")).toBe("document");
    expect(classifyAttachment("application/octet-stream", "foto.jpeg")).toBe("image");
    expect(classifyAttachment("application/octet-stream", "liste.csv")).toBe("text");
    expect(classifyAttachment("application/octet-stream", "archiv.zip")).toBe("binary");
  });

  test("common image type aliases are images", () => {
    expect(classifyAttachment("image/jpg", "foto.jpg")).toBe("image");
  });
});
