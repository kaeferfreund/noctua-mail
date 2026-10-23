"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Message } from "@/lib/data";
import { readerNavigation, readerPosition } from "./readerFocus";

type Inputs = {
  enabled: boolean; rows: Message[]; activeId: string; listKey: string; hasMore: boolean; loading: boolean;
  revision: number; error: string | null; select: (message: Message) => void; loadNextPage: () => void;
};
export function useReaderNavigation(inputs: Inputs) {
  const [pending, setPending] = useState(false);
  const latest = useRef(inputs);
  useEffect(() => { latest.current = inputs; });
  const request = useRef<{ id: string; key: string; revision: number } | null>(null);
  const navigate = useCallback((direction: -1 | 1) => {
    const { rows, activeId, listKey, hasMore, loading, revision, select, loadNextPage } = latest.current;
    if (!latest.current.enabled || request.current) return;
    const next = readerNavigation(rows, activeId, direction, hasMore);
    if (next === "load") {
      if (loading) return;
      request.current = { id: activeId, key: listKey, revision };
      setPending(true);
      loadNextPage();
    } else if (next) select(next);
  }, []);
  useEffect(() => {
    // Wait for the renderer to publish rows for the completed page before stepping.
    const timer = window.setTimeout(() => {
      const waiting = request.current;
      if (!waiting) return;
      const { rows, activeId, listKey, hasMore, loading, revision, error, select, loadNextPage } = latest.current;
      const finish = () => { request.current = null; setPending(false); };
      if (!latest.current.enabled || waiting.key !== listKey || waiting.id !== activeId || error) { finish(); return; }
      if (loading || waiting.revision === revision) return;
      const next = readerNavigation(rows, waiting.id, 1, hasMore);
      if (next === "load") {
        // A whole page may belong to collapsed groups or already-visible threads.
        waiting.revision = revision;
        loadNextPage();
      } else { finish(); if (next) select(next); }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [inputs]);
  return { ...readerPosition(inputs.rows, inputs.activeId, inputs.hasMore), pending, navigate };
}
