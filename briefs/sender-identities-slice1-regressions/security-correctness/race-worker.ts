import { Database } from "bun:sqlite";
const root = process.env.REVIEW_CHECKOUT ?? "/home/monkey/code/noctua-mail/wt-review-collab";
const { withDbWriteRetry } = await import(`${root}/lib/dbWriteRetry.ts`);
const [mode, dbPath, arg1, arg2, latch] = process.argv.slice(2);
const database = new Database(dbPath);
try {
  database.exec("PRAGMA busy_timeout=0");
  console.log("READY");
  if (latch) { const deadline = Date.now() + 10000; while (!(await Bun.file(latch).exists())) { if (Date.now() > deadline) throw new Error("latch timeout"); await Bun.sleep(5); } }
  if (mode === "master") {
    const { initMasterSchema } = await import(`${root}/lib/db/schema.ts`);
    await withDbWriteRetry("review-migrate-master", () => initMasterSchema(database));
    const rows = database.prepare("SELECT id,email FROM sender_identities WHERE accountId='legacy'").all();
    console.log(`RESULT ${JSON.stringify(rows)}`);
  } else if (mode === "shard") {
    const { ensureSenderIdentityMessageRuntimeSchema } = await import(`${root}/lib/db/schema.ts`);
    await withDbWriteRetry("review-migrate-shard", () => ensureSenderIdentityMessageRuntimeSchema(database));
    console.log(`RESULT ${JSON.stringify(database.prepare("SELECT deliveredTo,originalTo,senderIdentityId FROM messages WHERE id='old'").get())}`);
  } else {
    const { createSenderIdentity } = await import(`${root}/lib/senderIdentities.ts`);
    try {
      const identity = await createSenderIdentity(arg1, { email: arg2, displayName: "Synthetic concurrent" }, { userId: process.env.REVIEW_USER_ID! }, database);
      console.log(`RESULT ${JSON.stringify({ status: 201, email: identity.email })}`);
    } catch (error) { if ((error as any).status === 409) console.log(`RESULT ${JSON.stringify({ status: 409, code: (error as any).code })}`); else throw error; }
  }
} finally { database.close(); }
