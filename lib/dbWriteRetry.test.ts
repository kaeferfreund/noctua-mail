import { expect, jest, spyOn, test } from "bun:test";
import { withDbWriteRetry } from "./dbWriteRetry";

test("locked writes retain five attempts and 120/240/480/960ms delays outside shutdown", async () => {
  jest.useFakeTimers();
  const random = spyOn(Math, "random").mockReturnValue(0.5);
  const times: number[] = [];
  const start = Date.now();
  try {
    const result = withDbWriteRetry("synthetic-budget", () => {
      times.push(Date.now() - start);
      if (times.length < 5) throw new Error("SQLITE_BUSY");
      return 42;
    });
    for (const delay of [120, 240, 480, 960]) {
      jest.advanceTimersByTime(delay);
      await Promise.resolve();
    }
    expect(await result).toBe(42);
    expect(times).toEqual([0, 120, 360, 840, 1800]);
    expect(jest.getTimerCount()).toBe(0);
  } finally { random.mockRestore(); jest.useRealTimers(); }
});

test("SIGTERM cancels an actual worker's 1500ms DB retry sleep", async () => {
  const child = Bun.spawn([process.execPath, "--eval", `
    import {runWorker} from './lib/server/workerLifecycle';
    import {withDbWriteRetry} from './lib/dbWriteRetry';
    Math.random=()=>0.5;
    await runWorker(async()=>{await withDbWriteRetry('synthetic-cancel',()=>{throw Error('SQLITE_BUSY')},{baseDelayMs:1500});});
  `], { stdout: "pipe", stderr: "pipe" });
  let output = "";
  const stdout = new Response(child.stdout).text();
  const stderr = (async () => { for await (const chunk of child.stderr) output += Buffer.from(chunk).toString(); })();
  const fallback = setTimeout(() => child.kill("SIGKILL"), 5000);
  try {
    const deadline = Date.now() + 3000;
    while (!output.includes("delayMs: 1500") && child.exitCode === null && Date.now() < deadline) await Bun.sleep(5);
    expect(output).toContain("delayMs: 1500");
    // The retry log precedes workerPause in the same turn; allow its timer to start.
    await Bun.sleep(20);
    const start = performance.now();
    child.kill("SIGTERM");
    expect(await child.exited).toBe(0);
    const durationMs = Math.round(performance.now() - start);
    expect(durationMs).toBeLessThan(500);
    await stderr; await stdout;
    console.info("retry shutdown proof", { durationMs, delayMs: 1500 });
  } finally {
    clearTimeout(fallback);
    if (child.exitCode === null) { child.kill("SIGKILL"); await child.exited; }
    await stderr; await stdout;
  }
});

for (const [handshake, afterCoarse] of [[true, false], [false, false], [true, true]]) {
  test(`retry policy bounds ${handshake ? afterCoarse ? "control-plane acquisition" : "handshake" : "ordinary write"} attempts and falls back to the original coarse schedule`, async () => {
    jest.useFakeTimers();
    const random = spyOn(Math, "random").mockReturnValue(0.5);
    const times: number[] = [];
    const started = Date.now();
    const error = Object.assign(new Error("Synthetic busy"), { code: "SQLITE_BUSY" });
    try {
      const result = withDbWriteRetry("synthetic bounded retries", () => {
        times.push(Date.now() - started);
        throw error;
      }, { handshakeRetry: () => handshake, handshakeRetryAfterCoarse: afterCoarse }).catch(caught => caught);
      const shortDelays = handshake ? [1, 2, 4, ...Array(13).fill(8)] : [];
      const coarseDelays = [120, 240, 480, 960];
      const delays = afterCoarse ? [...coarseDelays, ...shortDelays] : [...shortDelays, ...coarseDelays];
      for (const delay of delays) {
        await Promise.resolve();
        jest.advanceTimersByTime(delay);
        await Promise.resolve();
      }
      expect(await result).toBe(error);
      expect(times.length).toBe(handshake ? 21 : 5);
      expect(times.at(-1)).toBe(delays.reduce((sum, delay) => sum + delay, 0));
      expect(jest.getTimerCount()).toBe(0);
    } finally { random.mockRestore(); jest.useRealTimers(); }
  });
}

test("handshake wall budget includes preparation, and retries never mask a non-BUSY denial", async () => {
  jest.useFakeTimers();
  const random = spyOn(Math, "random").mockReturnValue(0.5);
  try {
    let attempts = 0;
    const busy = new Error("SQLITE_BUSY");
    const result = withDbWriteRetry("synthetic elapsed budget", () => {
      attempts++;
      jest.advanceTimersByTime(1_100);
      throw busy;
    }, { handshakeRetry: () => true }).catch(error => error);
    jest.advanceTimersByTime(1);
    await Promise.resolve();
    expect(await result).toBe(busy);
    expect(attempts).toBe(2);
    let denied = 0;
    await expect(withDbWriteRetry("synthetic denial", () => {
      denied++; throw new Error("Forbidden");
    }, { handshakeRetry: () => true })).rejects.toThrow("Forbidden");
    expect(denied).toBe(1);
  } finally { random.mockRestore(); jest.useRealTimers(); }
});
