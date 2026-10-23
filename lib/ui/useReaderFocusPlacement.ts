"use client";
import { useEffect, useRef, type RefObject } from "react";

/** Covers explicit entry, saved-preference entry, and an exhausted reading sequence. */
export function useReaderFocusPlacement(focused: boolean, activeId: string,
  listRef: RefObject<HTMLDivElement | null>, scrollRef: RefObject<number | null>) {
  const wasFocused = useRef(false);
  const selectedId = useRef(activeId);
  useEffect(() => { selectedId.current = activeId; }, [activeId]);
  useEffect(() => {
    if (focused === wasFocused.current) return;
    wasFocused.current = focused;
    const frame = window.requestAnimationFrame(() => {
      if (focused) {
        document.querySelector<HTMLButtonElement>('[data-reader-toolbar] button')?.focus({ preventScroll: true });
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
}
