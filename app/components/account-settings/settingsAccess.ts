import type { AccountRole } from "@/lib/data";

// Explicit tab identifiers and the sanitized mailbox role are authoritative.
const managerTabs = new Set(["account", "signatures", "calendar", "translation", "members"]);
export function settingsTabVisible(tab: string, role: AccountRole | undefined, existing = true) {
  if (tab === "admin") return false;
  if (!existing) return tab === "account";
  if (managerTabs.has(tab)) return role === "manager";
  if (tab === "mcp") return role === "editor" || role === "manager";
  return true;
}
