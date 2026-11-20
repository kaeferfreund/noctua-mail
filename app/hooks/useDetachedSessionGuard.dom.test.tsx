import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { useDetachedSessionGuard } from "./useDetachedSessionGuard";
import { BROWSER_PRINCIPAL_STORAGE_KEY } from "@/lib/browserUserState";

// SD23, SD36: detached reader/composer/calendar windows end their view after sign-out.
type Answer = "user-a" | "user-b" | 401 | "offline";
function harness(initial: Answer = "user-a") {
  let answer: Answer = initial;
  const calls: string[] = [];
  const fetcher = async (input: RequestInfo | URL) => {
    calls.push(String(input));
    if (answer === "offline") throw new TypeError("synthetic offline");
    if (answer === 401) return Response.json({ ok: false }, { status: 401 });
    return Response.json({ user: { id: answer } });
  };
  const view = renderHook(() => useDetachedSessionGuard(fetcher));
  return { view, calls, set: (next: Answer) => { answer = next; } };
}
function changePrincipal(value: string | null) {
  if (value === null) localStorage.removeItem(BROWSER_PRINCIPAL_STORAGE_KEY);
  else localStorage.setItem(BROWSER_PRINCIPAL_STORAGE_KEY, value);
  act(() => { window.dispatchEvent(new StorageEvent("storage", { key: BROWSER_PRINCIPAL_STORAGE_KEY, newValue: value })); });
}

beforeEach(() => { localStorage.clear(); localStorage.setItem(BROWSER_PRINCIPAL_STORAGE_KEY, "user-a"); });
afterEach(() => { cleanup(); localStorage.clear(); });

describe("useDetachedSessionGuard", () => {
  it("keeps the view for the same signed-in person", async () => {
    const { view, calls } = harness();
    await waitFor(() => expect(calls).toEqual(["/api/auth/me"]));
    act(() => { window.dispatchEvent(new Event("focus")); });
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(view.result.current).toBe(false);
  });
  it("ends at once when the person signs out in another window", async () => {
    const { view } = harness();
    changePrincipal(null);
    expect(view.result.current).toBe(true);
  });
  it("ends when another person signs in in this browser", async () => {
    const { view } = harness();
    changePrincipal("user-b");
    expect(view.result.current).toBe(true);
  });
  it("ends when the session is gone on returning to the window", async () => {
    const { view, calls, set } = harness();
    await waitFor(() => expect(calls).toHaveLength(1));
    set(401);
    act(() => { window.dispatchEvent(new Event("focus")); });
    await waitFor(() => expect(view.result.current).toBe(true));
  });
  it("ends when the session belongs to someone else, also without a stored principal", async () => {
    localStorage.clear();
    const { view, calls, set } = harness("user-a");
    await waitFor(() => expect(calls).toHaveLength(1));
    set("user-b");
    act(() => { window.dispatchEvent(new Event("pageshow")); });
    await waitFor(() => expect(view.result.current).toBe(true));
  });
  it("keeps the view while offline", async () => {
    const { view, calls } = harness("offline");
    await waitFor(() => expect(calls).toHaveLength(1));
    act(() => { window.dispatchEvent(new Event("focus")); });
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(view.result.current).toBe(false);
  });
});
