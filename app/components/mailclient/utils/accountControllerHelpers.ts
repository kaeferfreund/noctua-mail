/**
 * Pure decision helpers for the account controller.
 *
 * The account controller owns fetch and state orchestration, but several
 * discrete decisions (which account to activate, what endpoint to hit, how
 * to normalise optional config) are better exercised in isolation.
 */
import { buildAccountApiPath } from "@/lib/accountApiPaths";
import type { Account, CaldavConfig, DeeplConfig } from "@/lib/data";

export type AccountSaveRequest = {
  endpoint: string;
  method: "POST" | "PUT";
  body: Record<string, unknown> | Account;
  isNew: boolean;
};

/**
 * Decide the HTTP shape for persisting an account. New accounts post to the
 * admin endpoint with only provisioning fields so the server derives the id; updates
 * put to the scoped endpoint with the full account shape.
 */
export function buildAccountSaveRequest(
  account: Account,
  exists: boolean
): AccountSaveRequest {
  const isNew = !exists;
  if (isNew) {
    const { name, email, avatar, imap, smtp } = account;
    return {
      endpoint: "/api/admin/accounts",
      method: "POST",
      body: { name, email, avatar: avatar ?? "", imap, smtp },
      isNew: true
    };
  }
  return {
    endpoint: buildAccountApiPath(account.id, ""),
    method: "PUT",
    body: account,
    isNew: false
  };
}

/**
 * CalDAV config is persisted only when the URL is a non-empty trimmed string;
 * otherwise the server should drop any stored config.
 */
export function normalizeCaldavForSave(
  caldav: CaldavConfig | null | undefined
): CaldavConfig | null {
  if (!caldav) return null;
  if (!caldav.url || !caldav.url.trim()) return null;
  return caldav;
}

/**
 * Shape the DeepL config for the save request. Sends `null` when there is
 * nothing to persist so the server clears any stored config. A blank `apiKey`
 * is preserved server-side (means "keep the stored key"); the client-only
 * `hasApiKey` flag is dropped.
 */
export function normalizeDeeplForSave(
  deepl: DeeplConfig | null | undefined
): DeeplConfig | null {
  if (!deepl) return null;
  const hasKey = Boolean(deepl.apiKey && deepl.apiKey.trim()) || Boolean(deepl.hasApiKey);
  if (!hasKey && !deepl.enabled && !deepl.targetLang) return null;
  return {
    apiKey: deepl.apiKey ?? "",
    enabled: Boolean(deepl.enabled),
    targetLang: deepl.targetLang
  };
}

/**
 * Build a blank Account shape for the "add account" editing dialog. A short
 * pseudo-id is prepended so the UI can key on it before the server assigns
 * the real id on save.
 */
export function createBlankEditAccount(generateId: () => string): Account {
  return {
    id: `acc-${generateId().slice(0, 6)}`,
    name: "",
    email: "",
    avatar: "NW",
    imap: { host: "", port: 993, secure: true, user: "", password: "" },
    smtp: { host: "", port: 587, secure: false, user: "", password: "" }
  };
}
