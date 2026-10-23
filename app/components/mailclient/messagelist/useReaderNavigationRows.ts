import { useEffect, useMemo } from "react";
import type { Message } from "@/lib/data";
import { readerNavigationRows } from "@/lib/ui/readerFocus";
import type { ListItem } from "./listModel";

export function useReaderNavigationRows(items: ListItem[], onChange?: (rows: Message[]) => void) {
  const rows = useMemo(() => readerNavigationRows(items), [items]);
  useEffect(() => { onChange?.(rows); }, [onChange, rows]);
}
