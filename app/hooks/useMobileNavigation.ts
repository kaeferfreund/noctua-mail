"use client";

import { useCallback, useEffect } from "react";

export function useMobileNavigation(isMobile: boolean, messageId: string | null, clearMessage: () => void) {
  // Derive visibility from the selection even during SSR; CSS applies it only
  // below md. Do not keep a second selection state that can drift on deep links.
  const view: "thread" | "list" = messageId ? "thread" : "list";
  useEffect(() => {
    if (!isMobile || !messageId || window.history.state?.noctuaMobileView) return;
    window.history.pushState({ ...window.history.state, noctuaMobileView: "thread" }, "");
  }, [isMobile, messageId]);
  useEffect(() => {
    if (!isMobile) return;
    const onPopState = () => clearMessage();
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [isMobile, clearMessage]);
  const back = useCallback(() => {
    if (window.history.state?.noctuaMobileView) window.history.back();
    else clearMessage();
  }, [clearMessage]);
  return { view, back };
}
