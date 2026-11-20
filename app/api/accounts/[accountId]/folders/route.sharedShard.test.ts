import { describe, expect, test } from "bun:test";
import { createSharedShardFixture } from "@/lib/testSharedShardHarness";
import { createAuthenticatedTestSession } from "@/lib/testAuthHarness";
import { FolderAccountMismatchError } from "@/lib/folderAccount";
import { PUT } from "./route";

const origin = "http://localhost:3000";

async function fixture() {
  const pair = await createSharedShardFixture();
  const { a, b } = pair;
  const bInbox = `${b.accountId}:INBOX`;
  await b.api.saveFoldersForAccount(b.accountId, [
    { id: bInbox, accountId: b.accountId, name: "INBOX", count: 3, specialUse: "\\Inbox" }
  ]);
  const user = await createAuthenticatedTestSession();
  await user.addMembership(user.user.id, a.accountId, "manager");
  const put = (body: unknown) => PUT(new Request(`${origin}/api/accounts/${a.accountId}/folders`, {
    method: "PUT",
    headers: user.jar.headers({ origin, "content-type": "application/json" }),
    body: JSON.stringify(body)
  }), { params: Promise.resolve({ accountId: a.accountId }) });
  const bFolder = () => pair.db.prepare("SELECT accountId, name FROM folders WHERE id = ?").get(bInbox);
  return { ...pair, bInbox, put, bFolder };
}

describe("folder catalog writes in a shared shard", () => {
  test("a manager of A cannot take over B's folder row through the route", async () => {
    const { a, b, bInbox, put, bFolder } = await fixture();
    const response = await put([{ id: bInbox, accountId: a.accountId, name: "Taken", count: 0 }]);
    expect(response.status).toBe(400);
    expect(bFolder()).toEqual({ accountId: b.accountId, name: "INBOX" });
    // A parent id from another mailbox is rejected as well.
    const parent = await put([{ id: `${a.accountId}:Child`, parentId: bInbox, accountId: a.accountId, name: "Child", count: 0 }]);
    expect(parent.status).toBe(400);
  });

  test("the database write never re-owns another mailbox's row and rolls back", async () => {
    const { a, b, bInbox, bFolder } = await fixture();
    const aInbox = `${a.accountId}:INBOX`;
    await a.api.saveFoldersForAccount(a.accountId, [{ id: aInbox, accountId: a.accountId, name: "INBOX", count: 0 }]);
    await expect(a.api.saveFoldersForAccount(a.accountId, [
      { id: aInbox, accountId: a.accountId, name: "Renamed", count: 0 },
      { id: bInbox, accountId: a.accountId, name: "Taken", count: 0 }
    ])).rejects.toBeInstanceOf(FolderAccountMismatchError);
    expect(bFolder()).toEqual({ accountId: b.accountId, name: "INBOX" });
    expect((await a.api.getFolders(a.accountId)).map(folder => [folder.id, folder.name])).toEqual([[aInbox, "INBOX"]]);
  });

  test("own folders are still replaced and updated", async () => {
    const { a, put, bFolder, b } = await fixture();
    const aInbox = `${a.accountId}:INBOX`;
    expect((await put([{ id: aInbox, accountId: a.accountId, name: "INBOX", count: 1 }])).status).toBe(200);
    expect((await put([{ id: aInbox, accountId: a.accountId, name: "Posteingang", count: 2 },
      { id: `${a.accountId}:INBOX/Sub`, parentId: aInbox, accountId: a.accountId, name: "Sub", count: 0 }])).status).toBe(200);
    expect((await a.api.getFolders(a.accountId)).map(folder => folder.name).sort()).toEqual(["Posteingang", "Sub"]);
    expect(bFolder()).toEqual({ accountId: b.accountId, name: "INBOX" });
  });
});
