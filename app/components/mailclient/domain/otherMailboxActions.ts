import type { MessageMenuAction } from "../message/MessageMenu";
import type { MessageQuickAction } from "../message/MessageQuickActions";

/**
 * Actions on a message of another mailbox shown next to the active one's (a
 * conversation merged across the domain, or a row of the domain view). Every
 * action is done in that message's own mailbox, through its routes, which the
 * server authorises per mailbox: read state, flags, to-dos, answered, move
 * (with its folders), delete (its trash), archive, spam, category, topics (its
 * catalog), copies, source, resync, sending and discarding its drafts.
 * Replies, forwards and editing a draft open the message in its own mailbox
 * first in the domain view (MailClient openCompose).
 *
 * Still hidden, with the reason:
 * - scheduleDraft: scheduled sending is loaded and run for the active mailbox only;
 * - aiReply: writes the reply draft in the active mailbox's compose;
 * - showRelated / showThread: search the active mailbox.
 */
export const OTHER_MAILBOX_MENU_VISIBILITY: Partial<Record<MessageMenuAction, boolean>> = {
  scheduleDraft: false,
  aiReply: false,
  showRelated: false,
  showThread: false
};

export const OTHER_MAILBOX_QUICK_ACTION_VISIBILITY: Partial<Record<MessageQuickAction, boolean>> = {
  scheduleDraft: false,
  aiReply: false,
  showRelated: false
};
