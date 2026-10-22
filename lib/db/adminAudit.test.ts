import { randomUUID } from "crypto";
import { describe, expect, test } from "bun:test";
import { dbModulePromise } from "../testDbHarness";

const { ADMIN_AUDIT_MAX_LIMIT, listAdminAudit, recordAdminAudit } = await dbModulePromise;

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

describe("recordAdminAudit", () => {
  test("stores one entry and returns it", async () => {
    const actorUserId = randomUUID();
    const targetUserId = randomUUID();
    const before = Date.now();

    const entry = await recordAdminAudit({
      actorUserId,
      action: "user.update",
      targetUserId,
      payload: { role: "admin", name: "Example Person" }
    });

    expect(entry).toEqual({
      id: expect.any(String),
      actorUserId,
      action: "user.update",
      targetUserId,
      targetAccountId: null,
      payload: { role: "admin", name: "Example Person" },
      createdAt: expect.any(Number)
    });
    expect(entry.createdAt).toBeGreaterThanOrEqual(before);
    expect((await listAdminAudit()).find((stored) => stored.id === entry.id)).toEqual(entry);
  });

  test("strips password-like keys at every level", async () => {
    const entry = await recordAdminAudit({
      actorUserId: randomUUID(),
      action: "user.password_reset",
      targetUserId: randomUUID(),
      payload: {
        generated: true,
        password: "plain-secret-1",
        newPassword: "plain-secret-2",
        passwordHash: "$argon2id$secret",
        account: {
          email: "mailbox@example.test",
          imap: { user: "mailbox@example.test", pass: "plain-secret-3" },
          deepl: { apiKey: "plain-secret-4", targetLang: "DE" }
        },
        tokens: [{ label: "cli", token: "plain-secret-5" }],
        clientSecret: "plain-secret-6"
      }
    });

    expect(entry.payload).toEqual({
      generated: true,
      account: {
        email: "mailbox@example.test",
        imap: { user: "mailbox@example.test" },
        deepl: { targetLang: "DE" }
      }
    });
    const stored = (await listAdminAudit()).find((candidate) => candidate.id === entry.id);
    expect(stored?.payload).toEqual(entry.payload);
    expect(JSON.stringify(stored)).not.toContain("plain-secret");
    expect(JSON.stringify(stored)).not.toContain("argon2id");
  });

  test("stores a missing payload as null", async () => {
    const entry = await recordAdminAudit({
      actorUserId: randomUUID(),
      action: "account.delete",
      targetAccountId: `acc-audit-${randomUUID()}`
    });
    expect(entry.payload).toBeNull();
    expect(entry.targetUserId).toBeNull();
  });
});

describe("listAdminAudit", () => {
  test("lists newest first and pages backwards with before", async () => {
    const actorUserId = randomUUID();
    // Distinct timestamps keep the order independent of entries written by
    // earlier tests in the same millisecond.
    await sleep(3);
    const first = await recordAdminAudit({ actorUserId, action: "member.grant" });
    await sleep(3);
    const second = await recordAdminAudit({ actorUserId, action: "member.update" });
    await sleep(3);
    const third = await recordAdminAudit({ actorUserId, action: "member.revoke" });

    expect((await listAdminAudit({ limit: 3 })).map((entry) => entry.id)).toEqual([
      third.id,
      second.id,
      first.id
    ]);
    expect(
      (await listAdminAudit({ limit: 2, before: third.createdAt })).map((entry) => entry.id)
    ).toEqual([second.id, first.id]);
    expect(
      (await listAdminAudit({ before: first.createdAt })).some((entry) => entry.actorUserId === actorUserId)
    ).toBe(false);
  });

  test("clamps the limit", async () => {
    await recordAdminAudit({ actorUserId: randomUUID(), action: "user.enable" });
    await recordAdminAudit({ actorUserId: randomUUID(), action: "user.disable" });

    expect(await listAdminAudit({ limit: 0 })).toHaveLength(1);
    expect(await listAdminAudit({ limit: -5 })).toHaveLength(1);
    expect((await listAdminAudit({ limit: Number.POSITIVE_INFINITY })).length).toBeGreaterThanOrEqual(2);
    expect((await listAdminAudit({ limit: 10_000 })).length).toBeLessThanOrEqual(ADMIN_AUDIT_MAX_LIMIT);
  });
});
