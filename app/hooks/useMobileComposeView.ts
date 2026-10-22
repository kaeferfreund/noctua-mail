"use client";

import { useCallback, type Dispatch, type SetStateAction } from "react";

type ComposeView = "inline" | "modal" | "minimized";

export function useMobileComposeView(isMobile: boolean, view: ComposeView, setView: Dispatch<SetStateAction<ComposeView>>) {
  const setComposeView = useCallback<Dispatch<SetStateAction<ComposeView>>>((next) => {
    setView((previous) => {
      const requested = typeof next === "function" ? next(isMobile ? "modal" : previous) : next;
      return isMobile ? "modal" : requested;
    });
  }, [isMobile, setView]);
  return { composeView: isMobile ? "modal" as const : view, setComposeView };
}
