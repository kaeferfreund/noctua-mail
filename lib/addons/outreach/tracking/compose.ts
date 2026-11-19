import { outreachPublicOrigin } from "../config";
import { getOutreachDb } from "../db";
import { newOutreachId } from "../ids";
import { rewriteTrackedHtml } from "./rewrite";

type ComposeTrackingInput = {
  accountId: string;
  userId: string;
  messageId: string;
  recipients: string;
  subject: string;
  html: string;
};

export async function prepareComposeTracking(input: ComposeTrackingInput) {
  try {
    const origin = outreachPublicOrigin();
    if (!origin) return null;
    const db = await getOutreachDb();
    const sendId = newOutreachId("snd");
    const html = db.transaction(() => {
      const result = db.prepare(`INSERT INTO sends (id, accountId, kind, recipients, messageId, subject, status, userId, queuedAt)
        SELECT ?, accountId, 'mail', ?, ?, ?, 'sending', ?, ? FROM account_settings WHERE accountId = ? AND enabled = 1`)
        .run(sendId, input.recipients, input.messageId, input.subject, input.userId, Date.now(), input.accountId);
      if (!result.changes) return null;
      return rewriteTrackedHtml(db, { ...input, sendId, trackOpens: true, trackClicks: true }, origin);
    }).immediate();
    if (html === null) return null;

    return {
      html,
      finish(status: "sent" | "failed") {
        try {
          db.prepare("UPDATE sends SET status = ?, sentAt = ? WHERE accountId = ? AND id = ? AND status = 'sending'")
            .run(status, status === "sent" ? Date.now() : null, input.accountId, sendId);
        } catch {
          console.warn("[outreach] Could not update compose tracking status");
        }
      }
    };
  } catch {
    console.warn("[outreach] Could not prepare compose tracking; sending original HTML");
    return null;
  }
}
