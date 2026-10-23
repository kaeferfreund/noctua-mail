import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, waitFor } from "@testing-library/react";
import { render } from "@/lib/i18n/testRender";
import SecuritySettings from "./SecuritySettings";
import { clientFixture, proof, securityInfo } from "./authTestHelpers";

afterEach(cleanup);
async function verify(view: ReturnType<typeof render>) {
  const password = await view.findByLabelText("Current password");
  fireEvent.change(password, { target: { value: "synthetic-password" } });
  fireEvent.change(view.getByLabelText("Authenticator code"), { target: { value: "123456" } });
  fireEvent.submit(password.closest("form")!);
}
function fixture(status = 200) {
  let purpose = proof.purpose;
  return clientFixture((path, body) => {
    if (path === "/api/auth/security") return Response.json(securityInfo);
    if (path.endsWith("/reauth")) { purpose = body.purpose as typeof purpose; return Response.json({ ...proof, purpose }); }
    if (status !== 200) return Response.json({ code: "invalid_proof" }, { status, headers: { "Retry-After": "120" } });
    return Response.json(path.endsWith("backup-codes") ? { ok: true, backupCodes: ["synthetic-new-code"] } : { ok: true });
  });
}
describe("SecuritySettings", () => {
  it("loads without a mailbox, validates password confirmation, then requires fresh proof for password change", async () => {
    const { client, calls } = fixture();
    const view = render(<SecuritySettings client={client} onUnauthorized={() => {}} />);
    const password = await view.findByLabelText("New password");
    fireEvent.change(password, { target: { value: "synthetic-new-password" } });
    fireEvent.change(view.getByLabelText("Confirm new password"), { target: { value: "mismatch" } });
    fireEvent.submit(password.closest("form")!);
    expect(view.getByRole("alert").textContent).toContain("do not match");
    fireEvent.change(view.getByLabelText("Confirm new password"), { target: { value: "synthetic-new-password" } });
    fireEvent.submit(password.closest("form")!); await verify(view);
    await view.findByText("Password changed. Other sessions were signed out.");
    expect(calls.find(call => call.path.endsWith("/password"))?.body).toEqual({ currentPassword: "synthetic-password", newPassword: "synthetic-new-password" });
  });
  for (const [button, path, body] of [
    ["Regenerate backup codes", "backup-codes", { currentPassword: "synthetic-password" }],
    ["Revoke session", "sessions/revoke", { sessionId: "synthetic-other" }],
    ["Sign out other sessions", "sessions/revoke", { all: true }],
    ["Remove passkey", "passkeys/remove", { passkeyId: "synthetic-key" }]
  ] as const) it(`requires one-use proof for ${button}`, async () => {
    const { client, calls } = fixture();
    const view = render(<SecuritySettings client={client} onUnauthorized={() => {}} />);
    fireEvent.click(await view.findByText(button));
    expect(calls.some(call => call.path.endsWith(path))).toBe(false);
    await verify(view);
    await waitFor(() => expect(calls.find(call => call.path.endsWith(path))?.body).toEqual(body));
    const mutation = calls.find(call => call.path.endsWith(path))!;
    expect(new Headers(mutation.init?.headers).get("x-noctua-reauth")).toBe(proof.grant);
    if (button === "Regenerate backup codes") { await view.findByText("synthetic-new-code"); fireEvent.click(view.getByText("I saved my backup codes")); expect(view.queryByText("synthetic-new-code")).toBeNull(); }
  });
  it("renames through the wrapper and adds through the passkey client after proof", async () => {
    const { client, calls } = fixture(); let enrolled = "";
    client.addPasskey = async (name, grant) => { enrolled = name; expect(grant.purpose).toBe("passkey.enroll"); };
    const view = render(<SecuritySettings client={client} onUnauthorized={() => {}} />);
    const name = await view.findByLabelText("Passkey name (Synthetic key)");
    fireEvent.change(name, { target: { value: "Synthetic renamed key" } }); fireEvent.submit(name.closest("form")!); await verify(view);
    await waitFor(() => expect(calls.find(call => call.path.endsWith("rename"))?.body).toEqual({ passkeyId: "synthetic-key", name: "Synthetic renamed key" }));
    await waitFor(() => expect(view.queryByRole("dialog")).toBeNull());
    fireEvent.change(view.getByLabelText("New passkey name"), { target: { value: "Synthetic new key" } });
    fireEvent.click(view.getByText("Add passkey")); await verify(view);
    await waitFor(() => expect(enrolled).toBe("Synthetic new key"));
  });
  for (const status of [401, 403, 429]) it(`keeps ${status} mutation errors inline; only 401 ends the session`, async () => {
    const { client } = fixture(status); let loggedOut = 0;
    const view = render(<SecuritySettings client={client} onUnauthorized={() => { loggedOut++; }} />);
    fireEvent.click(await view.findByText("Remove passkey")); await verify(view);
    await waitFor(() => expect(view.getByRole("alert").textContent).toContain(status === 429 ? "120 seconds" : status === 401 ? "session ended" : "incorrect"));
    expect(loggedOut).toBe(status === 401 ? 1 : 0);
  });
});
