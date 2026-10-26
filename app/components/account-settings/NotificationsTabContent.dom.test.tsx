import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { act, cleanup, fireEvent, render, renderHook, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { Theme } from "@radix-ui/themes";
import { I18nTestProvider } from "@/lib/i18n/testRender";
import NotificationsTabContent from "./tabs/NotificationsTabContent";
import { useCurrentPushDeviceSettings } from "@/app/hooks/useCurrentPushDeviceSettings";
import { base64UrlToBytes, describeUserAgent, PUSH_DEVICE_CHANGED_EVENT, pushEndpointHashOf, type PushDevice } from "@/lib/push/client";
import type { PushDeviceSettings } from "@/lib/push/types";

const DESKTOP_UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";
const IPHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const PUBLIC_KEY = "BAECAwQ"; // base64url of [4, 1, 2, 3, 4]
const ENDPOINT = "https://push.example.test/send/synthetic-current";
const ROTATED_ENDPOINT = "https://push.example.test/send/synthetic-rotated";
const OLD_KEY = new Uint8Array([4, 9, 9, 9, 9]);
// Same as the server's pushEndpointHash.
const hashOf = (endpoint: string) => createHash("sha256").update(endpoint).digest("hex").slice(0, 16);
const defaults: PushDeviceSettings = { accountIds: "all", includeSubject: true, quietHours: null, badge: true };
const mailboxes = [
  { id: "synthetic-team", name: "Synthetic Team", email: "team@example.test" },
  { id: "synthetic-own", name: "Synthetic Own", email: "own@example.test" }
];
const device = (id: string, userAgent: string, settings = defaults): PushDevice => ({ id, endpointHash: id === "synthetic-current" ? hashOf(ENDPOINT) : `hash-${id}`, userAgent, settings, createdAt: Date.UTC(2026, 9, 20, 8), lastSeenAt: Date.UTC(2026, 9, 24, 9, 30) });

// ---- Fake browser push stack -------------------------------------------------
type FakeSubscription = { endpoint: string; options: { applicationServerKey: ArrayBuffer | null }; unsubscribed: boolean; toJSON: () => unknown; unsubscribe: () => Promise<boolean> };
const browser = {
  permission: "default" as NotificationPermission,
  nextPermission: "granted" as NotificationPermission,
  subscription: null as FakeSubscription | null,
  subscribeKeys: [] as number[][],
  nextEndpoint: ENDPOINT
};
function fakeSubscription(key: Uint8Array, endpoint = ENDPOINT): FakeSubscription {
  const subscription: FakeSubscription = {
    endpoint, options: { applicationServerKey: key.slice().buffer }, unsubscribed: false,
    toJSON: () => ({ endpoint, expirationTime: null, keys: { p256dh: "synthetic-p256dh", auth: "synthetic-auth" } }),
    unsubscribe: async () => { subscription.unsubscribed = true; browser.subscription = null; return true; }
  };
  return subscription;
}
const registration = {
  pushManager: {
    getSubscription: async () => browser.subscription,
    subscribe: async ({ applicationServerKey }: { applicationServerKey: Uint8Array }) => {
      browser.subscribeKeys.push([...applicationServerKey]);
      browser.subscription = fakeSubscription(applicationServerKey, browser.nextEndpoint);
      return browser.subscription;
    }
  }
};
const saved: [object, PropertyKey, PropertyDescriptor | undefined][] = [];
function define(target: object, key: PropertyKey, value: unknown) {
  saved.push([target, key, Object.getOwnPropertyDescriptor(target, key)]);
  Object.defineProperty(target, key, { configurable: true, writable: true, value });
}
function installBrowser({ userAgent = DESKTOP_UA, push = true, standalone = false }: { userAgent?: string; push?: boolean; standalone?: boolean } = {}) {
  define(navigator, "userAgent", userAgent);
  define(navigator, "standalone", standalone);
  define(window, "matchMedia", (query: string) => ({ matches: standalone && query.includes("standalone"), media: query, addEventListener() {}, removeEventListener() {} }));
  if (!push) {
    for (const key of ["PushManager", "Notification"]) define(window, key, undefined);
    Reflect.deleteProperty(window, "PushManager"); Reflect.deleteProperty(window, "Notification");
    return;
  }
  define(window, "PushManager", function PushManager() {});
  define(window, "Notification", { get permission() { return browser.permission; }, requestPermission: async () => (browser.permission = browser.nextPermission) });
  define(navigator, "serviceWorker", { getRegistration: async () => registration, register: async () => registration, ready: Promise.resolve(registration) });
}

// ---- Fake push API -----------------------------------------------------------
type Call = { url: string; method: string; body: unknown };
function pushApi({ configured = true, devices = [] as PushDevice[], failPut = false, testSent = 1 } = {}) {
  const calls: Call[] = [];
  let list = [...devices];
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
  const apiFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input); const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url, method, body });
    if (url === "/api/push/vapid-public-key") return configured ? json({ ok: true, publicKey: PUBLIC_KEY }) : json({ ok: false }, 503);
    if (url === "/api/push/subscriptions" && method === "GET") return json({ ok: true, subscriptions: list });
    if (url === "/api/push/subscriptions" && method === "POST") {
      const existing = list.find(item => item.id === "synthetic-current");
      if (!existing) list = [...list, device("synthetic-current", body.userAgent, body.settings ?? defaults)];
      return json({ ok: true, id: "synthetic-current", settings: existing?.settings ?? body.settings ?? defaults });
    }
    if (url === "/api/push/subscriptions" && method === "DELETE") { list = list.filter(item => item.id !== "synthetic-current"); return json({ ok: true }); }
    if (url === "/api/push/test") return json({ ok: true, sent: testSent, failed: 1 - testSent });
    const id = decodeURIComponent(url.split("/").pop()!);
    if (method === "PUT") return failPut ? json({ ok: false }, 500) : json({ ok: true, settings: body.settings });
    if (method === "DELETE") { list = list.filter(item => item.id !== id); return json({ ok: true }); }
    return json({ ok: false }, 404);
  };
  return { apiFetch, calls };
}

const wrapper = ({ children }: { children: ReactNode }) => <I18nTestProvider locale="de"><Theme>{children}</Theme></I18nTestProvider>;
async function mount(apiFetch: ReturnType<typeof pushApi>["apiFetch"]) {
  let page!: ReturnType<typeof render>;
  await act(async () => { page = render(<NotificationsTabContent mailboxes={mailboxes} apiFetch={apiFetch} />, { wrapper }); });
  return page;
}

beforeEach(() => { browser.permission = "default"; browser.nextPermission = "granted"; browser.subscription = null; browser.subscribeKeys = []; browser.nextEndpoint = ENDPOINT; });
afterEach(() => {
  cleanup();
  for (const [target, key, descriptor] of saved.reverse()) {
    if (descriptor) Object.defineProperty(target, key, descriptor); else Reflect.deleteProperty(target, key);
  }
  saved.length = 0;
});

describe("push client helpers", () => {
  it("decodes base64url VAPID keys without padding", () => {
    expect([...base64UrlToBytes(PUBLIC_KEY)]).toEqual([4, 1, 2, 3, 4]);
    expect([...base64UrlToBytes("-_8")]).toEqual([251, 255]);
  });
  it("hashes the endpoint like the server", async () => {
    expect(await pushEndpointHashOf(ENDPOINT)).toBe(hashOf(ENDPOINT));
  });
  it("labels devices from their user agent", () => {
    expect(describeUserAgent(IPHONE_UA)).toBe("Safari · iPhone");
    expect(describeUserAgent(DESKTOP_UA)).toBe("Chrome · Linux");
    expect(describeUserAgent(null)).toBeNull();
  });
});

describe("Notifications settings tab", () => {
  it("shows the not-configured state when the server has no VAPID keys", async () => {
    installBrowser();
    const { apiFetch, calls } = pushApi({ configured: false });
    const page = await mount(apiFetch);
    await page.findByText("Push-Benachrichtigungen sind auf diesem Server nicht eingerichtet.");
    expect(page.queryByRole("switch")).toBeNull();
    expect(calls.map(call => call.url)).toEqual(["/api/push/vapid-public-key"]);
  });

  it("explains unsupported browsers and still lists other devices", async () => {
    installBrowser({ push: false });
    const { apiFetch } = pushApi({ devices: [device("synthetic-phone", IPHONE_UA)] });
    const page = await mount(apiFetch);
    await page.findByText("Dieser Browser unterstützt keine Push-Benachrichtigungen.");
    expect(page.getByText("Safari · iPhone")).toBeTruthy();
    expect(page.queryByRole("switch", { name: "Benachrichtigungen auf diesem Gerät" })).toBeNull();
  });

  it("shows the home screen install steps on iOS Safari outside the installed app", async () => {
    installBrowser({ userAgent: IPHONE_UA, push: false });
    const page = await mount(pushApi().apiFetch);
    await page.findByText("Zuerst zum Home-Bildschirm hinzufügen");
    expect(page.getByText("Tippe in Safari auf „Teilen“ (Quadrat mit Pfeil nach oben).")).toBeTruthy();
    expect(page.getByText("Wähle „Zum Home-Bildschirm“ und tippe auf „Hinzufügen“.")).toBeTruthy();
    expect(page.queryByRole("switch")).toBeNull();
  });

  it("offers the switch on iOS once the app runs from the home screen", async () => {
    installBrowser({ userAgent: IPHONE_UA, standalone: true });
    const page = await mount(pushApi().apiFetch);
    await page.findByRole("switch", { name: "Benachrichtigungen auf diesem Gerät" });
    expect(page.queryByText("Zuerst zum Home-Bildschirm hinzufügen")).toBeNull();
  });

  it("explains a blocked permission", async () => {
    installBrowser(); browser.permission = "denied";
    const page = await mount(pushApi().apiFetch);
    await page.findByText(/Benachrichtigungen sind für diese Seite blockiert/);
    expect(page.queryByRole("switch")).toBeNull();
  });

  it("subscribes this device after the permission prompt and posts it to the API", async () => {
    installBrowser();
    const { apiFetch, calls } = pushApi({ devices: [device("synthetic-phone", IPHONE_UA)] });
    const page = await mount(apiFetch);
    const toggle = await page.findByRole("switch", { name: "Benachrichtigungen auf diesem Gerät" });
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(toggle);
    await page.findByText("Dieses Gerät");
    expect(browser.subscribeKeys).toEqual([[4, 1, 2, 3, 4]]);
    const post = calls.find(call => call.method === "POST" && call.url === "/api/push/subscriptions")!;
    expect(post.body).toEqual({ subscription: { endpoint: ENDPOINT, expirationTime: null, keys: { p256dh: "synthetic-p256dh", auth: "synthetic-auth" } }, userAgent: DESKTOP_UA });
    expect(page.getByRole("switch", { name: "Benachrichtigungen auf diesem Gerät" }).getAttribute("aria-checked")).toBe("true");
    expect(page.getByRole("group", { name: "Einstellungen für Chrome · Linux" })).toBeTruthy();
    expect(page.getByText("Safari · iPhone")).toBeTruthy();
  });

  it("keeps the switch off when the permission prompt is dismissed", async () => {
    installBrowser(); browser.nextPermission = "default";
    const { apiFetch, calls } = pushApi();
    const page = await mount(apiFetch);
    fireEvent.click(await page.findByRole("switch", { name: "Benachrichtigungen auf diesem Gerät" }));
    await page.findByText("Die Berechtigung wurde nicht erteilt. Versuche es erneut und wähle „Erlauben“.");
    expect(browser.subscribeKeys).toEqual([]);
    expect(calls.some(call => call.method === "POST")).toBe(false);
  });

  it("edits the current device live and sends a test", async () => {
    installBrowser(); browser.permission = "granted"; browser.subscription = fakeSubscription(base64UrlToBytes(PUBLIC_KEY));
    const { apiFetch, calls } = pushApi({ devices: [device("synthetic-current", DESKTOP_UA), device("synthetic-phone", IPHONE_UA)] });
    const page = await mount(apiFetch);
    const settings = within(await page.findByRole("group", { name: "Einstellungen für Chrome · Linux" }));
    expect(page.getByText("Dieses Gerät")).toBeTruthy();
    // The load re-posted the existing subscription without settings, so the server keeps them.
    expect(calls.find(call => call.method === "POST")!.body).not.toHaveProperty("settings");
    const puts = () => calls.filter(call => call.method === "PUT");

    fireEvent.click(settings.getByRole("switch", { name: "Betreff anzeigen" }));
    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(puts()[0]).toEqual({ url: "/api/push/subscriptions/synthetic-current", method: "PUT", body: { settings: { ...defaults, includeSubject: false } } });
    await page.findByText("Gespeichert.");

    fireEvent.click(settings.getByRole("checkbox", { name: "Alle Postfächer (auch künftige)" }));
    await waitFor(() => expect(puts()).toHaveLength(2));
    expect(puts()[1].body).toEqual({ settings: { ...defaults, includeSubject: false, accountIds: ["synthetic-team", "synthetic-own"] } });
    fireEvent.click(settings.getByRole("checkbox", { name: "Synthetic Team (team@example.test)" }));
    await waitFor(() => expect(puts()).toHaveLength(3));
    expect((puts()[2].body as { settings: PushDeviceSettings }).settings.accountIds).toEqual(["synthetic-own"]);

    fireEvent.click(settings.getByRole("switch", { name: "Ruhezeit" }));
    await waitFor(() => expect(puts()).toHaveLength(4));
    const quiet = (puts()[3].body as { settings: PushDeviceSettings }).settings.quietHours!;
    expect([quiet.from, quiet.to, typeof quiet.timeZone]).toEqual(["22:00", "07:00", "string"]);
    fireEvent.change(settings.getByLabelText("Von"), { target: { value: "21:30" } });
    await waitFor(() => expect(puts()).toHaveLength(5));
    expect((puts()[4].body as { settings: PushDeviceSettings }).settings.quietHours).toEqual({ ...quiet, from: "21:30" });

    const currentCard = page.getByText("Dieses Gerät").closest(".rt-Card") as HTMLElement;
    fireEvent.click(within(currentCard).getByRole("button", { name: "Test senden" }));
    await page.findByText("Testbenachrichtigung gesendet.");
    expect(calls.find(call => call.url === "/api/push/test")!.body).toEqual({ id: "synthetic-current" });
  });

  it("restores the previous settings when saving fails", async () => {
    installBrowser(); browser.permission = "granted"; browser.subscription = fakeSubscription(base64UrlToBytes(PUBLIC_KEY));
    const page = await mount(pushApi({ devices: [device("synthetic-current", DESKTOP_UA)], failPut: true }).apiFetch);
    const settings = within(await page.findByRole("group", { name: "Einstellungen für Chrome · Linux" }));
    fireEvent.click(settings.getByRole("switch", { name: "Anzahl ungelesener E-Mails am App-Symbol" }));
    await page.findByText("Die Änderung ist fehlgeschlagen. Bitte versuche es erneut.");
    expect(settings.getByRole("switch", { name: "Anzahl ungelesener E-Mails am App-Symbol" }).getAttribute("aria-checked")).toBe("true");
  });

  it("removes another device by id and this device by endpoint", async () => {
    installBrowser(); browser.permission = "granted"; const subscription = fakeSubscription(base64UrlToBytes(PUBLIC_KEY)); browser.subscription = subscription;
    const { apiFetch, calls } = pushApi({ devices: [device("synthetic-current", DESKTOP_UA), device("synthetic-phone", IPHONE_UA)] });
    const page = await mount(apiFetch);
    // The foreign device can appear before the current-device subscription reconciliation.
    await page.findByText("Dieses Gerät");
    fireEvent.click(await page.findByRole("button", { name: "Safari · iPhone entfernen" }));
    await waitFor(() => expect(page.queryByText("Safari · iPhone")).toBeNull());
    expect(calls.some(call => call.method === "DELETE" && call.url === "/api/push/subscriptions/synthetic-phone")).toBe(true);

    fireEvent.click(page.getByRole("button", { name: "Chrome · Linux entfernen" }));
    await page.findByText("Noch kein Gerät angemeldet.");
    expect(calls.find(call => call.method === "DELETE" && call.url === "/api/push/subscriptions")!.body).toEqual({ endpoint: ENDPOINT });
    expect(subscription.unsubscribed).toBe(true);
    expect(page.getByRole("switch", { name: "Benachrichtigungen auf diesem Gerät" }).getAttribute("aria-checked")).toBe("false");
  });
});

describe("Notifications settings tab: devices the server no longer knows", () => {
  it("does not re-register a device removed elsewhere or owned by another user of this browser", async () => {
    installBrowser(); browser.permission = "granted"; browser.subscription = fakeSubscription(base64UrlToBytes(PUBLIC_KEY));
    const { apiFetch, calls } = pushApi({ devices: [device("synthetic-phone", IPHONE_UA)] });
    const page = await mount(apiFetch);
    await page.findByText("Safari · iPhone");
    const toggle = page.getByRole("switch", { name: "Benachrichtigungen auf diesem Gerät" });
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    expect(page.queryByText("Dieses Gerät")).toBeNull();
    expect(calls.some(call => call.method === "POST")).toBe(false);
    expect(browser.subscription?.unsubscribed).toBe(false);

    // Switching on is the explicit opt-in: the existing browser subscription is registered.
    fireEvent.click(toggle);
    await page.findByText("Dieses Gerät");
    expect(calls.filter(call => call.method === "POST").map(call => (call.body as { subscription: { endpoint: string } }).subscription.endpoint)).toEqual([ENDPOINT]);
    expect(browser.subscribeKeys).toEqual([]);
  });
});

describe("Notifications settings tab: VAPID key change", () => {
  it("moves a known device to a subscription with the new key and names the old endpoint", async () => {
    installBrowser(); browser.permission = "granted"; browser.subscription = fakeSubscription(OLD_KEY); browser.nextEndpoint = ROTATED_ENDPOINT;
    const old = browser.subscription;
    const { apiFetch, calls } = pushApi({ devices: [device("synthetic-current", DESKTOP_UA)] });
    const page = await mount(apiFetch);
    await page.findByText("Dieses Gerät");
    expect(old.unsubscribed).toBe(true);
    expect(browser.subscribeKeys).toEqual([[4, 1, 2, 3, 4]]);
    expect(calls.filter(call => call.method === "POST").map(call => call.body)).toEqual([{
      subscription: { endpoint: ROTATED_ENDPOINT, expirationTime: null, keys: { p256dh: "synthetic-p256dh", auth: "synthetic-auth" } },
      userAgent: DESKTOP_UA, previousEndpoint: ENDPOINT
    }]);
  });

  it("also names the old endpoint when switching on with a stale subscription", async () => {
    installBrowser(); browser.permission = "granted"; browser.subscription = fakeSubscription(OLD_KEY); browser.nextEndpoint = ROTATED_ENDPOINT;
    const { apiFetch, calls } = pushApi();
    const page = await mount(apiFetch);
    fireEvent.click(await page.findByRole("switch", { name: "Benachrichtigungen auf diesem Gerät" }));
    await page.findByText("Dieses Gerät");
    expect(calls.filter(call => call.method === "POST").map(call => (call.body as { previousEndpoint?: string }).previousEndpoint)).toEqual([ENDPOINT]);
  });
});

describe("Notifications settings tab: quiet hours", () => {
  it("keeps quiet hours that start when they end in the form with a hint instead of saving them", async () => {
    installBrowser(); browser.permission = "granted"; browser.subscription = fakeSubscription(base64UrlToBytes(PUBLIC_KEY));
    const quietHours = { from: "22:00", to: "07:00", timeZone: "Europe/Berlin" };
    const { apiFetch, calls } = pushApi({ devices: [device("synthetic-current", DESKTOP_UA, { ...defaults, quietHours })] });
    const page = await mount(apiFetch);
    const settings = within(await page.findByRole("group", { name: "Einstellungen für Chrome · Linux" }));
    const puts = () => calls.filter(call => call.method === "PUT");

    fireEvent.change(settings.getByLabelText("Bis"), { target: { value: "22:00" } });
    const hint = await page.findByRole("alert");
    expect(hint.textContent).toBe("Beginn und Ende der Ruhezeit müssen sich unterscheiden.");
    expect((settings.getByLabelText("Bis") as HTMLInputElement).value).toBe("22:00");
    expect(settings.getByLabelText("Von").getAttribute("aria-invalid")).toBe("true");
    expect(settings.getByLabelText("Bis").getAttribute("aria-describedby")).toBe(hint.id);
    expect(puts()).toEqual([]);

    fireEvent.change(settings.getByLabelText("Von"), { target: { value: "21:00" } });
    await waitFor(() => expect(puts()).toHaveLength(1));
    expect((puts()[0].body as { settings: PushDeviceSettings }).settings.quietHours).toEqual({ ...quietHours, from: "21:00", to: "22:00" });
    expect(page.queryByText("Beginn und Ende der Ruhezeit müssen sich unterscheiden.")).toBeNull();
    expect(settings.getByLabelText("Von").getAttribute("aria-invalid")).toBeNull();
  });
});

describe("current device push settings (app badge)", () => {
  it("loads this browser's device settings and reloads them when the tab changes the device", async () => {
    installBrowser(); browser.permission = "granted"; browser.subscription = fakeSubscription(base64UrlToBytes(PUBLIC_KEY));
    let settings: PushDeviceSettings = { ...defaults, accountIds: ["synthetic-own"] };
    const list = () => [device("synthetic-phone", IPHONE_UA), device("synthetic-current", DESKTOP_UA, settings)];
    const realFetch = globalThis.fetch;
    define(globalThis, "fetch", async (input: RequestInfo | URL) => {
      expect(String(input)).toBe("/api/push/subscriptions");
      return new Response(JSON.stringify({ ok: true, subscriptions: list() }), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    try {
      const { result, rerender } = renderHook(({ signedIn }) => useCurrentPushDeviceSettings(signedIn), { initialProps: { signedIn: true } });
      await waitFor(() => expect(result.current).toEqual(settings));
      settings = { ...settings, badge: false };
      act(() => { window.dispatchEvent(new Event(PUSH_DEVICE_CHANGED_EVENT)); });
      await waitFor(() => expect(result.current).toEqual(settings));
      rerender({ signedIn: false });
      expect(result.current).toBeNull();
    } finally {
      define(globalThis, "fetch", realFetch);
    }
  });

  it("is null without a subscription or when the server does not list this browser", async () => {
    installBrowser(); browser.permission = "granted";
    const { result } = renderHook(() => useCurrentPushDeviceSettings(true));
    await act(async () => { await Promise.resolve(); });
    expect(result.current).toBeNull();
  });

  it("announces changes to this device from the tab", async () => {
    installBrowser(); browser.permission = "granted"; browser.subscription = fakeSubscription(base64UrlToBytes(PUBLIC_KEY));
    let announced = 0;
    const count = () => { announced += 1; };
    window.addEventListener(PUSH_DEVICE_CHANGED_EVENT, count);
    try {
      const page = await mount(pushApi({ devices: [device("synthetic-current", DESKTOP_UA), device("synthetic-phone", IPHONE_UA)] }).apiFetch);
      const settings = within(await page.findByRole("group", { name: "Einstellungen für Chrome · Linux" }));
      fireEvent.click(settings.getByRole("switch", { name: "Anzahl ungelesener E-Mails am App-Symbol" }));
      await page.findByText("Gespeichert.");
      expect(announced).toBe(1);
      fireEvent.click(page.getByRole("button", { name: "Chrome · Linux entfernen" }));
      await waitFor(() => expect(announced).toBe(2));
    } finally {
      window.removeEventListener(PUSH_DEVICE_CHANGED_EVENT, count);
    }
  });
});
