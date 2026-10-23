import { buildMessageGroupKey, buildTimeGroupKey } from "@/lib/messageGrouping";
import { describe, expect, it, test } from "bun:test";
import type { Message } from "@/lib/data";
import {
  buildGroupedMessages,
  buildMessageListItems,
  getMessageListRowKey,
  type MessageGroup
} from "./listModel";

function makeMessage(
  idOrOverrides: string | Partial<Message>,
  threadId = "thread-1",
  dateValue = Date.UTC(2026, 2, 26, 15, 0, 0),
  overrides?: Partial<Message>
): Message {
  if (typeof idOrOverrides !== "string") {
    return {
      id: "msg-1",
      threadId: "thread-1",
      subject: "Subject",
      from: "Alice <alice@example.test>",
      to: "Bob <bob@example.test>",
      preview: "Preview",
      date: new Date(Date.UTC(2026, 2, 26, 15, 0, 0)).toISOString(),
      dateValue: Date.UTC(2026, 2, 26, 15, 0, 0),
      folderId: "acc-1:INBOX",
      accountId: "acc-1",
      body: "",
      ...idOrOverrides
    };
  }

  return {
    id: idOrOverrides,
    accountId: "acc-1",
    folderId: "acc-1:inbox",
    threadId,
    subject: `Subject ${idOrOverrides}`,
    from: "Alice <alice@example.com>",
    to: "Bob <bob@example.com>",
    preview: `Preview ${idOrOverrides}`,
    date: new Date(dateValue).toISOString(),
    dateValue,
    body: "",
    ...overrides
  };
}

describe("buildMessageListItems", () => {
  it("does not emit empty groups when metadata still contains a stale bucket", () => {
    const groups = buildGroupedMessages({
      listScopeMessages: [
        {
          ...makeMessage("m1", "thread-1", 1000),
          groupKey: "Older"
        }
      ],
      supportsThreads: false,
      groupMeta: [
        { key: "This Week", label: "This Week", count: 1 },
        { key: "Older", label: "Older", count: 1 }
      ],
      groupBy: "date",
      buildThreadTree: () => [],
      flattenThread: () => [],
      isFlaggedMessage: () => false,
      computeGroupMeta: () => []
    });

    expect(groups).toEqual([
      expect.objectContaining({
        key: "Older",
        items: [expect.objectContaining({ id: "m1" })]
      })
    ]);
  });

  it("emits topic suggestions as a dedicated section item instead of group plus sibling rows", () => {
    const suggestionGroup: MessageGroup = {
      key: "topic-suggestions:topic-build",
      label: "Build Alerts",
      items: [makeMessage("m1", "thread-1", 1000), makeMessage("m2", "thread-2", 900)],
      showCount: false,
      allowToggleWhenEmpty: true,
      variant: "topic-suggestions"
    };
    const normalGroup: MessageGroup = {
      key: "Today",
      label: "Today",
      items: [makeMessage("m3", "thread-3", 800)]
    };

    const items = buildMessageListItems({
      groupedMessages: [suggestionGroup, normalGroup],
      collapsedGroups: {
        "topic-suggestions:topic-build": false,
        Today: false
      },
      collapsedThreads: {},
      supportsThreads: false,
      includeThreadAcrossFolders: false,
      searchScope: "folder",
      activeFolderId: "acc-1:inbox",
      buildThreadTree: () => [],
      flattenThread: () => [],
      getThreadLatestDate: () => 0,
      preferToDisplay: false,
      mode: "flat"
    });

    expect(items.map((item) => item.type)).toEqual(["suggestion-section", "group", "row"]);
    expect(items[0]).toEqual(
      expect.objectContaining({
        type: "suggestion-section",
        key: "topic-suggestions:topic-build:section",
        isCollapsed: false
      })
    );
    if (items[0]?.type !== "suggestion-section") {
      throw new Error("Expected suggestion-section item");
    }
    expect(items[0].rows).toHaveLength(2);
    expect(items[1]).toEqual(
      expect.objectContaining({
        type: "group",
        key: "Today"
      })
    );
  });

  it("still emits normal threaded rows for non-suggestion groups", () => {
    const normalGroup: MessageGroup = {
      key: "Today",
      label: "Today",
      items: [makeMessage("root", "thread-1", 1000), makeMessage("reply", "thread-1", 900)]
    };

    const items = buildMessageListItems({
      groupedMessages: [normalGroup],
      collapsedGroups: { Today: false },
      collapsedThreads: { "thread-1": false },
      supportsThreads: true,
      includeThreadAcrossFolders: false,
      searchScope: "folder",
      activeFolderId: "acc-1:inbox",
      buildThreadTree: (messages) => [
        {
          message: messages[0]!,
          threadSize: messages.length,
          children: [
            {
              message: messages[1]!,
              threadSize: messages.length - 1,
              children: []
            }
          ]
        }
      ],
      flattenThread: (node, depth = 0) => [
        { message: node.message, depth },
        ...node.children.flatMap((child) => [{ message: child.message, depth: depth + 1 }])
      ],
      getThreadLatestDate: (node) => node.message.dateValue,
      preferToDisplay: false,
      mode: "nested"
    });

    expect(items.map((item) => item.type)).toEqual(["group", "row", "row"]);
  });

  it("uses the sort-driving message date for collapsed threaded rows", () => {
    const root = makeMessage("root", "thread-1", 1000, {
      threadSortDateValue: 2000
    });
    const receivedReply = makeMessage("reply", "thread-1", 2000, {
      parentId: "root",
      threadSortDateValue: 2000
    });
    const sentLater = makeMessage("sent", "thread-1", 3000, {
      parentId: "reply",
      threadSortDateValue: 2000
    });

    const items = buildMessageListItems({
      groupedMessages: [
        {
          key: "Today",
          label: "Today",
          items: [root, receivedReply, sentLater]
        }
      ],
      collapsedGroups: { Today: false },
      collapsedThreads: { "thread-1": true },
      supportsThreads: true,
      includeThreadAcrossFolders: false,
      searchScope: "folder",
      activeFolderId: "acc-1:inbox",
      buildThreadTree: (messages) => [
        {
          message: messages[0]!,
          threadSize: messages.length,
          children: [
            {
              message: messages[1]!,
              threadSize: messages.length - 1,
              children: [
                {
                  message: messages[2]!,
                  threadSize: 1,
                  children: []
                }
              ]
            }
          ]
        }
      ],
      flattenThread: (node, depth = 0) => [
        { message: node.message, depth },
        ...node.children.flatMap((child) => [
          { message: child.message, depth: depth + 1 },
          ...child.children.map((grandchild) => ({
            message: grandchild.message,
            depth: depth + 2
          }))
        ])
      ],
      getThreadLatestDate: (node) => node.message.dateValue,
      preferToDisplay: false,
      mode: "flat"
    });

    expect(items).toHaveLength(2);
    expect(items[1]).toEqual(
      expect.objectContaining({
        type: "row",
        key: "root",
        displayDateValue: 2000,
        displayDate: new Date(2000).toISOString()
      })
    );
  });
});

describe("getMessageListRowKey", () => {
  test("uses a stable Message-ID based key for drafts", () => {
    expect(
      getMessageListRowKey(
        makeMessage({
          id: "draft-row-2",
          draft: true,
          folderId: "acc-1:Drafts",
          messageId: "<draft-stable@example.test>"
        })
      )
    ).toBe("draft:<draft-stable@example.test>");
  });

  test("falls back to the row id for non-drafts", () => {
    expect(
      getMessageListRowKey(
        makeMessage({
          id: "msg-2",
          draft: false,
          messageId: "<message@example.test>"
        })
      )
    ).toBe("msg-2");
  });
});

test("Berlin time buckets display loaded-row counts while host-local server totals await alignment", () => {
  for (const [groupBy, key] of [["date", "Today"], ["week", "2026-W43"], ["year", "2026"]]) {
    const messages = [makeMessage({ id: "berlin-1", groupKey: key }), makeMessage({ id: "berlin-2", groupKey: key })];
    const groups = buildGroupedMessages({
      listScopeMessages: messages, supportsThreads: false,
      groupMeta: [{ key, label: key, count: 1 }, { key: "stale-host-bucket", label: "stale-host-bucket", count: 20 }],
      groupBy, buildThreadTree: () => [], flattenThread: () => [], isFlaggedMessage: () => false, computeGroupMeta: () => []
    });
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ key, count: 2, countIsLoaded: true, items: messages });
  }
  const groups = buildGroupedMessages({
    listScopeMessages: [makeMessage({ groupKey: "sender@example.test" })], supportsThreads: false,
    groupMeta: [{ key: "sender@example.test", label: "sender@example.test", count: 10 }], groupBy: "sender",
    buildThreadTree: () => [], flattenThread: () => [], isFlaggedMessage: () => false, computeGroupMeta: () => []
  });
  expect(groups[0]?.count).toBe(10);
  expect(groups[0]?.countIsLoaded).toBeUndefined();
});

// Exercise the real merged metadata path: server keys can be absent or disagree
// with Berlin while a page is only partly loaded.

function mergedTimeGroups(groupBy: string, dates: string[], serverKeys: string[], now?: string) {
  const listScopeMessages = dates.map((date, i) => {
    const message = makeMessage(`synthetic-boundary-${i}`, `thread-${i}`, Date.parse(date));
    message.groupKey = groupBy === "date"
      ? buildTimeGroupKey(message.dateValue, groupBy, Date.parse(now!))
      : buildMessageGroupKey(message, groupBy);
    return message;
  });
  return buildGroupedMessages({
    listScopeMessages, supportsThreads: false,
    groupMeta: serverKeys.map(key => ({ key, label: `opaque ${key}`, count: 999 })), groupBy,
    buildThreadTree: () => [], flattenThread: () => [], isFlaggedMessage: () => false,
    computeGroupMeta: () => []
  });
}

for (const [name, now, dates, serverKeys, expected] of [
  ["UTC 22:30 today/yesterday", "2026-10-23T00:15:00+02:00",
    ["2026-10-22T22:30:00Z", "2026-10-22T23:45:00+02:00"], ["Today"], ["Today", "Yesterday"]],
  ["spring DST 23-hour day", "2026-03-30T00:15:00+02:00",
    ["2026-03-28T23:30:00+01:00", "2026-03-29T12:00:00+02:00"], ["Yesterday"], ["Yesterday", "This Week"]],
  ["autumn DST 25-hour day", "2026-10-26T00:15:00+01:00",
    ["2026-10-24T12:00:00+02:00", "2026-10-25T00:30:00+02:00"], ["This Week"], ["Yesterday", "This Week"]]
] as const) test(`merged Berlin date groups: ${name}`, () => {
  const groups = mergedTimeGroups("date", [...dates], [...serverKeys], now);
  expect(groups.map(g => g.key)).toEqual([...expected]);
  expect(groups.map(g => [g.count, g.countIsLoaded])).toEqual([[1, true], [1, true]]);
});

for (const [name, groupBy, dates, serverKeys, expected] of [
  ["Monday rollover", "week", ["2026-10-26T00:15:00+01:00", "2026-10-25T23:30:00+01:00"], ["2026-W42"], ["2026-W43", "2026-W42"]],
  ["week-zero rollover", "week", ["2026-01-05T00:15:00+01:00", "2026-01-04T23:30:00+01:00"], ["2026-W00"], ["2026-W01", "2026-W00"]],
  ["week/year rollover", "week", ["2027-01-01T00:15:00+01:00", "2026-12-31T23:30:00+01:00"], ["2026-W52"], ["2027-W00", "2026-W52"]],
  ["year rollover", "year", ["2027-01-01T00:15:00+01:00", "2026-12-31T23:30:00+01:00"], ["2026"], ["2027", "2026"]]
] as const) test(`merged Berlin ${name} sorts missing client keys chronologically`, () => {
  const groups = mergedTimeGroups(groupBy, [...dates], [...serverKeys]);
  expect(groups.map(g => g.key)).toEqual([...expected]);
  expect(groups.map(g => [g.count, g.countIsLoaded])).toEqual([[1, true], [1, true]]);
});
