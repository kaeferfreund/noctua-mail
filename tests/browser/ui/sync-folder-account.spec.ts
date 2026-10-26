import { expect, test } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { totpFromUri } from "../../helpers/totp";

test("create, immutable owner and switch never sync the previous account's folder", async ({ page }) => {
  test.skip(!process.env.SYNC_FOLDER_SEED_FILE && !process.env.QA_SHELL_SEED_FILE, "Requires an isolated enrolled synthetic admin and dev fixture");
  const seeded = JSON.parse(readFileSync((process.env.SYNC_FOLDER_SEED_FILE ?? process.env.QA_SHELL_SEED_FILE)!, "utf8"));
  const seed = Array.isArray(seeded) ? seeded[0] : seeded;
  const base = process.env.SYNC_FOLDER_BASE_URL ?? process.env.QA_SHELL_BASE_URL ?? "http://127.0.0.1:3845";
  const headers = { origin: new URL(base).origin };
  const login = await page.request.post("/api/ba/sign-in/email", { headers, data: { email: seed.email, password: seed.password } });
  expect(login.status()).toBe(200);
  expect((await page.request.post("/api/ba/two-factor/verify-totp", { headers, data: { code: totpFromUri(seed.totpURI) } })).status()).toBe(200);
  const me = await (await page.request.get("/api/auth/me")).json();
  const suffix = Date.now();
  async function createMailbox(label: string) {
    const endpoint = { host: "127.0.0.1", secure: false, user: "demo@monkeydent.test", password: "demo" };
    const response = await page.request.post("/api/admin/accounts", { headers, data: {
      name: `Synthetic ${label} ${suffix}`, email: `sync-${label.toLowerCase()}-${suffix}@example.test`, avatar: "",
      imap: { ...endpoint, port: Number(process.env.QA_SHELL_IMAP_PORT ?? 3846) }, smtp: { ...endpoint, port: Number(process.env.QA_SHELL_SMTP_PORT ?? 3848) }
    } });
    expect(response.status()).toBe(201);
    const { account } = await response.json();
    expect(account).toMatchObject({ ownerUserId: me.user.id, isOwner: true });
    const selfGrant = await page.request.put(`/api/admin/accounts/${account.id}/members/${me.user.id}`, { headers, data: { role: "manager" } });
    expect(selfGrant.status()).toBe(403);
    expect(await selfGrant.json()).toMatchObject({ code: "owner_immutable" });
    return account;
  }
  const jobs: Array<{ accountId: string; folderId?: string; mode?: string }> = [];
  page.on("request", request => {
    const match = new URL(request.url()).pathname.match(/^\/api\/accounts\/([^/]+)\/sync$/);
    if (match && request.method() === "POST") jobs.push({ accountId: decodeURIComponent(match[1]), ...request.postDataJSON() });
  });
  const first = await createMailbox("A");
  expect((await page.request.post("/api/auth/switch-account", { headers, data: { accountId: first.id } })).status()).toBe(200);
  await page.goto("/");
  await expect.poll(() => jobs.filter(job => job.accountId === first.id).length).toBeGreaterThan(0);
  await expect(page.locator('[data-slot="shell-header"]')).toBeVisible();
  const second = await createMailbox("B");
  // Refresh memberships while A remains selected, then exercise the real shell switch.
  await page.reload();
  const switchButton = page.getByRole("button", { name: new RegExp(`Synthetic B ${suffix}`) }).first();
  await switchButton.click();
  await expect.poll(() => jobs.filter(job => job.accountId === second.id).length).toBeGreaterThan(0);
  const firstNewJob = jobs.find(job => job.accountId === second.id)!;
  expect([undefined, `${second.id}:INBOX`]).toContain(firstNewJob.folderId);
  expect(jobs.every(job => !job.folderId || job.folderId.startsWith(`${job.accountId}:`))).toBe(true);
  for (const [path, data] of [
    ["sync", { folderId: `${first.id}:INBOX`, mode: "full" }],
    ["sync/new-candidates", { folderIds: [`${first.id}:INBOX`] }]
  ] as const) {
    const response = await page.request.post(`/api/accounts/${second.id}/${path}`, { headers, data });
    expect(response.status()).toBe(400);
    expect(await response.json()).toEqual({ ok: false, code: "folder_account_mismatch" });
  }
  const poll = await page.request.get(`/api/accounts/${second.id}/imap/poll?folderId=${encodeURIComponent(`${first.id}:INBOX`)}`);
  expect(poll.status()).toBe(400);
  expect(await poll.json()).toEqual({ ok: false, code: "folder_account_mismatch" });
  writeFileSync(".tmp/sync-folder-browser-evidence.json", JSON.stringify({ firstAccountId: first.id, secondAccountId: second.id, firstNewJob, jobs, mismatchStatus: 400 }, null, 2));
});
