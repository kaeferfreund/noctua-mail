import { randomUUID } from "crypto";
import { describe, expect, test } from "bun:test";
import { dbModulePromise } from "../testDbHarness";

const { deleteMcpTokensForUser, getMcpTokenByHash, insertMcpToken, listMcpTokens } =
  await dbModulePromise;

async function insertToken(accountId: string, createdByUserId: string) {
  const id = randomUUID();
  await insertMcpToken({
    id,
    accountId,
    createdByUserId,
    label: "Tokens test",
    tokenHash: `hash-${id}`,
    tokenSuffix: id.slice(-4),
    createdAt: Date.now(),
    expiresAt: null
  });
  return id;
}

describe("deleteMcpTokensForUser", () => {
  test("revokes the user's tokens on every mailbox and keeps everyone else's", async () => {
    const userId = randomUUID();
    const otherUserId = randomUUID();
    const accountId = `acc-tokens-${randomUUID()}`;
    const otherAccountId = `acc-tokens-${randomUUID()}`;
    const revokedA = await insertToken(accountId, userId);
    const revokedB = await insertToken(otherAccountId, userId);
    const kept = await insertToken(accountId, otherUserId);

    expect(await deleteMcpTokensForUser(userId)).toBe(2);

    expect((await listMcpTokens(accountId)).map((token) => token.id)).toEqual([kept]);
    expect(await listMcpTokens(otherAccountId)).toEqual([]);
    expect(await getMcpTokenByHash(`hash-${revokedA}`)).toBeNull();
    expect(await getMcpTokenByHash(`hash-${revokedB}`)).toBeNull();
    expect(await deleteMcpTokensForUser(userId)).toBe(0);
  });
});
