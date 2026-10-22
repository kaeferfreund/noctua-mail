import { createHash } from "crypto";
import type { ImapFlow } from "imapflow";
import type { Account } from "./data";
import { getStoredAccounts, getMailboxState, recordMailboxSync, setMailboxWatcherState, type WatcherState } from "./db";
import { connectIdleImapClient, runImapIdleLoop } from "./mail/imap/idle";
import { getImapConnectBlockedUntil, resetImapConnectFailureState } from "./mail/imapClientOptions";
import { getImapHttpError } from "./mail/imapError";
import { shouldStorePasswordInDb } from "./secret";
import { getSyncJob, startSyncJob, cancelWatcherSyncJobs, type SyncJob } from "./syncJobs";
import { positiveInteger } from "./syncWorkerSemaphore";
import { runNewMailCheck } from "@/app/api/_helpers/newMailCheck";
import { publishMailboxEvent } from "./mailboxWatcherEvents";

const RECONNECT_MIN_MS = 60_000;
const RECONNECT_MAX_MS = 30 * 60_000;

type Entry = {
  account: Account;
  identity: string;
  abort: AbortController;
  state?: WatcherState;
  client?: ImapFlow;
  task: Promise<void>;
  check?: Promise<void>;
  dirty: boolean;
  failures: number;
  nextCheckAt: number;
  nextConnectAt: number;
};

export function watcherAccountIdentity(account: Account) {
  // Compare credentials without retaining another plaintext copy or logging a secret.
  return createHash("sha256").update(JSON.stringify([account.id, account.imap])).digest("hex");
}

export function watcherRetryDelay(failures: number) {
  return Math.min(RECONNECT_MAX_MS, RECONNECT_MIN_MS * 2 ** Math.min(10, Math.max(0, failures - 1)));
}

function pause(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal.aborted) { resolve(); return; }
    const done = () => { clearTimeout(timer); signal.removeEventListener("abort", done); resolve(); };
    const timer = setTimeout(done, Math.max(0, ms));
    signal.addEventListener("abort", done, { once: true });
  });
}

/** One instance per server process. No folder-specific background connections. */
export class MailboxWatcher {
  private entries = new Map<string, Entry>();
  private abort = new AbortController();
  private reloadTask: Promise<void>;
  private intervalMs: number;
  private reloadMs: number;
  private stopping?: Promise<void>;

  constructor() {
    this.intervalMs = positiveInteger(process.env.NOCTUA_WATCHER_INTERVAL_MS, 300_000);
    this.reloadMs = positiveInteger(process.env.NOCTUA_WATCHER_ACCOUNTS_INTERVAL_MS, 30_000);
    this.reloadTask = this.reloadLoop();
  }

  private async state(entry: Entry, next: WatcherState) {
    if (entry.state === next || entry.abort.signal.aborted) return;
    entry.state = next;
    console.info(`[mailbox-watcher] ${entry.account.id}: ${next}`);
    await setMailboxWatcherState(entry.account.id, next);
    publishMailboxEvent({ accountId: entry.account.id, type: "state", watcherState: next });
  }

  private async reloadLoop() {
    while (!this.abort.signal.aborted) {
      try {
        const accounts = await getStoredAccounts();
        if (this.abort.signal.aborted) break;
        const desired = new Map(accounts.map((account) => [account.id, account]));
        for (const [id, entry] of this.entries) {
          const account = desired.get(id);
          if (!account || watcherAccountIdentity(account) !== entry.identity) {
            await this.stopEntry(entry, false);
            this.entries.delete(id);
            // The identity includes the password; only a credential/config change resets the breaker.
            if (account) resetImapConnectFailureState(account);
          }
        }
        for (const account of accounts) {
          if (this.abort.signal.aborted) break;
          if (this.entries.has(account.id)) continue;
          const entry: Entry = {
            account, identity: watcherAccountIdentity(account), abort: new AbortController(),
            task: Promise.resolve(), dirty: false, failures: 0, nextCheckAt: 0, nextConnectAt: 0
          };
          this.entries.set(account.id, entry);
          entry.task = this.watch(entry).catch(() => {
            entry.abort.abort();
            entry.client?.close();
            cancelWatcherSyncJobs(account.id);
            console.error(`[mailbox-watcher] ${account.id}: watcher failed; reloading on next poll`);
            if (this.entries.get(account.id) === entry) this.entries.delete(account.id);
          });
        }
      } catch {
        console.error("[mailbox-watcher] account reload failed; retrying on the next poll");
      }
      await pause(this.reloadMs, this.abort.signal);
    }
  }

  private async waitJob(entry: Entry, job: SyncJob) {
    while (!entry.abort.signal.aborted) {
      const current = getSyncJob(job.id);
      if (!current || current.status === "failed") throw new Error(current?.error || "Sync job disappeared");
      if (current.status === "done") return;
      await pause(100, entry.abort.signal);
    }
    entry.abort.signal.throwIfAborted();
  }

  private requestCheck(entry: Entry) {
    entry.dirty = true;
    if (entry.check || entry.abort.signal.aborted || !entry.client?.usable || Date.now() < entry.nextCheckAt) return;
    entry.check = (async () => {
      // Coalesce event bursts. An event during sync gets one more pass, so no EXISTS is lost.
      while (entry.dirty && !entry.abort.signal.aborted) {
        entry.dirty = false;
        const folderId = `${entry.account.id}:INBOX`;
        const baseline = await getMailboxState(entry.account.id, folderId);
        entry.abort.signal.throwIfAborted();
        const job = startSyncJob({
          accountId: entry.account.id, folderId,
          mode: baseline?.highestUid == null ? "full" : "repair"
        }, undefined, "watcher");
        await this.waitJob(entry, job);
        entry.abort.signal.throwIfAborted();
        const client = entry.client;
        if (!client?.usable) throw new Error("IMAP IDLE connection closed during check");
        const result = await runNewMailCheck(entry.account, entry.account.id, undefined, {
          source: "watcher", signal: entry.abort.signal, client
        });
        if (result.timedOut || result.jobs.some((item) => item.status === "failed")) {
          throw new Error(result.jobs.find((item) => item.error)?.error || "New mail check timed out");
        }
        entry.abort.signal.throwIfAborted();
        await recordMailboxSync(entry.account.id);
        if (Date.now() >= entry.nextConnectAt) entry.failures = 0;
        entry.nextCheckAt = 0;
        publishMailboxEvent({ accountId: entry.account.id, type: "synced" });
      }
    })().catch(async (error: unknown) => {
      if (entry.abort.signal.aborted) return;
      entry.failures += 1;
      const delay = watcherRetryDelay(entry.failures);
      entry.nextCheckAt = Date.now() + delay;
      entry.nextConnectAt = Math.max(entry.nextConnectAt, entry.nextCheckAt);
      try {
        await this.state(entry, getImapHttpError(error) || entry.state === "auth_failed" ? "auth_failed" : "backoff");
      } catch {
        console.error(`[mailbox-watcher] ${entry.account.id}: failed to persist watcher state`);
      } finally {
        entry.client?.close();
      }
    }).finally(() => { entry.check = undefined; });
  }

  private async watch(entry: Entry) {
    const signal = entry.abort.signal;
    await this.state(entry, "starting");
    while (!signal.aborted) {
      const blockedUntil = Math.max(entry.nextConnectAt, getImapConnectBlockedUntil(entry.account));
      if (blockedUntil > Date.now()) {
        await this.state(entry, entry.state === "auth_failed" ? "auth_failed" : "backoff");
        await pause(blockedUntil - Date.now(), signal);
      }
      if (signal.aborted) break;
      entry.nextConnectAt = Date.now() + RECONNECT_MIN_MS;
      let timer: ReturnType<typeof setInterval> | undefined;
      try {
        if (!entry.account.imap.password) throw new Error("No password configured");
        const client = await connectIdleImapClient(entry.account,
          { accountId: entry.account.id, mailbox: "INBOX" }, { singleAttempt: true, signal });
        entry.client = client;
        if (signal.aborted) { client.close(); break; }
        const close = () => client.close();
        signal.addEventListener("abort", close, { once: true });
        try {
          await client.mailboxOpen("INBOX", { readOnly: true });
          signal.throwIfAborted();
          await this.state(entry, "idling");
          const changed = () => this.requestCheck(entry);
          client.on("exists", changed);
          client.on("expunge", changed);
          client.on("flags", changed);
          timer = setInterval(changed, this.intervalMs);
          changed(); // Recover anything missed while disconnected, including initial INBOX bootstrap.
          await runImapIdleLoop(client, signal);
        } finally {
          signal.removeEventListener("abort", close);
        }
        if (!signal.aborted) throw new Error("IMAP IDLE connection closed");
      } catch (error) {
        if (!signal.aborted) {
          entry.failures += 1;
          entry.nextConnectAt = Math.max(entry.nextConnectAt, Date.now() + watcherRetryDelay(entry.failures));
          await this.state(entry, getImapHttpError(error) || entry.state === "auth_failed" ? "auth_failed" : "backoff");
        }
      } finally {
        if (timer) clearInterval(timer);
        entry.client?.close();
        entry.client = undefined;
      }
    }
  }

  private async stopEntry(entry: Entry, persist: boolean) {
    entry.abort.abort();
    entry.client?.close();
    const cancelled = cancelWatcherSyncJobs(entry.account.id);
    await Promise.all([entry.task, entry.check, cancelled]);
    if (persist) await setMailboxWatcherState(entry.account.id, "stopped");
  }

  stop() {
    return this.stopping ??= this.shutdown();
  }

  private async shutdown() {
    this.abort.abort();
    // Abort all entries before awaiting any, including connections still being established.
    const cancelled: Promise<void>[] = [];
    for (const entry of this.entries.values()) {
      entry.abort.abort();
      entry.client?.close();
      cancelled.push(cancelWatcherSyncJobs(entry.account.id));
    }
    await this.reloadTask;
    await Promise.all([
      ...cancelled,
      ...[...this.entries.values()].map((entry) => this.stopEntry(entry, true))
    ]);
    this.entries.clear();
  }
}

const runtime = globalThis as typeof globalThis & {
  __noctuaMailboxWatcher?: MailboxWatcher;
  __noctuaMailboxWatcherShutdown?: () => void;
};
export function startMailboxWatcher(): MailboxWatcher | null {
  // teamFeaturesSupported() from feat/team-auth will use this same credential-storage gate.
  if (process.env.NOCTUA_MAILBOX_WATCHER !== "1" || !shouldStorePasswordInDb()) return null;
  if (runtime.__noctuaMailboxWatcher) return runtime.__noctuaMailboxWatcher;
  const watcher = new MailboxWatcher();
  runtime.__noctuaMailboxWatcher = watcher;
  const shutdown = () => {
    void stopMailboxWatcher().catch(() => { console.error("[mailbox-watcher] shutdown failed"); });
  };
  runtime.__noctuaMailboxWatcherShutdown = shutdown;
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
  return watcher;
}

export async function stopMailboxWatcher() {
  const watcher = runtime.__noctuaMailboxWatcher;
  if (!watcher) return;
  const shutdown = runtime.__noctuaMailboxWatcherShutdown;
  if (shutdown) {
    process.off("SIGTERM", shutdown);
    process.off("SIGINT", shutdown);
    delete runtime.__noctuaMailboxWatcherShutdown;
  }
  await watcher.stop();
  if (runtime.__noctuaMailboxWatcher === watcher) delete runtime.__noctuaMailboxWatcher;
}
