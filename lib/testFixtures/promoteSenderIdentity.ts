// Synthetic concurrent-writer fixture invoked only by senderIdentities.test.ts.
import { Database } from "bun:sqlite";
import { setDefaultSenderIdentity } from "../senderIdentities";
const [dbPath, accountId, userId, identityId] = process.argv.slice(2);
const db = new Database(dbPath);
db.exec("PRAGMA busy_timeout=0");
try { await setDefaultSenderIdentity(accountId, identityId, { userId }, db); }
finally { db.close(); }
