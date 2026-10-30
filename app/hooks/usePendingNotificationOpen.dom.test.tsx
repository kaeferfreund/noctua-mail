import { afterEach, beforeEach, expect, test } from "bun:test";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { emptyDeepLink, serializeDeepLink } from "@/lib/navigation/deepLinks";
import { PENDING_OPEN_CACHE, PENDING_OPEN_MAX_AGE_MS, PENDING_OPEN_URL } from "@/lib/push/pendingOpen";
import { resetClientErrorReporterForTests } from "@/lib/ui/clientErrorReporter";
import { PENDING_OPEN_RECHECK_MS, usePendingNotificationOpen } from "./usePendingNotificationOpen";

const define = (target: object, key: string, value: unknown) => Object.defineProperty(target, key, { configurable: true, writable: true, value });
const target = { accountId: "qa-shared", messageId: "imap-0123456789abcdef01234567" };
const url = serializeDeepLink({ ...emptyDeepLink(), ...target, folderId: "qa-shared:INBOX" });

// Cache Storage as public/sw.js writes it.
const entries = new Map<string, string>();
const fakeCaches = {
  open: async (name: string) => {
    expect(name).toBe(PENDING_OPEN_CACHE);
    return {
      match: async (key: string) => entries.has(key) ? new Response(entries.get(key)) : undefined,
      delete: async (key: string) => entries.delete(key)
    };
  }
};
const store = (at = Date.now()) => { entries.set(PENDING_OPEN_URL, JSON.stringify({ url, at })); return at; };

const serviceWorker = new EventTarget();
const originalFetch = globalThis.fetch;
// Other DOM files run in the same process: put the browser globals back.
const originals = [[globalThis, "caches"], [navigator, "serviceWorker"]].map(([target, key]) =>
  [target, key, Object.getOwnPropertyDescriptor(target, key as string)] as const);
const reports: Array<Record<string, unknown>> = [];
let navigations: Array<[string, string | undefined]> = [];
const render = () => renderHook(() => usePendingNotificationOpen({ current: (messageId, accountId) => { navigations.push([messageId, accountId]); } }));
const settle = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });

beforeEach(() => {
  entries.clear(); reports.length = 0; navigations = [];
  resetClientErrorReporterForTests();
  define(globalThis, "caches", fakeCaches);
  define(navigator, "serviceWorker", serviceWorker);
  globalThis.fetch = (async (_input: unknown, init?: RequestInit) => {
    reports.push(JSON.parse(String(init?.body)));
    return new Response(null, { status: 204 });
  }) as typeof fetch;
  window.history.replaceState(null, "", "/?a=~qa-second&f=INBOX");
});
afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
  resetClientErrorReporterForTests();
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  for (const [target, key, descriptor] of originals) {
    if (descriptor) Object.defineProperty(target, key as string, descriptor);
    else delete (target as Record<string, unknown>)[key as string];
  }
});

test("a page that starts after the tap opens the stored message once and deletes the entry", async () => {
  store(Date.now() - 500);
  render();
  await waitFor(() => expect(navigations).toEqual([[target.messageId, target.accountId]]));
  expect(entries.size).toBe(0);
  await act(async () => { window.dispatchEvent(new Event("pageshow")); });
  await settle();
  expect(navigations).toHaveLength(1);
  expect(reports).toHaveLength(1);
  expect(reports[0]).toMatchObject({ source: "notification", kind: "notification-open", notificationOpen: { path: "store" } });
  expect((reports[0].notificationOpen as { ageMs: number }).ageMs).toBeGreaterThanOrEqual(500);
  expect(JSON.stringify(reports[0])).not.toContain(target.messageId);
});

test("a cold start through openWindow already shows the target: the entry is only deleted", async () => {
  window.history.replaceState(null, "", url);
  store();
  render();
  await waitFor(() => expect(entries.size).toBe(0));
  await settle();
  expect(navigations).toEqual([]);
  expect(reports[0]).toMatchObject({ kind: "notification-open", notificationOpen: { path: "url" } });
});

test("an old tap is dropped without opening", async () => {
  store(Date.now() - PENDING_OPEN_MAX_AGE_MS - 1000);
  render();
  await waitFor(() => expect(entries.size).toBe(0));
  await settle();
  expect(navigations).toEqual([]);
  expect(reports).toEqual([]);
});

test("the worker's message and the stored copy of the same tap open it once", async () => {
  render();
  await settle();
  const at = store();
  await act(async () => {
    serviceWorker.dispatchEvent(new MessageEvent("message", { data: { type: "noctua:notification-open", url, at } }));
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await settle();
  expect(navigations).toEqual([[target.messageId, target.accountId]]);
  expect(entries.size).toBe(0);
  expect(reports.map(report => (report.notificationOpen as { path: string }).path)).toEqual(["message"]);
  // A later tap on the same message is a new tap and opens again.
  await act(async () => {
    serviceWorker.dispatchEvent(new MessageEvent("message", { data: { type: "noctua:notification-open", url, at: at + 1 } }));
  });
  await settle();
  expect(navigations).toHaveLength(2);
});

test("a target stored after the app became visible is picked up by the re-check", async () => {
  render();
  await settle();
  await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
  await settle();
  store();
  expect(navigations).toEqual([]);
  await act(async () => { await new Promise(resolve => setTimeout(resolve, PENDING_OPEN_RECHECK_MS[0] + 50)); });
  expect(navigations).toEqual([[target.messageId, target.accountId]]);
});

test("pageshow and a new service worker controller take the stored target; a hidden page waits", async () => {
  render();
  await settle();
  store();
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
  await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
  await settle();
  expect(navigations).toEqual([]);
  await act(async () => { serviceWorker.dispatchEvent(new Event("controllerchange")); });
  await waitFor(() => expect(navigations).toHaveLength(1));
  store();
  await act(async () => { window.dispatchEvent(new Event("pageshow")); });
  await waitFor(() => expect(navigations).toHaveLength(2));
});

test("without Cache Storage the worker's message still opens the message", async () => {
  delete (globalThis as { caches?: unknown }).caches;
  render();
  await act(async () => {
    serviceWorker.dispatchEvent(new MessageEvent("message", { data: { type: "noctua:notification-open", url } }));
  });
  await waitFor(() => expect(navigations).toEqual([[target.messageId, target.accountId]]));
});

test("unmounting removes the listeners", async () => {
  const { unmount } = render();
  await settle();
  unmount();
  store();
  await act(async () => {
    serviceWorker.dispatchEvent(new MessageEvent("message", { data: { type: "noctua:notification-open", url, at: 1 } }));
    window.dispatchEvent(new Event("pageshow"));
  });
  await settle();
  expect(navigations).toEqual([]);
  expect(entries.size).toBe(1);
});
