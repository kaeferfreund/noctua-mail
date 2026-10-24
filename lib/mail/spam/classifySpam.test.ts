import { describe, expect, test } from "bun:test";
import { buildSpamPrompt, classifySpam, shouldMarkAsSpam, spamVerdictSchema } from "./classifySpam";
import { EMPTY_STATIC_RULES, parseStaticRules } from "./staticRules";
import { mockSpamModel } from "./testModel";
import type { SpamExample, SpamInput } from "./types";

const input: SpamInput = {
  from: "Prize Desk <winner@lottery.example.test>", fromEmail: "winner@lottery.example.test", fromName: "Prize Desk",
  replyTo: null, to: "anna@example.test", subject: "Sie haben gewonnen", date: "2026-10-24T08:00:00.000Z",
  listId: null, listUnsubscribe: null, authenticationResults: ["mx.example.test; spf=fail"], spamHeaders: ["x-spam-status: Yes, score=7.1"],
  linkDomains: ["claim.example.test"], attachments: [], text: "Klicken Sie hier, um Ihren Gewinn abzuholen."
};
const example = (label: "spam" | "ham", subject: string): SpamExample =>
  ({ senderEmail: "x@example.test", senderDomain: "example.test", subject, snippet: "Synthetischer Text", label, createdAt: 1 });
const answer = (value: object) => JSON.stringify(value);

describe("spam verdict schema", () => {
  test("accepts valid output and rejects out-of-range or oversized output", () => {
    expect(spamVerdictSchema.safeParse({ verdict: "spam", confidence: 0.9, reasons: ["Gewinnversprechen"] }).success).toBe(true);
    expect(spamVerdictSchema.safeParse({ verdict: "spam", confidence: 1.5, reasons: [] }).success).toBe(false);
    expect(spamVerdictSchema.safeParse({ verdict: "maybe", confidence: 0.5, reasons: [] }).success).toBe(false);
    expect(spamVerdictSchema.safeParse({ verdict: "ham", confidence: 0.5, reasons: ["a", "b", "c", "d", "e", "f"] }).success).toBe(false);
  });
});

describe("threshold logic", () => {
  test("marks only spam verdicts at or above the threshold", () => {
    expect(shouldMarkAsSpam({ verdict: "spam", confidence: 0.85 }, 0.85)).toBe(true);
    expect(shouldMarkAsSpam({ verdict: "spam", confidence: 0.84 }, 0.85)).toBe(false);
    expect(shouldMarkAsSpam({ verdict: "unsure", confidence: 0.99 }, 0.85)).toBe(false);
    expect(shouldMarkAsSpam({ verdict: "ham", confidence: 1 }, 0.5)).toBe(false);
    expect(shouldMarkAsSpam(null, 0.5)).toBe(false);
  });
});

describe("classifySpam", () => {
  test("returns the validated model verdict and sends low effort", async () => {
    const model = mockSpamModel(answer({ verdict: "spam", confidence: 0.93, reasons: [" Gewinnversprechen ", "SPF fehlgeschlagen"] }));
    const decision = await classifySpam({ input, staticRules: EMPTY_STATIC_RULES, getExamples: async () => [example("spam", "Gewinn")],
      model, providerOptions: { anthropic: { effort: "low" } } });
    expect(decision).toEqual({ verdict: "spam", confidence: 0.93, reasons: ["Gewinnversprechen", "SPF fehlgeschlagen"], source: "model" });
    expect(model.doGenerateCalls).toHaveLength(1);
    expect(model.doGenerateCalls[0].providerOptions).toEqual({ anthropic: { effort: "low" } });
  });

  test("invalid model output is an error, never a verdict", async () => {
    const model = mockSpamModel(answer({ verdict: "spam", confidence: 7, reasons: [] }));
    await expect(classifySpam({ input, staticRules: EMPTY_STATIC_RULES, getExamples: async () => [], model })).rejects.toThrow();
  });

  test("allowlist and static rules short-circuit before the model", async () => {
    const model = mockSpamModel(answer({ verdict: "spam", confidence: 1, reasons: [] }));
    const allowlist = { ownAddresses: new Set<string>(), ownDomains: new Set<string>(),
      isCorrespondent: async (email: string) => email === "winner@lottery.example.test", latestDecision: async () => null };
    expect(await classifySpam({ input, allowlist, staticRules: EMPTY_STATIC_RULES, getExamples: async () => [], model }))
      .toMatchObject({ verdict: "ham", source: "allowlist" });
    const deny = parseStaticRules({ deny: [{ type: "domain", value: "lottery.example.test", safe: true }] });
    expect(await classifySpam({ input, staticRules: deny, getExamples: async () => [], model }))
      .toMatchObject({ verdict: "spam", confidence: 1, source: "static-deny" });
    expect(model.doGenerateCalls).toHaveLength(0);
  });

  test("without a model only static decisions are returned", async () => {
    let examplesLoaded = false;
    expect(await classifySpam({ input, staticRules: EMPTY_STATIC_RULES, getExamples: async () => { examplesLoaded = true; return []; }, model: null })).toBeNull();
    expect(examplesLoaded).toBe(false);
  });
});

describe("prompt", () => {
  test("contains examples, hints and the headers, delimited as data", () => {
    const prompt = buildSpamPrompt(input, [example("spam", "Gewinn"), example("ham", "Rechnung")], ["Hinweis: domain „x“"]);
    expect(prompt).toContain("1. [Spam] Von: x@example.test | Betreff: Gewinn");
    expect(prompt).toContain("2. [Kein Spam]");
    expect(prompt).toContain("- Hinweis: domain „x“");
    expect(prompt).toContain("Authentication-Results: mx.example.test; spf=fail");
    expect(prompt).toContain("x-spam-status: Yes, score=7.1");
    expect(prompt).toContain("Link-Domains: claim.example.test");
    expect(prompt.indexOf("<email>")).toBeLessThan(prompt.indexOf("Klicken Sie hier"));
    expect(prompt.trim().endsWith("</email>")).toBe(true);
  });
});
