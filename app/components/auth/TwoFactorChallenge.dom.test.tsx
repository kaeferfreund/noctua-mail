import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import TwoFactorChallenge from "./TwoFactorChallenge";
import { clientFixture, proof } from "./authTestHelpers";

afterEach(cleanup);
describe("TwoFactorChallenge", () => {
  for (const [status, code, expected] of [[400, "INVALID_CODE", "incorrect"], [401, "Unauthorized", "session ended"], [429, "proof_rate_limited", "60 seconds"]] as const) it(`keeps ${status} challenge failure inline`, async () => {
    const { client } = clientFixture(() => Response.json({ code }, { status }));
    const view = render(<TwoFactorChallenge client={client} onAuthenticated={() => { throw new Error("Unexpected success"); }} onBack={() => {}} />);
    fireEvent.change(view.getByLabelText("Authenticator code"), { target: { value: "123456" } });
    fireEvent.submit(view.getByLabelText("Authenticator code").closest("form")!);
    await waitFor(() => expect(view.getByRole("alert").textContent).toContain(expected));
    expect(view.getByLabelText("Authenticator code")).toBeTruthy();
  });
  it("verifies TOTP without trust-device flags", async () => {
    let done = 0;
    const { client, calls } = clientFixture();
    const view = render(<TwoFactorChallenge client={client} onAuthenticated={() => { done++; }} onBack={() => {}} />);
    fireEvent.change(view.getByLabelText("Authenticator code"), { target: { value: "123456" } });
    fireEvent.submit(view.getByLabelText("Authenticator code").closest("form")!);
    await waitFor(() => expect(done).toBe(1));
    expect(calls[0].body).toEqual({ code: "123456" });
  });
  it("backup login consumes code A; lost-phone replacement asks separately for unused code B", async () => {
    const { client, calls } = clientFixture(path => Response.json(path.endsWith("/reauth") ? { ...proof, purpose: "totp.replace" } : path.endsWith("/replace") ? proof : { ok: true }));
    const view = render(<TwoFactorChallenge client={client} onAuthenticated={() => {}} onBack={() => {}} />);
    fireEvent.click(view.getByText("I lost my phone"));
    fireEvent.change(view.getByLabelText("Backup code"), { target: { value: "synthetic-code-a" } });
    fireEvent.submit(view.getByLabelText("Backup code").closest("form")!);
    const codeB = await view.findByLabelText("Unused replacement backup code");
    fireEvent.change(view.getByLabelText("Current password"), { target: { value: "synthetic-password" } });
    fireEvent.change(codeB, { target: { value: "synthetic-code-b" } });
    fireEvent.submit(codeB.closest("form")!);
    await view.findByRole("heading", { name: "Set up your authenticator" });
    expect(calls.map(call => call.path)).toEqual(["/api/ba/two-factor/verify-backup-code", "/api/auth/reauth", "/api/auth/totp/replace"]);
    expect(calls[1].body.backupCode).toBe("synthetic-code-b");
    expect(new Headers(calls[2].init?.headers).get("x-noctua-reauth")).toBe(proof.grant);
  });
});
