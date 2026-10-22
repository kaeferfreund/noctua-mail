// @ts-expect-error -- Bun test declarations are not installed in this repository.
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { StrictMode } from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import ResetPasswordPage from "./page";
import ResetPasswordForm from "@/app/components/auth/ResetPasswordForm";
import { clientFixture } from "@/app/components/auth/authTestHelpers";

const dom = window as unknown as { happyDOM: { setURL: (url: string) => void } };
const originalUrl = window.location.href;
beforeEach(() => { dom.happyDOM.setURL("http://localhost:3791/reset-password"); });
afterEach(() => { cleanup(); dom.happyDOM.setURL(originalUrl); });
function fill(view: ReturnType<typeof render>, confirmation = "synthetic-new-password") {
  fireEvent.change(view.getByLabelText("New password"), { target: { value: "synthetic-new-password" } });
  fireEvent.change(view.getByLabelText("Confirm new password"), { target: { value: confirmation } });
  fireEvent.submit(view.getByLabelText("New password").closest("form")!);
}
describe("public reset-password page", () => {
  for (const query of ["", "?error=INVALID_TOKEN"]) it(`shows a missing/expired/reused link without login (${query})`, () => {
    window.history.replaceState(null, "", `/reset-password${query}`);
    const view = render(<ResetPasswordPage />);
    expect(view.getByRole("alert").textContent).toContain("missing, expired or already used");
    expect(window.location.search).toBe("");
  });
  it("clears history immediately, validates confirmation and redeems once without a session, even under StrictMode", async () => {
    window.history.replaceState(null, "", "/reset-password?token=synthetic-reset-token");
    const { client, calls } = clientFixture(() => Response.json({ status: true }));
    const view = render(<StrictMode><ResetPasswordForm client={client} /></StrictMode>);
    expect(window.location.pathname + window.location.search).toBe("/reset-password");
    fill(view, "mismatch"); expect(view.getByRole("alert").textContent).toContain("do not match"); expect(calls).toHaveLength(0);
    fill(view); await view.findByText("Your password has changed. Sign in with your new password and existing authenticator.");
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toEqual({ token: "synthetic-reset-token", newPassword: "synthetic-new-password" });
    expect(view.queryByLabelText("New password")).toBeNull();
    expect(view.getByText("Return to sign in").getAttribute("href")).toBe("/");
  });
  for (const status of [400, 401, 429, 503]) it(`handles ${status} reset redemption`, async () => {
    window.history.replaceState(null, "", "/reset-password?token=synthetic-reset-token");
    const { client, calls } = clientFixture(() => Response.json({ code: status === 400 ? "INVALID_TOKEN" : "request_failed" }, { status }));
    const view = render(<ResetPasswordForm client={client} />); fill(view);
    await waitFor(() => expect(view.getByRole("alert").textContent).toContain(status === 400 ? "missing, expired or already used" : status === 429 ? "60 seconds" : status === 503 ? "may already be active" : "session ended"));
    expect(calls).toHaveLength(1);
    if (status === 503 || status === 400) expect(view.queryByText("Change password", { exact: true })).toBeNull();
  });
});
