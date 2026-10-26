import { expect, test } from "bun:test";
import { inviteStatus } from "./inviteCodes";

test("multi-use invite remains issued until exhausted, revoked or expired", () => {
  const now = Date.now();
  const invite = { uses: 1, maxUses: 3, revokedAt: null, expiresAt: now + 1000 };
  expect(inviteStatus(invite, now)).toBe("issued");
  expect(inviteStatus({ ...invite, uses: 3 }, now)).toBe("redeemed");
  expect(inviteStatus({ ...invite, uses: 4 }, now)).toBe("redeemed");
  expect(inviteStatus({ ...invite, maxUses: null, uses: 100 }, now)).toBe("issued");
  expect(inviteStatus({ ...invite, revokedAt: now }, now)).toBe("revoked");
  expect(inviteStatus({ ...invite, expiresAt: now }, now)).toBe("expired");
});
