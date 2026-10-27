import type { McpTokenMetadata } from "./data";

/** Token permissions narrow live mailbox roles; they never grant a mailbox role. */
export const MCP_SCOPES = ["read", "drafts", "manage", "send"] as const;
export type McpScope = typeof MCP_SCOPES[number];
export const MCP_PERMISSION_MODES = ["read", "drafts", "full"] as const;
export type McpPermissionMode = typeof MCP_PERMISSION_MODES[number];
export function scopesForMcpMode(mode: McpPermissionMode): McpScope[] {
  return mode === "full" ? [...MCP_SCOPES] : mode === "drafts" ? ["read", "drafts"] : ["read"];
}
/** NULL is the legacy read/drafts mode. Invalid stored data fails closed. */
export function parseMcpScopes(value: string | null | undefined): McpScope[] {
  if (value == null) return scopesForMcpMode("drafts");
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every(scope => MCP_SCOPES.includes(scope)) ? [...new Set(parsed)] : [];
  } catch { return []; }
}
/** "invalid": stored scopes failed to parse, so the token denies every tool. */
export function mcpPermissionMode(scopes?: readonly McpScope[]): McpPermissionMode | "invalid" {
  const effective = scopes ?? scopesForMcpMode("drafts");
  if (!effective.length) return "invalid";
  return effective.includes("send") ? "full" : effective.includes("drafts") ? "drafts" : "read";
}
/** A token row as one mailbox tab shows it: covered mailboxes the viewer can access; the rest (primary included) only as a count. */
export type McpTokenListItem = Omit<McpTokenMetadata, "accountId" | "accountIds"> & { accountIds: string[]; hiddenMailboxCount: number };
export function mcpTokenListItem({ accountId, accountIds = [accountId], ...token }: McpTokenMetadata, accessible: ReadonlySet<string>): McpTokenListItem {
  const visible = accountIds.filter(id => accessible.has(id));
  return { ...token, accountIds: visible, hiddenMailboxCount: accountIds.length - visible.length };
}
export function assertMcpScope(scopes: readonly McpScope[] | undefined, scope: McpScope) {
  if (!(scopes ?? scopesForMcpMode("drafts")).includes(scope)) throw new Error(`Token has no ${scope} permission`);
}
/** Explicit allowlist: unknown/future tools are denied until classified here. */
export const MCP_TOOL_SCOPES: Readonly<Record<string, McpScope>> = {
  list_accounts: "read", list_mailbox_summary: "read", list_folders: "read", list_topics: "read",
  list_mailing_list_aliases: "read", check_new_mail: "read", list_messages_by_folder: "read", search_messages: "read", resolve_link: "read",
  list_draft_messages: "read", get_draft_message: "read",
  assign_topics: "drafts", unassign_topics: "drafts", create_draft_message: "drafts", update_draft_message: "drafts",
  list_sender_identities: "read", create_sender_identity: "manage", update_sender_identity: "manage",
  get_sender_preferences: "read", set_sender_preferences: "manage",
  list_signature_templates: "read", save_signature_template: "manage", delete_signature_template: "manage", set_default_signature_template: "manage",
  flag_message: "drafts", unflag_message: "drafts", mark_message_todo: "drafts", mark_message_done: "drafts", clear_message_todo: "drafts",
  list_mailbox_members: "read", get_thread_collaboration: "read", set_thread_status: "drafts",
  assign_thread: "drafts", add_internal_comment: "drafts", list_thread_activity: "read"
};
export function mcpToolScope(name: string): McpScope {
  const scope = Object.hasOwn(MCP_TOOL_SCOPES, name) ? MCP_TOOL_SCOPES[name] : undefined;
  if (!scope) throw new Error(`MCP tool has no permission classification: ${name}`);
  return scope;
}
