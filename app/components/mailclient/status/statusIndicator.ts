import type { SyncJobProgress } from "../types";

export function syncNeedsAttention(job: SyncJobProgress) {
  return job.phase === "failed" || (job.phase === "retrying" && (job.retryAttempt ?? 0) >= 3);
}

export function resolveStatusIndicator(jobs: SyncJobProgress[], exceptionCount: number, busy: boolean) {
  const attentionCount = exceptionCount + jobs.filter(syncNeedsAttention).length;
  const syncing = busy || jobs.some(job => job.phase !== "done" && job.phase !== "failed");
  return { state: attentionCount > 0 ? "attention" : syncing ? "syncing" : "idle", attentionCount } as const;
}

/** Consume only the calendar import flag; preserve other query parameters and hash. */
export function consumeCalendarOpenRequest(url: string) {
  const parsed = new URL(url);
  if (parsed.searchParams.get("openCalendar") !== "1") return null;
  parsed.searchParams.delete("openCalendar");
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}
