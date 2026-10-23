import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, waitFor } from "@testing-library/react";
import { render } from "@/lib/i18n/testRender";
import EnrollmentScreen from "./EnrollmentScreen";
import { clientFixture, proof, setup } from "./authTestHelpers";

afterEach(cleanup);
function start(view: ReturnType<typeof render>) {
  fireEvent.change(view.getByLabelText("Current password"), { target: { value: "synthetic-password" } });
  fireEvent.submit(view.getByLabelText("Current password").closest("form")!);
}
describe("EnrollmentScreen", () => {
  it("requires fresh proof after reload, verifies with the same grant, shows codes once and gates completion", async () => {
    let done = 0;
    const { client, calls } = clientFixture(path => Response.json(path.endsWith("/reauth") ? proof : path.endsWith("/enable") ? setup : { ok: true }));
    let view = render(<EnrollmentScreen client={client} onComplete={() => { done++; }} onLogout={() => {}} />);
    start(view); await view.findByLabelText("Setup secret");
    expect(view.queryByText("synthetic-code-a")).toBeNull();
    view.unmount();
    view = render(<EnrollmentScreen client={client} onComplete={() => { done++; }} onLogout={() => {}} />);
    expect(view.queryByLabelText("Setup secret")).toBeNull();
    expect(window.localStorage.length).toBe(0);
    start(view); await view.findByLabelText("Setup secret");
    expect((view.getByLabelText("Setup secret") as HTMLInputElement).value).toBe("JBSWY3DPEHPK3PXP");
    fireEvent.change(view.getByLabelText("Authenticator code"), { target: { value: "123456" } });
    fireEvent.submit(view.getByLabelText("Authenticator code").closest("form")!);
    await view.findByText("synthetic-code-a");
    expect(done).toBe(0);
    expect(view.queryByLabelText("Setup secret")).toBeNull();
    fireEvent.click(view.getByText("I saved my backup codes"));
    expect(view.queryByText("synthetic-code-a")).toBeNull();
    fireEvent.click(view.getByText("Continue to Noctua"));
    await waitFor(() => expect(done).toBe(1));
    expect(calls.filter(call => call.path.endsWith("/reauth"))).toHaveLength(2);
    const verification = calls.find(call => call.path.endsWith("verify-totp"))!;
    expect(new Headers(verification.init?.headers).get("x-noctua-reauth")).toBe(proof.grant);
  });
  it("discards a spent enable grant, obtains fresh proof on retry, and keeps wrong TOTP inline", async () => {
    let enables = 0;
    const { client, calls } = clientFixture(path => {
      if (path.endsWith("/reauth")) return Response.json(proof);
      if (path.endsWith("/enable")) return ++enables === 1 ? Response.json({ code: "INVALID_PASSWORD" }, { status: 403 }) : Response.json(setup);
      return Response.json({ code: "INVALID_CODE" }, { status: 400 });
    });
    const view = render(<EnrollmentScreen client={client} onComplete={() => { throw new Error("Must verify first"); }} onLogout={() => {}} />);
    start(view); await view.findByRole("alert");
    start(view); await view.findByLabelText("Setup secret");
    expect(calls.filter(call => call.path.endsWith("/reauth"))).toHaveLength(2);
    fireEvent.change(view.getByLabelText("Authenticator code"), { target: { value: "000000" } });
    fireEvent.submit(view.getByLabelText("Authenticator code").closest("form")!);
    await waitFor(() => expect(view.getByRole("alert").textContent).toContain("incorrect"));
    expect(view.getByLabelText("Setup secret")).toBeTruthy();
    expect(view.queryByText("synthetic-code-a")).toBeNull();
  });
  for (const status of [401, 403, 429]) it(`shows ${status} proof errors without exposing a seed`, async () => {
    const { client } = clientFixture(() => Response.json({ code: "invalid_proof" }, { status }));
    const view = render(<EnrollmentScreen client={client} onComplete={() => {}} onLogout={() => {}} />);
    start(view); await view.findByRole("alert");
    expect(view.queryByLabelText("Setup secret")).toBeNull();
    expect(view.getByRole("alert").textContent).toContain(status === 429 ? "60 seconds" : status === 401 ? "session ended" : "incorrect");
  });
});
