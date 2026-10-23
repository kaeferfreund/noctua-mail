"use client";
import { useEffect, useRef, type RefObject } from "react";

const focusReaderBack = () =>
  document.querySelector<HTMLButtonElement>('[data-reader-toolbar] button')?.focus({ preventScroll: true });

/**
 * Covers explicit entry, saved-preference entry, and an exhausted reading sequence.
 * `readerId` is the message the reader shows: exit focuses its row (or the list
 * while that row is not rendered). The last shown message stays the target when
 * the reader closes in the same commit that leaves focus.
 */
export function useReaderFocusPlacement(focused: boolean, readerId: string,
  listRef: RefObject<HTMLDivElement | null>, scrollRef: RefObject<number | null>) {
  const wasFocused = useRef(false);
  const selectedId = useRef(readerId);
  useEffect(() => { if (readerId) selectedId.current = readerId; }, [readerId]);
  useEffect(() => {
    if (focused === wasFocused.current) return;
    wasFocused.current = focused;
    const frame = window.requestAnimationFrame(() => {
      if (focused) {
        focusReaderBack();
      } else {
        const list = listRef.current;
        if (list && scrollRef.current !== null) list.scrollTop = scrollRef.current;
        scrollRef.current = null;
        const row = list?.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(selectedId.current)}"]`);
        (row ?? list)?.focus({ preventScroll: true });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focused, listRef, scrollRef]);
  // A control that disappears or becomes disabled while focused (busy Delete,
  // a dismissed Undo notice) drops focus to the body; keep it in the reader.
  useEffect(() => {
    if (!focused) return;
    let frame = 0;
    const onFocusOut = (event: FocusEvent) => {
      const control = event.target;
      if (!(control instanceof HTMLElement)) return;
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const lost = document.activeElement === null || document.activeElement === document.body;
        if (lost && (!control.isConnected || control.matches(":disabled"))) focusReaderBack();
      });
    };
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusout", onFocusOut);
      window.cancelAnimationFrame(frame);
    };
  }, [focused]);
}
