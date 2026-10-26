import { expect, test } from "bun:test";
import { createScheduledSendFixture } from "./testFixtures/scheduledSendDrafts";
import { advanceSecurityGeneration } from "./db/authPolicy";
import { claimDueScheduledSends, createScheduledSend, getScheduledSend, listScheduledSends,
  cancelScheduledSend, settleScheduledSend, processScheduleOwner } from "./db/scheduledSends";
import { attemptScheduledSend, type ScheduledSendAuthorization, type ScheduledSendDeps } from "./scheduledSend";
import { authorizeOutbound } from "./outboundAuthorization";

for (const action of ["password", "revoke-all"] as const) test(`${action} cancels open schedules atomically and preserves a live send lease`, async () => {
  const f = await createScheduledSendFixture();
  const now = Date.now();
  const create = (sendAt: number) => createScheduledSend({ accountId: f.accountId, userId: f.user.id,
    draftId: crypto.randomUUID(), sendAt });
  const queued = await create(now + 3_600_000);
  const active = await create(now - 1);
  const claimed = (await claimDueScheduledSends(processScheduleOwner(), now, 1000)).find(row => row.id === active.id)!;
  let token: ScheduledSendAuthorization | undefined;
  await attemptScheduledSend(claimed, { getAccount: () => f.db.getAccountById(f.accountId), resolveRole: async () => "editor",
    assertDraft: async () => ({}), send: async params => { token = params.authorization as ScheduledSendAuthorization; return {}; }, now: () => now } as ScheduledSendDeps);
  const actor = await authorizeOutbound(token!, { accountId: f.accountId, minRole: "editor" });
  f.master.transaction(() => {
    if (action === "password") f.master.query("UPDATE auth_account SET password='synthetic-changed-hash' WHERE userId=? AND providerId='credential'").run(f.user.id);
    else advanceSecurityGeneration(f.master, f.user.id);
  }).immediate();
  expect(await getScheduledSend(queued.id)).toMatchObject({ status: "cancelled", lastError: "security_revoked" });
  expect(await getScheduledSend(active.id)).toMatchObject({ status: "sending", lastError: "security_revoked", leaseOwner: claimed.leaseOwner });
  expect(() => actor.assertCurrent(f.master)).toThrow();
  // A retry proposed by a worker that raced revocation cannot revive the schedule.
  await settleScheduledSend(active.id, claimed.leaseOwner!, { status: "queued", reason: "send_failed", nextAttemptAt: now + 60_000 });
  expect(await getScheduledSend(active.id)).toMatchObject({ status: "cancelled", lastError: "security_revoked" });
  expect((await listScheduledSends(f.accountId)).map(row => row.id).sort()).toEqual([active.id, queued.id].sort());
  await cancelScheduledSend(f.accountId, queued.id);
  expect((await listScheduledSends(f.accountId)).map(row => row.id)).toEqual([active.id]);
});
