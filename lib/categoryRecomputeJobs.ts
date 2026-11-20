import { createWorkerJobRegistry, type WorkerJobRecord } from "./workerJobRegistry";
import { workerScriptPaths } from "./workers/entrypoints";

export type CategoryRecomputeJob = WorkerJobRecord;

const categoryRecomputeJobs = createWorkerJobRegistry({
  // Account-wide rebuilds: one job per mailbox, at most two at once on the host.
  registryName: "category-recompute",
  maxConcurrentJobs: 2,
  scriptPath: workerScriptPaths.recomputeCategories,
  spawnStdout: "inherit",
  spawnStderr: "inherit",
  readStderrText: false,
  runtimeMissingMessage: "Bun runtime is required to spawn a recompute worker."
});

export const getCategoryRecomputeJob = categoryRecomputeJobs.getJob;
export const startCategoryRecomputeJob = categoryRecomputeJobs.startJob;
