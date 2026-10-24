import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { createServer, type Server, type Socket } from "node:net";
import { once } from "node:events";
import { ImapFlow } from "imapflow";

import type { Account } from "@/lib/data";
import { startImapServer } from "../../scripts/dev-fixture/imap-server";
import { connectIdleImapClient } from "./imap/idle";
import {
  bindImapClientError,
  buildImapFlowOptions,
  connectImapClientWithRetry,
  getImapConnectBlockedUntil,
  resetImapConnectFailureState
} from "./imapClientOptions";

// Dev journal 2026-10-23: every `imap.connect_retry … "Unexpected close"` was a connect the
// browser stream closed itself during teardown, never a provider close. Owner closes must not
// be retried or counted by the breaker; real server closes still are.

const ENV_KEYS = [
  "IMAP_LOG_LEVEL",
  "IMAP_CONNECT_RETRY_COUNT",
  "IMAP_CONNECT_RETRY_BASE_DELAY_MS",
  "IMAP_CONNECT_BREAKER_THRESHOLD",
  "IMAP_CONNECT_BREAKER_COOLDOWN_MS"
] as const;

const user = "team@example.test";
const pass = "synthetic";

function fixtureAccount(id: string, port: number) {
  return {
    id,
    imap: { host: "127.0.0.1", port, secure: false, user, password: pass }
  } as Account;
}

type SocketedClient = ImapFlow & { socket?: Socket };

describe("connectImapClientWithRetry against a synthetic IMAP server", () => {
  let fixture: Awaited<ReturnType<typeof startImapServer>>;
  let closingServer: Server;
  let closingPort = 0;
  let closingAccepts = 0;
  const originalEnv = new Map(ENV_KEYS.map((key) => [key, process.env[key]]));
  const originalLog = console.log;
  const originalWarn = console.warn;
  let infos: string[] = [];
  let warnings: string[] = [];

  beforeAll(async () => {
    fixture = await startImapServer({ port: 0, user, pass });
    // Provider-side close before the greeting, as a connection cap or a dropped socket would.
    closingServer = createServer((socket) => {
      closingAccepts += 1;
      socket.destroy();
    });
    closingServer.listen(0, "127.0.0.1");
    await once(closingServer, "listening");
    const address = closingServer.address();
    closingPort = typeof address === "object" && address ? address.port : 0;
  });

  afterAll(async () => {
    await fixture.stop();
    await new Promise<void>((resolve) => closingServer.close(() => resolve()));
  });

  beforeEach(() => {
    infos = [];
    warnings = [];
    closingAccepts = 0;
    resetImapConnectFailureState();
    process.env.IMAP_LOG_LEVEL = "info";
    process.env.IMAP_CONNECT_RETRY_COUNT = "2";
    process.env.IMAP_CONNECT_RETRY_BASE_DELAY_MS = "1";
    process.env.IMAP_CONNECT_BREAKER_THRESHOLD = "1";
    process.env.IMAP_CONNECT_BREAKER_COOLDOWN_MS = "60000";
    console.log = (...args: unknown[]) => { infos.push(args.map(String).join(" ")); };
    console.warn = (...args: unknown[]) => { warnings.push(args.map(String).join(" ")); };
  });

  afterEach(() => {
    resetImapConnectFailureState();
    console.log = originalLog;
    console.warn = originalWarn;
    for (const [key, value] of originalEnv) {
      if (typeof value === "string") process.env[key] = value;
      else delete process.env[key];
    }
  });

  const newClient = (account: Account) => {
    const client = new ImapFlow(buildImapFlowOptions(account, {}, { accountId: account.id, mailbox: "INBOX" }));
    bindImapClientError(client, { accountId: account.id, mailbox: "INBOX" });
    return client as SocketedClient;
  };

  it("does not retry or trip the breaker when the owner logs out a pending connect", async () => {
    const account = fixtureAccount("acc-owner-logout", fixture.port);
    const created: SocketedClient[] = [];

    await expect(connectImapClientWithRetry({
      account,
      logContext: { accountId: account.id, mailbox: "INBOX" },
      connectOp: "imap.connect",
      createClient: () => {
        const client = newClient(account);
        created.push(client);
        // Stream teardown: the owner disposes the client once TCP is up, before greeting/login.
        queueMicrotask(() => client.socket?.once("connect", () => { void client.logout().catch(() => {}); }));
        return client;
      }
    })).rejects.toThrow("Unexpected close");

    expect(created).toHaveLength(1);
    // Teardown is not a server failure: no warn line at all, the connect op logs at info.
    expect(warnings).toEqual([]);
    expect(infos.some((line) => line.includes("[imap] imap.connect mailbox=INBOX") &&
      line.includes("cancelled=Unexpected close"))).toBe(true);
    expect(warnings.some((line) => line.includes('"event":"imap.connect_retry"'))).toBe(false);
    expect(warnings.some((line) => line.includes('"event":"imap.connect_breaker_open"'))).toBe(false);
    expect(infos.some((line) => line.includes('"event":"imap.connect_cancelled"'))).toBe(true);
    expect(getImapConnectBlockedUntil(account)).toBe(0);

    // The account stays connectable right away.
    const client = await connectImapClientWithRetry({ account, createClient: () => newClient(account) });
    expect(client.usable).toBe(true);
    await client.logout();
  });

  it("does not count an aborted watcher connect against the breaker", async () => {
    const account = fixtureAccount("acc-watcher-abort", fixture.port);
    const controller = new AbortController();
    let created = 0;

    await expect(connectIdleImapClient(account, { accountId: account.id, mailbox: "INBOX" }, {
      singleAttempt: true,
      signal: controller.signal,
      createClient: (options) => {
        created += 1;
        const client = new ImapFlow(options) as SocketedClient;
        queueMicrotask(() => client.socket?.once("connect", () => controller.abort()));
        return client;
      }
    })).rejects.toThrow("Unexpected close");

    expect(created).toBe(1);
    expect(getImapConnectBlockedUntil(account)).toBe(0);
    expect(warnings).toEqual([]);
  });

  it("still retries and opens the breaker when the server closes during connect", async () => {
    const account = fixtureAccount("acc-server-close", closingPort);
    let created = 0;

    await expect(connectImapClientWithRetry({
      account,
      logContext: { accountId: account.id, mailbox: "INBOX" },
      createClient: () => {
        created += 1;
        return newClient(account);
      }
    })).rejects.toThrow("Unexpected close");

    expect(created).toBe(3);
    expect(closingAccepts).toBe(3);
    expect(warnings.filter((line) => line.includes('"event":"imap.connect_retry"'))).toHaveLength(2);
    expect(warnings.filter((line) => line.startsWith("[imap] connect mailbox=INBOX") && line.includes("error=Unexpected close"))).toHaveLength(3);
    expect(warnings.some((line) => line.includes('"event":"imap.connect_breaker_open"'))).toBe(true);
    expect(infos.some((line) => line.includes('"event":"imap.connect_cancelled"'))).toBe(false);
    expect(getImapConnectBlockedUntil(account)).toBeGreaterThan(Date.now());
  });
});
