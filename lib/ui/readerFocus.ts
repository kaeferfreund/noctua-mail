import type { Message } from "@/lib/data";
import type { ListItem } from "@/app/components/mailclient/messagelist/listModel";

export type ReaderLayout = "split" | "focus";
export const READER_LAYOUT_KEY = "noctua:readerLayout";
export const READER_HINT_KEY = "noctua:readerFocusHintSeen";
export const subscribeReaderStorage = () => () => {};
export function readReaderStorage(key: string) {
  try { return window.localStorage.getItem(key); } catch { return null; }
}
export function writeReaderStorage(key: string, value: string) {
  try { window.localStorage.setItem(key, value); } catch { /* Device storage can be disabled. */ }
}
export function readReaderLayout(): ReaderLayout {
  return readReaderStorage(READER_LAYOUT_KEY) === "focus" ? "focus" : "split";
}

/** The renderer's actual rows, including nested/thread/group collapse state. */
export function readerNavigationRows(items: ListItem[]): Message[] {
  const rows = items.flatMap(item => item.type === "row" ? [item.message]
    : item.type === "suggestion-section" && !item.isCollapsed ? item.rows.map(row => row.message) : []);
  const seen = new Set<string>();
  return rows.filter(row => { if (seen.has(row.id)) return false; seen.add(row.id); return true; });
}
export function readerPosition(rows: Message[], id: string, hasMore: boolean) {
  const index = rows.findIndex(row => row.id === id);
  return { index, position: index + 1, total: rows.length,
    canPrevious: index > 0, canNext: index >= 0 && (index < rows.length - 1 || hasMore) };
}
export function readerNavigation(rows: Message[], id: string, direction: -1 | 1, hasMore: boolean): Message | "load" | null {
  const { index } = readerPosition(rows, id, hasMore);
  if (index < 0) return null;
  return rows[index + direction] ?? (direction === 1 && hasMore ? "load" : null);
}
export function readerShortcut(event: KeyboardEvent): "back" | "toggle" | "next" | "previous" | null {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return null;
  const target = event.target;
  if (target instanceof HTMLElement && target.isContentEditable) return null;
  if (target instanceof Element && target.closest('input, textarea, select, [contenteditable="true"], [role="menu"], [role="listbox"], [role="dialog"], [role="alertdialog"]')) return null;
  // Escape closes overlays first; Radix portals need not contain the event target.
  if (document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]')) return null;
  if (event.key === "Escape") return "back";
  if (event.key === "Enter" && event.shiftKey) return "toggle";
  if (!event.shiftKey && event.key.toLowerCase() === "j") return "next";
  if (!event.shiftKey && event.key.toLowerCase() === "k") return "previous";
  return null;
}
export function isReaderRowActivation(event: { target: EventTarget | null; currentTarget: EventTarget | null; shiftKey: boolean; metaKey: boolean; ctrlKey: boolean; altKey: boolean }) {
  if (event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return false;
  return !(event.target instanceof Element && event.target !== event.currentTarget &&
    event.target.closest('button, a, input, select, textarea, [role="checkbox"], [data-no-row-select="true"], [contenteditable="true"]'));
}
