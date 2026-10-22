import { useEffect } from "react";

function applyWindowTitle(title: string) {
  if (document.title !== title) document.title = title;
}

/**
 * Titles the window from client-side state, which route metadata cannot
 * express. Next.js re-synchronizes `document.title` from the route's metadata
 * after hydration and on every client navigation, so the title is re-asserted
 * whenever something else rewrites the head — setting it once loses that race.
 */
export function useWindowTitle(title: string) {
  useEffect(() => {
    if (typeof document === "undefined" || !title) return;
    applyWindowTitle(title);
    const observer = new MutationObserver(() => {
      if (document.title !== title) applyWindowTitle(title);
    });
    observer.observe(document.head, {
      childList: true,
      subtree: true,
      characterData: true
    });
    return () => observer.disconnect();
  }, [title]);
}
