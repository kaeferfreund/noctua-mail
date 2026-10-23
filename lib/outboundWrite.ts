import type { OutboundWriteAuthorization } from "./outboundAuthorization";
import { getDb } from "./db/connection";

/** Hold the master writer through shard commit; consume inside the shard transaction. */
export async function prepareOutboundWrite(beforeWrite?: OutboundWriteAuthorization) {
  const db = beforeWrite ? await getDb() : undefined;
  const actor = await beforeWrite?.();
  return <T>(write: (assertCurrent: () => void) => T): T => {
    if (!actor || !db) return write(() => {});
    return db.transaction(() => {
      return write(() => actor.assertCurrent(db));
    }).immediate();
  };
}
