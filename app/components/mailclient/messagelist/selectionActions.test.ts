import { describe, expect, it } from "bun:test";
import type { Message } from "@/lib/data";
import {
  bindSelectionActions,
  resolveSelectionActionTargets,
  type SelectionActions,
  type SelectionActionTargets
} from "./selectionActions";

function makeMessage(id: string, threadId: string): Message {
  return {
    id,
    threadId,
    subject: `Subject ${id}`,
    from: "Alice <alice@example.test>",
    to: "Bob <bob@example.test>",
    preview: "",
    date: new Date(0).toISOString(),
    dateValue: 0,
    folderId: "acc-1:INBOX",
    accountId: "acc-1",
    body: ""
  };
}

// A collapsed three-message thread shown as its root row, plus a single message.
const root = makeMessage("root", "thread-1");
const reply = makeMessage("reply", "thread-1");
const replyTwo = makeMessage("reply-2", "thread-1");
const single = makeMessage("single", "thread-2");
const threadContext = {
  visibleMessages: [
    { message: root, depth: 0, threadId: "thread-1" },
    { message: single, depth: 0, threadId: "thread-2" }
  ],
  collapsedThreads: {},
  threadScopeMessages: [root, reply, replyTwo, single],
  supportsThreads: true
};

describe("resolveSelectionActionTargets", () => {
  it("uses the selection when there is one", () => {
    expect(
      resolveSelectionActionTargets({
        ...threadContext,
        selectedIds: new Set(["single"]),
        activeMessageId: "root"
      })
    ).toEqual({ ids: ["single"], threadIds: ["single"] });
  });

  it("falls back to the active message", () => {
    expect(
      resolveSelectionActionTargets({ ...threadContext, selectedIds: [], activeMessageId: "single" })
    ).toEqual({ ids: ["single"], threadIds: ["single"] });
  });

  it("covers the whole thread behind a collapsed root, for the active message too", () => {
    const fromSelection = resolveSelectionActionTargets({
      ...threadContext,
      selectedIds: ["root", "single"],
      activeMessageId: null
    });
    expect(fromSelection.ids).toEqual(["root", "single"]);
    expect(fromSelection.threadIds.sort()).toEqual(["reply", "reply-2", "root", "single"]);

    const fromActive = resolveSelectionActionTargets({
      ...threadContext,
      selectedIds: [],
      activeMessageId: "root"
    });
    expect(fromActive.ids).toEqual(["root"]);
    expect(fromActive.threadIds.sort()).toEqual(["reply", "reply-2", "root"]);
  });

  it("keeps an expanded thread to the selected messages", () => {
    expect(
      resolveSelectionActionTargets({
        ...threadContext,
        collapsedThreads: { "thread-1": false },
        selectedIds: ["root"],
        activeMessageId: null
      })
    ).toEqual({ ids: ["root"], threadIds: ["root"] });
  });

  it("has no targets without a selection or an active message", () => {
    expect(
      resolveSelectionActionTargets({ ...threadContext, selectedIds: [], activeMessageId: null })
    ).toEqual({ ids: [], threadIds: [] });
  });
});

describe("bindSelectionActions", () => {
  function recordActions() {
    const calls: Array<[keyof SelectionActions, SelectionActionTargets, ...unknown[]]> = [];
    const record =
      (name: keyof SelectionActions) =>
      (targets: SelectionActionTargets, ...args: unknown[]) => {
        calls.push([name, targets, ...args]);
      };
    const actions: SelectionActions = {
      markRead: record("markRead"),
      markUnread: record("markUnread"),
      toggleFlag: record("toggleFlag"),
      toggleTodo: record("toggleTodo"),
      moveToFolder: record("moveToFolder"),
      moveToOther: record("moveToOther"),
      addTopic: record("addTopic"),
      archive: record("archive"),
      remove: record("remove"),
      copyToAccount: record("copyToAccount"),
      moveToAccount: record("moveToAccount")
    };
    return { calls, actions };
  }

  it("resolves the targets when an item runs, and passes item arguments through", () => {
    const { calls, actions } = recordActions();
    let selected = ["a"];
    const bound = bindSelectionActions(actions, () => ({ ids: selected, threadIds: selected }));
    selected = ["b", "c"];
    bound.onMoveToFolder("acc-1:Archive");
    bound.onAddTopic("topic-1");
    bound.onDelete();
    expect(calls).toEqual([
      ["moveToFolder", { ids: ["b", "c"], threadIds: ["b", "c"] }, "acc-1:Archive"],
      ["addTopic", { ids: ["b", "c"], threadIds: ["b", "c"] }, "topic-1"],
      ["remove", { ids: ["b", "c"], threadIds: ["b", "c"] }]
    ]);
  });

  it("does nothing without targets", () => {
    const { calls, actions } = recordActions();
    const bound = bindSelectionActions(actions, () => ({ ids: [], threadIds: [] }));
    bound.onMarkRead();
    bound.onDelete();
    expect(calls).toEqual([]);
  });
});
