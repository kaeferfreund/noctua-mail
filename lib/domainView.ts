/** Shared client/server vocabulary of the domain view („Sammler“). */

/** Special folders the domain view can switch between, in display order. */
export const DOMAIN_FOLDER_ROLES = ["inbox", "sent", "drafts", "archive", "trash", "spam"] as const;
export type DomainFolderRole = (typeof DOMAIN_FOLDER_ROLES)[number];

export function parseDomainFolderRole(value: unknown): DomainFolderRole {
  return typeof value === "string" && (DOMAIN_FOLDER_ROLES as readonly string[]).includes(value)
    ? (value as DomainFolderRole)
    : "inbox";
}

/** Normalised domain key (lower-case, trimmed), or null when it is not a plain domain. */
export function normalizeDomainKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed || trimmed.length > 253 || !/^[^\s/\\?#@%]+$/.test(trimmed) || !trimmed.includes(".")) return null;
  return trimmed;
}

export function buildDomainThreadsPath(domain: string, params?: URLSearchParams) {
  const base = `/api/domains/${encodeURIComponent(domain)}/threads`;
  const query = params?.toString();
  return query ? `${base}?${query}` : base;
}
