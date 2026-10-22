import { randomUUID } from "crypto";
import { describe, expect, test } from "bun:test";
import type { Account } from "../data";
import { dbModulePromise } from "../testDbHarness";

const {
  DuplicateUserEmailError,
  addUserAccountLink,
  deleteUser,
  deleteUserAccountLinksForUser,
  getAccountById,
  getUserAccountPrefs,
  getUserAccountRole,
  getUserAccounts,
  getUserAuthByEmail,
  getUserById,
  getUserLiveness,
  getUsers,
  insertMcpToken,
  insertUser,
  listMcpTokens,
  listUserAccountLinks,
  listUserAccountLinksForUser,
  mergeUserAccountPrefs,
  normalizeUserEmail,
  removeUserAccountLink,
  setUserAccountRole,
  setUserDisabled,
  updateUserPassword,
  updateUserProfile,
  upsertAccount
} = await dbModulePromise;

// The harness master DB is shared by every test file, so every row here
// uses fresh ids and addresses.
function uniqueEmail(prefix: string) {
  return `${prefix}-${randomUUID()}@example.test`;
}

function uniqueAccountId(prefix: string) {
  return `${prefix}-${randomUUID()}`;
}

function buildAccount(accountId: string, ownerUserId?: string): Account {
  return {
    id: accountId,
    name: "Users Test",
    email: `${accountId}@example.test`,
    avatar: "UT",
    ownerUserId,
    imap: {
      host: "imap.example.test",
      port: 993,
      secure: true,
      user: "mailbox@example.test",
      password: "imap-secret"
    },
    smtp: {
      host: "smtp.example.test",
      port: 465,
      secure: true,
      user: "mailbox@example.test",
      password: "smtp-secret"
    }
  };
}

async function insertToken(accountId: string, createdByUserId: string) {
  const id = randomUUID();
  await insertMcpToken({
    id,
    accountId,
    createdByUserId,
    label: "Users test",
    tokenHash: `hash-${id}`,
    tokenSuffix: id.slice(-4),
    createdAt: Date.now(),
    expiresAt: null
  });
  return id;
}

describe("normalizeUserEmail", () => {
  test("trims and lowercases", () => {
    expect(normalizeUserEmail("  Person.Name@Example.TEST \n")).toBe("person.name@example.test");
  });
});

describe("insertUser", () => {
  test("stores the e-mail normalised and never exposes the password hash", async () => {
    const email = uniqueEmail("Insert-Plain");
    const user = await insertUser({
      email: `  ${email.toUpperCase()} `,
      role: "user",
      name: "  Example Person  "
    });

    expect(user).toEqual({
      id: user.id,
      email: email.toLowerCase(),
      name: "Example Person",
      role: "user",
      createdAt: user.createdAt,
      hasPassword: false,
      mustChangePassword: false,
      disabledAt: null
    });
    expect(await getUserById(user.id)).toEqual(user);
    expect((await getUsers()).find((entry) => entry.id === user.id)).toEqual(user);
  });

  test("records a password hash without returning it", async () => {
    const before = Math.floor(Date.now() / 1000);
    const user = await insertUser({
      email: uniqueEmail("insert-hash"),
      role: "admin",
      passwordHash: "$argon2id$example-hash",
      mustChangePassword: true
    });

    expect(user.hasPassword).toBe(true);
    expect(user.mustChangePassword).toBe(true);
    expect(user.role).toBe("admin");
    expect(Object.keys(user)).not.toContain("passwordHash");
    expect(JSON.stringify(await getUsers())).not.toContain("$argon2id$example-hash");

    const liveness = await getUserLiveness(user.id);
    expect(liveness?.passwordUpdatedAt).toBeGreaterThanOrEqual(before);
    expect(liveness?.mustChangePassword).toBe(true);
  });

  test("throws DuplicateUserEmailError for a case variant of an existing address", async () => {
    const email = uniqueEmail("insert-dup");
    const first = await insertUser({ email, role: "user" });

    const duplicate = insertUser({ email: ` ${email.toUpperCase()}`, role: "user" });
    await expect(duplicate).rejects.toBeInstanceOf(DuplicateUserEmailError);
    await expect(duplicate).rejects.toThrow("A user with this email address already exists");

    const matching = (await getUsers()).filter((user) => user.email === email.toLowerCase());
    expect(matching.map((user) => user.id)).toEqual([first.id]);
  });

  test("rejects a blank e-mail and an unknown role", async () => {
    await expect(insertUser({ email: "   ", role: "user" })).rejects.toThrow(
      "User e-mail is required"
    );
    await expect(
      // Simulates an unchecked request body reaching the DB layer.
      insertUser(JSON.parse(`{"email":"${uniqueEmail("bad-role")}","role":"owner"}`))
    ).rejects.toThrow("Invalid user role: owner");
  });
});

describe("getUserAuthByEmail", () => {
  test("finds the user case-insensitively with its auth fields", async () => {
    const email = uniqueEmail("auth-lookup");
    const user = await insertUser({
      email,
      role: "user",
      passwordHash: "$argon2id$auth-lookup"
    });

    expect(await getUserAuthByEmail(` ${email.toUpperCase()} `)).toEqual({
      id: user.id,
      role: "user",
      passwordHash: "$argon2id$auth-lookup",
      disabledAt: null,
      mustChangePassword: false
    });
  });

  test("returns null for unknown and blank addresses", async () => {
    expect(await getUserAuthByEmail(uniqueEmail("auth-missing"))).toBeNull();
    expect(await getUserAuthByEmail("  ")).toBeNull();
  });

  test("reports a missing hash as null for legacy users", async () => {
    const email = uniqueEmail("auth-legacy");
    await insertUser({ email, role: "user" });
    expect((await getUserAuthByEmail(email))?.passwordHash).toBeNull();
  });
});

describe("getUserLiveness", () => {
  test("returns the guard fields, or null for an unknown user", async () => {
    const user = await insertUser({ email: uniqueEmail("liveness"), role: "admin" });
    expect(await getUserLiveness(user.id)).toEqual({
      disabledAt: null,
      passwordUpdatedAt: null,
      mustChangePassword: false,
      role: "admin"
    });
    expect(await getUserLiveness(randomUUID())).toBeNull();
  });
});

describe("updateUserPassword", () => {
  test("stores the hash, bumps passwordUpdatedAt and sets mustChangePassword", async () => {
    const email = uniqueEmail("password-update");
    const user = await insertUser({ email, role: "user" });

    expect(
      await updateUserPassword(user.id, "$argon2id$reset", {
        mustChangePassword: true,
        passwordUpdatedAt: 1_900_000_000
      })
    ).toBe(true);
    expect(await getUserLiveness(user.id)).toMatchObject({
      passwordUpdatedAt: 1_900_000_000,
      mustChangePassword: true
    });
    expect((await getUserAuthByEmail(email))?.passwordHash).toBe("$argon2id$reset");

    const before = Math.floor(Date.now() / 1000);
    expect(
      await updateUserPassword(user.id, "$argon2id$changed", { mustChangePassword: false })
    ).toBe(true);
    const liveness = await getUserLiveness(user.id);
    expect(liveness?.mustChangePassword).toBe(false);
    expect(liveness?.passwordUpdatedAt).toBeGreaterThanOrEqual(before);
    expect((await getUserById(user.id))?.hasPassword).toBe(true);
  });

  test("returns false for an unknown user and refuses an empty hash", async () => {
    expect(
      await updateUserPassword(randomUUID(), "$argon2id$x", { mustChangePassword: false })
    ).toBe(false);
    const user = await insertUser({ email: uniqueEmail("password-empty"), role: "user" });
    await expect(
      updateUserPassword(user.id, "", { mustChangePassword: false })
    ).rejects.toThrow("Password hash is required");
  });
});

describe("updateUserProfile", () => {
  test("updates only the given fields and clears a blank name", async () => {
    const user = await insertUser({ email: uniqueEmail("profile"), role: "user", name: "Before" });

    const renamed = await updateUserProfile(user.id, { name: " After " });
    expect(renamed?.name).toBe("After");
    expect(renamed?.role).toBe("user");

    const promoted = await updateUserProfile(user.id, { role: "admin" });
    expect(promoted?.name).toBe("After");
    expect(promoted?.role).toBe("admin");

    const cleared = await updateUserProfile(user.id, { name: "  " });
    expect(cleared?.name).toBeUndefined();
    expect(await updateUserProfile(user.id, {})).toEqual(cleared);
  });

  test("returns null for an unknown user", async () => {
    expect(await updateUserProfile(randomUUID(), { name: "Nobody" })).toBeNull();
  });
});

describe("setUserDisabled", () => {
  test("keeps the first disabledAt and clears it on enable", async () => {
    const email = uniqueEmail("disable");
    const user = await insertUser({ email, role: "user" });

    const disabled = await setUserDisabled(user.id, true);
    expect(disabled?.disabledAt).toEqual(expect.any(Number));
    const disabledAgain = await setUserDisabled(user.id, true);
    expect(disabledAgain?.disabledAt).toBe(disabled!.disabledAt);
    expect((await getUserAuthByEmail(email))?.disabledAt).toBe(disabled!.disabledAt);
    expect((await getUserLiveness(user.id))?.disabledAt).toBe(disabled!.disabledAt);

    const enabled = await setUserDisabled(user.id, false);
    expect(enabled?.disabledAt).toBeNull();
    expect(await setUserDisabled(randomUUID(), true)).toBeNull();
  });
});

describe("mailbox memberships", () => {
  test("addUserAccountLink defaults to manager and never resets an existing role", async () => {
    const userId = randomUUID();
    const accountId = uniqueAccountId("acc-link");

    expect(await addUserAccountLink(userId, accountId)).toBe(true);
    const [created] = await listUserAccountLinksForUser(userId);
    expect(created).toEqual({
      userId,
      accountId,
      role: "manager",
      grantedByUserId: null,
      grantedAt: expect.any(Number)
    });

    await setUserAccountRole(userId, accountId, "viewer", "granting-admin");
    expect(await addUserAccountLink(userId, accountId, "manager")).toBe(false);
    expect(await getUserAccountRole(userId, accountId)).toBe("viewer");
  });

  test("addUserAccountLink records the granting user", async () => {
    const userId = randomUUID();
    const accountId = uniqueAccountId("acc-link-granted");
    await addUserAccountLink(userId, accountId, "editor", "granting-manager");
    expect(await listUserAccountLinks(accountId)).toEqual([
      {
        userId,
        accountId,
        role: "editor",
        grantedByUserId: "granting-manager",
        grantedAt: expect.any(Number)
      }
    ]);
  });

  test("setUserAccountRole creates or updates the membership", async () => {
    const userId = randomUUID();
    const accountId = uniqueAccountId("acc-role");

    const created = await setUserAccountRole(userId, accountId, "editor", "first-grantor");
    expect(created).toMatchObject({ role: "editor", grantedByUserId: "first-grantor" });

    const updated = await setUserAccountRole(userId, accountId, "manager", "second-grantor");
    expect(updated).toMatchObject({
      userId,
      accountId,
      role: "manager",
      grantedByUserId: "second-grantor"
    });
    expect(await listUserAccountLinks(accountId)).toHaveLength(1);
  });

  test("rejects an unknown role", async () => {
    await expect(
      setUserAccountRole(randomUUID(), uniqueAccountId("acc-bad-role"), JSON.parse('"owner"'), null)
    ).rejects.toThrow("Invalid mailbox role: owner");
  });

  test("lists by account and by user, and removes single links", async () => {
    const accountId = uniqueAccountId("acc-list");
    const otherAccountId = uniqueAccountId("acc-list-other");
    const [first, second] = [randomUUID(), randomUUID()].sort();

    await addUserAccountLink(first, accountId, "viewer");
    await addUserAccountLink(second, accountId, "editor");
    await addUserAccountLink(first, otherAccountId, "manager");

    expect((await listUserAccountLinks(accountId)).map((link) => [link.userId, link.role])).toEqual([
      [first, "viewer"],
      [second, "editor"]
    ]);
    expect(
      (await listUserAccountLinksForUser(first)).map((link) => link.accountId).sort()
    ).toEqual([accountId, otherAccountId].sort());
    expect(
      (await getUserAccounts()).filter((link) => link.accountId === accountId)
    ).toHaveLength(2);

    expect(await removeUserAccountLink(first, accountId)).toBe(true);
    expect(await removeUserAccountLink(first, accountId)).toBe(false);
    expect(await getUserAccountRole(first, accountId)).toBeNull();
    expect(await getUserAccountRole(first, otherAccountId)).toBe("manager");

    expect(await deleteUserAccountLinksForUser(first)).toBe(1);
    expect(await listUserAccountLinksForUser(first)).toEqual([]);
    expect(await getUserAccountRole(second, accountId)).toBe("editor");
  });
});

describe("deleteUser", () => {
  test("removes the user with memberships, prefs and MCP tokens in one go", async () => {
    const user = await insertUser({ email: uniqueEmail("delete"), role: "user" });
    const bystander = await insertUser({ email: uniqueEmail("delete-bystander"), role: "user" });
    const accountId = uniqueAccountId("acc-delete");
    await upsertAccount(buildAccount(accountId));
    await addUserAccountLink(user.id, accountId, "editor");
    await addUserAccountLink(bystander.id, accountId, "viewer");
    await mergeUserAccountPrefs(user.id, accountId, { layout: { defaultView: "table" } });
    await mergeUserAccountPrefs(bystander.id, accountId, { layout: { defaultView: "compact" } });
    await insertToken(accountId, user.id);
    const bystanderToken = await insertToken(accountId, bystander.id);

    expect(await deleteUser(user.id)).toBe(true);

    expect(await getUserById(user.id)).toBeNull();
    expect(await listUserAccountLinksForUser(user.id)).toEqual([]);
    expect(await getUserAccountPrefs(user.id, accountId)).toEqual({});
    expect((await listMcpTokens(accountId)).map((token) => token.id)).toEqual([bystanderToken]);
    expect(await getUserAccountRole(bystander.id, accountId)).toBe("viewer");
    expect(await getUserAccountPrefs(bystander.id, accountId)).toEqual({
      layout: { defaultView: "compact" }
    });

    expect(await deleteUser(user.id)).toBe(false);
  });

  test("refuses to orphan an owned mailbox and moves it to reassignOwnerTo", async () => {
    const owner = await insertUser({ email: uniqueEmail("delete-owner"), role: "user" });
    const successor = await insertUser({ email: uniqueEmail("delete-successor"), role: "user" });
    const accountId = uniqueAccountId("acc-owned");
    await upsertAccount(buildAccount(accountId, owner.id));
    await addUserAccountLink(owner.id, accountId, "manager");

    await expect(deleteUser(owner.id)).rejects.toThrow("still owns 1 mailbox(es)");
    expect(await getUserById(owner.id)).not.toBeNull();
    expect(await getUserAccountRole(owner.id, accountId)).toBe("manager");

    expect(await deleteUser(owner.id, { reassignOwnerTo: successor.id })).toBe(true);
    expect((await getAccountById(accountId))?.ownerUserId).toBe(successor.id);
    expect(await getUserById(owner.id)).toBeNull();
  });
});
