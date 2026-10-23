import type { Database } from "bun:sqlite";
import type { OutboundWriteAuthorization } from "./outboundAuthorization";
import { getDb } from "./db/connection";
import { withDbWriteRetry } from "./dbWriteRetry";

// Bun exposes inTransaction at runtime; its current Database declarations omit it.
type ShardDatabase = Database & { readonly inTransaction: boolean };
type OutboundShardWrite = <T>(shard: ShardDatabase, write: () => T, prepare?: () => void) => T;

/**
 * The only cross-database nesting order is shard writer -> master writer.
 * Hold master from the final assertion through shard COMMIT, never while
 * acquiring the shard. No awaits occur inside either transaction. Read-only
 * planning may run under shard exclusion before master acquisition. Staging
 * and async cleanup run outside both locks; retries repeat the whole attempt
 * with a fresh actor, after rolling back both locks (master busy_timeout is 0).
 */
export function withOutboundWrite<T>(
  operation: string,
  beforeWrite: OutboundWriteAuthorization | undefined,
  attempt: (write: OutboundShardWrite) => Promise<T>
): Promise<T> {
  const handshakeErrors = new Set<unknown>();
  return withDbWriteRetry(operation, async () => {
    const master = beforeWrite ? await getDb() : undefined;
    const actor = await beforeWrite?.();
    return attempt((shard, write, prepare) => {
      if (!actor || !master) return shard.transaction(() => { prepare?.(); return write(); }).immediate();
      // Joining an outer transaction cannot guarantee master exclusion through
      // its later commit, and a master owner would invert the lock order.
      if (shard.inTransaction || master.inTransaction) {
        throw new Error("Guarded outbound writes must own their shard and master transactions");
      }
      shard.exec("BEGIN IMMEDIATE");
      try {
        // Read-only planning runs under shard exclusion, before master admission.
        prepare?.();
        try { master.exec("BEGIN IMMEDIATE"); }
        catch (error) { handshakeErrors.add(error); throw error; }
        try {
          actor.assertCurrent(master);
          const result = write();
          shard.exec("COMMIT");
          return result;
        } finally {
          // This transaction has no master writes. Release it immediately after
          // shard commit (or failure), without another await or write phase.
          master.exec("ROLLBACK");
        }
      } finally {
        if (shard.inTransaction) shard.exec("ROLLBACK");
      }
    });
  }, { handshakeRetry: error => handshakeErrors.delete(error) });
}
