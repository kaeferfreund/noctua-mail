"use client";

import { useEffect, useRef, useState } from "react";
import { BROWSER_PRINCIPAL_STORAGE_KEY, readBrowserPrincipal } from "@/lib/browserUserState";

type MeResponse = { user?: { id?: unknown } | null };
type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/**
 * A detached window (reader, composer, calendar) shows one signed-in person's mail. Its view
 * ends — the page drops the loaded content — when that person signs out in any window of this
 * browser, another person signs in, or the session is gone when the window comes back into view
 * (focus, tab shown again, restored from the back/forward cache). Offline it keeps the view; the
 * next check decides.
 */
export function useDetachedSessionGuard(fetcher: Fetcher = (input, init) => fetch(input, init)) {
  const [ended, setEnded] = useState(false);
  const fetcherRef = useRef(fetcher);
  useEffect(() => { fetcherRef.current = fetcher; }, [fetcher]);
  useEffect(() => {
    if (ended) return;
    let active = true;
    // The person this window was opened for: the browser's signed-in user, or the session's.
    let owner = readBrowserPrincipal();
    let checking: Promise<void> | null = null;
    const end = () => { if (active) setEnded(true); };
    const principalChanged = () => owner !== null && readBrowserPrincipal() !== owner;
    const verify = async () => {
      if (principalChanged()) { end(); return; }
      try {
        const response = await fetcherRef.current("/api/auth/me", { credentials: "include", cache: "no-store" });
        if (response.status === 401) { end(); return; }
        if (!response.ok) return;
        const id = ((await response.json()) as MeResponse | null)?.user?.id;
        if (typeof id !== "string" || !id) return;
        if (owner === null) owner = id;
        else if (id !== owner) end();
      } catch {
        // Offline or aborted: keep the view until a check can reach the server.
      }
    };
    const check = () => {
      checking ??= verify().finally(() => { checking = null; });
    };
    const onStorage = (event: StorageEvent) => {
      // key null: the origin's storage was cleared.
      if (event.key !== null && event.key !== BROWSER_PRINCIPAL_STORAGE_KEY) return;
      if (principalChanged()) end();
      else check();
    };
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    check();
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", check);
    window.addEventListener("pageshow", check);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", check);
      window.removeEventListener("pageshow", check);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [ended]);
  return ended;
}
