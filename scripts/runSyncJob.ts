import { runWorker } from "../lib/server/workerLifecycle";
import { installBackendConsoleTimestamps } from "../lib/logging/backendConsole";

installBackendConsoleTimestamps();

const { runSyncJobCli } = await import("../lib/workers/runSyncJob");
await runWorker(() => runSyncJobCli());
