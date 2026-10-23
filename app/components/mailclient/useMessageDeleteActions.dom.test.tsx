import { afterEach, describe, expect, it, mock } from "bun:test";
import { act, cleanup, renderHook } from "@testing-library/react";
import { render, I18nTestProvider } from "@/lib/i18n/testRender";
import { Theme } from "@radix-ui/themes";
import type { Message } from "@/lib/data";
import type { DeleteConfirmAction, DeleteConfirmState } from "./types";
import DeleteConfirmDialog from "./message/DeleteConfirmDialog";
import { createSelectionStore } from "./messagelist/selectionStore";
import { resolveSelectionActionTargets } from "./messagelist/selectionActions";
import { useMessageDeleteActions } from "./useMessageDeleteActions";

afterEach(cleanup);

const messages: Message[] = ["root", "reply", "reply-2", "single"].map((id) => ({
  id,
  threadId: id === "single" ? "thread-2" : "thread-1",
  subject: `Subject ${id}`,
  from: "alice@example.test",
  to: "bob@example.test",
  preview: "",
  date: new Date(0).toISOString(),
  dateValue: 0,
  folderId: "acc:INBOX",
  accountId: "acc",
  body: ""
}));

const targets = resolveSelectionActionTargets({
  selectedIds: ["root", "single"],
  activeMessageId: null,
  visibleMessages: [messages[0], messages[3]].map((message) => ({
    message, depth: 0, threadId: message.threadId
  })),
  collapsedThreads: {},
  threadScopeMessages: messages,
  supportsThreads: true
});

function setup({
  action = "cancel",
  permanent = false,
  calendar = false,
  linkedFailure = false
}: {
  action?: DeleteConfirmAction;
  permanent?: boolean;
  calendar?: boolean;
  linkedFailure?: boolean;
} = {}) {
  const currentMessages = messages.map((message) => ({
    ...message, folderId: permanent ? "acc:Trash" : "acc:INBOX"
  }));
  const selectionStore = createSelectionStore();
  selectionStore.setSelection(new Set(targets.ids));
  const confirmDelete = mock(async (_state: DeleteConfirmState) => action);
  const moveMessagesToFolder = mock(async (_folderId: string, options?: { messageIds?: string[] }) => ({
    ids: options?.messageIds ?? [],
    undoTargets: [{ messageId: "root", restoreFolderId: "acc:INBOX" }],
    destinationFolderId: "acc:Trash",
    destinationName: "Trash"
  }));
  const apiFetch = mock(async (input: RequestInfo | URL) => {
    const path = String(input);
    if (path.endsWith("delete/associations")) {
      return Response.json({
        reminders: calendar ? [{ id: "reminder-1", messageId: "root", isFuture: true }] : []
      });
    }
    if (path.endsWith("delete/linked-calendar")) {
      return new Response(null, { status: linkedFailure ? 500 : 200 });
    }
    return Response.json({ action: "deleted", deletedIds: targets.threadIds });
  });
  const pushNotice = mock((_notice: Parameters<Parameters<typeof useMessageDeleteActions>[0]["pushNotice"]>[0]) => {});
  const reportError = mock(() => {});
  const options: Parameters<typeof useMessageDeleteActions>[0] = {
    activeAccountId: "acc", activeMessageId: "", supportsThreads: true,
    collapsedThreads: {}, includeFlaggedGroup: false, searchScope: "folder",
    activeFolderId: permanent ? "acc:Trash" : "acc:INBOX",
    includeThreadAcrossFoldersForList: false,
    folders: [{ id: "acc:Trash", accountId: "acc", name: "Trash", count: 0, unreadCount: 0, specialUse: "\\Trash" }],
    messages: currentMessages, threadScopeMessages: currentMessages,
    visibleMessages: [currentMessages[0], currentMessages[3]].map((message) => ({ message, threadId: message.threadId })),
    sortedMessages: currentMessages,
    isFlaggedMessage: () => false, isTrashFolder: (id) => id === "acc:Trash",
    moveMessagesToFolder, selectionStore, lastSelectedIdRef: { current: "root" },
    setMessages: () => {}, setGroupMeta: () => {}, setPendingMessageActions: () => {},
    setActiveMessageId: () => {}, setViewMessage: () => {}, refreshFolders: async () => {},
    apiFetch, readErrorMessage: async () => "Calendar deletion failed.", reportError, pushNotice,
    confirmDelete, undoMoveOperation: async () => {}, noticeSuccessTimeout: 1000
  };
  const hook = renderHook(() => useMessageDeleteActions(options), { wrapper: I18nTestProvider });
  const remove = (ids = targets.threadIds, selectedIds = targets.ids) => act(async () => {
    await hook.result.current.handleDeleteMessagesByIds(ids, { selectedIds });
  });
  return { remove, options, confirmDelete, moveMessagesToFolder, apiFetch, pushNotice, reportError, selectionStore };
}

describe("bulk delete with collapsed threads", () => {
  it("asks with total/hidden/thread counts and cancels without deleting or clearing selection", async () => {
    const fixture = setup();
    await fixture.remove();
    expect(fixture.confirmDelete).toHaveBeenCalledTimes(1);
    const state = fixture.confirmDelete.mock.calls[0]![0];
    expect(state).toMatchObject({ messageCount: 4, hiddenMessageCount: 2, collapsedThreadCount: 1, moveToTrashCount: 4 });
    const view = render(<Theme><DeleteConfirmDialog deleteConfirm={state} onOpenChange={() => {}} resolveDeleteConfirm={() => {}} /></Theme>);
    expect(view.getByRole("alertdialog").textContent).toContain("4 messages will be moved to Trash.");
    expect(view.getByRole("alertdialog").textContent).toContain("2 hidden messages in 1 collapsed thread.");
    expect(fixture.moveMessagesToFolder).not.toHaveBeenCalled();
    expect(fixture.apiFetch).toHaveBeenCalledTimes(1);
    expect([...fixture.selectionStore.getIds()]).toEqual(targets.ids);
  });

  it("confirms the entire expanded set through the bulk transaction and preserves Undo", async () => {
    const fixture = setup({ action: "delete_mail_only" });
    await fixture.remove();
    expect(fixture.confirmDelete).toHaveBeenCalledTimes(1);
    expect(fixture.moveMessagesToFolder.mock.calls[0]![1]?.messageIds).toEqual(targets.threadIds);
    expect(fixture.selectionStore.getIds().size).toBe(0);
    expect(fixture.pushNotice.mock.calls[0]![0]).toMatchObject({ title: "Moved 4 messages to Trash.", actionKind: "undo" });
  });

  it("does not ask an extra question when all target messages are selected rows", async () => {
    const fixture = setup();
    await fixture.remove(["root", "single"], ["root", "single"]);
    expect(fixture.confirmDelete).not.toHaveBeenCalled();
    expect(fixture.moveMessagesToFolder.mock.calls[0]![1]?.messageIds).toEqual(["root", "single"]);
  });

  it("asks before permanent bulk deletion in Trash", async () => {
    const fixture = setup({ permanent: true });
    await fixture.remove();
    expect(fixture.confirmDelete.mock.calls[0]![0]).toMatchObject({ permanentDeleteCount: 4, hiddenMessageCount: 2 });
    expect(fixture.apiFetch).toHaveBeenCalledTimes(1);
    const confirmed = setup({ permanent: true, action: "delete_mail_only" });
    await confirmed.remove();
    expect(String(confirmed.apiFetch.mock.calls[1]![0])).toEndWith("delete/bulk");
    expect(confirmed.moveMessagesToFolder).not.toHaveBeenCalled();
  });

  it("retains calendar confirmation for plain rows and can keep the linked items", async () => {
    const fixture = setup({ calendar: true, action: "delete_mail_only" });
    await fixture.remove(["root", "single"], ["root", "single"]);
    expect(fixture.confirmDelete.mock.calls[0]![0]).toMatchObject({ calendarLinkedReminderCount: 1 });
    expect(fixture.apiFetch).toHaveBeenCalledTimes(1);
    expect(fixture.moveMessagesToFolder).toHaveBeenCalledTimes(1);
  });

  it("includes calendar choices in the thread confirmation and deletes linked items first", async () => {
    const fixture = setup({ calendar: true, action: "delete_linked_and_mail" });
    await fixture.remove();
    expect(fixture.confirmDelete).toHaveBeenCalledTimes(1);
    expect(fixture.confirmDelete.mock.calls[0]![0]).toMatchObject({ hiddenMessageCount: 2, calendarLinkedReminderCount: 1 });
    expect(String(fixture.apiFetch.mock.calls[1]![0])).toEndWith("delete/linked-calendar");
    expect(fixture.moveMessagesToFolder).toHaveBeenCalledTimes(1);
  });

  it("leaves messages and selection untouched if deleting linked items fails", async () => {
    const fixture = setup({ calendar: true, action: "delete_linked_and_mail", linkedFailure: true });
    await fixture.remove();
    expect(fixture.moveMessagesToFolder).not.toHaveBeenCalled();
    expect(fixture.reportError).toHaveBeenCalledTimes(1);
    expect([...fixture.selectionStore.getIds()]).toEqual(targets.ids);
  });
});
