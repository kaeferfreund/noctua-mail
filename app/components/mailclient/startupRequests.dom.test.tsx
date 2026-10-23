import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { RecipientAlias } from "@/lib/data";
import { useRecipientAliases } from "./useRecipientAliases";
import { ensureRecipientAliasesReady } from "./recipientAliasesResource";
import { useTopics } from "./useTopics";

const alias = { id: "alias-test", accountId: "account-a", name: "Synthetic team",
  recipients: "team@example.test", normalizedRecipients: "team@example.test" } as RecipientAlias;
let idleTasks: Map<number, IdleRequestCallback>;
let nextId = 0;
const originalIdle = window.requestIdleCallback;
const originalCancelIdle = window.cancelIdleCallback;

beforeEach(() => {
  idleTasks = new Map();
  window.requestIdleCallback = (task) => { const id = ++nextId; idleTasks.set(id, task); return id; };
  window.cancelIdleCallback = (id) => { idleTasks.delete(id); };
});
afterEach(() => {
  cleanup();
  window.requestIdleCallback = originalIdle;
  window.cancelIdleCallback = originalCancelIdle;
});
async function runIdle() {
  await act(async () => {
    for (const [id, task] of [...idleTasks]) {
      idleTasks.delete(id);
      task({ didTimeout: false, timeRemaining: () => 50 });
    }
  });
}

describe("secondary startup requests", () => {
  it("defers aliases, but immediate compose loads/publishes them before idle without a duplicate", async () => {
    const calls: string[] = [];
    const apiFetch = async (input: RequestInfo | URL) => {
      calls.push(String(input)); return Response.json({ ok: true, aliases: [alias] });
    };
    const { result } = renderHook(() => useRecipientAliases({ activeAccountId: "account-a", apiFetch }));
    expect(calls).toEqual([]);
    let ready: RecipientAlias[] = [];
    await act(async () => { ready = await ensureRecipientAliasesReady(apiFetch, "account-a"); });
    expect(ready).toEqual([alias]);
    expect(result.current.recipientAliases).toEqual([alias]);
    await runIdle();
    expect(calls).toEqual(["/api/accounts/account-a/recipient-aliases"]);
  });

  it("deduplicates an in-flight idle read and preserves local edits and explicit refresh", async () => {
    let resolve!: (response: Response) => void;
    const response = new Promise<Response>((done) => { resolve = done; });
    let calls = 0;
    const apiFetch = async () => { calls++; return calls === 1 ? response : Response.json({ ok: true, aliases: [alias] }); };
    const { result } = renderHook(() => useRecipientAliases({ activeAccountId: "account-a", apiFetch }));
    await runIdle();
    expect(calls).toBe(1);
    const composeReady = ensureRecipientAliasesReady(apiFetch, "account-a");
    act(() => result.current.setRecipientAliases([{ ...alias, name: "Edited team" }]));
    await act(async () => { resolve(Response.json({ ok: true, aliases: [alias] })); await composeReady; });
    expect(calls).toBe(1);
    expect(result.current.recipientAliases[0]?.name).toBe("Edited team");
    await act(async () => { await result.current.refreshRecipientAliases("account-a"); });
    expect(calls).toBe(2);
    expect(result.current.recipientAliases).toEqual([alias]);
  });

  it("cancels idle reads on account change and does not show another account's aliases", async () => {
    const calls: string[] = [];
    const apiFetch = async (input: RequestInfo | URL) => {
      calls.push(String(input)); return Response.json({ ok: true, aliases: [alias] });
    };
    const { result, rerender, unmount } = renderHook(({ accountId }) =>
      useRecipientAliases({ activeAccountId: accountId, apiFetch }), { initialProps: { accountId: "account-a" } });
    rerender({ accountId: "account-b" });
    expect(result.current.recipientAliases).toEqual([]);
    await runIdle();
    expect(calls).toEqual(["/api/accounts/account-b/recipient-aliases"]);
    unmount();
    expect(idleTasks.size).toBe(0);
  });

  it("loads topics eagerly, defers counts to idle, and keeps explicit count refresh immediate", async () => {
    const calls: string[] = [];
    const apiFetch = async (input: RequestInfo | URL) => {
      const url = String(input); calls.push(url);
      return Response.json(url.endsWith("/stats")
        ? { ok: true, stats: [{ topicId: "topic-a", messageCount: 7 }] }
        : { ok: true, topics: [{ id: "topic-a", name: "Synthetic topic" }] });
    };
    const { result } = renderHook(() => useTopics({ activeAccountId: "account-a", apiFetch }));
    await waitFor(() => expect(result.current.allTopics.length).toBe(1));
    expect(calls).toEqual(["/api/accounts/account-a/topics"]);
    await act(async () => { await result.current.refreshTopicStats("account-a"); });
    expect(result.current.topicMessageCountById.get("topic-a")).toBe(7);
    await runIdle();
    expect(calls).toEqual(["/api/accounts/account-a/topics", "/api/accounts/account-a/topics/stats"]);
  });

  it("loads stats at idle and cancels the previous account's scheduled stats", async () => {
    const calls: string[] = [];
    const apiFetch = async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return Response.json({ ok: true, topics: [], stats: [{ topicId: "topic-b", messageCount: 3 }] });
    };
    const { result, rerender } = renderHook(({ accountId }) => useTopics({ activeAccountId: accountId, apiFetch }),
      { initialProps: { accountId: "account-a" } });
    rerender({ accountId: "account-b" });
    await runIdle();
    expect(calls).toEqual(["/api/accounts/account-a/topics", "/api/accounts/account-b/topics", "/api/accounts/account-b/topics/stats"]);
    expect(result.current.topicMessageCountById.get("topic-b")).toBe(3);
    await act(async () => { rerender({ accountId: "account-c" }); });
    expect(result.current.topicMessageCountById.size).toBe(0);
  });
  it("never shows one mailbox's topic names under another", async () => {
    const held = new Map<string, (res: Response) => void>();
    const topicsOf = (id: string) => Response.json({ ok: true, topics: [{ id: `topic-${id}`, name: `Synthetic ${id}` }] });
    const apiFetch = (input: RequestInfo | URL) => new Promise<Response>(resolve => { held.set(String(input), resolve); });
    const { result, rerender } = renderHook(({ accountId }) => useTopics({ activeAccountId: accountId, apiFetch }),
      { initialProps: { accountId: "account-a" } });
    await act(async () => { held.get("/api/accounts/account-a/topics")!(topicsOf("account-a")); });
    await waitFor(() => expect(result.current.allTopics.map(topic => topic.id)).toEqual(["topic-account-a"]));
    rerender({ accountId: "account-b" });
    // Until B's topics arrive the list is empty, not A's.
    expect(result.current.allTopics).toEqual([]);
    rerender({ accountId: "account-a" });
    rerender({ accountId: "account-b" });
    // A late response for A (its request was superseded) never shows under B.
    await act(async () => { held.get("/api/accounts/account-a/topics")!(topicsOf("account-a")); });
    expect(result.current.allTopics).toEqual([]);
    // A local update before B's response belongs to B only.
    act(() => { result.current.setAllTopics(prev => [...prev, { id: "topic-new", name: "Synthetic new" } as never]); });
    expect(result.current.allTopics.map(topic => topic.id)).toEqual(["topic-new"]);
    await act(async () => { held.get("/api/accounts/account-b/topics")!(topicsOf("account-b")); });
    await waitFor(() => expect(result.current.allTopics.map(topic => topic.id)).toEqual(["topic-account-b"]));
    rerender({ accountId: "account-a" });
    expect(result.current.allTopics).toEqual([]);
  });
});
