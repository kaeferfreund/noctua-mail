import { expect, spyOn, test } from "bun:test";
import "./testDbHarness";
import { getThreadRecomputeJob, startThreadRecomputeJob } from "./threadRecomputeJobs";
import { getCategoryRecomputeJob, startCategoryRecomputeJob } from "./categoryRecomputeJobs";

const tick = () => new Promise(resolve => setTimeout(resolve, 10));

test.each([
  ["thread", startThreadRecomputeJob, getThreadRecomputeJob],
  ["category", startCategoryRecomputeJob, getCategoryRecomputeJob]
] as const)("%s recompute: one job per mailbox and at most two workers at once", async (_name, start, get) => {
  const exits: Array<(code: number) => void> = [];
  const spawn = spyOn(Bun, "spawn").mockImplementation(() => ({ pid: process.pid,
    exited: new Promise<number>(resolve => exits.push(resolve)), stderr: null }) as never);
  const [a, b, c] = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
  try {
    const first = start(a);
    // Repeated starts for the same mailbox join the active job instead of spawning.
    expect(start(a).id).toBe(first.id);
    expect(start(a).id).toBe(first.id);
    const second = start(b);
    const third = start(c);
    expect([first.status, second.status, third.status]).toEqual(["running", "running", "queued"]);
    expect(spawn).toHaveBeenCalledTimes(2);
    exits[0](0); await tick();
    expect(get(third.id)?.status).toBe("running");
    expect(spawn).toHaveBeenCalledTimes(3);
  } finally { exits.forEach(exit => exit(0)); await tick(); spawn.mockRestore(); }
});
