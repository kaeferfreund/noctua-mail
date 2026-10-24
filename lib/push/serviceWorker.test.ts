import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { NOTIFICATION_BADGE_ICON, NOTIFICATION_ICON } from "@/lib/appBranding";

const workerSource = readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8");
const origin = "https://noctua.example.test";

type Listener = (event: unknown) => void;
type Notification = { title: string; options: Record<string, unknown> };
type FetchCall = { url: string; method: string; body: unknown };

function loadWorker(options: {
  setAppBadge?: boolean;
  clients?: Array<{ url: string }>;
  fetchResponses?: Record<string, Response>;
} = {}) {
  const listeners = new Map<string, Listener>();
  const notifications: Notification[] = [];
  const badges: Array<number | "cleared"> = [];
  const fetches: FetchCall[] = [];
  const subscribed: unknown[] = [];
  const posted: Array<{ client: string; message: unknown }> = [];
  const focused: string[] = [];
  const opened: string[] = [];
  const windows = (options.clients ?? []).map(({ url }) => ({
    url,
    focus: async () => { focused.push(url); },
    postMessage: (message: unknown) => { posted.push({ client: url, message }); }
  }));
  const navigator: Record<string, unknown> = { userAgent: "SyntheticAgent/1.0" };
  if (options.setAppBadge !== false) {
    navigator.setAppBadge = async (count: number) => { badges.push(count); };
    navigator.clearAppBadge = async () => { badges.push("cleared"); };
  }
  const context = {
    btoa, URL, URLSearchParams, Response,
    fetch: async (url: string, init: RequestInit = {}) => {
      fetches.push({ url, method: init.method ?? "GET", body: init.body ? JSON.parse(String(init.body)) : undefined });
      return options.fetchResponses?.[`${init.method ?? "GET"} ${url}`] ?? Response.json({ ok: true });
    },
    self: {
      navigator,
      location: { origin },
      addEventListener: (type: string, callback: Listener) => listeners.set(type, callback),
      clients: { matchAll: async () => windows, openWindow: async (url: string) => { opened.push(url); } },
      registration: {
        showNotification: async (title: string, notificationOptions: Record<string, unknown>) => {
          notifications.push({ title, options: notificationOptions });
        },
        pushManager: {
          subscribe: async (subscribeOptions: unknown) => {
            subscribed.push(subscribeOptions);
            return { endpoint: "https://push.example.test/new", toJSON: () => ({ endpoint: "https://push.example.test/new", keys: { p256dh: "p", auth: "a" } }) };
          }
        }
      }
    }
  };
  runInNewContext(workerSource, context);
  const dispatch = async (type: string, event: Record<string, unknown>) => {
    const pending: Promise<unknown>[] = [];
    listeners.get(type)!({ ...event, waitUntil: (promise: Promise<unknown>) => { pending.push(promise); } });
    await Promise.all(pending);
    return pending.length;
  };
  const push = (data: unknown) => dispatch("push", {
    data: data === undefined ? null : { json: () => (typeof data === "string" ? JSON.parse(data) : data) }
  });
  return { dispatch, push, notifications, badges, fetches, subscribed, posted, focused, opened };
}

const mail = {
  type: "new-mail", accountId: "acc-1", accountName: "Team Postfach", count: 1, messageId: "imap-1",
  threadId: null, from: "Alice Example", subject: "Rechnung März", url: "/?a=A1fm3AepO-ADwzIb&m=TS77tpY9aCUFO6LV", sentAt: 1
};

describe("service worker push", () => {
  it("shows one notification per mailbox tag with the sender as title, subject and mailbox in the body", async () => {
    const worker = loadWorker();
    await worker.push({ ...mail, badge: 4 });
    expect(worker.notifications).toEqual([{
      title: "Alice Example",
      options: {
        icon: NOTIFICATION_ICON, badge: NOTIFICATION_BADGE_ICON, data: { url: mail.url },
        body: "Rechnung März\nTeam Postfach", tag: "mail:acc-1", renotify: true
      }
    }]);
    expect(worker.badges).toEqual([4]);
  });

  it("shows only the mailbox in the body when the subject is absent", async () => {
    const worker = loadWorker();
    await worker.push({ ...mail, subject: null });
    await worker.push({ ...mail, subject: null, accountName: "" });
    expect(worker.notifications.map((n) => [n.title, n.options.body])).toEqual([
      ["Alice Example", "Team Postfach"],
      ["Alice Example", ""]
    ]);
  });

  it("collapses counts into the title and names the newest sender in the body", async () => {
    const worker = loadWorker();
    await worker.push({ ...mail, count: 3 });
    await worker.push({ ...mail, count: 3, subject: null });
    expect(worker.notifications.map((n) => [n.title, n.options.body])).toEqual([
      ["3 neue Nachrichten", "Alice Example — Rechnung März\nTeam Postfach"],
      ["3 neue Nachrichten", "Alice Example\nTeam Postfach"]
    ]);
    expect(worker.badges).toEqual([]);
  });

  it("confirms test pushes and keeps notification targets inside the app", async () => {
    const worker = loadWorker();
    await worker.push({ type: "test", url: "https://evil.example.invalid/phish", sentAt: 1 });
    await worker.push({ ...mail, url: `${origin}/?m=x#top` });
    expect(worker.notifications[0].title).toBe("Mail: Benachrichtigungen aktiv");
    expect(worker.notifications[0].options.data).toEqual({ url: "/" });
    expect(worker.notifications[1].options.data).toEqual({ url: "/?m=x#top" });
  });

  it("badge pushes only update the app badge; zero clears it", async () => {
    const worker = loadWorker();
    await worker.push({ type: "badge", badge: 7, sentAt: 1 });
    await worker.push({ type: "badge", badge: 0, sentAt: 1 });
    expect(worker.notifications).toEqual([]);
    expect(worker.badges).toEqual([7, "cleared"]);
    const noBadging = loadWorker({ setAppBadge: false });
    await noBadging.push({ ...mail, badge: 2 });
    expect(noBadging.notifications).toHaveLength(1);
  });

  it("drops malformed payloads without a notification or an exception", async () => {
    const worker = loadWorker();
    const malformed = [undefined, "{not json", "null", "[1]", "42", { type: "unknown" }, { ...mail, accountId: "" },
      { ...mail, from: 5 }, { type: "badge", badge: "3" }, { type: "badge", badge: -1 }, { type: "badge", badge: Number.NaN }];
    for (const payload of malformed) await worker.push(payload);
    expect(worker.notifications).toEqual([]);
    expect(worker.badges).toEqual([]);
  });
});

describe("service worker notification click", () => {
  it("prefers the main mail window over detached windows", async () => {
    const worker = loadWorker({ clients: [{ url: `${origin}/compose/window` }, { url: `${origin}/?f=INBOX` }] });
    await worker.dispatch("notificationclick", { notification: { data: { url: mail.url }, close() {} } });
    expect(worker.focused).toEqual([`${origin}/?f=INBOX`]);
    expect(worker.posted).toEqual([{ client: `${origin}/?f=INBOX`, message: { type: "noctua:notification-open", url: mail.url } }]);
    const cold = loadWorker();
    await cold.dispatch("notificationclick", { notification: { data: { url: mail.url }, close() {} } });
    expect(cold.opened).toEqual([mail.url]);
  });
});

describe("service worker pushsubscriptionchange", () => {
  const oldSubscription = { endpoint: "https://push.example.test/old", options: { applicationServerKey: new Uint8Array([1, 2, 3]).buffer } };

  it("re-subscribes with the previous key and registers the new endpoint as the successor of the old one", async () => {
    const worker = loadWorker();
    await worker.dispatch("pushsubscriptionchange", { oldSubscription });
    expect(worker.subscribed).toEqual([{ userVisibleOnly: true, applicationServerKey: oldSubscription.options.applicationServerKey }]);
    expect(worker.fetches).toEqual([
      { url: "/api/push/subscriptions", method: "POST", body: {
        subscription: { endpoint: "https://push.example.test/new", keys: { p256dh: "p", auth: "a" } }, userAgent: "SyntheticAgent/1.0",
        previousEndpoint: "https://push.example.test/old" } }
    ]);
  });

  it("uses a browser-provided subscription or the server key, and sends no previousEndpoint without a different old one", async () => {
    const provided = loadWorker();
    const newSubscription = { endpoint: "https://push.example.test/given", toJSON: () => ({ endpoint: "https://push.example.test/given" }) };
    await provided.dispatch("pushsubscriptionchange", { oldSubscription, newSubscription });
    expect(provided.subscribed).toEqual([]);
    expect(provided.fetches.map(call => [call.method, (call.body as { previousEndpoint?: string }).previousEndpoint])).toEqual([["POST", "https://push.example.test/old"]]);

    const unchanged = loadWorker();
    await unchanged.dispatch("pushsubscriptionchange", { oldSubscription: { endpoint: "https://push.example.test/given" }, newSubscription });
    expect(unchanged.fetches.map(call => call.body)).toEqual([{ subscription: { endpoint: "https://push.example.test/given" }, userAgent: "SyntheticAgent/1.0" }]);

    const fallback = loadWorker({ fetchResponses: {
      "GET /api/push/vapid-public-key": Response.json({ ok: true, publicKey: "BSyntheticKey" }),
      "POST /api/push/subscriptions": Response.json({ ok: false }, { status: 401 })
    } });
    await fallback.dispatch("pushsubscriptionchange", { oldSubscription: { endpoint: "https://push.example.test/old" } });
    expect(fallback.subscribed).toEqual([{ userVisibleOnly: true, applicationServerKey: "BSyntheticKey" }]);
    expect(fallback.fetches.map(call => call.method)).toEqual(["GET", "POST"]);

    const unconfigured = loadWorker({ fetchResponses: { "GET /api/push/vapid-public-key": new Response(null, { status: 404 }) } });
    await unconfigured.dispatch("pushsubscriptionchange", {});
    expect(unconfigured.subscribed).toEqual([]);
    expect(unconfigured.fetches.map(call => call.method)).toEqual(["GET"]);
  });
});
