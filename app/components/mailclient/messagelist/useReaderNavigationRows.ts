import { useEffect, useMemo } from "react";
import type { Message } from "@/lib/data";
import { readerNavigationRows } from "@/lib/ui/readerFocus";
import type { ListItem } from "./listModel";

export function useReaderNavigationRows(items: ListItem[], onChange?: (rows: Message[]) => void) {
  const rows = useMemo(() => readerNavigationRows(items), [items]);
  useEffect(() => { onChange?.(rows); }, [onChange, rows]);
}

/**
 * The renderer's latest navigation rows. Action handlers read them on demand; only
 * views that render from them subscribe, so publishing rows after a list change does
 * not re-render the whole mail client in the same task as the new rows.
 */
export type ReaderRowsStore = {
  publish: (rows: Message[]) => void;
  getRows: () => Message[];
  subscribe: (listener: () => void) => () => void;
};

export function createReaderRowsStore(): ReaderRowsStore {
  let current: Message[] = [];
  const listeners = new Set<() => void>();
  return {
    publish: (rows) => {
      if (current.length === rows.length && current.every((message, index) => message === rows[index])) return;
      current = rows;
      listeners.forEach(listener => listener());
    },
    getRows: () => current,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    }
  };
}
