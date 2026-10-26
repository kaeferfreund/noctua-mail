"use client";

import { useEffect } from "react";

/** Background tabs do not count as session activity. Resume when shown again. */
export function useVisibleInterval(callback: () => void | Promise<void>, intervalMs: number | null) {
  useEffect(() => {
    if (intervalMs === null) return;
    let running = false;
    const refresh = async () => {
      if (document.hidden || running) return;
      running = true;
      try { await callback(); } finally { running = false; }
    };
    const timer = window.setInterval(() => { void refresh(); }, intervalMs);
    const onVisibility = () => { if (!document.hidden) void refresh(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [callback, intervalMs]);
}
