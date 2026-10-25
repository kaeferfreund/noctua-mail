import { spawn } from "node:child_process";
import { describe, test, expect } from "bun:test";
import { Database } from "bun:sqlite";
import { createTestAuthHarness } from "./testAuthHarness";
import { persistAccountRow } from "./db/rowParsers";
import { listSenderIdentityRows } from "./db/senderIdentities";
import { createSenderIdentity, updateSenderIdentity, disableSenderIdentity, setDefaultSenderIdentity, assertIdentitySignaturesAvailable } from "./senderIdentities";
import { identityTestAccount } from "./testFixtures/senderIdentities";

async function fixture() {
  const auth = await createTestAuthHarness();
  const user = await auth.createUser(`manager-${crypto.randomUUID()}@example.test`);
  persistAccountRow(auth.master, identityTestAccount("a", user.id));
  persistAccountRow(auth.master, identityTestAccount("b", user.id));
  return { ...auth, actor: { userId: user.id, clientId: "synthetic-client" } };
}
describe("sender identity service", () => {
  test("manager CRUD, immutable address, no-op audit, signature guard and cross-account lookup", async () => {
    const f = await fixture(); const db = f.master;
    try {
      const created = await createSenderIdentity("a", { email: " ALIAS@example.test ", displayName: "Alias" }, f.actor, db);
      expect(created.email).toBe("alias@example.test");
      await createSenderIdentity("a", { email: "idn@bücher.example", displayName: "IDN" }, f.actor, db);
      await expect(createSenderIdentity("a", { email: "IDN@xn--bcher-kva.example", displayName: "Duplicate" }, f.actor, db)).rejects.toMatchObject({ code: "identity_exists" });
      await expect(createSenderIdentity("a", { email: "Alias@example.test", displayName: "Duplicate" }, f.actor, db)).rejects.toMatchObject({ code: "identity_exists", status: 409 });
      await expect(updateSenderIdentity("a", created.id, { email: "changed@example.test" }, f.actor, db)).rejects.toMatchObject({ code: "immutable_identity_field" });
      await expect(updateSenderIdentity("b", created.id, { displayName: "No" }, f.actor, db)).rejects.toMatchObject({ code: "identity_not_found", status: 404 });
      await updateSenderIdentity("a", created.id, { displayName: "Alias" }, f.actor, db);
      expect(db.prepare("SELECT count(*) n FROM admin_audit WHERE action LIKE 'identity.%'").get()).toEqual({ n: 2 });
      await expect(updateSenderIdentity("a", created.id, { signatureId: "foreign-signature" }, f.actor, db)).rejects.toMatchObject({ code: "invalid_identity" });
      db.prepare("UPDATE accounts SET settings=? WHERE id='a'").run(JSON.stringify({ signatures: [{ id: "sig", name: "Signature", body: "Synthetic" }] }));
      await updateSenderIdentity("a", created.id, { signatureId: "sig", replyTo: "reply@example.test" }, f.actor, db);
      expect(() => assertIdentitySignaturesAvailable(db, "a", [])).toThrow("Unlink");
      await updateSenderIdentity("a", created.id, { signatureId: null, replyTo: null }, f.actor, db);
      expect(() => assertIdentitySignaturesAvailable(db, "a", [])).not.toThrow();
      await disableSenderIdentity("a", created.id, f.actor, db);
      expect(listSenderIdentityRows(db, "a").find(i => i.id === created.id)?.enabled).toBe(false);
    } finally { f.close(); }
  });
  test("display names are stored trimmed with collapsed whitespace on create, update, seed and read", async () => {
    const f = await fixture(); const db = f.master;
    try {
      const created = await createSenderIdentity("a", { email: "spaced@example.test", displayName: "  Synthetic   Support " }, f.actor, db);
      expect(created.displayName).toBe("Synthetic Support");
      const stored = () => (db.prepare("SELECT displayName FROM sender_identities WHERE id=?").get(created.id) as { displayName: string }).displayName;
      expect(stored()).toBe("Synthetic Support");
      const audits = () => db.prepare("SELECT count(*) n FROM admin_audit WHERE action LIKE 'identity.%'").get();
      const before = audits();
      await updateSenderIdentity("a", created.id, { displayName: "Synthetic Support " }, f.actor, db);
      expect(audits()).toEqual(before);
      expect((await updateSenderIdentity("a", created.id, { displayName: "Synthetic  Team\u00a0" }, f.actor, db)).displayName).toBe("Synthetic Team");
      expect(stored()).toBe("Synthetic Team");
      expect((await updateSenderIdentity("a", created.id, { displayName: "   " }, f.actor, db)).displayName).toBe("");
      await expect(updateSenderIdentity("a", created.id, { displayName: "Synthetic\tTeam" }, f.actor, db)).rejects.toMatchObject({ code: "invalid_identity" });
      persistAccountRow(db, { ...identityTestAccount("c", f.actor.userId), name: " Synthetic  Mailbox " });
      expect(listSenderIdentityRows(db, "c")[0].displayName).toBe("Synthetic Mailbox");
      db.prepare("UPDATE sender_identities SET displayName=? WHERE id=?").run(" Legacy  Name ", created.id);
      expect(listSenderIdentityRows(db, "a").find(i => i.id === created.id)?.displayName).toBe("Legacy Name");
    } finally { f.close(); }
  });
  test("default invariants, promotion races across connections, role revocation and atomic audit rollback", async () => {
    const f = await fixture(); const db = f.master; const other = new Database(f.temp.dbPath);
    try {
      const primary = listSenderIdentityRows(db, "a")[0];
      await expect(disableSenderIdentity("a", primary.id, f.actor, db)).rejects.toMatchObject({ code: "default_identity_required" });
      const aliases = await Promise.all(["one", "two"].map(name => createSenderIdentity("a", { email: `${name}@example.test`, displayName: name }, f.actor, db)));
      await Promise.all(aliases.map((identity, index) => setDefaultSenderIdentity("a", identity.id, f.actor, index ? other : db)));
      expect(listSenderIdentityRows(db, "a").filter(i => i.isDefault && i.enabled)).toHaveLength(1);
      const codes = await Promise.all(Array.from({ length: 4 }, (_, index) => new Promise<number>((resolve, reject) => {
        const child = spawn("nice", ["-n", "10", "bun", "run", "lib/testFixtures/promoteSenderIdentity.ts",
          f.temp.dbPath, "a", f.actor.userId, aliases[index % 2].id], { stdio: ["ignore", "ignore", "pipe"] });
        let stderr = "";
        child.stderr.on("data", chunk => { stderr += chunk; });
        child.on("error", reject);
        child.on("exit", code => code === 0 ? resolve(code) : reject(new Error(stderr)));
      })));
      expect(codes).toEqual([0, 0, 0, 0]);
      expect(listSenderIdentityRows(db, "a").filter(i => i.isDefault && i.enabled)).toHaveLength(1);
      db.exec("CREATE TRIGGER fail_identity_audit BEFORE INSERT ON admin_audit WHEN NEW.action LIKE 'identity.%' BEGIN SELECT RAISE(ABORT,'synthetic audit failure'); END");
      const before = listSenderIdentityRows(db, "a");
      await expect(setDefaultSenderIdentity("a", primary.id, f.actor, db)).rejects.toThrow("synthetic audit failure");
      expect(listSenderIdentityRows(db, "a")).toEqual(before);
      db.exec("DROP TRIGGER fail_identity_audit");
      const viewer = await f.createUser(`viewer-${crypto.randomUUID()}@example.test`);
      await f.addMembership(viewer.id, "a", "viewer");
      await expect(createSenderIdentity("a", { email: "no@example.test", displayName: "No" }, { userId: viewer.id }, db)).rejects.toMatchObject({ status: 403 });
      db.prepare("UPDATE auth_user SET banned=1 WHERE id=?").run(f.actor.userId);
      await expect(setDefaultSenderIdentity("a", primary.id, f.actor, db)).rejects.toMatchObject({ status: 403 });
    } finally { other.close(); f.close(); }
  });
});
