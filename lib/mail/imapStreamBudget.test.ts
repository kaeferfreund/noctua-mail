import { describe, expect, test } from "bun:test";
import { DEFAULT_IMAP_STREAM_MAX_IDLE, DEFAULT_IMAP_STREAM_POLL_MS, resolveImapStreamBudget } from "./imapStreamBudget";

describe("IMAP stream budget", () => {
  test("defaults apply without mailbox settings", () => {
    expect(resolveImapStreamBudget(undefined)).toEqual({
      maxIdleSessions: DEFAULT_IMAP_STREAM_MAX_IDLE, pollIntervalMs: DEFAULT_IMAP_STREAM_POLL_MS
    });
  });

  test("stored settings stay inside fixed bounds", () => {
    expect(resolveImapStreamBudget({ maxIdleSessions: 999, backgroundPollIntervalMs: 1 }))
      .toEqual({ maxIdleSessions: 8, pollIntervalMs: 60_000 });
    expect(resolveImapStreamBudget({ maxIdleSessions: 5, pollIntervalMs: 120_000 }))
      .toEqual({ maxIdleSessions: 5, pollIntervalMs: 120_000 });
    expect(resolveImapStreamBudget({ maxIdleSessions: Number.POSITIVE_INFINITY, backgroundPollIntervalMs: 1e15 }))
      .toEqual({ maxIdleSessions: DEFAULT_IMAP_STREAM_MAX_IDLE, pollIntervalMs: 24 * 60 * 60 * 1000 });
    expect(resolveImapStreamBudget({ maxIdleSessions: -2, backgroundPollIntervalMs: Number.NaN }))
      .toEqual({ maxIdleSessions: DEFAULT_IMAP_STREAM_MAX_IDLE, pollIntervalMs: DEFAULT_IMAP_STREAM_POLL_MS });
  });
});
