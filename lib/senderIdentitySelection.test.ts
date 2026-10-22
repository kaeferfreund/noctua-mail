import { describe, expect, test } from "bun:test";
import type { SenderIdentity } from "./data";
import { resolveComposeIdentity } from "./senderIdentitySelection";
const identity = (id: string, extra: Partial<SenderIdentity> = {}): SenderIdentity => ({
  id, accountId: "a", email: `${id}@example.test`, displayName: id, enabled: true, isDefault: false,
  createdBy: null, createdAt: 1, updatedAt: 1, ...extra
});
const identities = [identity("primary", { isDefault: true }), identity("personal"), identity("alias"), identity("disabled", { enabled: false }), identity("foreign", { accountId: "b" })];
const message = { from: "customer@example.test", to: "", cc: "", bcc: "", originalTo: [] as string[], deliveredTo: [] as string[] };
const resolve = (extra: Partial<Parameters<typeof resolveComposeIdentity>[0]> = {}) => resolveComposeIdentity({ accountId: "a", identities, prefs: { defaultIdentityId: "personal" }, ...extra });

describe("compose identity selection", () => {
  test("personal then mailbox default; stale and foreign preference warns", () => {
    expect(resolve().identity?.id).toBe("personal");
    for (const id of ["disabled", "missing", "foreign"]) {
      const result = resolve({ prefs: { defaultIdentityId: id } });
      expect(result.identity?.id).toBe("primary"); expect(result.warnings).toHaveLength(1);
    }
  });
  test("every reply tier wins over all lower tiers", () => {
    const tiers = ["to", "cc", "bcc", "originalTo", "deliveredTo"] as const;
    for (const [index, tier] of tiers.entries()) {
      const source = { ...message, deliveredTo: ["primary@example.test"] };
      for (const lower of tiers.slice(index + 1)) Object.assign(source, { [lower]: lower.endsWith("To") ? ["primary@example.test"] : "primary@example.test" });
      Object.assign(source, { [tier]: tier === "originalTo" || tier === "deliveredTo" ? ["alias@example.test"] : "alias@example.test" });
      expect(resolve({ mode: "replyAll", message: source }).identity?.id).toBe("alias");
    }
  });
  test("tier ties prefer personal, mailbox, header order then stable id", () => {
    const select = (to: string, prefs = {}) => resolve({ mode: "reply", prefs, message: { ...message, to } }).identity?.id;
    expect(select("alias@example.test, primary@example.test, personal@example.test", { defaultIdentityId: "personal" })).toBe("personal");
    expect(select("alias@example.test, primary@example.test")).toBe("primary");
    expect(select("alias@example.test, personal@example.test")).toBe("alias");
    expect(resolve({ identities: [identity("z", { email: "alias@example.test" }), identity("a", { email: "alias@example.test" })], prefs: {}, mode: "reply", message: { ...message, to: "alias@example.test" } }).identity?.id).toBe("a");
  });
  test("enabled self-sender precedes recipients; forward starts at defaults", () => {
    const source = { ...message, from: "alias@example.test", to: "primary@example.test" };
    expect(resolve({ mode: "reply", message: source }).identity?.id).toBe("alias");
    expect(resolve({ mode: "forward", message: source }).identity?.id).toBe("personal");
    expect(resolve({ mode: "reply", message: { ...source, from: "disabled@example.test" } }).identity?.id).toBe("primary");
  });
  test("draft restores disabled identity and unknown selection without fallback", () => {
    expect(resolve({ mode: "draft", message: { ...message, senderIdentityId: "disabled" } }).identity?.id).toBe("disabled");
    const unknown = resolve({ mode: "draft", message: { ...message, senderIdentityId: "foreign" } });
    expect(unknown.identity).toBeUndefined(); expect(unknown.unavailableIdentityId).toBe("foreign");
    expect(resolve({ mode: "draft", message: { ...message, from: "alias@example.test" } }).identity?.id).toBe("alias");
  });
});
