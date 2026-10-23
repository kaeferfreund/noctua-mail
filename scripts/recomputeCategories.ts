import { runWorker } from "../lib/server/workerLifecycle";
import { installBackendConsoleTimestamps } from "../lib/logging/backendConsole";

installBackendConsoleTimestamps();

const { runCategoryRecomputeCli } = await import("../lib/workers/recomputeCategories");
await runWorker(() => runCategoryRecomputeCli());
