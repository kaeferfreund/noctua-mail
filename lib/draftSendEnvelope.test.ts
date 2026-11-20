import { describe, expect, test } from "bun:test";
import {
  buildDraftSendEnvelopeRecipients,
  draftHasSendableRecipients
} from "./draftSendEnvelope";

describe("buildDraftSendEnvelopeRecipients", () => {
  test("empty input → empty list", () => {
    expect(buildDraftSendEnvelopeRecipients({})).toEqual([]);
    expect(buildDraftSendEnvelopeRecipients({ to: "", cc: "", bcc: "" })).toEqual([]);
  });

  test("single to-address", () => {
    expect(
      buildDraftSendEnvelopeRecipients({ to: "alice@example.com" })
    ).toEqual(["alice@example.com"]);
  });

  test("combines to + cc + bcc", () => {
    const result = buildDraftSendEnvelopeRecipients({
      to: "a@x.com",
      cc: "b@x.com",
      bcc: "c@x.com"
    });
    expect(new Set(result)).toEqual(new Set(["a@x.com", "b@x.com", "c@x.com"]));
  });

  test("display names are stripped — only bare addresses remain", () => {
    expect(
      buildDraftSendEnvelopeRecipients({
        to: '"Alice Jones" <alice@example.com>, "Bob" <bob@example.com>'
      })
    ).toEqual(["alice@example.com", "bob@example.com"]);
  });

  test("deduped case-insensitively across fields; first-occurrence casing is preserved", () => {
    const result = buildDraftSendEnvelopeRecipients({
      to: "Alice@example.com",
      cc: "ALICE@EXAMPLE.com",
      bcc: "bob@example.com"
    });
    // Alice@... (first occurrence) wins over ALICE@...; Bob is unique.
    expect(result).toEqual(["Alice@example.com", "bob@example.com"]);
  });

  test("preserves the ORIGINAL-case local-part for SMTP envelope delivery", () => {
    // RFC 5321 §4.1.2: local-part is technically case-sensitive. Some
    // servers honor that. So we must not silently lowercase here.
    const result = buildDraftSendEnvelopeRecipients({
      to: "CaseSensitive.User+Tag@EXAMPLE.COM"
    });
    expect(result).toEqual(["CaseSensitive.User+Tag@EXAMPLE.COM"]);
  });

  test("null / undefined fields are tolerated", () => {
    expect(
      buildDraftSendEnvelopeRecipients({ to: null, cc: undefined, bcc: "x@y.com" })
    ).toEqual(["x@y.com"]);
  });

  test("address-shaped text inside quoted display names never becomes a recipient", () => {
    expect(buildDraftSendEnvelopeRecipients({
      to: '"Eve, eve@evil.example" <alice@example.test>',
      cc: '"Eve <mallory@evil.example>" <bob@example.test>',
      bcc: '"A \\"q\\", carol@evil.example" <Carol@Example.test>, (comment dave@evil.example) dan@example.test'
    })).toEqual(["alice@example.test", "bob@example.test", "Carol@Example.test", "dan@example.test"]);
  });

  test("a quoted display name or comment alone is not a mailbox", () => {
    expect(buildDraftSendEnvelopeRecipients({ to: '"eve@evil.example"', cc: "(eve@evil.example)" })).toEqual([]);
  });

  test("unparseable fields contribute nothing", () => {
    expect(
      buildDraftSendEnvelopeRecipients({ to: "not an email" })
    ).toEqual([]);
  });
});

describe("draftHasSendableRecipients", () => {
  test("false for empty draft", () => {
    expect(draftHasSendableRecipients({})).toBe(false);
  });

  test("false when only unparseable input is present", () => {
    expect(draftHasSendableRecipients({ to: "nope" })).toBe(false);
  });

  test("true with just to", () => {
    expect(draftHasSendableRecipients({ to: "a@b.com" })).toBe(true);
  });

  test("true with only bcc (matches the /smtp/send guard semantics)", () => {
    expect(draftHasSendableRecipients({ bcc: "a@b.com" })).toBe(true);
  });
});
