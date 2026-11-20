import { createWorkerJobRegistry, type WorkerJobRecord } from "./workerJobRegistry";
import { workerScriptPaths } from "./workers/entrypoints";

export type ThreadRecomputeJob = WorkerJobRecord;

const workerConfig = {
  scriptPath: workerScriptPaths.recomputeThreads,
  commandPrefix: ["nice", "-n", "10"],
  spawnStdout: "ignore" as const,
  spawnStderr: "pipe" as const,
  readStderrText: true,
  runtimeMissingMessage: "Bun runtime is required to spawn a recompute worker."
};
// Account-wide rebuilds: one job per mailbox, at most two at once on the host.
const threadRecomputeJobs = createWorkerJobRegistry({
  ...workerConfig, registryName: "thread-recompute", maxConcurrentJobs: 2
});
const identityRecomputeJobs = createWorkerJobRegistry({
  ...workerConfig, registryName: "sender-identity-recompute", maxConcurrentJobs: 2, sharedWorkerBudget: true
});

export const getThreadRecomputeJob = (id: string) => threadRecomputeJobs.getJob(id) ?? identityRecomputeJobs.getJob(id);
export const startThreadRecomputeJob = threadRecomputeJobs.startJob;

/** Identity changes rebuild derived state without changing thread IDs or collaboration ownership. */
export function startIdentityRecomputeJob(accountId: string, invalidate = false) {
  return identityRecomputeJobs.startJob(accountId, ["--identities"], invalidate);
}
export function getIdentityRecomputeJob(accountId: string) {
  return identityRecomputeJobs.getLatestJob(accountId);
}

export const settleIdentityRecomputeAdmission = identityRecomputeJobs.settleJob;

/** Resume durable identity scans left queued by an orderly server shutdown. */
export const resumeIdentityRecomputeJobs = identityRecomputeJobs.resumeJobs;
