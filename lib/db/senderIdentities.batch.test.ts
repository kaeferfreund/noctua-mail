import { expect, test } from "bun:test";
import { createSharedShardFixture } from "../testSharedShardHarness";
import { getAccountById, getAccountsForUser } from "./accounts";
import { listSenderIdentityRows, listSenderIdentityRowsForAccounts } from "./senderIdentities";

test("batched identity rows equal the per-account reads, incl. shared shard and disabled identities", async () => {
  const { a, b, master } = await createSharedShardFixture();
  const insert = master.prepare(`INSERT INTO sender_identities(id,accountId,email,displayName,isDefault,enabled,createdAt,updatedAt)
    VALUES(?,?,?,?,0,?,0,0)`);
  // NOCASE ordering across case variants, a disabled alias, and rows on both accounts of the shared shard.
  insert.run(`${a.accountId}-z`, a.accountId, "zeta@example.test", "Zeta", 1);
  insert.run(`${a.accountId}-B`, a.accountId, "Beta@example.test", "Beta", 1);
  insert.run(`${a.accountId}-off`, a.accountId, "alpha@example.test", "Disabled", 0);
  insert.run(`${b.accountId}-off`, b.accountId, "shared-off@example.test", "Disabled", 0);
  const ids = [b.accountId, "batch-missing-account", a.accountId, a.accountId];
  const batch = listSenderIdentityRowsForAccounts(master, ids);
  for (const id of new Set(ids)) expect(JSON.stringify(batch.get(id) ?? [])).toBe(JSON.stringify(listSenderIdentityRows(master, id)));
  expect(batch.get(a.accountId)!.some(identity => !identity.enabled)).toBe(true);
  expect([...batch.keys()].sort()).toEqual([a.accountId, b.accountId].sort());
  expect(listSenderIdentityRowsForAccounts(master, []).size).toBe(0);

  // Own addresses through the batched candidate reader match the single-account reader, disabled aliases included.
  const owner = `batch-identity-owner-${crypto.randomUUID()}`;
  master.prepare("UPDATE accounts SET ownerUserId=? WHERE id IN (?,?)").run(owner, a.accountId, b.accountId);
  const accounts = await getAccountsForUser(owner);
  expect(accounts.map(account => account.id).sort()).toEqual([a.accountId, b.accountId].sort());
  for (const account of accounts) expect(JSON.stringify(account)).toBe(JSON.stringify(await getAccountById(account.id)));
  expect(accounts.find(account => account.id === a.accountId)!.ownAddresses).toContain("alpha@example.test");
});
