import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import {
  clearCalendarReminderStorage,
  deleteCalendarReminder,
  fetchCalendarReminders,
  markReminderDeliveredOnClientById,
  readDeliveredReminderMap,
  setCalendarReminderStoragePrincipal
} from "./calendarReminders";

// Shared-browser isolation: reminder cache, offline queue and delivered marks
// belong to one signed-in user and are never shown to or replayed for another.

function createFakeLocalStorage() {
  const store = new Map<string, string>();
  return {
    store,
    get length() {
      return store.size;
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear()
  };
}

const originalWindow = (globalThis as Record<string, unknown>).window;
const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
const originalFetch = globalThis.fetch;
const storage = createFakeLocalStorage();
const network = { onLine: true };
let serverUserId = "user-a";
let failReads = false;
const requests: Array<{ method: string; url: string; body: string | null }> = [];

function reminderFor(userId: string, accountId: string, title: string) {
  const now = Date.now();
  return {
    id: `reminder-${userId}`, accountId, userId, eventTitle: title, eventStartAtMs: now + 3_600_000,
    nextEventStartAtMs: now + 3_600_000, leadMinutes: 15, leadLabel: "15 minutes", triggerAtMs: now + 2_700_000,
    createdAtMs: now, updatedAtMs: now
  };
}

beforeAll(() => {
  (globalThis as Record<string, unknown>).window = { localStorage: storage, dispatchEvent: () => true };
  Object.defineProperty(globalThis, "navigator", { value: network, configurable: true });
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    requests.push({ method, url, body: typeof init?.body === "string" ? init.body : null });
    if (method === "GET" && failReads) return new Response("offline", { status: 503 });
    const accountId = decodeURIComponent(url.split("/api/accounts/")[1]?.split("/")[0] ?? "");
    const items = method === "GET" ? [reminderFor(serverUserId, accountId, `Private ${serverUserId}`)] : [];
    return new Response(JSON.stringify({ ok: true, items }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as unknown as typeof fetch;
});

afterAll(() => {
  clearCalendarReminderStorage();
  (globalThis as Record<string, unknown>).window = originalWindow;
  if (originalNavigatorDescriptor) Object.defineProperty(globalThis, "navigator", originalNavigatorDescriptor);
  globalThis.fetch = originalFetch;
});

beforeEach(() => {
  clearCalendarReminderStorage();
  storage.clear();
  requests.length = 0;
  failReads = false;
  network.onLine = true;
  serverUserId = "user-a";
});

const reminderKeys = () => Array.from(storage.store.keys()).filter((key) => key.startsWith("noctua:calendar-reminder-") && !key.endsWith("-principal"));

describe("calendar reminder storage per signed-in user", () => {
  it("never serves the previous user's cached reminders to the next user of the same mailbox", async () => {
    const accountId = `shared-${crypto.randomUUID()}`;
    setCalendarReminderStoragePrincipal("user-a");
    expect((await fetchCalendarReminders(accountId)).map((item) => item.eventTitle)).toEqual(["Private user-a"]);
    expect(reminderKeys().length).toBeGreaterThan(0);

    // User B signs in on the same browser; the server is unreachable.
    setCalendarReminderStoragePrincipal("user-b");
    expect(reminderKeys()).toEqual([]);
    failReads = true;
    expect(await fetchCalendarReminders(accountId)).toEqual([]);
    network.onLine = false;
    expect(await fetchCalendarReminders(accountId)).toEqual([]);
  });

  it("does not replay the previous user's queued edits under the next user's session", async () => {
    const accountId = `shared-${crypto.randomUUID()}`;
    setCalendarReminderStoragePrincipal("user-a");
    network.onLine = false;
    await deleteCalendarReminder(accountId, "reminder-user-a");
    expect(requests.filter((request) => request.method === "DELETE")).toEqual([]);

    setCalendarReminderStoragePrincipal("user-b");
    network.onLine = true;
    serverUserId = "user-b";
    expect((await fetchCalendarReminders(accountId)).map((item) => item.eventTitle)).toEqual(["Private user-b"]);
    expect(requests.filter((request) => request.method === "DELETE")).toEqual([]);
  });

  it("replays the same user's queued edits after a reload", async () => {
    const accountId = `own-${crypto.randomUUID()}`;
    setCalendarReminderStoragePrincipal("user-a");
    network.onLine = false;
    await deleteCalendarReminder(accountId, "reminder-user-a");
    network.onLine = true;
    setCalendarReminderStoragePrincipal("user-a");
    await fetchCalendarReminders(accountId);
    expect(requests.filter((request) => request.method === "DELETE").map((request) => request.body)).toEqual([JSON.stringify({ reminderId: "reminder-user-a" })]);
  });

  it("sign-out removes every reminder entry, including entries from before user binding", async () => {
    const accountId = `logout-${crypto.randomUUID()}`;
    storage.setItem(`noctua:calendar-reminder-cache:${accountId}`, "[]");
    storage.setItem(`noctua:calendar-reminder-queue:${accountId}`, "[]");
    setCalendarReminderStoragePrincipal("user-a");
    expect(reminderKeys()).toEqual([]);
    await fetchCalendarReminders(accountId);
    markReminderDeliveredOnClientById(accountId, "client-1", "reminder-user-a", 1);
    expect(readDeliveredReminderMap(accountId, "client-1")).toEqual({ "reminder-user-a": 1 });
    expect(reminderKeys().length).toBeGreaterThan(1);

    clearCalendarReminderStorage();
    expect(reminderKeys()).toEqual([]);
    expect(storage.getItem("noctua:calendar-reminder-principal")).toBeNull();
    expect(readDeliveredReminderMap(accountId, "client-1")).toEqual({});
  });

  it("without a known user nothing is persisted in the browser", async () => {
    const accountId = `anonymous-${crypto.randomUUID()}`;
    expect((await fetchCalendarReminders(accountId)).map((item) => item.eventTitle)).toEqual(["Private user-a"]);
    expect(reminderKeys()).toEqual([]);
  });
});
