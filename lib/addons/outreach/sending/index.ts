import type { Database } from "bun:sqlite";
import { outreachAddonEnabled } from "../config";
import { getOutreachDb } from "../db";
import { cancelContact, enroll } from "./queue";

export { isSesConfigured } from "./send";
export { startOutreachScheduler } from "./scheduler";

/** Enroll within the same transaction that makes the subscription durable. */
export function enrollListSubscription(db: Database, accountId: string, event: { listId: string; contactId: string; at: number }): void {
  if (outreachAddonEnabled()) enroll(db, accountId, event);
}

/** Compatibility hook for callers without an open database handle. */
export async function onListSubscribed(accountId: string, event: { listId: string; contactId: string; at: number }): Promise<void> {
  if (!outreachAddonEnabled()) return;
  enrollListSubscription(await getOutreachDb(), accountId, event);
}

/** Cancel active enrollments and queued sends after loss of consent or suppression. */
export async function onContactUnmailable(accountId: string, contactId: string): Promise<void> {
  if (!outreachAddonEnabled()) return;
  cancelContact(await getOutreachDb(), accountId, contactId, Date.now());
}
