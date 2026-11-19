import { existsSync } from "node:fs";
import { setImmediate, setTimeout } from "node:timers/promises";
import type { Database } from "bun:sqlite";
import { trackBackgroundWork } from "@/lib/server/backgroundWork";
import { outreachPublicOrigin } from "../config";
import { getOutreachDbPath } from "../db";
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

const STATUS_WRITE_TIMEOUT_MS = 15_000;
const STATUS_RETRY_DELAY_MS = 100;

async function updateStatusInBackground(write: () => void) {
  await setImmediate();
  const deadline = performance.now() + STATUS_WRITE_TIMEOUT_MS;
  for (;;) {
    try {
      write();
      return;
    } catch (error) {
      const code = (error as { code?: string } | null)?.code;
      if ((code !== "SQLITE_BUSY" && code !== "SQLITE_LOCKED") || performance.now() >= deadline) {
        console.warn("[outreach] Could not update compose tracking status");
        return;
      }
    }
    await setTimeout(STATUS_RETRY_DELAY_MS);
  }
}

export async function prepareComposeTracking(input: ComposeTrackingInput) {
  try {
    const origin = outreachPublicOrigin();
    if (!origin) return null;
    const path = getOutreachDbPath();
    if (!existsSync(path)) return null;
    const { Database: DatabaseCtor } = await import("bun:sqlite" /* webpackIgnore: true */);
    // An enabled mailbox already has an addon database. A dedicated connection
    // avoids database creation or migration on the compose path, even on a cold process.
    function withComposeDb<T>(write: (db: Database) => T): T {
      const db = new DatabaseCtor(path, { create: false, readwrite: true });
      try {
        db.exec("PRAGMA busy_timeout = 0; PRAGMA foreign_keys = ON;");
        return write(db);
      } finally {
        db.close();
      }
    }

    const sendId = newOutreachId("snd");
    const html = withComposeDb(db => db.transaction(() => {
      const result = db.prepare(`INSERT INTO sends (id, accountId, kind, recipients, messageId, subject, status, userId, queuedAt)
        SELECT ?, accountId, 'mail', ?, ?, ?, 'sending', ?, ? FROM account_settings WHERE accountId = ? AND enabled = 1`)
        .run(sendId, input.recipients, input.messageId, input.subject, input.userId, Date.now(), input.accountId);
      if (!result.changes) return null;
      return rewriteTrackedHtml(db, { ...input, sendId, trackOpens: true, trackClicks: true }, origin);
    }).immediate());
    if (html === null) return null;

    let finished = false;
    return {
      html,
      finish(status: "sent" | "failed") {
        if (finished) return;
        finished = true;
        const sentAt = status === "sent" ? Date.now() : null;
        const done = updateStatusInBackground(() => withComposeDb(db => {
          db.prepare("UPDATE sends SET status = ?, sentAt = ? WHERE accountId = ? AND id = ? AND status = 'sending'")
            .run(status, sentAt, input.accountId, sendId);
        }));
        trackBackgroundWork("outreach:compose-status", done);
      }
    };
  } catch {
    console.warn("[outreach] Could not prepare compose tracking; sending original HTML");
    return null;
  }
}
