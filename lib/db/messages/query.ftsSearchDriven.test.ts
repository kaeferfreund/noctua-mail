import { beforeAll, describe, expect, spyOn, test } from "bun:test";
import { createSharedShardFixture } from "../../testSharedShardHarness";
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
  expect(driven).toEqual(legacy);
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
      }, 14)
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
});
