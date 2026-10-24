import { cpSync, rmSync, existsSync } from "node:fs";
import { Database } from "bun:sqlite";
import { WT } from "./seed";

/** Copy the seeded data dir and repoint account shard paths at the copy. */
export function cloneData(name: string) {
  const src = WT + "/.tmp/review/data-diff";
  const dst = WT + "/.tmp/review/" + name;
  if (existsSync(dst)) rmSync(dst, { recursive: true, force: true });
  cpSync(src, dst, { recursive: true });
  const master = new Database(dst + "/db/main.db");
  master.prepare("UPDATE accounts SET dbPath = replace(dbPath, ?, ?)").run(src, dst);
  master.close();
  return dst;
}
