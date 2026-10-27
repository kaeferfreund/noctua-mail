import { beforeAll, describe, expect, spyOn, test } from "bun:test";
import { createSharedShardFixture } from "../../testSharedShardHarness";
import { getDb } from "../connection";
import { updateThreadCollabState } from "../threadCollab";
import { listThreads } from "./query";

type Params = Parameters<typeof listThreads>[0];
type ThreadRow = { threadId: string };

// Replay the pre-change flagged-set join through the real listThreads call.
// Only the two changed SQL fragments and their binding positions are replaced;
// filters, counts, member hydration and grouping still execute production SQL.
async function captureList(db: Awaited<ReturnType<typeof createSharedShardFixture>>["db"], params: Params, legacy: boolean) {
  const prepare = db.prepare.bind(db);
  let selected: ThreadRow[] | undefined;
  let prioritized = false;
  const spy = spyOn(db, "prepare").mockImplementation((sql: string) => {
    if (!sql.includes("SELECT t.*, t.")) return prepare(sql);
    const flaggedOrder = /EXISTS\s*\(\s*SELECT 1 FROM messages mf\s+WHERE ([\s\S]*?)\) DESC/;
    const match = sql.match(flaggedOrder);
    prioritized = Boolean(match);
    const excludedFolders = Array.from(new Set((params.excludedFolderIds ?? []).map(id => id.trim()).filter(Boolean)));
    const excludedArgs = excludedFolders.length;
    if (legacy && match) {
      // Frozen legacy shape from 435ba5d: DISTINCT flagged set + LEFT JOIN.
      const flaggedWhere = "mf.accountId = ? AND mf.flagged = 1 AND COALESCE(mf.deleted, 0) = 0" +
        (excludedArgs ? ` AND mf.folderId NOT IN (${excludedFolders.map(() => "?").join(",")})` : "");
      sql = sql.replace(flaggedOrder, "CASE WHEN flaggedThreads.threadId IS NULL THEN 0 ELSE 1 END DESC")
        .replace("FROM threads t", `FROM threads t
          LEFT JOIN (
            SELECT DISTINCT mf.threadId FROM messages mf WHERE ${flaggedWhere}
          ) flaggedThreads ON flaggedThreads.threadId = t.threadId`);
    }
    const statement = prepare(sql);
    return {
      all(...args: unknown[]) {
        if (legacy && match) {
          const filterEnd = args.length - 2 - excludedArgs;
          args = [params.accountId, ...args.slice(filterEnd, -2), ...args.slice(0, filterEnd), ...args.slice(-2)];
        }
        selected = statement.all(...args) as ThreadRow[];
        return selected;
      }
    };
  });
  try {
    const result = await listThreads(params);
    expect(selected).toBeDefined();
    return { result, selected: selected!, prioritized };
  } finally {
    spy.mockRestore();
  }
}

describe("thread selector flagged EXISTS differential", () => {
  let fixture: Awaited<ReturnType<typeof createSharedShardFixture>>;
  const threadId = (i: number) => `<selector-${i}@example.test>`;
  const viewerUserId = "selector-viewer";

  beforeAll(async () => {
    fixture = await createSharedShardFixture();
    for (const [f, second] of [[fixture.a, false], [fixture.b, true]] as const) {
      await f.api.saveFoldersForAccount(f.accountId, [
        { id: "inbox", accountId: f.accountId, name: "INBOX", count: 0, specialUse: "\\Inbox" },
        { id: "archive", accountId: f.accountId, name: "Archive", count: 0 },
        { id: "sent", accountId: f.accountId, name: "Sent", count: 0, specialUse: "\\Sent" }
      ]);
      const messages = Array.from({ length: 24 }, (_, i) => [0, 1, 2].map(copy => {
        const dateValue = Date.UTC(2026, 0, 1) + Math.floor(i / 4) * 1000 + (copy === 1 ? (24 - i) * 1000 : 0);
        return f.message(threadId(i), {
          id: `message-${i}-${copy}`,
          messageId: `<message-${i}-${copy}@example.test>`,
          folderId: copy === 0 ? "inbox" : copy === 1 ? "archive" : "sent",
          subject: `Synthetic ${i % 2 === 0 ? "needle" : "other"} ${i}`,
          from: copy === 1 ? "team@example.test" : "sender@example.test",
          dateValue, date: new Date(dateValue).toISOString(),
          flagged: second ? i % 4 === 3 && copy === 0 : i % 4 === copy,
          deleted: copy === 2,
          unread: i % 2 === 0,
          attachments: copy === 0 && i % 3 === 0 ? [
            { id: `attachment-${i}`, filename: "synthetic.pdf", contentType: "application/pdf", size: 2048, inline: false }
          ] : []
        });
      })).flat();
      messages.push(f.message("deleted-only", { id: "deleted-only", folderId: "inbox", deleted: true, flagged: true }));
      await f.api.upsertMessages(f.accountId, null, messages);
      f.db.transaction(() => {
        for (let i = 0; i < 24; i++) {
          updateThreadCollabState(f.db, f.accountId, threadId(i), {
            status: (["open", "closed", "in_progress", "waiting"] as const)[i % 4],
            assigneeUserId: i % 3 === 0 ? viewerUserId : i % 3 === 1 ? "selector-other" : null
          }, { userId: viewerUserId, clientId: "web:test" }, i + 1);
        }
      }).immediate();
    }
  });

  async function differential(options: Partial<Params>, prioritized: boolean, accountId = fixture.a.accountId) {
    const pages: string[][] = [];
    for (const page of [1, 2, 3]) {
      const params = { accountId, page, pageSize: 5, ...options };
      const current = await captureList(fixture.db, params, false);
      const legacy = await captureList(fixture.db, params, true);
      // Compare selector rows explicitly: the member payload has its own order.
      expect(current.selected).toEqual(legacy.selected);
      expect(current.selected.map(row => row.threadId)).toEqual(legacy.selected.map(row => row.threadId));
      expect(current.result).toEqual(legacy.result);
      expect(current.prioritized).toBe(prioritized);
      expect(current.selected.every(row => row.threadId !== "deleted-only")).toBe(true);
      expect(current.result.items.every(message => message.accountId === accountId && !message.deleted)).toBe(true);
      pages.push(current.selected.map(row => row.threadId));
    }
    expect(new Set(pages.flat()).size).toBe(pages.flat().length);
    return pages.flat();
  }

  test("flagged, unflagged, deleted copies and tied dates retain page order for both date sources and folder scopes", async () => {
    for (const threadDateSource of ["latestDateValue", "latestReceivedDateValue"] as const) {
      for (const folderId of [undefined, "inbox", "archive"]) {
        await differential({ folderId, threadDateSource }, true);
      }
    }
    const all = await differential({}, true);
    // Live flags in another folder still prioritize; flags on deleted copies do not.
    expect(all.slice(0, 12).every(id => [0, 1].includes(Number(id.match(/selector-(\d+)/)?.[1]) % 4))).toBe(true);
    expect(all.slice(12).every(id => [2, 3].includes(Number(id.match(/selector-(\d+)/)?.[1]) % 4))).toBe(true);
    const latest = await captureList(fixture.db, { accountId: fixture.a.accountId, page: 1, pageSize: 24, threadDateSource: "latestDateValue" }, false);
    expect(latest.selected.some((row: ThreadRow & { latestDateValue?: number; latestReceivedDateValue?: number }) => row.latestDateValue !== row.latestReceivedDateValue)).toBe(true);
  });

  test("excluded folders retain flag eligibility, binding order and member/count contracts", async () => {
    for (const folderId of [undefined, "inbox"]) {
      for (const excludedFolderIds of [["archive"], ["sent", "archive"], [" archive ", "archive", "", "sent"]]) {
        for (const threadDateSource of ["latestDateValue", "latestReceivedDateValue"] as const) {
          const ids = await differential({ folderId, excludedFolderIds, threadDateSource }, true);
          expect(ids.slice(0, 6).every(id => Number(id.match(/selector-(\d+)/)?.[1]) % 4 === 0)).toBe(true);
        }
      }
    }
    await differential({ excludedFolderIds: ["inbox", "archive", "sent"] }, true);
  });

  test("collaboration virtual folders retain selection, order, pagination, groups and totals", async () => {
    for (const badges of [["assigned-to-me"], ["unassigned"], ["open"], ["closed"], ["in-progress"], ["waiting"], ["unassigned", "open"]]) {
      for (const folderId of [undefined, "inbox"]) {
        await differential({ folderId, badges, viewerUserId }, false);
      }
    }
    await differential({ badges: ["assigned-to-me"] }, false);
  });

  test("unassigned selector excludes closed threads with and without flagged-set replay", async () => {
    const ids = await differential({ badges: ["unassigned"] }, false);
    expect(ids.sort()).toEqual([2, 8, 11, 14, 20, 23].map(threadId).sort());
    const withOpen = await differential({ badges: ["unassigned", "open"] }, false);
    expect(withOpen.sort()).toEqual(ids);
  });

  test("search, address, attachment and other badge modes retain their ordering contracts", async () => {
    for (const options of [
      { query: "needle" }, { query: "message-1-0" }, { query: "in:Archive" },
      { query: `thread:${threadId(1)}` }, { query: "topic:none" },
      { query: "synthetic.pdf", fields: ["attachments"] },
      { from: ["sender@example.test"] }, { recipients: ["team@example.test"] },
      { participants: ["sender@example.test"] }, { attachmentsOnly: true },
      { badges: ["unread"] }, { badges: ["flagged"] }
    ]) {
      await differential(options, options.query === "topic:none");
    }
  });

  test("date and non-date grouping retain the complete payload and counts", async () => {
    for (const groupBy of ["none", "week", "year", "sender", "folder"]) {
      await differential({ groupBy }, true);
    }
  });

  test("date grouping lists every bucket with loaded counts without a bucket count query", async () => {
    const prepare = fixture.db.prepare.bind(fixture.db);
    const statements: string[] = [];
    const spy = spyOn(fixture.db, "prepare").mockImplementation((sql: string) => {
      statements.push(sql);
      return prepare(sql);
    });
    try {
      for (const folderId of [undefined, "inbox"]) {
        statements.length = 0;
        const result = await listThreads({ accountId: fixture.a.accountId, folderId, page: 1, pageSize: 5, groupBy: "date" });
        expect(result.items.length).toBeGreaterThan(0);
        expect(result.groups?.map(group => group.key)).toEqual(["Today", "Yesterday", "This Week", "Older"]);
        for (const group of result.groups ?? []) {
          expect(group.count).toBe(result.items.filter(item => item.groupKey === group.key).length);
        }
        expect(statements.some(sql => sql.includes("THEN 'Today'"))).toBe(false);
      }
      statements.length = 0;
      const week = await listThreads({ accountId: fixture.a.accountId, folderId: "inbox", page: 1, pageSize: 5, groupBy: "week" });
      expect(statements.some(sql => sql.includes("strftime('%Y-W%W'"))).toBe(true);
      expect((week.groups ?? []).reduce((sum, group) => sum + group.count, 0)).toBeGreaterThan(week.items.length);
      // The remaining thread bucket SQL serves "year" as well; "date" never reaches it (checked above).
      statements.length = 0;
      const year = await listThreads({ accountId: fixture.a.accountId, folderId: "inbox", page: 1, pageSize: 5, groupBy: "year" });
      expect(statements.some(sql => sql.includes("strftime('%Y', t."))).toBe(true);
      expect((year.groups ?? []).reduce((sum, group) => sum + group.count, 0)).toBeGreaterThan(year.items.length);
    } finally {
      spy.mockRestore();
    }
  });

  test("baseCount seeks the page threads and counts their visible folder messages", async () => {
    const prepare = fixture.db.prepare.bind(fixture.db);
    let plan: string[] = [];
    const spy = spyOn(fixture.db, "prepare").mockImplementation((sql: string) => {
      const statement = prepare(sql);
      if (!sql.includes("INDEXED BY idx_messages_account_thread_date") || !sql.includes("COUNT(*)")) return statement;
      return {
        get(...args: unknown[]) {
          plan = (prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...args) as Array<{ detail: string }>).map(row => row.detail);
          return statement.get(...args);
        }
      };
    });
    try {
      for (const options of [{ folderId: "inbox" }, { folderId: "archive", excludedFolderIds: ["sent"] }, { query: "needle" }]) {
        plan = [];
        const result = await listThreads({ accountId: fixture.a.accountId, page: 1, pageSize: 5, ...options });
        expect(plan[0]).toContain("USING INDEX idx_messages_account_thread_date (accountId=? AND threadId=?)");
        const threadIds = new Set(result.items.map(item => item.threadId));
        const expected = fixture.db.prepare(
          `SELECT threadId, folderId, subject FROM messages WHERE accountId = ? AND COALESCE(deleted, 0) = 0`
        ).all(fixture.a.accountId) as Array<{ threadId: string; folderId: string; subject: string }>;
        expect(result.baseCount).toBe(expected.filter(row => threadIds.has(row.threadId) &&
          (!options.folderId || row.folderId === options.folderId) &&
          (!("query" in options) || row.subject.includes("needle"))).length);
      }
    } finally {
      spy.mockRestore();
    }
  });

  test("message rows seek the page threads and keep the date-walk order and payload", async () => {
    const prepare = fixture.db.prepare.bind(fixture.db);
    const rowsSql = /FROM messages m INDEXED BY idx_messages_account_thread_date\s+WHERE[\s\S]*ORDER BY m\.dateValue DESC, m\.rowid ASC/;
    const capture = async (params: Params, legacy: boolean) => {
      let plan: string[] = [];
      let rows: Array<{ id: string }> = [];
      const spy = spyOn(fixture.db, "prepare").mockImplementation((sql: string) => {
        if (!rowsSql.test(sql)) return prepare(sql);
        // Frozen pre-change shape: no index hint, no explicit tie-break.
        if (legacy) sql = sql.replace(" INDEXED BY idx_messages_account_thread_date", "").replace(", m.rowid ASC", "");
        const statement = prepare(sql);
        return {
          all(...args: unknown[]) {
            plan = (prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...args) as Array<{ detail: string }>).map(row => row.detail);
            rows = statement.all(...args) as Array<{ id: string }>;
            return rows;
          }
        };
      });
      try {
        return { result: await listThreads(params), plan, rows };
      } finally {
        spy.mockRestore();
      }
    };
    let checked = 0;
    for (const options of [
      {}, { folderId: "inbox" }, { folderId: "archive" }, { excludedFolderIds: ["archive"] },
      { folderId: "inbox", excludedFolderIds: ["sent", "archive"] }, { query: "needle" }, { query: "topic:none" },
      { badges: ["assigned-to-me"], viewerUserId }, { groupBy: "sender" }, { threadDateSource: "latestDateValue" as const }
    ] satisfies Array<Partial<Params>>) {
      for (const page of [1, 2]) {
        const params = { accountId: fixture.a.accountId, page, pageSize: 8, ...options };
        const current = await capture(params, false);
        const legacy = await capture(params, true);
        expect(current.result).toEqual(legacy.result);
        if (current.result.items.length === 0) continue;
        checked++;
        expect(current.plan[0]).toContain("USING INDEX idx_messages_account_thread_date (accountId=? AND threadId=?)");
        expect(legacy.plan[0]).toContain("USING INDEX idx_messages_account_date (accountId=?)");
        expect(current.rows.length).toBeGreaterThan(0);
        expect(current.rows.map(row => row.id)).toEqual(legacy.rows.map(row => row.id));
      }
    }
    expect(checked).toBeGreaterThanOrEqual(15);
  });

  test("an empty query does not read the own addresses; from:me still does", async () => {
    const master = await getDb();
    const query = master.query.bind(master);
    let identityReads = 0;
    const spy = spyOn(master, "query").mockImplementation((sql: string) => {
      if (sql.includes("sender_identities")) identityReads++;
      return query(sql);
    });
    const reads = async (search: string) => {
      identityReads = 0;
      await listThreads({ accountId: fixture.a.accountId, folderId: "inbox", page: 1, pageSize: 5, groupBy: "sender", query: search });
      return identityReads;
    };
    try {
      // listThreads, its total count and its sender group counts each resolve "me".
      expect((await reads("from:me")) - (await reads(" "))).toBe(3);
    } finally {
      spy.mockRestore();
    }
  });

  test("shared physical shard isolates accounts with identical local message, folder and thread ids", async () => {
    expect(fixture.a.db).toBe(fixture.b.db);
    for (const accountId of [fixture.a.accountId, fixture.b.accountId]) {
      for (const options of [{}, { folderId: "inbox" }, { excludedFolderIds: ["archive"] }]) {
        const ids = await differential(options, true, accountId);
        if (accountId === fixture.b.accountId) {
          expect(ids.slice(0, 6).every(id => Number(id.match(/selector-(\d+)/)?.[1]) % 4 === 3)).toBe(true);
        }
      }
      await differential({ query: "needle" }, false, accountId);
      await differential({ badges: ["assigned-to-me"], viewerUserId }, false, accountId);
    }
  });
});
