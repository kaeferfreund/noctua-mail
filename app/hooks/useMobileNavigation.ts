"use client";

import { useCallback, useEffect, useLayoutEffect } from "react";
import { afterMobileOverlayNavigation, isMobileOverlayPop } from "./useMobileOverlayHistory";

export function useMobileNavigation(isMobile: boolean, messageId: string | null, clearMessage: () => void, urlManaged = false) {
  // Derive visibility from the selection even during SSR; CSS applies it only
  // below md. Do not keep a second selection state that can drift on deep links.
  const view: "thread" | "list" = messageId ? "thread" : "list";
  // Establish the thread entry before child Sheets register their passive effects.
  useLayoutEffect(() => {
    if (!isMobile || urlManaged) return;
    return afterMobileOverlayNavigation(() => {
      if (messageId && !window.history.state?.noctuaMobileView) {
        window.history.pushState({ ...window.history.state, noctuaMobileView: "thread" }, "");
      } else if (!messageId && window.history.state?.noctuaMobileView) {
        const { noctuaMobileView: _view, ...state } = window.history.state;
        window.history.replaceState(state, "");
      }
    });
  }, [isMobile, messageId, urlManaged]);
  useEffect(() => {
    if (!isMobile || urlManaged) return;
    const onPopState = (event: PopStateEvent) => {
      if (!isMobileOverlayPop(event) && !event.state?.noctuaMobileView) clearMessage();
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [isMobile, clearMessage, urlManaged]);
  const back = useCallback(() => {
    if (urlManaged ? window.history.state?.noctuaMessageEntry : window.history.state?.noctuaMobileView) window.history.back();
    else clearMessage();
  }, [clearMessage, urlManaged]);
  return { view, back };
}
