import type { AccountRole } from "./data";

/** Independent design §5.2 route inventory, used by HTTP authorization tests. */
export const accountRouteRoles: Array<{ method: string; path: string; minRole: AccountRole }> = [
  {
    "method": "DELETE",
    "path": "",
    "minRole": "manager"
  },
  {
    "method": "PUT",
    "path": "",
    "minRole": "manager"
  },
  {
    "method": "GET",
    "path": "calendar/conflicts",
    "minRole": "viewer"
  },
  {
    "method": "POST",
    "path": "calendar/conflicts/[eventId]/resolve",
    "minRole": "editor"
  },
  {
    "method": "DELETE",
    "path": "calendar/events",
    "minRole": "editor"
  },
  {
    "method": "GET",
    "path": "calendar/events",
    "minRole": "viewer"
  },
  {
    "method": "POST",
    "path": "calendar/events",
    "minRole": "editor"
  },
  {
    "method": "DELETE",
    "path": "calendar/events/[eventId]",
    "minRole": "editor"
  },
  {
    "method": "GET",
    "path": "calendar/events/[eventId]",
    "minRole": "viewer"
  },
  {
    "method": "PUT",
    "path": "calendar/events/[eventId]",
    "minRole": "editor"
  },
  {
    "method": "POST",
    "path": "calendar/events/[eventId]/respond",
    "minRole": "editor"
  },
  {
    "method": "GET",
    "path": "calendar/events/participation",
    "minRole": "viewer"
  },
  {
    "method": "POST",
    "path": "calendar/invites/process",
    "minRole": "editor"
  },
  {
    "method": "GET",
    "path": "calendar/sync",
    "minRole": "viewer"
  },
  {
    "method": "POST",
    "path": "calendar/sync",
    "minRole": "viewer"
  },
  {
    "method": "GET",
    "path": "categories/debug",
    "minRole": "manager"
  },
  {
    "method": "POST",
    "path": "categories/model/reset",
    "minRole": "editor"
  },
  {
    "method": "POST",
    "path": "categories/recompute",
    "minRole": "viewer"
  },
  {
    "method": "GET",
    "path": "categories/recompute/status",
    "minRole": "viewer"
  },
  {
    "method": "GET",
    "path": "compose/recipients",
    "minRole": "viewer"
  },
  {
    "method": "GET",
    "path": "destination-folders",
    "minRole": "editor"
  },
  {
    "method": "POST",
    "path": "drafts/[draftId]/discard",
    "minRole": "editor"
  },
  {
    "method": "POST",
    "path": "drafts/[draftId]/send",
    "minRole": "editor"
  },
  {
    "method": "POST",
    "path": "drafts/save",
    "minRole": "editor"
  },
  {
    "method": "GET",
    "path": "folders",
    "minRole": "viewer"
  },
  {
    "method": "PUT",
    "path": "folders",
    "minRole": "manager"
  },
  {
    "method": "POST",
    "path": "folders/[folderId]/consistency",
    "minRole": "viewer"
  },
  {
    "method": "POST",
    "path": "folders/[folderId]/delete",
    "minRole": "manager"
  },
  {
    "method": "POST",
    "path": "folders/[folderId]/rename",
    "minRole": "manager"
  },
  {
    "method": "POST",
    "path": "folders/create",
    "minRole": "manager"
  },
  {
    "method": "GET",
    "path": "imap/poll",
    "minRole": "viewer"
  },
  {
    "method": "GET",
    "path": "imap/stream",
    "minRole": "viewer"
  },
  {
    "method": "GET",
    "path": "mcp-tokens",
    "minRole": "editor"
  },
  {
    "method": "POST",
    "path": "mcp-tokens",
    "minRole": "editor"
  },
  {
    "method": "DELETE",
    "path": "mcp-tokens/[tokenId]",
    "minRole": "editor"
  },
  {
    "method": "GET",
    "path": "members",
    "minRole": "viewer"
  },
  {
    "method": "DELETE",
    "path": "members/[userId]",
    "minRole": "manager"
  },
  {
    "method": "PUT",
    "path": "members/[userId]",
    "minRole": "manager"
  },
  {
    "method": "GET",
    "path": "message-topics",
    "minRole": "viewer"
  },
  {
    "method": "POST",
    "path": "message-topics",
    "minRole": "editor"
  },
  {
    "method": "GET",
    "path": "message-topics/explain",
    "minRole": "viewer"
  },
  {
    "method": "GET",
    "path": "message-topics/suggest",
    "minRole": "viewer"
  },
  {
    "method": "GET",
    "path": "messages",
    "minRole": "viewer"
  },
  {
    "method": "GET",
    "path": "messages/[messageId]",
    "minRole": "viewer"
  },
  {
    "method": "POST",
    "path": "messages/[messageId]/archive",
    "minRole": "editor"
  },
  {
    "method": "DELETE",
    "path": "messages/[messageId]/attachments/[attachmentId]",
    "minRole": "editor"
  },
  {
    "method": "GET",
    "path": "messages/[messageId]/attachments/[attachmentId]",
    "minRole": "viewer"
  },
  {
    "method": "GET",
    "path": "messages/[messageId]/calendar-diff",
    "minRole": "viewer"
  },
  {
    "method": "POST",
    "path": "messages/[messageId]/category",
    "minRole": "editor"
  },
  {
    "method": "POST",
    "path": "messages/[messageId]/delete",
    "minRole": "editor"
  },
  {
    "method": "POST",
    "path": "messages/[messageId]/flags",
    "minRole": "editor"
  },
  {
    "method": "GET",
    "path": "messages/[messageId]/html",
    "minRole": "viewer"
  },
  {
    "method": "POST",
    "path": "messages/[messageId]/not-spam",
    "minRole": "editor"
  },
  {
    "method": "POST",
    "path": "messages/[messageId]/resync",
    "minRole": "viewer"
  },
  {
    "method": "GET",
    "path": "messages/[messageId]/source",
    "minRole": "viewer"
  },
  {
    "method": "POST",
    "path": "messages/[messageId]/spam",
    "minRole": "editor"
  },
  {
    "method": "POST",
    "path": "messages/[messageId]/translate",
    "minRole": "editor"
  },
  {
    "method": "POST",
    "path": "messages/[messageId]/unsubscribe",
    "minRole": "editor"
  },
  {
    "method": "POST",
    "path": "messages/copy-to-account",
    "minRole": "editor"
  },
  {
    "method": "POST",
    "path": "messages/delete/associations",
    "minRole": "editor"
  },
  {
    "method": "POST",
    "path": "messages/delete/bulk",
    "minRole": "editor"
  },
  {
    "method": "POST",
    "path": "messages/delete/linked-calendar",
    "minRole": "editor"
  },
  {
    "method": "POST",
    "path": "messages/flags/bulk",
    "minRole": "editor"
  },
  {
    "method": "POST",
    "path": "messages/move",
    "minRole": "editor"
  },
  {
    "method": "GET",
    "path": "prefs",
    "minRole": "viewer"
  },
  {
    "method": "PUT",
    "path": "prefs",
    "minRole": "viewer"
  },
  {
    "method": "GET",
    "path": "recipient-aliases",
    "minRole": "viewer"
  },
  {
    "method": "POST",
    "path": "recipient-aliases",
    "minRole": "editor"
  },
  {
    "method": "DELETE",
    "path": "recipient-aliases/[aliasId]",
    "minRole": "editor"
  },
  {
    "method": "PUT",
    "path": "recipient-aliases/[aliasId]",
    "minRole": "editor"
  },
  {
    "method": "GET",
    "path": "recipient-aliases/transfer",
    "minRole": "viewer"
  },
  {
    "method": "POST",
    "path": "recipient-aliases/transfer",
    "minRole": "manager"
  },
  {
    "method": "GET",
    "path": "related",
    "minRole": "viewer"
  },
  {
    "method": "POST",
    "path": "relogin",
    "minRole": "manager"
  },
  {
    "method": "DELETE",
    "path": "reminders",
    "minRole": "viewer"
  },
  {
    "method": "GET",
    "path": "reminders",
    "minRole": "viewer"
  },
  {
    "method": "POST",
    "path": "reminders",
    "minRole": "viewer"
  },
  {
    "method": "GET",
    "path": "search",
    "minRole": "viewer"
  },
  {
    "method": "GET",
    "path": "sender-icon",
    "minRole": "viewer"
  },
  {
    "method": "PUT",
    "path": "settings",
    "minRole": "manager"
  },
  {
    "method": "POST",
    "path": "smtp/send",
    "minRole": "editor"
  },
  {
    "method": "POST",
    "path": "sync",
    "minRole": "viewer"
  },
  {
    "method": "POST",
    "path": "sync/new-candidates",
    "minRole": "viewer"
  },
  {
    "method": "GET",
    "path": "sync/status",
    "minRole": "viewer"
  },
  {
    "method": "POST",
    "path": "thread/related",
    "minRole": "viewer"
  },
  {
    "method": "GET",
    "path": "threads",
    "minRole": "viewer"
  },
  {
    "method": "POST",
    "path": "threads/recompute",
    "minRole": "viewer"
  },
  {
    "method": "GET",
    "path": "threads/recompute/status",
    "minRole": "viewer"
  },
  {
    "method": "GET",
    "path": "topics",
    "minRole": "viewer"
  },
  {
    "method": "POST",
    "path": "topics",
    "minRole": "editor"
  },
  {
    "method": "DELETE",
    "path": "topics/[topicId]",
    "minRole": "editor"
  },
  {
    "method": "PUT",
    "path": "topics/[topicId]",
    "minRole": "editor"
  },
  {
    "method": "DELETE",
    "path": "topics/[topicId]/signals",
    "minRole": "editor"
  },
  {
    "method": "GET",
    "path": "topics/[topicId]/suggestions",
    "minRole": "viewer"
  },
  {
    "method": "GET",
    "path": "topics/stats",
    "minRole": "viewer"
  },
  {
    "method": "GET",
    "path": "topics/transfer",
    "minRole": "viewer"
  },
  {
    "method": "POST",
    "path": "topics/transfer",
    "minRole": "manager"
  },
  {
    "method": "POST",
    "path": "translation/compose",
    "minRole": "editor"
  },
  {
    "method": "POST",
    "path": "translation/test",
    "minRole": "manager"
  }
];
