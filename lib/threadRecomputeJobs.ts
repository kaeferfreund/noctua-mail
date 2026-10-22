import { createWorkerJobRegistry, type WorkerJobRecord } from "./workerJobRegistry";
import { workerScriptPaths } from "./workers/entrypoints";

export type ThreadRecomputeJob = WorkerJobRecord;

const threadRecomputeJobs = createWorkerJobRegistry({
  scriptPath: workerScriptPaths.recomputeThreads,
  commandPrefix: ["nice", "-n", "10"],
  spawnStdout: "ignore",
  spawnStderr: "pipe",
  readStderrText: true,
  runtimeMissingMessage: "Bun runtime is required to spawn a recompute worker."
});

export const getThreadRecomputeJob = threadRecomputeJobs.getJob;
export const startThreadRecomputeJob = threadRecomputeJobs.startJob;

/** Identity changes rebuild derived state without changing thread IDs or collaboration ownership. */
const identityRecomputeJobs = new Map<string, string>();
export function startIdentityRecomputeJob(accountId: string) {
  const job = threadRecomputeJobs.startJob(accountId, ["--identities"]);
  identityRecomputeJobs.set(accountId, job.id);
  return job;
}
export function getIdentityRecomputeJob(accountId: string) {
  const id = identityRecomputeJobs.get(accountId);
  return id ? threadRecomputeJobs.getJob(id) : null;
}
