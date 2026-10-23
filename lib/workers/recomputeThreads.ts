import { isWorkerStopping } from "../server/workerLifecycle";
import { bindWorkerProcess } from "../db/processLeases";
import { recomputeThreadIdsForAccount, recomputeThreadsForAccount } from "@/lib/db";

export async function runThreadRecomputeCli(argv = process.argv) {
  const accountId = argv[2];

  if (!accountId) {
    console.error("Missing accountId argument.");
    process.exit(1);
  }

  try {
    const lease = argv.indexOf("--worker-lease");
    if (lease !== -1 && !await bindWorkerProcess(argv[lease + 1], argv[lease + 2])) {
      throw new Error("Recompute worker lease lost before startup");
    }
    if (!argv.includes("--identities")) await recomputeThreadIdsForAccount(accountId);
    await recomputeThreadsForAccount(accountId);
  } catch (error) {
      if (isWorkerStopping()) return;
    console.error(
      error instanceof Error ? error.message : "Thread recompute failed."
    );
    process.exit(1);
  }
}
