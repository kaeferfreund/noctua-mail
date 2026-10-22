import { useEffect, useState, useSyncExternalStore } from "react";
import {
  areMarkdownConvertersReady,
  loadMarkdownConverters,
  subscribeMarkdownConverters
} from "@/lib/markdownConvert";

/** Subscribe separately from loading so a closed composer keeps its chunks lazy. */
export function useMarkdownConverters(enabled: boolean) {
  const ready = useSyncExternalStore(
    subscribeMarkdownConverters, areMarkdownConvertersReady, () => false
  );
  const [error, setError] = useState(false);
  const retry = () => {
    setError(false);
    void loadMarkdownConverters().catch(() => { setError(true); });
  };
  useEffect(() => {
    if (!enabled || ready) return;
    let active = true;
    void loadMarkdownConverters().catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [enabled, ready]);
  return { ready, error, retry };
}
