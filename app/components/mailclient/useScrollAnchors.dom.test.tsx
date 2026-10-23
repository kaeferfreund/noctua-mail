import { afterEach, beforeEach, expect, it } from "bun:test";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { useLayoutEffect, useRef } from "react";
import { useScrollAnchors } from "./useScrollAnchors";
import type { DeepLinkTransaction } from "./useDeepLinks";

const ROW = 40;
const CARD = 300;
let listVisible = true;
let readerVisible = true;
let collapsed: Record<string, boolean> = {};
let restoredCollapse: Array<Record<string, boolean>> = [];
const messageRefs = new Map<string, HTMLElement>();
const exposed: { anchors?: ReturnType<typeof useScrollAnchors> } = {};

beforeEach(() => { listVisible = true; readerVisible = true; collapsed = {}; restoredCollapse = []; messageRefs.clear(); });
afterEach(() => { cleanup(); window.history.replaceState(null, "", "/"); });

function viewport(element: HTMLElement | null, visible: () => boolean) {
  if (!element) return;
  Object.defineProperty(element, "clientHeight", { configurable: true, get: () => visible() ? 400 : 0 });
  element.getClientRects = () => (visible() ? [new DOMRect(0, 100, 300, 400)] : []) as unknown as DOMRectList;
  element.getBoundingClientRect = () => visible() ? new DOMRect(0, 100, 300, 400) : new DOMRect(0, 0, 0, 0);
}
function item(element: HTMLElement | null, index: number, size: number, visible: () => boolean) {
  if (!element) return;
  element.getBoundingClientRect = () => visible() ? new DOMRect(0, 100 + index * size - (element.parentElement?.scrollTop ?? 0), 300, size) : new DOMRect(0, 0, 0, 0);
}

function Harness({ listKey, readerId = "", listShown = true, rows = 100 }: { listKey: string; readerId?: string; listShown?: boolean; rows?: number }) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const readerRef = useRef<HTMLDivElement | null>(null);
  const anchors = useScrollAnchors({
    accountId: "a", listKey, listRef, listShown, readerMessageId: readerId,
    readerScroll: () => readerRef.current, readerItems: () => messageRefs,
    getCollapsed: () => collapsed, restoreCollapsed: value => { restoredCollapse.push(value); }
  });
  useLayoutEffect(() => { exposed.anchors = anchors; });
  return <>
    <div data-testid="list" ref={element => { listRef.current = element; viewport(element, () => listVisible); }}>
      {Array.from({ length: rows }, (_, index) => <div key={`${listKey}-${index}`} data-message-id={`${listKey}-${index}`}
        ref={element => item(element, index, ROW, () => listVisible)} />)}
    </div>
    <div data-testid="reader" ref={element => { readerRef.current = element; viewport(element, () => readerVisible); }}>
      {readerId ? ["m1", "m2", "m3"].map((id, index) => <article key={id}
        ref={element => { if (element) messageRefs.set(id, element); item(element, index, CARD, () => readerVisible); }} />) : null}
    </div>
  </>;
}

const frames = () => act(() => new Promise<void>(resolve => setTimeout(resolve, 120)));
const list = (page: ReturnType<typeof render>) => page.getByTestId("list");
const reader = (page: ReturnType<typeof render>) => page.getByTestId("reader");
async function userScroll(element: HTMLElement, top: number) {
  fireEvent.wheel(element);
  element.scrollTop = top;
  fireEvent.scroll(element);
  await frames();
}
const entry = (id: string) => window.history.replaceState({ noctuaUrl: true, noctuaEntry: id }, "", "/");
const push = (id: string) => window.history.pushState({ noctuaUrl: true, noctuaEntry: id }, "", "/");
const transaction = (event: DeepLinkTransaction) => act(() => exposed.anchors!.onTransaction(event));

it("restores the entry's list anchor on Back and the place's anchor on a revisit", async () => {
  entry("e1");
  const page = render(<Harness listKey="inbox" />);
  await userScroll(list(page), 30 * ROW + 10);
  push("e2"); page.rerender(<Harness listKey="sent" />); await frames();
  expect(list(page).scrollTop).toBe(0);
  await userScroll(list(page), 400);
  // A later visit of the inbox in another entry scrolls elsewhere.
  push("e3"); page.rerender(<Harness listKey="inbox" />); await frames();
  expect(list(page).scrollTop).toBe(30 * ROW + 10);
  await userScroll(list(page), 50 * ROW);
  // Back to e1: its own position wins over the newer inbox position.
  transaction({ phase: "start", origin: "history", messageId: "" });
  entry("e1"); page.rerender(<Harness listKey="sent" />); page.rerender(<Harness listKey="inbox" />);
  transaction({ phase: "settled", origin: "history", messageId: "" });
  await waitFor(() => expect(list(page).scrollTop).toBe(30 * ROW + 10));
  // Revisit outside history: the sent list returns to its last position.
  push("e4"); page.rerender(<Harness listKey="sent" />);
  await waitFor(() => expect(list(page).scrollTop).toBe(400));
});

it("anchors to the row, not the pixel offset, when rows above change", async () => {
  entry("e1");
  const page = render(<Harness listKey="inbox" />);
  await userScroll(list(page), 20 * ROW + 5);
  push("e2"); page.rerender(<Harness listKey="sent" />); await frames();
  push("e3"); page.rerender(<Harness listKey="inbox" />);
  // The inbox now renders its rows one position lower (a new message arrived).
  const shifted = list(page).querySelector<HTMLElement>('[data-message-id="inbox-20"]')!;
  item(shifted, 21, ROW, () => listVisible);
  await waitFor(() => expect(list(page).scrollTop).toBe(21 * ROW + 5));
});

it("restores the reader anchor and collapse state on Back/Forward; the selection scroll yields", async () => {
  entry("e5");
  collapsed = { m1: true, m2: false, m3: false };
  const page = render(<Harness listKey="inbox" readerId="m1" />);
  await frames();
  expect(exposed.anchors!.readerPlacement()).toBe("default");
  await userScroll(reader(page), 2 * CARD + 50);
  // Back to the list entry, then Forward to the reader entry.
  transaction({ phase: "start", origin: "history", messageId: "" });
  entry("e4"); page.rerender(<Harness listKey="inbox" />);
  transaction({ phase: "settled", origin: "history", messageId: "" });
  reader(page).scrollTop = 0;
  collapsed = { m1: false, m2: true, m3: true };
  transaction({ phase: "start", origin: "history", messageId: "m1" });
  expect(exposed.anchors!.readerPlacement()).toBe("instant");
  entry("e5"); page.rerender(<Harness listKey="inbox" readerId="m1" />);
  transaction({ phase: "settled", origin: "history", messageId: "m1" });
  expect(exposed.anchors!.readerPlacement()).toBe("skip");
  await waitFor(() => expect(reader(page).scrollTop).toBe(2 * CARD + 50));
  expect(restoredCollapse).toEqual([{ m1: true, m2: false, m3: false }]);
});

it("history without a saved reader position places instantly; an explicit link target keeps its own placement", async () => {
  entry("e1");
  const page = render(<Harness listKey="inbox" readerId="m1" />);
  await userScroll(reader(page), CARD + 20);
  page.rerender(<Harness listKey="inbox" />);
  reader(page).scrollTop = 0;
  // A notification / copied link to the same message: no saved anchor wins.
  transaction({ phase: "start", origin: "link", messageId: "m1" });
  push("e2"); page.rerender(<Harness listKey="inbox" readerId="m1" />);
  transaction({ phase: "settled", origin: "link", messageId: "m1" });
  await frames();
  expect(reader(page).scrollTop).toBe(0);
  expect(exposed.anchors!.readerPlacement()).toBe("default");
  page.rerender(<Harness listKey="inbox" />);
  transaction({ phase: "start", origin: "history", messageId: "m2" });
  entry("e9"); page.rerender(<Harness listKey="inbox" readerId="m2" />);
  transaction({ phase: "settled", origin: "history", messageId: "m2" });
  expect(exposed.anchors!.readerPlacement()).toBe("instant");
});

it("user input cancels a pending restore and its later snap-back", async () => {
  entry("e1");
  const page = render(<Harness listKey="inbox" />);
  await userScroll(list(page), 40 * ROW);
  push("e2"); page.rerender(<Harness listKey="sent" />); await frames();
  // The revisit restore waits for geometry while the pane is still hidden.
  listVisible = false;
  push("e3"); page.rerender(<Harness listKey="inbox" />); await frames();
  fireEvent.touchStart(list(page));
  listVisible = true;
  list(page).scrollTop = 120; fireEvent.scroll(list(page));
  await frames(); await frames();
  expect(list(page).scrollTop).toBe(120);
  // Capture is armed again after the cancel: the user's position is the new anchor.
  push("e4"); page.rerender(<Harness listKey="sent" />); await frames();
  push("e5"); page.rerender(<Harness listKey="inbox" />);
  await waitFor(() => expect(list(page).scrollTop).toBe(120));
});

it("never stores a hidden phone pane's measurement and restores after the reveal", async () => {
  entry("e1");
  const page = render(<Harness listKey="inbox" />);
  await userScroll(list(page), 30 * ROW);
  // Phone opens the reader: the list is display:none and Chromium resets scrollTop.
  listVisible = false; page.rerender(<Harness listKey="inbox" readerId="m1" listShown={false} />);
  list(page).scrollTop = 0; fireEvent.scroll(list(page)); await frames();
  listVisible = true; page.rerender(<Harness listKey="inbox" listShown />);
  await waitFor(() => expect(list(page).scrollTop).toBe(30 * ROW));
});
