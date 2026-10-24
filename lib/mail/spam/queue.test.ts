import { describe, expect, test } from "bun:test";
import { createSpamFailureLogger, createSpamQueue, type SpamCheckJob } from "./queue";

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

describe("spam failure logger", () => {
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
