/** Shared client/server shape of GET/POST …/drafts/scheduled (no server imports). */
export type ScheduledSendView = {
  id: string;
  draftId: string;
  /** UTC epoch ms chosen by the user. */
  sendAt: number;
  status: "queued" | "sending" | "sent" | "failed" | "cancelled";
  attempts: number;
  lastError: string | null;
  scheduledByUserId: string;
};
