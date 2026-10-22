"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { buildAccountApiPath } from "@/lib/accountApiPaths";
import { remoteContentSenderKey, senderAllowsRemoteContent } from "@/lib/html/remoteContent";
import type { UserAccountPrefs } from "@/lib/data";
import { hasLoadedRemoteContent, loadRemoteContentOnce, retainRemoteContentDecision, subscribeRemoteContent } from "@/lib/html/remoteContentSession";

const PREFERENCES_CHANGED = "noctua:remote-content-prefs";

export function useRemoteContent(accountId: string | undefined, sender: string | undefined, messageKey: string) {
  const senderKey = remoteContentSenderKey(sender);
  const preferenceKey = JSON.stringify([accountId, senderKey]);
  const key = JSON.stringify([preferenceKey, messageKey]);
  const once = useSyncExternalStore(subscribeRemoteContent, () => hasLoadedRemoteContent(accountId ?? "", messageKey), () => false);
  const [preference, setPreference] = useState({ key: "", allowed: false });
  const [saveState, setSaveState] = useState({ key: "", pending: false, error: "" });

  useEffect(() => retainRemoteContentDecision(accountId ?? "", messageKey), [accountId, messageKey]);

  useEffect(() => {
    if (!accountId || !senderKey) return;
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch(buildAccountApiPath(accountId, "/prefs"));
        if (!response.ok) return;
        const { prefs } = await response.json() as { prefs: UserAccountPrefs };
        if (active) setPreference({ key: preferenceKey, allowed: senderAllowsRemoteContent(prefs, senderKey) });
      } catch { /* Keep remote content blocked when preferences are unavailable. */ }
    };
    void refresh();
    window.addEventListener(PREFERENCES_CHANGED, refresh);
    return () => { active = false; window.removeEventListener(PREFERENCES_CHANGED, refresh); };
  }, [accountId, preferenceKey, senderKey]);

  const alwaysAllow = async () => {
    if (!accountId || !senderKey) return;
    setSaveState({ key, pending: true, error: "" });
    try {
      const response = await fetch(buildAccountApiPath(accountId, "/prefs"), {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remoteContent: { allowedSenders: { [senderKey]: true } } })
      });
      if (!response.ok) throw new Error("Preferences could not be saved.");
      setPreference({ key: preferenceKey, allowed: true });
      setSaveState({ key, pending: false, error: "" });
      window.dispatchEvent(new Event(PREFERENCES_CHANGED));
    } catch {
      setSaveState({ key, pending: false, error: "Preferences could not be saved. Try again." });
    }
  };

  return {
    allowed: once || (preference.key === preferenceKey && preference.allowed),
    loadOnce: () => loadRemoteContentOnce(accountId ?? "", messageKey), alwaysAllow,
    canAlwaysAllow: !!accountId && !!senderKey,
    saving: saveState.key === key && saveState.pending,
    error: saveState.key === key ? saveState.error : ""
  };
}
