import { describe, expect, test } from "bun:test";
import { buildSpamExample, rankSpamExamples, senderParts, subjectSimilarity } from "./examples";
import type { SpamExample } from "./types";

let clock = 0;
function example(senderEmail: string, subject: string, label: "spam" | "ham" = "spam"): SpamExample {
  clock += 1;
  return { senderEmail, senderDomain: senderParts(senderEmail).senderDomain, subject, snippet: "", label, createdAt: clock };
}

describe("example retrieval ranking", () => {
  test("same address > same root domain > subject similarity > most recent", () => {
    const recentOther = example("x@other.example", "Etwas anderes");
    const similarOther = example("y@other.example", "Ihre Rechnung Oktober");
    const sameDomain = example("billing@mail.shop.example", "Hallo");
    const sameSender = example("news@shop.example", "Hallo", "ham");
    const newestOther = example("z@other.example", "Neu");
    const ranked = rankSpamExamples([recentOther, similarOther, sameDomain, sameSender, newestOther],
      { senderEmail: "news@shop.example", subject: "Re: Ihre Rechnung Oktober" });
    expect(ranked).toEqual([sameSender, sameDomain, similarOther, newestOther, recentOther]);
  });

  test("keeps at least three examples of each label when both exist", () => {
    const spam = Array.from({ length: 20 }, (_, index) => example(`s${index}@spam.example`, "Gewinn"));
    const ham = Array.from({ length: 4 }, (_, index) => example(`h${index}@ham.example`, "Termin", "ham"));
    const ranked = rankSpamExamples([...spam, ...ham], { senderEmail: "s1@spam.example", subject: "Gewinn" }, 16);
    expect(ranked).toHaveLength(16);
    expect(ranked.filter((entry) => entry.label === "ham")).toHaveLength(3);
    expect(ranked[0].senderEmail).toBe("s1@spam.example");
  });

  test("subject similarity ignores reply prefixes and short words", () => {
    expect(subjectSimilarity("AW: Re: Angebot Fenster", "Angebot Fenster")).toBe(1);
    expect(subjectSimilarity("ab cd", "ab cd")).toBe(0);
  });

  test("stored examples keep only a short unquoted snippet and the root domain", () => {
    const stored = buildSpamExample({ from: "Shop <News@Mail.Shop.Example>", subject: "Angebot", body: `Text ${"a".repeat(400)}\n> zitiert`, preview: "" }, "spam");
    expect(stored).toMatchObject({ senderEmail: "news@mail.shop.example", senderDomain: "shop.example", subject: "Angebot", label: "spam" });
    expect(stored.snippet.length).toBe(280);
    expect(stored.snippet).not.toContain("zitiert");
  });
});
