import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent } from "@testing-library/react";
import { render } from "@/lib/i18n/testRender";
import type { Account } from "@/lib/data";
import MailboxGate from "./MailboxGate";
afterEach(cleanup);
const noop = () => {};
describe("MailboxGate", () => {
  it("offers add-mailbox, admin and security without a mailbox", () => {
    const actions: string[] = [];
    const view = render(<MailboxGate state="none" accounts={[]} onAdd={() => actions.push("add")} onSwitch={noop} onRetry={noop} onSecurity={() => actions.push("security")} onAdmin={() => actions.push("admin")} onLogout={noop} />);
    expect(view.getByRole("heading", { name: "No mailbox yet" })).toBeTruthy();
    expect(view.getByText(/grant its members access/)).toBeTruthy();
    for (const name of ["Add a mailbox", "Profile & security", "Admin"]) fireEvent.click(view.getByRole("button", { name }));
    expect(actions).toEqual(["add", "security", "admin"]);
  });
  it("shows Ask your admin without creation for a non-admin", () => {
    const view = render(<MailboxGate state="none" accounts={[]} onSwitch={noop} onRetry={noop} onSecurity={noop} onLogout={noop} />);
    expect(view.getByText(/Ask your admin/)).toBeTruthy();
    expect(view.queryByRole("button", { name: "Add a mailbox" })).toBeNull();
    expect(view.queryByRole("button", { name: "Admin" })).toBeNull();
  });
  it("offers explicit selection and retry with email labels for an unselected session", () => {
    let selected = "";
    const view = render(<MailboxGate state="unselected" accounts={[{ id: "synthetic-mailbox", name: "Synthetic", email: "mail@example.test" } as Account]} error="Selection failed" onAdd={noop} onSwitch={id => { selected = id; }} onRetry={noop} onSecurity={noop} onLogout={noop} />);
    fireEvent.click(view.getByRole("button", { name: "Synthetic · mail@example.test" }));
    expect(selected).toBe("synthetic-mailbox"); expect(view.getByRole("alert").textContent).toBe("Selection failed");
  });
});
