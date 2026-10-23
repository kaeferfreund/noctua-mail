/**
 * Semantic scroll positions for the inner list/reader panes. An anchor names
 * the first item crossing the viewport top, the viewport's offset into that
 * item, and the raw scrollTop as a fallback while the item is not rendered.
 */
export type ScrollAnchor = {
  id: string;
  offset: number;
  top: number;
  /** Reader only: collapse state of the thread's messages when captured. */
  collapsed?: Record<string, boolean>;
};

export const SCROLL_ANCHOR_LIMIT = 50;

/** Insertion-ordered LRU; re-setting a key makes it the newest. */
export class ScrollAnchorStore {
  private readonly anchors = new Map<string, ScrollAnchor>();
  constructor(private readonly limit = SCROLL_ANCHOR_LIMIT) {}
  get(key: string) { return this.anchors.get(key); }
  set(key: string, anchor: ScrollAnchor) {
    this.anchors.delete(key);
    this.anchors.set(key, anchor);
    while (this.anchors.size > this.limit) this.anchors.delete(this.anchors.keys().next().value!);
  }
  get size() { return this.anchors.size; }
}

/** display:none (hidden phone pane, reader focus) reports zero geometry. */
export const isMeasurable = (element: HTMLElement | null): element is HTMLElement =>
  Boolean(element?.isConnected && element.clientHeight > 0 && element.getClientRects().length > 0);

export type AnchorItems = Iterable<readonly [string, HTMLElement]>;

export function captureAnchor(scroll: HTMLElement | null, items: AnchorItems): ScrollAnchor | null {
  if (!isMeasurable(scroll)) return null;
  const viewportTop = scroll.getBoundingClientRect().top;
  let best: { id: string; top: number } | null = null;
  for (const [id, element] of items) {
    const rect = element.getBoundingClientRect();
    if (rect.height <= 0 || rect.bottom <= viewportTop + 0.5) continue;
    if (!best || rect.top < best.top) best = { id, top: rect.top };
  }
  return { id: best?.id ?? "", offset: best ? viewportTop - best.top : 0, top: scroll.scrollTop };
}

/** Returns the remaining pixel error, or null when the anchored item is not rendered. */
export function applyAnchor(scroll: HTMLElement, anchor: ScrollAnchor, element: HTMLElement | null | undefined): number | null {
  if (!element?.isConnected || !scroll.contains(element)) return null;
  const delta = element.getBoundingClientRect().top - scroll.getBoundingClientRect().top + anchor.offset;
  if (Math.abs(delta) >= 1) scroll.scrollTop += delta;
  return Math.abs(delta);
}

/** Keys that scroll a focused pane; j/k select messages and are destination changes. */
export const SCROLL_KEYS = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "]);
