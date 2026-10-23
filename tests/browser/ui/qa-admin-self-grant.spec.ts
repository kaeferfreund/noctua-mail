import { test, expect } from "@playwright/test";
import { evidencePath, openQaMenu, signInQa } from "./qaRound2Session";

test("admin creates a mailbox, explicitly grants self access, and sees it in the sidebar", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signInQa(page);
  const identity = await (await page.request.get("/api/auth/me")).json();
  await openQaMenu(page, "Admin");
  await page.getByRole("button", { name: "Mailboxes", exact: true }).click();
  await page.getByRole("button", { name: "Create mailbox", exact: true }).click();
  const create = page.getByRole("dialog", { name: "Create mailbox", exact: true });
  for (const [label, value] of [["Name", "Synthetic Grant Mailbox"], ["Email", "self-grant@example.test"],
    ["IMAP host", "127.0.0.1"], ["IMAP user", process.env.QA_SHELL_FIXTURE_USER ?? "demo@monkeydent.test"], ["IMAP password", "demo"],
    ["SMTP host", "127.0.0.1"], ["SMTP user", process.env.QA_SHELL_FIXTURE_USER ?? "demo@monkeydent.test"], ["SMTP password", "demo"]]) {
    await create.getByLabel(label, { exact: true }).fill(value);
  }
  // The existing dev fixture speaks plaintext on assigned loopback ports.
  for (let index = 0; index < 2; index++) {
    await create.getByRole("combobox").nth(index).click();
    await page.getByRole("option", { name: "None", exact: true }).click();
  }
  await create.getByLabel("IMAP port", { exact: true }).fill(process.env.QA_SHELL_IMAP_PORT!);
  await create.getByLabel("SMTP port", { exact: true }).fill(process.env.QA_SHELL_SMTP_PORT!);
  const createdResponse = page.waitForResponse(response => response.url().endsWith("/api/admin/accounts") && response.request().method() === "POST");
  await create.getByRole("button", { name: "Save", exact: true }).click();
  const created = await createdResponse;
  expect(created.status()).toBe(201);
  const { account } = await created.json();
  const followUp = page.getByRole("dialog", { name: "Give yourself access?", exact: true });
  await expect(followUp).toBeVisible();
  await expect(followUp.getByLabel("Role", { exact: true })).toHaveValue("manager");
  const before = await (await page.request.get("/api/admin/accounts")).json();
  expect(before.accounts.find((value: { id: string }) => value.id === account.id).members).toEqual([]);
  const accessibleBefore = await (await page.request.get("/api/accounts")).json();
  expect(accessibleBefore.some((value: { id: string }) => value.id === account.id)).toBe(false);
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(followUp.getByRole("button", { name: "Grant access", exact: true })).toBeInViewport();
    await expect(followUp.getByRole("button", { name: "Later", exact: true })).toBeInViewport();
    expect(await followUp.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.screenshot({ path: evidencePath(`admin-self-grant-${width}.png`) });
  }
  const grantResponse = page.waitForResponse(response => response.url().endsWith(`/members/${identity.user.id}`) && response.request().method() === "PUT");
  await followUp.getByRole("button", { name: "Grant access", exact: true }).click();
  expect((await grantResponse).status()).toBe(200);
  await expect(followUp).toHaveCount(0);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "Close admin", exact: true }).click();
  // No navigation or reload after the grant: the existing shell refresh updates the sidebar.
  await expect(page.locator('[data-slot="sidebar"]').getByText("Synthetic Grant Mailbox", { exact: true })).toBeVisible();
  const audit = await (await page.request.get("/api/admin/audit?limit=50")).json();
  expect(audit.entries.some((entry: { action: string; actorUserId: string; targetUserId: string; targetAccountId: string }) =>
    entry.action === "member.grant" && entry.actorUserId === identity.user.id && entry.targetUserId === identity.user.id && entry.targetAccountId === account.id)).toBe(true);
});
