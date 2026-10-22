import { describe, test, expect } from "bun:test";
import { parseDeliveryMetadata } from "./parser";

describe("delivery metadata", () => {
  test("unfolds repeated headers, normalizes, dedupes and keeps field order", () => {
    expect(parseDeliveryMetadata(Buffer.from('Delivered-To: ALIAS@example.test\r\nDelivered-To: "Other"\r\n <other@example.test>\r\nDelivered-To: alias@example.test\r\nX-Original-To: original@example.test\r\nEnvelope-To: ignored@example.test\r\n\r\nDelivered-To: attached@example.test'))).toEqual({
      deliveredTo: ["alias@example.test", "other@example.test"], originalTo: ["original@example.test"], senderIdentityId: undefined
    });
  });
  test("distinguishes missing fetch from absent/malformed headers, caps at 32", () => {
    expect(parseDeliveryMetadata()).toEqual({});
    expect(parseDeliveryMetadata(Buffer.from("Subject: Example\r\nDelivered-To: bad address\r\n\r\n"))).toMatchObject({ deliveredTo: [], originalTo: [] });
    expect(parseDeliveryMetadata(Buffer.from(Array.from({ length: 40 }, (_, i) => `Delivered-To: user${i}@example.test`).join("\r\n"))).deliveredTo).toHaveLength(32);
  });
  test("parses bounded draft marker only in outer headers", () => {
    expect(parseDeliveryMetadata(Buffer.from("X-Noctua-Identity-Id: synthetic-id\r\n\r\nX-Noctua-Identity-Id: other")).senderIdentityId).toBe("synthetic-id");
    expect(parseDeliveryMetadata(Buffer.from(`X-Noctua-Identity-Id: ${"x".repeat(257)}`)).senderIdentityId).toBeUndefined();
  });
});
