import { test, expect, type Page } from "@playwright/test";
import { evidencePath, openQaMenu, signInQa } from "./qaRound2Session";

// Administrators see and manage only mailboxes they are a member of. A new mailbox is owned by its
// creating admin, so it needs no separate self-grant step and appears in the sidebar right away.
test("admin creates a mailbox, becomes its owner without a grant step, and sees it in the sidebar", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signInQa(page);
  const identity = await (await page.request.get("/api/auth/me")).json();
  await openQaMenu(page, "Admin");
  await page.getByRole("button", { name: "Mailboxes", exact: true }).click();
  await page.getByRole("button", { name: "Create mailbox", exact: true }).click();
  const create = page.getByRole("dialog", { name: "Create mailbox", exact: true });
  await expect(create.getByText("Creates a mailbox owned by you. Add further members after creation.", { exact: true })).toBeVisible();
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
  expect(account).toMatchObject({ ownerUserId: identity.user.id, isOwner: true });
  await expect(create).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "Give yourself access?", exact: true })).toHaveCount(0);
  const listed = (await (await page.request.get("/api/admin/accounts")).json()).accounts.find((value: { id: string }) => value.id === account.id);
  expect(listed.members).toEqual([expect.objectContaining({ userId: identity.user.id, role: "manager", isOwner: true })]);
  const accessible = await (await page.request.get("/api/accounts")).json();
  expect(accessible.some((value: { id: string }) => value.id === account.id)).toBe(true);
  const row = page.getByText("self-grant@example.test · 1 member", { exact: true });
  await expect(row).toBeVisible();
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await row.scrollIntoViewIfNeeded();
    await expect(row).toBeInViewport();
    const list = page.getByRole("region", { name: "Mailboxes", exact: true });
    expect(await list.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.screenshot({ path: evidencePath(`admin-create-owner-${width}.png`) });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "Close admin", exact: true }).click();
  // No navigation or reload after the creation: the existing shell refresh updates the sidebar.
  await expect(page.locator('[data-slot="sidebar"]').getByText("Synthetic Grant Mailbox", { exact: true })).toBeVisible();
  const audit = await (await page.request.get("/api/admin/audit?limit=50")).json();
  expect(audit.entries.some((entry: { action: string; actorUserId: string; targetAccountId: string }) =>
    entry.action === "account.create" && entry.actorUserId === identity.user.id && entry.targetAccountId === account.id)).toBe(true);
  expect(audit.entries.some((entry: { action: string; targetAccountId: string }) => entry.action === "member.grant" && entry.targetAccountId === account.id)).toBe(false);
});

test.describe("admin with partial membership (German UI)", () => {
  test.use({ locale: "de-DE" });
  // Needs the deep-link fixture: qa-second belongs to the admin, qa-private to the other user only.
  test.skip(process.env.QA_DEEP_LINKS_FIXTURE !== "1", "run with QA_DEEP_LINKS_FIXTURE=1");

  async function shot(page: Page, name: string) {
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await page.screenshot({ path: evidencePath(`${name}-${width}.png`) });
    }
    await page.setViewportSize({ width: 1280, height: 900 });
  }

  test("Postfächer, Benutzer and Protokoll show only the admin's mailboxes; deleting a user with a foreign mailbox is refused", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await signInQa(page);
    const origin = new URL(page.url()).origin;
    const users = (await (await page.request.get("/api/admin/users")).json()).users as Array<{ id: string; email: string }>;
    const jo = users.find(user => user.email === "jo@example.test")!;
    const mailbox = (await (await page.request.get("/api/admin/accounts")).json()).accounts
      .find((account: { id: string }) => account.id === "qa-shared");
    const previous = mailbox.members.find((member: { userId: string }) => member.userId === jo.id) as { role: string } | undefined;
    const memberUrl = `/api/admin/accounts/qa-shared/members/${encodeURIComponent(jo.id)}`;
    try {
      // The other user also works in a mailbox the admin is a member of.
      expect((await page.request.put(`/api/admin/accounts/qa-shared/members/${encodeURIComponent(jo.id)}`, { data: { role: "editor" }, headers: { origin } })).status()).toBe(200);
      // Server-side: the foreign mailbox looks unknown.
      const foreign = await page.request.put(`/api/admin/accounts/qa-private/members/${encodeURIComponent(jo.id)}`, { data: { role: "viewer" }, headers: { origin } });
      expect([foreign.status(), (await foreign.json()).code]).toEqual([404, "account_not_found"]);
      expect((await page.request.get("/api/admin/accounts/qa-private/spam-settings")).status()).toBe(404);

      await page.goto("/?admin=mailboxes");
      const admin = page.getByRole("dialog", { name: "Administration", exact: true });
      await expect(admin.getByText("demo@monkeydent.test · 2 Mitglieder", { exact: true })).toBeVisible();
      await expect(admin.getByText("second@example.test · 1 Mitglied", { exact: true })).toBeVisible();
      await expect(admin.getByText("private@example.test", { exact: false })).toHaveCount(0);
      await shot(page, "admin-scope-mailboxes");

      await admin.getByRole("button", { name: "Benutzer", exact: true }).click();
      const joRow = admin.getByRole("row").filter({ hasText: "jo@example.test" });
      await expect(joRow.getByText("QA Shared · Bearbeiter", { exact: true })).toBeVisible();
      await expect(joRow.getByText("QA Private", { exact: false })).toHaveCount(0);
      await shot(page, "admin-scope-users");

      const deleted = page.waitForResponse(response => response.url().endsWith(`/api/admin/users/${encodeURIComponent(jo.id)}`) && response.request().method() === "DELETE");
      await joRow.getByRole("button", { name: "Benutzer löschen", exact: true }).click();
      const confirm = page.getByRole("dialog", { name: "Benutzer löschen", exact: true });
      await confirm.getByRole("button", { name: "Bestätigen", exact: true }).click();
      const refused = await deleted;
      expect([refused.status(), (await refused.json()).code]).toEqual([409, "foreign_mailbox_membership"]);
      await expect(confirm.getByRole("alert")).toHaveText("Diese Person ist Mitglied in Postfächern, in denen du kein Mitglied bist und die du deshalb nicht siehst. Löschen kann sie nur ein Administrator, der in allen ihren Postfächern Mitglied ist.");
      await shot(page, "admin-scope-delete-refused");
      await confirm.getByRole("button", { name: "Abbrechen", exact: true }).click();
      expect((await (await page.request.get("/api/admin/users")).json()).users.some((user: { id: string }) => user.id === jo.id)).toBe(true);

      await admin.getByRole("button", { name: "Protokoll", exact: true }).click();
      await expect(admin.getByText(/qa-shared/).first()).toBeVisible();
      const audit = await (await page.request.get("/api/admin/audit?limit=500")).json();
      expect(audit.entries.some((entry: { targetAccountId: string | null }) => entry.targetAccountId === "qa-private")).toBe(false);
      await shot(page, "admin-scope-audit");
    } finally {
      // Restore the exact fixture membership even if an assertion above fails.
      const restored = previous
        ? await page.request.put(memberUrl, { data: { role: previous.role }, headers: { origin } })
        : await page.request.delete(memberUrl, { headers: { origin } });
      expect(restored.status()).toBe(200);
    }
  });
});
