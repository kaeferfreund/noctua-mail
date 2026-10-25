import { notifySenderPreferencesChanged, SENDER_SETTINGS_STORAGE_KEY } from "@/lib/ui/senderSettings";
import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import { render } from "@/lib/i18n/testRender";
import { Theme } from "@radix-ui/themes";
import type { Account, SenderIdentity } from "@/lib/data";
import IdentitiesTabContent from "./tabs/IdentitiesTabContent";
import SignaturesTabContent from "./tabs/SignaturesTabContent";
import PreferencesTabContent from "./tabs/PreferencesTabContent";
import type { AdminFetch } from "@/app/hooks/useAdminApi";
// Storage is shared by every DOM test file in the run; leave none behind for the next one.
afterEach(() => { cleanup(); localStorage.clear(); sessionStorage.clear(); });
const account = { id: "a", email: "primary@example.test", accessRole: "manager", settings: { signatures: [{ id: "shared", name: "Shared template", body: "{{user.name}}\n{{identity.email}}" }], defaultSignatureId: "shared" } } as Account;
const identities = ["primary", "alias", "disabled"].map(id => ({ id, accountId: "a", email: `${id}@example.test`, displayName: `Synthetic ${id}`, enabled: id !== "disabled", isDefault: id === "primary" } as SenderIdentity));
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

describe("sender identity settings", () => {
  for (const role of ["viewer", "editor"] as const) test(`${role}: read-only identities include disabled history`, async () => {
    const calls: RequestInit[] = [];
    const view = render(<Theme><IdentitiesTabContent editingAccount={{ ...account, accessRole: role }} apiFetch={async (_, init) => { calls.push(init ?? {}); return response({ identities }); }} /></Theme>);
    await view.findByText(/disabled@example.test/);
    expect(view.queryByRole("button", { name: "Add identity" })).toBeNull();
    expect(view.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(calls.every(call => !call.method)).toBe(true);
  });
  test("manager creates, edits, changes mailbox default and enables/disables through REST", async () => {
    const writes: { url: string; method?: string; body: Record<string, unknown> }[] = [];
    const apiFetch: AdminFetch = async (url, init) => {
      if (init?.method) writes.push({ url: String(url), method: init.method, body: JSON.parse(String(init.body)) });
      return response({ ok: true, identities });
    };
    const view = render(<Theme><IdentitiesTabContent editingAccount={account} apiFetch={apiFetch} /></Theme>);
    await view.findByRole("button", { name: "Add identity" });
    await waitFor(() => expect((view.getByRole("button", { name: "Add identity" }) as HTMLButtonElement).disabled).toBe(false));
    const primary = within(view.getByRole("region", { name: "primary@example.test" }));
    expect((primary.getByRole("button", { name: "Disable" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(view.getByRole("button", { name: "Add identity" }));
    fireEvent.change(view.getByLabelText("Email"), { target: { value: "new@example.test" } });
    fireEvent.change(view.getByLabelText("Display name"), { target: { value: "New brand" } });
    fireEvent.click(view.getByRole("button", { name: "Save identity" }));
    await view.findByText("Identity saved.");
    expect(writes[0]).toEqual({ url: "/api/accounts/a/identities", method: "POST", body: { email: "new@example.test", displayName: "New brand", enabled: true } });
    const alias = within(view.getByRole("region", { name: "alias@example.test" }));
    fireEvent.click(alias.getByRole("button", { name: "Edit" }));
    expect((view.getByLabelText("Email") as HTMLInputElement).disabled).toBe(true);
    fireEvent.change(view.getByLabelText("Reply-To"), { target: { value: "replies@example.test" } });
    fireEvent.click(view.getByRole("button", { name: "Save identity" }));
    await waitFor(() => expect(writes).toHaveLength(2));
    expect(writes[1].body.replyTo).toBe("replies@example.test"); expect(writes[1].body.email).toBeUndefined();
    await waitFor(() => expect((alias.getByRole("radio", { name: "Mailbox default for alias@example.test" }) as HTMLInputElement).disabled).toBe(false));
    fireEvent.click(alias.getByRole("radio", { name: "Mailbox default for alias@example.test" }));
    await waitFor(() => expect(writes).toHaveLength(3)); expect(writes[2].body).toEqual({ isDefault: true });
    await waitFor(() => expect((alias.getByRole("button", { name: "Disable" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(alias.getByRole("button", { name: "Disable" }));
    await waitFor(() => expect(writes).toHaveLength(4)); expect(writes[3].body).toEqual({ enabled: false });
    const disabled = within(view.getByRole("region", { name: "disabled@example.test" }));
    await waitFor(() => expect((disabled.getByRole("button", { name: "Enable" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(disabled.getByRole("button", { name: "Enable" }));
    await waitFor(() => expect(writes).toHaveLength(5)); expect(writes[4].body).toEqual({ enabled: true });
    expect(writes.every(write => !write.url.endsWith("/settings"))).toBe(true);
  });
  test("QA-216: personal From and signature override save with the tab's single save as sparse prefs, preview escaped name, explicit none and inheritance", async () => {
    const writes: unknown[] = [];
    let prefs: Record<string, unknown> = {};
    const apiFetch: AdminFetch = async (url, init) => {
      if (init?.method === "PUT") {
        const patch = JSON.parse(String(init.body)); writes.push(patch);
        for (const [key, value] of Object.entries(patch)) { if (value === null) delete prefs[key]; else prefs[key] = value; }
      }
      return response(String(url).endsWith("/identities") ? { identities } : String(url).endsWith("/prefs") ? { prefs } : { user: { name: "Synthetic <Jo>", email: "jo@example.test" }, accounts: [account] });
    };
    const view = render(<Theme><PreferencesTabContent editingAccount={{ ...account, accessRole: "viewer" }} apiFetch={apiFetch} onClose={() => {}} senderPreferences /></Theme>);
    await view.findByText(/Synthetic <Jo>\s+primary@example.test/);
    expect(view.container.querySelector("jo")).toBeNull();
    expect(view.queryByRole("option", { name: /disabled@example.test/ })).toBeNull();
    fireEvent.change(view.getByLabelText("Default From"), { target: { value: "alias" } });
    fireEvent.change(view.getByLabelText("Personal signature", { exact: true }), { target: { value: "custom" } });
    fireEvent.change(view.getByLabelText("Personal signature text"), { target: { value: "Regards {{user.name}} / {{identity.email}}" } });
    expect(view.getByText("Regards Synthetic <Jo> / alias@example.test")).toBeTruthy();
    // One save path for the whole tab: sender and other preferences go out in one sparse PUT.
    expect(view.getAllByRole("button", { name: /save/i }).map(button => button.textContent)).toEqual(["Save preferences"]);
    fireEvent.change(view.getByLabelText("Show sender icons"), { target: { value: "false" } });
    fireEvent.click(view.getByRole("button", { name: "Save preferences" })); await view.findByText("Preferences saved.");
    expect(writes[0]).toEqual({ appearance: { senderIcons: false }, defaultIdentityId: "alias", signatureOverride: "Regards {{user.name}} / {{identity.email}}" });
    expect((view.getByLabelText("Default From") as HTMLSelectElement).value).toBe("alias");
    fireEvent.change(view.getByLabelText("Personal signature text"), { target: { value: "" } });
    fireEvent.click(view.getByRole("button", { name: "Save preferences" }));
    await waitFor(() => expect(writes).toHaveLength(2)); expect(writes[1]).toEqual({ signatureOverride: "" });
    await waitFor(() => expect((view.getByRole("button", { name: "Save preferences" }) as HTMLButtonElement).disabled).toBe(true));
    fireEvent.change(view.getByLabelText("Default From"), { target: { value: "inherit" } });
    fireEvent.change(view.getByLabelText("Personal signature", { exact: true }), { target: { value: "inherit" } });
    fireEvent.click(view.getByRole("button", { name: "Save preferences" }));
    await waitFor(() => expect(writes).toHaveLength(3)); expect(writes[2]).toEqual({ defaultIdentityId: null, signatureOverride: null });
    expect(account.settings?.defaultSignatureId).toBe("shared");
  });
});


test("shared signature editor validates supported placeholders before mailbox save", () => {
  const view = render(<Theme><SignaturesTabContent editingAccount={{ ...account, settings: { signatures: [{ id: "invalid", name: "Invalid template", body: "{{user.title}}" }], defaultSignatureId: "" } }} isExistingAccount canSave onUpdateSettings={() => {}} onClose={() => {}} onSave={() => { throw Error("invalid signature saved"); }} /></Theme>);
  expect(view.getByRole("alert").textContent).toContain("supported signature placeholders");
  expect((view.getByRole("button", { name: /^Save$/ }) as HTMLButtonElement).disabled).toBe(true);
});


test("cross-window sender refresh receipts never store personal signature text", () => {
  notifySenderPreferencesChanged("a", { signatureOverride: "Private synthetic signature", defaultIdentityId: "alias" });
  const raw = window.localStorage.getItem(SENDER_SETTINGS_STORAGE_KEY)!;
  expect(JSON.parse(raw).accountId).toBe("a");
  expect(raw).not.toContain("Private synthetic signature"); expect(raw).not.toContain("defaultIdentityId");
  window.localStorage.removeItem(SENDER_SETTINGS_STORAGE_KEY);
});

test("locale changes translate open identity forms and retained API errors without losing user input", async () => {
  const { I18nTestProvider } = await import("@/lib/i18n/testRender");
  const { AdminApiError } = await import("@/app/hooks/useAdminApi");
  const apiFetch: AdminFetch = async (_, init) => init?.method
    ? response({ ok: false, code: "identity_exists", message: "Private synthetic provider detail" }, 409)
    : response({ identities });
  const form = <Theme><IdentitiesTabContent editingAccount={account} apiFetch={apiFetch} /></Theme>;
  const view = render(<I18nTestProvider locale="en">{form}</I18nTestProvider>);
  await waitFor(() => expect((view.getByRole("button", { name: "Add identity" }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(view.getByRole("button", { name: "Add identity" }));
  fireEvent.change(view.getByLabelText("Email"), { target: { value: "synthetic@example.test" } });
  fireEvent.change(view.getByLabelText("Display name"), { target: { value: "Synthetic {{user.name}}" } });
  fireEvent.click(view.getByRole("button", { name: "Save identity" }));
  await view.findByText("An identity with this address already exists.");
  view.rerender(<I18nTestProvider locale="de">{form}</I18nTestProvider>);
  expect(view.getByRole("alert").textContent).toBe("Eine Identität mit dieser Adresse ist bereits vorhanden.");
  expect((view.getByLabelText("E-Mail") as HTMLInputElement).value).toBe("synthetic@example.test");
  expect((view.getByLabelText("Anzeigename") as HTMLInputElement).value).toBe("Synthetic {{user.name}}");
  expect(view.getByRole("button", { name: "Abbrechen" })).toBeTruthy();
  expect(view.queryByText("Private synthetic provider detail")).toBeNull();
  // The API wrapper still exposes the original structured error to callers.
  const { adminRequest } = await import("@/app/hooks/useAdminApi");
  await expect(adminRequest(apiFetch, "/synthetic", { method: "POST" })).rejects.toBeInstanceOf(AdminApiError);
});
