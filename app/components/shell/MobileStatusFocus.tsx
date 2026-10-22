"use client";

import { createContext, type RefObject } from "react";

export const MobileStatusFocusContext = createContext<RefObject<HTMLButtonElement | null> | null>(null);
export function restoreStatusFocus(event: Event, trigger: HTMLButtonElement | null | undefined) {
  if (trigger?.isConnected) {
    event.preventDefault();
    trigger.focus();
  }
}
