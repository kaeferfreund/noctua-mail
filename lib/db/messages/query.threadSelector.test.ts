import { beforeAll, describe, expect, spyOn, test } from "bun:test";
import { createSharedShardFixture } from "../../testSharedShardHarness";
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
