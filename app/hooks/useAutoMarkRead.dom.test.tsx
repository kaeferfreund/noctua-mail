import { afterEach, describe, expect, it, jest } from "bun:test";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { Message } from "@/lib/data";
import { ACCOUNT_PREFS_CHANGED } from "@/lib/ui/senderSettings";
import { useAutoMarkRead, useAutoMarkReadDelay } from "./useAutoMarkRead";

const message = (id: string, seen = false) => ({
  id, accountId: "synthetic-account", folderId: "synthetic-account:INBOX", seen,
  subject: `Synthetic ${id}`, from: "sender@example.test", to: "reader@example.test",
  date: "", dateValue: 0, preview: "", flags: seen ? ["\\Seen"] : []
}) as unknown as Message;

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  act(() => { document.dispatchEvent(new Event("visibilitychange")); });
}

function renderAutoRead(initial: { messages: Message[]; delayMs: number | null }) {
  const marked: string[] = [];
  const view = renderHook((props: { messages: Message[]; delayMs: number | null }) =>
    useAutoMarkRead({ ...props, onMarkRead: target => { marked.push(target.id); } }), { initialProps: initial });
  const advance = (ms: number) => act(() => { jest.advanceTimersByTime(ms); });
  return { marked, advance, rerender: view.rerender, unmount: view.unmount };
}

afterEach(() => {
  cleanup();
  jest.useRealTimers();
  setVisibility("visible");
});

describe("useAutoMarkRead", () => {
  it("marks an opened unread message read only after the dwell", () => {
    jest.useFakeTimers();
    const { marked, advance } = renderAutoRead({ messages: [message("a")], delayMs: 1000 });
    advance(999);
    expect(marked).toEqual([]);
    advance(1);
    expect(marked).toEqual(["a"]);
    advance(5000);
    expect(marked).toEqual(["a"]);
  });

  it("marks immediately with a zero dwell and never with null", () => {
    jest.useFakeTimers();
    const immediate = renderAutoRead({ messages: [message("a")], delayMs: 0 });
    immediate.advance(0);
    expect(immediate.marked).toEqual(["a"]);
    const never = renderAutoRead({ messages: [message("b")], delayMs: null });
    never.advance(60_000);
    expect(never.marked).toEqual([]);
  });

  it("cancels the dwell when the selection changes before it elapses", () => {
    jest.useFakeTimers();
    const { marked, advance, rerender } = renderAutoRead({ messages: [message("a")], delayMs: 1000 });
    advance(600);
    rerender({ messages: [message("b")], delayMs: 1000 });
    advance(600);
    expect(marked).toEqual([]);
    advance(400);
    expect(marked).toEqual(["b"]);
  });

  it("skips messages that are already read", () => {
    jest.useFakeTimers();
    const { marked, advance } = renderAutoRead({ messages: [message("a", true), message("b")], delayMs: 1000 });
    advance(1000);
    expect(marked).toEqual(["b"]);
  });

  it("does not re-mark a message the user marked unread while it is open, until it is opened again", () => {
    jest.useFakeTimers();
    const { marked, advance, rerender } = renderAutoRead({ messages: [message("a")], delayMs: 1000 });
    advance(1000);
    expect(marked).toEqual(["a"]);
    rerender({ messages: [message("a", true)], delayMs: 1000 });
    rerender({ messages: [message("a", false)], delayMs: 1000 });
    advance(10_000);
    expect(marked).toEqual(["a"]);
    rerender({ messages: [], delayMs: 1000 });
    rerender({ messages: [message("a", false)], delayMs: 1000 });
    advance(1000);
    expect(marked).toEqual(["a", "a"]);
  });

  it("leaves a read message unread when it is marked unread while open", () => {
    jest.useFakeTimers();
    const { marked, advance, rerender } = renderAutoRead({ messages: [message("a", true)], delayMs: 0 });
    rerender({ messages: [message("a", false)], delayMs: 0 });
    advance(5000);
    expect(marked).toEqual([]);
  });

  it("pauses while the page is hidden and restarts the full dwell when it is visible again", () => {
    jest.useFakeTimers();
    const { marked, advance } = renderAutoRead({ messages: [message("a")], delayMs: 1000 });
    advance(800);
    setVisibility("hidden");
    advance(5000);
    expect(marked).toEqual([]);
    setVisibility("visible");
    advance(800);
    expect(marked).toEqual([]);
    advance(200);
    expect(marked).toEqual(["a"]);
  });

  it("drops pending timers on unmount", () => {
    jest.useFakeTimers();
    const { marked, advance, unmount } = renderAutoRead({ messages: [message("a")], delayMs: 1000 });
    unmount();
    advance(5000);
    expect(marked).toEqual([]);
  });
});

describe("useAutoMarkReadDelay", () => {
  const prefsFetch = (prefs: unknown) => async () => Response.json({ ok: true, prefs });

  it("stays on never until the personal preferences are loaded", async () => {
    let release: (response: Response) => void = () => {};
    const pending = new Promise<Response>(resolve => { release = resolve; });
    const { result } = renderHook(() => useAutoMarkReadDelay("synthetic-account", undefined, () => pending));
    expect(result.current).toBeNull();
    await act(async () => { release(Response.json({ ok: true, prefs: {} })); });
    await waitFor(() => expect(result.current).toBe(1000));
  });

  it("resolves default < mailbox setting < personal preference", async () => {
    const mailbox = renderHook(() => useAutoMarkReadDelay("synthetic-account", { reading: { autoMarkRead: "after3s" } }, prefsFetch({})));
    await waitFor(() => expect(mailbox.result.current).toBe(3000));
    const personal = renderHook(() => useAutoMarkReadDelay("synthetic-account", { reading: { autoMarkRead: "after3s" } }, prefsFetch({ reading: { autoMarkRead: "never" } })));
    await waitFor(() => expect(personal.result.current).toBeNull());
    const immediate = renderHook(() => useAutoMarkReadDelay("synthetic-account", undefined, prefsFetch({ reading: { autoMarkRead: "immediate" } })));
    await waitFor(() => expect(immediate.result.current).toBe(0));
  });

  it("follows saved preferences of the same mailbox without a reload", async () => {
    const { result } = renderHook(() => useAutoMarkReadDelay("synthetic-account", undefined, prefsFetch({})));
    await waitFor(() => expect(result.current).toBe(1000));
    act(() => {
      window.dispatchEvent(new CustomEvent(ACCOUNT_PREFS_CHANGED, { detail: { accountId: "other-account", prefs: { reading: { autoMarkRead: "never" } } } }));
    });
    expect(result.current).toBe(1000);
    act(() => {
      window.dispatchEvent(new CustomEvent(ACCOUNT_PREFS_CHANGED, { detail: { accountId: "synthetic-account", prefs: { reading: { autoMarkRead: "after3s" } } } }));
    });
    expect(result.current).toBe(3000);
  });

  it("stays on never when the preferences cannot be loaded", async () => {
    let calls = 0;
    const { result } = renderHook(() => useAutoMarkReadDelay("synthetic-account", undefined, async () => { calls++; return new Response("", { status: 500 }); }));
    await waitFor(() => expect(calls).toBe(1));
    await act(async () => {});
    expect(result.current).toBeNull();
  });
});
