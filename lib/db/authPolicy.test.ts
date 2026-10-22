import { afterEach, describe, expect, test } from "bun:test";
import type { Database } from "bun:sqlite";
import { betterAuth } from "better-auth";
import { withResetDelivery } from "../authRecoveryContext";
import { importLegacyProfileFields, installAuthControlPlane } from "./authPolicy";
import { migrateAuthSchema, noctuaAuthOptions } from "../betterAuth";
import { caught, createTestAuthHarness, openMasterDb, TEST_BASE_URL, TEST_SECRET, type TestAuthHarness } from "../testAuthHarness";

const fixtures: TestAuthHarness[] = [];
async function setup(options?: Parameters<typeof createTestAuthHarness>[0]) {
  const fixture = await createTestAuthHarness(options);
  fixtures.push(fixture);
  return fixture;
}
afterEach(() => { for (const fixture of fixtures.splice(0)) fixture.close(); });

const state = (f: TestAuthHarness, id: string) => f.master.prepare(`SELECT generation FROM auth_security_state WHERE userId=?`).get(id)?.generation as number;
const epoch = (f: TestAuthHarness) => f.master.prepare(`SELECT generation FROM auth_login_epoch WHERE id=1`).get().generation as number;

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

// The local bun:sqlite declaration omits the runtime statement lifecycle method.
type FinalizableStatement = ReturnType<Database["prepare"]> & { finalize(): void };

const provisioningUserIndex = "idx_user_provisioning_user_state";
const provisioningUserMigration = "user-provisioning-user-state-index-v1";
const provisioningProbe = "SELECT 1 FROM user_provisioning WHERE userId=? AND state NOT IN ('complete','cancelled')";

function expectProvisioningUserIndex(db: Database) {
  const indexes = db.prepare("PRAGMA index_list(user_provisioning)").all() as Array<{ name: string; unique: number; partial: number }>;
  expect(indexes.find(index => index.name === provisioningUserIndex)).toMatchObject({ unique: 0, partial: 0 });
  const columns = db.prepare(`PRAGMA index_xinfo(${provisioningUserIndex})`).all() as Array<{ key: number; name: string; coll: string; desc: number }>;
  expect(columns.filter(column => column.key === 1).map(({ name, coll, desc }) => ({ name, coll, desc })))
    .toEqual([{ name: "userId", coll: "BINARY", desc: 0 }, { name: "state", coll: "BINARY", desc: 0 }]);
  expect(db.prepare("SELECT id FROM noctua_auth_migrations WHERE id=?").all(provisioningUserMigration))
    .toEqual([{ id: provisioningUserMigration }]);
}

function provisioningPlan(db: Database) {
  const statement = db.prepare("EXPLAIN QUERY PLAN " + provisioningProbe) as FinalizableStatement;
  try {
    return (statement.all("synthetic-missing") as Array<{ detail: string }>).map(row => row.detail);
  } finally { statement.finalize(); }
}

describe("provisioning user index", () => {
  test("fresh library schema installs a covering index and reopen is idempotent", async () => {
    const f = await setup();
    expectProvisioningUserIndex(f.database);
    expect(provisioningPlan(f.database)).toEqual([
      `SEARCH user_provisioning USING COVERING INDEX ${provisioningUserIndex} (userId=?)`
    ]);
    const reopened = openMasterDb(f.temp.dbPath);
    try {
      const options = noctuaAuthOptions({ database: reopened, baseURL: TEST_BASE_URL, secret: TEST_SECRET });
      expect(await migrateAuthSchema(options)).toEqual({ createdTables: [], addedColumns: [], addedIndexes: [] });
      const schema = reopened.prepare("SELECT sql FROM sqlite_master WHERE name=?").get(provisioningUserIndex);
      for (let startup = 0; startup < 2; startup++) {
        installAuthControlPlane(reopened);
        expectProvisioningUserIndex(reopened);
        expect(reopened.prepare("SELECT sql FROM sqlite_master WHERE name=?").get(provisioningUserIndex)).toEqual(schema);
      }
    } finally { reopened.close(); }
  });

  test("an existing master gains the index and receipt without changing auth state", async () => {
    const f = await setup();
    const user = await f.createUser("index-upgrade@example.test");
    f.master.prepare("UPDATE auth_security_state SET generation=7 WHERE userId=?").run(user.id);
    const beforeEpoch = epoch(f);
    const librarySchema = f.master.prepare("SELECT type,name,sql FROM sqlite_master WHERE tbl_name IN ('auth_user','auth_account','auth_session','auth_verification','auth_two_factor','auth_passkey') ORDER BY type,name").all();
    f.master.exec(`DROP INDEX ${provisioningUserIndex}`);
    f.master.prepare("DELETE FROM noctua_auth_migrations WHERE id=?").run(provisioningUserMigration);
    expect(provisioningPlan(f.master)).toEqual(["SCAN user_provisioning"]);
    const reopened = openMasterDb(f.temp.dbPath);
    try {
      installAuthControlPlane(reopened);
      expectProvisioningUserIndex(reopened);
      expect(state(f, user.id)).toBe(7);
      expect(epoch(f)).toBe(beforeEpoch);
      expect(reopened.prepare("SELECT type,name,sql FROM sqlite_master WHERE tbl_name IN ('auth_user','auth_account','auth_session','auth_verification','auth_two_factor','auth_passkey') ORDER BY type,name").all()).toEqual(librarySchema);
    } finally { reopened.close(); }
  });

  test.each([
    "CREATE INDEX idx_user_provisioning_user_state ON user_provisioning(userId)",
    "CREATE INDEX idx_user_provisioning_user_state ON user_provisioning(state,userId)",
    "CREATE INDEX idx_user_provisioning_user_state ON user_provisioning(userId COLLATE NOCASE,state)",
    "CREATE INDEX idx_user_provisioning_user_state ON user_provisioning(userId DESC,state)",
    "CREATE INDEX idx_user_provisioning_user_state ON user_provisioning(userId,state) WHERE state='reserved'",
    "CREATE UNIQUE INDEX idx_user_provisioning_user_state ON user_provisioning(userId,state)",
  ])("startup repairs malformed user index despite its existing receipt: %s", async (ddl: string) => {
    const f = await setup();
    f.master.exec(`DROP INDEX ${provisioningUserIndex}; ${ddl}`);
    installAuthControlPlane(f.database);
    expectProvisioningUserIndex(f.master);
    expect(provisioningPlan(f.master)[0]).toContain(`USING COVERING INDEX ${provisioningUserIndex}`);
  });

  test("a missing index is repaired even when its migration receipt exists", async () => {
    const f = await setup();
    f.master.exec(`DROP INDEX ${provisioningUserIndex}`);
    installAuthControlPlane(f.database);
    expectProvisioningUserIndex(f.master);
  });

  test("a failed upgrade rolls back the index together with its receipt", async () => {
    const f = await setup();
    f.master.exec(`DROP INDEX ${provisioningUserIndex}`);
    f.master.prepare("DELETE FROM noctua_auth_migrations WHERE id=?").run(provisioningUserMigration);
    f.master.exec(`CREATE TRIGGER reject_index_receipt BEFORE INSERT ON noctua_auth_migrations
      WHEN NEW.id='${provisioningUserMigration}' BEGIN SELECT RAISE(ABORT,'reject receipt'); END`);
    expect(() => installAuthControlPlane(f.database)).toThrow("reject receipt");
    expect(f.master.prepare("SELECT name FROM sqlite_master WHERE name=?").get(provisioningUserIndex)).toBeNull();
    expect(f.master.prepare("SELECT id FROM noctua_auth_migrations WHERE id=?").get(provisioningUserMigration)).toBeNull();
    f.master.exec("DROP TRIGGER reject_index_receipt");
    installAuthControlPlane(f.database);
    expectProvisioningUserIndex(f.master);
  });

  test("indexed probes preserve results over completed history, active, pending and cancelled states", async () => {
    const f = await setup();
    const insert = f.master.prepare(`INSERT INTO user_provisioning(id,userId,normalizedEmail,kind,state,createdAt,updatedAt)
      VALUES(?,?,?,'signup',?,1,1)`) as FinalizableStatement;
    const states = ["reserved", "auth_created", "cleanup_required", "cancelled", "pending", "complete", "COMPLETE", "CANCELLED", "unknown"];
    try {
      f.master.transaction(() => {
        for (let i = 0; i < 20000; i++) insert.run(`history-${i}`, `synthetic-${i % 100}`, `history-${i}@example.test`, "complete");
        for (const [i, value] of states.entries()) {
          insert.run(`state-${i}`, `synthetic-${i}`, `state-${i}@example.test`, value);
          insert.run(`cancelled-${i}`, `synthetic-${i}`, `cancelled-${i}@example.test`, "cancelled");
        }
        insert.run("second-active", "synthetic-0", "second-active@example.test", "pending");
      }).immediate();
    } finally { insert.finalize(); }
    f.master.exec(`DROP INDEX ${provisioningUserIndex}`);
    const ids = [...Array.from({ length: 100 }, (_, i) => `synthetic-${i}`), "synthetic-missing"];
    const probe = () => {
      const statement = f.master.prepare(provisioningProbe) as FinalizableStatement;
      try { return ids.map(id => statement.all(id)); }
      finally { statement.finalize(); }
    };
    const before = probe();
    expect(before[0]).toHaveLength(2);
    for (const i of [1, 2, 4, 6, 7, 8]) expect(before[i]).toHaveLength(1);
    for (const i of [3, 5, 99, 100]) expect(before[i]).toHaveLength(0);
    expect(provisioningPlan(f.master)).toEqual(["SCAN user_provisioning"]);
    installAuthControlPlane(f.database);
    expect(probe()).toEqual(before);
    expect(provisioningPlan(f.master)[0]).toContain(`USING COVERING INDEX ${provisioningUserIndex}`);
    f.master.exec("UPDATE user_provisioning SET state='complete' WHERE userId='synthetic-0'");
    expect(probe()[0]).toEqual([]);
    f.master.exec("UPDATE user_provisioning SET state='pending' WHERE id='state-5'");
    expect(probe()[5]).toHaveLength(1);
  });
});

describe("transactional mirrors", () => {
  test("real adapter rollback and queued creation commit the matching profiles together", async () => {
    const f = await setup();
    const first = await f.createUser("rollback@example.test");
    const context = await f.auth.$context;
    const entered = deferred();
    const release = deferred();
    const held = context.adapter.transaction(async trx => {
      await trx.update({ model: "user", where: [{ field: "id", value: first.id }], update: { email: "changed@example.test", role: "admin" } });
      expect(f.database.prepare(`SELECT email,role FROM users WHERE id=?`).get(first.id)).toEqual({ email: "changed@example.test", role: "admin" });
      expect(f.master.prepare(`SELECT email FROM users WHERE id=?`).get(first.id).email).toBe(first.email);
      entered.resolve();
      await release.promise;
      throw new Error("abort held transaction");
    });
    const failure = caught(held);
    await entered.promise;
    const queuedRead = deferred();
    const findUser = context.internalAdapter.findUserByEmail.bind(context.internalAdapter);
    context.internalAdapter.findUserByEmail = (...args) => {
      if (args[0] === "queued@example.test") queuedRead.resolve();
      return findUser(...args);
    };
    const queued = f.createUser("queued@example.test");
    // Reach the real library adapter while its writer is still held. Merely
    // starting an async API call before release would not prove queueing.
    await queuedRead.promise;
    expect(f.database.prepare(`SELECT id FROM auth_user WHERE email='queued@example.test'`).get()).toBeNull();
    context.internalAdapter.findUserByEmail = findUser;
    release.resolve();
    expect((await failure).message).toBe("abort held transaction");
    const second = await queued;
    expect(f.master.prepare(`SELECT email,role FROM users WHERE id=?`).get(first.id)).toEqual({ email: first.email, role: "user" });
    expect(f.master.prepare(`SELECT email FROM auth_user WHERE id=?`).get(first.id).email).toBe(first.email);
    expect(f.master.prepare(`SELECT email FROM users WHERE id=?`).get(second.id).email).toBe(second.email);
    expect(f.master.prepare(`SELECT typeof(createdAt) t FROM users WHERE id=?`).get(second.id).t).toBe("integer");
  });

  test("mirror constraint aborts the library statement and queued creation still works", async () => {
    const f = await setup();
    f.master.exec(`CREATE TRIGGER test_mirror_failure BEFORE INSERT ON users WHEN NEW.email='reject@example.test'
      BEGIN SELECT RAISE(ABORT,'mirror constraint'); END`);
    await caught(f.createUser("reject@example.test"));
    expect(f.master.prepare(`SELECT id FROM auth_user WHERE email='reject@example.test'`).get()).toBeNull();
    expect(f.master.prepare(`SELECT count(*) n FROM auth_security_state`).get().n).toBe(0);
    await f.createUser("allowed@example.test");
    expect(f.master.prepare(`SELECT count(*) n FROM users`).get().n).toBe(1);
  });

  test("a later after-hook exception cannot split a committed auth/profile pair", async () => {
    const f = await setup(options => {
      Object.assign(options, { databaseHooks: { user: { create: { after: async () => { throw new Error("after commit failure"); } } } } });
    });
    expect((await caught(f.createUser("after@example.test"))).message).toBe("after commit failure");
    const user = f.master.prepare(`SELECT id,createdAt FROM auth_user WHERE email='after@example.test'`).get();
    expect(user).not.toBeNull();
    expect(f.master.prepare(`SELECT email,typeof(createdAt) t FROM users WHERE id=?`).get(user.id)).toEqual({ email: "after@example.test", t: "integer" });
    expect(state(f, user.id)).toBe(0);
  });

  test("backfill preserves explicit IDs and integer profile time; second startup is empty", async () => {
    const f = await setup();
    const user = await f.createUser("backfill@example.test");
    f.master.prepare(`UPDATE users SET createdAt=? WHERE id=?`).run(1700000000123, user.id);
    const time = new Date("2026-01-02T03:04:05.678Z");
    f.master.prepare(`UPDATE auth_user SET createdAt=? WHERE id=?`).run(time.toISOString(), user.id);
    const options = noctuaAuthOptions({ database: f.database, baseURL: TEST_BASE_URL, secret: TEST_SECRET });
    expect(await migrateAuthSchema(options)).toEqual({ createdTables: [], addedColumns: [], addedIndexes: [] });
    installAuthControlPlane(f.database);
    expect(f.master.prepare(`SELECT createdAt FROM users WHERE id=?`).get(user.id).createdAt).toBe(1700000000123);
    f.master.prepare(`DELETE FROM users WHERE id=?`).run(user.id);
    installAuthControlPlane(f.database);
    expect(f.master.prepare(`SELECT createdAt FROM users WHERE id=?`).get(user.id).createdAt).toBe(time.getTime());
    expect(f.migration.createdTables.sort()).toEqual(["auth_account", "auth_passkey", "auth_session", "auth_two_factor", "auth_user", "auth_verification"]);
    const observer = openMasterDb(f.temp.dbPath);
    try {
      const repeat = noctuaAuthOptions({ database: observer, baseURL: TEST_BASE_URL, secret: TEST_SECRET });
      expect(await migrateAuthSchema(repeat)).toEqual({ createdTables: [], addedColumns: [], addedIndexes: [] });
      installAuthControlPlane(observer);
      const reopened = betterAuth(repeat);
      expect(await reopened.api.getSession({ headers: new Headers() })).toBeNull();
    } finally { observer.close(); }
  });

  test("explicit operator ID insertion preserves the legacy profile and memberships", async () => {
    const f = await setup();
    f.master.prepare(`INSERT INTO users(id,email,role,createdAt) VALUES(?,?,?,?)`).run("operator-bound", "operator@example.test", "admin", 1700000000123);
    await f.addMembership("operator-bound", "legacy-mailbox", "viewer");
    const context = await f.auth.$context;
    await context.adapter.create({ model: "user", forceAllowId: true, data: {
      id: "operator-bound", email: "operator@example.test", name: "Synthetic Operator", role: "admin", emailVerified: false,
      createdAt: new Date(), updatedAt: new Date()
    } });
    expect(f.master.prepare(`SELECT id,role,createdAt FROM users WHERE id='operator-bound'`).get())
      .toEqual({ id: "operator-bound", role: "admin", createdAt: 1700000000123 });
    expect(f.master.prepare(`SELECT role FROM user_accounts WHERE userId='operator-bound'`).get().role).toBe("viewer");
    expect(state(f, "operator-bound")).toBe(0);
  });

  test("startup never resets an installed missing security generation or epoch", async () => {
    const f = await setup();
    const user = await f.createUser("missing-startup@example.test");
    f.master.prepare(`DELETE FROM auth_security_state WHERE userId=?`).run(user.id);
    expect(() => installAuthControlPlane(f.database)).toThrow("Missing auth security state at startup");
    expect(state(f, user.id)).toBeUndefined();
    f.master.prepare(`INSERT INTO auth_security_state(userId,generation) VALUES(?,7)`).run(user.id);
    f.master.prepare(`DELETE FROM auth_login_epoch`).run();
    expect(() => installAuthControlPlane(f.database)).toThrow("Missing auth login epoch at startup");
  });

  test.each([
    "auth_security_state", "auth_login_epoch", "auth_session_security",
    "auth_pending_challenges", "auth_reauth_grants", "user_provisioning", "admin_lifecycle_operations"
  ])("startup rejects a deleted installed %s table without recreating it", async (table: string) => {
    const f = await setup();
    const user = await f.createUser("missing-table@example.test");
    f.master.prepare("UPDATE auth_security_state SET generation=7 WHERE userId=?").run(user.id);
    const beforeEpoch = epoch(f);
    f.master.exec(`DROP TABLE ${table}`);
    const reopened = openMasterDb(f.temp.dbPath);
    try {
      expect(() => installAuthControlPlane(reopened)).toThrow("Missing installed auth control-plane objects at startup");
      expect(reopened.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table)).toBeNull();
      if (table !== "auth_security_state") expect(state(f, user.id)).toBe(7);
      if (table !== "auth_login_epoch") expect(epoch(f)).toBe(beforeEpoch);
    } finally { reopened.close(); }
  });

  test.each([
    "DROP TABLE auth_control_plane_installation",
    "DELETE FROM auth_control_plane_installation",
    "DROP TABLE noctua_auth_migrations",
    "DELETE FROM noctua_auth_migrations WHERE id='auth-control-plane-v1'"
  ])("startup rejects a missing installation witness: %s", async (sql: string) => {
    const f = await setup();
    f.master.exec(sql);
    expect(() => installAuthControlPlane(f.database)).toThrow("Missing auth control-plane installation marker or migration record at startup");
    // A second attempt must not have silently restored either witness.
    expect(() => installAuthControlPlane(f.database)).toThrow("Missing auth control-plane installation marker or migration record at startup");
  });

  test("complete pre-marker planes gain both witnesses once without changing counters", async () => {
    const f = await setup();
    const user = await f.createUser("pre-marker@example.test");
    f.master.prepare("UPDATE auth_security_state SET generation=9 WHERE userId=?").run(user.id);
    const beforeEpoch = epoch(f);
    f.master.exec(`DROP TABLE auth_control_plane_installation;
      DELETE FROM noctua_auth_migrations WHERE id='auth-control-plane-v1'`);
    for (let startup = 0; startup < 2; startup++) {
      installAuthControlPlane(f.database);
      expect(state(f, user.id)).toBe(9);
      expect(epoch(f)).toBe(beforeEpoch);
      expect(f.master.prepare("SELECT * FROM auth_control_plane_installation").all()).toEqual([{ id: 1, version: 1 }]);
      expect(f.master.prepare("SELECT id FROM noctua_auth_migrations WHERE id='auth-control-plane-v1'").all())
        .toEqual([{ id: "auth-control-plane-v1" }]);
    }
  });

  test.each(["auth_security_state", "auth_login_epoch"])("pre-marker adoption rejects missing %s without writing witnesses", async (table: string) => {
    const f = await setup();
    f.master.exec(`DROP TABLE auth_control_plane_installation;
      DELETE FROM noctua_auth_migrations WHERE id='auth-control-plane-v1'; DROP TABLE ${table}`);
    expect(() => installAuthControlPlane(f.database)).toThrow("Missing installed auth control-plane objects at startup");
    expect(f.master.prepare("SELECT name FROM sqlite_master WHERE name='auth_control_plane_installation'").get()).toBeNull();
    expect(f.master.prepare("SELECT id FROM noctua_auth_migrations WHERE id='auth-control-plane-v1'").get()).toBeNull();
  });

  test.each([
    "CREATE INDEX idx_user_provisioning_active_email ON user_provisioning(normalizedEmail) WHERE state IN ('reserved','auth_created','cleanup_required')",
    "CREATE UNIQUE INDEX idx_user_provisioning_active_email ON user_provisioning(userId) WHERE state IN ('reserved','auth_created','cleanup_required')",
    "CREATE UNIQUE INDEX idx_user_provisioning_active_email ON user_provisioning(normalizedEmail) WHERE state='reserved'",
    "CREATE UNIQUE INDEX idx_user_provisioning_active_email ON user_provisioning(normalizedEmail) WHERE state IN ('RESERVED','AUTH_CREATED','CLEANUP_REQUIRED')",
    "CREATE UNIQUE INDEX idx_user_provisioning_active_email ON user_provisioning(normalizedEmail)"
  ])("startup repairs malformed provisioning index: %s", async (ddl: string) => {
    const f = await setup();
    f.master.exec(`DROP INDEX idx_user_provisioning_active_email; ${ddl}`);
    installAuthControlPlane(f.database);
    const reserve = f.master.prepare(`INSERT INTO user_provisioning(id,userId,normalizedEmail,kind,state,createdAt,updatedAt)
      VALUES(?,?,'reserved@example.test','signup',?,1,1)`);
    reserve.run("completed", "past-user", "complete");
    reserve.run("first", "first-user", "reserved");
    for (const active of ["reserved", "auth_created", "cleanup_required"]) {
      expect(() => reserve.run(`second-${active}`, "second-user", active)).toThrow("UNIQUE constraint failed");
    }
    reserve.run("cancelled", "cancelled-user", "cancelled");
  });

  test("conflicting active reservations abort index repair and marker adoption atomically", async () => {
    const f = await setup();
    f.master.exec(`DROP TABLE auth_control_plane_installation;
      DELETE FROM noctua_auth_migrations WHERE id='auth-control-plane-v1';
      DROP INDEX idx_user_provisioning_active_email;
      CREATE INDEX idx_user_provisioning_active_email ON user_provisioning(normalizedEmail)`);
    const originalIndex = f.master.prepare("SELECT sql FROM sqlite_master WHERE name='idx_user_provisioning_active_email'").get().sql;
    const reserve = f.master.prepare(`INSERT INTO user_provisioning(id,userId,normalizedEmail,kind,state,createdAt,updatedAt)
      VALUES(?,?,'duplicate@example.test','signup',?,1,1)`);
    reserve.run("first", "first-user", "reserved");
    reserve.run("second", "second-user", "cleanup_required");
    expect(() => installAuthControlPlane(f.database)).toThrow("Cannot repair auth provisioning uniqueness index at startup");
    expect(f.master.prepare("SELECT count(*) n FROM user_provisioning").get().n).toBe(2);
    expect(f.master.prepare("SELECT sql FROM sqlite_master WHERE name='idx_user_provisioning_active_email'").get().sql).toBe(originalIndex);
    expect(f.master.prepare("SELECT name FROM sqlite_master WHERE name='auth_control_plane_installation'").get()).toBeNull();
    expect(f.master.prepare("SELECT id FROM noctua_auth_migrations WHERE id='auth-control-plane-v1'").get()).toBeNull();
    // Operator reconciliation allows the next startup to finish the migration.
    f.master.exec("UPDATE user_provisioning SET state='cancelled' WHERE id='second'");
    installAuthControlPlane(f.database);
    expect(() => reserve.run("third", "third-user", "auth_created")).toThrow("UNIQUE constraint failed");
  });

  test("generated ISO creation dates round exactly to Noctua milliseconds", async () => {
    const f = await setup();
    const user = await f.createUser("date@example.test");
    const authTime = f.master.prepare(`SELECT createdAt FROM auth_user WHERE id=?`).get(user.id).createdAt;
    expect(f.master.prepare(`SELECT createdAt FROM users WHERE id=?`).get(user.id).createdAt).toBe(Date.parse(authTime));
  });

  test("startup repairs changed triggers and rejects malformed policy tables atomically", async () => {
    const f = await setup();
    f.master.exec(`DROP TRIGGER noctua_user_update; CREATE TRIGGER noctua_user_update AFTER UPDATE ON auth_user BEGIN SELECT 1; END`);
    installAuthControlPlane(f.database);
    expect(f.master.prepare(`SELECT sql FROM sqlite_master WHERE name='noctua_user_update'`).get().sql).toContain("UPDATE users");
    f.master.exec(`DROP TABLE auth_pending_challenges; CREATE TABLE auth_pending_challenges(identifier TEXT)`);
    expect(() => installAuthControlPlane(f.database)).toThrow("Malformed auth control-plane table");
  });

  test("ambiguous normalized legacy identity fails backfill without taking an arbitrary ID", async () => {
    const f = await setup();
    const user = await f.createUser("ambiguity@example.test");
    f.master.exec(`DROP INDEX idx_users_email_lower`);
    f.master.prepare(`INSERT INTO users(id,email,role,createdAt) VALUES(?,?,?,?)`).run("other-profile", " AMBIGUITY@example.test ", "admin", 1);
    expect(() => installAuthControlPlane(f.database)).toThrow("Ambiguous auth profile backfill");
    expect(f.master.prepare(`SELECT email FROM users WHERE id=?`).get(user.id).email).toBe(user.email);
  });
});

describe("credential generation barrier", () => {
  test.each(["credential", "oauth"])("combined %s provider and identity move advances both principals", async (provider: string) => {
    const f = await setup();
    const a = await f.createUser("combined-a@example.test");
    const b = await f.createUser("combined-b@example.test");
    const account = f.master.prepare("SELECT id FROM auth_account WHERE userId=?").get(a.id);
    if (provider === "oauth") f.master.prepare("UPDATE auth_account SET providerId='oauth' WHERE id=?").run(account.id);
    const before = [state(f, a.id), state(f, b.id)];
    const beforeEpoch = epoch(f);
    f.master.prepare("UPDATE auth_account SET userId=?,providerId=? WHERE id=?")
      .run(b.id, provider === "credential" ? "oauth" : "credential", account.id);
    expect([state(f, a.id), state(f, b.id)]).toEqual(before.map(generation => generation + 1));
    expect(epoch(f)).toBe(beforeEpoch + 2);
  });

  test.each(["source", "destination"])("combined provider and identity move aborts atomically with missing %s state", async (missing: string) => {
    const f = await setup();
    const a = await f.createUser("combined-missing-a@example.test");
    const b = await f.createUser("combined-missing-b@example.test");
    const account = f.master.prepare("SELECT id FROM auth_account WHERE userId=?").get(a.id);
    f.master.prepare("DELETE FROM auth_security_state WHERE userId=?").run(missing === "source" ? a.id : b.id);
    const before = [state(f, a.id), state(f, b.id)];
    const beforeEpoch = epoch(f);
    expect(() => f.master.prepare("UPDATE auth_account SET userId=?,providerId='oauth' WHERE id=?").run(b.id, account.id))
      .toThrow("Missing auth security state");
    expect([state(f, a.id), state(f, b.id)]).toEqual(before);
    expect(epoch(f)).toBe(beforeEpoch);
    expect(f.master.prepare("SELECT userId,providerId FROM auth_account WHERE id=?").get(account.id))
      .toEqual({ userId: a.id, providerId: "credential" });
  });

  test("insert/update/remove password, provider and identity moves invalidate the affected users", async () => {
    const f = await setup();
    const a = await f.createUser("generation-a@example.test");
    const b = await f.createUser("generation-b@example.test");
    expect(state(f, a.id)).toBe(1); // credential INSERT
    const initialEpoch = epoch(f);
    const credential = f.master.prepare(`SELECT id FROM auth_account WHERE userId=?`).get(a.id).id;
    const update = (sql: string, ...args: unknown[]) => f.master.prepare(`UPDATE auth_account SET ${sql} WHERE id=?`).run(...args, credential);
    update("updatedAt=?", new Date().toISOString());
    expect(state(f, a.id)).toBe(1);
    update("password=NULL");
    expect(state(f, a.id)).toBe(2);
    update("password=?", "synthetic-hash");
    expect(state(f, a.id)).toBe(3);
    update("password=?", "synthetic-hash");
    expect(state(f, a.id)).toBe(3);
    update("userId=?,accountId=?", b.id, b.id);
    expect([state(f, a.id), state(f, b.id)]).toEqual([4, 2]);
    update("providerId='oauth'");
    expect(state(f, b.id)).toBe(3);
    update("providerId='credential'");
    expect(state(f, b.id)).toBe(4);
    update("accountId='other-credential-identity'");
    expect(state(f, b.id)).toBe(5);
    f.master.prepare(`DELETE FROM auth_account WHERE id=?`).run(credential);
    expect(state(f, b.id)).toBe(6);
    expect(epoch(f)).toBe(initialEpoch + 8);
  });

  test("missing state aborts credential insertion, update, move and standalone deletion", async () => {
    const f = await setup();
    const a = await f.createUser("missing-a@example.test");
    const b = await f.createUser("missing-b@example.test");
    const account = f.master.prepare(`SELECT id,password FROM auth_account WHERE userId=?`).get(a.id);
    f.master.prepare(`DELETE FROM auth_security_state WHERE userId=?`).run(b.id);
    expect(() => f.master.prepare(`UPDATE auth_account SET userId=? WHERE id=?`).run(b.id, account.id)).toThrow("Missing auth security state");
    expect(state(f, a.id)).toBe(1); // old user's tentative increment rolled back too
    f.master.prepare(`DELETE FROM auth_security_state WHERE userId=?`).run(a.id);
    expect(() => f.master.prepare(`UPDATE auth_account SET password=NULL WHERE id=?`).run(account.id)).toThrow("Missing auth security state");
    expect(() => f.master.prepare(`DELETE FROM auth_account WHERE id=?`).run(account.id)).toThrow("Missing auth security state");
    expect(() => f.master.prepare(`INSERT INTO auth_account(id,accountId,providerId,userId,password,createdAt,updatedAt) VALUES(?,?,'credential',?,?,?,?)`)
      .run("new-credential", a.id, a.id, "synthetic-hash", new Date().toISOString(), new Date().toISOString())).toThrow("Missing auth security state");
    expect(f.master.prepare(`SELECT password FROM auth_account WHERE id=?`).get(account.id).password).toBe(account.password);
  });

  test("credential rollback restores generation and epoch; unrelated provider metadata has no effect", async () => {
    const f = await setup();
    const user = await f.createUser("rollback-generation@example.test");
    const context = await f.auth.$context;
    const beforeEpoch = epoch(f);
    const credential = f.master.prepare(`SELECT id FROM auth_account WHERE userId=?`).get(user.id).id;
    await expect(context.adapter.transaction(async trx => {
      await trx.update({ model: "account", where: [{ field: "id", value: credential }], update: { password: "uncommitted-hash" } });
      expect(f.database.prepare(`SELECT generation FROM auth_security_state WHERE userId=?`).get(user.id).generation).toBe(2);
      throw new Error("abort password write");
    })).rejects.toThrow("abort password write");
    expect(state(f, user.id)).toBe(1);
    expect(epoch(f)).toBe(beforeEpoch);
    f.master.prepare(`INSERT INTO auth_account(id,accountId,providerId,userId,password,createdAt,updatedAt) VALUES(?,?,'oauth',?,?,?,?)`)
      .run("oauth-account", user.id, user.id, null, new Date().toISOString(), new Date().toISOString());
    f.master.prepare(`UPDATE auth_account SET password='provider-metadata' WHERE id='oauth-account'`).run();
    expect(state(f, user.id)).toBe(1);
    f.master.prepare(`DELETE FROM auth_security_state WHERE userId=?`).run(user.id);
    f.master.prepare(`DELETE FROM auth_user WHERE id=?`).run(user.id);
    expect(f.master.prepare(`SELECT id FROM auth_account WHERE userId=?`).get(user.id)).toBeNull();
  });

  test("parent delete cascades auth children and sidecars without deleting domain profile", async () => {
    const f = await setup();
    const user = await f.createUser("cascade@example.test");
    const { session } = await f.signIn(user.email);
    await f.seedSessionSecurity(session!.session.id, user.id, "setup");
    f.master.prepare(`INSERT INTO auth_reauth_grants(tokenHash,userId,sessionId,purpose,generation,expiresAt) VALUES(?,?,?,?,?,?)`)
      .run("synthetic-hash", user.id, session!.session.id, "test", 1, Date.now()+1000);
    f.master.prepare(`DELETE FROM auth_user WHERE id=?`).run(user.id);
    for (const table of ["auth_account", "auth_session", "auth_security_state", "auth_session_security", "auth_reauth_grants"]) {
      expect(f.master.prepare(`SELECT count(*) n FROM ${table}`).get().n).toBe(0);
    }
    expect(f.master.prepare(`SELECT id FROM users WHERE id=?`).get(user.id)).not.toBeNull();
  });

  test("explicit fixture factors and session metadata do not promote other sessions", async () => {
    const f = await setup();
    const user = await f.createUser("fixture-factors@example.test");
    const first = await f.signIn(user.email);
    const second = await f.signIn(user.email);
    await f.enrollTotp(first.jar, "synthetic-password-123");
    const live = await f.auth.api.getSession({ headers: first.jar.headers() });
    expect(live?.user.twoFactorEnabled).toBe(true);
    expect(f.master.prepare(`SELECT verified FROM auth_two_factor WHERE userId=?`).get(user.id).verified).toBe(1);
    await f.seedSessionSecurity(live!.session.id, user.id, "mfa", "password_totp", 1700000000123);
    expect(f.master.prepare(`SELECT assurance,authenticatedAt FROM auth_session_security WHERE sessionId=?`).get(live!.session.id))
      .toEqual({ assurance: "mfa", authenticatedAt: 1700000000123 });
    expect(f.master.prepare(`SELECT sessionId FROM auth_session_security WHERE sessionId=?`).get(second.session!.session.id)).toBeNull();
    await f.addMembership(user.id, "synthetic-mailbox", "viewer");
    await f.addMembership(user.id, "synthetic-mailbox", "manager");
    expect(f.master.prepare(`SELECT role FROM user_accounts WHERE userId=?`).get(user.id).role).toBe("viewer");
  });

  test("ban changes advance generation, ordinary profile edits do not", async () => {
    const f = await setup();
    const user = await f.createUser("ban-generation@example.test");
    f.master.prepare(`UPDATE auth_user SET name=?,role=? WHERE id=?`).run("New Name", "admin", user.id);
    expect(state(f, user.id)).toBe(1);
    f.master.prepare(`UPDATE auth_user SET banned=1 WHERE id=?`).run(user.id);
    expect(state(f, user.id)).toBe(2);
    f.master.prepare(`UPDATE auth_user SET banReason='reason' WHERE id=?`).run(user.id);
    expect(state(f, user.id)).toBe(2);
    f.master.prepare(`UPDATE auth_user SET banExpires=? WHERE id=?`).run(new Date().toISOString(), user.id);
    expect(state(f, user.id)).toBe(3);
  });

  test("password reset remains revoked after onPasswordReset throws after commit", async () => {
    let resetToken = "";
    const f = await setup(options => Object.assign(options.emailAndPassword, {
      sendResetPassword: async ({ token }: { token: string }) => { resetToken = token; },
      onPasswordReset: async () => { throw new Error("reset cleanup failed"); }
    }));
    const user = await f.createUser("reset-barrier@example.test");
    const before = state(f, user.id);
    const login = await f.signIn(user.email);
    await withResetDelivery({userId:user.id,deliver:()=>{}},()=>f.auth.api.requestPasswordReset({ body: { email: user.email, redirectTo: `${TEST_BASE_URL}/reset-password` } }));
    expect(resetToken).not.toBe("");
    expect((await caught(f.auth.api.resetPassword({ body: { token: resetToken, newPassword: "replacement-password-123" } }))).message).toBe("reset cleanup failed");
    expect(state(f, user.id)).toBe(before+1);
    expect(await f.auth.api.getSession({ headers: login.jar.headers() })).toBeNull();
    expect((await f.signIn(user.email, "replacement-password-123")).response.token).toBeString();
    expect((await caught(f.auth.api.resetPassword({ body: { token: resetToken, newPassword: "another-password-123" } }))).body?.code).toBe("INVALID_TOKEN");
  });
});

describe("historical profile import",()=>{
  test("startup before identity binding transfers legacy ban and name exactly once in the operator transaction", async () => {
    const f = await setup();
    f.master.exec("ALTER TABLE users ADD COLUMN name TEXT; ALTER TABLE users ADD COLUMN disabledAt INTEGER");
    f.master.prepare(`INSERT INTO users(id,email,role,createdAt,name,disabledAt) VALUES(?,?,'user',1,?,123)`)
      .run("late-bound", "late-bound@example.test", "Historical Person");
    installAuthControlPlane(f.database);
    const context = await f.auth.$context;
    const bind = async (abort = false) => context.adapter.transaction(async trx => {
      await trx.create({ model: "user", forceAllowId: true, data: {
        id: "late-bound", email: "late-bound@example.test", name: "Migration Placeholder",
        role: "user", emailVerified: false, createdAt: new Date(), updatedAt: new Date()
      } });
      expect(importLegacyProfileFields(f.database, "late-bound")).toBe(true);
      if (abort) throw new Error("abort identity bind");
    });
    await expect(bind(true)).rejects.toThrow("abort identity bind");
    expect(f.master.prepare("SELECT id FROM auth_user WHERE id='late-bound'").get()).toBeNull();
    expect(f.master.prepare("SELECT id FROM noctua_auth_migrations WHERE id='legacy-profile-v1:late-bound'").get()).toBeNull();
    await bind();
    expect(f.master.prepare("SELECT name,banned,banExpires FROM auth_user WHERE id='late-bound'").get())
      .toEqual({ name: "Historical Person", banned: 1, banExpires: null });
    const generation = state(f, "late-bound");
    expect(generation).toBe(1);
    f.master.exec("UPDATE auth_user SET name='Authoritative Name',banned=0 WHERE id='late-bound'");
    expect(importLegacyProfileFields(f.database, "late-bound")).toBe(false);
    installAuthControlPlane(f.database);
    expect(f.master.prepare("SELECT name,banned FROM auth_user WHERE id='late-bound'").get())
      .toEqual({ name: "Authoritative Name", banned: 0 });
    expect(state(f, "late-bound")).toBe(generation + 1);
  });

  test("upgrading the global receipt preserves authoritative fields", async () => {
    const f = await setup(); const user = await f.createUser("old-import@example.test");
    f.master.exec("ALTER TABLE users ADD COLUMN name TEXT; ALTER TABLE users ADD COLUMN disabledAt INTEGER");
    f.master.prepare("UPDATE users SET name='Stale Name',disabledAt=123 WHERE id=?").run(user.id);
    f.master.exec("INSERT INTO noctua_auth_migrations(id) VALUES('legacy-profile-v1')");
    installAuthControlPlane(f.database);
    expect(f.master.prepare("SELECT name,banned FROM auth_user WHERE id=?").get(user.id))
      .toEqual({ name: "Synthetic User", banned: 0 });
    expect(importLegacyProfileFields(f.database, user.id)).toBe(false);
    expect(() => importLegacyProfileFields(f.database, "not-bound")).toThrow("explicit matching identity binding");
  });

  test("imports name and permanent ban once without reviving legacy auth authority",async()=>{
    const f=await setup(); const user=await f.createUser("historical@example.test");
    f.master.exec("ALTER TABLE users ADD COLUMN name TEXT; ALTER TABLE users ADD COLUMN disabledAt INTEGER");
    f.master.prepare("UPDATE users SET name='Historical Person',disabledAt=123 WHERE id=?").run(user.id);
    installAuthControlPlane(f.master);
    expect(f.master.prepare("SELECT name,banned,banExpires FROM auth_user WHERE id=?").get(user.id)).toEqual({name:"Historical Person",banned:1,banExpires:null});
    const generation=state(f,user.id);
    f.master.prepare("UPDATE auth_user SET name='Authoritative Name',banned=0 WHERE id=?").run(user.id);
    installAuthControlPlane(f.master);
    expect(f.master.prepare("SELECT name,banned FROM auth_user WHERE id=?").get(user.id)).toEqual({name:"Authoritative Name",banned:0});
    expect(state(f,user.id)).toBe(generation+1);
  });
});
