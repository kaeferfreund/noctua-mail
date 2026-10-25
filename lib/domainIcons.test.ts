import { describe, expect, test } from "bun:test";
import { mailboxDomain, normalizeIconDomain, senderIconDomains } from "./domainIcons";

describe("normalizeIconDomain", () => {
  test("accepts lower-cased ASCII host names and IDNA-encodes Unicode", () => {
    expect(normalizeIconDomain(" Example.TEST ")).toBe("example.test");
    expect(normalizeIconDomain("mail.brand-1.example.test")).toBe("mail.brand-1.example.test");
    expect(normalizeIconDomain("bücher.example.test")).toBe("xn--bcher-kva.example.test");
  });

  test("rejects anything that is not a plain domain", () => {
    for (const value of ["", "example", ".example.test", "example.test.", "a..b.test", "-a.example.test", "a-.example.test",
      "../../etc/passwd", "a/b.example.test", "a\\b.example.test", "a%2fb.example.test", "a b.example.test", "a_b.example.test",
      `${"a".repeat(64)}.example.test`, `${"a.".repeat(127)}test`, null, 42]) {
      expect([value, normalizeIconDomain(value)]).toEqual([value, null]);
    }
  });

  test("mailboxDomain normalises the part after the @", () => {
    expect(mailboxDomain("Team@Brand.Example.Test")).toBe("brand.example.test");
    expect(mailboxDomain("no-at-sign")).toBeNull();
  });
});

describe("senderIconDomains", () => {
  test("lists the exact domain, then each parent down to the root domain", () => {
    expect(senderIconDomains("mail.brand.example.test", "example.test")).toEqual(["mail.brand.example.test", "brand.example.test", "example.test"]);
    expect(senderIconDomains("example.test", "example.test")).toEqual(["example.test"]);
    expect(senderIconDomains("brand.example.test", null)).toEqual(["brand.example.test"]);
    expect(senderIconDomains(null, "example.test")).toEqual([]);
    expect(senderIconDomains("../x", "example.test")).toEqual([]);
  });
});
