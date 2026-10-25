import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { dbModulePromise } from "../../testDbHarness";

const db = await dbModulePromise;
const { loadMailboxSpamSettings, loadSpamAdminSettings, mailboxSpamScope, saveMailboxSpamSettings, saveSpamAdminSettings } = await import("./settings");

// The global row is shared by every test file of the process: restore it afterwards.
let previousGlobal: unknown = null;
beforeAll(async () => { previousGlobal = await db.getSpamSettings("global"); });
afterAll(async () => { await db.saveSpamSettings("global", (previousGlobal ?? {}) as object, "spam-settings-test"); });

const auditFor = async (actorUserId: string) => (await db.listAdminAudit({ limit: 500 })).filter((entry) => entry.actorUserId === actorUserId);

describe("spam settings scopes", () => {
  test("an account id cannot read or overwrite the global settings", async () => {
    const admin = `admin-${crypto.randomUUID()}`;
    await saveSpamAdminSettings({ enabled: true, threshold: 0.9 }, admin);
    await saveMailboxSpamSettings("global", { enabled: false, threshold: 0.6 }, admin);
    expect(await loadSpamAdminSettings()).toEqual({ enabled: true, threshold: 0.9 });
    expect(await loadMailboxSpamSettings("global")).toEqual({ enabled: false, threshold: 0.6 });
    expect(await db.getSpamSettings("global")).toEqual({ enabled: true, threshold: 0.9 });
    expect(await db.getSpamSettings(mailboxSpamScope("global"))).toEqual({ enabled: false, threshold: 0.6 });
  });

  test("rows under the bare account id are still read and move to the prefixed key on save", async () => {
    const accountId = `acc-${crypto.randomUUID()}`;
    await db.saveSpamSettings(accountId, { autoMove: true }, "legacy");
    expect(await loadMailboxSpamSettings(accountId)).toEqual({ autoMove: true });
    await saveMailboxSpamSettings(accountId, { autoMove: false, threshold: 0.8 }, `admin-${crypto.randomUUID()}`);
    expect(await loadMailboxSpamSettings(accountId)).toEqual({ autoMove: false, threshold: 0.8 });
    expect(await db.getSpamSettings(accountId)).toBeNull();
    expect(await db.getSpamSettings(mailboxSpamScope(accountId))).toEqual({ autoMove: false, threshold: 0.8 });
  });
});

describe("spam settings admin log", () => {
  test("global and mailbox saves are logged with the previous and the new settings", async () => {
    const admin = `admin-${crypto.randomUUID()}`;
    const accountId = `acc-${crypto.randomUUID()}`;
    await db.saveSpamSettings(accountId, { autoMove: true }, "legacy");
    await saveMailboxSpamSettings(accountId, { enabled: true, threshold: 0.8 }, admin);
    await saveMailboxSpamSettings(accountId, { enabled: false }, admin);
    const previousGlobal = await loadSpamAdminSettings();
    await saveSpamAdminSettings({ model: "claude-haiku-5-5", threshold: 0.95 }, admin);
    // Saves within one millisecond share createdAt and come back in id (random) order: compare as a set.
    // Each entry's "before" names the save it follows, so the sequence is still checked.
    const entries = (await auditFor(admin)).map((entry) => [entry.action, entry.actorUserId, entry.targetAccountId, entry.payload]);
    const expected = [
      ["spam_settings.update", admin, accountId, { before: { autoMove: true }, after: { enabled: true, threshold: 0.8 } }],
      ["spam_settings.update", admin, accountId, { before: { enabled: true, threshold: 0.8 }, after: { enabled: false } }],
      ["spam_settings.update", admin, null, { before: previousGlobal, after: { model: "claude-haiku-5-5", threshold: 0.95 } }]
    ];
    expect(entries).toHaveLength(expected.length);
    expect(entries).toEqual(expect.arrayContaining(expected));
  });

  test("an invalid save writes nothing", async () => {
    const admin = `admin-${crypto.randomUUID()}`;
    await expect(saveSpamAdminSettings({ threshold: 2 }, admin)).rejects.toThrow("Invalid threshold");
    await expect(saveMailboxSpamSettings("acc-invalid", { apiKey: "x" }, admin)).rejects.toThrow("Unknown setting");
    expect(await auditFor(admin)).toEqual([]);
  });
});
