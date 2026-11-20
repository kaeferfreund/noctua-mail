"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { buildAccountApiPath, buildAccountMessageRemoteContentPath } from "@/lib/accountApiPaths";
import { hasLoadedRemoteContent, loadRemoteContentOnce, retainRemoteContentDecision, subscribeRemoteContent } from "@/lib/html/remoteContentSession";

const PREFERENCES_CHANGED = "noctua:remote-content-prefs";

/** The stored message whose remote content is shown; all fields absent for content without one. */
export type RemoteContentSource = { accountId?: string; senderKey?: string | null; messageId?: string };

export type RemoteContentState = ReturnType<typeof useRemoteContent>;

/**
 * What the bar says about the sender: `checking` while the server decision is
 * loading, `unavailable` when it could not be loaded (nothing to say, images
 * stay blocked), `unknown` for content without a stored message or sender.
 */
export type RemoteContentSenderStatus = "checking" | "verified" | "unverified" | "unknown" | "unavailable";

/**
 * Remote-content consent for one piece of sender content: "load once" for the
 * message (`messageId`, else `fallbackKey`) and the user's sender permission.
 * The permission is decided by the server per message
 * (remoteContentSenderDecision): it applies only when the receiving server
 * authenticated the From address, so a forged From of an allowed sender stays
 * blocked (A38, S31).
 */
export function useRemoteContent({ accountId, senderKey, messageId }: RemoteContentSource, fallbackKey = "") {
  const messageKey = messageId ?? fallbackKey;
  const decisionKey = JSON.stringify([accountId, senderKey, messageId]);
  const key = JSON.stringify([decisionKey, messageKey]);
  const once = useSyncExternalStore(subscribeRemoteContent, () => hasLoadedRemoteContent(accountId ?? "", messageKey), () => false);
  const [decision, setDecision] = useState({ key: "", allowed: false, senderVerified: false, failed: false });
  const [saveState, setSaveState] = useState({ key: "", pending: false, error: "" });

  useEffect(() => retainRemoteContentDecision(accountId ?? "", messageKey), [accountId, messageKey]);

  useEffect(() => {
    if (!accountId || !senderKey || !messageId) return;
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch(buildAccountMessageRemoteContentPath(accountId, messageId));
        if (!response.ok) throw new Error(`Remote content decision failed (${response.status})`);
        const result = await response.json() as { allowed?: unknown; senderVerified?: unknown };
        if (active) setDecision({ key: decisionKey, allowed: result.allowed === true, senderVerified: result.senderVerified === true, failed: false });
      } catch {
        // Keep remote content blocked when the decision is unavailable.
        if (active) setDecision({ key: decisionKey, allowed: false, senderVerified: false, failed: true });
      }
    };
    void refresh();
    window.addEventListener(PREFERENCES_CHANGED, refresh);
    return () => { active = false; window.removeEventListener(PREFERENCES_CHANGED, refresh); };
  }, [accountId, decisionKey, messageId, senderKey]);

  const current = decision.key === decisionKey ? decision : null;
  const canAlwaysAllow = !!accountId && !!senderKey && !!current?.senderVerified;
  const senderStatus: RemoteContentSenderStatus = !accountId || !senderKey || !messageId ? "unknown"
    : !current ? "checking"
      : current.failed ? "unavailable"
        : current.senderVerified ? "verified" : "unverified";

  const alwaysAllow = async () => {
    if (!accountId || !senderKey || !canAlwaysAllow) return;
    setSaveState({ key, pending: true, error: "" });
    try {
      const response = await fetch(buildAccountApiPath(accountId, "/prefs"), {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remoteContent: { allowedSenders: { [senderKey]: true } } })
      });
      if (!response.ok) throw new Error("Preferences could not be saved.");
      setDecision({ key: decisionKey, allowed: true, senderVerified: true, failed: false });
      setSaveState({ key, pending: false, error: "" });
      window.dispatchEvent(new Event(PREFERENCES_CHANGED));
    } catch {
      setSaveState({ key, pending: false, error: "Preferences could not be saved. Try again." });
    }
  };

  return {
    allowed: once || !!current?.allowed,
    loadOnce: () => loadRemoteContentOnce(accountId ?? "", messageKey), alwaysAllow,
    canAlwaysAllow,
    senderStatus,
    saving: saveState.key === key && saveState.pending,
    error: saveState.key === key ? saveState.error : ""
  };
}
