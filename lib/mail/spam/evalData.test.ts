import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { openReadOnly, selectEvalItems } from "./evalData";

describe("eval data dir access", () => {
  test("a read-only open sees rows a live writer has not checkpointed yet and never writes", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "spam-eval-ro-"));
    const file = path.join(dir, "shard.db");
    const writer = new Database(file);
    try {
      writer.exec("PRAGMA journal_mode = WAL; PRAGMA wal_autocheckpoint = 0; CREATE TABLE messages (id TEXT)");
      const insert = writer.prepare("INSERT INTO messages (id) VALUES (?)");
      for (let index = 0; index < 50; index += 1) insert.run(`m${index}`);
      const reader = openReadOnly(file);
      try {
        expect(reader.prepare("SELECT COUNT(*) AS n FROM messages").get()).toEqual({ n: 50 });
        insert.run("later");
        expect(reader.prepare("SELECT COUNT(*) AS n FROM messages").get()).toEqual({ n: 51 });
        expect(() => reader.exec("INSERT INTO messages (id) VALUES ('x')")).toThrow();
      } finally { reader.close(); }
    } finally {
      writer.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("eval sample selection", () => {
  const items = [
    ...Array.from({ length: 300 }, (_, index) => ({ id: `s${index}`, label: "spam" as const })),
    ...Array.from({ length: 900 }, (_, index) => ({ id: `h${index}`, label: "ham" as const }))
  ];
  const count = (selected: typeof items, label: "spam" | "ham") => selected.filter((item) => item.label === label).length;

  test("--limit takes a seeded random sample that keeps both labels, not the spam-first head", () => {
    const selected = selectEvalItems(items, 200, false);
    expect(selected).toHaveLength(200);
    expect(count(selected, "ham")).toBeGreaterThan(100);
    expect(count(selected, "spam")).toBeGreaterThan(20);
    expect(selectEvalItems(items, 200, false)).toEqual(selected);
  });

  test("--stratified takes half of each label; no limit keeps everything in order", () => {
    const selected = selectEvalItems(items, 100, true);
    expect([count(selected, "spam"), count(selected, "ham")]).toEqual([50, 50]);
    expect(selected.slice(0, 5).map((item) => item.id)).not.toEqual(["s0", "s1", "s2", "s3", "s4"]);
    expect(selectEvalItems(items, 0, false)).toEqual(items);
  });
});
