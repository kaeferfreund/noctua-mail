import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { buildSpamInputFromMessage } from "./input";
import { applyStaticRules, EMPTY_STATIC_RULES, loadStaticRules, parseStaticRules } from "./staticRules";

const input = (from: string, subject = "Hallo", extra: { spamHeaders?: string[]; authenticationResults?: string[] } = {}) =>
  ({ ...buildSpamInputFromMessage({ from, to: "anna@example.test", subject }), spamHeaders: [], authenticationResults: [], ...extra });
const passed = (domain: string) => [`mxe.example.test; spf=pass smtp.mailfrom=info@${domain}; dkim=none`];

// Same shape as briefs/spam/static-rules.json, including fields the loader ignores.
const rules = parseStaticRules({
  version: 1,
  generatedAt: "2026-10-24T00:00:00Z",
  allow: [
    { type: "address", value: "Partner@Example.test", source: "sent", hits: 4 },
    { type: "domain", value: "household.example.test", source: "own-domain", hits: 9, requireAuth: true },
    { type: "domain", value: "co.example", source: "sent", hits: 2 },
    { type: "name", value: "Erika Muster", source: "paired-name", hits: 3, addresses: ["erika@example.test"] },
    { type: "bogus", value: "ignored" }
  ],
  deny: [
    { type: "domain", value: "spam.example.test", safe: true, spamHits: 9, hamHits: 0, hamHitsServerFlagged: 0, note: "" },
    { type: "header", value: "x-spam-status: \\bRCVD_ILLEGAL_IP\\b", safe: true, spamHits: 4, hamHits: 0, hamHitsServerFlagged: 0, note: "SpamAssassin test" },
    { type: "subjectPattern", value: "([", safe: true, spamHits: 3, hamHits: 0 }
  ],
  hints: [
    { type: "subjectPattern", value: "(?<![\\p{L}\\p{N}_])gewinn(?![\\p{L}\\p{N}_])", safe: false, spamHits: 5, hamHits: 1, hamHitsServerFlagged: 1, note: "word in subject" },
    { type: "domain", value: "builtin:tld-shop", safe: false, spamHits: 35, hamHits: 1919, hamHitsServerFlagged: 38, note: "From TLD .shop" },
    { type: "namePattern", value: "builtin:known-name-unknown-address", safe: false, spamHits: 0, hamHits: 50, note: "known name, unknown address" },
    { type: "namePattern", value: "builtin:not-implemented", safe: false, spamHits: 1, hamHits: 0, note: "x" }
  ]
});

describe("static rules", () => {
  test("parsing keeps known fields, ignores extra ones and drops unknown types", () => {
    expect(rules.allow).toHaveLength(4);
    expect(rules.allow[1]).toMatchObject({ requireAuth: true });
    expect(rules.allow[3].addresses).toEqual(["erika@example.test"]);
    expect(parseStaticRules(null)).toEqual(EMPTY_STATIC_RULES);
    expect(parseStaticRules({ allow: "x" })).toEqual(EMPTY_STATIC_RULES);
  });

  test("address and literal domain rules allow, including subdomains", () => {
    expect(applyStaticRules(rules, input("partner@example.test")).decision).toBe("allow");
    expect(applyStaticRules(rules, input("a@shop.co.example")).decision).toBe("allow");
    expect(applyStaticRules(rules, input("a@other.example")).decision).toBeNull();
  });

  test("requireAuth allow rules need SPF or DKIM pass for the sender's domain", () => {
    expect(applyStaticRules(rules, input("a@mail.household.example.test", "Hi", { authenticationResults: passed("household.example.test") })).decision).toBe("allow");
    expect(applyStaticRules(rules, input("kontakt@household.example.test", "Hi", { authenticationResults: ["mxe.example.test; spf=none smtp.mailfrom=x@forged.example"] })).decision).toBeNull();
    expect(applyStaticRules(rules, input("kontakt@household.example.test", "Hi", { authenticationResults: passed("forged.example") })).decision).toBeNull();
  });

  test("name entries never allow; an unknown address with a known name is a weak hint", () => {
    expect(applyStaticRules(rules, input("Erika Muster <erika@example.test>")).decision).toBeNull();
    expect(applyStaticRules(rules, input("Erika Muster <erika@example.test>")).hints).toEqual([]);
    const result = applyStaticRules(rules, input("\"Erika  Muster\" <erika@elsewhere.example>"));
    expect(result.decision).toBeNull();
    expect(result.hints).toEqual(["Schwacher Hinweis: known name, unknown address – bisher 0× Spam, 50× kein Spam"]);
  });

  test("only safe deny rules decide; hints, builtins and the server flag only inform", () => {
    expect(applyStaticRules(rules, input("x@mx.spam.example.test")).decision).toBe("deny");
    expect(applyStaticRules(rules, input("x@example.test", "Hallo", { spamHeaders: ["x-spam-status: Yes, score=9 tests=RCVD_ILLEGAL_IP,X"] })).decision).toBe("deny");
    const hinted = applyStaticRules(rules, input("x@deals.shop", "Ihr Gewinn", { spamHeaders: ["x-spam-flag: YES"] }));
    expect(hinted.decision).toBeNull();
    expect(hinted.hints).toEqual([
      "Starker Hinweis: der Mailserver (SpamAssassin) hat die Nachricht als Spam gekennzeichnet (X-Spam-Flag: YES)",
      "Hinweis: subjectPattern „(?<![\\p{L}\\p{N}_])gewinn(?![\\p{L}\\p{N}_])“ (word in subject) – bisher 5× Spam, 1× kein Spam",
      "Schwacher Hinweis: From TLD .shop – bisher 35× Spam, 1919× kein Spam"
    ]);
  });

  test("a missing or invalid file means no static rules", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "spam-rules-"));
    try {
      expect(loadStaticRules(path.join(dir, "missing.json"))).toEqual(EMPTY_STATIC_RULES);
      const file = path.join(dir, "rules.json");
      writeFileSync(file, "{not json");
      expect(loadStaticRules(file)).toEqual(EMPTY_STATIC_RULES);
      writeFileSync(file, JSON.stringify({ allow: [{ type: "domain", value: "example.test", extra: { nested: true } }] }));
      expect(loadStaticRules(file).allow).toHaveLength(1);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
