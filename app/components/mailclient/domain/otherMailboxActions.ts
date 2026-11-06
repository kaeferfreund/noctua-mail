import type { MessageMenuAction } from "../message/MessageMenu";
import type { MessageQuickAction } from "../message/MessageQuickActions";

/**
 * Actions on a message of another mailbox shown next to the active one's (a
 * conversation merged across the domain, or a row of the domain view). Read
 * state, flags and to-dos go to that message's mailbox. Replies and forwards are
 * written from the active mailbox inside one mailbox; in the domain view they open
 * the message in its own mailbox first (MailClient openCompose). Everything that depends on the mailbox's
 * folders, topics, drafts or ids (move, delete, archive, spam, topics, source)
 * is done in the message's own mailbox, which its mailbox badge opens.
 */
export const OTHER_MAILBOX_MENU_VISIBILITY: Partial<Record<MessageMenuAction, boolean>> = {
  editDraft: false,
  sendDraft: false,
  scheduleDraft: false,
  discardDraft: false,
  aiReply: false,
  editAsNew: false,
  answered: false,
  spam: false,
  archive: false,
  category: false,
  moveTo: false,
  copyToAccount: false,
  moveToAccount: false,
  delete: false,
  unsubscribe: false,
  showRelated: false,
  showThread: false,
  topics: false,
  openWindow: false,
  openHtmlWindow: false,
  downloadEml: false,
  resync: false
};

export const OTHER_MAILBOX_QUICK_ACTION_VISIBILITY: Partial<Record<MessageQuickAction, boolean>> = {
  editDraft: false,
  sendDraft: false,
  scheduleDraft: false,
  aiReply: false,
  showRelated: false,
  delete: false
};
