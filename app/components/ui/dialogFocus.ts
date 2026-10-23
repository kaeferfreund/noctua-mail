"use client";

import { useRef, useState } from "react";

function dialogOpener(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || active === document.body) return null;
  // Menu items unmount when they open a dialog. The menu's accessible label
  // points to its persistent trigger, which is the correct focus destination.
  const triggerId = active.closest('[role="menu"]')?.getAttribute("aria-labelledby");
  return (triggerId ? document.getElementById(triggerId) : null) ?? active;
}

export function useDialogFocusRestore() {
  // Capture before the opening commit can remove the selected menu item.
  const [initialOpener] = useState(dialogOpener);
  const opener = useRef(initialOpener);
  return {
    onOpenAutoFocus: () => { opener.current = dialogOpener() ?? opener.current; },
    onCloseAutoFocus: (event: Event) => {
      if (opener.current?.isConnected) { event.preventDefault(); opener.current.focus(); }
    }
  };
}
