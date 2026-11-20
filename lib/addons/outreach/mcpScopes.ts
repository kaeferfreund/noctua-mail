import type { McpScope } from "@/lib/mcpPermissions";

/**
 * Explicit allowlist of the addon's MCP tools (pure constants; safe for client bundles).
 * A token without `send` can prepare everything; starting a campaign or switching a sequence
 * live needs `send`. Consent changes need `manage`.
 * `save_sequence` and `update_sequence_step` prepare a draft with `drafts`. For a sequence that is
 * live or paused the same edit changes mail that goes out, so the tool also requires `send`
 * (`saveSequenceEdit` in `sending/actions.ts`).
 */
export const OUTREACH_MCP_TOOL_SCOPES: Readonly<Record<string, McpScope>> = {
  // tracking
  get_message_tracking: "read", list_tracking_events: "read",
  // contacts
  list_contact_lists: "read", search_contacts: "read", get_contact: "read",
  upsert_contact: "drafts", save_contact_list: "drafts", subscribe_contact: "manage", unsubscribe_contact: "manage",
  // sending
  list_email_templates: "read", get_email_template: "read", save_email_template: "drafts",
  list_email_images: "read", upload_email_image: "drafts",
  list_campaigns: "read", get_campaign: "read", get_campaign_report: "read", save_campaign: "drafts",
  schedule_campaign: "send", cancel_campaign: "send",
  list_sequences: "read", get_sequence: "read", get_sequence_step: "read",
  save_sequence: "drafts", update_sequence_step: "drafts", set_sequence_status: "send"
};
