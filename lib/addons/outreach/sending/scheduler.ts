import { rows } from "./sql";
import type { Database } from "bun:sqlite";
import { isShuttingDown, onShutdown } from "@/lib/server/shutdown";
import { listSendableRecipients } from "../contacts";
import { getOutreachDb } from "../db";
import { getOutreachSettings } from "../settings";
import { runTrackingRetention } from "../tracking";
import { outreachAddonEnabled } from "../config";
import { outreachAccounts } from "./accounts";
import { sendOwner } from "./lease";
import { assertClaim, claimSend, expandCampaign, expandSequences, finishCampaigns, recoverInterrupted, settleSend, type QueueRow } from "./queue";
import { sendOutreachMail, SendStopped } from "./send";
import { campaignRow, getCampaign, sequenceRow, sequenceStep } from "./store";

const tickMs = 15_000;
const retentionMs = 60 * 60_000;

const defaults = {
  db: getOutreachDb, now: Date.now, recipients: listSendableRecipients, settings: getOutreachSettings,
  send: sendOutreachMail, retention: runTrackingRetention
};

export class OutreachScheduler {
  private readonly owner = sendOwner();
  private timer: ReturnType<typeof setInterval> | undefined;
  private pending: Promise<void> | undefined;
  private stopped = false;
  private nextRetentionAt = 0;
  constructor(private readonly deps: typeof defaults = defaults) {}

  start() {
    if (this.timer || this.stopped) return;
    this.timer = setInterval(() => { void this.tick(); }, tickMs);
    this.timer.unref();
    void this.tick();
  }

  async stop() {
    this.stopped = true;
    clearInterval(this.timer);
    await this.pending;
  }

  tick() {
    if (this.stopped || isShuttingDown()) return Promise.resolve();
    return this.pending ??= this.pass().catch(() => {
      console.warn("[outreach] scheduler pass failed; will retry");
    }).finally(() => { this.pending = undefined; });
  }

  private async pass() {
    const db = await this.deps.db();
    const now = this.deps.now();
    for (const accountId of outreachAccounts(db)) {
      try {
        if (this.stopped || isShuttingDown()) return;
        await this.runAccount(db, accountId, now);
      } catch {
        console.warn("[outreach] mailbox scheduler pass failed; will retry");
      }
    }
    if (!this.stopped && !isShuttingDown() && now >= this.nextRetentionAt) {
      await this.deps.retention(now);
      this.nextRetentionAt = now + retentionMs;
    }
  }

  private async runAccount(db: Database, accountId: string, now: number) {
    recoverInterrupted(db, accountId, now);
    const scheduled = rows<{ id: string }>(db, `SELECT id FROM campaigns
      WHERE accountId = ? AND status = 'scheduled' AND sendAt <= ? ORDER BY sendAt, id`).all(accountId, now);
    for (const row of scheduled) {
      if (this.stopped || isShuttingDown()) return;
      const campaign = getCampaign(db, accountId, row.id);
      expandCampaign(db, campaign, await this.deps.recipients(accountId, campaign), now);
    }
    expandSequences(db, accountId, this.deps.now());
    while (!this.stopped && !isShuttingDown()) {
      const at = this.deps.now();
      const row = claimSend(db, accountId, this.owner, at);
      if (!row) break;
      await this.attempt(db, row);
    }
    finishCampaigns(db, accountId, this.deps.now());
  }

  private async attempt(db: Database, row: QueueRow) {
    const { accountId, campaignId, sequenceId, sequenceStepId, contactId, userId } = row;
    if (!contactId || !userId) {
      settleSend(db, row, { status: "failed", reason: "send_context_missing" }, this.deps.now());
      return;
    }
    const settings = await this.deps.settings(accountId);
    const sequence = sequenceId ? sequenceRow(db, accountId, sequenceId) : null;
    const campaign = campaignId ? campaignRow(db, accountId, campaignId) : null;
    const step = sequence ? sequenceStep(db, accountId, sequence.id, sequenceStepId) : null;
    const item = campaign ?? (step?.enabled ? step : null);
    if (!item) {
      settleSend(db, row, { status: "skipped", reason: "step_changed" }, this.deps.now());
      return;
    }
    const trackOpens = sequence?.trackOpens ?? row.trackOpens;
    const trackClicks = sequence?.trackClicks ?? row.trackClicks;
    if (trackOpens !== row.trackOpens || trackClicks !== row.trackClicks) {
      db.query(`UPDATE sends SET trackOpens = ?, trackClicks = ?
        WHERE accountId = ? AND id = ? AND claimOwner = ? AND status = 'sending'`)
        .run(trackOpens, trackClicks, accountId, row.id, row.claimOwner);
    }
    const outcome = await this.deps.send({
      settings, content: item, sendId: row.id,
      recipient: { contactId, listId: sequence?.triggerListId }, authorization: { scheduledByUserId: userId },
      identityId: campaign?.senderIdentityId ?? sequence?.senderIdentityId ?? null, trackOpens: trackOpens === 1,
      trackClicks: trackClicks === 1, assertClaim: () => {
        assertClaim(db, row, settings, this.deps.now());
        if (sequence) {
          const live = sequenceRow(db, accountId, sequence.id);
          const liveStep = sequenceStep(db, accountId, sequence.id, sequenceStepId);
          if (!live || live.senderIdentityId !== sequence.senderIdentityId || live.trackOpens !== trackOpens
              || live.trackClicks !== trackClicks || JSON.stringify(liveStep) !== JSON.stringify(step)) {
            throw new SendStopped("configuration_changed");
          }
        }
      }
    });
    settleSend(db, row, outcome, this.deps.now());
  }
}

const key = Symbol.for("noctua.outreachScheduler");
const host = globalThis as typeof globalThis & { [key]?: OutreachScheduler };

export function startOutreachScheduler(): void {
  if (!outreachAddonEnabled() || host[key] || isShuttingDown()) return;
  const scheduler = host[key] = new OutreachScheduler();
  // Stop claiming during the stop phase, then wait for the current attempt before closing the DB.
  onShutdown("outreach:scheduler:stop", "stop", () => { void scheduler.stop(); });
  onShutdown("outreach:scheduler:drain", "drain", () => scheduler.stop());
  scheduler.start();
}
