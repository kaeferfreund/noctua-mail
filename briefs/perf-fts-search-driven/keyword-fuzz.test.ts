import { beforeAll, expect, spyOn, test } from "bun:test";
import { createSharedShardFixture } from "../../testSharedShardHarness";
import { listMessages, listThreads } from "./query";

let accountId = "";
beforeAll(async () => {
  const fixture = await createSharedShardFixture();
  const a = fixture.a;
  await a.api.saveFoldersForAccount(a.accountId, [{ id: "inbox", accountId: a.accountId, name: "INBOX", count: 0, specialUse: "\\Inbox" }]);
  await a.api.upsertMessages(a.accountId, null, [
    a.message("t1", { id: "m1", messageId: "<m1@example.test>", folderId: "inbox", subject: "NOT and OR near Grüße", body: "needle x-y a_b", dateValue: 1, date: new Date(1).toISOString() })
  ]);
  accountId = a.accountId;
});

const pieces = ['"', "*", "^", ":", "(", ")", "-", "+", ".", ",", "'", "/", "\\", "_", "~", "&", "|", "!", "?", "#", "$", "%", "@", "[", "]", "{", "}", "<", ">", "=", ";",
  "a", "Z", "ü", "É", "ß", "1", "²", "½", "́", "‍", "\u001a", "😀", "Ａ", "中", "NOT", "AND", "OR", "NEAR", "not", "And", "oR", "nEaR",
  "subject", "body", "NEAR(", "from:", "in:", "thread:", "topic:", " ", "　"];
let seed = 12345;
const rnd = (n: number) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };

test("fuzz", async () => {
  const failures = new Map<string, string[]>();
  const warn = spyOn(console, "warn").mockImplementation(() => {});
  const cases: string[] = [];
  for (const p of pieces) cases.push(p, `${p}x`, `x${p}`, `x${p}y`, `needle ${p}`);
  for (let i = 0; i < 4000; i++) {
    const tokens = Array.from({ length: 1 + rnd(3) }, () => Array.from({ length: 1 + rnd(4) }, () => pieces[rnd(pieces.length)]).join(""));
    cases.push(tokens.join(" "));
  }
  for (const q of cases) {
    for (const fields of [undefined, ["subject"], ["subject", "body"], ["attachments"]]) {
      for (const mode of ["legacy", "driven"]) {
        if (mode === "legacy") process.env.NOCTUA_DISABLE_FTS_DRIVEN_SEARCH = "1"; else delete process.env.NOCTUA_DISABLE_FTS_DRIVEN_SEARCH;
        warn.mockClear();
        try {
          await listMessages({ accountId, page: 1, pageSize: 5, query: q, fields } as any);
          await listThreads({ accountId, page: 1, pageSize: 5, query: q, fields } as any);
        } catch (e: any) {
          const key = `${mode}:${e.code}:${e.message}`;
          failures.set(key, [...(failures.get(key) ?? []), JSON.stringify(q) + (fields ? ` fields=${fields}` : "")]);
        }
        const errLines = warn.mock.calls.filter(c => (c[1] as any)?.reason === "fts_error");
        if (errLines.length) {
          const key = `${mode}:fts_error-log:${(errLines[0][1] as any).errorCode}`;
          failures.set(key, [...(failures.get(key) ?? []), JSON.stringify(q) + (fields ? ` fields=${fields}` : "")]);
        }
      }
    }
  }
  delete process.env.NOCTUA_DISABLE_FTS_DRIVEN_SEARCH;
  warn.mockRestore();
  console.log("cases", cases.length);
  for (const [k, v] of failures) console.log(k, v.length, "examples:", v.slice(0, 12).join(" | "));
}, 600000);
