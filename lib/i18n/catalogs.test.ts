import { describe, expect, test } from "bun:test";
import { parse } from "@formatjs/icu-messageformat-parser";
import { catalogs, getTranslator } from "./translator";

function flatten(value: object, prefix = ""): Record<string, string> {
  return Object.fromEntries(Object.entries(value).flatMap(([key, child]) => {
    const id = prefix ? `${prefix}.${key}` : key;
    return typeof child === "string" ? [[id, child]] : Object.entries(flatten(child, id));
  }));
}

describe("message catalogs", () => {
  test("both locales have identical leaf keys and valid ICU messages", () => {
    const de = flatten(catalogs.de), en = flatten(catalogs.en);
    expect(Object.keys(de).sort()).toEqual(Object.keys(en).sort());
    for (const [locale, messages] of Object.entries({ de, en })) {
      for (const [key, message] of Object.entries(messages)) {
        expect(() => parse(message, { requiresOtherClause: true }), `${locale}.${key}`).not.toThrow();
      }
    }
  });

  test("complete count messages resolve German grammar and keep user text opaque", () => {
    const t = getTranslator("de");
    expect(t("Reader.trashDescription", { count: 1, kind: "message" })).toBe("Diese Nachricht wird in den Papierkorb verschoben.");
    expect(t("Reader.trashDescription", { count: 3, kind: "thread" })).toBe("Alle 3 Nachrichten dieses Threads werden in den Papierkorb verschoben.");
    expect(t("Reader.removeAttachmentDescription", { kind: "image", named: "yes", filename: "Synthetic {attachment}.png" })).toStartWith("„Synthetic {attachment}.png“ wird");
    expect(t("Notifications.relativeMinutes", { count: 5 })).toBe("vor 5 Minuten");
    expect(getTranslator("en")("Notifications.relativeMinutes", { count: 5 })).toBe("5m ago");
    expect(t("Notifications.moved", { count: 3, destination: "Synthetic Archive" })).toBe("3 Nachrichten nach „Synthetic Archive“ verschoben.");
  });
});

test("responsive list styling never treats accessible copy as control identity", async () => {
  for (const file of ["MessageListPane.module.css", "MessageRow.module.css"]) {
    const css = await Bun.file(new URL(`../../app/components/mailclient/messagelist/${file}`, import.meta.url)).text();
    expect(css).not.toMatch(/\[(?:aria-label|title)\s*=/);
  }
});
