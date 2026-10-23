import { Database } from "bun:sqlite";
import { initAccountSchema } from "../db/schema";
const [file, point] = process.argv.slice(2);
const db: any = new Database(file);
db.exec("PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON");
const exec = db.exec.bind(db);
let guards = 0;
db.exec = (sql: string) => {
  if (point === "before-version" && sql.startsWith("PRAGMA user_version = 3")) process.kill(process.pid, "SIGKILL");
  exec(sql);
  if ((point === "side-table" && sql.startsWith("CREATE TABLE message_fts_identity")) ||
    (point === "population" && sql.startsWith("INSERT INTO message_fts_v3(rowid")) ||
    (point === "guards" && sql.startsWith("CREATE TRIGGER") && ++guards === 81) ||
    (point === "after-version" && sql.startsWith("PRAGMA user_version = 3"))) process.kill(process.pid, "SIGKILL");
};
const result = initAccountSchema(db);
if (point === "after-commit") process.kill(process.pid, "SIGKILL");
console.log(JSON.stringify(result));
db.close();
