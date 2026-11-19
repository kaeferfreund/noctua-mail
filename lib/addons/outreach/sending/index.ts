import { outreachAddonEnabled } from "../config";
import { getOutreachDb } from "../db";
import { cancelContact, enroll } from "./queue";

export { isSesConfigured } from "./send";
export { startOutreachScheduler } from "./scheduler";

/** Enroll new subscriptions once in each live sequence for their list. */
export async function onListSubscribed(accountId: string, event: { listId: string; contactId: string; at: number }): Promise<void> {
  if (!outreachAddonEnabled()) return;
  enroll(await getOutreachDb(), accountId, event);
}

/** Cancel active enrollments and queued sends after loss of consent or suppression. */
export async function onContactUnmailable(accountId: string, contactId: string): Promise<void> {
  if (!outreachAddonEnabled()) return;
  cancelContact(await getOutreachDb(), accountId, contactId, Date.now());
}
