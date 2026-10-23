import type { Account, SenderIdentity, UserAccountPrefs } from "../data";
import type { SignatureUser } from "../signatureTemplates";

export type SenderSettings = {
  account: Account;
  identities: SenderIdentity[];
  prefs: UserAccountPrefs;
  user: SignatureUser & { id?: string };
  warnings: string[];
};
export const SENDER_SETTINGS_CHANGED = "noctua:sender-settings-changed";
export const SENDER_SETTINGS_STORAGE_KEY = "noctua:sender-settings-refresh";

/** Per-open snapshot; never retain private preferences in a process-wide cache. */
export async function loadSenderSettings(apiFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>, accountId: string): Promise<SenderSettings> {
  const base = `/api/accounts/${encodeURIComponent(accountId)}`;
  const responses = await Promise.all([
    apiFetch(`${base}/identities`, { cache: "no-store" }),
    apiFetch(`${base}/prefs`, { cache: "no-store" }),
    apiFetch("/api/auth/me", { cache: "no-store" })
  ]);
  for (const response of responses) {
    if (!response.ok) throw new Error("Could not load sender identities and preferences. Reopen the composer to retry.");
  }
  const [identities, preferences, me] = await Promise.all(responses.map(response => response.json()));
  const account = (me.accounts as Account[] | undefined)?.find(item => item.id === accountId);
  if (!account || !me.user?.email || !Array.isArray(identities.identities)) throw new Error("Sender settings are unavailable for this mailbox.");
  return { account: { ...account, ownAddresses: identities.ownAddresses }, identities: identities.identities,
    prefs: preferences.prefs ?? {}, user: me.user, warnings: identities.warnings ?? [] };
}

function broadcastSenderRefresh(accountId: string) {
  try {
    // Refresh receipts carry no personal text/profile/preferences.
    window.localStorage.setItem(SENDER_SETTINGS_STORAGE_KEY, JSON.stringify({ accountId, nonce: crypto.randomUUID() }));
  } catch { /* The local notification still works when storage is unavailable. */ }
}
export function notifySenderSettingsChanged(accountId: string) {
  window.dispatchEvent(new CustomEvent(SENDER_SETTINGS_CHANGED, { detail: { accountId } }));
  broadcastSenderRefresh(accountId);
}
export function notifySenderPreferencesChanged(accountId: string, prefs: UserAccountPrefs) {
  window.dispatchEvent(new CustomEvent("noctua:account-prefs-changed", { detail: { accountId, prefs } }));
  broadcastSenderRefresh(accountId);
}
