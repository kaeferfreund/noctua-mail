import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import { createRef } from "react";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import VirtualizedList from "./VirtualizedList";

const originalObserver = globalThis.ResizeObserver;
let resized: () => void;
let observed: Element | null;
let disconnected: boolean;
let height: number;
let hidden: boolean;
let frames: Map<number, FrameRequestCallback>;
let nextFrame = 0;
let raf: ReturnType<typeof spyOn<typeof window, "requestAnimationFrame">>;
let cancelRaf: ReturnType<typeof spyOn<typeof window, "cancelAnimationFrame">>;

beforeEach(() => {
  height = 800; hidden = false; observed = null; disconnected = false; frames = new Map();
  globalThis.ResizeObserver = class {
    constructor(callback: () => void) { resized = callback; }
    observe(element: Element) { observed = element; }
    disconnect() { disconnected = true; }
  } as unknown as typeof ResizeObserver;
  raf = spyOn(window, "requestAnimationFrame").mockImplementation(callback => {
    const id = ++nextFrame; frames.set(id, callback); return id;
  });
  cancelRaf = spyOn(window, "cancelAnimationFrame").mockImplementation(id => { frames.delete(id); });
});
afterEach(() => {
  cleanup(); globalThis.ResizeObserver = originalObserver; raf.mockRestore(); cancelRaf.mockRestore();
});
function flush() {
  act(() => { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(0)); });
}
function mount() {
  const scrollRef = createRef<HTMLDivElement>();
  const items = Array.from({ length: 1000 }, (_, n) => n);
  const view = render(<div ref={element => {
    scrollRef.current = element;
    if (!element) return;
    Object.defineProperty(element, "clientHeight", { get: () => hidden ? 0 : height });
    element.getClientRects = () => (hidden ? [] : [new DOMRect(0, 100, 390, height)]) as unknown as DOMRectList;
    element.getBoundingClientRect = () => new DOMRect(0, hidden ? 0 : 100, hidden ? 0 : 390, hidden ? 0 : height);
  }}><VirtualizedList items={items} scrollRef={scrollRef} overscan={0} getItemHeight={() => 100}
    renderItem={({ item, top }) => <div key={item} data-row={item} style={{ position: "absolute", top }}>{item}</div>} />
  </div>);
  const scroll = scrollRef.current!;
  const list = scroll.firstElementChild as HTMLDivElement;
  // Include the header above the virtual list in the scroll-coordinate calculation.
  list.getBoundingClientRect = () => new DOMRect(0, hidden ? 0 : 180 - scroll.scrollTop, 390, hidden ? 0 : 100000);
  const rows = () => [...view.container.querySelectorAll("[data-row]")].map(row => Number(row.getAttribute("data-row")));
  return { view, scroll, rows };
}

test("hidden scroll/resize events retain the far-down window; reveal measures the new pane without window resize", () => {
  const { scroll, rows } = mount();
  expect(observed).toBe(scroll);
  scroll.scrollTop = 18080;
  fireEvent.scroll(scroll); flush();
  expect(rows()).toEqual([180, 181, 182, 183, 184, 185, 186, 187, 188]);
  hidden = true;
  scroll.scrollTop = 0; // Chromium may expose/reset this while display:none.
  fireEvent.scroll(scroll); fireEvent.resize(window); resized();
  expect(frames.size).toBe(1);
  flush();
  expect(rows()).toEqual([180, 181, 182, 183, 184, 185, 186, 187, 188]);
  hidden = false; height = 1100; scroll.scrollTop = 18080;
  resized(); flush();
  expect(rows()).toEqual(Array.from({ length: 12 }, (_, n) => 180 + n));
  height = 350; resized(); flush();
  expect(rows()).toEqual([180, 181, 182, 183]);
});

test("an initially hidden list measures on reveal and cleans up the observer and pending frame", () => {
  hidden = true;
  const { view, scroll, rows } = mount();
  hidden = false; height = 1100; scroll.scrollTop = 25080;
  resized(); flush();
  expect(rows()).toEqual(Array.from({ length: 12 }, (_, n) => 250 + n));
  resized(); expect(frames.size).toBe(1);
  view.unmount();
  expect(disconnected).toBe(true);
  expect(frames.size).toBe(0);
  fireEvent.resize(window); fireEvent.scroll(scroll);
  expect(frames.size).toBe(0);
});
