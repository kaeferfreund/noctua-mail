import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { authorizeDeepLink, notificationDeepLink, deepLinkHistoryMode, emptyDeepLink, parseDeepLink, serializeDeepLink, encodeDeepLinkId } from "./deepLinks";

describe("mail URL state", () => {
  const accountId = "acc-0357e6dc07a93be003c3321b";
  const messageId = "imap-4d2efbb6963d6825053ba2d5";
  it("encodes the twelve ID bytes, drops the redundant account and writes only compact keys", () => {
    const state = { ...emptyDeepLink(), accountId, folderId: `${accountId}:INBOX`, messageId };
    const url = serializeDeepLink(state);
    expect(url).toBe("/?a=A1fm3AepO-ADwzIb&f=INBOX&m=TS77tpY9aCUFO6LV");
    expect(parseDeepLink(url.slice(1))).toEqual(state);
    expect(serializeDeepLink(state, "/?a=old&f=old&m=old&s=all&g=sender")).toBe(url);
  });
  it("never carries a one-time invite code into a new URL but keeps other fragments", () => {
    const state = { ...emptyDeepLink(), accountId, folderId: `${accountId}:INBOX` };
    expect(serializeDeepLink(state, "/?a=old#invite=synthetic-code")).toBe("/?a=A1fm3AepO-ADwzIb&f=INBOX");
    expect(serializeDeepLink(state, "/?a=old#invite=synthetic-code&x=1")).toBe("/?a=A1fm3AepO-ADwzIb&f=INBOX#x=1");
    expect(serializeDeepLink(state, "/?a=old#section-2")).toBe("/?a=A1fm3AepO-ADwzIb&f=INBOX#section-2");
  });
  it.each(["abc", "abcdefghijklmnop", "~raw", "imap-4D2EFBB6963D6825053BA2D5", "imap-4d2efbb6963d6825053ba2d5-2", "<rfc+ä@example.test>", " space & / ? # "])("round trips noncanonical IDs without ambiguity: %s", id => {
    const state = { ...emptyDeepLink(), accountId: id, messageId: id };
    const url = serializeDeepLink(state);
    expect(new URL(url, "http://localhost").searchParams.get("a")).toBe(`~${id}`);
    expect(new URL(url, "http://localhost").searchParams.get("m")).toBe(`~${id}`);
    expect(parseDeepLink(url.slice(1))).toEqual(state);
  });
  it.each(["INBOX", "Projekte/Grüße & Pläne", "A B/子/2026", "~archive", "~:raw", "~~escaped", "", "/", "a:b"])("round trips account-relative folder paths: %s", path => {
    const state = { ...emptyDeepLink(), accountId, folderId: `${accountId}:${path}` };
    const url = serializeDeepLink(state);
    expect(new URL(url, "http://localhost").searchParams.get("f")).not.toContain(accountId);
    expect(parseDeepLink(url.slice(1))).toEqual(state);
  });
  it("retains nonrelative folder IDs and folders without an account", () => {
    for (const account of [accountId, ""]) {
      for (const folderId of ["other:INBOX", "~raw", "~:raw"]) {
        const state = { ...emptyDeepLink(), accountId: account, folderId };
        expect(parseDeepLink(serializeDeepLink(state).slice(1))).toEqual(state);
      }
    }
  });
  it("rejects malformed encodings and keeps permission checks", () => {
    const compact = "a=A1fm3AepO-ADwzIb&f=INBOX&m=TS77tpY9aCUFO6LV&s=all&g=sender";
    const state = parseDeepLink(`?${compact}`);
    expect(state).toMatchObject({ accountId, folderId: `${accountId}:INBOX`, messageId, scope: "all", group: "sender" });
    expect(authorizeDeepLink(state, ["allowed"], "allowed").forbidden).toBe(true);
    for (const value of ["bad", "AAAAAAAAAAAAAAA=", "AAAAAAAAAAAAAAA+", "AAAAAAAAAAAAAAA/", ""]) {
      expect(parseDeepLink(`?a=${encodeURIComponent(value)}&m=${encodeURIComponent(value)}`)).toEqual(emptyDeepLink());
    }
    expect(notificationDeepLink({ url: `/?${compact}` })).toEqual(state);
  });
  it("keeps the classic service worker encoder compatible with the shared URL contract", () => {
    const worker = readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8");
    const context = { self: { addEventListener() {} }, btoa };
    runInNewContext(worker, context);
    for (const prefix of ["acc", "imap"] as const) {
      for (const id of [accountId, messageId, `${prefix}-ffffffffffffffffffffffff`, "raw-ä", "~raw", "<rfc@example.test>"]) {
        expect(runInNewContext(`encodeDeepLinkId(${JSON.stringify(id)}, ${JSON.stringify(prefix)})`, context)).toBe(encodeDeepLinkId(id, prefix));
      }
    }
  });
  it.each([true, false])("generates compact reminder URLs for warm/cold clicks (reminder includes account: %s)", async includesAccount => {
    const listeners = new Map<string, (event: unknown) => void>();
    const notifications: Array<{ data: { url: string } }> = [];
    const posted: Array<{ type: string; url: string }> = [];
    const opened: string[] = [];
    const client = { url: "http://localhost/", focus: async () => {}, postMessage: (value: { type: string; url: string }) => posted.push(value) };
    let windows: typeof client[] = [];
    const context = {
      btoa, URL, URLSearchParams, Response,
      caches: { open: async () => ({ match: async () => Response.json({ accountIds: [accountId], deliveredByAccount: {} }), put: async () => {} }) },
      fetch: async () => Response.json({ items: [{ id: "synthetic-reminder", accountId: includesAccount ? accountId : undefined, messageId,
        triggerAtMs: Date.now() - 1000, eventStartAtMs: Date.now() + 60000, eventTitle: "Synthetic event" }] }),
      self: {
        addEventListener: (type: string, callback: (event: unknown) => void) => listeners.set(type, callback),
        location: { origin: "http://localhost" },
        clients: { matchAll: async () => windows, openWindow: async (url: string) => { opened.push(url); } },
        registration: { showNotification: async (_title: string, options: { data: { url: string } }) => { notifications.push(options); } }
      }
    };
    runInNewContext(readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8"), context);
    await runInNewContext('processReminderNotifications("force")', context);
    const url = serializeDeepLink({ ...emptyDeepLink(), accountId, messageId });
    expect(notifications).toHaveLength(1);
    expect(notifications[0].data.url).toBe(url);
    let pending = Promise.resolve();
    const click = () => listeners.get("notificationclick")!({ notification: { data: notifications[0].data, close() {} },
      waitUntil: (promise: Promise<void>) => { pending = promise; } });
    click(); await pending;
    expect(opened).toEqual([url]);
    windows = [client];
    click(); await pending;
    expect(posted).toEqual([{ type: "noctua:notification-open", url }]);
    expect(notificationDeepLink(posted[0])).toMatchObject({ accountId, messageId });
  });
  it("round trips ids, unicode search, filters and every shell place without draft content", () => {
    const state = { ...emptyDeepLink(), accountId: "mailbox-a", folderId: "mailbox-a:Projects/2026", messageId: "imap-abc123",
      query: "größer & kleiner?", scope: "all" as const, view: "virtual:open" as const, group: "sender" as const,
      badges: ["unread", "flagged"], fields: ["subject"], settings: "preferences" as const, admin: "audit" as const,
      panel: "calendar" as const, calendar: true, security: true, compose: true };
    const url = serializeDeepLink(state);
    expect(parseDeepLink(new URL(url, "http://localhost").search)).toEqual(state);
    expect(url).toContain("c=mailto%3A");
    expect(serializeDeepLink(state, "/?c=mailto:private@example.test?body=secret#kept")).not.toContain("private");
  });
  it("preserves unrelated parameters and hashes", () => {
    const canonical = serializeDeepLink({ ...emptyDeepLink(), accountId, messageId }, "/?m=~old&extra=kept#anchor");
    expect(canonical).toContain("extra=kept"); expect(canonical).toEndWith("#anchor");
    expect(parseDeepLink(new URL(canonical, "http://localhost").search)).toMatchObject({ accountId, messageId });
  });
  it("rejects malformed enums and explicit empty fields survive round trip", () => {
    expect(parseDeepLink("?s=bad&view=bad&settings=bad&admin=bad&g=bad&panel=bad")).toEqual(emptyDeepLink());
    expect(parseDeepLink(serializeDeepLink({ ...emptyDeepLink(), fields: [] }).split("?")[1]).fields).toEqual([]);
  });
  it("pushes places; replaces typing and keyboard message selection", () => {
    const base = emptyDeepLink();
    expect(deepLinkHistoryMode(base, { ...base, query: "text" })).toBe("replace");
    for (const next of [{ ...base, accountId: "b" }, { ...base, folderId: "b:INBOX" }, { ...base, messageId: "imap-a" }, { ...base, settings: "topics" as const }]) expect(deepLinkHistoryMode(base, next)).toBe("push");
    expect(deepLinkHistoryMode(base, { ...base, settings: "topics" }, true)).toBe("push");
    expect(deepLinkHistoryMode({ ...base, accountId: "a" }, { ...base, accountId: "a", folderId: "a:INBOX" })).toBe("replace");
    expect(deepLinkHistoryMode({ ...base, accountId: "a", folderId: "a:INBOX" }, { ...base, accountId: "a", folderId: "a:Sent" })).toBe("push");
    expect(deepLinkHistoryMode({ ...base, messageId: "one" }, { ...base, messageId: "two" }, true)).toBe("replace");
  });
  it("drops the entire forbidden mailbox target, including its message and query", () => {
    const result = authorizeDeepLink({ ...emptyDeepLink(), accountId: "secret", messageId: "imap-private", query: "secret" }, ["allowed"], "allowed");
    expect(result).toEqual({ state: { ...emptyDeepLink(), accountId: "allowed" }, forbidden: true });
  });
});

it("uses compact notification URLs for warm opens", () => {
  expect(notificationDeepLink({ url: "/?a=~a&m=~rfc" })).toEqual({ ...emptyDeepLink(), accountId: "a", messageId: "rfc" });
  expect(notificationDeepLink({})).toEqual(emptyDeepLink());
});

it("replaces only virtual-view auto-clear while keeping the filter navigation entry", () => {
  const view = { ...emptyDeepLink(), accountId: "a", scope: "all" as const, view: "virtual:unassigned" as const };
  const filtered = { ...view, badges: ["unread"] };
  expect(deepLinkHistoryMode(view, filtered)).toBe("push");
  expect(deepLinkHistoryMode(filtered, { ...filtered, view: null })).toBe("replace");
  expect(deepLinkHistoryMode(view, { ...view, view: null })).toBe("push");
});
