import { afterAll, beforeAll, expect } from "bun:test";
import { isolatedImapTest } from "@/lib/testFixtures/isolatedImapTest";
import { createServer, type Server } from "node:net";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createScheduledSendFixture, SCHEDULED_SEND_TEST_ORIGIN as ORIGIN } from "@/lib/testFixtures/scheduledSendDrafts";
import { createAuthenticatedTestSession } from "@/lib/testAuthHarness";
import { startSmtpSink } from "@/lib/testFixtures/mail/smtp-sink";
import { demoPass, demoUser } from "@/lib/testFixtures/mail/seed";
import { claimDueScheduledSends, getScheduledSend } from "@/lib/db";
import { cancelDraftSchedule, releaseDraftScheduleForEdit } from "@/app/components/mailclient/scheduledSend/scheduledSendClient";
import { ScheduledSendScheduler } from "@/lib/scheduledSendJob";
import { defaultScheduledSendDeps } from "@/lib/scheduledSend";
import type { Account } from "@/lib/data";
import { POST as smtpSend } from "./route";
import { POST as sendNow } from "../../drafts/[draftId]/send/route";
import { POST as saveDraft } from "../../drafts/save/route";
import { GET as listScheduled, POST as schedule } from "../../drafts/scheduled/route";
import { POST as cancelScheduled } from "../../drafts/scheduled/[scheduleId]/cancel/route";

// Real SMTP/IMAP sockets need a module graph without other files' IMAP mocks: each case runs in a child.
const realMailTest = (name: string, run: () => Promise<void>) =>
  isolatedImapTest(import.meta.url, "NOCTUA_SCHEDULED_SEND_MAIL_FIXTURE", name, run);
const inChild = process.env.NOCTUA_SCHEDULED_SEND_MAIL_FIXTURE === "1";
// A live job process other than this one (the test runner's parent) holds job claims.
const jobOwner = () => `${process.ppid}:${crypto.randomUUID()}`;
// Post-send IMAP work (Sent copy) targets a closed local port: bound it so it fails fast.
process.env.NOCTUA_POST_SEND_TIMEOUT_MS = "3000";

let sink: Awaited<ReturnType<typeof startSmtpSink>>;
let closedPort = 0;
let droppingServer: Server;
let droppingPort = 0;

/** Accepts the whole message, then drops the connection before answering „250“ to the final dot. */
function startDroppingSmtp() {
  return new Promise<Server>(resolve => {
    const server = createServer(socket => {
      let buffer = "", inData = false;
      socket.write("220 synthetic.example.test ESMTP\r\n");
      socket.on("data", chunk => {
        buffer += chunk.toString("latin1");
        if (inData) {
          if (buffer.includes("\r\n.\r\n")) socket.destroy();
          return;
        }
        let index: number;
        while ((index = buffer.indexOf("\r\n")) >= 0) {
          const line = buffer.slice(0, index); buffer = buffer.slice(index + 2);
          const verb = line.split(" ", 1)[0].toUpperCase();
          if (verb === "EHLO" || verb === "HELO") socket.write("250-synthetic.example.test\r\n250 AUTH PLAIN LOGIN\r\n");
          else if (verb === "AUTH") socket.write("235 ok\r\n");
          else if (verb === "DATA") { socket.write("354 go ahead\r\n"); inData = true; return; }
          else socket.write("250 ok\r\n");
        }
      });
      socket.on("error", () => {});
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

beforeAll(async () => {
  // The parent only spawns the children; the mail servers live in each child.
  if (!inChild) return;
  sink = await startSmtpSink({ host: "127.0.0.1", port: 0, out: mkdtempSync(path.join(tmpdir(), "scheduled-send-sink-")) });
  const probe = createServer();
  closedPort = await new Promise<number>(resolve => probe.listen(0, "127.0.0.1", () => {
    const port = (probe.address() as { port: number }).port;
    probe.close(() => resolve(port));
  }));
  droppingServer = await startDroppingSmtp();
  droppingPort = (droppingServer.address() as { port: number }).port;
});
afterAll(async () => {
  if (!inChild) return;
  await sink.stop();
  await new Promise<void>(resolve => droppingServer.close(() => resolve()));
});

const local = (smtpPort: number): Partial<Account> => ({
  smtp: { host: "127.0.0.1", port: smtpPort, secure: false, user: demoUser, password: demoPass },
  imap: { host: "127.0.0.1", port: closedPort, secure: false, user: demoUser, password: demoPass }
});

async function setup(smtpPort = sink.port) {
  const f = await createScheduledSendFixture(local(smtpPort));
  const draftId = await f.seedDraft();
  const sendAt = Date.now() + 3_600_000;
  const created = await schedule(f.request("POST", { draftId, sendAt }), f.params());
  expect(created.status).toBe(201);
  const { scheduledSend } = await created.json();
  const compose = (extra: Record<string, unknown> = {}) => smtpSend(f.request("POST", {
    identityId: f.identity.id, to: "recipient@example.test", subject: "Synthetic planned", text: "Synthetic body", draftId, ...extra
  }, {}, f, "/smtp/send"), f.params());
  const sendDraftNow = () => sendNow(f.request("POST", {}, {}, f, `/drafts/${draftId}/send`), f.params({ draftId }));
  return { f, draftId, sendAt, scheduleId: scheduledSend.id as string, compose, sendDraftNow };
}
const delivered = (subject: string) => sink.received.filter(mail => mail.source.toString().includes(subject)).length;

// Manual send vs. scheduled send (isolatedImapTest matches top-level test names).
realMailTest("compose „Senden“ with the draft id records a sent receipt; repeat sends cannot reach SMTP", async () => {
  const s = await setup();
  const before = delivered("Synthetic planned");
  const response = await s.compose();
  expect(response.status).toBe(200);
  expect(delivered("Synthetic planned")).toBe(before + 1);
  expect(await getScheduledSend(s.scheduleId)).toMatchObject({ status: "sent", lastError: "sent_now", leaseOwner: null });
  expect((await claimDueScheduledSends(jobOwner(), s.sendAt, 1_000)).some(row => row.id === s.scheduleId)).toBe(false);
  expect((await s.compose()).status).toBe(409);
  expect((await s.sendDraftNow()).status).toBe(409);
  expect(delivered("Synthetic planned")).toBe(before + 1);
});

realMailTest("409 while the job sends the draft and after it sent it; nothing reaches SMTP", async () => {
  const s = await setup();
  expect((await claimDueScheduledSends(jobOwner(), s.sendAt, 1_000)).some(row => row.id === s.scheduleId)).toBe(true);
  const before = sink.received.length;
  for (const response of [await s.compose(), await s.sendDraftNow()]) {
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("scheduled_send_busy");
  }
  // The job's send went out (as settleScheduledSend records it).
  s.f.master.prepare("UPDATE scheduled_sends SET status='sent',leaseOwner=NULL,leaseStartedAt=NULL WHERE id=?").run(s.scheduleId);
  for (const response of [await s.compose(), await s.sendDraftNow()]) {
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("scheduled_send_sent");
  }
  expect(sink.received.length).toBe(before);
  // A compose send without a draft id is unrelated to any schedule.
  expect((await s.compose({ draftId: undefined, subject: "Synthetic unrelated" })).status).toBe(200);
});

realMailTest("a failed manual send keeps the schedule; a possibly delivered one fails it as send_uncertain", async () => {
  const refused = await setup(closedPort);
  expect((await refused.compose()).status).toBeGreaterThanOrEqual(500);
  expect(await getScheduledSend(refused.scheduleId)).toMatchObject({ status: "queued", leaseOwner: null });
  expect((await refused.sendDraftNow()).status).toBeGreaterThanOrEqual(500);
  expect(await getScheduledSend(refused.scheduleId)).toMatchObject({ status: "queued", leaseOwner: null });

  const dropped = await setup(droppingPort);
  expect((await dropped.compose()).status).toBeGreaterThanOrEqual(500);
  expect(await getScheduledSend(dropped.scheduleId)).toMatchObject({ status: "failed", lastError: "send_uncertain" });
  expect((await claimDueScheduledSends(jobOwner(), dropped.sendAt, 1_000)).some(row => row.id === dropped.scheduleId)).toBe(false);
});

realMailTest("a failed draft save (IMAP APPEND) keeps the schedule", async () => {
  const s = await setup();
  const save = () => saveDraft(s.f.request("POST", { draftId: s.draftId, identityId: s.f.identity.id, to: "recipient@example.test",
    subject: "Synthetic edited", text: "Edited body" }, {}, s.f, "/drafts/save"), s.f.params());
  const outcome = await save().then(response => response.status, () => 500);
  expect(outcome).toBeGreaterThanOrEqual(500);
  expect(await getScheduledSend(s.scheduleId)).toMatchObject({ status: "queued", leaseOwner: null });
});

realMailTest("opening a draft scheduled by another member reads the schedule fresh and cancels it", async () => {
  const s = await setup();
  const other = await createAuthenticatedTestSession(s.f.accountId);
  await s.f.db.setUserAccountRole(other.user.id, s.f.accountId, "editor", other.user.id);
  // Member B's client: a plain fetch against the real routes with B's session.
  const apiFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), ORIGIN);
    const request = new Request(url, { ...init, headers: other.jar.headers({ origin: ORIGIN, "content-type": "application/json" }) });
    const cancelMatch = /\/drafts\/scheduled\/([^/]+)\/cancel$/.exec(url.pathname);
    return cancelMatch
      ? cancelScheduled(request, s.f.params({ scheduleId: decodeURIComponent(cancelMatch[1]) }))
      : listScheduled(request, s.f.params());
  };
  expect(await releaseDraftScheduleForEdit(apiFetch, s.f.accountId, s.draftId)).toEqual({ ok: true });
  expect(await getScheduledSend(s.scheduleId)).toMatchObject({ status: "cancelled", lastError: "cancelled" });

  // An old undo toast must leave the replacement schedule alone.
  const replanned = await (await schedule(s.f.request("POST", { draftId: s.draftId, sendAt: s.sendAt }), s.f.params())).json();
  expect(await cancelDraftSchedule(apiFetch, s.f.accountId, { id: s.scheduleId, draftId: s.draftId })).toEqual({ ok: true });
  expect(await getScheduledSend(replanned.scheduledSend.id)).toMatchObject({ status: "queued" });

  // While the job sends it, the draft does not open.
  const busy = await (await schedule(s.f.request("POST", { draftId: s.draftId, sendAt: s.sendAt }), s.f.params())).json();
  await claimDueScheduledSends(jobOwner(), s.sendAt, 1_000);
  expect(await releaseDraftScheduleForEdit(apiFetch, s.f.accountId, s.draftId)).toEqual({ ok: false, reason: "busy" });
  expect((await getScheduledSend(busy.scheduledSend.id))?.status).toBe("sending");
});


realMailTest("parallel compose sends after opening cancelled the schedule deliver exactly one copy", async () => {
  const s = await setup();
  expect((await cancelScheduled(s.f.request("POST"), s.f.params({ scheduleId: s.scheduleId }))).status).toBe(200);
  const before = delivered("Synthetic planned");
  const results = await Promise.all([s.compose(), s.compose()]);
  expect(results.map(response => response.status).sort()).toEqual([200, 409]);
  expect(delivered("Synthetic planned")).toBe(before + 1);
  expect((await s.compose()).status).toBe(409);
  expect((await s.sendDraftNow()).status).toBe(409);
  expect(delivered("Synthetic planned")).toBe(before + 1);
});

realMailTest("saving a draft held by a live foreign job returns 409 and keeps its claim", async () => {
  const s = await setup();
  const owner = jobOwner();
  expect((await claimDueScheduledSends(owner, s.sendAt, 1000)).some(row => row.id === s.scheduleId)).toBe(true);
  const response = await saveDraft(s.f.request("POST", { draftId: s.draftId, identityId: s.f.identity.id,
    to: "recipient@example.test", subject: "Synthetic edited", text: "Edited body" }, {}, s.f, "/drafts/save"), s.f.params());
  expect(response.status).toBe(409);
  expect(await getScheduledSend(s.scheduleId)).toMatchObject({ status: "sending", leaseOwner: owner });
});


realMailTest("the real job relays the fingerprinted draft exactly once across repeated ticks", async () => {
  const s = await setup();
  const before = delivered("Synthetic planned");
  const scheduler = new ScheduledSendScheduler({ ...defaultScheduledSendDeps, now: () => s.sendAt });
  try {
    await scheduler.tick();
    await scheduler.tick();
    expect(delivered("Synthetic planned")).toBe(before + 1);
    expect(await getScheduledSend(s.scheduleId)).toMatchObject({ status: "sent", lastError: null });
    expect((await s.compose()).status).toBe(409);
  } finally { await scheduler.stop(); }
});
