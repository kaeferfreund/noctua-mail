import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import type { Account } from "@/lib/data";
import AccountReloginDialog from "./AccountReloginDialog";
afterEach(cleanup);
const account = { id: "synthetic-mailbox", name: "Synthetic", email: "mail@example.test", accessRole: "manager", imap: { user: "mail@example.test" } } as Account;
describe("mailbox credential repair roles", () => {
  it("offers managers repair and closes immediately on a live downgrade", async () => {
    const requests: string[] = [];
    const props = { open: true, account, onOpenChange: () => {}, readErrorMessage: async () => "Repair failed", apiFetch: async (input: RequestInfo | URL) => { requests.push(String(input)); return Response.json({ code: "mailbox_credentials_invalid" }, { status: 503 }); } };
    const view = render(<AccountReloginDialog {...props} />);
    fireEvent.change(view.getByLabelText("IMAP password"), { target: { value: "synthetic-mailbox-password" } });
    fireEvent.submit(view.getByLabelText("IMAP password").closest("form")!);
    await waitFor(() => expect(view.getByRole("alert").textContent).toBe("Repair failed"));
    expect(requests).toEqual(["/api/accounts/synthetic-mailbox/relogin"]);
    view.rerender(<AccountReloginDialog {...props} account={{ ...account, accessRole: "viewer" }} />);
    expect(view.queryByRole("dialog")).toBeNull();
  });
  for (const role of ["viewer", "editor"] as const) it(`never exposes credentials or a relogin request for ${role}`, () => {
    const view = render(<AccountReloginDialog open account={{ ...account, accessRole: role }} onOpenChange={() => {}} apiFetch={async () => { throw new Error("Must not request repair"); }} readErrorMessage={async () => ""} />);
    expect(view.queryByLabelText("IMAP password")).toBeNull();
  });
});
