"use client";
import { useCallback, useState, useSyncExternalStore } from "react";
import { readReaderLayout, readReaderStorage, writeReaderStorage, subscribeReaderStorage, READER_HINT_KEY, READER_LAYOUT_KEY, type ReaderLayout } from "./readerFocus";

/** Device-only presentation state; no account/server preference is involved. */
export function useReaderFocus(isMobile: boolean) {
  const saved = useSyncExternalStore(subscribeReaderStorage, readReaderLayout, () => "split" as const);
  const [override, setOverride] = useState<ReaderLayout | null>(null);
  const [hintMessageId, setHintMessageId] = useState<string | null>(null);
  const readerLayout = isMobile ? "split" : override ?? saved;
  const changeLayout = useCallback((next: ReaderLayout) => {
    if (isMobile) return;
    writeReaderStorage(READER_LAYOUT_KEY, next);
    setOverride(next);
    setHintMessageId(null);
  }, [isMobile]);
  const onSelect = useCallback((id: string) => {
    if (isMobile) return;
    const preferred = readReaderLayout();
    setOverride(preferred);
    if (preferred === "split" && !readReaderStorage(READER_HINT_KEY)) {
      setHintMessageId(id);
      writeReaderStorage(READER_HINT_KEY, "1");
    } else setHintMessageId(current => preferred === "split" && current === id ? current : null);
  }, [isMobile]);
  const onNavigate = useCallback(() => { setOverride("split"); setHintMessageId(null); }, []);
  const dismissHint = useCallback(() => setHintMessageId(null), []);
  return { readerLayout, changeLayout, onSelect, onNavigate, hintMessageId, dismissHint };
}
