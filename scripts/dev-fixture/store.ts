import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { EventEmitter } from "node:events";
import { createSeed } from "./seed";
import { parseMime, type MimeNode } from "./parser";
export type FixtureMessage = { uid: number; flags: Set<string>; date: Date; mime: MimeNode };
export type Mailbox = { path: string; special?: string; uidValidity: number; uidNext: number; subscribed: boolean; messages: FixtureMessage[] };
export class MailStore extends EventEmitter {
  readonly boxes = new Map<string, Mailbox>();
  constructor(readonly seed = "monkeydent", readonly anchor = new Date(), readonly uidValidityPath = join(process.env.NOCTUA_DATA_DIR ?? ".data", "fixture-uidvalidity.sqlite")) { super(); this.reset(); }
  private nextUidValidity(): number {
    // Persist only this high-water mark, never mailbox contents. SQLite serializes
    // allocations across fixture processes, including restarts in the same second.
    mkdirSync(dirname(this.uidValidityPath), { recursive: true });
    const db = new Database(this.uidValidityPath);
    try {
      db.exec("PRAGMA busy_timeout = 5000");
      db.exec("CREATE TABLE IF NOT EXISTS uid_validity (id INTEGER PRIMARY KEY CHECK (id = 1), value INTEGER NOT NULL CHECK (value BETWEEN 1 AND 4294967295))");
      const row = db.query("INSERT INTO uid_validity (id, value) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET value = MAX(excluded.value, uid_validity.value + 1) RETURNING value").get(Math.floor(Date.now() / 1000)) as { value: number } | null;
      if (!row) throw new Error("Cannot allocate UIDVALIDITY");
      return row.value;
    } finally { db.close(); }
  }
  create(path: string, special?: string) {
    if (this.boxes.has(path)) throw new Error("Mailbox already exists");
    const box: Mailbox = { path, special, uidValidity: this.nextUidValidity(), uidNext: 1, subscribed: true, messages: [] };
    this.boxes.set(path, box);
    return box;
  }
  get(path: string) {
    const box = this.boxes.get(path.toUpperCase() === "INBOX" ? "INBOX" : path);
    if (!box) throw new Error("No such mailbox");
    return box;
  }
  append(path: string, source: Buffer, flags: string[] = [], date = new Date()) {
    const box = this.get(path);
    const message: FixtureMessage = { uid: box.uidNext++, flags: new Set(flags), date, mime: parseMime(source) };
    box.messages.push(message);
    this.emit("exists", box);
    return message;
  }
  expunge(box: Mailbox, predicate: (message: FixtureMessage) => boolean, silentFor?: object) {
    for (let i = box.messages.length - 1; i >= 0; i--) {
      if (!predicate(box.messages[i])) continue;
      box.messages.splice(i, 1);
      this.emit("expunge", box, i + 1, silentFor);
    }
  }
  reset() {
    this.boxes.clear();
    for (const [path, special] of [["INBOX"], ["Sent", "\\Sent"], ["Drafts", "\\Drafts"], ["Trash", "\\Trash"], ["Junk", "\\Junk"], ["Archive", "\\Archive"], ["Projekte"], ["Projekte/Website"]]) this.create(path, special);
    for (const message of createSeed(this.seed, this.anchor)) this.append(message.folder, message.source, message.flags, message.date);
    this.emit("reset");
  }
}
