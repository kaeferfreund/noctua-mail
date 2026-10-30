import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { NOTIFICATION_BADGE_ICON, NOTIFICATION_ICON } from "@/lib/appBranding";
import { PENDING_OPEN_CACHE, PENDING_OPEN_URL } from "@/lib/push/pendingOpen";

const workerSource = readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8");
const origin = "https://noctua.example.test";

type Listener = (event: unknown) => void;
type Notification = { title: string; options: Record<string, unknown> };
type FetchCall = { url: string; method: string; body: unknown };

function loadWorker(options: {
  setAppBadge?: boolean;
  clients?: Array<{ url: string; focusFails?: boolean; focusHangs?: boolean; noPostMessage?: boolean }>;
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
  // Order of the click's side effects: store, focus, post, open.
  const steps: string[] = [];
  const stored = new Map<string, Map<string, string>>();
  const caches = {
    open: async (name: string) => {
      const entries = stored.get(name) ?? new Map<string, string>();
      stored.set(name, entries);
      return {
        put: async (key: string, response: Response) => { entries.set(key, await response.text()); steps.push("store"); },
        match: async (key: string) => entries.has(key) ? new Response(entries.get(key)) : undefined
      };
    }
  };
  const windows = (options.clients ?? []).map(({ url, focusFails, focusHangs, noPostMessage }) => ({
    url,
    focus: () => {
      steps.push("focus");
      if (focusHangs) return new Promise<void>(() => {});
      if (focusFails) return Promise.reject(new DOMException("Not allowed to focus", "InvalidAccessError"));
      focused.push(url);
      return Promise.resolve();
    },
    ...noPostMessage ? {} : { postMessage: (message: unknown) => { steps.push("post"); posted.push({ client: url, message }); } }
  }));
  const navigator: Record<string, unknown> = { userAgent: "SyntheticAgent/1.0" };
  if (options.setAppBadge !== false) {
    navigator.setAppBadge = async (count: number) => { badges.push(count); };
    navigator.clearAppBadge = async () => { badges.push("cleared"); };
  }
  const context = {
    btoa, URL, URLSearchParams, Response, caches, setTimeout, clearTimeout,
    fetch: async (url: string, init: RequestInit = {}) => {
      fetches.push({ url, method: init.method ?? "GET", body: init.body ? JSON.parse(String(init.body)) : undefined });
      return options.fetchResponses?.[`${init.method ?? "GET"} ${url}`] ?? Response.json({ ok: true });
    },
    self: {
      navigator,
      location: { origin },
      addEventListener: (type: string, callback: Listener) => listeners.set(type, callback),
      clients: { matchAll: async () => windows, openWindow: async (url: string) => { steps.push("open"); opened.push(url); } },
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
  const pendingOpen = () => {
    const value = stored.get(PENDING_OPEN_CACHE)?.get(PENDING_OPEN_URL);
    return value === undefined ? undefined : JSON.parse(value) as { url: string; at: number };
  };
  return { dispatch, push, notifications, badges, fetches, subscribed, posted, focused, opened, steps, pendingOpen };
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

  it("names an empty sender as unknown instead of dropping the notification", async () => {
    const worker = loadWorker();
    await worker.push({ ...mail, from: "" });
    await worker.push({ ...mail, from: "  ", count: 2 });
    expect(worker.notifications.map((n) => [n.title, n.options.body])).toEqual([
      ["Unbekannt", "Rechnung März\nTeam Postfach"],
      ["2 neue Nachrichten", "Unbekannt — Rechnung März\nTeam Postfach"]
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

  it("never turns a same-origin URL with a // path into a link to another host", async () => {
    const worker = loadWorker();
    for (const url of [`${origin}//evil.example.invalid/x`, `${origin}/\\evil.example.invalid/x`, "//evil.example.invalid/x", "/\\evil.example.invalid/x"]) {
      await worker.push({ ...mail, url });
    }
    expect(worker.notifications.map((n) => n.options.data)).toEqual(Array(4).fill({ url: "/" }));
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
      { ...mail, from: 5 }, { ...mail, from: undefined }, { type: "badge", badge: "3" }, { type: "badge", badge: -1 }, { type: "badge", badge: Number.NaN }];
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
    expect(worker.posted).toEqual([{ client: `${origin}/?f=INBOX`, message: { type: "noctua:notification-open", url: mail.url, at: expect.any(Number) } }]);
    const cold = loadWorker();
    await cold.dispatch("notificationclick", { notification: { data: { url: mail.url }, close() {} } });
    expect(cold.opened).toEqual([mail.url]);
  });
});

describe("service worker notification click on a window that cannot take it", () => {
  it("still posts the message when focus is refused", async () => {
    const worker = loadWorker({ clients: [{ url: `${origin}/?f=INBOX`, focusFails: true }] });
    await worker.dispatch("notificationclick", { notification: { data: { url: mail.url }, close() {} } });
    expect(worker.posted).toEqual([{ client: `${origin}/?f=INBOX`, message: { type: "noctua:notification-open", url: mail.url, at: expect.any(Number) } }]);
    expect(worker.opened).toEqual([]);
  });

  it("opens a window when no same-origin window can receive the message", async () => {
    const foreign = loadWorker({ clients: [{ url: "https://other.example.test/" }] });
    await foreign.dispatch("notificationclick", { notification: { data: { url: mail.url }, close() {} } });
    expect(foreign.opened).toEqual([mail.url]);
    expect(foreign.posted).toEqual([]);
    expect(foreign.focused).toEqual([]);
    const mute = loadWorker({ clients: [{ url: `${origin}/`, noPostMessage: true }] });
    await mute.dispatch("notificationclick", { notification: { data: { url: mail.url }, close() {} } });
    expect(mute.opened).toEqual([mail.url]);
  });
});

describe("service worker notification click stores the target for the page", () => {
  const click = { notification: { data: { url: mail.url }, close() {} } };

  it("stores the target before it focuses and posts, with the same tap id in both", async () => {
    const before = Date.now();
    const worker = loadWorker({ clients: [{ url: `${origin}/?f=INBOX` }] });
    await worker.dispatch("notificationclick", click);
    expect(worker.steps).toEqual(["store", "focus", "post"]);
    const pending = worker.pendingOpen()!;
    expect(pending.url).toBe(mail.url);
    expect(pending.at).toBeGreaterThanOrEqual(before);
    expect(worker.posted[0].message).toEqual({ type: "noctua:notification-open", url: mail.url, at: pending.at });
  });

  it("stores and still posts when focus never settles", async () => {
    const worker = loadWorker({ clients: [{ url: `${origin}/`, focusHangs: true }] });
    const started = Date.now();
    await worker.dispatch("notificationclick", click);
    expect(Date.now() - started).toBeLessThan(5000);
    expect(worker.steps).toEqual(["store", "focus", "post"]);
    expect(worker.pendingOpen()?.url).toBe(mail.url);
  });

  it("stores before openWindow when no window is open", async () => {
    const worker = loadWorker();
    await worker.dispatch("notificationclick", click);
    expect(worker.steps).toEqual(["store", "open"]);
    expect(worker.pendingOpen()?.url).toBe(mail.url);
  });

  it("uses the cache names the page reads", () => {
    expect(workerSource).toContain(`const PENDING_OPEN_CACHE = "${PENDING_OPEN_CACHE}";`);
    expect(workerSource).toContain(`const PENDING_OPEN_URL = "${PENDING_OPEN_URL}";`);
  });
});

describe("service worker notification click on a foreign target", () => {
  it("opens only same-origin windows, whatever the notification data says", async () => {
    for (const url of ["//evil.example.invalid/x", "https://evil.example.invalid/x", `${origin}//evil.example.invalid/x`]) {
      const cold = loadWorker();
      await cold.dispatch("notificationclick", { notification: { data: { url }, close() {} } });
      expect(cold.opened).toEqual(["/"]);
      const warm = loadWorker({ clients: [{ url: `${origin}/` }] });
      await warm.dispatch("notificationclick", { notification: { data: { url }, close() {} } });
      expect(warm.posted).toEqual([{ client: `${origin}/`, message: { type: "noctua:notification-open", url: "/", at: expect.any(Number) } }]);
    }
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
