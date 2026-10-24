import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import { EventEmitter } from "node:events";
import { setTimeout as sleep } from "node:timers/promises";
import { createAuthenticatedTestSession } from "@/lib/testAuthHarness";
import { dbModulePromise } from "@/lib/testDbHarness";
import { revokeAuthStreams } from "@/lib/authStreams";
import { mailboxErrorResponse } from "@/lib/mailboxFailure";
import * as access from "@/lib/accountAccess";
import * as protocol from "@/lib/mail/imapClientOptions";
import type { Account } from "@/lib/data";

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}
const clients: FakeClient[] = [];
const timers = new Map<number, { callback: () => unknown; ms: number }>();
let nextTimer = 1;
let configure: (client: FakeClient) => void = () => {};
class FakeClient extends EventEmitter {
  closed = false;
  get usable() { return !this.closed; }
  close() { this.closed = true; this.idleGate.resolve(); this.emit("close"); }
  logouts = 0;
  connects = 0;
  statuses = 0;
  uidNext = 2;
  selectedUidNext = 1;
  unseen = 0;
  messages = 1;
  statusQueries: unknown[] = [];
  connectGate?: Promise<void>;
  statusGate?: Promise<void>;
  fetchGate?: Promise<void>;
  connectError?: unknown;
  idleError?: unknown;
  idleGate = deferred();
  constructor() { super(); clients.push(this); configure(this); }
  async connect() { this.connects++; await this.connectGate; if (this.connectError) throw this.connectError; }
  async logout() { this.logouts++; this.closed = true; this.idleGate.resolve(); }
  async mailboxOpen() { return { uidNext: this.selectedUidNext, uidValidity: 1n, exists: this.messages, unseen: 1 }; }
  async status(_mailbox?: string, query?: unknown) {
    this.statuses++; this.statusQueries.push(query); await this.statusGate;
    return { uidNext: this.uidNext, uidValidity: 1n, unseen: this.unseen, messages: this.messages };
  }
  async *fetch() { await this.fetchGate; yield { uid: 1, envelope: { subject: "Synthetic private envelope" } }; }
  async idle() { await this.idleGate.promise; if (this.idleError) throw this.idleError; }
}
mock.module("@/lib/mail/imapStreamRuntime", () => ({
  ...protocol,
  loadImapFlow: async () => FakeClient,
  // Other suites stub the general logout helper for their own protocol clients.
  // Keep disposal bound to this seam's fake clients in the shared Bun process.
  safeLogoutImapClient: async (client: FakeClient | null | undefined) => { await client?.logout(); },
  streamTimers: {
    setInterval(callback: () => unknown, ms: number) { const id = nextTimer++; timers.set(id, { callback, ms }); return id; },
    clearInterval(id?: number) { if (id !== undefined) timers.delete(id); },
    setTimeout(callback: () => unknown, ms: number) { const id = nextTimer++; timers.set(id, { callback, ms }); return id; },
    clearTimeout(id?: number) { if (id !== undefined) timers.delete(id); }
  }
}));
const { GET } = await import("./route");
const opened: Array<{ abort: AbortController; response: Response }> = [];
afterEach(async () => {
  for (const item of opened.splice(0)) item.abort.abort();
  await sleep(0);
  expect(timers.size).toBe(0);
  clients.length = 0;
  configure = () => {};
});
async function until(predicate: () => boolean) {
  for (let i = 0; i < 200; i++) { if (predicate()) return; await sleep(5); }
  throw new Error("Synthetic stream condition timed out");
}
async function fixture() {
  const db = await dbModulePromise;
  const id = `stream-${crypto.randomUUID()}`;
  await db.upsertAccount({ id, name: "Synthetic stream", email: "stream@example.test", avatar: "",
    imap: { host: "imap.example.test", port: 993, secure: true, user: "stream@example.test", password: "synthetic" },
    smtp: { host: "smtp.example.test", port: 465, secure: true, user: "stream@example.test", password: "synthetic" } } satisfies Account);
  await db.saveFoldersForAccount(id, ["INBOX", "Archive"].map(name => ({ id: `${id}:${name}`, name, count: 0, accountId: id })));
  return { id, db, ...await createAuthenticatedTestSession(id) };
}
async function open(f: Awaited<ReturnType<typeof fixture>>, jar = f.jar) {
  const abort = new AbortController();
  const response = await GET(new Request(`http://localhost:3000/api/accounts/${f.id}/imap/stream?pollIntervalMs=123456`, { headers: jar.headers(), signal: abort.signal }), { params: Promise.resolve({ accountId: f.id }) });
  expect(response.status).toBe(200);
  opened.push({ response, abort });
  return { response, abort, reader: response.body!.getReader() };
}
async function initial(stream: Awaited<ReturnType<typeof open>>) {
  expect(new TextDecoder().decode((await stream.reader.read()).value)).toContain("event: folder:update");
  await until(() => [...timers.values()].some(t => t.ms === 123456));
}
const authError = () => Object.assign(new Error("Synthetic opaque upstream failure"), { authenticationFailed: true, serverResponseCode: "AUTHENTICATIONFAILED" });

describe("production IMAP stream acceptance", () => {
  test("one-hour lifetime delivers reconnect before closing and disposes watchers, pending poll and all timers", async () => {
    const f = await fixture(), stream = await open(f);
    await initial(stream);
    const gate = deferred();
    configure = client => { client.statusGate = gate.promise; };
    const poll = [...timers.values()].find(t => t.ms === 123456)!.callback();
    await until(() => clients.length === 2 && clients[1].statuses > 0);
    try {
      await [...timers.values()].find(t => t.ms === 60 * 60 * 1000)!.callback();
      const chunk = new TextDecoder().decode((await stream.reader.read()).value);
      expect(chunk.split("\n")[0]).toBe("event: reconnect");
      expect(JSON.parse(chunk.split("data: ")[1])).toEqual({ streamId: expect.stringMatching(/^[a-f0-9]{8}$/) });
      expect((await stream.reader.read()).done).toBe(true);
      expect(timers.size).toBe(0);
      expect(clients.every(c => c.closed && c.logouts === 1)).toBe(true);
    } finally {
      gate.resolve();
      await poll;
    }
    expect(clients.every(c => c.logouts === 1)).toBe(true);
  });

  test("lifetime also bounds a pending initial connection without installing later timers", async () => {
    const f = await fixture(), gate = deferred();
    configure = client => { client.connectGate = gate.promise; };
    const stream = await open(f);
    await until(() => clients.length === 1);
    try {
      await [...timers.values()].find(t => t.ms === 60 * 60 * 1000)!.callback();
      expect(new TextDecoder().decode((await stream.reader.read()).value)).toContain("event: reconnect");
      expect(clients[0].closed).toBe(true);
    } finally {
      gate.resolve();
    }
    expect((await stream.reader.read()).done).toBe(true);
    expect(clients[0].logouts).toBe(1);
    expect(timers.size).toBe(0);
  });

  test("lifetime cannot emit reconnect after authorization is lost without a revocation notification", async () => {
    const f = await fixture(), stream = await open(f);
    await initial(stream);
    f.master.prepare("DELETE FROM auth_session WHERE id=?").run(f.session.id);
    await [...timers.values()].find(t => t.ms === 60 * 60 * 1000)!.callback();
    expect((await stream.reader.read()).done).toBe(true);
    expect(timers.size).toBe(0);
    expect(clients.every(c => c.closed && c.logouts === 1)).toBe(true);
  });

  test("QA-006 folder counts use STATUS for initial SELECT, EXISTS, flags, poll and reconnect", async () => {
    const f = await fixture();
    configure = client => { client.messages = 300; client.unseen = 110; client.uidNext = 301; client.selectedUidNext = 301; };
    const stream = await open(f);
    const readEvent = async () => {
      const chunk = new TextDecoder().decode((await stream.reader.read()).value);
      return { event: chunk.split("\n")[0], data: JSON.parse(chunk.split("data: ")[1]) };
    };
    expect(await readEvent()).toEqual({ event: "event: folder:update", data: [
      { id: `${f.id}:INBOX`, uidNext: 301, exists: 300, unseen: 110 }
    ] });
    await until(() => timers.size === 3);
    expect(clients[0].statusQueries[0]).toEqual({ uidNext: true, uidValidity: true, messages: true, unseen: true });
    clients[0].messages = 305; clients[0].unseen = 115; clients[0].uidNext = 306;
    clients[0].emit("exists");
    expect((await readEvent()).event).toBe("event: new");
    expect((await readEvent()).data).toEqual([{ id: `${f.id}:INBOX`, uidNext: 306, exists: 305, unseen: 115 }]);
    for (const unseen of [105, 115, 0]) {
      clients[0].unseen = unseen;
      clients[0].emit("flags", { uid: 1, flags: unseen === 115 ? [] : ["\\Seen"] });
      expect((await readEvent()).event).toBe("event: flags:update");
      expect((await readEvent()).data[0].unseen).toBe(unseen);
    }
    // EXISTS can change counts without advancing UIDNEXT (e.g. reconciliation).
    clients[0].unseen = 110; clients[0].emit("exists");
    expect((await readEvent()).data[0].unseen).toBe(110);
    await [...timers.values()].find(t => t.ms === 123456)!.callback();
    expect((await readEvent()).data).toEqual([{ id: `${f.id}:Archive`, uidNext: 301, exists: 300, unseen: 110 }]);
    await stream.reader.cancel();
    const reconnected = await open(f);
    const reconnect = new TextDecoder().decode((await reconnected.reader.read()).value);
    expect(JSON.parse(reconnect.split("data: ")[1])[0].unseen).toBe(110);
    await until(() => timers.size === 3);
  });

  test.each(["fetch", "poll", "connect"])("revocation during pending %s blocks the next sensitive enqueue", async (phase: string) => {
    const f = await fixture();
    const gate = deferred();
    if (phase === "connect") configure = client => { client.connectGate = gate.promise; };
    const stream = await open(f);
    if (phase === "connect") await until(() => clients.length === 1);
    else {
      await initial(stream);
      if (phase === "fetch") {
        const statusesBefore = clients[0].statuses;
        clients[0].fetchGate = gate.promise;
        clients[0].emit("exists");
        await until(() => clients[0].statuses > statusesBefore);
      } else {
        configure = client => { client.statusGate = gate.promise; };
        void [...timers.values()].find(t => t.ms === 123456)!.callback();
        await until(() => clients.length === 2 && clients[1].statuses > 0);
      }
    }
    // No explicit revocation event: exercise the actual route's final DB check.
    f.master.prepare("DELETE FROM auth_session WHERE id=?").run(f.session.id);
    gate.resolve();
    expect((await stream.reader.read()).done).toBe(true);
    await until(() => clients.every(c => c.closed));
    expect(timers.size).toBe(0);
    expect(clients.every(c => c.logouts === 1)).toBe(true);
  });

  test.each(["abort", "cancel", "revoke"])("%s disposes only its stream's clients and timers, including pending poll", async (reason: string) => {
    const f = await fixture();
    const other = await createAuthenticatedTestSession(f.id);
    const a = await open(f); await initial(a);
    const b = await open(f, other.jar); await initial(b);
    const gate = deferred();
    configure = client => { client.statusGate = gate.promise; };
    void [...timers.values()].find(t => t.ms === 123456)!.callback();
    await until(() => clients.length === 3 && clients[2].statuses > 0);
    const survivor = clients[1];
    if (reason === "abort") a.abort.abort();
    else if (reason === "cancel") await a.reader.cancel();
    else revokeAuthStreams({ sessionId: f.session.id });
    expect(clients[0].closed).toBe(true); expect(clients[2].closed).toBe(true);
    expect(survivor.closed).toBe(false); expect(timers.size).toBe(3);
    gate.resolve(); await sleep(10);
    if (reason !== "cancel") expect((await a.reader.read()).done).toBe(true);
    survivor.emit("flags", { uid: 1, flags: ["\\Seen"] });
    expect(new TextDecoder().decode((await b.reader.read()).value)).toContain("event: flags:update");
    await b.reader.cancel();
    expect(clients.every(c => c.closed && c.logouts === 1)).toBe(true);
    expect(timers.size).toBe(0);
  });

  test.each(["abort", "cancel", "revoke"])("%s owns and disposes a client while connect is still pending", async (reason: string) => {
    const f = await fixture(), gate = deferred();
    configure = client => { client.connectGate = gate.promise; };
    const stream = await open(f);
    await until(() => clients.length === 1);
    if (reason === "abort") stream.abort.abort();
    else if (reason === "cancel") await stream.reader.cancel();
    else revokeAuthStreams({ sessionId: f.session.id });
    expect(clients[0].closed).toBe(true);
    gate.resolve(); await sleep(10);
    expect(clients[0].logouts).toBe(1); expect(timers.size).toBe(0);
    if (reason !== "cancel") expect((await stream.reader.read()).done).toBe(true);
  });

  test.each(["manager", "editor", "viewer"] as const)("structured connect failure for %s matches REST DTO", async (role: "manager" | "editor" | "viewer") => {
    const f = await fixture();
    if (role !== "manager") {
      await createAuthenticatedTestSession(f.id);
      await f.db.setUserAccountRole(f.user.id, f.id, role, f.user.id);
    }
    configure = client => { client.connectError = authError(); };
    const stream = await open(f);
    const chunk = new TextDecoder().decode((await stream.reader.read()).value);
    expect(chunk).toContain("event: error");
    const dto = JSON.parse(chunk.split("data: ")[1]);
    expect(dto).toEqual(await (await mailboxErrorResponse(authError(), f.id, role))!.json());
    expect(dto.repairAllowed).toBe(role === "manager");
    if (role !== "manager") { expect(Array.isArray(dto.managerContact)).toBe(true); expect(dto.managerContact).toHaveLength(1); }
    expect(chunk).not.toContain("opaque upstream");
    expect((await stream.reader.read()).done).toBe(true);
    expect(clients.every(c => c.logouts === 1)).toBe(true);
  });

  test("revocation during manager contact lookup prevents the error enqueue", async () => {
    const f = await fixture(), gate = deferred(), entered = deferred();
    await f.db.setUserAccountRole(f.user.id, f.id, "viewer", f.user.id);
    const original = access.listAccountMembers;
    const lookup = spyOn(access, "listAccountMembers").mockImplementation(async (accountId: string) => {
      const members = await original(accountId);
      entered.resolve(); await gate.promise;
      return members;
    });
    try {
      configure = client => { client.connectError = authError(); };
      const stream = await open(f);
      await entered.promise;
      f.master.prepare("DELETE FROM auth_session WHERE id=?").run(f.session.id);
      gate.resolve();
      expect((await stream.reader.read()).done).toBe(true);
      expect(clients.every(c => c.logouts === 1)).toBe(true);
    } finally { gate.resolve(); lookup.mockRestore(); }
  });

  test.each(["watcher", "poll"])("aborted %s connect failure cannot create a retry client", async (phase: string) => {
    const f = await fixture(), gate = deferred();
    const keys = ["IMAP_CONNECT_RETRY_COUNT", "IMAP_CONNECT_RETRY_BASE_DELAY_MS", "IMAP_CONNECT_RETRY_MAX_DELAY_MS"];
    const previous = keys.map(key => process.env[key]);
    keys.forEach((key, index) => { process.env[key] = index === 0 ? "1" : "10"; });
    try {
      configure = client => { client.connectGate = gate.promise; client.connectError = Object.assign(new Error("Synthetic connection reset"), { code: "ECONNRESET" }); };
      if (phase === "poll") configure = () => {};
      const stream = await open(f);
      let poll: unknown;
      if (phase === "poll") {
        await initial(stream);
        configure = client => { client.connectGate = gate.promise; client.connectError = Object.assign(new Error("Synthetic connection reset"), { code: "ECONNRESET" }); };
        poll = [...timers.values()].find(t => t.ms === 123456)!.callback();
      }
      const count = phase === "poll" ? 2 : 1;
      await until(() => clients.length === count);
      stream.abort.abort(); gate.resolve();
      await poll;
      // Wait beyond the configured retry delay for the detached watcher startup.
      if (phase === "watcher") await sleep(50);
      expect(clients.length).toBe(count);
      expect(clients.every(c => c.closed && c.logouts === 1)).toBe(true);
      expect(timers.size).toBe(0);
      expect((await stream.reader.read()).done).toBe(true);
    } finally {
      gate.resolve();
      keys.forEach((key, index) => { if (previous[index] === undefined) delete process.env[key]; else process.env[key] = previous[index]; });
    }
  });

  test.each(["fetch", "idle", "poll"])("structured %s failure keeps the shared credential DTO", async (phase: string) => {
    const f = await fixture(), stream = await open(f); await initial(stream);
    if (phase === "fetch") {
      clients[0].fetch = async function* () { throw authError(); };
      clients[0].emit("exists");
    } else if (phase === "idle") {
      clients[0].idleError = authError(); clients[0].idleGate.resolve();
    } else {
      configure = client => { client.status = async () => { throw authError(); }; };
      void [...timers.values()].find(t => t.ms === 123456)!.callback();
    }
    const chunk = new TextDecoder().decode((await stream.reader.read()).value);
    expect(JSON.parse(chunk.split("data: ")[1])).toEqual(await (await mailboxErrorResponse(authError(), f.id, "manager"))!.json());
  });
});
