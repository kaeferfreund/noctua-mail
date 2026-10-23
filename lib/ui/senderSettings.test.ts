import { expect, test } from "bun:test";
import { loadSenderSettings } from "./senderSettings";
test("reloads private sender data each time and captures the requested mailbox independently of the active account", async () => {
  let version = 0;
  const paths: string[] = [];
  const apiFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input); paths.push(url); expect(init?.cache).toBe("no-store");
    return new Response(JSON.stringify(url.endsWith("/identities") ? { identities: [{ id: `alias-${version}`, accountId: "captured" }], ownAddresses: ["alias@example.test"] } : url.endsWith("/prefs") ? { prefs: { defaultIdentityId: `alias-${version}` } } : { accountId: "other", user: { id: "synthetic-user", email: "user@example.test" }, accounts: [{ id: "captured", email: "captured@example.test", settings: { defaultSignatureId: "team" } }, { id: "other" }] }));
  };
  const first = await loadSenderSettings(apiFetch, "captured"); version++;
  const second = await loadSenderSettings(apiFetch, "captured");
  expect(first.account.id).toBe("captured"); expect(second.account.id).toBe("captured");
  expect(first.prefs.defaultIdentityId).toBe("alias-0"); expect(second.prefs.defaultIdentityId).toBe("alias-1");
  expect(second.account.ownAddresses).toEqual(["alias@example.test"]); expect(paths).toHaveLength(6);
});
test("failed or inaccessible sender reads never resolve to a cached/default mailbox", async () => {
  await expect(loadSenderSettings(async () => new Response("{}", { status: 403 }), "a")).rejects.toThrow("Could not load sender");
  await expect(loadSenderSettings(async () => new Response(JSON.stringify({ identities: [], user: { email: "user@example.test" }, accounts: [] })), "a")).rejects.toThrow("unavailable");
});
