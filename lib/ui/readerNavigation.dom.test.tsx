import { afterEach, expect, test } from "bun:test";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { useState } from "react";
import type { Message } from "@/lib/data";
import type { ListItem } from "@/app/components/mailclient/messagelist/listModel";
import { readerNavigationRows, readerNavigation, readerNavigationActiveId, readerPosition } from "./readerFocus";
import { useReaderNavigation } from "./useReaderNavigation";
const message = (id: string) => ({ id, subject: `Synthetic ${id}` }) as Message;
afterEach(cleanup);
test("navigation follows rendered group/thread order, omits collapsed sections and deduplicates rows", () => {
  const row = (id: string) => ({ type: "row", message: message(id) });
  const items = [ { type: "group" }, row("b"), row("a"), row("b"),
    { type: "suggestion-section", isCollapsed: true, rows: [row("hidden")] },
    { type: "suggestion-section", isCollapsed: false, rows: [row("c")] } ] as ListItem[];
  const rows = readerNavigationRows(items);
  expect(rows.map(m => m.id)).toEqual(["b", "a", "c"]);
  expect(readerNavigation(rows, "b", 1, false)).toEqual(message("a"));
  expect(readerNavigation(rows, "b", -1, false)).toBeNull();
  expect(readerNavigation(rows, "c", 1, true)).toBe("load");
  expect(readerNavigation(rows, "c", 1, false)).toBeNull();
  expect(readerPosition(rows, "a", false)).toMatchObject({ position: 2, total: 3 });
  expect(readerPosition(rows, "missing", true)).toMatchObject({ position: 0, canNext: false, canPrevious: false });
});
function Harness({ hasMore = true, listKey = "inbox", error = null, enabled = true }: { hasMore?: boolean; listKey?: string; error?: string | null; enabled?: boolean }) {
  const [rows, setRows] = useState([message("a"), message("b")]);
  const [id, setId] = useState("b"); const [revision, setRevision] = useState(1); const [loads, setLoads] = useState(0);
  const [loading, setLoading] = useState(false);
  const nav = useReaderNavigation({ enabled, rows, activeId: id, listKey, hasMore, loading, revision, error,
    select: m => setId(m.id), loadNextPage: () => { setLoads(n => n + 1); setLoading(true); } });
  return <><output>{id}:{nav.position}/{nav.total}:{loads}:{String(nav.pending)}</output>
    <button disabled={!nav.canNext || nav.pending} onClick={() => nav.navigate(1)}>Next</button><button onClick={() => nav.navigate(-1)}>Previous</button>
    <button onClick={() => { setRows(prev => [...prev, message("c")]); setRevision(n => n + 1); setLoading(false); }}>Complete page</button>
    <button onClick={() => { setRevision(n => n + 1); setLoading(false); }}>Collapsed page</button></>;
}
test("next loads exactly one page, waits for its rows, continues and walks backwards", async () => {
  const view = render(<Harness />);
  fireEvent.click(view.getByText("Next")); fireEvent.click(view.getByText("Next"));
  expect(view.getByRole("status").textContent).toBe("b:2/2:1:true");
  await act(async () => { fireEvent.click(view.getByText("Complete page")); });
  await waitFor(() => expect(view.getByRole("status").textContent).toBe("c:3/3:1:false"));
  fireEvent.click(view.getByText("Previous")); expect(view.getByRole("status").textContent).toBe("b:2/3:1:false");
});
test("a page hidden by collapsed groups loads the following page, then stops at the real end", async () => {
  const view = render(<Harness />); fireEvent.click(view.getByText("Next"));
  await act(async () => { fireEvent.click(view.getByText("Collapsed page")); });
  await waitFor(() => expect(view.getByRole("status").textContent).toBe("b:2/2:2:true"));
  view.rerender(<Harness hasMore={false} />);
  await act(async () => { fireEvent.click(view.getByText("Complete page")); });
  await waitFor(() => expect(view.getByRole("status").textContent).toBe("c:3/3:2:false"));
  fireEvent.click(view.getByText("Next")); expect(view.getByRole("status").textContent).toBe("c:3/3:2:false");
});
for (const reason of ["folder", "error", "leave"] as const) test(`pending navigation cancels on ${reason}`, async () => {
  const view = render(<Harness />); fireEvent.click(view.getByText("Next"));
  view.rerender(<Harness listKey={reason === "folder" ? "archive" : "inbox"} error={reason === "error" ? "Synthetic failure" : null} enabled={reason !== "leave"} />);
  await waitFor(() => expect(view.getByRole("status").textContent).toBe("b:2/2:1:false"));
  fireEvent.click(view.getByText("Complete page"));
  await waitFor(() => expect(view.getByRole("status").textContent).toBe("b:2/3:1:false"));
});

test("a failed page blocks the unloaded boundary while loaded rows remain navigable", () => {
  const view = render(<Harness error="Synthetic page failure" />);
  expect((view.getByText("Next") as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(view.getByText("Previous"));
  expect(view.getByRole("status").textContent).toBe("a:1/2:0:false");
  expect((view.getByText("Next") as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(view.getByText("Next"));
  expect(view.getByRole("status").textContent).toBe("b:2/2:0:false");
});

test("a synthetic reply opened from a collapsed row uses that conversation's visible position", () => {
  const root = { ...message("root"), accountId: "synthetic", threadId: "conversation" };
  const reply = { ...root, id: "synthetic-reply" };
  const rows = [message("before"), root, message("after")];
  const id = readerNavigationActiveId(rows, reply);
  expect(readerPosition(rows, id, false)).toMatchObject({ position: 2, total: 3 });
  expect(readerNavigation(rows, id, 1, false)).toEqual(message("after"));
  expect(readerNavigationActiveId([...rows, reply], reply)).toBe(reply.id);
  expect(readerNavigationActiveId(rows, { ...reply, accountId: "other" })).toBe(reply.id);
});
