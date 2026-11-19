import { afterEach, beforeEach, expect, test } from "bun:test";
import { cleanup, fireEvent, waitFor } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { render } from "@/lib/i18n/testRender";
import type { OutreachAccountSettings } from "@/lib/addons/outreach/types";
import { resetOutreachStatusForTests } from "../useOutreachStatus";
import OutreachSettingsTab from "./OutreachSettingsTab";

/** Review fix AJ: a default sender that no longer exists (synthetic data only). */

const base = "/api/addons/outreach/accounts/mailbox-a";
const settings = (patch: Partial<OutreachAccountSettings> = {}): OutreachAccountSettings => ({
  accountId: "mailbox-a", enabled: true, transport: "mailbox-smtp", senderIdentityId: "id-deleted", trackMailDefault: false, ipRetentionDays: 90,
  sendRatePerMinute: 30, organizationName: "Synthetic Org", organizationAddress: "", updatedAt: 1, ...patch
});

let puts: unknown[] = [];
let stored = settings();
let identitiesFail = false;
const apiFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input), method = init?.method ?? "GET";
  if (url === `${base}/settings` && method === "GET") return Response.json({ ok: true, settings: stored });
  if (url === `${base}/settings` && method === "PUT") {
    const body = JSON.parse(String(init?.body));
    puts.push(body);
    stored = { ...stored, ...body, updatedAt: 2 };
    return Response.json({ ok: true, settings: stored });
  }
  if (url === "/api/accounts/mailbox-a/identities") {
    if (identitiesFail) return Response.json({ ok: false, message: "boom" }, { status: 500 });
    return Response.json({ ok: true, identities: [
      { id: "id-1", accountId: "mailbox-a", email: "news@example.test", displayName: "Synthetic News", replyTo: null, signatureId: null, isDefault: false, enabled: true }] });
  }
  if (url === `${base}/api-tokens`) return Response.json({ ok: true, tokens: [] });
  if (url === `${base}/lists`) return Response.json({ ok: true, lists: [] });
  return Response.json({ ok: false, message: "Not found" }, { status: 404 });
};

const originalFetch = globalThis.fetch;
beforeEach(() => {
  puts = []; stored = settings(); identitiesFail = false;
  globalThis.fetch = (async () => Response.json({ ok: true, available: true, accounts: [], sesConfigured: true, trackingConfigured: true })) as unknown as typeof fetch;
  resetOutreachStatusForTests({ loaded: true, available: true, accounts: [], sesConfigured: true, trackingConfigured: true });
});
afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
  resetOutreachStatusForTests();
});

const tab = () => render(<Theme><OutreachSettingsTab accountId="mailbox-a" canManage apiFetch={apiFetch} onClose={() => {}} /></Theme>);
const MISSING = "The saved sender no longer exists. Saving stores the mailbox's default sender unless you choose another one.";

test("AJ: a deleted default sender is reported and saving stores the mailbox default", async () => {
  const page = tab();
  expect(await page.findByText(MISSING)).toBeTruthy();
  const save = page.getByRole("button", { name: "Save" }) as HTMLButtonElement;
  expect(save.disabled).toBe(false);
  fireEvent.click(save);
  await page.findByText("Saved.");
  expect(puts).toEqual([expect.objectContaining({ senderIdentityId: null })]);
  await waitFor(() => expect(page.queryByText(MISSING)).toBeNull());
  expect(save.disabled).toBe(true);
});

test("AJ: another change saved with a deleted sender does not store the dead id again", async () => {
  const page = tab();
  fireEvent.change(await page.findByRole("textbox", { name: "Organization name" }), { target: { value: "Synthetic Org 2" } });
  fireEvent.click(page.getByRole("button", { name: "Save" }));
  await page.findByText("Saved.");
  expect(puts).toEqual([expect.objectContaining({ senderIdentityId: null, organizationName: "Synthetic Org 2" })]);
});

test("AJ: an existing sender is kept and not reported", async () => {
  stored = settings({ senderIdentityId: "id-1" });
  const page = tab();
  fireEvent.change(await page.findByRole("textbox", { name: "Organization name" }), { target: { value: "Synthetic Org 2" } });
  expect(page.queryByText(MISSING)).toBeNull();
  fireEvent.click(page.getByRole("button", { name: "Save" }));
  await page.findByText("Saved.");
  expect(puts).toEqual([expect.objectContaining({ senderIdentityId: "id-1" })]);
});

test("AJ: when the identities cannot be loaded, the stored sender is kept", async () => {
  identitiesFail = true;
  const page = tab();
  const save = page.getByRole("button", { name: "Save" }) as HTMLButtonElement;
  fireEvent.change(await page.findByRole("textbox", { name: "Organization name" }), { target: { value: "Synthetic Org 2" } });
  expect(page.queryByText(MISSING)).toBeNull();
  fireEvent.click(save);
  await page.findByText("Saved.");
  expect(puts).toEqual([expect.objectContaining({ senderIdentityId: "id-deleted" })]);
});
