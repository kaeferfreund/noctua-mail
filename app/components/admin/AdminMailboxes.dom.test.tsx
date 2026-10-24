import { afterEach, describe, expect, it } from "bun:test";
import { act, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import { render } from "@/lib/i18n/testRender";
import { Theme } from "@radix-ui/themes";
import AdminMailboxes from "./AdminMailboxes";
import type { AdminFetch } from "@/app/hooks/useAdminApi";

afterEach(cleanup);
const account = { id: "synthetic/mailbox", name: "Synthetic Shared", email: "shared@example.test", members: [] };
function harness(fail = false) {
  const calls: { url: string; init?: RequestInit }[] = [];
  let refreshes = 0;
  const apiFetch: AdminFetch = async (input, init) => {
    const url = String(input); calls.push({ url, init });
    const data = init?.method === "POST" ? { ok: true, account } : init?.method === "PUT" ? fail ? { ok: false, code: "target_disabled" } : { ok: true } : { ok: true, accounts: [account] };
    return new Response(JSON.stringify(data), { status: fail && init?.method === "PUT" ? 409 : 200, headers: { "Content-Type": "application/json" } });
  };
  const page = render(<Theme><AdminMailboxes apiFetch={apiFetch} users={[]} currentUserId="synthetic/admin" onAccessChanged={async () => { refreshes++; }} /></Theme>);
  return { page, calls, refreshes: () => refreshes };
}
async function create(page: ReturnType<typeof render>) {
  await page.findByText("Synthetic Shared");
  fireEvent.click(page.getByRole("button", { name: "Create mailbox" }));
  const dialog = within(await page.findByRole("dialog", { name: "Create mailbox" }));
  for (const [label, value] of [["Name", "Synthetic Shared"], ["Email", "shared@example.test"], ["IMAP host", "127.0.0.1"], ["IMAP user", "fixture@example.test"], ["IMAP password", "synthetic-password"], ["SMTP host", "127.0.0.1"], ["SMTP user", "fixture@example.test"], ["SMTP password", "synthetic-password"]]) {
    fireEvent.change(dialog.getByLabelText(label, { exact: true }), { target: { value } });
  }
  fireEvent.click(dialog.getByRole("button", { name: "Save" }));
  return within(await page.findByRole("dialog", { name: "Give yourself access?" }));
}
describe("admin mailbox explicit self-grant", () => {
  for (const role of ["manager", "editor", "viewer"]) it(`grants the current user the chosen ${role} role and refreshes access`, async () => {
    const { page, calls, refreshes } = harness();
    const dialog = await create(page);
    expect((dialog.getByLabelText("Role") as HTMLSelectElement).value).toBe("manager");
    expect(calls.filter(call => call.init?.method === "PUT")).toHaveLength(0);
    fireEvent.change(dialog.getByLabelText("Role"), { target: { value: role } });
    await act(async () => { fireEvent.click(dialog.getByRole("button", { name: "Grant access" })); });
    await waitFor(() => expect(page.queryByRole("dialog")).toBeNull());
    const grant = calls.find(call => call.init?.method === "PUT");
    expect(grant?.url).toBe("/api/admin/accounts/synthetic%2Fmailbox/members/synthetic%2Fadmin");
    expect(JSON.parse(String(grant?.init?.body))).toEqual({ role });
    expect(refreshes()).toBe(1);
    expect(calls.filter(call => call.url === "/api/admin/accounts" && !call.init?.method).length).toBe(3);
  });
  it("Later closes without granting access", async () => {
    const { page, calls, refreshes } = harness(); const dialog = await create(page);
    fireEvent.click(dialog.getByRole("button", { name: "Later" }));
    await waitFor(() => expect(page.queryByRole("dialog")).toBeNull());
    expect(calls.filter(call => call.init?.method === "PUT")).toHaveLength(0); expect(refreshes()).toBe(0);
  });
  it("keeps the follow-up open and shows a route error", async () => {
    const { page, calls, refreshes } = harness(true); const dialog = await create(page);
    await act(async () => { fireEvent.click(dialog.getByRole("button", { name: "Grant access" })); });
    expect((await dialog.findByRole("alert")).textContent).toContain("Choose an enabled user");
    expect(page.getByRole("dialog", { name: "Give yourself access?" })).toBeTruthy();
    expect(calls.filter(call => call.init?.method === "POST")).toHaveLength(1); expect(refreshes()).toBe(0);
  });
  it("shows an empty mailbox hint and opens its members editor", async () => {
    const { page } = harness(); await page.findByText("No members yet – nobody can see this mailbox");
    fireEvent.click(page.getByRole("button", { name: "Manage members" }));
    expect(await page.findByRole("dialog", { name: "Members of shared@example.test" })).toBeTruthy();
  });
  it("renders the portalled members editor inside a Radix theme so its table card resolves the theme tokens", async () => {
    const { page } = harness(); await page.findByText("Synthetic Shared");
    fireEvent.click(page.getByRole("button", { name: "Manage members" }));
    const dialog = await page.findByRole("dialog", { name: "Members of shared@example.test" });
    const theme = dialog.querySelector("[data-members-table]")?.closest(".radix-themes");
    expect(theme).toBeTruthy();
    expect(dialog.contains(theme!)).toBe(true);
  });
});
