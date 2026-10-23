import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import { render } from "@/lib/i18n/testRender";
import { Theme } from "@radix-ui/themes";
import MembersTabContent from "./tabs/MembersTabContent";
import PreferencesTabContent from "./tabs/PreferencesTabContent";
import AccountSettingsModal from "@/app/components/AccountSettingsModal";
import type { Account } from "@/lib/data";
import type { Member } from "@/app/components/admin/types";
import type { AdminFetch } from "@/app/hooks/useAdminApi";

afterEach(cleanup);
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
const account: Account = { id: "synthetic-account", name: "Synthetic Mailbox", email: "mailbox@example.test", avatar: "", accessRole: "manager", isOwner: false, settings: { signatures: [{ id: "synthetic-signature", name: "Synthetic signature", body: "Regards" }] }, imap: { host: "imap.example.test", port: 993, secure: true, user: "mailbox", password: "" }, smtp: { host: "smtp.example.test", port: 465, secure: true, user: "mailbox", password: "" } };
const members: Member[] = [
  { userId: "synthetic-owner", email: "owner@example.test", name: "Synthetic Owner", role: "manager", isOwner: true, disabled: false },
  { userId: "synthetic-self", email: "self@example.test", name: "Synthetic Self", role: "manager", isOwner: false, disabled: false },
  { userId: "synthetic-disabled", email: "disabled@example.test", name: "Synthetic Disabled", role: "editor", isOwner: false, disabled: true }
];
const directory = [{ id: "synthetic-add", email: "add@example.test", role: "user" as const, disabled: false }, { id: "synthetic-disabled-add", email: "disabled-add@example.test", role: "user" as const, disabled: true }];
function memberPage(override?: (url: string, init?: RequestInit) => Response | undefined, list = members) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const apiFetch: AdminFetch = async (input, init) => { const url = String(input); calls.push({ url, init }); return override?.(url, init) ?? response(url.includes("/candidates?") ? { ok: true, candidates: [{ id: "synthetic-add", name: null, email: "add@example.test" }] } : { ok: true, members: list }); };
  const page = render(<Theme><MembersTabContent accountId={account.id} accessRole="manager" currentUserId="synthetic-self" users={directory} apiFetch={apiFetch} /></Theme>);
  return { page, calls };
}
describe("Members tab", () => {
  it("shows disabled users to managers and prevents owner/self role changes", async () => {
    const { page } = memberPage(); await page.findByText("Synthetic Owner");
    expect(page.getByText("Owner", { exact: true })).toBeTruthy(); expect(page.getByText("Disabled", { exact: true })).toBeTruthy();
    expect((page.getByLabelText("Role for owner@example.test") as HTMLSelectElement).disabled).toBe(true);
    expect((page.getByLabelText("Role for self@example.test") as HTMLSelectElement).disabled).toBe(true);
    const ownerRow = page.getByText("Synthetic Owner").closest("tr")!;
    expect((within(ownerRow).getByRole("button", { name: "Remove" }) as HTMLButtonElement).disabled).toBe(true);
    expect(page.queryByRole("option", { name: /disabled-add/ })).toBeNull();
  });
  it("keeps the last enabled manager when the other manager is disabled", async () => {
    const { page } = memberPage(undefined, [{ ...members[0], disabled: true }, members[1]]);
    await page.findByText("Synthetic Self");
    const self = within(page.getByText("Synthetic Self").closest("tr")!);
    expect((self.getByRole("button", { name: "Remove" }) as HTMLButtonElement).disabled).toBe(true);
  });
  it("adds an existing enabled user through the manager wrapper", async () => {
    const { page, calls } = memberPage(); await page.findByText("Synthetic Self");
    fireEvent.change(page.getByLabelText("Add existing enabled user"), { target: { value: "synthetic-add" } });
    fireEvent.change(page.getByLabelText("New member role"), { target: { value: "editor" } }); fireEvent.click(page.getByRole("button", { name: "Add member" }));
    await waitFor(() => expect(calls.filter(call => call.init?.method === "PUT")).toHaveLength(1));
    const write = calls.find(call => call.init?.method === "PUT")!;
    expect(write.url).toBe("/api/accounts/synthetic-account/members/synthetic-add"); expect(JSON.parse(String(write.init?.body))).toEqual({ role: "editor" });
  });
  for (const [code, message] of [["last_manager", "last enabled manager"], ["owner_immutable", "owner cannot be modified"], ["self_role_change", "cannot change your own role"], ["target_disabled", "enabled user"], ["target_missing", "no longer exists"], ["above_manager", "viewer, editor or manager"], ["not_member", "no longer a mailbox member"]]) {
    it(`maps ${code} without using display text as logic`, async () => {
      const { page } = memberPage((url, init) => init?.method === "DELETE" ? response({ ok: false, code }, 403) : undefined);
      await page.findByText("Synthetic Self"); fireEvent.click(within(page.getByText("Synthetic Self").closest("tr")!).getByRole("button", { name: "Remove" }));
      const dialog = within(await page.findByRole("dialog", { name: "Remove member" })); fireEvent.click(dialog.getByRole("button", { name: "Confirm" }));
      expect((await dialog.findByRole("alert")).textContent).toContain(message);
    });
  }
  it("searches capped manager candidates without probing admin APIs", async () => {
    const calls: string[] = [];
    const page = render(<MembersTabContent accountId={account.id} accessRole="manager" apiFetch={async input => {
      const url = String(input); calls.push(url);
      return response(url === "/api/auth/me" ? { ok: true, user: { id: "synthetic-self", role: "user" } } : url.includes("/candidates?") ? { ok: true, candidates: [{ id: "synthetic-add", name: null, email: "add@example.test" }] } : { ok: true, members });
    }} />);
    await page.findByRole("option", { name: /add@example.test/ });
    await waitFor(() => expect((page.getByRole("button", { name: "Search users" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.change(page.getByLabelText("Find users"), { target: { value: " add+tag@example.test " } });
    fireEvent.click(page.getByRole("button", { name: "Search users" }));
    await waitFor(() => expect(calls).toContain("/api/accounts/synthetic-account/members/candidates?q=add%2Btag%40example.test&limit=100"));
    expect(calls.some(url => url.startsWith("/api/admin/"))).toBe(false);
    expect(calls).toContain("/api/auth/me");
  });
  it("does not render or fetch for viewers", () => {
    let fetched = false;
    const page = render(<MembersTabContent accountId={account.id} accessRole="viewer" apiFetch={async () => { fetched = true; return response({}); }} />);
    expect(page.container.textContent).toBe(""); expect(fetched).toBe(false);
  });
});

describe("Preferences tab", () => {
  it("sends only explicitly edited nested keys and null to delete an override", async () => {
    const writes: unknown[] = [];
    const apiFetch: AdminFetch = async (input, init) => {
      if (init?.method === "PUT") { writes.push(JSON.parse(String(init.body))); return response({ ok: true, prefs: { appearance: { topicColorRows: true }, defaultSignatureId: "synthetic-signature" } }); }
      return response({ ok: true, prefs: { appearance: { senderIcons: false, topicColorRows: true }, layout: { defaultView: "table" } } });
    };
    const page = render(<Theme><PreferencesTabContent editingAccount={account} apiFetch={apiFetch} onClose={() => {}} /></Theme>);
    await waitFor(() => expect((page.getByLabelText("Show sender icons") as HTMLSelectElement).value).toBe("false"));
    fireEvent.change(page.getByLabelText("Show sender icons"), { target: { value: "inherit" } });
    fireEvent.change(page.getByLabelText("Default signature"), { target: { value: "synthetic-signature" } });
    fireEvent.click(page.getByRole("button", { name: "Save preferences" })); await page.findByText("Preferences saved.");
    expect(writes).toEqual([{ appearance: { senderIcons: null }, defaultSignatureId: "synthetic-signature" }]);
    expect((page.getByRole("button", { name: "Save preferences" }) as HTMLButtonElement).disabled).toBe(true);
    expect(page.queryByText("Performance")).toBeNull();
  });
  it("supports signature inheritance and every documented UI preference", async () => {
    let patch: unknown;
    const page = render(<Theme><PreferencesTabContent editingAccount={account} onClose={() => {}} apiFetch={async (input, init) => {
      if (init?.method === "PUT") { patch = JSON.parse(String(init.body)); return response({ ok: true, prefs: {} }); }
      return response({ ok: true, prefs: { defaultSignatureId: "synthetic-signature" } });
    }} /></Theme>);
    await waitFor(() => expect((page.getByLabelText("Default signature") as HTMLSelectElement).value).toBe("synthetic-signature"));
    for (const [label, value] of [["Default layout", "compact"], ["Date format", "ymd"], ["Color rows by topic", "false"], ["Show sender icons", "true"], ["Week starts on", "sunday"], ["Include threads across folders", "false"], ["New mail notifications", "true"], ["Default signature", "inherit"]]) fireEvent.change(page.getByLabelText(label), { target: { value } });
    fireEvent.click(page.getByRole("button", { name: "Save preferences" })); await page.findByText("Preferences saved.");
    expect(patch).toEqual({ layout: { defaultView: "compact" }, appearance: { dateFormat: "ymd", topicColorRows: false, senderIcons: true }, calendar: { weekStartsOn: "sunday" }, threading: { includeAcrossFolders: false }, notifications: { newMail: true }, defaultSignatureId: null });
  });
});

describe("settings tab role gating", () => {
  it("allows only the owner/admin to confirm mailbox deletion", async () => {
    let deletes = 0;
    const props = { isOpen: true, manageTab: "account" as const, isExistingAccount: true, onClose: () => {}, onTabChange: () => {}, onSave: () => {}, onDelete: () => { deletes++; } };
    const page = render(<Theme><AccountSettingsModal {...props} editingAccount={account} /></Theme>);
    expect((page.getByRole("button", { name: "Delete Account" }) as HTMLButtonElement).disabled).toBe(true);
    page.rerender(<Theme><AccountSettingsModal {...props} editingAccount={{ ...account, isOwner: true }} /></Theme>);
    fireEvent.click(page.getByRole("button", { name: "Delete Account" }));
    const dialog = within(await page.findByRole("dialog", { name: "Delete mailbox" }));
    expect(deletes).toBe(0); fireEvent.click(dialog.getByRole("button", { name: "Confirm" })); expect(deletes).toBe(1);
  });
  for (const role of ["viewer", "editor", "manager"] as const) it(`gates tabs by sanitized ${role} role even for an instance admin`, async () => {
    const page = render(<Theme><AccountSettingsModal editingAccount={{ ...account, accessRole: role }} isOpen manageTab="account" isExistingAccount isAdminUser onClose={() => {}} onTabChange={() => {}} onSave={() => {}} onDelete={() => {}} apiFetch={async () => response({ ok: true, prefs: {} })} /></Theme>);
    await page.findByRole("tab", { name: "Preferences" });
    for (const name of ["Account", "Signatures", "Calendar", "Translation", "Members"]) expect(Boolean(page.queryByRole("tab", { name }))).toBe(role === "manager");
    expect(Boolean(page.queryByRole("tab", { name: "MCP" }))).toBe(role !== "viewer");
    expect(page.queryByRole("tab", { name: "Admin" })).toBeNull();
    if (role !== "manager") expect(page.getByRole("tab", { name: "Preferences" }).getAttribute("aria-selected")).toBe("true");
  });
});
