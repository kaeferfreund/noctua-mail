import { afterEach, beforeEach, expect, test } from "bun:test";
import { act, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { render } from "@/lib/i18n/testRender";
import AccountSettingsModal from "@/app/components/AccountSettingsModal";
import type { Account } from "@/lib/data";
import type { ContactList, OutreachAccountSettings, OutreachApiToken } from "@/lib/addons/outreach/types";
import { resetOutreachStatusForTests, type OutreachStatus } from "../useOutreachStatus";
import OutreachSettingsTab from "./OutreachSettingsTab";

const ON: OutreachStatus = { loaded: true, available: true, sesConfigured: true, trackingConfigured: true, accounts: [] };
const base = "/api/addons/outreach/accounts/mailbox-a";
const settings = (patch: Partial<OutreachAccountSettings> = {}): OutreachAccountSettings => ({
  accountId: "mailbox-a", enabled: false, transport: "ses", senderIdentityId: null, trackMailDefault: false, ipRetentionDays: 90,
  sendRatePerMinute: 30, organizationName: "", organizationAddress: "", updatedAt: null, ...patch
});
const list: ContactList = { id: "list-1", accountId: "mailbox-a", name: "Synthetic newsletter", description: "", optIn: "single", memberCount: 3,
  createdAt: 1, updatedAt: 1, archivedAt: null };
const token: OutreachApiToken = { id: "tok-1", name: "Synthetic form", listIds: ["list-1"], createdAt: Date.parse("2026-11-01T10:00:00Z"), lastUsedAt: null, revokedAt: null };

type Call = { method: string; url: string; body?: unknown };
let calls: Call[] = [];
let stored = settings();
let tokens: OutreachApiToken[] = [];
const apiFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input), method = init?.method ?? "GET";
  const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
  calls.push({ method, url, ...(body === undefined ? {} : { body }) });
  if (url === `${base}/settings` && method === "GET") return Response.json({ ok: true, settings: stored });
  if (url === `${base}/settings` && method === "PUT") { stored = { ...stored, ...body, updatedAt: 2 }; return Response.json({ ok: true, settings: stored }); }
  if (url === "/api/accounts/mailbox-a/identities") return Response.json({ ok: true, identities: [
    { id: "id-1", accountId: "mailbox-a", email: "news@example.test", displayName: "Synthetic News", replyTo: null, signatureId: null, isDefault: false, enabled: true }] });
  if (url === `${base}/api-tokens` && method === "GET") return Response.json({ ok: true, tokens });
  if (url === `${base}/api-tokens` && method === "POST") {
    const created = { ...token, id: "tok-2", name: body.name, listIds: body.listIds };
    tokens = [created, ...tokens];
    return Response.json({ ok: true, token: created, secret: "otk_synthetic-one-time-secret" }, { status: 201 });
  }
  if (url === `${base}/api-tokens/tok-1` && method === "DELETE") { tokens = tokens.filter(item => item.id !== "tok-1"); return Response.json({ ok: true }); }
  if (url === `${base}/lists`) return Response.json({ ok: true, lists: [list, { ...list, id: "list-old", name: "Archived list", archivedAt: 5 }] });
  return Response.json({ ok: false, message: "Not found" }, { status: 404 });
};

const originalFetch = globalThis.fetch;
const originalConfirm = window.confirm;
let statusRequests = 0;
beforeEach(() => {
  calls = []; stored = settings(); tokens = []; statusRequests = 0;
  // The shared status hook uses the global fetch; count its refreshes.
  globalThis.fetch = (async () => { statusRequests++; return Response.json({ ok: true, ...ON }); }) as unknown as typeof fetch;
  resetOutreachStatusForTests(ON);
});
afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
  window.confirm = originalConfirm;
  resetOutreachStatusForTests();
});

const account: Account = {
  id: "mailbox-a", avatar: "", email: "user@example.test", name: "Synthetic mailbox", accessRole: "manager",
  imap: { host: "imap.example.test", port: 993, secure: true, user: "user@example.test", password: "" },
  smtp: { host: "smtp.example.test", port: 465, secure: true, user: "user@example.test", password: "" }
};
function modal(role: Account["accessRole"] = "manager") {
  return render(<Theme><AccountSettingsModal editingAccount={{ ...account, accessRole: role }} isOpen manageTab="outreach" isExistingAccount apiFetch={apiFetch}
    onClose={() => {}} onTabChange={() => {}} onSave={() => {}} onDelete={() => {}} /></Theme>);
}
const tab = (role: Account["accessRole"] = "manager") => render(<Theme><OutreachSettingsTab accountId="mailbox-a" canManage={role === "manager"} apiFetch={apiFetch} onClose={() => {}} /></Theme>);

test("flag off: the settings dialog has no Newsletter tab and makes no addon request", () => {
  resetOutreachStatusForTests({ ...ON, available: false });
  const page = modal();
  expect(page.queryByRole("tab", { name: "Newsletter & tracking" })).toBeNull();
  expect(page.container.querySelector("[data-outreach-settings]")).toBeNull();
  expect(calls.filter(call => call.url.includes("/addons/"))).toEqual([]);
});

test("flag on: the tab is listed for every role and opens the addon settings", async () => {
  for (const role of ["manager", "viewer"] as const) {
    const page = modal(role);
    expect(page.getByRole("tab", { name: "Newsletter & tracking" }).getAttribute("aria-selected")).toBe("true");
    await page.findByRole("switch", { name: "Activate for this mailbox" });
    cleanup();
  }
});

test("manager activates and saves; the shared status is refreshed and the token section loads", async () => {
  const page = tab();
  const activate = await page.findByRole("switch", { name: "Activate for this mailbox" });
  expect(page.getByText("API tokens for sign-up forms can be created once the addon is activated and saved for this mailbox.")).toBeTruthy();
  const save = page.getByRole("button", { name: "Save" }) as HTMLButtonElement;
  expect(save.disabled).toBe(true);
  fireEvent.click(activate);
  fireEvent.click(page.getByRole("switch", { name: "Preselect tracking for normal mails" }));
  fireEvent.change(page.getByRole("spinbutton", { name: "Send rate (mails per minute)" }), { target: { value: "45" } });
  fireEvent.change(page.getByRole("textbox", { name: "Organization name" }), { target: { value: " Synthetic Org " } });
  expect(save.disabled).toBe(false);
  fireEvent.click(save);
  await page.findByText("Saved.");
  expect(calls.find(call => call.method === "PUT")?.body).toEqual({ enabled: true, transport: "ses", senderIdentityId: null, trackMailDefault: true,
    ipRetentionDays: 90, sendRatePerMinute: 45, organizationName: "Synthetic Org", organizationAddress: "" });
  await waitFor(() => expect(statusRequests).toBe(1));
  await page.findByText("No tokens yet.");
  expect(calls.filter(call => call.method === "GET").map(call => call.url).sort()).toEqual([
    "/api/accounts/mailbox-a/identities", `${base}/api-tokens`, `${base}/lists`, `${base}/settings`]);
});

test("out-of-range numbers block saving with a message", async () => {
  const page = tab();
  const field = await page.findByRole("spinbutton", { name: "Keep full IP addresses (days)" });
  fireEvent.change(field, { target: { value: "731" } });
  expect(page.getByRole("alert").textContent).toBe("Please enter valid whole numbers.");
  expect((page.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
});

test("non-managers see the settings read-only, without save button and token section", async () => {
  stored = settings({ enabled: true, organizationName: "Synthetic Org" });
  const page = tab("viewer");
  const activate = await page.findByRole("switch", { name: "Activate for this mailbox" });
  expect(page.getByText("Only managers of this mailbox can change these settings.")).toBeTruthy();
  expect(activate.hasAttribute("disabled")).toBe(true);
  expect(activate.getAttribute("aria-checked")).toBe("true");
  expect((page.getByRole("textbox", { name: "Organization name" }) as HTMLInputElement).disabled).toBe(true);
  expect(page.queryByRole("button", { name: "Save" })).toBeNull();
  expect(page.container.querySelector("[data-outreach-api-tokens]")).toBeNull();
  expect(calls.some(call => call.url.includes("api-tokens") || call.url.endsWith("/lists"))).toBe(false);
});

test("hints when SES or the tracking address are missing on the server", async () => {
  resetOutreachStatusForTests({ ...ON, sesConfigured: false, trackingConfigured: false });
  const page = tab();
  await page.findByRole("switch", { name: "Activate for this mailbox" });
  expect(page.getByText(/Amazon SES is not configured on the server/)).toBeTruthy();
  expect(page.getByText(/No public address for tracking links is configured/)).toBeTruthy();
});

test("token secret is shown once with a copy button; revoking asks first", async () => {
  stored = settings({ enabled: true });
  tokens = [token];
  const copied: string[] = [];
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (value: string) => { copied.push(value); } } });
  const page = tab();
  const section = await waitFor(() => {
    const element = page.container.querySelector("[data-outreach-api-tokens]") as HTMLElement | null;
    if (!element) throw new Error("token section missing");
    return element;
  });
  const scope = within(section);
  await scope.findByText("Synthetic form");
  expect(scope.queryByRole("checkbox", { name: "Archived list" })).toBeNull();
  const create = scope.getByRole("button", { name: "Create token" }) as HTMLButtonElement;
  fireEvent.change(scope.getByRole("textbox", { name: "Name" }), { target: { value: "Synthetic second form" } });
  expect(create.disabled).toBe(true);
  fireEvent.click(scope.getByRole("checkbox", { name: "Synthetic newsletter" }));
  fireEvent.click(create);
  await scope.findByText("otk_synthetic-one-time-secret");
  expect(calls.find(call => call.method === "POST")?.body).toEqual({ name: "Synthetic second form", listIds: ["list-1"] });
  expect(scope.getByText("New token “Synthetic second form”")).toBeTruthy();
  fireEvent.click(scope.getByRole("button", { name: "Copy token" }));
  await waitFor(() => expect(copied).toEqual(["otk_synthetic-one-time-secret"]));

  let asked = "";
  window.confirm = ((message?: string) => { asked = message ?? ""; return true; }) as typeof window.confirm;
  const holder = scope.getByText("Synthetic form").closest("[class*='rt-Card']") as HTMLElement;
  fireEvent.click(within(holder).getByRole("button", { name: "Revoke" }));
  await act(async () => {});
  await waitFor(() => expect(scope.queryByText("Synthetic form")).toBeNull());
  expect(asked).toBe("Revoke token “Synthetic form”? Forms that use it can no longer add contacts.");
  expect(calls.find(call => call.method === "DELETE")?.url).toBe(`${base}/api-tokens/tok-1`);

  // A fresh mount lists the token but never shows its secret again.
  cleanup();
  const again = tab();
  await again.findByText("Synthetic second form");
  expect(again.queryByText("otk_synthetic-one-time-secret")).toBeNull();
});
