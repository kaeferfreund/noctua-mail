"use client";

import { useEffect, useState } from "react";

/**
 * The mounted mail client outlives a sign-out: the next person signs in in the same tab.
 * When the person this client showed signs out (`principal` null while `signedOut`) or another
 * person signs in, `onLeave` resets that person's views. It runs during render, like the other
 * derived-state resets in MailClient, so it may only call MailClient's own state setters; the
 * stale views never paint for the next person. The address bar then drops the previous person's
 * place (search text, folder, message), which the sign-in screen would otherwise keep showing.
 *
 * Nothing resets on the first sign-in of a mounted client: a link opened while signed out (for
 * example from a notification) keeps its place for the person who signs in.
 */
export function usePrincipalBoundary(principal: string | null, signedOut: boolean, onLeave: () => void) {
  const [shown, setShown] = useState<string | null>(null);
  const [leaves, setLeaves] = useState(0);
  if ((principal !== null || signedOut) && principal !== shown) {
    setShown(principal);
    if (shown !== null) {
      setLeaves(count => count + 1);
      onLeave();
    }
  }
  useEffect(() => {
    if (!leaves || typeof window === "undefined" || !window.location.search && !window.location.hash) return;
    try {
      window.history.replaceState(null, "", window.location.pathname);
    } catch {
      // ignore
    }
  }, [leaves]);
}
