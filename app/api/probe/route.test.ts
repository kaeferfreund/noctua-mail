import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import net from "node:net";
import { randomUUID } from "node:crypto";
import { POST } from "./route";
import { createAuthenticatedTestSession, getSharedTestAuthHarness, syntheticRequestIp } from "@/lib/testAuthHarness";
import { dbModulePromise } from "@/lib/testDbHarness";
import { withDbWriteRetry } from "@/lib/dbWriteRetry";
import type { Account } from "@/lib/data";

const { upsertAccount } = await dbModulePromise;

let connections = 0;
const server = net.createServer(socket => { connections++; socket.destroy(); });
/** Floods every connection with data that never contains the expected marker. */
const flood = net.createServer(socket => {
  const chunk = "* " + "x".repeat(4094) + "\r\n";
  const timer = setInterval(() => { if (!socket.destroyed) socket.write(chunk); }, 5);
  socket.on("close", () => clearInterval(timer));
  socket.on("error", () => clearInterval(timer));
});
let port = 0;
let floodPort = 0;

beforeAll(async () => {
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  await new Promise<void>(resolve => flood.listen(0, "127.0.0.1", resolve));
  port = (server.address() as net.AddressInfo).port;
  floodPort = (flood.address() as net.AddressInfo).port;
});
afterAll(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
  await new Promise<void>(resolve => flood.close(() => resolve()));
});

const request = (cookie: string, body: Record<string, unknown>) => new Request("http://localhost:3000/api/probe", {
  method: "POST",
  headers: { cookie, "content-type": "application/json", origin: "http://localhost:3000", "x-forwarded-for": syntheticRequestIp() },
  body: JSON.stringify(body)
});

async function mailbox(imapHost: string, imapPort: number) {
  const id = randomUUID();
  const email = `probe-${id}@example.test`;
  await upsertAccount({ id, name: "Probe", email, avatar: "",
    imap: { host: imapHost, port: imapPort, secure: true, user: email, password: "synthetic-imap" },
    smtp: { host: "smtp.example.test", port: 465, secure: true, user: email, password: "synthetic-smtp" } } as Account);
  return id;
}

async function settle() {
  await new Promise(resolve => setTimeout(resolve, 30));
  const count = connections;
  connections = 0;
  return count;
}

describe("probe session gate", () => {
  test("unauthenticated and enrollment requests make zero connections; probes forward refresh cookies", async () => {
    const body = { protocol: "imap", host: "127.0.0.1", port };
    connections = 0;
    expect((await POST(request("", body))).status).toBe(401);
    const h = await getSharedTestAuthHarness();
    const user = await h.createUser(`probe-setup-${randomUUID()}@example.test`);
    const setup = await h.signIn(user.email);
    await h.seedSessionSecurity(setup.session!.session.id, user.id, "setup");
    expect((await POST(request(setup.jar.header(), body))).status).toBe(403);
    expect(await settle()).toBe(0);
    const f = await createAuthenticatedTestSession(undefined, "admin");
    await withDbWriteRetry("test.probeRefresh", () => f.master.prepare("UPDATE auth_session SET updatedAt=?,expiresAt=? WHERE id=?")
      .run(new Date(Date.now() - 7200_000).toISOString(), new Date(Date.now() + 79200_000).toISOString(), f.session.id));
    const response = await POST(request(f.jar.header(), body));
    expect(response.status).toBe(200);
    expect(await settle()).toBe(2);
    expect(response.headers.getSetCookie().length).toBeGreaterThan(0);
  });
});

describe("probe destination policy (CF-10, A42, S19, DS-14, GLM-05)", () => {
  test("ordinary users without a managed mailbox cannot probe anything", async () => {
    const f = await createAuthenticatedTestSession();
    const other = await mailbox("127.0.0.1", port);
    for (const body of [
      { protocol: "imap", host: "127.0.0.1", port },
      { protocol: "imap", host: "127.0.0.1", port, accountId: other },
      { protocol: "smtp", host: "127.0.0.1", port: 25, accountId: randomUUID() }
    ]) expect((await POST(request(f.jar.header(), body))).status).toBe(403);
    expect(await settle()).toBe(0);
  });

  test("viewers cannot probe even the configured host", async () => {
    const accountId = await mailbox("127.0.0.1", port);
    const f = await createAuthenticatedTestSession();
    await f.addMembership(f.user.id, accountId, "viewer");
    expect((await POST(request(f.jar.header(), { protocol: "imap", host: "127.0.0.1", port, accountId }))).status).toBe(403);
    expect(await settle()).toBe(0);
  });

  test("managers may probe the mailbox's configured host on its configured port", async () => {
    const accountId = await mailbox("127.0.0.1", port);
    const f = await createAuthenticatedTestSession(accountId);
    const response = await POST(request(f.jar.header(), { protocol: "imap", host: "127.0.0.1", port, accountId }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, supportsTLS: false, supportsStartTLS: false });
    expect(await settle()).toBe(2);
  });

  test("managers cannot scan other ports of the configured host or internal hosts", async () => {
    const accountId = await mailbox("mail.example.test", 993);
    const f = await createAuthenticatedTestSession(accountId);
    for (const body of [
      { protocol: "imap", host: "mail.example.test", port: 8080, accountId },
      { protocol: "imap", host: "127.0.0.1", port: 993, accountId },
      { protocol: "imap", host: "100.100.100.100", port: 993, accountId },
      { protocol: "imap", host: "::ffff:7f00:1", port: 143, accountId },
      { protocol: "imap", host: "127.0.0.1", port, accountId },
      { protocol: "smtp", host: "10.0.0.5", port: 587, accountId }
    ]) expect((await POST(request(f.jar.header(), body))).status).toBe(403);
    expect(await settle()).toBe(0);
  });

  test("rejects malformed host and port values", async () => {
    const f = await createAuthenticatedTestSession(undefined, "admin");
    for (const body of [
      { protocol: "imap", host: "127.0.0.1", port: "993" },
      { protocol: "imap", host: "127.0.0.1", port: 0 },
      { protocol: "imap", host: "127.0.0.1", port: 70000 },
      { protocol: "imap", host: "127.0.0.1", port: 1.5 },
      { protocol: "pop3", host: "127.0.0.1", port: 110 },
      { protocol: "imap", host: "", port: 993 }
    ]) expect((await POST(request(f.jar.header(), body))).status).toBe(400);
    expect(await settle()).toBe(0);
  });

  test("a peer that floods data cannot make the probe buffer it or run past its deadline (A5, S7)", async () => {
    const f = await createAuthenticatedTestSession(undefined, "admin");
    const started = Date.now();
    const response = await POST(request(f.jar.header(), { protocol: "imap", host: "localhost", port: floodPort }));
    expect(await response.json()).toEqual({ ok: true, supportsTLS: false, supportsStartTLS: false });
    expect(Date.now() - started).toBeLessThan(3000);
  });
});
