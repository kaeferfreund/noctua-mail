import { describe, expect, it } from "bun:test";
import { setAppBadge, unreadBadgeCount } from "./badge";
import { DEFAULT_PUSH_DEVICE_SETTINGS } from "./types";

function badgingNavigator(options: { clear?: boolean; reject?: boolean } = {}) {
  const calls: Array<number | "cleared"> = [];
  const settle = () => (options.reject ? Promise.reject(new Error("not allowed")) : Promise.resolve());
  return {
    calls,
    nav: {
      setAppBadge: (count?: number) => { calls.push(count ?? -1); return settle(); },
      ...(options.clear === false ? {} : { clearAppBadge: () => { calls.push("cleared"); return settle(); } })
    }
  };
}

describe("app badge", () => {
  it("sets positive counts and clears zero or invalid counts", () => {
    const { calls, nav } = badgingNavigator();
    for (const count of [3, 2.9, 0, -4, Number.NaN]) setAppBadge(count, nav);
    expect(calls).toEqual([3, 2, "cleared", "cleared", "cleared"]);
    const noClear = badgingNavigator({ clear: false });
    setAppBadge(0, noClear.nav);
    expect(noClear.calls).toEqual([0]);
  });

  it("is a silent no-op without the Badging API or when the browser refuses", async () => {
    expect(() => setAppBadge(5, {})).not.toThrow();
    expect(() => setAppBadge(5)).not.toThrow();
    const refusing = badgingNavigator({ reject: true });
    setAppBadge(5, refusing.nav);
    await Promise.resolve();
    expect(refusing.calls).toEqual([5]);
  });

  it("sums synced unread inbox counts", () => {
    expect(unreadBadgeCount([{ accountId: "a", unread: 2 }, { accountId: "b", unread: null }, { accountId: "c", unread: 5 }])).toBe(7);
    expect(unreadBadgeCount([])).toBe(0);
  });

  it("follows this device's push settings like the server's badge", () => {
    const mailboxes = [{ accountId: "synthetic-team", unread: 2 }, { accountId: "synthetic-own", unread: 5 }];
    expect(unreadBadgeCount(mailboxes, DEFAULT_PUSH_DEVICE_SETTINGS)).toBe(7);
    expect(unreadBadgeCount(mailboxes, { ...DEFAULT_PUSH_DEVICE_SETTINGS, accountIds: ["synthetic-own"] })).toBe(5);
    expect(unreadBadgeCount(mailboxes, { ...DEFAULT_PUSH_DEVICE_SETTINGS, accountIds: [] })).toBe(0);
    expect(unreadBadgeCount(mailboxes, { ...DEFAULT_PUSH_DEVICE_SETTINGS, badge: false })).toBe(0);
  });
});
