// Reuse the enrolled two-person shell fixture; all material stays in .tmp.
import { getDb, closeAllDbConnections } from "../../../lib/db/connection";
import { insertUserAccountLinkRow } from "../../../lib/db/users";
if (!process.env.COMPOSE_QA_SEED_FILE) throw new Error("COMPOSE_QA_SEED_FILE is required");
await import("../ui/seedQaShell");
const people = await Bun.file(process.env.QA_SHELL_SEED_FILE!).json();
const db = await getDb();
insertUserAccountLinkRow(db, people[1].id, "qa-shared", "editor");
await Bun.write(process.env.COMPOSE_QA_SEED_FILE, JSON.stringify({ ...people[0], accountId: "qa-shared", other: people[1] }));
closeAllDbConnections();
