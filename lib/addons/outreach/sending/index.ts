/**
 * Sending area (owner: sending task): templates, campaigns, sequences, transport, scheduler.
 * Public surface used by the other areas and by the core seams.
 * The signatures are the contract; the bodies below are placeholders of the base branch.
 */

/** SES is usable: region and credentials are present in the environment (never stored in the database). */
export function isSesConfigured(env: Record<string, string | undefined> = process.env): boolean {
  void env;
  return false;
}

/** A contact was subscribed to a list: enroll it once in every `live` sequence triggered by that list. */
export async function onListSubscribed(accountId: string, event: { listId: string; contactId: string; at: number }): Promise<void> {
  void accountId; void event;
}

/** A contact unsubscribed, was suppressed or erased: cancel its active enrollments and queued sends. */
export async function onContactUnmailable(accountId: string, contactId: string): Promise<void> {
  void accountId; void contactId;
}

/** Started once per server process from instrumentation.ts, only when the addon flag is on. */
export function startOutreachScheduler(): void {}
