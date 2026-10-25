import { afterEach, describe, expect, it } from "bun:test";
import { act, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import { render } from "@/lib/i18n/testRender";
import { Theme } from "@radix-ui/themes";
import AdminPanel from "./AdminPanel";
import { nativeControlBaseClass, nativeControlClass } from "@/app/components/account-settings/Field";
import { clientFixture, proof } from "@/app/components/auth/authTestHelpers";
import type { AdminUser } from "./types";
import type { AdminFetch } from "@/app/hooks/useAdminApi";
import { qrCodePath } from "@/app/components/ui/qr-code";
import { inviteSignupUrl } from "@/lib/inviteLink";

afterEach(cleanup);
const user: AdminUser = { id: "synthetic-user", email: "user@example.test", name: "Synthetic User", role: "admin", disabled: false, hasPassword: true, twoFactorEnabled: true, passkeyCount: 2, passkeys: [{ id: "synthetic-key", name: "Synthetic key", createdAt: 1792900000000 }, { id: "synthetic-key-2", name: null, createdAt: null }], accounts: [{ id: "synthetic-mailbox", name: "Support", email: "support@example.test", role: "editor", isOwner: false }] };
const response = (data: unknown, status = 200, headers?: HeadersInit) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...headers } });
function harness(override?: (url: string, init?: RequestInit) => Response | undefined) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const apiFetch: AdminFetch = async (input, init) => {
    const url = String(input); calls.push({ url, init });
    const custom = override?.(url, init); if (custom) return custom;
    if (url === "/api/admin/users") return response({ ok: true, users: [user] });
    if (url === "/api/admin/invites") return response({ ok: true, invites: [{ id: "synthetic-history-id", email: "invited@example.test", issuedBy: "synthetic-issuer", status: "issued", expiresAt: 1793000000000, createdAt: 1792900000000 }] });
    if (url === "/api/auth/reauth") return response({ ok: true, ceremonyRequired: false, grant: "synthetic-proof", purpose: "admin.recovery", expiresAt: 1793000000000 });
    return response({ ok: true });
  };
  const page = render(<Theme><AdminPanel isAdminUser apiFetch={apiFetch} onClose={() => {}} /></Theme>);
  return { page, calls };
}
// The QR code must encode exactly this value (same path as a fresh encoding).
function expectQr(dialog: ReturnType<typeof within>, value: string) {
  const qr = dialog.getByRole("img", { name: "QR code" });
  expect(qr.querySelector("path")?.getAttribute("d")).toBe(qrCodePath(value).d);
}
async function openUserAction(page: ReturnType<typeof render>, name: string, dialog: string) {
  await page.findByText("user@example.test");
  fireEvent.click(page.getByRole("button", { name }));
  return within(await page.findByRole("dialog", { name: dialog }));
}
describe("AdminPanel", () => {
  it("renders target-specific mailbox roles and security summary without an active mailbox", async () => {
    const { page } = harness();
    await page.findByText("Synthetic User");
    expect(page.getByText(/Password: Yes/)).toBeTruthy();
    expect(page.getByText(/TOTP: Yes/)).toBeTruthy();
    expect(page.getByText(/Passkeys: 2/)).toBeTruthy();
    expect(page.getByText("Support · editor")).toBeTruthy();
  });
  it("uses target ownership from the canonical users DTO", async () => {
    const { page } = harness(url => url === "/api/admin/users" ? response({ ok: true, users: [{ ...user, accounts: [{ id: "owned", name: "Owned", email: "owned@example.test", role: "manager", isOwner: true }] }] }) : undefined);
    expect(await page.findByText("Owned · manager · Owner")).toBeTruthy();
  });
  it("issues an email-bound invite, copies it and shows the code only until dismissed", async () => {
    const { page, calls } = harness((url, init) => url === "/api/admin/users" && init?.method === "POST" ? response({ ok: true, invite: { code: "synthetic-once-code" } }, 201) : undefined);
    await page.findByText("Synthetic User"); fireEvent.click(page.getByRole("button", { name: "Invites" }));
    await page.findByText(/Issued by synthetic-issuer/);
    expect(page.getByText(/invited@example.test · issued/)).toBeTruthy();
    fireEvent.change(page.getByLabelText("Name", { exact: true }), { target: { value: "Synthetic Invitee" } });
    fireEvent.change(page.getByLabelText("Email", { exact: true }), { target: { value: "invited@example.test" } });
    fireEvent.click(page.getByRole("button", { name: "Issue targeted invite" }));
    const secret = within(await page.findByRole("dialog", { name: "One-time invite code" }));
    expect(secret.getByText("synthetic-once-code")).toBeTruthy();
    expectQr(secret, inviteSignupUrl(window.location.origin, "synthetic-once-code"));
    expect(secret.getByText("Scan with a phone to open the sign-up with this code.")).toBeTruthy();
    const issued = calls.find(call => call.init?.method === "POST" && call.url === "/api/admin/users");
    expect(JSON.parse(String(issued?.init?.body))).toEqual({ name: "Synthetic Invitee", email: "invited@example.test", role: "user" });
    const original = navigator.clipboard;
    let copied = "";
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (value: string) => { copied = value; } } });
    try { await act(async () => { fireEvent.click(secret.getByRole("button", { name: "Copy" })); }); expect(copied).toBe("synthetic-once-code"); }
    finally { Object.defineProperty(navigator, "clipboard", { configurable: true, value: original }); }
    fireEvent.click(secret.getByRole("button", { name: "Done" }));
    expect(page.queryByText("synthetic-once-code")).toBeNull(); expect(page.queryByText("synthetic-history-secret")).toBeNull();
    fireEvent.click(page.getByRole("button", { name: "Users" })); await act(async () => { fireEvent.click(page.getByRole("button", { name: "Invites" })); });
    expect(page.queryByText("synthetic-once-code")).toBeNull();
  });
  it("shows the invite issuer by label, cleans up the history after confirmation and revokes an issued invite", async () => {
    let history = [
      { id: "synthetic-issued", email: "issued@example.test", issuedBy: "Synthetic Issuer", issuerDeleted: false, status: "issued", expiresAt: 1793000000000, createdAt: 1792900000000 },
      { id: "synthetic-legacy", email: null, issuedBy: null, issuerDeleted: false, status: "redeemed", expiresAt: null, createdAt: 1792800000000 },
      { id: "synthetic-orphan", email: "orphan@example.test", issuedBy: null, issuerDeleted: true, status: "expired", expiresAt: 1792700000000, createdAt: 1792600000000 }
    ];
    const { page, calls } = harness((url, init) => {
      if (url === "/api/admin/invites" && init?.method === "DELETE") { history = history.filter(invite => invite.status === "issued"); return response({ ok: true, deleted: 2 }); }
      if (url.endsWith("/revoke")) { history = history.map(invite => ({ ...invite, status: "revoked" })); return response({ ok: true }); }
      return url === "/api/admin/invites" ? response({ ok: true, invites: history }) : undefined;
    });
    await page.findByText("Synthetic User"); fireEvent.click(page.getByRole("button", { name: "Invites" }));
    expect(await page.findByText(/issued@example.test · issued · Issued by Synthetic Issuer/)).toBeTruthy();
    expect(page.getByText(/Legacy invite · redeemed · Issued by Operator · No expiry/)).toBeTruthy();
    expect(page.getByText(/orphan@example.test · expired · Issued by deleted user/)).toBeTruthy();
    expect(page.getAllByRole("button", { name: /^Revoke invite for/ }).map(button => button.getAttribute("aria-label"))).toEqual(["Revoke invite for issued@example.test"]);

    fireEvent.click(page.getByRole("button", { name: "Clean up history" }));
    const cleanup = within(await page.findByRole("dialog", { name: "Clean up history" }));
    expect(cleanup.getByText(/Issued invites that are still valid stay valid/)).toBeTruthy();
    expect(calls.some(call => call.init?.method === "DELETE")).toBe(false);
    await act(async () => { fireEvent.click(cleanup.getByRole("button", { name: "Confirm" })); });
    expect(await page.findByRole("status")).toBeTruthy();
    expect(page.getByRole("status").textContent).toBe("2 entries deleted.");
    expect(calls.find(call => call.init?.method === "DELETE")?.url).toBe("/api/admin/invites");
    await waitFor(() => expect(page.queryByText(/Legacy invite/)).toBeNull());
    expect(page.getByText(/issued@example.test · issued/)).toBeTruthy();

    fireEvent.click(page.getByRole("button", { name: "Revoke invite for issued@example.test" }));
    const revoke = within(await page.findByRole("dialog", { name: "Revoke invite" }));
    expect(revoke.getByText("The code for issued@example.test can no longer be redeemed afterwards.")).toBeTruthy();
    await act(async () => { fireEvent.click(revoke.getByRole("button", { name: "Confirm" })); });
    await waitFor(() => expect(page.getByText(/issued@example.test · revoked/)).toBeTruthy());
    expect(calls.find(call => call.url.endsWith("/revoke"))).toMatchObject({ url: "/api/admin/invites/synthetic-issued/revoke", init: { method: "POST" } });
    expect(page.queryByRole("button", { name: /^Revoke invite for/ })).toBeNull();
  });
  it("requires disable confirmation and maps a 409 last_admin error inline", async () => {
    const { page, calls } = harness((url, init) => init?.method === "PATCH" ? response({ ok: false, code: "last_admin" }, 409) : undefined);
    const dialog = await openUserAction(page, "Disable", "Change user status");
    expect(calls.filter(call => call.init?.method === "PATCH")).toHaveLength(0);
    fireEvent.click(dialog.getByRole("button", { name: "Confirm" }));
    await dialog.findByRole("alert");
    expect(dialog.getByRole("alert").textContent).toContain("last enabled administrator");
    expect(JSON.parse(String(calls.find(call => call.init?.method === "PATCH")?.init?.body))).toEqual({ disabled: true });
  });
  it("verifies out-of-band identity, obtains purpose-bound proof and shows a recovery link once", async () => {
    const { page, calls } = harness(url => url.endsWith("/recovery") ? response({ ok: true, url: "https://mail.example.test/reset?token=synthetic-reset" }) : undefined);
    const dialog = await openUserAction(page, "Recovery", "Initiate recovery");
    expect((dialog.getByRole("button", { name: "Confirm" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(dialog.getByRole("checkbox"));
    fireEvent.click(dialog.getByRole("button", { name: "Confirm" }));
    const reauth = within(await page.findByRole("dialog", { name: "Verify your identity" }));
    fireEvent.change(reauth.getByLabelText("Current password"), { target: { value: "synthetic-password" } });
    fireEvent.change(reauth.getByLabelText("Authenticator code"), { target: { value: "123456" } });
    fireEvent.click(reauth.getByRole("button", { name: "Verify and continue" }));
    const secret = within(await page.findByRole("dialog", { name: "One-time recovery link" }));
    expect(secret.getByText(/synthetic-reset/)).toBeTruthy();
    expectQr(secret, "https://mail.example.test/reset?token=synthetic-reset");
    const proof = calls.find(call => call.url === "/api/auth/reauth");
    expect(JSON.parse(String(proof?.init?.body))).toEqual({ purpose: "admin.recovery", currentPassword: "synthetic-password", totpCode: "123456" });
    const recovery = calls.find(call => call.url.endsWith("/recovery"));
    expect(new Headers(recovery?.init?.headers).get("x-noctua-reauth")).toBe("synthetic-proof");
    expect(JSON.parse(String(recovery?.init?.body))).toEqual({ confirmedTarget: true });
    fireEvent.click(secret.getByRole("button", { name: "Done" })); expect(page.queryByText(/synthetic-reset/)).toBeNull();
    fireEvent.click(page.getByRole("button", { name: "Invites" })); fireEvent.click(page.getByRole("button", { name: "Users" }));
    expect(page.queryByText(/synthetic-reset/)).toBeNull();
  });
  it("shows Retry-After on 429", async () => {
    const { page } = harness((url, init) => init?.method === "PATCH" ? response({ ok: false, code: "admin_rate_limited" }, 429, { "Retry-After": "75" }) : undefined);
    const dialog = await openUserAction(page, "Disable", "Change user status"); fireEvent.click(dialog.getByRole("button", { name: "Confirm" }));
    expect((await dialog.findByRole("alert")).textContent).toContain("Retry after 75 seconds");
  });
  it("pages equal-timestamp audit entries with the opaque nextCursor", async () => {
    const entries = Array.from({ length: 50 }, (_, index) => ({ id: `synthetic-audit-${index}`, actorUserId: "synthetic-actor", targetUserId: "synthetic-target", targetAccountId: null, action: "user.disable", createdAt: 1792900000000 }));
    const { page, calls } = harness(url => url.startsWith("/api/admin/audit?") ? response({ ok: true, entries: url.includes("before=") ? [{ ...entries[0], id: "synthetic-older", action: "user.enable", createdAt: 1792890000000 }] : entries, nextCursor: url.includes("before=") ? null : "synthetic+/opaque=cursor" }) : undefined);
    await page.findByText("Synthetic User"); fireEvent.click(page.getByRole("button", { name: "Audit" }));
    await waitFor(() => expect(page.getAllByText("user.disable")).toHaveLength(50));
    fireEvent.click(page.getByRole("button", { name: "Load older entries" })); await page.findByText("user.enable");
    expect(calls.some(call => call.url === `/api/admin/audit?limit=50&before=${encodeURIComponent("synthetic+/opaque=cursor")}`)).toBe(true);
    expect((page.getByRole("button", { name: "Load older entries" }) as HTMLButtonElement).disabled).toBe(true);
  });
  it("requires an enabled successor before deleting an owner", async () => {
    const { page, calls } = harness((url, init) => url === "/api/admin/users" ? response({ ok: true, users: [
      { ...user, accounts: [{ id: "owned", name: "Owned", email: "owned@example.test", role: "manager", isOwner: true }] },
      { id: "synthetic-successor", email: "successor@example.test", role: "user", disabled: false, accounts: [] }
    ] }) : undefined);
    await page.findByText("user@example.test");
    fireEvent.click(within(page.getByText("user@example.test").closest("tr")!).getByRole("button", { name: "Delete user" }));
    const dialog = within(await page.findByRole("dialog", { name: "Delete user" }));
    expect((dialog.getByRole("button", { name: "Confirm" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(dialog.getByLabelText("Reassign owned mailboxes to"), { target: { value: "synthetic-successor" } });
    fireEvent.click(dialog.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(calls.filter(call => call.init?.method === "DELETE")).toHaveLength(1));
    expect(JSON.parse(String(calls.find(call => call.init?.method === "DELETE")?.init?.body))).toEqual({ reassignOwnerTo: "synthetic-successor" });
  });
  it("explains inline why a user with memberships in mailboxes the admin cannot see is not deleted", async () => {
    const { page } = harness((url, init) => init?.method === "DELETE" ? response({ ok: false, code: "foreign_mailbox_membership" }, 409) : undefined);
    await page.findByText("user@example.test");
    fireEvent.click(page.getByRole("button", { name: "Delete user" }));
    const dialog = within(await page.findByRole("dialog", { name: "Delete user" }));
    fireEvent.click(dialog.getByRole("button", { name: "Confirm" }));
    expect((await dialog.findByRole("alert")).textContent).toBe("This user belongs to mailboxes you are not a member of and cannot see. Only an administrator who is a member of all of their mailboxes can delete them.");
  });
  for (const [button, title, suffix] of [["Revoke sessions", "Revoke sessions", "/sessions"], ["Reset MFA", "Reset MFA", "/mfa-reset"], ["Remove passkey", "Remove passkey", "/passkeys/synthetic-key"]]) {
    it(`uses an audited Noctua wrapper and fresh proof for ${title}`, async () => {
      const { page, calls } = harness();
      const dialog = await openUserAction(page, button, title);
      if (suffix === "/mfa-reset") fireEvent.click(dialog.getByRole("checkbox"));
      if (suffix.includes("passkeys")) fireEvent.change(dialog.getByLabelText("Passkey", { exact: true }), { target: { value: "synthetic-key" } });
      fireEvent.click(dialog.getByRole("button", { name: "Confirm" }));
    const reauth = within(await page.findByRole("dialog", { name: "Verify your identity" }));
    fireEvent.change(reauth.getByLabelText("Current password"), { target: { value: "synthetic-password" } });
      fireEvent.change(reauth.getByLabelText("Authenticator code"), { target: { value: "123456" } });
      fireEvent.click(reauth.getByRole("button", { name: "Verify and continue" }));
      await waitFor(() => expect(calls.some(call => call.url.endsWith(suffix))).toBe(true));
      const mutation = calls.find(call => call.url.endsWith(suffix))!;
      expect(new Headers(mutation.init?.headers).get("x-noctua-reauth")).toBe("synthetic-proof");
      expect(mutation.init?.method).toBe(suffix === "/mfa-reset" ? "POST" : "DELETE");
      if (suffix !== "/mfa-reset") expect(mutation.init?.body).toBeUndefined();
      await waitFor(() => expect(page.queryByRole("dialog", { name: title })).toBeNull());
    });
  }
  it("uses the final password-plus-UV grant for admin recovery", async () => {
    const { client, calls: proofCalls } = clientFixture(() => response({ ...proof, purpose: "admin.recovery", ceremonyRequired: true }));
    client.passkeySignIn = async options => {
      expect(options?.proof?.purpose).toBe("admin.recovery");
      return { ...proof, purpose: "admin.recovery", grant: "synthetic-final-admin-grant" };
    };
    let used = "";
    const page = render(<Theme><AdminPanel isAdminUser client={client} onClose={() => {}} apiFetch={async (input, init) => {
      if (String(input).endsWith("/sessions")) used = new Headers(init?.headers).get("x-noctua-reauth") ?? "";
      return response({ ok: true, users: [user] });
    }} /></Theme>);
    const dialog = await openUserAction(page, "Revoke sessions", "Revoke sessions");
    fireEvent.click(dialog.getByRole("button", { name: "Confirm" }));
    const reauth = within(await page.findByRole("dialog", { name: "Verify your identity" }));
    fireEvent.click(reauth.getByText("Verify with a passkey"));
    fireEvent.change(reauth.getByLabelText("Current password"), { target: { value: "synthetic-password" } });
    fireEvent.click(reauth.getByRole("button", { name: "Verify and continue" }));
    await waitFor(() => expect(used).toBe("synthetic-final-admin-grant"));
    expect(proofCalls[0].body).toEqual({ purpose: "admin.recovery", currentPassword: "synthetic-password", proofMode: "passkey" });
  });
  it("styles every admin select with the shared settings control classes", async () => {
    const { page } = harness();
    await page.findByText("user@example.test");
    expect(page.getByLabelText("Role for user@example.test").className).toBe(nativeControlBaseClass);
    fireEvent.click(within(page.getByText("user@example.test").closest("tr")!).getByRole("button", { name: "Delete user" }));
    expect((await page.findByRole("dialog", { name: "Delete user" })).querySelector("select")!.className).toBe(nativeControlClass);
    fireEvent.click(page.getByRole("button", { name: "Cancel" }));
    fireEvent.click(page.getByRole("button", { name: "Remove passkey" }));
    expect((await page.findByRole("dialog", { name: "Remove passkey" })).querySelector("select")!.className).toBe(nativeControlClass);
    fireEvent.click(page.getByRole("button", { name: "Cancel" }));
    fireEvent.click(page.getByRole("button", { name: "Invites" }));
    expect((await page.findByLabelText("Invite role")).className).toBe(nativeControlClass);
  });
  it("does not fetch or render for a non-admin", () => {
    let fetched = false;
    const page = render(<AdminPanel isAdminUser={false} apiFetch={async () => { fetched = true; return response({}); }} onClose={() => {}} />);
    expect(page.container.textContent).toBe(""); expect(fetched).toBe(false);
  });
});
