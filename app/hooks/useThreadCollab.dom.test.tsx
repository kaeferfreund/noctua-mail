import { afterEach, expect, it } from "bun:test";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { useThreadCollab } from "./useThreadCollab";
import type { ThreadCollabState } from "@/app/components/collab/types";

const state: ThreadCollabState = {
  accountId: "a", threadId: "one", status: "open", assigneeUserId: null,
  assignedByUserId: null, assignedAt: null, statusChangedAt: null,
  statusChangedByUserId: null, commentCount: 0, lastActivityAt: 1,
  updatedAt: 1, updatedByUserId: null,
};
const members = [{ userId: "alex", name: "Alex Example", email: "alex@example.test", role: "editor", isOwner: false }];
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { "Content-Type": "application/json" },
});
afterEach(cleanup);

for (const sameThread of [false, true]) {
  it(`ignores an obsolete denied GET after a newer successful ${sameThread ? "reload" : "thread read"}`, async () => {
    let oldDenied!: (response: Response) => void;
    let reads = 0;
    const denials: string[] = [];
    const apiFetch = (async (url: RequestInfo | URL) => {
      if (String(url).endsWith("/me")) return json({ user: { id: "alex" } });
      if (String(url).endsWith("/members")) return json({ members });
      if (reads++ === 0) return new Promise<Response>(resolve => { oldDenied = resolve; });
      return json({ ok: true, state: { ...state, threadId: sameThread ? "one" : "two" }, members, comments: [], activity: [] });
    }) as typeof fetch;
    const hook = renderHook(({ thread }) => useThreadCollab("a", thread, { apiFetch, onReadDenied: account => denials.push(account) }), { initialProps: { thread: "one" } });
    await waitFor(() => expect(oldDenied).toBeDefined());
    if (sameThread) await act(async () => { await hook.result.current.reload(); });
    else hook.rerender({ thread: "two" });
    await waitFor(() => expect(hook.result.current.state?.threadId).toBe(sameThread ? "one" : "two"));
    await act(async () => { oldDenied(json({ message: "Mailbox access was revoked" }, 403)); });
    expect(hook.result.current.readDenied).toBe(false);
    expect(hook.result.current.state?.threadId).toBe(sameThread ? "one" : "two");
    expect(hook.result.current.members).toEqual(members);
    expect(denials).toEqual([]);
  });
}
