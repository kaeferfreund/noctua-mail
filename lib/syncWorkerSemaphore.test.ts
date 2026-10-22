import { describe, expect, test } from "bun:test";
import { positiveInteger, withSyncWorkerTimeout, drainSyncWorkerOutput } from "./syncWorkerSemaphore";

describe("sync worker lifecycle", () => {
  test("timeout waits for confirmed child exit before promoting queued work", async () => {
    let killed = 0;
    let released = false;
    let confirmExit!: (code: number) => void;
    const exited = new Promise<number>(resolve => { confirmExit = resolve; });
    const monitored = withSyncWorkerTimeout(exited, 15, () => { killed++; }).finally(() => { released = true; });
    void monitored.catch(() => {});
    await new Promise(resolve => setTimeout(resolve, 35));
    expect(killed).toBe(1);
    expect(released).toBe(false);
    confirmExit(137);
    await expect(monitored).rejects.toThrow("exit confirmed");
    expect(released).toBe(true);
  });

  test("bounds output draining independently after child exit", async () => {
    let cancelled = false;
    await expect(drainSyncWorkerOutput(new Promise<never>(() => {}), () => { cancelled = true; }, 15))
      .rejects.toThrow("output drain timed out");
    expect(cancelled).toBe(true);
  });

  test("clears the deadline after success and validates configuration", async () => {
    let killed = false;
    expect(await withSyncWorkerTimeout(Promise.resolve(42), 10, () => { killed = true; })).toBe(42);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(killed).toBe(false);
    for (const raw of [undefined, "", "0", "-1", "1.5", "NaN", "9007199254740991"]) expect(positiveInteger(raw, 3)).toBe(3);
    expect(positiveInteger("2", 3)).toBe(2);
  });
});
