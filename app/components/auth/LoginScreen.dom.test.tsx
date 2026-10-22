import { afterEach, describe, expect, it } from "bun:test";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { AuthClientError } from "@/lib/authClient";
import LoginScreen from "./LoginScreen";
import { clientFixture } from "./authTestHelpers";

afterEach(cleanup);
const fill = (view: ReturnType<typeof render>, label: string, value: string) => fireEvent.change(view.getByLabelText(label), { target: { value } });

describe("LoginScreen", () => {
  it("uses app credentials, enters challenge without claiming a session, and hides IMAP by default", async () => {
    let authenticated = 0;
    const { client, calls } = clientFixture(path => Response.json(path.endsWith("/methods") ? { methods: { imap: false } } : { twoFactorRedirect: true }));
    const view = render(<LoginScreen client={client} onAuthenticated={() => { authenticated++; }} />);
    expect(view.getByLabelText("Email").getAttribute("autocomplete")).toBe("username webauthn");
    fill(view, "Email", "person@example.test"); fill(view, "App password", "synthetic-password");
    fireEvent.click(view.getByRole("button", { name: /^Sign in$/ }));
    await waitFor(() => expect(view.getByRole("heading", { name: "Verify your sign-in" })).toBeTruthy());
    expect(authenticated).toBe(0);
    expect(calls.find(call => call.path.endsWith("/sign-in/email"))?.body).toEqual({ email: "person@example.test", password: "synthetic-password" });
    expect(view.queryByText("Use my personal mailbox password")).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(view.getByRole("heading", { name: "Verify your sign-in" })));
  });
  for (const status of [401, 429]) it(`keeps ${status} errors inline without leaking server text`, async () => {
    const { client } = clientFixture(path => path.endsWith("/methods") ? Response.json({ methods: { imap: false } }) : Response.json({ code: "INVALID_EMAIL_OR_PASSWORD", message: "private upstream details" }, { status, headers: { "Retry-After": "90" } }));
    const view = render(<LoginScreen client={client} onAuthenticated={() => { throw new Error("Unexpected sign-in"); }} />);
    fill(view, "Email", "person@example.test"); fill(view, "App password", "synthetic-password");
    fireEvent.submit(view.getByLabelText("Email").closest("form")!);
    await waitFor(() => expect(view.getByRole("alert").textContent).toContain(status === 429 ? "90 seconds" : "Unable to sign in"));
    expect(view.container.textContent).not.toContain("private upstream");
    if (status === 429) expect((view.getByLabelText("Email").closest("fieldset") as HTMLFieldSetElement).disabled).toBe(true);
  });
  it("shows only server-enabled IMAP, selects its explicit endpoint, and refreshes me after first-factor success", async () => {
    let done = 0;
    const { client, calls } = clientFixture(path => Response.json(path.endsWith("/methods") ? { methods: { imap: true } } : {}));
    const view = render(<LoginScreen client={client} onAuthenticated={() => { done++; }} />);
    fireEvent.click(await view.findByText("Use my personal mailbox password"));
    fill(view, "Email", "person@example.test"); fill(view, "Personal mailbox password", "synthetic-imap-password");
    fireEvent.submit(view.getByLabelText("Email").closest("form")!);
    await waitFor(() => expect(done).toBe(1));
    expect(calls.at(-1)?.path).toBe("/api/ba/sign-in/imap");
  });
  it("validates signup, sends no mailbox credentials and honors 201 loginRequired", async () => {
    const { client, calls } = clientFixture(path => path.endsWith("/methods") ? Response.json({ methods: { imap: false } }) : Response.json({ ok: true, userId: "synthetic-user", accountId: null, security: { enrollmentRequired: true }, loginRequired: true }, { status: 201 }));
    const view = render(<LoginScreen client={client} onAuthenticated={() => { throw new Error("Must sign in first"); }} />);
    fireEvent.click(view.getByText("Sign up with an invite code"));
    fill(view, "Invite code", "synthetic-invite"); fill(view, "Email", "person@example.test"); fill(view, "Name", "Synthetic Person");
    fill(view, "App password", "synthetic-password"); fill(view, "Confirm app password", "mismatch");
    fireEvent.submit(view.getByLabelText("Email").closest("form")!);
    expect(view.getByRole("alert").textContent).toContain("do not match");
    fill(view, "Confirm app password", "synthetic-password"); fireEvent.submit(view.getByLabelText("Email").closest("form")!);
    await view.findByText("Your account was created. Sign in to set up your authenticator.");
    expect(calls.find(call => call.path.endsWith("signup"))?.body).toEqual({ inviteCode: "synthetic-invite", email: "person@example.test", name: "Synthetic Person", password: "synthetic-password" });
  });
  it("refreshes me for a setup-only 201 instead of treating signup as mailbox access", async () => {
    let refreshed = 0;
    const { client } = clientFixture(path => path.endsWith("/methods") ? Response.json({ methods: { imap: false } }) : Response.json({ ok: true, userId: "synthetic-user", accountId: null, security: { enrollmentRequired: true }, loginRequired: false }, { status: 201 }));
    const view = render(<LoginScreen client={client} onAuthenticated={() => { refreshed++; }} />);
    fireEvent.click(view.getByText("Sign up with an invite code"));
    fill(view, "Invite code", "synthetic-invite"); fill(view, "Email", "person@example.test"); fill(view, "Name", "Synthetic Person");
    fill(view, "App password", "synthetic-password"); fill(view, "Confirm app password", "synthetic-password");
    fireEvent.submit(view.getByLabelText("Email").closest("form")!);
    await waitFor(() => expect(refreshed).toBe(1));
  });
  it("cancels conditional UI before explicit passkey and navigation; cancellation leaves password form usable", async () => {
    const { client } = clientFixture(() => Response.json({ methods: { imap: false } }));
    const events: string[] = [];
    client.conditionalAvailable = async () => true;
    client.cancelPasskey = async () => { events.push("cancel"); };
    client.passkeySignIn = async options => {
      events.push(options?.autoFill ? "conditional" : "explicit");
      if (options?.autoFill) return new Promise((_resolve, reject) => options.signal!.addEventListener("abort", () => reject(new AuthClientError(400, "AUTH_CANCELLED"))));
      throw new AuthClientError(400, "AUTH_CANCELLED");
    };
    const view = render(<LoginScreen client={client} onAuthenticated={() => {}} />);
    await waitFor(() => expect(events).toContain("conditional"));
    await act(async () => { fireEvent.click(view.getByText("Sign in with a passkey")); });
    expect(events.indexOf("cancel")).toBeLessThan(events.indexOf("explicit"));
    expect(view.queryByRole("alert")).toBeNull();
    fireEvent.click(view.getByText("Sign up with an invite code"));
    expect(view.getByLabelText("Invite code")).toBeTruthy();
  });
});
