"use client";

import { useSyncExternalStore } from "react";

// next-themes puts the `dark` class on <html> before hydration and keeps it
// in sync with the stored or system theme. The kept renderers (HtmlMessage,
// the compose editor) need a boolean that is correct on their first client
// render, otherwise the e-mail iframe is built twice; `useTheme().resolvedTheme`
// is undefined until the provider has mounted, so the class list is read
// directly instead. Components mounted after hydration see the real value
// immediately; during hydration the server snapshot (false) is used and
// React re-renders once the client snapshot differs.

const DARK_CLASS = "dark";

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

function getSnapshot() {
  return document.documentElement.classList.contains(DARK_CLASS);
}

function getServerSnapshot() {
  return false;
}

export function useDarkMode(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
