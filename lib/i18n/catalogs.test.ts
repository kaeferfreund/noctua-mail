import { describe, expect, test, it } from "bun:test";
import { parse } from "@formatjs/icu-messageformat-parser";
import de from "@/messages/de.json";
import en from "@/messages/en.json";
import { createTranslator } from "next-intl";
import { catalogs, getTranslator } from "./translator";
import { timeZone } from "./config";

function leaves(value: Record<string, unknown>, prefix = ""): Record<string, string> {
  return Object.fromEntries(Object.entries(value).flatMap(([key, item]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof item === "string") return [[path, item]];
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`Invalid catalog entry: ${path}`);
    return Object.entries(leaves(item as Record<string, unknown>, path));
  }));
}

test("German progress labels for saving and sending use one passive form", () => {
  const progress = Object.entries(leaves(de)).filter(([path]) => /\.(saving|sending)$/.test(path));
  expect(progress.length).toBeGreaterThan(3);
  for (const [path, text] of progress) {
    expect(`${path}: ${text}`).toMatch(path.endsWith(".saving") ? /: (.+ )?[Ww]ird gespeichert …$/ : /: (.+ )?[Ww]ird gesendet …$/);
  }
});

test("QA-214: German mailbox copy says Postfach; Konto only means the personal or a provider account", () => {
  // doc/I18N.md: Mailbox = Postfach. These keys refer to the personal login or the DeepL account.
  const personal = /^(Auth\.|Shell\.account$|Settings\.translation\.apiKeyHint$)/;
  const konto = Object.entries(leaves(de)).filter(([path, text]) => /Kont(o|en)/.test(text) && !personal.test(path));
  expect(konto).toEqual([]);
});

describe("message catalogs", () => {
  test("both locales have identical leaf keys and valid ICU messages", () => {
    const de = leaves(catalogs.de), en = leaves(catalogs.en);
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

test("reviewed German reader copy follows the binding terminology and complete messages", () => {
  const t = getTranslator("de");
  expect(t("Reader.transactional")).toBe("🧾 Transaktions-E-Mails");
  expect(t("Reader.flags.transactional")).toBe("🧾 Transaktions-E-Mails");
  expect(t("Reader.categories.transactional")).toBe("Transaktions-E-Mails");
  expect(t("Reader.unmarkAnswered")).toBe("Antwortmarkierung entfernen");
  expect(t("Reader.noMatchingFolders", { query: "Synthetic {opaque}" })).toBe("Keine Ordner entsprechen „Synthetic {opaque}“.");
  expect(t("Reader.startFullSync")).toBe("Synchronisierung starten");
  expect(t("Reader.translatedTo", { language: "Synthetic language", hasSource: "no", source: "" })).toBe("Zielsprache: Synthetic language");
  expect(t("Reader.recent")).toBe("Zuletzt verwendet"); // Folder history retains its meaning.
});

describe("message catalogs", () => {
  it("has identical German and English message keys", () => {
    expect(Object.keys(leaves(de)).sort()).toEqual(Object.keys(leaves(en)).sort());
  });
  for (const [locale, messages] of Object.entries({de, en})) {
    it(`${locale} contains valid ICU messages`, () => {
      for (const [key, message] of Object.entries(leaves(messages))) {
        expect(() => parse(message), `${locale}.${key}`).not.toThrow();
      }
    });
  }
});

test("admin self-grant copy is explicit in both locales and uses German mailbox roles", () => {
  const t = getTranslator("de");
  expect(t("Admin.mailboxes.selfGrantTitle")).toBe("Dir selbst Zugriff geben?");
  expect(t("Admin.mailboxes.noMembers")).toBe("Noch keine Mitglieder – niemand sieht dieses Postfach");
  expect((["manager", "editor", "viewer"] as const).map(role => t(`Admin.roles.${role}`))).toEqual(["Verwalter", "Bearbeiter", "Leser"]);
  for (const locale of ["de", "en"] as const) {
    const translate = getTranslator(locale);
    for (const key of ["selfGrantTitle", "selfGrantHelp", "grantAccess", "later", "noMembers"] as const) {
      expect(translate(`Admin.mailboxes.${key}`)).not.toBe(`Admin.mailboxes.${key}`);
    }
  }
});

test("views use reviewed German copy, independent of admin invitations and protocol IDs", () => {
  expect(Object.values(de.Views).filter(value => typeof value === "object").map(view => view.name)).toEqual([
    "Ungelesen & unbeantwortet", "Markiert & Aufgaben", "Kalendereinladungen", "Mir zugewiesen", "Nicht zugewiesen", "Offen", "Posteingang", "Verdächtig"
  ]);
  const t = getTranslator("de");
  expect(t("Views.actionQueue.description")).toContain("erledigte Aufgaben");
  expect(t("Views.viewScope", { name: "Synthetic {opaque}" })).toBe("in „Synthetic {opaque}“");
  expect(t("Views.countTitle", { description: "Einladungen", total: 1, unread: 1 })).toBe("Einladungen (1 Nachricht, 1 ungelesen)");
  expect(t("Views.countTitle", { description: "Einladungen", total: 3, unread: 2 })).toBe("Einladungen (3 Nachrichten, 2 ungelesen)");
  expect(t("Views.pendingCount", { count: 1 })).toBe("1 offene Aufgabe");
  expect(t("Views.pendingCount", { count: 3 })).toBe("3 offene Aufgaben");
});

test("both catalogs preserve the same ICU argument and rich-tag names", () => {
  function argumentsIn(message: string): string[] {
    const names = new Set<string>();
    function visit(nodes: ReturnType<typeof parse>) {
      for (const node of nodes) {
        if (node.type !== 0 && "value" in node && typeof node.value === "string") names.add(node.value);
        if ("options" in node) for (const option of Object.values(node.options)) visit(option.value);
        if ("children" in node) visit(node.children);
      }
    }
    visit(parse(message));
    return [...names].sort();
  }
  const english = leaves(en);
  for (const [key, message] of Object.entries(leaves(de))) {
    expect(argumentsIn(message), key).toEqual(argumentsIn(english[key]));
  }
});


test("round-two copy follows the reviewed leaf values and folder plural grammar", () => {
  const t = getTranslator("de");
  expect(t("Settings.tabs.account")).toBe("Postfach");
  expect(t("Views.focused.badgeLabel")).toBe("Ungelesen & unbeantwortet");
  expect(t("Views.focused.description")).toContain("ohne Newsletter");
  expect(t("Views.unassigned.description")).toBe("Hier findest du noch nicht erledigte Threads, die niemandem zugewiesen sind.");
  expect(t("Shell.status.mode.recent")).toBe("Synchronisierung der letzten Nachrichten");
  expect(t("Shell.refreshDescription")).toBe("Eine neue Version ist verfügbar. Sie ist möglicherweise mit deiner aktuellen Sitzung nicht kompatibel.");
  expect(t("Shell.refreshMandatory", { version: "synthetic-version" })).toBe("Lade die Seite neu, bevor du fortfährst. Neue Version: synthetic-version.");
  for (const [count, expected] of [
    [1, "1 Hinweis erfordert deine Aufmerksamkeit"],
    [2, "2 Hinweise erfordern deine Aufmerksamkeit"]
  ] as const) expect(t("Shell.status.attention", { count })).toBe(expected);
  expect(getTranslator("en")("Shell.loading.mailbox")).toBe("Add mailbox");
});

test("getTranslator reuses one translator per locale with unchanged output", () => {
  expect(getTranslator("de")).toBe(getTranslator("de"));
  expect(getTranslator("en")).toBe(getTranslator("en"));
  expect(getTranslator("de")).not.toBe(getTranslator("en"));
  const values = { path: "Projekte/Kunden", total: 1250, unread: 3 };
  for (const locale of ["de", "en"] as const) {
    const fresh = createTranslator({ locale, messages: catalogs[locale], timeZone });
    expect(getTranslator(locale)("List.folderCountTitle", values)).toBe(fresh("List.folderCountTitle", values));
    expect(getTranslator(locale)("List.me")).toBe(fresh("List.me"));
  }
  expect(getTranslator("de")("List.me")).not.toBe(getTranslator("en")("List.me"));
});

test("reminder leads read in whole minutes, hours or days in both locales", () => {
  const de = getTranslator("de"), en = getTranslator("en");
  for (const [unit, count, german, english] of [
    ["start", 0, "Erinnerung: zu Beginn", "Reminder: at start"],
    ["minute", 1, "Erinnerung: 1 Minute vorher", "Reminder: 1 minute before"],
    ["minute", 15, "Erinnerung: 15 Minuten vorher", "Reminder: 15 minutes before"],
    ["hour", 1, "Erinnerung: 1 Stunde vorher", "Reminder: 1 hour before"],
    ["hour", 2, "Erinnerung: 2 Stunden vorher", "Reminder: 2 hours before"],
    ["day", 1, "Erinnerung: 1 Tag vorher", "Reminder: 1 day before"],
    ["day", 2, "Erinnerung: 2 Tage vorher", "Reminder: 2 days before"]
  ] as const) {
    expect(de("Shell.status.reminderLead", { unit, count })).toBe(german);
    expect(en("Shell.status.reminderLead", { unit, count })).toBe(english);
  }
});

test("generated correspondence keeps user text opaque and uses recognizable German markers", () => {
  const t = getTranslator("de");
  expect(t("Compose.generated.replyHeader", { date: "01.01.2024, 13:00", sender: "Synthetic {opaque} <a@example.test>" }))
    .toBe("Am 01.01.2024, 13:00 schrieb Synthetic {opaque} <a@example.test>:");
  expect(getTranslator("en")("Compose.generated.replyHeader", { date: "01/01/2024, 13:00", sender: "Synthetic" }))
    .toBe("On 01/01/2024, 13:00, Synthetic wrote:");
  expect(Object.values(de.Compose.generated.forwardFields)).toEqual(["Von", "Antwort an", "Datum", "Betreff", "An", "Cc"]);
});

test("DeepL language names are localized by stable code and English keeps the shared labels", async () => {
  const { DEEPL_TARGET_LANGUAGES } = await import("@/lib/deeplLanguages");
  expect(Object.keys(de.Settings.translation.languages)).toEqual(DEEPL_TARGET_LANGUAGES.map(language => language.code));
  expect(Object.values(en.Settings.translation.languages)).toEqual(DEEPL_TARGET_LANGUAGES.map(language => language.label));
  expect(getTranslator("de")("Settings.translation.languages.EN-US")).toBe("Englisch (amerikanisch)");
});
