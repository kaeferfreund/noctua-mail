import { describe, expect, test } from "bun:test";
import { AccountNotFoundError } from "@/lib/db";
import { createCollabFixture } from "@/lib/testThreadCollabHarness";
import { existsSync } from "node:fs";
import { getDefaultAccountDbPath } from "@/lib/runtimePaths";
import { APICallError } from "ai";
import { isRetryableSpamError } from "./classifySpam";
import { createSpamClaims, createSpamFailureLogger, createSpamQueue, pickSweepJobs, spamErrorLogFields, SPAM_MAX_ATTEMPTS, type SpamCheckJob } from "./queue";

const job = (messageId: string): SpamCheckJob => ({ accountId: "acc", messageId });

describe("spam queue", () => {
  test("runs at most two checks at once and ignores duplicates", async () => {
    let running = 0;
    let peak = 0;
    const seen: string[] = [];
    const queue = createSpamQueue({
      check: async ({ messageId }) => {
        running += 1; peak = Math.max(peak, running); seen.push(messageId);
        await new Promise((resolve) => setTimeout(resolve, 5));
        running -= 1;
      },
      onFailure: () => { throw new Error("unexpected"); }
    });
    queue.enqueue([job("a"), job("b"), job("c"), job("a")]);
    queue.enqueue([job("b")]);
    await queue.onIdle();
    expect(peak).toBe(2);
    expect(seen.sort()).toEqual(["a", "b", "c"]);
  });

  test("settled resolves when that job is done, also for a job queued by someone else, and at once for an unknown one", async () => {
    const done: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const queue = createSpamQueue({
      check: async ({ messageId }) => { if (messageId === "a") await gate; done.push(messageId); },
      onFailure: () => { throw new Error("unexpected"); }
    });
    queue.enqueue([job("a"), job("b")]);
    // A second enqueue of "a" (the rescan) is ignored, but it can wait for the sweep's run.
    queue.enqueue([job("a")]);
    const settled = queue.settled(job("a")).then(() => [...done]);
    await queue.settled(job("b"));
    expect(done).toEqual(["b"]);
    release();
    expect(await settled).toEqual(["b", "a"]);
    await queue.settled(job("unknown"));
  });

  test("retries a failing check at most twice, then reports it once", async () => {
    let attempts = 0;
    const failures: unknown[] = [];
    const sleeps: number[] = [];
    const queue = createSpamQueue({
      check: async () => { attempts += 1; throw new Error("429 rate limited"); },
      onFailure: (_job, error) => failures.push(error),
      sleep: async (ms) => { sleeps.push(ms); }
    });
    queue.enqueue([job("a")]);
    await queue.onIdle();
    expect(attempts).toBe(3);
    expect(sleeps).toEqual([5_000, 30_000]);
    expect(failures).toHaveLength(1);
    // The job left the queue, so a later enqueue is accepted again.
    expect(queue.has(job("a"))).toBe(false);
  });

  test("errors a retry cannot fix are reported after the first attempt and stored as exhausted", async () => {
    let attempts = 0;
    const failures: unknown[] = [];
    const counts: number[] = [];
    const queue = createSpamQueue({
      check: async () => {
        attempts += 1;
        throw new APICallError({ message: "invalid x-api-key", url: "https://api.example.test", requestBodyValues: {}, statusCode: 401 });
      },
      onFailure: (_job, error) => failures.push(error),
      onAttemptFailed: (_job, failed) => { counts.push(failed); },
      isRetryable: isRetryableSpamError,
      sleep: async () => { throw new Error("must not wait"); }
    });
    queue.enqueue([job("a")]);
    await queue.onIdle();
    expect(attempts).toBe(1);
    expect(failures).toHaveLength(1);
    expect(counts).toEqual([SPAM_MAX_ATTEMPTS]);
  });

  test("failed attempts are reported after each one and earlier ones count against the limit", async () => {
    const counts: Array<[string, number]> = [];
    let attempts = 0;
    const queue = createSpamQueue({
      check: async () => { attempts += 1; throw new Error("overloaded"); },
      onFailure: () => {},
      onAttemptFailed: (entry, failed) => { counts.push([entry.messageId, failed]); },
      sleep: async () => {}
    });
    queue.enqueue([job("fresh")]);
    await queue.onIdle();
    expect(counts).toEqual([["fresh", 1], ["fresh", 2], ["fresh", 3]]);
    counts.length = 0;
    attempts = 0;
    // Two attempts failed before a restart: one attempt is left.
    queue.enqueue([{ ...job("resumed"), failedAttempts: 2 }]);
    await queue.onIdle();
    expect(attempts).toBe(1);
    expect(counts).toEqual([["resumed", 3]]);
  });

  test("a check that recovers on retry is not reported", async () => {
    let attempts = 0;
    let failed = false;
    const queue = createSpamQueue({
      check: async () => { attempts += 1; if (attempts === 1) throw new Error("network"); },
      onFailure: () => { failed = true; },
      sleep: async () => {}
    });
    queue.enqueue([job("a")]);
    await queue.onIdle();
    expect(attempts).toBe(2);
    expect(failed).toBe(false);
  });
});

describe("sweep selection", () => {
  test("claims only the jobs it queues: 120 unchecked → 50 now, the other 70 stay unclaimed", () => {
    let now = 0;
    const claims = createSpamClaims(24 * 60 * 60_000, 20_000, () => now);
    const ids = Array.from({ length: 120 }, (_, index) => `m${index}`);
    const candidates = ids.map((id) => ({ id }));
    const first = pickSweepJobs("acc", candidates, { has: () => false }, claims, 50);
    expect(first.map((entry) => entry.messageId)).toEqual(ids.slice(0, 50));
    expect(ids.filter((id) => claims.isClaimed(job(id)))).toEqual(ids.slice(0, 50));
    // The next sweep (same ids, first 50 still unchecked) takes the next 50; queued ones are skipped.
    const second = pickSweepJobs("acc", candidates, { has: (entry) => entry.messageId === "m50" }, claims, 50);
    expect(second.map((entry) => entry.messageId)).toEqual(ids.slice(51, 101));
    expect(claims.isClaimed(job("m50"))).toBe(false);
    // Claims expire after the TTL.
    now = 24 * 60 * 60_000;
    expect(claims.isClaimed(job("m0"))).toBe(false);
  });
});

describe("spam failure logger", () => {
  test("error fields carry name, code and status, never the message", () => {
    const leak = "Betreff: Geheime Rechnung an anna@example.test";
    const validation = Object.assign(new Error(`Type validation failed: Value: {"reasons":["${leak}"]}`), { name: "AI_TypeValidationError" });
    expect(spamErrorLogFields(validation)).toEqual({ error: "AI_TypeValidationError" });
    const api = new APICallError({ message: leak, url: "https://api.example.test", requestBodyValues: { prompt: leak }, statusCode: 429 });
    expect(spamErrorLogFields(api)).toEqual({ error: "AI_APICallError", status: 429 });
    expect(spamErrorLogFields(Object.assign(new Error(leak), { code: "SQLITE_BUSY" }))).toEqual({ error: "Error", code: "SQLITE_BUSY" });
    expect(spamErrorLogFields(leak)).toEqual({ error: "string" });
    expect(JSON.stringify([validation, api].map(spamErrorLogFields))).not.toContain("Geheime");
  });

  test("logs once per account per 10 minutes", () => {
    let now = 0;
    const lines: string[] = [];
    const log = createSpamFailureLogger((message, details) => lines.push(`${details.accountId}:${message}`), 600_000, () => now);
    expect(log("a", "no key")).toBe(true);
    expect(log("a", "no key")).toBe(false);
    expect(log("b", "no key")).toBe(true);
    now = 599_999;
    expect(log("a", "no key")).toBe(false);
    now = 600_000;
    expect(log("a", "no key")).toBe(true);
    expect(lines).toEqual(["a:[spam] no key", "b:[spam] no key", "a:[spam] no key"]);
  });
});


test("deleted mailbox jobs fail once, failure recording cannot recreate a shard, and the queue continues", async () => {
  const f = await createCollabFixture();
  await f.api.deleteAccountControlPlane(f.accountId);
  let attempts = 0;
  let recorded = 0;
  const recordingErrors: unknown[] = [];
  const failures: unknown[] = [];
  const completed: string[] = [];
  const queue = createSpamQueue({
    concurrency: 1,
    isRetryable: isRetryableSpamError,
    check: async (entry) => {
      if (entry.accountId !== f.accountId) { completed.push(entry.messageId); return; }
      attempts++;
      await f.api.getMessageById(entry.accountId, entry.messageId);
    },
    onAttemptFailed: async (entry, failed) => {
      recorded++;
      try { await f.api.recordSpamCheckFailure(entry.accountId, entry.messageId, failed); }
      catch (error) { recordingErrors.push(error); }
    },
    onFailure: (_entry, error) => { failures.push(error); },
    sleep: async () => { throw new Error("deleted accounts must not wait for a retry"); }
  });
  queue.enqueue([{ accountId: f.accountId, messageId: "deleted-message" }, job("next")]);
  await queue.onIdle();
  expect(attempts).toBe(1);
  expect(recorded).toBe(1);
  expect(recordingErrors).toHaveLength(1);
  expect(recordingErrors[0]).toBeInstanceOf(AccountNotFoundError);
  expect(failures).toHaveLength(1);
  expect(failures[0]).toBeInstanceOf(AccountNotFoundError);
  expect(completed).toEqual(["next"]);
  expect(existsSync(getDefaultAccountDbPath(f.accountId))).toBe(false);
});
