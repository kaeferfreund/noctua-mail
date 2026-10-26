import { afterEach, describe, expect, it } from "bun:test";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { AdminFetch } from "@/app/hooks/useAdminApi";
import { SPAM_RESCAN_EVENT } from "@/lib/mail/spam/rescanTypes";
import { useSpamRescanActivity } from "./useSpamRescanActivity";

afterEach(cleanup);
const job = { id: "job", accountId: "acc", mailbox: "Praxis", status: "running", phase: "classifier", processed: 1, total: 4, updatedAt: 1 };

describe("rescan activity reads", () => {
  it("reads on mount, then on an opened panel and on an announced job", async () => {
    const calls: string[] = [];
    let jobs: unknown[] = [];
    const apiFetch: AdminFetch = async (input) => { calls.push(String(input)); return Response.json({ ok: true, jobs }); };
    const view = renderHook(({ open }) => useSpamRescanActivity(apiFetch, true, open), { initialProps: { open: false } });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); });
    expect(calls).toEqual(["/api/admin/spam-rescan"]);

    view.rerender({ open: true });
    await waitFor(() => expect(calls).toHaveLength(2));
    view.rerender({ open: false });

    jobs = [job];
    await act(async () => { window.dispatchEvent(new CustomEvent(SPAM_RESCAN_EVENT)); });
    await waitFor(() => expect(view.result.current.jobs).toEqual([job] as never));
    expect(calls).toHaveLength(4);
  });

  it("non-admins never read, also on an announced job", async () => {
    const calls: string[] = [];
    const apiFetch: AdminFetch = async (input) => { calls.push(String(input)); return Response.json({ ok: true, jobs: [] }); };
    renderHook(() => useSpamRescanActivity(apiFetch, false, true));
    await act(async () => { window.dispatchEvent(new CustomEvent(SPAM_RESCAN_EVENT)); await new Promise((resolve) => setTimeout(resolve, 10)); });
    expect(calls).toEqual([]);
  });
});


it("restores a running job on mount with the panel closed", async () => {
  const apiFetch: AdminFetch = async () => Response.json({ ok: true, jobs: [job] });
  const view = renderHook(() => useSpamRescanActivity(apiFetch, true, false));
  await waitFor(() => expect(view.result.current.jobs).toEqual([job] as never));
});

it("discovers another admin's job while the panel remains open", async () => {
  let reads = 0;
  const apiFetch: AdminFetch = async () => Response.json({ ok: true, jobs: ++reads > 1 ? [job] : [] });
  const view = renderHook(() => useSpamRescanActivity(apiFetch, true, true));
  await waitFor(() => expect(reads).toBe(1));
  await waitFor(() => expect(view.result.current.jobs).toEqual([job] as never), { timeout: 3000 });
});


function capturePolls() {
  const polls = new Map<number, TimerHandler>();
  let nextId = 1_000_000;
  const realSet = window.setTimeout, realClear = window.clearTimeout;
  window.setTimeout = ((handler: TimerHandler, timeout?: number) => {
    if (timeout !== 2000) return Reflect.apply(realSet, window, [handler, timeout]);
    const id = nextId++;
    polls.set(id, handler);
    return id;
  }) as typeof window.setTimeout;
  window.clearTimeout = (id) => { polls.delete(Number(id)); Reflect.apply(realClear, window, [id]); };
  return {
    polls,
    async tick() {
      const pending = [...polls.values()];
      polls.clear();
      await act(async () => { for (const handler of pending) if (typeof handler === "function") handler(); });
    },
    restore() { window.setTimeout = realSet; window.clearTimeout = realClear; }
  };
}

it.each([false, true])("stops after three consecutive polling failures (panel open: %s), then recovers on an event", async panelOpen => {
  const timers = capturePolls();
  let reads = 0, fail = false;
  const apiFetch: AdminFetch = async () => {
    reads++;
    if (fail) throw new Error("synthetic fetch failure");
    return Response.json({ ok: true, jobs: [job] });
  };
  const view = renderHook(() => useSpamRescanActivity(apiFetch, true, panelOpen));
  try {
    await waitFor(() => expect(view.result.current.jobs).toEqual([job] as never));
    fail = true;
    for (let index = 0; index < 3; index++) {
      expect(timers.polls.size).toBe(1);
      await timers.tick();
    }
    expect(reads).toBe(4);
    expect(timers.polls.size).toBe(0);
    await timers.tick();
    expect(reads).toBe(4);
    fail = false;
    await act(async () => { window.dispatchEvent(new CustomEvent(SPAM_RESCAN_EVENT)); });
    expect(reads).toBe(5);
    expect(timers.polls.size).toBe(1);
  } finally { view.unmount(); timers.restore(); }
});

it("disabling activity clears its timer and ignores an in-flight response", async () => {
  const timers = capturePolls();
  let reads = 0;
  let release!: (response: Response) => void;
  const apiFetch: AdminFetch = async () => {
    if (++reads === 1) return Response.json({ ok: true, jobs: [job] });
    return new Promise<Response>(resolve => { release = resolve; });
  };
  const view = renderHook(({ enabled }) => useSpamRescanActivity(apiFetch, enabled, false), { initialProps: { enabled: true } });
  try {
    await waitFor(() => expect(view.result.current.jobs).toEqual([job] as never));
    await timers.tick();
    view.rerender({ enabled: false });
    await act(async () => { release(Response.json({ ok: true, jobs: [job] })); });
    expect(view.result.current.jobs).toEqual([]);
    expect(timers.polls.size).toBe(0);
    await act(async () => { window.dispatchEvent(new CustomEvent(SPAM_RESCAN_EVENT)); });
    expect(reads).toBe(2);
  } finally { view.unmount(); timers.restore(); }
});
