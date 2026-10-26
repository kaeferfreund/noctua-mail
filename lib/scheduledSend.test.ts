import { afterEach, describe, expect, jest, test } from "bun:test";
import { dbModulePromise } from "./testDbHarness";
import { createAuthenticatedTestSession } from "./testAuthHarness";
import { identityTestAccount } from "./testFixtures/senderIdentities";
import { getDb } from "./db/connection";
import { newLeaseOwner } from "./db/processLeases";
import {
  cancelScheduledSend, claimDueScheduledSends, createScheduledSend, failInterruptedScheduledSends, finishDraftScheduleHold,
  getScheduledSend, holdDraftSchedules, listScheduledSends, processScheduleOwner, SCHEDULED_SEND_LEASE_MAX_MS,
  ScheduledSendAlreadySentError, ScheduledSendBusyError, pruneScheduledSends, scheduleLeaseOwnerAlive, settleScheduledSend, type ScheduledSend
} from "./db/scheduledSends";
import {
  attemptScheduledSend, classifyScheduledSendError, SCHEDULED_SEND_MAX_AHEAD_MS, SCHEDULED_SEND_RETRY_DELAYS_MS,
  validateScheduledSendAt, type ScheduledSendDeps, type ScheduledSendAuthorization
} from "./scheduledSend";
import { ScheduledSendScheduler, SCHEDULED_SEND_TICK_MS } from "./scheduledSendJob";
import { DraftSendError } from "./drafts";
import { authorizeOutbound, OutboundAuthorizationError } from "./outboundAuthorization";
import { SenderIdentityError } from "./senderIdentityError";
import { markSmtpUpstreamFailure, smtpFailedBeforeData, smtpOutcomeUncertain } from "./mail/smtpError";
import type { Account } from "./data";

// Lease ages are checked against the real clock by manual holds: keep test time "now".
const T0 = Math.floor(Date.now() / 60_000) * 60_000;
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

  test("reasoned cancellations remain visible until dismissed or re-planned, including after history pruning", async () => {
    const accountId = mailbox();
    const row = await queued(accountId);
    const owner = processScheduleOwner();
    await claimDueScheduledSends(owner, T0, 1000);
    await settleScheduledSend(row.id, owner, { status: "cancelled", reason: "identity_unavailable" }, T0);
    await pruneScheduledSends(T0 + 1);
    expect((await listScheduledSends(accountId)).map(item => item.id)).toEqual([row.id]);
    const replacement = await queued(accountId, T0 + 3_600_000, row.draftId);
    expect((await listScheduledSends(accountId)).map(item => item.id)).toEqual([replacement.id]);
    await cancelScheduledSend(accountId, replacement.id);
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
    await expect(holdDraftSchedules(accountId, claimed.draftId, "manual-a", false, T0)).rejects.toBeInstanceOf(ScheduledSendBusyError);
    await expect(cancelScheduledSend(accountId, due.id, T0)).rejects.toBeInstanceOf(ScheduledSendBusyError);
    await expect(queued(accountId, T0 + 5, claimed.draftId)).rejects.toBeInstanceOf(ScheduledSendBusyError);
    expect(await settleScheduledSend(due.id, claimed.leaseOwner!, { status: "sent", reason: null })).toBe(true);
    // Re-planning during a failed/pending Sent copy must not send a second copy either.
    await expect(queued(accountId, T0 + 3_600_000, claimed.draftId)).rejects.toBeInstanceOf(ScheduledSendAlreadySentError);
    // After the schedule sent the draft, an edit holds nothing and a manual send is refused.
    expect(await holdDraftSchedules(accountId, claimed.draftId, "manual-b", false, T0)).toBe(0);
    await expect(holdDraftSchedules(accountId, claimed.draftId, "manual-c", true, T0)).rejects.toBeInstanceOf(ScheduledSendAlreadySentError);
  });

  test("a manual hold keeps the job away and settles: done closes, restore re-queues, uncertain fails", async () => {
    const accountId = mailbox();
    for (const [outcome, expected] of [
      [{ kind: "done", reason: "sent_now" }, { status: "sent", lastError: "sent_now" }],
      [{ kind: "restore" }, { status: "queued", lastError: null, leaseOwner: null }],
      [{ kind: "uncertain" }, { status: "failed", lastError: "send_uncertain" }]
    ] as const) {
      const row = await queued(accountId, T0 - 1);
      const owner = `${processScheduleOwner()}/manual:${crypto.randomUUID()}`;
      expect(await holdDraftSchedules(accountId, row.draftId, owner, true, T0)).toBe(1);
      expect((await claimDueScheduledSends(newLeaseOwner(), T0, 100)).some(item => item.id === row.id)).toBe(false);
      expect(await failInterruptedScheduledSends(undefined, T0)).toBeGreaterThanOrEqual(0);
      expect((await getScheduledSend(row.id))?.status).toBe("sending");
      await finishDraftScheduleHold(accountId, row.draftId, "someone-else", { kind: "restore" }, T0);
      expect((await getScheduledSend(row.id))?.status).toBe("sending");
      await finishDraftScheduleHold(accountId, row.draftId, owner, outcome, T0);
      expect(await getScheduledSend(row.id)).toMatchObject(expected);
      if (outcome.kind === "restore") await cancelScheduledSend(accountId, row.id, T0);
    }
  });

  test("a stale lease (pid reused or holder hung) becomes failed/interrupted and unblocks the draft", async () => {
    const accountId = mailbox();
    const row = await queued(accountId, T0 - 1);
    // A live foreign pid (our parent) holds the lease: younger than the limit it still blocks.
    const reused = `${process.ppid}:${crypto.randomUUID()}`;
    await claimDueScheduledSends(reused, T0, 100);
    expect(scheduleLeaseOwnerAlive(reused)).toBe(true);
    expect(await failInterruptedScheduledSends(undefined, T0 + SCHEDULED_SEND_LEASE_MAX_MS - 1)).toBeGreaterThanOrEqual(0);
    expect((await getScheduledSend(row.id))?.status).toBe("sending");
    await expect(holdDraftSchedules(accountId, row.draftId, "manual", false, T0 + 60_000)).rejects.toBeInstanceOf(ScheduledSendBusyError);
    // Past the limit any caller expires it — no 409 forever, and it is never re-sent.
    expect(await holdDraftSchedules(accountId, row.draftId, "manual", false, T0 + SCHEDULED_SEND_LEASE_MAX_MS)).toBe(0);
    expect(await getScheduledSend(row.id)).toMatchObject({ status: "failed", lastError: "interrupted", leaseOwner: null });
    expect((await claimDueScheduledSends(newLeaseOwner(), T0 + 3_600_000, 100)).some(item => item.id === row.id)).toBe(false);
    // The failed row is offered for „Planung aufheben“.
    expect((await listScheduledSends(accountId)).map(item => item.id)).toEqual([row.id]);
    expect(await cancelScheduledSend(accountId, row.id, T0)).toMatchObject({ status: "cancelled" });

    const second = await queued(accountId, T0 - 1);
    await claimDueScheduledSends(reused, T0, 100);
    expect(await failInterruptedScheduledSends(undefined, T0 + SCHEDULED_SEND_LEASE_MAX_MS)).toBeGreaterThanOrEqual(1);
    expect(await getScheduledSend(second.id)).toMatchObject({ status: "failed", lastError: "interrupted" });
  });

  test("an abandoned manual hold explains the interrupted draft operation", async () => {
    const accountId = mailbox();
    const row = await queued(accountId);
    await holdDraftSchedules(accountId, row.draftId, `${processScheduleOwner()}/manual:synthetic`, false, T0);
    await failInterruptedScheduledSends(undefined, T0 + SCHEDULED_SEND_LEASE_MAX_MS);
    expect(await getScheduledSend(row.id)).toMatchObject({ status: "failed", lastError: "manual_interrupted" });
    expect((await claimDueScheduledSends(newLeaseOwner(), T0 + 3_600_000, 1000)).some(item => item.id === row.id)).toBe(false);
  });

  test("an interrupted claim of a dead process fails and is never re-sent; a live owner keeps it", async () => {
    const accountId = mailbox();
    const row = await queued(accountId, T0 - 1);
    const dead = `999999999:${crypto.randomUUID()}`;
    await claimDueScheduledSends(dead, T0, 100);
    const live = newLeaseOwner();
    expect(await failInterruptedScheduledSends(owner => owner !== dead, T0)).toBeGreaterThanOrEqual(1);
    expect(await getScheduledSend(row.id)).toMatchObject({ status: "failed", lastError: "interrupted", leaseOwner: null });
    expect((await claimDueScheduledSends(live, T0 + 3_600_000, 100)).some(item => item.id === row.id)).toBe(false);
    // An earlier incarnation of this pid (container restart) is dead; this process and its manual holds are alive.
    expect(scheduleLeaseOwnerAlive(`${process.pid}:${crypto.randomUUID()}`, live)).toBe(false);
    expect(scheduleLeaseOwnerAlive(live, live)).toBe(true);
    expect(scheduleLeaseOwnerAlive(`${live}/manual:${crypto.randomUUID()}`, live)).toBe(true);
    expect(scheduleLeaseOwnerAlive(`999999999:${crypto.randomUUID()}`, live)).toBe(false);
  });
});

describe("scheduled send rules", () => {
  test("sendAt must be a future integer within one year", () => {
    expect(validateScheduledSendAt(T0 + 60_000, T0)).toEqual({ ok: true, sendAt: T0 + 60_000 });
    expect(validateScheduledSendAt(T0 + 59_999, T0)).toEqual({ ok: false, reason: "too_soon" });
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
    const smtp = (fields: Record<string, unknown>) => markSmtpUpstreamFailure(Object.assign(new Error("synthetic SMTP failure"), fields));
    // Provably before DATA: retried.
    for (const before of [
      smtp({ code: "ETIMEDOUT", timeoutType: "CONNECTION_TIMEOUT", command: "CONN" }),
      smtp({ code: "ETIMEDOUT", timeoutType: "GREETING_TIMEOUT", command: "CONN" }),
      smtp({ code: "ESOCKET", originalCode: "ECONNREFUSED", command: "CONN" }),
      smtp({ code: "EDNS", command: "CONN" }),
      smtp({ code: "EAUTH", command: "AUTH PLAIN", responseCode: 535 }),
      smtp({ code: "EENVELOPE", command: "RCPT TO", responseCode: 451 }),
      smtp({ code: "EENVELOPE", command: "DATA", responseCode: 451 })
    ]) {
      expect(smtpFailedBeforeData(before)).toBe(true);
      expect(smtpOutcomeUncertain(before)).toBe(false);
      expect(classifyScheduledSendError(before, row(1), T0).status).toBe("queued");
    }
    // During/after DATA or of unknown phase: never retried, the user checks Sent.
    for (const after of [
      smtp({ code: "ETIMEDOUT", timeoutType: "SOCKET_TIMEOUT", command: "CONN" }),
      smtp({ code: "ETIMEDOUT" }),
      smtp({ code: "ECONNECTION", command: "CONN", message: "Connection closed unexpectedly" }),
      smtp({ code: "ESOCKET", originalCode: "ECONNRESET", command: "CONN" }),
      smtp({ code: "EMESSAGE", command: "DATA", responseCode: 451 }),
      smtp({ code: "EPROTOCOL", command: "CONN" }),
      smtp({})
    ]) {
      expect(smtpFailedBeforeData(after)).toBe(false);
      expect(smtpOutcomeUncertain(after)).toBe(true);
      expect(classifyScheduledSendError(after, row(1), T0)).toEqual({ status: "failed", reason: "send_uncertain" });
    }
    // An explicit 5xx rejection after DATA was not delivered: final, not uncertain.
    const refused = smtp({ code: "EMESSAGE", command: "DATA", responseCode: 554 });
    expect(smtpOutcomeUncertain(refused)).toBe(false);
    expect(classifyScheduledSendError(refused, row(1), T0)).toEqual({ status: "failed", reason: "smtp_rejected" });
    expect(smtpOutcomeUncertain(new Error("not an SMTP failure"))).toBe(false);
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
    const row = await createScheduledSend({ accountId, userId: auth.user.id, draftId: draft(), sendAt: T0 });
    const claimed = (await claimDueScheduledSends(processScheduleOwner(), T0, 1000)).find(item => item.id === row.id)!;
    let token: ScheduledSendAuthorization | undefined;
    const { deps } = stubDeps({ send: async params => {
      token = params.authorization as ScheduledSendAuthorization;
      return {} as Awaited<ReturnType<ScheduledSendDeps["send"]>>;
    } });
    expect(await attemptScheduledSend(claimed, deps)).toEqual({ status: "sent", reason: null });
    await expect(authorizeOutbound({ ...token! }, { accountId, minRole: "editor", identity })).rejects.toBeInstanceOf(OutboundAuthorizationError);
    const actor = await authorizeOutbound(token!, { accountId, minRole: "editor", identity });
    expect(actor).toMatchObject({ userId: auth.user.id, clientId: "scheduled-send" });
    const master = await getDb();
    actor.assertCurrent(master);
    await db.setUserAccountRole(auth.user.id, accountId, "viewer", auth.user.id);
    expect(() => actor.assertCurrent(master)).toThrow(OutboundAuthorizationError);
    await expect(authorizeOutbound({ scheduledByUserId: auth.user.id } as ScheduledSendAuthorization, { accountId, minRole: "editor" })).rejects.toBeInstanceOf(OutboundAuthorizationError);
    await db.setUserAccountRole(auth.user.id, accountId, "editor", auth.user.id);
    await expect(authorizeOutbound(token!, { accountId, minRole: "editor", identity: { ...identity, displayName: "Changed" } }))
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
        expect(params.authorization).toMatchObject({ scheduledByUserId: "synthetic-user", scheduleId: expect.any(String) });
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

test("a manual send cannot resume an expired hold after another operation took over", async () => {
  const { holdScheduleForDraftChange } = await import("./drafts");
  const accountId = mailbox(), draftId = draft();
  const original = await queued(accountId, Date.now() + 3_600_000, draftId);
  const hold = await holdScheduleForDraftChange(accountId, draftId, "sent_now");
  hold.assertCurrent();
  const db = await getDb();
  db.query("UPDATE scheduled_sends SET leaseStartedAt=? WHERE id=?").run(Date.now() - SCHEDULED_SEND_LEASE_MAX_MS - 1, original.id);
  await failInterruptedScheduledSends();
  const replacement = await queued(accountId, Date.now() + 3_600_000, draftId);
  expect(() => hold.assertCurrent()).toThrow(ScheduledSendBusyError);
  await hold.abort(new Error("stopped before SMTP"));
  expect(await getScheduledSend(replacement.id)).toMatchObject({ status: "queued" });
});
