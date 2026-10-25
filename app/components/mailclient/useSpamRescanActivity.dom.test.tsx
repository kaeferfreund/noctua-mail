import { afterEach, describe, expect, it } from "bun:test";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { AdminFetch } from "@/app/hooks/useAdminApi";
import { SPAM_RESCAN_EVENT } from "@/lib/mail/spam/rescanTypes";
import { useSpamRescanActivity } from "./useSpamRescanActivity";

afterEach(cleanup);
const job = { id: "job", accountId: "acc", mailbox: "Praxis", status: "running", phase: "classifier", processed: 1, total: 4, updatedAt: 1 };

describe("rescan activity reads", () => {
  it("reads nothing at start-up, then on an opened panel and on an announced job", async () => {
    const calls: string[] = [];
    let jobs: unknown[] = [];
    const apiFetch: AdminFetch = async (input) => { calls.push(String(input)); return Response.json({ ok: true, jobs }); };
    const view = renderHook(({ open }) => useSpamRescanActivity(apiFetch, true, open), { initialProps: { open: false } });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); });
    expect(calls).toEqual([]);

    view.rerender({ open: true });
    await waitFor(() => expect(calls).toEqual(["/api/admin/spam-rescan"]));
    view.rerender({ open: false });

    jobs = [job];
    await act(async () => { window.dispatchEvent(new CustomEvent(SPAM_RESCAN_EVENT)); });
    await waitFor(() => expect(view.result.current.jobs).toEqual([job] as never));
    expect(calls).toHaveLength(2);
  });

  it("non-admins never read, also on an announced job", async () => {
    const calls: string[] = [];
    const apiFetch: AdminFetch = async (input) => { calls.push(String(input)); return Response.json({ ok: true, jobs: [] }); };
    renderHook(() => useSpamRescanActivity(apiFetch, false, true));
    await act(async () => { window.dispatchEvent(new CustomEvent(SPAM_RESCAN_EVENT)); await new Promise((resolve) => setTimeout(resolve, 10)); });
    expect(calls).toEqual([]);
  });
});
