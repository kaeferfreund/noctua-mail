import { getSharedTestAuthHarness } from "../testAuthHarness";
import { randomUUID } from "crypto";
import { describe, expect, test } from "bun:test";
import type { Account } from "../data";
import { dbModulePromise } from "../testDbHarness";

const {
  addUserAccountLink,
  deleteUser,
  deleteUserAccountLinksForUser,
  getAccountById,
  getUserAccountPrefs,
  getUserAccountRole,
  getUserAccounts,
  getUserById,
  getUsers,
  insertMcpToken,
  listMcpTokens,
  listUserAccountLinks,
  listUserAccountLinksForUser,
  mergeUserAccountPrefs,
  normalizeUserEmail,
  removeUserAccountLink,
  setUserAccountRole,
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
    // removeUserAccountLink resolves the remaining role against auth_user; production migrates it at startup.
    await getSharedTestAuthHarness();
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
    const user = await createFixtureUser({ email: uniqueEmail("delete"), role: "user" });
    const bystander = await createFixtureUser({ email: uniqueEmail("delete-bystander"), role: "user" });
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
    const owner = await createFixtureUser({ email: uniqueEmail("delete-owner"), role: "user" });
    const successor = await createFixtureUser({ email: uniqueEmail("delete-successor"), role: "user" });
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

async function createFixtureUser(input: {email:string; role:"user"|"admin"}) {
  return (await getSharedTestAuthHarness()).createUser(input.email, undefined, input.role);
}

describe("authoritative joined user DTO",()=>{
  test("reads auth name, role, active ban and factor state without selecting secrets",async()=>{
    const h=await getSharedTestAuthHarness(); const user=await h.createUser(uniqueEmail("dto"));
    const {withDbWriteRetry}=await import("../dbWriteRetry");
    await withDbWriteRetry("test.dto",()=>{
      h.master.prepare("UPDATE auth_user SET name='Authoritative',role='admin',twoFactorEnabled=1,banned=1,banExpires=NULL WHERE id=?").run(user.id);
      h.master.prepare("UPDATE users SET role='user' WHERE id=?").run(user.id);
    });
    const dto=await getUserById(user.id);
    expect(dto).toEqual({id:user.id,email:user.email,name:"Authoritative",role:"admin",createdAt:expect.any(Number),hasPassword:true,twoFactorEnabled:true,passkeyCount:0,disabled:true,uiLocale:null});
    expect(Number.isInteger(dto!.createdAt)).toBe(true);
    expect(JSON.stringify(dto)).not.toMatch(/passwordHash|passwordUpdatedAt|mustChangePassword|disabledAt|sessionToken|secret|backupCodes/);
    await withDbWriteRetry("test.dto",()=>h.master.prepare("UPDATE auth_user SET banExpires=? WHERE id=?").run(new Date(Date.now()-1000).toISOString(),user.id));
    expect((await getUserById(user.id))!.disabled).toBe(false);
  });
});
