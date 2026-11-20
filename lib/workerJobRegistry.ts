import { createBoundedWorkerJobRegistry } from "./boundedWorkerJobRegistry";

export type WorkerJobStatus = "queued" | "running" | "done" | "failed";

export type WorkerJobRecord = {
  id: string;
  accountId: string;
  status: WorkerJobStatus;
  startedAt: number;
  finishedAt?: number;
  error?: string;
  pid?: number;
};

export type WorkerJobRegistryConfig = {
  /** Global cap on running workers of this registry; each mailbox also has at most one active job. */
  maxConcurrentJobs: number;
  sharedWorkerBudget?: boolean;
  registryName?: string;
  scriptPath: string;
  jobTtlMs?: number;
  spawnStdout?: "pipe" | "inherit" | "ignore";
  spawnStderr?: "pipe" | "inherit" | "ignore";
  readStderrText?: boolean;
  runtimeMissingMessage?: string;
  commandPrefix?: string[];
};

/** Every worker registry is bounded: one active job per mailbox (repeat starts
 * coalesce onto it) and at most `maxConcurrentJobs` workers at once. */
export function createWorkerJobRegistry(config: WorkerJobRegistryConfig) {
  return createBoundedWorkerJobRegistry(config);
}
