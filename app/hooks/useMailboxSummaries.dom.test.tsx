import { afterEach, expect, test } from "bun:test";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { useMailboxSummaries } from "./useMailboxSummaries";
import type { UserMailboxSummary } from "@/lib/mailboxSummary";
const originalSource = globalThis.EventSource;
class Source extends EventTarget {
  static instances: Source[] = [];
  closed = false;
  constructor(public url: string) { super(); Source.instances.push(this); }
  close() { this.closed = true; }
  send(type: string, data: object) { this.dispatchEvent(new MessageEvent(type, { data: JSON.stringify(data) })); }
}
afterEach(() => { cleanup(); globalThis.EventSource = originalSource; Source.instances = []; });
const mailbox: UserMailboxSummary = { accountId: "synthetic-mailbox", name: "Synthetic", email: "team@example.test",
  accessRole: "viewer", isOwner: false, shared: true, unread: 2, assignedToMe: 3, unassignedOpen: 4, watcher: { state: "disabled" } };

test("user events refresh inactive counts, clear revoked mailboxes and ignore a prior session's late snapshot", async () => {
  globalThis.EventSource = Source as unknown as typeof EventSource;
  const requests: Array<(response: Response) => void> = [];
  const apiFetch = () => new Promise<Response>(resolve => requests.push(resolve));
  let mailboxChanges = 0; const threadChanges: string[] = [];
  function View({ sessionKey }: { sessionKey: string }) {
    const rows = useMailboxSummaries({ sessionKey, apiFetch, onMailboxesChanged: () => { mailboxChanges++; },
      onThreadChanged: id => { threadChanges.push(id); } });
    return <output>{JSON.stringify(rows)}</output>;
  }
  const response = (rows: UserMailboxSummary[]) => Response.json({ ok: true, mailboxes: rows, generatedAt: 1 });
  const view = render(<View sessionKey="synthetic-session-a" />);
  const source = Source.instances[0];
  await act(async () => requests.shift()!(response([mailbox])));
  await waitFor(() => expect(view.container.textContent).toContain('"unread":2'));
  await act(async () => source.send("mailbox-summary", { type: "mailbox-summary", accountId: mailbox.accountId,
    unread: 9, assignedToMe: 8, unassignedOpen: 7 }));
  expect(view.container.textContent).toContain('"unread":9');
  await act(async () => source.send("thread-collab", { type: "thread-collab", accountId: mailbox.accountId, threadId: "thread", revision: 2 }));
  expect(threadChanges).toEqual([mailbox.accountId]);
  await act(async () => source.send("mailboxes-changed", { type: "mailboxes-changed" }));
  expect(mailboxChanges).toBe(1); expect(view.container.textContent).toBe("[]");
  const staleRequests = requests.splice(0);
  view.rerender(<View sessionKey="synthetic-session-b" />);
  expect(source.closed).toBe(true);
  await act(async () => { for (const resolve of staleRequests) resolve(response([mailbox])); });
  expect(view.container.textContent).toBe("[]");
  await act(async () => requests.shift()!(response([{ ...mailbox, unread: 1 }])));
  await waitFor(() => expect(view.container.textContent).toContain('"unread":1'));
  view.unmount(); expect(Source.instances[1].closed).toBe(true);
});
