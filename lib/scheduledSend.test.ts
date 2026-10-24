import { afterEach, describe, expect, jest, test } from "bun:test";
import { dbModulePromise } from "./testDbHarness";
import { createAuthenticatedTestSession } from "./testAuthHarness";
import { identityTestAccount } from "./testFixtures/senderIdentities";
import { getDb } from "./db/connection";
import { newLeaseOwner } from "./db/processLeases";
import {
  cancelScheduledSend, claimDueScheduledSends, createScheduledSend, failInterruptedScheduledSends,
  getScheduledSend, listScheduledSends, releaseDraftSchedules, ScheduledSendBusyError, settleScheduledSend,
  type ScheduledSend
} from "./db/scheduledSends";
import {
  attemptScheduledSend, classifyScheduledSendError, SCHEDULED_SEND_MAX_AHEAD_MS, SCHEDULED_SEND_RETRY_DELAYS_MS,
  validateScheduledSendAt, type ScheduledSendDeps
} from "./scheduledSend";
import { leaseOwnerAlive, ScheduledSendScheduler, SCHEDULED_SEND_TICK_MS } from "./scheduledSendJob";
import { DraftSendError } from "./drafts";
import { authorizeOutbound, OutboundAuthorizationError } from "./outboundAuthorization";
import { SenderIdentityError } from "./senderIdentityError";
import { markSmtpUpstreamFailure } from "./mail/smtpError";
import type { Account } from "./data";

const T0 = Date.UTC(2026, 9, 24, 22, 0);
const mailbox = () => `scheduled-${crypto.randomUUID()}`;
const draft = () => `imap-${crypto.randomUUID()}`;

async function queued(accountId: string, sendAt = T0, draftId = draft()) {
  return createScheduledSend({ accountId, userId: "synthetic-user", draftId, sendAt, now: T0 - 60_000 });
}

function stubDeps(overrides: Partial<ScheduledSendDeps> = {}) {
  const sent: string[] = [];
  let clock = T0;
  const deps: ScheduledSendDeps = {
    now: () => clock,
    getAccount: async (id) => ({ id } as Account),
    resolveRole: async () => "editor",
    assertDraft: async () => ({} as Awaited<ReturnType<ScheduledSendDeps["assertDraft"]>>),
    send: async (params) => { sent.push(params.draftId); return {} as Awaited<ReturnType<ScheduledSendDeps["send"]>>; },
    ...overrides
  };
  return { deps, sent, setClock: (value: number) => { clock = value; } };
}

describe("scheduled_sends store", () => {
  test("one active schedule per draft: rescheduling replaces, list shows queued/sending/failed only", async () => {
    const accountId = mailbox(), draftId = draft();
    const first = await queued(accountId, T0, draftId);
    const second = await queued(accountId, T0 + 60_000, draftId);
    expect((await getScheduledSend(first.id))).toMatchObject({ status: "cancelled", lastError: "rescheduled" });
    expect((await listScheduledSends(accountId)).map(row => row.id)).toEqual([second.id]);
    expect(await cancelScheduledSend(accountId, second.id)).toMatchObject({ status: "cancelled", draftId });
    expect(await cancelScheduledSend(accountId, second.id)).toBeNull();
    expect(await cancelScheduledSend(mailbox(), first.id)).toBeNull();
    expect(await listScheduledSends(accountId)).toEqual([]);
  });

  test("due-row selection claims only due queued rows, each exactly once across owners", async () => {
    const accountId = mailbox();
    const due = await queued(accountId, T0 - 1);
    const exact = await queued(accountId, T0);
    const future = await queued(accountId, T0 + 1);
    const [a, b] = [newLeaseOwner(), newLeaseOwner()];
    const [claimA, claimB] = await Promise.all([claimDueScheduledSends(a, T0, 10), claimDueScheduledSends(b, T0, 10)]);
    const ids = [...claimA, ...claimB].map(row => row.id).filter(id => [due.id, exact.id, future.id].includes(id));
    expect(ids.sort()).toEqual([due.id, exact.id].sort());
    expect((await getScheduledSend(future.id))?.status).toBe("queued");
    const claimed = [...claimA, ...claimB].find(row => row.id === due.id)!;
    expect(claimed).toMatchObject({ status: "sending", attempts: 1 });
    // Only the claiming owner settles; a busy row blocks edits, cancel and rescheduling.
    const other = claimed.leaseOwner === a ? b : a;
    expect(await settleScheduledSend(due.id, other, { status: "sent", reason: null })).toBe(false);
    await expect(releaseDraftSchedules(accountId, claimed.draftId, "edited")).rejects.toBeInstanceOf(ScheduledSendBusyError);
    await expect(cancelScheduledSend(accountId, due.id)).rejects.toBeInstanceOf(ScheduledSendBusyError);
    await expect(queued(accountId, T0 + 5, claimed.draftId)).rejects.toBeInstanceOf(ScheduledSendBusyError);
    expect(await settleScheduledSend(due.id, claimed.leaseOwner!, { status: "sent", reason: null })).toBe(true);
    expect(await releaseDraftSchedules(accountId, claimed.draftId, "edited")).toBe(0);
  });

  test("an interrupted claim of a dead process fails and is never re-sent; a live owner keeps it", async () => {
    const accountId = mailbox();
    const row = await queued(accountId, T0 - 1);
    const dead = `999999999:${crypto.randomUUID()}`;
    await claimDueScheduledSends(dead, T0, 100);
    const live = newLeaseOwner();
    expect(await failInterruptedScheduledSends(live, owner => owner !== dead, T0)).toBeGreaterThanOrEqual(1);
    expect(await getScheduledSend(row.id)).toMatchObject({ status: "failed", lastError: "interrupted", leaseOwner: null });
    expect((await claimDueScheduledSends(live, T0 + 3_600_000, 100)).some(item => item.id === row.id)).toBe(false);
    // An earlier incarnation of this pid (container restart) is dead; a foreign live pid is not.
    expect(leaseOwnerAlive(`${process.pid}:${crypto.randomUUID()}`, live)).toBe(false);
    expect(leaseOwnerAlive(live, live)).toBe(true);
    expect(leaseOwnerAlive(`999999999:${crypto.randomUUID()}`, live)).toBe(false);
  });
});

describe("scheduled send rules", () => {
  test("sendAt must be a future integer within one year", () => {
    expect(validateScheduledSendAt(T0 + 1, T0)).toEqual({ ok: true, sendAt: T0 + 1 });
    expect(validateScheduledSendAt(T0, T0)).toEqual({ ok: false, reason: "past" });
    expect(validateScheduledSendAt(T0 - 60_000, T0)).toEqual({ ok: false, reason: "past" });
    expect(validateScheduledSendAt(T0 + SCHEDULED_SEND_MAX_AHEAD_MS, T0).ok).toBe(true);
    expect(validateScheduledSendAt(T0 + SCHEDULED_SEND_MAX_AHEAD_MS + 1, T0)).toEqual({ ok: false, reason: "too_far" });
    for (const value of ["2026-10-25T08:00:00Z", 1.5, Number.NaN, null]) expect(validateScheduledSendAt(value, T0)).toEqual({ ok: false, reason: "invalid" });
  });

  test("retry 3x with 1/5/15 minute backoff, then failed; permanent problems never retry", () => {
    const row = (attempts: number) => ({ attempts } as ScheduledSend);
    const transient = new Error("synthetic network failure");
    expect(classifyScheduledSendError(transient, row(1), T0)).toEqual({ status: "queued", reason: "send_failed", nextAttemptAt: T0 + 60_000 });
    expect(classifyScheduledSendError(transient, row(2), T0)).toEqual({ status: "queued", reason: "send_failed", nextAttemptAt: T0 + 5 * 60_000 });
    expect(classifyScheduledSendError(transient, row(3), T0)).toEqual({ status: "queued", reason: "send_failed", nextAttemptAt: T0 + 15 * 60_000 });
    expect(classifyScheduledSendError(transient, row(4), T0)).toEqual({ status: "failed", reason: "send_failed" });
    expect(SCHEDULED_SEND_RETRY_DELAYS_MS).toEqual([60_000, 300_000, 900_000]);
    const rejected = markSmtpUpstreamFailure(Object.assign(new Error("550 recipient rejected"), { responseCode: 550, code: "EENVELOPE", command: "RCPT TO" }));
    expect(classifyScheduledSendError(rejected, row(1), T0)).toEqual({ status: "failed", reason: "smtp_rejected" });
    const temporary = markSmtpUpstreamFailure(Object.assign(new Error("451 try later"), { responseCode: 451, code: "EENVELOPE" }));
    expect(classifyScheduledSendError(temporary, row(1), T0).status).toBe("queued");
    const stalled = markSmtpUpstreamFailure(Object.assign(new Error("Timeout"), { code: "ETIMEDOUT" }));
    expect(classifyScheduledSendError(stalled, row(1), T0)).toEqual({ status: "failed", reason: "send_uncertain" });
    expect(classifyScheduledSendError(new DraftSendError(404, "gone"), row(1), T0)).toEqual({ status: "cancelled", reason: "draft_missing" });
    expect(classifyScheduledSendError(new DraftSendError(400, "no recipients"), row(1), T0)).toEqual({ status: "failed", reason: "draft_invalid" });
    expect(classifyScheduledSendError(new SenderIdentityError("identity_unavailable", 409, "off"), row(1), T0)).toEqual({ status: "cancelled", reason: "identity_unavailable" });
    expect(classifyScheduledSendError(new OutboundAuthorizationError(Response.json({}) as never), row(1), T0)).toEqual({ status: "cancelled", reason: "permission_revoked" });
  });

  test("permission re-check at send time: a revoked or viewer user is cancelled without sending", async () => {
    for (const role of [null, "viewer"] as const) {
      const { deps, sent } = stubDeps({ resolveRole: async () => role });
      expect(await attemptScheduledSend({ id: "s", accountId: "a", userId: "u", draftId: "d", attempts: 1 } as ScheduledSend, deps))
        .toEqual({ status: "cancelled", reason: "permission_revoked" });
      expect(sent).toEqual([]);
    }
    const { deps, sent } = stubDeps({ getAccount: async () => null });
    expect(await attemptScheduledSend({ attempts: 1 } as ScheduledSend, deps)).toEqual({ status: "cancelled", reason: "account_missing" });
    expect(sent).toEqual([]);
  });

  test("the send-time authorization uses the scheduling user's live role and identity", async () => {
    const db = await dbModulePromise;
    const accountId = mailbox();
    await db.upsertAccount(identityTestAccount(accountId));
    const auth = await createAuthenticatedTestSession(accountId);
    const [identity] = await db.listSenderIdentities(accountId);
    const actor = await authorizeOutbound({ scheduledByUserId: auth.user.id }, { accountId, minRole: "editor", identity });
    expect(actor).toMatchObject({ userId: auth.user.id, clientId: "scheduled-send" });
    const master = await getDb();
    actor.assertCurrent(master);
    await db.setUserAccountRole(auth.user.id, accountId, "viewer", auth.user.id);
    expect(() => actor.assertCurrent(master)).toThrow(OutboundAuthorizationError);
    await expect(authorizeOutbound({ scheduledByUserId: "unknown-user" }, { accountId, minRole: "editor" })).rejects.toBeInstanceOf(OutboundAuthorizationError);
    await db.setUserAccountRole(auth.user.id, accountId, "editor", auth.user.id);
    await expect(authorizeOutbound({ scheduledByUserId: auth.user.id }, { accountId, minRole: "editor", identity: { ...identity, displayName: "Changed" } }))
      .rejects.toMatchObject({ code: "draft_identity_changed" });
  });
});

describe("scheduled send job", () => {
  afterEach(() => { jest.useRealTimers(); });

  test("resume sends overdue rows immediately, later rows within one tick, retries on backoff", async () => {
    const accountId = mailbox();
    const overdue = await queued(accountId, T0 - 3_600_000);
    const later = await queued(accountId, T0 + 20_000);
    const flaky = await queued(accountId, T0 - 1);
    let flakyCalls = 0;
    const { deps, sent, setClock } = stubDeps({
      send: async (params) => {
        if (![overdue.draftId, later.draftId, flaky.draftId].includes(params.draftId)) throw new DraftSendError(404, "foreign row");
        if (params.draftId === flaky.draftId && ++flakyCalls < 3) throw new Error("synthetic transient failure");
        expect(params.authorization).toEqual({ scheduledByUserId: "synthetic-user" });
        sent.push(params.draftId);
        return {} as Awaited<ReturnType<ScheduledSendDeps["send"]>>;
      }
    });
    jest.useFakeTimers();
    const scheduler = new ScheduledSendScheduler(deps);
    await scheduler.tick();
    expect(sent).toEqual([overdue.draftId]);
    expect(await getScheduledSend(flaky.id)).toMatchObject({ status: "queued", attempts: 1, nextAttemptAt: T0 + 60_000 });
    setClock(T0 + 15_000);
    jest.advanceTimersByTime(SCHEDULED_SEND_TICK_MS);
    await scheduler.tick();
    expect(sent).toEqual([overdue.draftId]);
    setClock(T0 + 30_000);
    jest.advanceTimersByTime(SCHEDULED_SEND_TICK_MS);
    await scheduler.tick();
    expect(sent).toEqual([overdue.draftId, later.draftId]);
    setClock(T0 + 60_000);
    await scheduler.tick();
    expect(await getScheduledSend(flaky.id)).toMatchObject({ status: "queued", attempts: 2, nextAttemptAt: T0 + 60_000 + 300_000 });
    setClock(T0 + 360_000);
    await scheduler.tick();
    expect(sent).toEqual([overdue.draftId, later.draftId, flaky.draftId]);
    for (const row of [overdue, later, flaky]) expect((await getScheduledSend(row.id))?.status).toBe("sent");
    await scheduler.stop();
  });
});
