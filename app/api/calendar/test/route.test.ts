import { randomUUID } from "crypto";
import { describe, expect, test } from "bun:test";
import type { Account } from "@/lib/data";
import { createAuthenticatedTestSession } from "@/lib/testAuthHarness";
import { dbModulePromise } from "@/lib/testDbHarness";

const { upsertAccount } = await dbModulePromise;
const { POST } = await import("./route");

function buildAccount(accountId: string): Account {
  return {
    id: accountId,
    name: "CalDAV Test Route",
    email: "owner@example.test",
    avatar: "",
    imap: { host: "imap.example.test", port: 993, secure: true, user: "owner@example.test", password: "secret" },
    smtp: { host: "smtp.example.test", port: 465, secure: true, user: "owner@example.test", password: "secret" }
  };
}

function request(cookie: string, body: unknown) {
  return new Request("http://localhost/api/calendar/test", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost:3000", cookie },
    body: JSON.stringify(body)
  });
}

// Literal private targets are rejected by the guard before any connection, so
// these requests never leave the process.
const probe = { url: "https://127.0.0.1:8008/", user: "synthetic", password: "synthetic" };

describe("POST /api/calendar/test", () => {
  test("requires a mailbox the caller manages", async () => {
    const accountId = `caldav-test-${randomUUID()}`;
    await upsertAccount(buildAccount(accountId));
    const fixture = await createAuthenticatedTestSession(accountId);
    const cookie = fixture.jar.header();

    const missing = await POST(request(cookie, probe));
    expect(missing.status).toBe(400);

    const foreign = `caldav-test-${randomUUID()}`;
    await upsertAccount(buildAccount(foreign));
    expect((await POST(request(cookie, { ...probe, accountId: foreign }))).status).toBe(403);

    for (const role of ["viewer", "editor"] as const) {
      fixture.master.prepare("UPDATE user_accounts SET role=? WHERE userId=? AND accountId=?").run(role, fixture.user.id, accountId);
      expect((await POST(request(cookie, { ...probe, accountId }))).status).toBe(403);
    }

    fixture.master.prepare("UPDATE user_accounts SET role='manager' WHERE userId=? AND accountId=?").run(fixture.user.id, accountId);
    const allowed = await POST(request(cookie, { ...probe, accountId }));
    expect(allowed.status).toBe(200);
    const body = (await allowed.json()) as { ok: boolean; message?: string };
    expect(body.ok).toBe(false);
    expect(body.message).toContain("private-ip");
  });

  test("refuses to send a password over plain http://", async () => {
    const accountId = `caldav-test-${randomUUID()}`;
    await upsertAccount(buildAccount(accountId));
    const fixture = await createAuthenticatedTestSession(accountId);
    const res = await POST(request(fixture.jar.header(), { ...probe, url: "http://caldav.example.test/", accountId }));
    const body = (await res.json()) as { ok: boolean; message?: string };
    expect(body.ok).toBe(false);
    expect(body.message).toContain("https-required");
  });
});
