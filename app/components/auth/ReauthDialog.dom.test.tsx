// @ts-expect-error -- Bun test declarations are not installed in this repository.
import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import ReauthDialog from "./ReauthDialog";
import { clientFixture, proof } from "./authTestHelpers";

afterEach(cleanup);
describe("ReauthDialog", () => {
  for (const status of [401, 403, 429]) it(`keeps ${status} proof failure local and never calls the mutation`, async () => {
    let mutations = 0;
    const { client } = clientFixture(() => Response.json({ code: "invalid_proof" }, { status }));
    const view = render(<ReauthDialog client={client} purpose="password.change" onCancel={() => {}} onVerified={async () => { mutations++; }} />);
    fireEvent.change(view.getByLabelText("Current password"), { target: { value: "synthetic-password" } });
    fireEvent.change(view.getByLabelText("Authenticator code"), { target: { value: "123456" } });
    fireEvent.submit(view.getByLabelText("Current password").closest("form")!);
    await waitFor(() => expect(view.getByRole("alert").textContent).toContain(status === 429 ? "60 seconds" : status === 401 ? "session ended" : "incorrect"));
    expect(mutations).toBe(0);
  });
  it("password+UV retains the credential prompt and spends only the final rotated-session grant", async () => {
    const intent = { ...proof, purpose: "password.change" as const, ceremonyRequired: true };
    const { client, calls } = clientFixture(() => Response.json(intent));
    client.passkeySignIn = async ({ proof: sent } = {}) => { expect(sent).toEqual(intent); return { ...intent, grant: "synthetic-final-grant", ceremonyRequired: false }; };
    let used = "";
    const view = render(<ReauthDialog client={client} purpose="password.change" onCancel={() => {}} onVerified={async (final, password) => { used = final.grant; expect(password).toBe("synthetic-password"); }} />);
    fireEvent.click(view.getByText("Verify with a passkey"));
    expect(view.getByLabelText("Current password")).toBeTruthy();
    expect(view.queryByLabelText("Authenticator code")).toBeNull();
    fireEvent.change(view.getByLabelText("Current password"), { target: { value: "synthetic-password" } });
    fireEvent.submit(view.getByLabelText("Current password").closest("form")!);
    await waitFor(() => expect(used).toBe("synthetic-final-grant"));
    expect(calls[0].body).toEqual({ purpose: "password.change", currentPassword: "synthetic-password", proofMode: "passkey" });
  });
  it("allows passkey-only rename proof without a password", async () => {
    const { client } = clientFixture(() => Response.json({ ...proof, purpose: "passkey.rename", ceremonyRequired: true }));
    client.passkeySignIn = async () => ({ ...proof, purpose: "passkey.rename", ceremonyRequired: false });
    let done = false;
    const view = render(<ReauthDialog client={client} purpose="passkey.rename" onCancel={() => {}} onVerified={async () => { done = true; }} />);
    fireEvent.click(view.getByText("Verify with a passkey"));
    expect(view.queryByLabelText("Current password")).toBeNull();
    fireEvent.click(view.getByText("Verify and continue"));
    await waitFor(() => expect(done).toBe(true));
  });
});
