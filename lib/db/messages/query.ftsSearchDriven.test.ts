import { beforeAll, describe, expect, spyOn, test } from "bun:test";
import { Database } from "bun:sqlite";
import { closeSync, openSync, writeSync } from "fs";
import { createSharedShardFixture } from "../../testSharedShardHarness";
import { createCollabFixture } from "../../testThreadCollabHarness";
import { closeAccountDbConnection, getAccountDb, getDb } from "../connection";
import { listMessages, listThreads } from "./query";

type Fixture = Awaited<ReturnType<typeof createSharedShardFixture>>;

/**
 * Differential: FTS-driven search candidates (default) vs the legacy
 * inline `(accountId, id) IN (SELECT ... MATCH ?)` OR-scan clause, forced
 * per call with NOCTUA_DISABLE_FTS_DRIVEN_SEARCH=1. Full listThreads /
 * listMessages payloads (ids, order, thread grouping, totals, group
 * counts) must be byte-identical for every corpus query.
 */
async function runBoth<T>(fn: () => Promise<T>) {
  process.env.NOCTUA_DISABLE_FTS_DRIVEN_SEARCH = "1";
  let legacy: T;
  try {
    legacy = await fn();
  } finally {
    delete process.env.NOCTUA_DISABLE_FTS_DRIVEN_SEARCH;
  }
  const driven = await fn();
  expect(JSON.stringify(driven)).toBe(JSON.stringify(legacy));
  return driven;
}

describe("FTS-driven search candidates differential", () => {
  let fixture: Fixture;
  const base = Date.UTC(2026, 0, 5, 12, 0, 0);

  beforeAll(async () => {
    fixture = await createSharedShardFixture();
    for (const f of [fixture.a, fixture.b]) {
      await f.api.saveFoldersForAccount(f.accountId, [
        { id: "inbox", accountId: f.accountId, name: "INBOX", count: 0, specialUse: "\\Inbox" },
        { id: "archive", accountId: f.accountId, name: "Archive", count: 0 },
        { id: "sent", accountId: f.accountId, name: "Sent", count: 0, specialUse: "\\Sent" }
      ]);
    }
    const a = fixture.a;
    const msg = (
      id: string,
      threadId: string,
      overrides: Parameters<typeof a.message>[1] = {},
      day = 0
    ) =>
      a.message(threadId, {
        id,
        messageId: `<${id}@example.test>`,
        folderId: "inbox",
        dateValue: base + day * 86_400_000,
        date: new Date(base + day * 86_400_000).toISOString(),
        ...overrides
      });
    await a.api.upsertMessages(a.accountId, null, [
      msg("alpha-1", "thread-alpha", {
        subject: "Quarterly needle report",
        body: "alpha beta gamma delta",
        preview: "alpha preview",
        from: "alice@example.test",
        to: "team@example.test",
        flagged: true,
        unread: true,
        attachments: [
          { id: "att-1", filename: "budget-2026.xlsx", contentType: "application/vnd.ms-excel", size: 2048, inline: false }
        ]
      }, 1),
      msg("alpha-2", "thread-alpha", {
        subject: "Needle followup from Müller",
        body: "delta epsilon zeta",
        from: "mueller@example.test",
        unread: false
      }, 2),
      msg("attach-only", "thread-docs", {
        subject: "Document delivery",
        body: "plain words here",
        attachments: [
          { id: "att-2", filename: "invoice-2026.pdf", contentType: "application/pdf", size: 4096, inline: false }
        ]
      }, 3),
      msg("mixed-1", "thread-mixed", {
        subject: "Mixed source hit",
        body: "zebra roaming free",
        attachments: [
          { id: "att-3", filename: "quokka-notes.pdf", contentType: "application/pdf", size: 1024, inline: false }
        ]
      }, 4),
      msg("mixed-2", "thread-mixed", {
        subject: "Reverse mixed hit",
        body: "quokka sleeping soundly",
        folderId: "archive",
        attachments: [
          { id: "att-4", filename: "zebra-plan.pdf", contentType: "application/pdf", size: 1024, inline: false }
        ]
      }, 5),
      msg("id-hit", "thread-ids", {
        subject: "Ordinary subject",
        body: "ordinary body words",
        messageId: "<unique-xyzzy-42@example.test>"
      }, 6),
      msg("local-frobnicate-7", "thread-plugh-9", {
        subject: "Another ordinary subject",
        body: "more ordinary words"
      }, 7),
      msg("umlaut-1", "thread-umlaut", {
        subject: "Grüße aus Köln",
        body: "Schöne Grüße und Ölwechsel fällig",
        from: "koeln@example.test"
      }, 8),
      msg("prefix-1", "thread-prefix", {
        subject: "Craft corner",
        body: "needlework and needles everywhere"
      }, 9),
      msg("preview-1", "thread-preview", {
        subject: "Preview carrier",
        body: "unrelated body text",
        preview: "hiddenpreviewtoken inside preview"
      }, 10),
      msg("multi-1", "thread-multi", {
        subject: "needle gamma combined",
        body: "needle in subject and gamma here",
        flagged: true
      }, 11),
      msg("multi-2", "thread-multi", {
        subject: "needle without the other token",
        body: "only needle here",
        folderId: "sent",
        from: "team@example.test",
        to: "alice@example.test"
      }, 12),
      msg("gamma-only", "thread-gamma", {
        subject: "gamma alone",
        body: "gamma gamma",
        unread: true
      }, 13),
      msg("deleted-1", "thread-deleted", {
        subject: "needle in deleted copy",
        body: "needle deleted body",
        deleted: true
      }, 14),
      msg("keyword-1", "thread-keyword", {
        subject: "NOT AND OR sale",
        body: "keyword carrier notary andes orchard",
        from: "nora@example.test"
      }, 15)
    ]);
    // Second account on the same physical shard reuses local message ids
    // (FTS v3 collision identity): candidate resolution must stay isolated.
    const b = fixture.b;
    await b.api.upsertMessages(b.accountId, null, [
      b.message("thread-alpha", {
        id: "alpha-1",
        messageId: "<alpha-1@example.test>",
        folderId: "inbox",
        subject: "Other account banana",
        body: "banana only here",
        dateValue: base + 86_400_000,
        date: new Date(base + 86_400_000).toISOString()
      }),
      b.message("thread-b-needle", {
        id: "mixed-1",
        messageId: "<mixed-1@example.test>",
        folderId: "inbox",
        subject: "Other account needle",
        body: "needle for b only",
        dateValue: base + 2 * 86_400_000,
        date: new Date(base + 2 * 86_400_000).toISOString()
      })
    ]);
  });

  const queries: Array<{ name: string; params: Record<string, unknown> }> = [
    { name: "plain word", params: { query: "needle" } },
    { name: "two tokens AND", params: { query: "needle gamma" } },
    { name: "three tokens AND", params: { query: "needle gamma subject" } },
    { name: "quoted phrase input", params: { query: '"needle report"' } },
    { name: "prefix fragment", params: { query: "needl" } },
    { name: "infix fragment (no FTS prefix hit)", params: { query: "eedle" } },
    { name: "umlaut lower", params: { query: "grüße" } },
    { name: "umlaut upper", params: { query: "GRÜSSE" } },
    { name: "umlaut prefix", params: { query: "köl" } },
    { name: "Message-ID fragment", params: { query: "xyzzy" } },
    { name: "Message-ID dashed fragment", params: { query: "unique-xyzzy-42@example" } },
    { name: "thread id fragment", params: { query: "plugh" } },
    { name: "local id fragment", params: { query: "frobnicate" } },
    { name: "attachment name only", params: { query: "invoice" } },
    { name: "attachment dashed name", params: { query: "budget-2026" } },
    { name: "mixed FTS+attachment tokens", params: { query: "zebra quokka" } },
    { name: "from filter + token", params: { query: "from:alice needle" } },
    { name: "from substring filter only", params: { query: "from:lic" } },
    { name: "to filter + token", params: { query: "to:alice needle" } },
    { name: "with filter + token", params: { query: "with:mueller needle" } },
    { name: "in filter + token", params: { query: "in:archive zebra" } },
    { name: "thread filter + token", params: { query: "thread:thread-alpha needle" } },
    { name: "email-ish token", params: { query: "alice@example" } },
    { name: "symbol-only query", params: { query: "!!!" } },
    { name: "empty result", params: { query: "nonexistenttoken" } },
    { name: "empty result two tokens", params: { query: "needle nonexistenttoken" } },
    { name: "fields subject", params: { query: "gamma", fields: ["subject"] } },
    { name: "fields body (combined MATCH, no attachments)", params: { query: "needle gamma", fields: ["body"] } },
    { name: "fields sender", params: { query: "alice", fields: ["sender"] } },
    { name: "fields attachments", params: { query: "invoice", fields: ["attachments"] } },
    { name: "fields preview", params: { query: "hiddenpreviewtoken", fields: ["preview"] } },
    { name: "preview token default fields", params: { query: "hiddenpreviewtoken" } },
    { name: "badges flagged", params: { query: "needle", badges: ["flagged"] } },
    { name: "badges unread", params: { query: "needle", badges: ["unread"] } },
    { name: "folder scope inbox", params: { query: "needle", folderId: "inbox" } },
    { name: "folder scope archive", params: { query: "quokka", folderId: "archive" } },
    { name: "grouped by sender", params: { query: "needle", groupBy: "sender" } },
    { name: "grouped by domain", params: { query: "needle", groupBy: "domain" } },
    { name: "grouped by folder", params: { query: "needle", groupBy: "folder" } },
    { name: "grouped by week", params: { query: "needle", groupBy: "week" } },
    { name: "grouped by year", params: { query: "needle", groupBy: "year" } },
    { name: "grouped none", params: { query: "needle", groupBy: "none" } },
    { name: "from param list", params: { query: "needle", from: ["alice@example.test"] } },
    { name: "recipients param list", params: { query: "needle", recipients: ["alice@example.test"] } }
  ];

  for (const { name, params } of queries) {
    test(`listThreads + listMessages identical: ${name}`, async () => {
      const accountId = fixture.a.accountId;
      for (const page of [1, 2]) {
        await runBoth(() =>
          listThreads({ accountId, page, pageSize: 3, ...params } as Parameters<typeof listThreads>[0])
        );
        await runBoth(() =>
          listMessages({ accountId, page, pageSize: 3, ...params } as Parameters<typeof listMessages>[0])
        );
      }
    });
  }

  // FTS5 parses upper-case AND/OR/NOT barewords as operators; as search
  // tokens they must be plain (prefix) terms in both modes, never a MATCH
  // syntax error or an fts_error fallback.
  const keywordQueries: Array<{ name: string; params: Record<string, unknown> }> = [
    ...["NOT", "AND", "OR", "not", "and", "or", "Not", "aNd", "oR", "NEAR", "near"].map((query) => ({
      name: `alone ${query}`,
      params: { query }
    })),
    { name: "all three", params: { query: "NOT AND OR" } },
    { name: "trailing AND", params: { query: "needle AND" } },
    { name: "leading OR", params: { query: "OR needle" } },
    { name: "infix OR", params: { query: "needle OR gamma" } },
    { name: "leading NOT", params: { query: "NOT needle" } },
    { name: "mixed case combined", params: { query: "Not sale and" } },
    { name: "quoted keyword", params: { query: '"NOT"' } },
    { name: "quoted query with keyword", params: { query: '"needle AND"' } },
    { name: "NEAR group text", params: { query: "NEAR(needle)" } },
    { name: "fields subject NOT", params: { query: "NOT", fields: ["subject"] } },
    { name: "fields subject+body OR", params: { query: "OR keyword", fields: ["subject", "body"] } },
    { name: "fields body AND (combined MATCH)", params: { query: "AND needle", fields: ["body"] } },
    { name: "fields sender NOT", params: { query: "NOT", fields: ["sender"] } },
    { name: "fields attachments AND", params: { query: "AND", fields: ["attachments"] } },
    { name: "from filter + AND", params: { query: "from:nora AND" } },
    { name: "in filter + OR", params: { query: "in:archive OR zebra" } },
    { name: "thread filter + NOT", params: { query: "thread:thread-keyword NOT" } },
    { name: "to filter + NOT", params: { query: "to:alice needle NOT" } },
    { name: "grouped by sender", params: { query: "NOT sale", groupBy: "sender" } },
    { name: "badges unread", params: { query: "OR", badges: ["unread"] } }
  ];

  for (const { name, params } of keywordQueries) {
    test(`FTS5 keyword token identical, no fts_error: ${name}`, async () => {
      const accountId = fixture.a.accountId;
      const fallbacks: unknown[] = [];
      const spy = spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
        if (args[0] === "[fts-search] legacy fallback") fallbacks.push(args[1]);
      });
      try {
        for (const cap of [undefined, "3"]) {
          if (cap) process.env.NOCTUA_FTS_DRIVEN_MAX_CANDIDATES = cap;
          try {
            for (const page of [1, 2]) {
              await runBoth(() =>
                listThreads({ accountId, page, pageSize: 3, ...params } as Parameters<typeof listThreads>[0])
              );
              await runBoth(() =>
                listMessages({ accountId, page, pageSize: 3, ...params } as Parameters<typeof listMessages>[0])
              );
            }
          } finally {
            delete process.env.NOCTUA_FTS_DRIVEN_MAX_CANDIDATES;
          }
        }
      } finally {
        spy.mockRestore();
      }
      expect(fallbacks.filter((line) => (line as { reason?: string }).reason === "fts_error")).toEqual([]);
    });
  }

  test("spot checks: FTS5 keyword tokens search as plain terms", async () => {
    const accountId = fixture.a.accountId;
    const idsFor = async (query: string, extra: Record<string, unknown> = {}) => {
      const result = await listMessages({
        accountId, page: 1, pageSize: 50, query, ...extra
      } as Parameters<typeof listMessages>[0]);
      return result.items.map((m) => m.id).sort();
    };
    expect(await idsFor("NOT", { fields: ["subject"] })).toEqual(["keyword-1"]);
    expect(await idsFor("NOT")).toEqual(await idsFor("not"));
    expect(await idsFor("AND sale")).toEqual(["keyword-1"]);
    expect(await idsFor("sale OR", { fields: ["subject"] })).toEqual(["keyword-1"]);
    expect(await idsFor("NOT needle")).toEqual([]);
  });

  test("spot checks: key corpus queries hit the intended messages", async () => {
    const accountId = fixture.a.accountId;
    const idsFor = async (query: string, extra: Record<string, unknown> = {}) => {
      const result = await listMessages({
        accountId, page: 1, pageSize: 50, query, ...extra
      } as Parameters<typeof listMessages>[0]);
      return result.items.map((m) => m.id).sort();
    };
    expect(await idsFor("zebra quokka")).toEqual(["mixed-1", "mixed-2"]);
    expect(await idsFor("xyzzy")).toEqual(["id-hit"]);
    expect(await idsFor("plugh")).toEqual(["local-frobnicate-7"]);
    expect(await idsFor("frobnicate")).toEqual(["local-frobnicate-7"]);
    expect(await idsFor("invoice")).toEqual(["attach-only"]);
    expect(await idsFor("needle gamma")).toEqual(["alpha-1", "multi-1"]);
    expect(await idsFor("grüße")).toEqual(["umlaut-1"]);
    expect(await idsFor("hiddenpreviewtoken", { fields: ["preview"] })).toEqual(["preview-1"]);
    expect(await idsFor("hiddenpreviewtoken")).toEqual([]);
    expect(await idsFor("needle")).not.toContain("deleted-1");
    expect((await idsFor("needl"))).toContain("prefix-1");
  });

  test("thread selector flagged ordering without query is untouched", async () => {
    const accountId = fixture.a.accountId;
    for (const page of [1, 2, 3]) {
      await runBoth(() => listThreads({ accountId, page, pageSize: 3 }));
      await runBoth(() => listMessages({ accountId, page, pageSize: 3 }));
    }
  });

  test("shared-shard collision ids stay isolated per account", async () => {
    for (const accountId of [fixture.a.accountId, fixture.b.accountId]) {
      for (const query of ["needle", "banana", "alpha-1"]) {
        const threads = await runBoth(() => listThreads({ accountId, page: 1, pageSize: 10, query }));
        expect(threads.items.every((m) => m.accountId === accountId)).toBe(true);
        const messages = await runBoth(() => listMessages({ accountId, page: 1, pageSize: 10, query }));
        expect(messages.items.every((m) => m.accountId === accountId)).toBe(true);
      }
    }
    const aNeedle = await listMessages({ accountId: fixture.a.accountId, page: 1, pageSize: 50, query: "banana" });
    expect(aNeedle.total).toBe(0);
    const bNeedle = await listMessages({ accountId: fixture.b.accountId, page: 1, pageSize: 50, query: "needle" });
    expect(bNeedle.items.map((m) => m.id)).toEqual(["mixed-1"]);
  });

  test("tiny candidate cap: oversized tokens probe or fall back, still identical", async () => {
    const accountId = fixture.a.accountId;
    process.env.NOCTUA_FTS_DRIVEN_MAX_CANDIDATES = "3";
    try {
      for (const query of ["needle", "needle gamma", "zebra quokka", "gamma", "invoice", "xyzzy"]) {
        await runBoth(() => listThreads({ accountId, page: 1, pageSize: 10, query }));
        await runBoth(() => listMessages({ accountId, page: 1, pageSize: 10, query }));
      }
      // Probe path result must still be the exact legacy hit set.
      const probed = await listMessages({ accountId, page: 1, pageSize: 50, query: "needle gamma" });
      expect(probed.items.map((m) => m.id).sort()).toEqual(["alpha-1", "multi-1"]);
    } finally {
      delete process.env.NOCTUA_FTS_DRIVEN_MAX_CANDIDATES;
    }
  });

  test("driven path really engages (no legacy FTS subquery in statements)", async () => {
    const accountId = fixture.a.accountId;
    const sqlSeen: string[] = [];
    const prepare = fixture.db.prepare.bind(fixture.db);
    const spy = spyOn(fixture.db, "prepare").mockImplementation((sql: string) => {
      sqlSeen.push(sql);
      return prepare(sql);
    });
    try {
      await listThreads({ accountId, page: 1, pageSize: 3, query: "needle" });
    } finally {
      spy.mockRestore();
    }
    expect(sqlSeen.some((sql) => sql.includes("MATCH ? AND accountId"))).toBe(true);
    expect(sqlSeen.some((sql) => sql.includes("IN (SELECT accountId, messageId FROM"))).toBe(false);
    expect(sqlSeen.some((sql) => /\.id IN \(\?/.test(sql))).toBe(true);

    const legacySeen: string[] = [];
    const legacySpy = spyOn(fixture.db, "prepare").mockImplementation((sql: string) => {
      legacySeen.push(sql);
      return prepare(sql);
    });
    process.env.NOCTUA_DISABLE_FTS_DRIVEN_SEARCH = "1";
    try {
      await listThreads({ accountId, page: 1, pageSize: 3, query: "needle" });
    } finally {
      delete process.env.NOCTUA_DISABLE_FTS_DRIVEN_SEARCH;
      legacySpy.mockRestore();
    }
    expect(legacySeen.some((sql) => sql.includes("IN (SELECT accountId, messageId FROM"))).toBe(true);
  });

  test("all-oversized-token fallback logs exactly once per search without query content", async () => {
    const accountId = fixture.a.accountId;
    const warnings: unknown[][] = [];
    const spy = spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
      warnings.push(args);
    });
    process.env.NOCTUA_FTS_DRIVEN_MAX_CANDIDATES = "3";
    try {
      // Kill-switch legacy (the differential reference) must not log.
      process.env.NOCTUA_DISABLE_FTS_DRIVEN_SEARCH = "1";
      const legacy = await listMessages({ accountId, page: 1, pageSize: 10, query: "needle" });
      delete process.env.NOCTUA_DISABLE_FTS_DRIVEN_SEARCH;
      expect(warnings).toHaveLength(0);

      // "needle" matches more than the cap of 3, so every token is
      // oversized: driven mode falls back to legacy and logs once,
      // while the payload stays byte-identical to the legacy payload.
      const first = await listMessages({ accountId, page: 1, pageSize: 10, query: "needle" });
      expect(JSON.stringify(first)).toBe(JSON.stringify(legacy));
      expect(warnings).toHaveLength(1);
      const second = await listThreads({ accountId, page: 1, pageSize: 10, query: "needle" });
      expect(second.total).toBeGreaterThan(0);
      expect(warnings).toHaveLength(2);

      for (const args of warnings) {
        expect(args[0]).toBe("[fts-search] legacy fallback");
        const serialized = JSON.stringify(args);
        // No user query content and no raw account id in the log line.
        expect(serialized).not.toContain("needle");
        expect(serialized).not.toContain(accountId);
        const fields = args[1] as Record<string, unknown>;
        expect(fields.reason).toBe("all_tokens_oversized");
        expect(fields.candidateCapExceeded).toBe(true);
        expect(fields.cap).toBe(3);
        expect(fields.tokenCount).toBe(1);
        expect(fields.oversizedTokenCount).toBe(1);
        expect(String(fields.accountHash)).toMatch(/^[0-9a-f]{12}$/);
      }
    } finally {
      delete process.env.NOCTUA_FTS_DRIVEN_MAX_CANDIDATES;
      delete process.env.NOCTUA_DISABLE_FTS_DRIVEN_SEARCH;
      spy.mockRestore();
    }
  });

  test("oversized-token probe and driven hits do not log a fallback", async () => {
    const accountId = fixture.a.accountId;
    const warnings: unknown[][] = [];
    const spy = spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
      warnings.push(args);
    });
    process.env.NOCTUA_FTS_DRIVEN_MAX_CANDIDATES = "3";
    try {
      // "gamma" fits under the cap and "needle" is probed against it:
      // the driven path still answers, so no fallback line is emitted.
      const probed = await listMessages({ accountId, page: 1, pageSize: 50, query: "needle gamma" });
      expect(probed.items.map((m) => m.id).sort()).toEqual(["alpha-1", "multi-1"]);
      await listMessages({ accountId, page: 1, pageSize: 50, query: "xyzzy" });
      expect(warnings).toHaveLength(0);
    } finally {
      delete process.env.NOCTUA_FTS_DRIVEN_MAX_CANDIDATES;
      spy.mockRestore();
    }
  });

  test("fts_error lines classify the injected SQLite error without logging its text", async () => {
    const accountId = fixture.a.accountId;
    const sqliteError = (code: string, message: string) =>
      Object.assign(new Error(message), { name: "SQLiteError", code });
    const cases = [
      { error: sqliteError("SQLITE_ERROR", 'fts5: syntax error near "needle"'), errorClass: "syntax" },
      { error: sqliteError("SQLITE_ERROR", "fts5: parser stack overflow"), errorClass: "syntax" },
      { error: sqliteError("SQLITE_ERROR", "no such table: message_fts_v3"), errorClass: "index" },
      { error: sqliteError("SQLITE_ERROR", "vtable constructor failed: message_fts_v3"), errorClass: "index" },
      { error: sqliteError("SQLITE_CORRUPT_VTAB", "database disk image is malformed"), errorClass: "index" },
      { error: sqliteError("SQLITE_BUSY", "database is locked"), errorClass: "other" },
      { error: sqliteError("SQLITE_ERROR", "no such column: needle"), errorClass: "other" },
      { error: new Error("needle"), errorClass: "other" }
    ];
    process.env.NOCTUA_DISABLE_FTS_DRIVEN_SEARCH = "1";
    const legacy = await listMessages({ accountId, page: 1, pageSize: 10, query: "needle" });
    delete process.env.NOCTUA_DISABLE_FTS_DRIVEN_SEARCH;
    const prepare = fixture.db.prepare.bind(fixture.db);
    for (const { error, errorClass } of cases) {
      const warnings: unknown[][] = [];
      const warnSpy = spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
        warnings.push(args);
      });
      // Only the resolution MATCH fails; the legacy statements still answer.
      const prepareSpy = spyOn(fixture.db, "prepare").mockImplementation((sql: string) =>
        sql.includes("MATCH ? AND accountId")
          ? ({ all: () => { throw error; } } as unknown as ReturnType<typeof prepare>)
          : prepare(sql)
      );
      let driven: unknown;
      try {
        driven = await listMessages({ accountId, page: 1, pageSize: 10, query: "needle" });
      } finally {
        prepareSpy.mockRestore();
        warnSpy.mockRestore();
      }
      expect(JSON.stringify(driven)).toBe(JSON.stringify(legacy));
      expect(warnings).toHaveLength(1);
      expect(warnings[0][1]).toMatchObject({ reason: "fts_error", errorClass });
      const serialized = JSON.stringify(warnings[0]);
      for (const secret of [error.message, "needle", "syntax error", "overflow", "no such", "vtable", "malformed", "locked", accountId]) {
        expect(serialized).not.toContain(secret);
      }
    }
  });

  test("candidate cap env: default for invalid values, clamped to 32,000 with one warning per value", async () => {
    const accountId = fixture.a.accountId;
    const fetchLimits: unknown[] = [];
    const warnings: unknown[][] = [];
    const prepare = fixture.db.prepare.bind(fixture.db);
    const prepareSpy = spyOn(fixture.db, "prepare").mockImplementation((sql: string) => {
      const statement = prepare(sql);
      if (!sql.includes("MATCH ? AND accountId")) return statement;
      return {
        all: (...args: unknown[]) => {
          fetchLimits.push(args[2]);
          return statement.all(...args);
        }
      } as unknown as ReturnType<typeof prepare>;
    });
    const warnSpy = spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
      // "2.9" floors to a cap of 3, below needle's hit count: that search's
      // own fallback line is not what this test counts.
      if (args[0] !== "[fts-search] legacy fallback") warnings.push(args);
    });
    const effectiveFetchLimit = async (value: string | undefined) => {
      if (value === undefined) delete process.env.NOCTUA_FTS_DRIVEN_MAX_CANDIDATES;
      else process.env.NOCTUA_FTS_DRIVEN_MAX_CANDIDATES = value;
      fetchLimits.length = 0;
      await listMessages({ accountId, page: 1, pageSize: 10, query: "needle" });
      expect(fetchLimits).toHaveLength(1);
      return fetchLimits[0];
    };
    try {
      expect(await effectiveFetchLimit(undefined)).toBe(2001);
      for (const invalid of ["", "abc", "0", "-5", "Infinity", "NaN"]) {
        expect(await effectiveFetchLimit(invalid)).toBe(2001);
      }
      expect(await effectiveFetchLimit("2.9")).toBe(3);
      expect(await effectiveFetchLimit("32000")).toBe(32001);
      expect(warnings).toHaveLength(0);

      for (let index = 0; index < 3; index += 1) {
        expect(await effectiveFetchLimit("32001")).toBe(32001);
      }
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toEqual([
        "[fts-search] NOCTUA_FTS_DRIVEN_MAX_CANDIDATES above maximum, clamped",
        { configured: 32001, max: 32000 }
      ]);
      expect(await effectiveFetchLimit("1e9")).toBe(32001);
      expect(await effectiveFetchLimit("1e9")).toBe(32001);
      expect(warnings).toHaveLength(2);
      expect(warnings[1][1]).toEqual({ configured: 1e9, max: 32000 });
      expect(JSON.stringify(warnings)).not.toContain("needle");
    } finally {
      delete process.env.NOCTUA_FTS_DRIVEN_MAX_CANDIDATES;
      prepareSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });

  test("candidate-cap fallback (combined MATCH) logs once without query content", async () => {
    const accountId = fixture.a.accountId;
    const warnings: unknown[][] = [];
    const spy = spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
      warnings.push(args);
    });
    process.env.NOCTUA_FTS_DRIVEN_MAX_CANDIDATES = "1";
    try {
      process.env.NOCTUA_DISABLE_FTS_DRIVEN_SEARCH = "1";
      const legacy = await listMessages({
        accountId, page: 1, pageSize: 10, query: "needle gamma", fields: ["subject", "body"]
      } as Parameters<typeof listMessages>[0]);
      delete process.env.NOCTUA_DISABLE_FTS_DRIVEN_SEARCH;
      const driven = await listMessages({
        accountId, page: 1, pageSize: 10, query: "needle gamma", fields: ["subject", "body"]
      } as Parameters<typeof listMessages>[0]);
      expect(JSON.stringify(driven)).toBe(JSON.stringify(legacy));
      expect(warnings).toHaveLength(1);
      const serialized = JSON.stringify(warnings[0]);
      expect(serialized).not.toContain("needle");
      expect(serialized).not.toContain("gamma");
      expect(serialized).not.toContain(accountId);
      const fields = warnings[0][1] as Record<string, unknown>;
      expect(fields.reason).toBe("candidate_cap_exceeded");
      expect(fields.candidateCapExceeded).toBe(true);
      expect(fields.cap).toBe(1);
    } finally {
      delete process.env.NOCTUA_FTS_DRIVEN_MAX_CANDIDATES;
      delete process.env.NOCTUA_DISABLE_FTS_DRIVEN_SEARCH;
      spy.mockRestore();
    }
  });
});

/**
 * Corrupt-shard resilience. Each fixture is a fresh synthetic shard in the
 * test harness temp data dir, seeded through the production write path and
 * then broken: `dropped` drops message_fts_v3 on the live connection
 * ("no such table"); `malformed` closes the connection, checkpoints the WAL
 * and overwrites the root page of message_fts_v3_data so every MATCH raises
 * SQLITE_CORRUPT ("database disk image is malformed") while the messages
 * and attachments tables stay readable. Driven mode must produce exactly
 * the legacy outcome — the same payload, or the same error — never an
 * empty driven result, and log one fts_error fallback per search.
 */
describe("FTS-driven search on a corrupt FTS shard", () => {
  type Corruption = "dropped" | "malformed";
  type Outcome = { ok: true; payload: string } | { ok: false; error: string };
  const base = Date.UTC(2026, 1, 2, 9, 0, 0);
  const accounts = {} as Record<Corruption, string>;

  async function createCorruptFtsShard(corruption: Corruption) {
    const f = await createCollabFixture();
    await f.api.saveFoldersForAccount(f.accountId, [
      { id: "inbox", accountId: f.accountId, name: "INBOX", count: 0, specialUse: "\\Inbox" },
      { id: "empty", accountId: f.accountId, name: "Empty", count: 0 }
    ]);
    await f.api.upsertMessages(f.accountId, null, Array.from({ length: 6 }, (_, index) =>
      f.message(`corrupt-thread-${index % 3}`, {
        id: `corrupt-${index}`,
        messageId: `<corrupt-${index}@example.test>`,
        folderId: "inbox",
        subject: index % 2 ? "needle status" : "weekly status",
        body: `gamma body ${index}`,
        from: `sender${index % 2}@example.test`,
        dateValue: base + index * 86_400_000,
        date: new Date(base + index * 86_400_000).toISOString(),
        attachments: index < 2
          ? [{ id: `corrupt-att-${index}`, filename: `invoice-${index}.pdf`, contentType: "application/pdf", size: 512, inline: false }]
          : []
      })
    ));
    const master = await getDb();
    const { dbPath } = master.prepare("SELECT dbPath FROM accounts WHERE id = ?").get(f.accountId) as { dbPath: string };
    if (corruption === "dropped") {
      (await getAccountDb(f.accountId)).exec("DROP TABLE message_fts_v3");
    } else {
      closeAccountDbConnection(dbPath);
      const raw = new Database(dbPath);
      raw.exec("PRAGMA wal_checkpoint(TRUNCATE)");
      const { rootpage } = raw
        .prepare("SELECT rootpage FROM sqlite_master WHERE name = 'message_fts_v3_data'")
        .get() as { rootpage: number };
      const { page_size: pageSize } = raw.prepare("PRAGMA page_size").get() as { page_size: number };
      raw.close();
      const fd = openSync(dbPath, "r+");
      try {
        writeSync(fd, Buffer.alloc(pageSize, 0xff), 0, pageSize, (rootpage - 1) * pageSize);
      } finally {
        closeSync(fd);
      }
    }
    // Guard the fixture: the FTS read must really fail, other tables not.
    const db = await getAccountDb(f.accountId);
    expect(() => db.prepare("SELECT messageId FROM message_fts_v3 WHERE message_fts_v3 MATCH 'needle*'").all())
      .toThrow(corruption === "dropped" ? /no such table/ : /malformed/);
    expect(db.prepare("SELECT COUNT(*) AS n FROM messages WHERE accountId = ?").get(f.accountId)).toEqual({ n: 6 });
    return f.accountId;
  }

  async function outcome(fn: () => Promise<unknown>): Promise<Outcome> {
    try {
      return { ok: true, payload: JSON.stringify(await fn()) };
    } catch (error) {
      const { name, code, message } = error as { name?: string; code?: string; message?: string };
      return { ok: false, error: `${name}:${code}:${message}` };
    }
  }

  async function runBothCaptured(fn: () => Promise<unknown>) {
    const fallbacks: Array<Record<string, unknown>> = [];
    const serialized: string[] = [];
    const spy = spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
      if (args[0] !== "[fts-search] legacy fallback") return;
      fallbacks.push(args[1] as Record<string, unknown>);
      serialized.push(JSON.stringify(args));
    });
    try {
      process.env.NOCTUA_DISABLE_FTS_DRIVEN_SEARCH = "1";
      let legacy: Outcome;
      try {
        legacy = await outcome(fn);
      } finally {
        delete process.env.NOCTUA_DISABLE_FTS_DRIVEN_SEARCH;
      }
      expect(fallbacks).toHaveLength(0);
      const driven = await outcome(fn);
      expect(driven).toEqual(legacy);
      return { driven, fallbacks, serialized };
    } finally {
      spy.mockRestore();
    }
  }

  beforeAll(async () => {
    accounts.dropped = await createCorruptFtsShard("dropped");
    accounts.malformed = await createCorruptFtsShard("malformed");
  });

  const expectedError: Record<Corruption, { code: string; text: RegExp }> = {
    dropped: { code: "SQLITE_ERROR", text: /no such table: message_fts_v3/ },
    malformed: { code: "SQLITE_CORRUPT", text: /database disk image is malformed/ }
  };

  for (const corruption of ["dropped", "malformed"] as const) {
    const ftsCases: Array<{ name: string; run: (accountId: string) => Promise<unknown> }> = [
      { name: "listThreads token", run: (accountId) => listThreads({ accountId, page: 1, pageSize: 3, query: "needle" }) },
      { name: "listMessages token", run: (accountId) => listMessages({ accountId, page: 1, pageSize: 3, query: "needle" }) },
      {
        name: "listThreads combined MATCH (two tokens, body+subject)",
        run: (accountId) => listThreads({
          accountId, page: 1, pageSize: 3, query: "needle gamma", fields: ["subject", "body"]
        } as Parameters<typeof listThreads>[0])
      },
      {
        name: "listMessages groups by sender",
        run: (accountId) => listMessages({ accountId, page: 1, pageSize: 3, query: "needle", groupBy: "sender" })
      },
      {
        name: "listThreads groups by week",
        run: (accountId) => listThreads({ accountId, page: 1, pageSize: 3, query: "needle", groupBy: "week" })
      },
      {
        name: "listMessages mixed FTS + attachment token",
        run: (accountId) => listMessages({ accountId, page: 1, pageSize: 3, query: "invoice", groupBy: "folder" })
      }
    ];

    for (const { name, run } of ftsCases) {
      test(`${corruption}: ${name} raises the legacy error, logs one fts_error`, async () => {
        const accountId = accounts[corruption];
        const { driven, fallbacks, serialized } = await runBothCaptured(() => run(accountId));
        // Never an empty driven result: the legacy outcome is the error.
        expect(driven.ok).toBe(false);
        if (!driven.ok) expect(driven.error).toMatch(expectedError[corruption].text);
        expect(fallbacks).toHaveLength(1);
        expect(fallbacks[0]).toMatchObject({
          reason: "fts_error",
          candidateCapExceeded: false,
          errorName: "SQLiteError",
          errorCode: expectedError[corruption].code,
          errorClass: "index",
          cap: 2000
        });
        expect(String(fallbacks[0].accountHash)).toMatch(/^[0-9a-f]{12}$/);
        for (const line of serialized) {
          for (const secret of ["needle", "gamma", "invoice", accountId, "malformed", "no such table"]) {
            expect(line).not.toContain(secret);
          }
        }
      });
    }

    test(`${corruption}: attachment-only search needs no FTS and stays identical (non-empty)`, async () => {
      const accountId = accounts[corruption];
      for (const run of [
        () => listThreads({ accountId, page: 1, pageSize: 3, query: "invoice", fields: ["attachments"] } as Parameters<typeof listThreads>[0]),
        () => listMessages({ accountId, page: 1, pageSize: 3, query: "invoice", fields: ["attachments"], groupBy: "sender" } as Parameters<typeof listMessages>[0])
      ]) {
        const { driven, fallbacks } = await runBothCaptured(run);
        expect(driven.ok).toBe(true);
        if (driven.ok) expect((JSON.parse(driven.payload) as { total: number }).total).toBe(2);
        expect(fallbacks).toHaveLength(0);
      }
    });
  }

  test("malformed: a scope the legacy MATCH never reaches answers via the legacy path, not an error", async () => {
    // The legacy subquery only runs once the outer scan yields a row, so an
    // empty folder answers despite the corrupt FTS; the eager resolution
    // MATCH raises, and the fallback must reproduce the legacy answer.
    const accountId = accounts.malformed;
    for (const run of [
      () => listThreads({ accountId, folderId: "empty", page: 1, pageSize: 3, query: "needle", groupBy: "sender" }),
      () => listMessages({ accountId, folderId: "empty", page: 1, pageSize: 3, query: "needle", groupBy: "week" })
    ]) {
      const { driven, fallbacks } = await runBothCaptured(run);
      expect(driven.ok).toBe(true);
      expect(fallbacks).toHaveLength(1);
      expect(fallbacks[0]).toMatchObject({ reason: "fts_error", errorCode: "SQLITE_CORRUPT", errorClass: "index" });
    }
  });
});

/**
 * QA-208: German spelling variants (ß ⇄ ss, umlaut ⇄ ae/oe/ue) are ORed
 * inside each token's group, in the shared token builders, so legacy and
 * FTS-driven search must stay byte-identical on a German corpus too.
 */
describe("German spelling variants in search (QA-208)", () => {
  let fixture: Fixture;
  const base = Date.UTC(2026, 2, 2, 9, 0, 0);
  // Neutral ids: the whole raw query also substring-matches message,
  // thread and local ids, so ids must not contain corpus words.
  const id = {
    strasseSharp: "q208-01",
    strasseSs: "q208-02",
    strasseUpper: "q208-03",
    strasseAttachment: "q208-04",
    gruesseUmlaut: "q208-05",
    gruesseAscii: "q208-06",
    gruesseSwiss: "q208-07",
    uebermass: "q208-08",
    uebermassAscii: "q208-09",
    uebermassSwiss: "q208-10",
    noel: "q208-11",
    nolte: "q208-12",
    fuss: "q208-13",
    fussAscii: "q208-14",
    massSharp: "q208-15",
    massSs: "q208-16",
    masseDimensions: "q208-17",
    masseMass: "q208-18",
    koeln: "q208-19",
    koelnUmlaut: "q208-20",
    poet: "q208-21",
  };

  beforeAll(async () => {
    fixture = await createSharedShardFixture();
    const a = fixture.a;
    await a.api.saveFoldersForAccount(a.accountId, [
      { id: "inbox", accountId: a.accountId, name: "INBOX", count: 0, specialUse: "\\Inbox" },
      { id: "archive", accountId: a.accountId, name: "Archive", count: 0 }
    ]);
    const msg = (localId: string, threadId: string, overrides: Parameters<typeof a.message>[1], day: number) =>
      a.message(threadId, {
        id: localId,
        messageId: `<${localId}@example.test>`,
        folderId: "inbox",
        subject: "Synthetische Nachricht",
        body: "Synthetischer Text",
        preview: "Synthetische Vorschau",
        dateValue: base + day * 86_400_000,
        date: new Date(base + day * 86_400_000).toISOString(),
        ...overrides
      });
    await a.api.upsertMessages(a.accountId, null, [
      msg(id.strasseSharp, "q208-t01", { subject: "Hauptstraße gesperrt", body: "Die Straße ist ab Montag gesperrt", from: "verkehr@example.test", unread: true }, 1),
      msg(id.strasseSs, "q208-t01", { subject: "Lieferung Lindenstrasse", body: "Strasse und Hausnummer fehlen", from: "mueller@example.test" }, 2),
      msg(id.strasseUpper, "q208-t02", { subject: "STRASSENSPERRUNG HEUTE", body: "Umleitung beachten", folderId: "archive" }, 3),
      msg(id.strasseAttachment, "q208-t03", {
        subject: "Plan im Anhang",
        body: "Siehe Datei",
        attachments: [{ id: "de-att-1", filename: "Straßenplan-2026.pdf", contentType: "application/pdf", size: 2048, inline: false }]
      }, 4),
      msg(id.gruesseUmlaut, "q208-t04", { body: "Viele Grüße aus Berlin", from: "jo@example.test" }, 5),
      msg(id.gruesseAscii, "q208-t04", { body: "Viele Gruesse vom Team", from: "mueller@example.test" }, 6),
      msg(id.gruesseSwiss, "q208-t05", { body: "Freundliche Grüsse aus Zürich", folderId: "archive" }, 7),
      msg(id.uebermass, "q208-t06", { subject: "Übermaß an Terminen", body: "Kalender voll" }, 8),
      msg(id.uebermassAscii, "q208-t06", { subject: "Re: uebermass an Terminen", body: "Kalender leeren" }, 9),
      msg(id.uebermassSwiss, "q208-t07", { body: "Ein Übermass an Arbeit" }, 10),
      msg(id.noel, "q208-t08", { subject: "Joyeux Noël", body: "Feiertagsgruß" }, 11),
      msg(id.nolte, "q208-t09", { subject: "Termin mit Frau Nolte", body: "Rückruf erbeten" }, 12),
      msg(id.fuss, "q208-t10", { subject: "Fußweg gesperrt", body: "Bitte zu Fuß gehen" }, 13),
      msg(id.fussAscii, "q208-t10", { subject: "Fussweg Umleitung", body: "Fussgaenger bitte links" }, 14),
      msg(id.massSharp, "q208-t11", { subject: "Maß halten", body: "Ein Maß Bier" }, 15),
      msg(id.massSs, "q208-t11", { subject: "Mass nehmen", body: "Mass und Ziel" }, 16),
      msg(id.masseDimensions, "q208-t12", { subject: "Maße der Kiste", body: "Breite und Höhe" }, 17),
      msg(id.masseMass, "q208-t15", { subject: "Masse der Ladung", body: "Gewicht in Kilogramm" }, 18),
      msg(id.koeln, "q208-t13", { subject: "Treffen in Koeln", body: "Groessenaenderung der Fussgaengeruebergaenge" }, 19),
      msg(id.koelnUmlaut, "q208-t13", { subject: "Treffen in Köln", body: "Größenänderung der Fußgängerübergänge" }, 20),
      msg(id.poet, "q208-t14", { subject: "Potsdam Ausflug", body: "Schlossstraße und Park" }, 21)
    ]);
    // Same physical shard, same local id: must never leak into account a.
    const b = fixture.b;
    await b.api.upsertMessages(b.accountId, null, [
      b.message("q208-t01", {
        id: id.strasseSharp,
        messageId: "<de-strasse-sharp@example.test>",
        subject: "Andere Straße",
        body: "Strasse im Konto b",
        dateValue: base,
        date: new Date(base).toISOString()
      })
    ]);
  });

  const sorted = (...values: string[]) => [...values].sort();
  const idsFor = async (query: string, extra: Record<string, unknown> = {}) => {
    const result = await listMessages({
      accountId: fixture.a.accountId, page: 1, pageSize: 50, query, ...extra
    } as Parameters<typeof listMessages>[0]);
    return result.items.map((m) => m.id).sort();
  };

  const germanQueries: Array<{ name: string; params: Record<string, unknown> }> = [
    ...[
      "Straße", "strasse", "STRASSE", "straße", "strass", "Strassen", "stra", "stra*", "straße-plan",
      "Grüße", "grüße", "grusse", "gruesse", "GRÜSSE", "GRUESSE",
      "Übermaß", "uebermass", "ubermass", "Uebermass",
      "Noël", "noel", "Fuß", "fuss", "Mass", "Maß", "masse", "Maße",
      "Köln", "koeln", "Größenänderung", "groessenaenderung",
      "Fußgängerübergänge", "fussgaengeruebergaenge", "Schlossstrasse", "Poet", "ẞ"
    ].map((query) => ({ name: `token ${query}`, params: { query } })),
    { name: "two German tokens", params: { query: "strasse gesperrt" } },
    { name: "German + plain token", params: { query: "grüße team" } },
    { name: "two variant tokens", params: { query: "fuss strasse" } },
    { name: "quoted German input", params: { query: '"Grüße aus"' } },
    { name: "from filter + German token", params: { query: "from:mueller grüße" } },
    { name: "from filter + sharp s token", params: { query: "from:verkehr strasse" } },
    { name: "with filter + German token", params: { query: "with:mueller strasse" } },
    { name: "in filter + German token", params: { query: "in:archive strasse" } },
    { name: "thread filter + German token", params: { query: "thread:q208-t04 gruesse" } },
    { name: "fields subject", params: { query: "strasse", fields: ["subject"] } },
    { name: "fields body", params: { query: "grusse", fields: ["body"] } },
    { name: "fields body two tokens (combined MATCH)", params: { query: "gruesse aus", fields: ["body"] } },
    { name: "fields subject+body", params: { query: "uebermass", fields: ["subject", "body"] } },
    { name: "fields sender", params: { query: "müller", fields: ["sender"] } },
    { name: "fields attachments", params: { query: "strassenplan", fields: ["attachments"] } },
    { name: "attachment + FTS tokens mixed", params: { query: "strassenplan anhang" } },
    { name: "folder scope inbox", params: { query: "strasse", folderId: "inbox" } },
    { name: "folder scope archive", params: { query: "grüße", folderId: "archive" } },
    { name: "badges unread", params: { query: "straße", badges: ["unread"] } },
    { name: "grouped by sender", params: { query: "gruesse", groupBy: "sender" } },
    { name: "grouped by folder", params: { query: "strasse", groupBy: "folder" } },
    { name: "grouped by week", params: { query: "mass", groupBy: "week" } }
  ];

  for (const { name, params } of germanQueries) {
    test(`listThreads + listMessages identical (default cap and cap 3): ${name}`, async () => {
      const accountId = fixture.a.accountId;
      const fallbacks: unknown[] = [];
      const spy = spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
        if (args[0] === "[fts-search] legacy fallback") fallbacks.push(args[1]);
      });
      try {
        for (const cap of [undefined, "3"]) {
          if (cap) process.env.NOCTUA_FTS_DRIVEN_MAX_CANDIDATES = cap;
          try {
            for (const page of [1, 2]) {
              await runBoth(() =>
                listThreads({ accountId, page, pageSize: 3, ...params } as Parameters<typeof listThreads>[0])
              );
              await runBoth(() =>
                listMessages({ accountId, page, pageSize: 3, ...params } as Parameters<typeof listMessages>[0])
              );
            }
          } finally {
            delete process.env.NOCTUA_FTS_DRIVEN_MAX_CANDIDATES;
          }
        }
      } finally {
        spy.mockRestore();
      }
      expect(fallbacks.filter((line) => (line as { reason?: string }).reason === "fts_error")).toEqual([]);
    });
  }

  test("spot checks: ß and ss spellings find the same messages", async () => {
    // "Schlossstraße" (id.poet) is one FTS token that does not start with
    // "stra", so prefix search does not reach it.
    const expected = sorted(id.strasseAttachment, id.strasseSharp, id.strasseSs, id.strasseUpper);
    for (const query of ["Straße", "strasse", "STRASSE", "straße", "strass"]) {
      expect(await idsFor(query)).toEqual(expected);
    }
    expect(await idsFor("stra")).toEqual(expected);
    // A typed "*" is a literal in the filename LIKE (unchanged legacy
    // behaviour), so only the FTS hits remain.
    expect(await idsFor("stra*")).toEqual(sorted(id.strasseSharp, id.strasseSs, id.strasseUpper));
    // Prefix: "Fußgängerübergänge" / "Fussgaenger…" (id.koeln*) start with "fuß"/"fuss".
    const fuss = sorted(id.fuss, id.fussAscii, id.koeln, id.koelnUmlaut);
    expect(await idsFor("Fuß")).toEqual(fuss);
    expect(await idsFor("fuss")).toEqual(fuss);
    expect(await idsFor("Schlossstrasse")).toEqual(sorted(id.poet));
    expect(await idsFor("strasse gesperrt")).toEqual(sorted(id.strasseSharp));
    expect(await idsFor("strasse", { fields: ["attachments"] })).toEqual(sorted(id.strasseAttachment));
    expect(await idsFor("in:archive strasse")).toEqual(sorted(id.strasseUpper));
  });

  test("spot checks: umlaut and ae/oe/ue spellings", async () => {
    const gruesse = sorted(id.gruesseAscii, id.gruesseSwiss, id.gruesseUmlaut);
    for (const query of ["Grüße", "grüße", "GRÜSSE", "gruesse", "GRUESSE"]) {
      expect(await idsFor(query)).toEqual(gruesse);
    }
    // A plain u is not read as a transliteration: "grusse" finds ü-text
    // (index fold) but not text written "Gruesse".
    expect(await idsFor("grusse")).toEqual(sorted(id.gruesseSwiss, id.gruesseUmlaut));
    const uebermass = sorted(id.uebermass, id.uebermassAscii, id.uebermassSwiss);
    expect(await idsFor("Übermaß")).toEqual(uebermass);
    expect(await idsFor("uebermass")).toEqual(uebermass);
    expect(await idsFor("Uebermass")).toEqual(uebermass);
    expect(await idsFor("ubermass")).toEqual(sorted(id.uebermass, id.uebermassSwiss));
    expect(await idsFor("Köln")).toEqual(sorted(id.koeln, id.koelnUmlaut));
    expect(await idsFor("koeln")).toEqual(sorted(id.koeln, id.koelnUmlaut));
    expect(await idsFor("Größenänderung")).toEqual(sorted(id.koeln, id.koelnUmlaut));
    expect(await idsFor("groessenaenderung")).toEqual(sorted(id.koeln, id.koelnUmlaut));
    // More than three sites: only the consistent spellings (corners).
    expect(await idsFor("Fußgängerübergänge")).toEqual(sorted(id.koeln, id.koelnUmlaut));
    expect(await idsFor("fussgaengeruebergaenge")).toEqual(sorted(id.koeln, id.koelnUmlaut));
    expect(await idsFor("from:mueller grüße")).toEqual(sorted(id.gruesseAscii));
    expect(await idsFor("müller", { fields: ["sender"] })).toEqual(sorted(id.gruesseAscii, id.strasseSs));
  });

  test("spot checks: recall over precision (documented surprising matches)", async () => {
    expect(await idsFor("Noël")).toEqual(sorted(id.noel));
    // "noel" also reads as "nöl" → index "nol*": finds "Nolte" as well.
    expect(await idsFor("noel")).toEqual(sorted(id.noel, id.nolte));
    // "Poet" reads as "pöt" → "pot*": finds "Potsdam".
    expect(await idsFor("Poet")).toEqual(sorted(id.poet));
    expect(await idsFor("Mass")).toEqual(sorted(id.massSharp, id.massSs, id.masseDimensions, id.masseMass));
    expect(await idsFor("Maß")).toEqual(sorted(id.massSharp, id.massSs, id.masseDimensions, id.masseMass));
    // "masse" (mass) also finds "Maße" (dimensions).
    expect(await idsFor("masse")).toEqual(sorted(id.masseDimensions, id.masseMass));
    expect(await idsFor("Maße")).toEqual(sorted(id.masseDimensions, id.masseMass));
  });

  test("account isolation on the shared shard holds for variants", async () => {
    const b = await listMessages({ accountId: fixture.b.accountId, page: 1, pageSize: 50, query: "strasse" });
    expect(b.items.map((m) => m.id)).toEqual(sorted(id.strasseSharp));
    expect(b.items.every((m) => m.accountId === fixture.b.accountId)).toBe(true);
    const a = await listMessages({ accountId: fixture.a.accountId, page: 1, pageSize: 50, query: "konto" });
    expect(a.total).toBe(0);
  });

  test("column-filter variant group matches the same rows as one col:spelling term per pair", () => {
    const columns = ["fromAddr", "toAddr", "ccAddr", "bccAddr", "subject", "body"];
    const ids = (match: string) =>
      (fixture.db
        .prepare("SELECT accountId, messageId FROM message_fts_v3 WHERE message_fts_v3 MATCH ? ORDER BY accountId, messageId")
        .all(match) as Array<{ accountId: string; messageId: string }>)
        .map((row) => `${row.accountId}/${row.messageId}`);
    const spellingSets = [
      ["strasse*", "straße*"],
      ["gruesse*", "grüsse*", "grueße*", "grüße*"],
      ['"straße-plan"*', '"strasse-plan"*'],
      ["mueller*", "müller*"]
    ];
    for (const scoped of [columns, ["subject"], ["subject", "body"], ["fromAddr"]]) {
      for (const spellings of spellingSets) {
        const perPair = `(${spellings.flatMap((spelling) => scoped.map((column) => `${column}:${spelling}`)).join(" OR ")})`;
        const filtered = `{${scoped.join(" ")}} : (${spellings.join(" OR ")})`;
        expect(ids(filtered)).toEqual(ids(perPair));
      }
    }
    expect(ids(`{${columns.join(" ")}} : (strasse* OR straße*)`).length).toBeGreaterThan(0);
  });

  test("MATCH text: tokens without a variant site are unchanged, variants are ORed per token", async () => {
    const matches: string[] = [];
    const prepare = fixture.db.prepare.bind(fixture.db);
    const spy = spyOn(fixture.db, "prepare").mockImplementation((sql: string) => {
      const statement = prepare(sql);
      if (!sql.includes("MATCH ? AND accountId")) return statement;
      return {
        all: (...args: unknown[]) => {
          matches.push(String(args[0]));
          return statement.all(...args);
        }
      } as unknown as ReturnType<typeof prepare>;
    });
    const accountId = fixture.a.accountId;
    try {
      await listMessages({ accountId, page: 1, pageSize: 3, query: "needle" });
      await listMessages({ accountId, page: 1, pageSize: 3, query: "strasse", fields: ["subject"] } as Parameters<typeof listMessages>[0]);
      await listMessages({ accountId, page: 1, pageSize: 3, query: "gruesse aus", fields: ["body"] } as Parameters<typeof listMessages>[0]);
      await listMessages({ accountId, page: 1, pageSize: 3, query: "NOT", fields: ["subject"] } as Parameters<typeof listMessages>[0]);
    } finally {
      spy.mockRestore();
    }
    expect(matches).toEqual([
      "(fromAddr:needle* OR toAddr:needle* OR ccAddr:needle* OR bccAddr:needle* OR subject:needle* OR body:needle*)",
      "{subject} : (strasse* OR straße*)",
      "{body} : (gruesse* OR grüsse* OR grueße* OR grüße*) AND body:aus*",
      'subject:"NOT"*'
    ]);
  });
});
