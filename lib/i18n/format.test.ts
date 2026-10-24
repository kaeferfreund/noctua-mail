import { expect, test } from "bun:test";
import { formatDate, formatList, formatNumber, formatRelativeTime, formatTime } from "./format";
import { getMessages, getTranslator } from "./translator";

test("uses explicit German/English dates and 24-hour Berlin time", () => {
  const date = new Date("2026-10-22T12:30:00Z");
  expect(formatDate(date, "de")).toBe("22.10.2026");
  expect(formatDate(date, "en")).toBe("22/10/2026");
  expect(formatTime(date, "de")).toBe("14:30");
  expect(formatTime(date, "en")).toBe("14:30");
  expect(formatTime(new Date("2026-10-22T22:00Z"), "en")).toBe("00:00");
});
test("Berlin handles both repeated hours across autumn DST and the spring jump", () => {
  for (const locale of ["de", "en"] as const) {
    expect(formatTime(new Date("2026-10-25T00:30Z"), locale)).toBe("02:30");
    expect(formatTime(new Date("2026-10-25T01:30Z"), locale)).toBe("02:30");
    expect(formatTime(new Date("2026-10-25T02:30Z"), locale)).toBe("03:30");
    expect(formatTime(new Date("2026-03-29T00:30Z"), locale)).toBe("01:30");
    expect(formatTime(new Date("2026-03-29T01:30Z"), locale)).toBe("03:30");
  }
});
test("formatter caches separate locale, zone and options; date overrides survive", () => {
  const date = new Date("2026-10-22T23:30Z");
  expect(formatDate(date, "de")).toBe("23.10.2026");
  expect(formatDate(date, "de", {}, "UTC")).toBe("22.10.2026");
  expect(formatDate(date, "de")).toBe("23.10.2026");
  expect(formatTime(date, "en", {}, "UTC")).toBe("23:30");
  expect(formatTime(date, "en")).toBe("01:30");
  expect(formatDate(date, "de", { month: "long" })).toBe("23. Oktober 2026");
  expect(formatNumber(5.5, "de")).toBe("5,5");
  expect(formatNumber(5.5, "en")).toBe("5.5");
  expect(formatNumber(5.5, "de", { minimumFractionDigits: 2 })).toBe("5,50");
  expect(formatRelativeTime(-1, "day", "de", { numeric: "auto" })).toBe("gestern");
  expect(formatRelativeTime(-1, "day", "en", { numeric: "auto" })).toBe("yesterday");
  expect(formatList(["A", "B"], "de")).toBe("A und B");
  expect(formatList(["A", "B"], "en")).toBe("A and B");
});
test("both explicitly imported catalogs have identical semantic keys and translate", () => {
  function keys(value: object, prefix = ""): string[] {
    return Object.entries(value).flatMap(([key, entry]) => typeof entry === "object" ? keys(entry, `${prefix}${key}.`) : [`${prefix}${key}`]).sort();
  }
  expect(keys(getMessages("de"))).toEqual(keys(getMessages("en")));
  expect(getTranslator("de")("Settings.language.automatic")).toBe("Automatisch");
  expect(getTranslator("en")("Settings.language.automatic")).toBe("Automatic");
});

test("sender inventory covers both catalogs, named values and literal signature tokens", async () => {
  const { senderMessages } = await import("@/lib/senderMessages");
  const inventory = await import("@/doc/SENDER-IDENTITIES-UI-STRINGS.json");
  expect(inventory.semanticIds).toHaveLength(69);
  expect(inventory.catalogMapping).toEqual(senderMessages);
  for (const locale of ["de", "en"] as const) {
    const t = getTranslator(locale);
    for (const id of Object.values(senderMessages)) {
      expect(t.has(id)).toBe(true);
      expect(t(id, { sender: "Synthetic {sender} <alias@example.test>", email: "alias@example.test" })).not.toBe(id);
    }
    expect(t(senderMessages.senderDefaultOption, { sender: "Synthetic {sender}" })).toContain("Synthetic {sender}");
    for (const id of [senderMessages.placeholdersHelp, senderMessages.sharedTemplatesHelp]) {
      const text = t(id);
      for (const token of inventory.literalTokens) expect(text).toContain(token);
      expect(text).not.toContain("'{{");
    }
  }
});
