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
