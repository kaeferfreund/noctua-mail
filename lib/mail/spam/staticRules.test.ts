import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { buildSpamInputFromMessage } from "./input";
import { applyStaticRules, EMPTY_STATIC_RULES, loadStaticRules, parseStaticRules } from "./staticRules";

const input = (from: string, subject = "Hallo", spamHeaders: string[] = []) =>
  ({ ...buildSpamInputFromMessage({ from, to: "anna@example.test", subject }), spamHeaders });

const rules = parseStaticRules({
  version: 1,
  allow: [
    { type: "address", value: "Partner@Example.test", source: "sent", hits: 4 },
    { type: "domain", value: "household.example.test" },
    { type: "name", value: "Erika Muster <erika@example.test>" },
    { type: "bogus", value: "ignored" }
  ],
  deny: [
    { type: "domain", value: "spam.example.test", safe: true, spamHits: 9, hamHits: 0 },
    { type: "subjectPattern", value: "gewinn", safe: false, spamHits: 5, hamHits: 1, note: "Gewinnversprechen" },
    { type: "header", value: "x-spam-flag: ^yes$", safe: true },
    { type: "subjectPattern", value: "([", safe: true }
  ],
  hints: [{ type: "namePattern", value: "^support$" }]
});

describe("static rules", () => {
  test("parsing drops unknown types and invalid entries", () => {
    expect(rules.allow).toHaveLength(3);
    expect(parseStaticRules(null)).toEqual(EMPTY_STATIC_RULES);
    expect(parseStaticRules({ allow: "x" })).toEqual(EMPTY_STATIC_RULES);
  });

  test("allow rules short-circuit, including subdomains and name+address pairs", () => {
    expect(applyStaticRules(rules, input("partner@example.test")).decision).toBe("allow");
    expect(applyStaticRules(rules, input("a@mail.household.example.test", "Gewinn")).decision).toBe("allow");
    expect(applyStaticRules(rules, input("Erika Muster <erika@example.test>")).decision).toBe("allow");
  });

  test("a known name from another address is a hint, never an allow", () => {
    const result = applyStaticRules(rules, input("Erika Muster <erika@elsewhere.example.test>"));
    expect(result.decision).toBeNull();
    expect(result.hints[0]).toContain("bekannter Anzeigename");
  });

  test("only safe deny rules decide; the rest become hints; broken patterns are ignored", () => {
    expect(applyStaticRules(rules, input("x@mx.spam.example.test")).decision).toBe("deny");
    expect(applyStaticRules(rules, input("x@example.test", "Hallo", ["x-spam-flag: YES"])).decision).toBe("deny");
    const hinted = applyStaticRules(rules, input("Support <x@example.test>", "Ihr Gewinn"));
    expect(hinted.decision).toBeNull();
    expect(hinted.hints).toEqual([
      "Spam-Muster: subjectPattern „gewinn“ (bisher 5× Spam, 1× kein Spam) – Gewinnversprechen",
      "Hinweis: namePattern „^support$“"
    ]);
  });

  test("a missing or invalid file means no static rules", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "spam-rules-"));
    try {
      expect(loadStaticRules(path.join(dir, "missing.json"))).toEqual(EMPTY_STATIC_RULES);
      const file = path.join(dir, "rules.json");
      writeFileSync(file, "{not json");
      expect(loadStaticRules(file)).toEqual(EMPTY_STATIC_RULES);
      writeFileSync(file, JSON.stringify({ allow: [{ type: "domain", value: "example.test" }] }));
      expect(loadStaticRules(file).allow).toHaveLength(1);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
