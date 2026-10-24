import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, waitFor } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { I18nTestProvider, render } from "@/lib/i18n/testRender";
import type { Topic } from "@/lib/data";
import type { TopicStat } from "@/lib/topics/core";
import type { McpTokenMetadata } from "@/lib/data";
import TopicsTabContent from "./tabs/TopicsTabContent";
import McpTabContent from "./tabs/McpTabContent";
import { mcpTokenListItem } from "@/lib/mcpPermissions";
import CalendarTabContent from "./tabs/CalendarTabContent";
import TranslationTabContent from "./tabs/TranslationTabContent";
import type { Account } from "@/lib/data";

afterEach(cleanup);
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

const topic = (id: string, name: string): Topic => ({
  id, accountId: "synthetic-mailbox", name, shortName: null, color: null, imapKeyword: `$topic_${id}`, createdAt: 0, updatedAt: 0
});
// Topic names and signal values are user content and must stay literal in every locale.
const topics = [topic("one", "Synthetic {Alpha}"), topic("two", "Synthetic Beta")];
const stats: TopicStat[] = [
  { topicId: "one", threadCount: 1, messageCount: 1, topSignals: [{ type: "senderDomain", value: "example.test", count: 1 }] },
  { topicId: "two", threadCount: 3, messageCount: 5, topSignals: [{ type: "listId", value: "list.example.test", count: 2 }] }
];
const topicsFetch = async (input: RequestInfo | URL) =>
  String(input).endsWith("/stats") ? json({ ok: true, stats }) : json({ ok: true, topics });

describe("Topics settings in German", () => {
  it("uses complete plural sentences and keeps topic names and signal values literal", async () => {
    const page = render(<I18nTestProvider locale="de"><Theme><TopicsTabContent
      accountId="synthetic-mailbox" isActive isExistingAccount canSave apiFetch={topicsFetch}
      onClose={() => {}} onSave={() => {}}
    /></Theme></I18nTestProvider>);
    await page.findByText("1 Thread");
    expect(page.getByText("3 Threads")).toBeTruthy();
    expect(page.getAllByText("Synthetic {Alpha}").length).toBeGreaterThan(0);
    expect(page.getByText("Absenderdomain: example.test · 1 Thread")).toBeTruthy();
    expect(page.getByText("List-ID: list.example.test · 2 Threads")).toBeTruthy();
    expect(page.getByRole("button", { name: "Signal „Absenderdomain“ entfernen" })).toBeTruthy();
    expect(page.getByRole("button", { name: "Neues Thema" })).toBeTruthy();
    expect(page.getByRole("button", { name: "Exportieren" })).toBeTruthy();
    expect(page.getByRole("button", { name: "Speichern" })).toBeTruthy();
    expect(page.getByText("Lerndaten")).toBeTruthy();
  });
});

const tokenRecord = (overrides: Partial<McpTokenMetadata> = {}): McpTokenMetadata => ({
  id: "synthetic-token", accountId: "synthetic-mailbox", createdByUserId: "synthetic-user", label: "Synthetic QA token",
  tokenSuffix: "c0ffee", createdAt: Date.UTC(2026, 9, 23, 10, 5), expiresAt: Date.UTC(2027, 3, 21, 10, 5), lastUsedAt: null,
  ...overrides
});

describe("MCP settings in German", () => {
  it("localizes presets, token metadata and dates while keeping protocol text", async () => {
    const mailboxes = [{ id: "synthetic-mailbox", name: "Synthetisches Postfach", email: "own@example.test" }];
    const apiFetch = async () => json({ ok: true, mailboxes, tokens: [mcpTokenListItem(tokenRecord({ accountIds: ["synthetic-mailbox", "synthetic-hidden"] }), new Set(["synthetic-mailbox"]))] });
    const page = render(<I18nTestProvider locale="de"><Theme><McpTabContent
      accountId="synthetic-mailbox" isActive isExistingAccount apiFetch={apiFetch} onClose={() => {}}
    /></Theme></I18nTestProvider>);
    await page.findByText("Synthetic QA token", { exact: true });
    expect(page.getByText("Authorization: Bearer <token>").tagName).toBe("CODE");
    expect(page.getByText("c0ffee").tagName).toBe("CODE");
    expect(page.getByText("Erstellt: 23. Okt. 2026, 12:05")).toBeTruthy();
    expect(page.getByText("Läuft ab: 21. Apr. 2027, 12:05")).toBeTruthy();
    expect(page.getByText("Zuletzt verwendet: Nie")).toBeTruthy();
    expect(page.getByText("Postfächer: Synthetisches Postfach (own@example.test), +1 weiteres Postfach")).toBeTruthy();
    fireEvent.click(page.getByRole("combobox"));
    expect(await page.findByRole("option", { name: "30 Tage" })).toBeTruthy();
    fireEvent.click(page.getByRole("option", { name: "Benutzerdefiniert" }));
    fireEvent.change(await page.findByDisplayValue(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/), { target: { value: "2020-01-01T00:00" } });
    fireEvent.change(page.getByPlaceholderText("Mein MCP-Client"), { target: { value: "Synthetic client" } });
    fireEvent.click(page.getByRole("button", { name: "Token erstellen" }));
    await page.findByText("Wähle einen Ablaufzeitpunkt zwischen einer Minute und einem Jahr ab jetzt.");
  });

  it("keeps the English expiry validation copy", async () => {
    const page = render(<Theme><McpTabContent
      accountId="synthetic-mailbox" isActive isExistingAccount apiFetch={async () => json({ ok: true, tokens: [] })} onClose={() => {}}
    /></Theme>);
    await page.findByText("No MCP tokens created for this account.");
    fireEvent.click(page.getByRole("combobox"));
    fireEvent.click(await page.findByRole("option", { name: "Custom" }));
    fireEvent.change(await page.findByDisplayValue(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/), { target: { value: "2020-01-01T00:00" } });
    fireEvent.change(page.getByPlaceholderText("My MCP client"), { target: { value: "Synthetic client" } });
    fireEvent.click(page.getByRole("button", { name: "Create token" }));
    await page.findByText("Choose an expiry between one minute and one year from now.");
  });
});

const account: Account = {
  id: "synthetic-mailbox", avatar: "", email: "user@example.test", name: "Synthetic mailbox", accessRole: "manager",
  imap: { host: "imap.example.test", port: 993, secure: true, user: "user@example.test", password: "" },
  smtp: { host: "smtp.example.test", port: 465, secure: true, user: "user@example.test", password: "" },
  caldav: { url: "https://caldav.example.test/", user: "user@example.test", password: "synthetic" },
  deepl: { enabled: true, apiKey: "synthetic:fx" }
};

describe("Calendar and translation settings in German", () => {
  it("formats the calendar count and keeps calendar names literal", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => json({ ok: true, calendars: [{ displayName: "Synthetic {Team}", url: "/c/1" }] })) as unknown as typeof fetch;
    try {
      const page = render(<I18nTestProvider locale="de"><Theme><CalendarTabContent
        editingAccount={account} isExistingAccount canSave onUpdateAccount={() => {}} onClose={() => {}} onSave={() => {}}
      /></Theme></I18nTestProvider>);
      expect(page.getByLabelText("Sync-Intervall").textContent).toBe("5 Minuten");
      fireEvent.click(page.getByRole("button", { name: "Verbindung testen" }));
      await page.findByText("Verbunden. 1 Kalender gefunden: Synthetic {Team}.");
    } finally { globalThis.fetch = originalFetch; }
  });

  it("formats DeepL usage numbers with the UI locale", async () => {
    const apiFetch = async () => json({ ok: true, plan: "Free", characterCount: 12345, characterLimit: 500000 });
    const page = render(<I18nTestProvider locale="de"><Theme><TranslationTabContent
      editingAccount={account} isExistingAccount canSave onUpdateAccount={() => {}} onClose={() => {}} onSave={() => {}} apiFetch={apiFetch}
    /></Theme></I18nTestProvider>);
    fireEvent.click(page.getByRole("button", { name: "Schlüssel testen" }));
    await page.findByText("Schlüssel gültig (Tarif Free). 12.345 / 500.000 Zeichen in diesem Zeitraum verbraucht.");
    await waitFor(() => expect(page.getByRole("button", { name: "Schlüssel testen" })).toBeTruthy());
  });
});
