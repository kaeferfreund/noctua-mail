import { totpFromUri } from "../../helpers/totp";
import { SCENARIOS } from "./scenarios";
import { test, expect, api, signIn, register, recoveryLink } from "./fixtures";

// The existing harness feeds real policy-protected BA HTTP and minted sessions
// into the production Next shell. No fake auth route or shipped fixture page.
// Recordings remain disabled for every credential, QR, code and reset screen.
test(SCENARIOS.shellLogin, async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign in to Noctua" })).toBeVisible();
  await expect(page.getByLabel("Email", { exact: true })).toHaveAttribute("autocomplete", "username webauthn");
  await expect(page.getByRole("button", { name: "Sign in with a passkey" })).toBeVisible();
  await expect(page.getByText("Use my personal mailbox password")).toHaveCount(0);
  await page.getByRole("button", { name: "Sign up with an invite code" }).click();
  await expect(page.getByLabel("Invite code", { exact: true })).toBeVisible();
});

test(SCENARIOS.shellChallenge, async ({ page, seed }) => {
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill(seed.email);
  await page.getByLabel("App password", { exact: true }).fill(seed.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Verify your sign-in" })).toBeVisible();
  await page.getByRole("button", { name: "Use a backup code", exact: true }).click();
  await expect(page.getByLabel("Backup code", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Use authenticator code", exact: true }).click();
  await page.getByLabel("Authenticator code", { exact: true }).fill(totpFromUri(seed.totpURI));
  await page.getByRole("button", { name: "Verify", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No mailbox yet" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Profile & security" })).toBeVisible();
});

test(SCENARIOS.shellSecurity, async ({ page, seed, authenticator }) => {
  await authenticator.setUV(true);
  await signIn(page, seed);
  await register(page, seed);
  await page.goto("/");
  await page.getByRole("button", { name: "Profile & security" }).click();
  await expect(page.getByRole("heading", { name: "App password" })).toBeVisible();
  await expect(page.getByLabel("Passkey name (Synthetic browser key)", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out other sessions" })).toBeVisible();
  await page.getByRole("button", { name: "Remove passkey", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Verify your identity" })).toBeVisible();
  await page.getByLabel("Current password", { exact: true }).fill("synthetic-wrong-password");
  await page.getByLabel("Authenticator code", { exact: true }).fill(totpFromUri(seed.totpURI));
  await page.getByRole("button", { name: "Verify and continue" }).click();
  await expect(page.locator("[data-shell] [role=alert]")).toContainText("incorrect");
  expect((await api(page, "/api/auth/me")).status).toBe(200);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  // UV reauth uses the existing device. Registration then uses a second
  // authenticator: an existing credential correctly excludes the first one.
  await page.route("**/api/ba/passkey/generate-register-options**", async route => {
    await authenticator.addDevice(); await route.continue();
  });
  const failures: { path: string; status: number; code?: string }[] = [];
  page.on("response", async response => {
    const path = new URL(response.url()).pathname;
    if (path.startsWith("/api/") && response.status() >= 400) {
      const body = await response.json().catch(() => ({}));
      failures.push({ path, status: response.status(), code: body.code });
    }
  });
  await page.getByLabel("New passkey name", { exact: true }).fill("Synthetic shell key");
  await page.getByRole("button", { name: "Add passkey", exact: true }).click();
  await page.getByRole("button", { name: "Verify with a passkey", exact: true }).click();
  await expect(page.getByLabel("Current password", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Verify and continue" }).click();
  await expect.poll(async () => ({ added: await page.getByLabel("Passkey name (Synthetic shell key)", { exact: true }).count(), failures })).toEqual({ added: 1, failures: [] });
});

test(SCENARIOS.shellPasskey, async ({ page, seed, authenticator }) => {
  await authenticator.setUV(true); await signIn(page, seed); await register(page, seed);
  await api(page, "/api/ba/sign-out", {});
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in with a passkey" }).click();
  await expect(page.getByRole("heading", { name: "No mailbox yet" })).toBeVisible();
  expect((await api(page, "/api/auth/me")).body.security.reauthRequired).toBe(false);
});

test(SCENARIOS.shellReset, async ({ page, seed }) => {
  const link = await recoveryLink(page, seed);
  const token = decodeURIComponent(new URL(link).pathname.split("/").at(-1)!);
  await page.goto(`/reset-password?token=${encodeURIComponent(token)}`);
  await expect(page).toHaveURL(/\/reset-password$/);
  await page.getByLabel("New password", { exact: true }).fill("synthetic-reset-password");
  await page.getByLabel("Confirm new password", { exact: true }).fill("synthetic-reset-password");
  await page.getByRole("button", { name: "Change password", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Password changed" })).toBeVisible();
  expect((await api(page, "/api/auth/me")).status).toBe(401);
  await page.getByRole("link", { name: "Return to sign in" }).click();
  await page.getByLabel("Email", { exact: true }).fill(seed.email);
  await page.getByLabel("App password", { exact: true }).fill("synthetic-reset-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Verify your sign-in" })).toBeVisible();
  // Reuse is invalid even without a session. This is a real redeemed token.
  await page.goto(`/reset-password?token=${encodeURIComponent(token)}`);
  await page.getByLabel("New password", { exact: true }).fill("synthetic-reset-password");
  await page.getByLabel("Confirm new password", { exact: true }).fill("synthetic-reset-password");
  await page.getByRole("button", { name: "Change password", exact: true }).click();
  await expect(page.locator("[data-shell] [role=alert]")).toContainText("expired or already used");
});

test(SCENARIOS.activatedSignup, async ({ page, seed }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Sign up with an invite code" }).click();
  await page.getByLabel("Invite code", { exact: true }).fill(seed.inviteCode!);
  await page.getByLabel("Email", { exact: true }).fill("new-person@example.test");
  await page.getByLabel("Name", { exact: true }).fill("Synthetic New Person");
  await page.getByLabel("App password", { exact: true }).fill("synthetic-new-person-password");
  await page.getByLabel("Confirm app password", { exact: true }).fill("synthetic-new-person-password");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Set up your authenticator" })).toBeVisible();
  expect((await api(page, "/api/auth/me")).body.mailboxState).toBe("enrollment");
  expect((await api(page, "/api/accounts")).status).toBe(403);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Set up your authenticator" })).toBeVisible();
  await page.getByLabel("Current password", { exact: true }).fill("synthetic-new-person-password");
  await page.getByRole("button", { name: "Start authenticator setup", exact: true }).click();
  const secret = await page.getByLabel("Setup secret", { exact: true }).inputValue();
  await page.getByLabel("Authenticator code", { exact: true }).fill(totpFromUri(`otpauth://totp/Synthetic?secret=${secret}`));
  await page.getByRole("button", { name: "Verify authenticator", exact: true }).click();
  await page.getByRole("button", { name: "I saved my backup codes", exact: true }).click();
  await page.getByRole("button", { name: "Continue to Noctua", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No mailbox yet" })).toBeVisible();
});
test(SCENARIOS.activatedManagement, async ({ page, seed, authenticator }) => {
  await authenticator.setUV(true); await signIn(page, seed); await register(page, seed);
  await page.goto("/");
  await page.getByRole("button", { name: "Profile & security", exact: true }).click();
  await page.getByLabel("Passkey name (Synthetic browser key)", { exact: true }).fill("Synthetic renamed key");
  await page.getByRole("button", { name: "Rename passkey", exact: true }).click();
  async function verify() {
    await page.getByLabel("Current password", { exact: true }).fill(seed.password);
    await page.getByLabel("Authenticator code", { exact: true }).fill(totpFromUri(seed.totpURI));
    await page.getByRole("button", { name: "Verify and continue", exact: true }).click();
  }
  await verify();
  await expect(page.getByLabel("Passkey name (Synthetic renamed key)", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sign out other sessions", exact: true }).click();
  await verify();
  await expect(page.getByText("Other sessions signed out.", { exact: true })).toBeVisible();
  expect((await api(page, "/api/auth/me")).status).toBe(200);
});
test(SCENARIOS.activatedReset, async ({ page, seed }) => {
  const link = await recoveryLink(page, seed);
  const response = await page.goto(link);
  await expect(page.getByLabel("New password", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/reset-password$/);
  expect(response?.headers()["cache-control"]).toContain("no-store");
  expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
  const redirect = response?.request().redirectedFrom();
  expect((await redirect?.response())?.status()).toBe(302);
  expect((await redirect?.response())?.headers()["cache-control"]).toBe("no-store");
  expect((await redirect?.response())?.headers()["referrer-policy"]).toBe("no-referrer");
  await page.getByLabel("New password", { exact: true }).fill("synthetic-admin-recovered-password");
  await page.getByLabel("Confirm new password", { exact: true }).fill("synthetic-admin-recovered-password");
  await page.getByRole("button", { name: "Change password", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Password changed" })).toBeVisible();
  expect((await api(page, "/api/auth/me")).status).toBe(401);
  await page.getByRole("link", { name: "Return to sign in" }).click();
  await passwordLogin(page, seed.email, "synthetic-admin-recovered-password");
  await page.getByLabel("Authenticator code", { exact: true }).fill(totpFromUri(seed.totpURI));
  await page.getByRole("button", { name: "Verify", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No mailbox yet" })).toBeVisible();
});

async function passwordLogin(page: import("@playwright/test").Page, email: string, password: string) {
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("App password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Verify your sign-in" })).toBeVisible();
}

test(SCENARIOS.shellBackup, async ({ page, seed }) => {
  await page.goto("/");
  await passwordLogin(page, seed.email, seed.password);
  await page.getByRole("button", { name: "Use a backup code", exact: true }).click();
  await page.getByLabel("Backup code", { exact: true }).fill(seed.backupCodes[0]);
  await page.getByRole("button", { name: "Verify", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No mailbox yet" })).toBeVisible();
  await expect(page.getByText("Ask your admin to give you access to a mailbox.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add a mailbox", exact: true })).toHaveCount(0);
  const logout = page.waitForRequest(request => new URL(request.url()).pathname === "/api/auth/logout");
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  expect((await logout).postData()).toBeNull();
  await expect(page.getByRole("heading", { name: "Sign in to Noctua" })).toBeVisible();
  expect((await api(page, "/api/auth/me")).status).toBe(401);
});

test(SCENARIOS.shellReplacement, async ({ page, seed }) => {
  await page.goto("/");
  await passwordLogin(page, seed.email, seed.password);
  await page.getByRole("button", { name: "I lost my phone", exact: true }).click();
  await page.getByLabel("Backup code", { exact: true }).fill(seed.backupCodes[0]);
  await page.getByRole("button", { name: "Verify", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Replace your lost authenticator" })).toBeVisible();
  await page.getByLabel("Current password", { exact: true }).fill(seed.password);
  await page.getByLabel("Unused replacement backup code", { exact: true }).fill(seed.backupCodes[1]);
  await page.getByRole("button", { name: "Replace authenticator", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Set up your authenticator" })).toBeVisible();
  expect((await api(page, "/api/auth/me")).body.mailboxState).toBe("enrollment");
  expect((await api(page, "/api/accounts")).status).toBe(403);
  await page.getByLabel("Current password", { exact: true }).fill(seed.password);
  await page.getByRole("button", { name: "Start authenticator setup", exact: true }).click();
  const secret = await page.getByLabel("Setup secret", { exact: true }).inputValue();
  const uri = `otpauth://totp/Synthetic?secret=${secret}`;
  await page.getByLabel("Authenticator code", { exact: true }).fill(totpFromUri(uri));
  await page.getByRole("button", { name: "Verify authenticator", exact: true }).click();
  await page.getByRole("button", { name: "I saved my backup codes", exact: true }).click();
  await page.getByRole("button", { name: "Continue to Noctua", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No mailbox yet" })).toBeVisible();
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await passwordLogin(page, seed.email, seed.password);
  expect((await api(page, "/api/ba/two-factor/verify-totp", {code: totpFromUri(seed.totpURI)})).status).not.toBe(200);
  await page.getByLabel("Authenticator code", { exact: true }).fill(totpFromUri(uri));
  await page.getByRole("button", { name: "Verify", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No mailbox yet" })).toBeVisible();
});

test(SCENARIOS.shellMailbox, async ({ page, seed }) => {
  await page.goto("/");
  await passwordLogin(page, seed.email, seed.password);
  await page.getByLabel("Authenticator code", { exact: true }).fill(totpFromUri(seed.totpURI));
  await page.getByRole("button", { name: "Verify", exact: true }).click();
  const first = page.locator('button[title="synthetic-mailbox-a@example.test"]');
  const second = page.locator('button[title="synthetic-mailbox-b@example.test"]');
  await expect(first).toHaveAttribute("aria-current", "true");
  expect((await api(page, "/api/auth/me")).body.mailboxState).toBe("selected");
  const switched = page.waitForResponse(response => new URL(response.url()).pathname === "/api/auth/switch-account");
  await second.click();
  expect((await switched).status()).toBe(200);
  await expect(second).toHaveAttribute("aria-current", "true");
  const me = (await api(page, "/api/auth/me")).body;
  expect(me.accountId).toBe("synthetic-mailbox-b");
  expect(me.user.id).toBe(seed.userId);
  await page.reload();
  await expect(second).toHaveAttribute("aria-current", "true");
  await page.getByRole("button", { name: "User menu", exact: true }).click();
  await page.getByRole("menuitem", { name: "Profile & security", exact: true }).click();
  await expect(page.getByRole("heading", { name: "App password", exact: true })).toBeVisible();
});
