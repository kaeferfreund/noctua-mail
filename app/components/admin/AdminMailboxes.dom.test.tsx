import { afterEach, describe, expect, it } from "bun:test";
import { act, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import { render } from "@/lib/i18n/testRender";
import { Theme } from "@radix-ui/themes";
import AdminMailboxes from "./AdminMailboxes";
import type { AdminFetch } from "@/app/hooks/useAdminApi";

afterEach(cleanup);
const owner = { userId: "synthetic/admin", email: "admin@example.test", name: "Synthetic Admin", role: "manager", isOwner: true };
const account = { id: "synthetic/mailbox", name: "Synthetic Shared", email: "shared@example.test", members: [owner] };
function harness(options: { fail?: boolean; accounts?: unknown[] } = {}) {
  const calls: { url: string; init?: RequestInit }[] = [];
  let refreshes = 0;
  const apiFetch: AdminFetch = async (input, init) => {
    const url = String(input); calls.push({ url, init });
    const data = init?.method === "POST" ? options.fail ? { ok: false, message: "Mailbox already exists" } : { ok: true, account } : { ok: true, accounts: options.accounts ?? [account] };
    return new Response(JSON.stringify(data), { status: options.fail && init?.method === "POST" ? 409 : 200, headers: { "Content-Type": "application/json" } });
  };
  const page = render(<Theme><AdminMailboxes apiFetch={apiFetch} users={[]} onAccessChanged={async () => { refreshes++; }} /></Theme>);
  return { page, calls, refreshes: () => refreshes };
}
async function create(page: ReturnType<typeof render>) {
  await page.findByText("Synthetic Shared");
  fireEvent.click(page.getByRole("button", { name: "Create mailbox" }));
  const dialog = within(await page.findByRole("dialog", { name: "Create mailbox" }));
  for (const [label, value] of [["Name", "Synthetic Shared"], ["Email", "shared@example.test"], ["IMAP host", "127.0.0.1"], ["IMAP user", "fixture@example.test"], ["IMAP password", "synthetic-password"], ["SMTP host", "127.0.0.1"], ["SMTP user", "fixture@example.test"], ["SMTP password", "synthetic-password"]]) {
    fireEvent.change(dialog.getByLabelText(label, { exact: true }), { target: { value } });
  }
  await act(async () => { fireEvent.click(dialog.getByRole("button", { name: "Save" })); });
  return dialog;
}
describe("admin mailbox creation and membership scope", () => {
  it("creates the mailbox owned by the creator, refreshes the list and the shell, and closes without a grant step", async () => {
    const { page, calls, refreshes } = harness();
    await create(page);
    await waitFor(() => expect(page.queryByRole("dialog")).toBeNull());
    expect(calls.filter(call => call.init?.method === "POST").map(call => call.url)).toEqual(["/api/admin/accounts"]);
    expect(calls.filter(call => call.init?.method === "PUT")).toHaveLength(0);
    expect(refreshes()).toBe(1);
    expect(calls.filter(call => call.url === "/api/admin/accounts" && !call.init?.method).length).toBe(2);
  });
  it("keeps the dialog open and shows a creation error", async () => {
    const { page, refreshes } = harness({ fail: true }); const dialog = await create(page);
    expect((await dialog.findByRole("alert")).textContent).toContain("Mailbox already exists");
    expect(page.getByRole("dialog", { name: "Create mailbox" })).toBeTruthy();
    expect(refreshes()).toBe(0);
  });
  it("explains the membership scope when the admin is a member of no mailbox", async () => {
    const { page } = harness({ accounts: [] });
    expect(await page.findByText("Only mailboxes you are a member of appear here. You are not a member of any mailbox yet.")).toBeTruthy();
    expect(page.queryByRole("button", { name: "Manage members" })).toBeNull();
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


it("shows loading without an empty-membership notice while the first request is pending", async () => {
  let resolve!: (response: Response) => void;
  const apiFetch: AdminFetch = () => new Promise<Response>(done => { resolve = done; });
  const page = render(<Theme><AdminMailboxes apiFetch={apiFetch} users={[]} /></Theme>);
  expect(page.getByRole("status").textContent).toContain("Loading");
  expect(page.queryByText(/Only mailboxes you are a member of/)).toBeNull();
  await act(async () => { resolve(Response.json({ ok: true, accounts: [] })); });
  expect(await page.findByText(/Only mailboxes you are a member of/)).toBeTruthy();
});
