import { EventEmitter } from "node:events";
import { createSeed } from "./seed";
import { parseMime, type MimeNode } from "./parser";
export type FixtureMessage = { uid: number; flags: Set<string>; date: Date; mime: MimeNode };
export type Mailbox = { path: string; special?: string; uidValidity: number; uidNext: number; subscribed: boolean; messages: FixtureMessage[] };
export class MailStore extends EventEmitter {
  readonly boxes = new Map<string, Mailbox>();
  private generation = 1700000000;
  constructor(readonly seed = "monkeydent", readonly anchor = new Date()) { super(); this.reset(); }
  create(path: string, special?: string) {
    if (this.boxes.has(path)) throw new Error("Mailbox already exists");
    const box: Mailbox = { path, special, uidValidity: this.generation++, uidNext: 1, subscribed: true, messages: [] };
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
