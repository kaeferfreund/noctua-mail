import { describe, expect, it } from "bun:test";
import {
  extractDisplayName,
  extractPrimaryEmail,
  getRootDomain,
  getSenderIdentity,
  isFreeMailDomain,
  canonicalizeMailboxAddress
} from "./senderIdentity";
import { senderPermissionCases } from "./testFixtures/senderPermissions";

describe("senderIdentity", () => {
  for (const { name, from, key } of senderPermissionCases) {
    it(`preserves the primary mailbox identity: ${name}`, () => {
      expect(extractPrimaryEmail(from) ?? "").toBe(key);
      if (key) expect(canonicalizeMailboxAddress(key)).toBe(key);
    });
  }

  it("canonicalizes unicode and A-label domains and equivalent quoted atoms identically", () => {
    expect(canonicalizeMailboxAddress(" \t ACTUAL@BÜCHER.EXAMPLE \t ")).toBe("actual@xn--bcher-kva.example");
    expect(canonicalizeMailboxAddress('"ACTUAL"@xn--bcher-kva.example')).toBe("actual@xn--bcher-kva.example");
  });

  it("validates a mailbox without parsing display names, lists or malformed quoted local parts", () => {
    for (const invalid of ["Actual <actual@example.test>", "a@example.test,b@example.test", "attacker trusted@example.test", '"unclosed@example.test', "a@bad domain.test", "a@-bad.example", '"a\nb"@example.test', "a@@example.test"]) {
      expect(canonicalizeMailboxAddress(invalid)).toBeNull();
    }
  });
  it("extracts display names and primary emails from mailbox strings", () => {
    expect(extractDisplayName("\"Apple News\" <news@apple.com>")).toBe("Apple News");
    expect(extractPrimaryEmail("\"Apple News\" <news@apple.com>")).toBe("news@apple.com");
  });

  it("extractDisplayName returns empty string for unparseable or address-only inputs", () => {
    // No angle brackets: nothing to extract a name from.
    expect(extractDisplayName("news@apple.com")).toBe("");
    // Missing closing angle bracket — treat as unparseable rather than guessing.
    expect(extractDisplayName("Apple <news@apple.com")).toBe("");
    // Empty / nullish inputs.
    expect(extractDisplayName("")).toBe("");
    expect(extractDisplayName(null)).toBe("");
    expect(extractDisplayName(undefined)).toBe("");
  });

  it("extractDisplayName strips wrapping double or single quotes and collapses whitespace", () => {
    expect(extractDisplayName("'Apple News'  <news@apple.com>")).toBe("Apple News");
    // Internal whitespace runs are collapsed to a single space by normalization.
    expect(extractDisplayName("   \"Apple   News\"   <news@apple.com>")).toBe("Apple News");
    expect(extractDisplayName("Apple News <news@apple.com>")).toBe("Apple News");
  });

  it("extractPrimaryEmail prefers the angle-bracket address and lowercases the result", () => {
    expect(extractPrimaryEmail("\"Apple NEWS\" <News@Apple.com>")).toBe("news@apple.com");
    // No angle brackets: the mail parser still recognises the mailbox.
    expect(extractPrimaryEmail("Contact news@apple.com for details")).toBe("news@apple.com");
    // No recognizable email at all.
    expect(extractPrimaryEmail("Apple News")).toBeNull();
    expect(extractPrimaryEmail("")).toBeNull();
    expect(extractPrimaryEmail(null)).toBeNull();
  });

  it("normalizes sender identity for business domains", () => {
    expect(getSenderIdentity({ from: "\"Apple News\" <news@mail.apple.com>" })).toEqual({
      displayName: "Apple News",
      email: "news@mail.apple.com",
      domain: "mail.apple.com",
      rootDomain: "apple.com",
      isFreeMailDomain: false,
      initials: "AN",
      paletteIndex: expect.any(Number)
    });
  });

  it("recognizes common free-mail domains", () => {
    expect(isFreeMailDomain("gmail.com")).toBe(true);
    expect(isFreeMailDomain("outlook.de")).toBe(true);
    expect(isFreeMailDomain("apple.com")).toBe(false);
  });

  it("keeps the simple root-domain fallback used by sender icons", () => {
    expect(getRootDomain("mail.apple.com")).toBe("apple.com");
    expect(getRootDomain("localhost")).toBe("localhost");
  });
});
