import { describe, expect, it } from "bun:test";
import { authorizeDeepLink, notificationDeepLink, deepLinkHistoryMode, emptyDeepLink, parseDeepLink, serializeDeepLink } from "./deepLinks";

describe("mail URL state", () => {
  it("round trips ids, unicode search, filters and every shell place without draft content", () => {
    const state = { ...emptyDeepLink(), accountId: "mailbox-a", folderId: "mailbox-a:Projects/2026", messageId: "imap-abc123",
      query: "größer & kleiner?", scope: "all" as const, view: "virtual:open" as const, group: "sender" as const,
      badges: ["unread", "flagged"], fields: ["subject"], settings: "preferences" as const, admin: "audit" as const,
      panel: "calendar" as const, calendar: true, security: true, compose: true };
    const url = serializeDeepLink(state);
    expect(parseDeepLink(new URL(url, "http://localhost").search)).toEqual(state);
    expect(url).toContain("mailto=mailto%3A");
    expect(serializeDeepLink(state, "/?mailto=mailto:private@example.test?body=secret#kept")).not.toContain("private");
  });
  it("preserves unrelated params/hash and normalizes legacy params", () => {
    const legacy = parseDeepLink("?accountId=a&messageId=%3Crfc%40example.test%3E&scope=all&q=typed&openCalendar=1");
    expect(legacy.messageId).toBe("<rfc@example.test>");
    expect(legacy.panel).toBe("calendar");
    const canonical = serializeDeepLink({ ...legacy, messageId: "imap-abc" }, "/?messageId=old&extra=kept#anchor");
    expect(canonical).toContain("extra=kept"); expect(canonical).toEndWith("#anchor");
    expect(canonical).not.toContain("messageId=old");
    expect(parseDeepLink("?openMessageId=local&messageId=external").messageId).toBe("local");
  });
  it("rejects malformed enums and explicit empty fields survive round trip", () => {
    expect(parseDeepLink("?scope=bad&view=bad&settings=bad&admin=bad&group=bad&panel=bad")).toEqual(emptyDeepLink());
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

it("normalizes warm notification URL/fields through the same legacy parser as cold entry", () => {
  expect(notificationDeepLink({ url: "/?accountId=a&messageId=legacy" })).toEqual({ ...emptyDeepLink(), accountId: "a", messageId: "legacy" });
  expect(notificationDeepLink({ url: "/?accountId=a&messageId=legacy", accountId: "b", messageId: "new" })).toEqual({ ...emptyDeepLink(), accountId: "b", messageId: "new" });
});

it("replaces only virtual-view auto-clear while keeping the filter navigation entry", () => {
  const view = { ...emptyDeepLink(), accountId: "a", scope: "all" as const, view: "virtual:unassigned" as const };
  const filtered = { ...view, badges: ["unread"] };
  expect(deepLinkHistoryMode(view, filtered)).toBe("push");
  expect(deepLinkHistoryMode(filtered, { ...filtered, view: null })).toBe("replace");
  expect(deepLinkHistoryMode(view, { ...view, view: null })).toBe("push");
});
