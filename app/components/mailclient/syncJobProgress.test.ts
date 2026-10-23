import { describe, expect, test } from "bun:test";
import type { SyncJobProgress } from "./types";
import { detectSyncEscalation, normalizeSyncJobProgress, recordSyncProgress, retainSyncFailure } from "./syncJobProgress";

describe("detectSyncEscalation", () => {
  test("returns false when the modes match", () => {
    expect(
      detectSyncEscalation({
        requestedMode: "recent",
        progressMode: "recent",
        alreadyLogged: false
      })
    ).toBe(false);
  });

  test("returns true on the first observed mode mismatch", () => {
    expect(
      detectSyncEscalation({
        requestedMode: "recent",
        progressMode: "repair",
        alreadyLogged: false
      })
    ).toBe(true);
  });

  test("returns false once we have already logged for this job", () => {
    expect(
      detectSyncEscalation({
        requestedMode: "recent",
        progressMode: "full",
        alreadyLogged: true
      })
    ).toBe(false);
  });

  test("returns false when either mode is missing", () => {
    expect(
      detectSyncEscalation({
        requestedMode: undefined,
        progressMode: "full",
        alreadyLogged: false
      })
    ).toBe(false);
    expect(
      detectSyncEscalation({
        requestedMode: "recent",
        progressMode: undefined,
        alreadyLogged: false
      })
    ).toBe(false);
  });
});

const baseProgress = {
  accountId: "account-1",
  mailboxPath: "INBOX",
  phase: "fetching",
  processed: 0
} satisfies Pick<SyncJobProgress, "accountId" | "mailboxPath" | "phase" | "processed">;

describe("normalizeSyncJobProgress", () => {
  test("stamps the jobId onto the progress blob", () => {
    const progress = normalizeSyncJobProgress({
      progress: { ...baseProgress, mode: "recent", updatedAt: 42 },
      jobId: "job-1"
    });
    expect(progress.jobId).toBe("job-1");
    expect(progress.updatedAt).toBe(42);
  });

  test("fills missing updatedAt with the caller-supplied clock", () => {
    const progress = normalizeSyncJobProgress({
      progress: { ...baseProgress, mode: "recent" },
      jobId: "job-2",
      now: 1234
    });
    expect(progress.updatedAt).toBe(1234);
  });

  test("preserves other fields verbatim", () => {
    const progress = normalizeSyncJobProgress({
      progress: { ...baseProgress, mode: "full", folderId: "inbox", updatedAt: 1 },
      jobId: "job-3"
    });
    expect(progress.mode).toBe("full");
    expect(progress.folderId).toBe("inbox");
  });
});

// Failure retention is separate from completion: the header must keep offering
// Retry after the poll loop exits, and unrelated jobs must not clear its badge.
describe("actionable sync failures", () => {
  const failed: SyncJobProgress = { jobId: "old", accountId: "a", folderId: "a:INBOX", mailboxPath: "INBOX", mode: "new", phase: "failed", processed: 20, percent: 25, updatedAt: 1 };
  test("retains structured progress on failure and supplies a scope before the first sample", () => {
    const fallback = { ...failed, processed: 0, updatedAt: 2 };
    expect(retainSyncFailure({ old: failed }, fallback).old).toEqual({ ...failed, updatedAt: 2 });
    expect(retainSyncFailure({}, fallback).old).toEqual(fallback);
  });
  test("clears only a superseded failure in the same account/folder", () => {
    const other = { ...failed, jobId: "other", accountId: "b" };
    const active = { ...failed, jobId: "active", phase: "fetching" as const };
    const replacement = { ...failed, jobId: "replacement", phase: "starting" as const };
    expect(recordSyncProgress({ old: failed, other, active }, replacement)).toEqual({ other, active, replacement });
    expect(recordSyncProgress({ old: failed }, { ...replacement, folderId: "a:Archive" }).old).toEqual(failed);
  });
});
