import { afterEach, describe, expect, it, mock } from "bun:test";
import { act, cleanup, renderHook } from "@testing-library/react";
import { I18nTestProvider } from "@/lib/i18n/testRender";
import type { Folder, Message } from "@/lib/data";
import { createSelectionStore } from "../messagelist/selectionStore";
import { useMessageMoveActions } from "../useMessageMoveActions";
import { useMessageDeleteActions } from "../useMessageDeleteActions";
import { useMessageMutations } from "../useMessageMutations";
import { canEditWithRole, type MailboxSkipReport } from "./mailboxFanOut";
import { useMailboxSkipNotice } from "./useMailboxSkipNotice";

// Domain view of three synthetic mailboxes plus one without an archive:
// a (active, editor), b (editor), c (viewer, read only), d (editor, no archive).
afterEach(cleanup);

const roles: Record<string, "editor" | "viewer"> = { a: "editor", b: "editor", c: "viewer", d: "editor" };
const canEditMailbox = (accountId: string) => canEditWithRole(roles[accountId]);
const folder = (accountId: string, path: string, specialUse?: string): Folder =>
  ({ id: `${accountId}:${path}`, accountId, name: path, specialUse, count: 0, unreadCount: 0 }) as Folder;
const foldersByAccount: Record<string, Folder[]> = {
  a: [folder("a", "INBOX", "\\Inbox"), folder("a", "Archive", "\\Archive"), folder("a", "Trash", "\\Trash"), folder("a", "Projects")],
  b: [folder("b", "INBOX", "\\Inbox"), folder("b", "Archiv", "\\Archive"), folder("b", "Papierkorb", "\\Trash")],
  c: [folder("c", "INBOX", "\\Inbox"), folder("c", "Archive", "\\Archive"), folder("c", "Trash", "\\Trash")],
  d: [folder("d", "INBOX", "\\Inbox"), folder("d", "Trash", "\\Trash")]
};
const message = (accountId: string, id: string, folderPath = "INBOX"): Message => ({
  id, accountId, threadId: `thread-${id}`, messageId: `<${id}@example.test>`, folderId: `${accountId}:${folderPath}`,
  subject: `Subject ${id}`, from: "sender@example.test", to: `${accountId}@example.test`, date: "2026-11-10T09:00:00Z",
  dateValue: 0, preview: "", body: "", seen: false, unread: true, flags: []
});

type Call = { path: string; body: Record<string, unknown> | null };
function recordingFetch(respond: (call: Call) => Response | undefined) {
  const calls: Call[] = [];
  const apiFetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
    const call = { path: String(input), body: init?.body ? JSON.parse(String(init.body)) : null };
    calls.push(call);
    return respond(call) ?? Response.json({ ok: true });
  });
  return { calls, apiFetch };
}
const moveResponse = (call: Call) => {
  const ids = (call.body?.messageIds as string[]) ?? [];
  return Response.json({
    ok: true, queued: true, destinationFolderId: call.body?.destinationFolderId,
    movedIds: ids.map((id) => ({ previousId: id, nextId: id })),
    undoTargets: ids.map((id) => ({ messageId: id, restoreFolderId: `${call.path.split("/")[3]}:INBOX` }))
  });
};

function moveHarness(messages: Message[], respond: (call: Call) => Response | undefined) {
  const { calls, apiFetch } = recordingFetch(respond);
  const skips: MailboxSkipReport[] = [];
  const notices: Array<{ title: string; onAction?: () => void }> = [];
  const undo = mock(async (_targets: unknown[], _accountId: string) => {});
  let current = messages;
  const options: Parameters<typeof useMessageMoveActions>[0] = {
    activeAccountId: "a", activeMessageId: "", activeFolderId: "a:INBOX", searchScope: "folder",
    includeThreadAcrossFoldersForList: false, messages, selectionStore: createSelectionStore(),
    folderById: new Map(Object.values(foldersByAccount).flat().map((item) => [item.id, item])),
    folders: Object.values(foldersByAccount).flat(),
    getAccountFolders: async (accountId) => foldersByAccount[accountId] ?? null,
    canEditMailbox, reportMailboxSkips: (report) => skips.push(report),
    lastSelectedIdRef: { current: null }, setFolders() {},
    setMessages: (update) => { current = typeof update === "function" ? update(current) : update; },
    setGroupMeta() {}, setPendingMessageActions() {}, setActiveMessageId() {}, setViewMessage() {},
    apiFetch, readErrorMessage: async () => "Synthetic error", reportError() {},
    pushNotice: (notice) => notices.push(notice), undoMoveOperation: undo, noticeSuccessTimeout: 1000
  };
  const hook = renderHook(() => useMessageMoveActions(options), { wrapper: I18nTestProvider });
  return { hook, calls, skips, notices, undo, current: () => current };
}

describe("moving a selection across mailboxes", () => {
  it("moves each message in its own mailbox, maps special folders by role and names what was skipped", async () => {
    const messages = [message("a", "a1"), message("b", "b1"), message("c", "c1"), message("d", "d1")];
    const h = moveHarness(messages, (call) => (call.path.endsWith("/messages/move") ? moveResponse(call) : undefined));
    let result: Awaited<ReturnType<typeof h.hook.result.current.moveMessagesToFolder>> = null;
    await act(async () => {
      result = await h.hook.result.current.moveMessagesToFolder("a:Archive", { messageIds: messages.map((item) => item.id) });
    });
    expect(h.calls.map((call) => [call.path, call.body?.destinationFolderId, call.body?.messageIds])).toEqual([
      ["/api/accounts/a/messages/move", "a:Archive", ["a1"]],
      ["/api/accounts/b/messages/move", "b:Archiv", ["b1"]]
    ]);
    expect(h.skips).toEqual([{
      action: "move", total: 4,
      skipped: [{ id: "c1", accountId: "c", reason: "permission" }, { id: "d1", accountId: "d", reason: "noFolder" }]
    }]);
    expect(result!.ids).toEqual(["a1", "b1"]);
    // Undo moves every message back in its own mailbox.
    expect(result!.undoTargets.map((target) => [target.accountId, target.messageId, target.restoreFolderId])).toEqual([
      ["a", "a1", "a:INBOX"], ["b", "b1", "b:INBOX"]
    ]);
    expect(h.current().map((item) => item.id)).toEqual(["c1", "d1"]);
  });

  it("counts a 403 from a mailbox's route as skipped, not as an error, and keeps the rest", async () => {
    const messages = [message("a", "a1"), message("b", "b1")];
    const h = moveHarness(messages, (call) =>
      call.path.startsWith("/api/accounts/b/") ? new Response(null, { status: 403 }) : moveResponse(call));
    await act(async () => {
      await h.hook.result.current.moveMessagesToFolder("a:Archive", { messageIds: ["a1", "b1"] });
    });
    expect(h.skips[0]).toMatchObject({ total: 2, skipped: [{ id: "b1", accountId: "b", reason: "permission" }] });
    expect(h.notices[0]?.title).toBe("Moving message to Archive in background.");
  });

  it("offers no equivalent for a custom folder: only the destination's mailbox moves", async () => {
    const messages = [message("a", "a1"), message("b", "b1")];
    const h = moveHarness(messages, moveResponse);
    await act(async () => {
      await h.hook.result.current.moveMessagesToFolder("a:Projects", { messageIds: ["a1", "b1"] });
    });
    expect(h.calls.map((call) => call.path)).toEqual(["/api/accounts/a/messages/move"]);
    expect(h.skips[0]?.skipped).toEqual([{ id: "b1", accountId: "b", reason: "noFolder" }]);
  });
});

describe("deleting a selection across mailboxes", () => {
  function deleteHarness(messages: Message[], respond: (call: Call) => Response | undefined) {
    const { calls, apiFetch } = recordingFetch(respond);
    const skips: MailboxSkipReport[] = [];
    const notices: Array<{ title: string; description?: string }> = [];
    const moveMessagesToFolder = mock(async (folderId: string, options?: { messageIds?: string[]; destinationsByAccount?: ReadonlyMap<string, string> }) => ({
      ids: options?.messageIds ?? [],
      undoTargets: (options?.messageIds ?? []).map((id) => ({ messageId: id, restoreFolderId: "x", accountId: id.slice(0, 1) })),
      destinationFolderId: folderId,
      destinationName: "Trash"
    }));
    const folders = Object.values(foldersByAccount).flat();
    const options: Parameters<typeof useMessageDeleteActions>[0] = {
      activeAccountId: "a", activeMessageId: "", supportsThreads: false, collapsedThreads: {}, includeFlaggedGroup: false,
      searchScope: "folder", activeFolderId: "a:INBOX", includeThreadAcrossFoldersForList: false, folders,
      messages, threadScopeMessages: messages,
      visibleMessages: messages.map((item) => ({ message: item, threadId: item.threadId ?? item.id })), sortedMessages: messages,
      isFlaggedMessage: () => false, isTrashFolder: (id) => folders.some((item) => item.id === id && item.specialUse === "\\Trash"),
      moveMessagesToFolder, selectionStore: createSelectionStore(), lastSelectedIdRef: { current: null },
      setMessages() {}, setGroupMeta() {}, setPendingMessageActions() {}, setActiveMessageId() {}, setViewMessage() {},
      refreshFolders: async () => {}, apiFetch, readErrorMessage: async () => "Synthetic error", reportError() {},
      pushNotice: (notice) => notices.push(notice), confirmDelete: async () => "delete_mail_only",
      undoMoveOperation: async () => {}, noticeSuccessTimeout: 1000,
      getAccountFolders: async (accountId) => foldersByAccount[accountId] ?? null,
      canEditMailbox, reportMailboxSkips: (report) => skips.push(report)
    };
    const hook = renderHook(() => useMessageDeleteActions(options), { wrapper: I18nTestProvider });
    return { hook, calls, skips, notices, moveMessagesToFolder };
  }

  it("moves to each mailbox's trash, deletes for good what is already there, skips the read-only mailbox", async () => {
    const messages = [message("a", "a1"), message("b", "b1"), message("b", "b2", "Papierkorb"), message("c", "c1")];
    const h = deleteHarness(messages, (call) =>
      call.path.endsWith("/delete") ? Response.json({ ok: true, action: "deleted" }) : Response.json({}));
    await act(async () => {
      await h.hook.result.current.handleDeleteMessagesByIds(messages.map((item) => item.id), { selectedIds: messages.map((item) => item.id) });
    });
    const [, moveOptions] = h.moveMessagesToFolder.mock.calls[0]!;
    expect(moveOptions?.messageIds).toEqual(["a1", "b1"]);
    expect(Object.fromEntries(moveOptions?.destinationsByAccount ?? [])).toEqual({ a: "a:Trash", b: "b:Papierkorb" });
    expect(h.calls.filter((call) => call.path.endsWith("/delete")).map((call) => call.path)).toEqual(["/api/accounts/b/messages/b2/delete"]);
    // Calendar links are looked up only in mailboxes the user may change.
    expect(h.calls.filter((call) => call.path.endsWith("delete/associations")).map((call) => call.path))
      .toEqual(["/api/accounts/a/messages/delete/associations", "/api/accounts/b/messages/delete/associations"]);
    expect(h.skips).toEqual([{ action: "delete", total: 4, skipped: [{ id: "c1", accountId: "c", reason: "permission" }] }]);
    expect(h.notices[0]).toMatchObject({ title: "Moved 2 messages to Trash.", description: "1 message was deleted permanently." });
  });

  it("deletes a single message of another mailbox in that mailbox", async () => {
    const other = message("b", "b1");
    const h = deleteHarness([message("a", "a1"), other], () => Response.json({}));
    await act(async () => { await h.hook.result.current.handleDeleteMessage(other); });
    expect(h.moveMessagesToFolder.mock.calls[0]![0]).toBe("b:Papierkorb");
    expect(h.skips).toEqual([]);
  });

  it("says that nothing was deleted when every message lies in a read-only mailbox", async () => {
    const messages = [message("c", "c1"), message("c", "c2")];
    const h = deleteHarness(messages, () => Response.json({}));
    await act(async () => {
      await h.hook.result.current.handleDeleteMessagesByIds(["c1", "c2"], { selectedIds: ["c1", "c2"] });
    });
    expect(h.moveMessagesToFolder).not.toHaveBeenCalled();
    expect(h.calls).toEqual([]);
    expect(h.skips[0]).toMatchObject({ total: 2, skipped: [{ id: "c1" }, { id: "c2" }] });
    expect(h.notices).toEqual([]);
  });

  it("counts a 403 on permanent deletion as skipped", async () => {
    const messages = [message("a", "a1", "Trash"), message("b", "b1", "Papierkorb"), message("b", "b2", "Papierkorb")];
    const h = deleteHarness(messages, (call) => {
      if (call.path === "/api/accounts/b/messages/delete/bulk") return new Response(null, { status: 403 });
      if (call.path.endsWith("/delete")) return Response.json({ ok: true, action: "deleted" });
      return Response.json({});
    });
    await act(async () => {
      await h.hook.result.current.handleDeleteMessagesByIds(messages.map((item) => item.id), { selectedIds: messages.map((item) => item.id) });
    });
    expect(h.skips[0]).toMatchObject({ total: 3, skipped: [{ id: "b1", accountId: "b" }, { id: "b2", accountId: "b" }] });
    expect(h.notices[0]?.title).toBe("Message deleted permanently.");
  });
});

describe("read state and archive across mailboxes", () => {
  function mutationsHarness(respond: (call: Call) => Response | undefined) {
    const { calls, apiFetch } = recordingFetch(respond);
    const skips: MailboxSkipReport[] = [];
    const errors: string[] = [];
    const noop = () => {};
    const hook = renderHook(() => useMessageMutations({
      activeAccountId: "a", searchScope: "folder", viewMessage: null, hasFilteredSearchCriteria: false,
      apiFetch, readErrorMessage: async () => "Synthetic error", reportError: (error) => { errors.push(error); },
      pushNotice: noop, updateMessagesWithCurrentResultPrune: noop, setViewMessage: noop, setActiveMessageId: noop,
      setFolders: noop, setPendingMessageActions: noop, evictMessageCaches: noop, shouldKeepMessageInCurrentResults: () => true,
      undoMoveOperation: noop, confirmUnsubscribe: async () => false, applyMoveReconcileSuppression: noop,
      setActiveTopicSuggestionMessages: noop, updateThreadCacheWithFlags: noop, updateThreadCacheWithCategory: noop,
      queueFilteredSearchRefresh: noop, canEditMailbox, reportMailboxSkips: (report) => skips.push(report)
    }), { wrapper: I18nTestProvider });
    return { hook, calls, skips, errors };
  }

  it("marks read per mailbox and skips the read-only one", async () => {
    const h = mutationsHarness((call) => {
      if (!call.path.endsWith("flags/bulk")) return Response.json([]);
      return Response.json({ results: (call.body?.messageIds as string[]).map((messageId) => ({ messageId, flags: ["\\Seen"] })) });
    });
    const messages = [message("a", "a1"), message("b", "b1"), message("c", "c1")];
    await act(async () => { await h.hook.result.current.updateFlagStateBulk(messages, "seen", true); });
    expect(h.calls.filter((call) => call.path.endsWith("flags/bulk")).map((call) => [call.path, call.body?.messageIds])).toEqual([
      ["/api/accounts/a/messages/flags/bulk", ["a1"]],
      ["/api/accounts/b/messages/flags/bulk", ["b1"]]
    ]);
    expect(h.skips).toEqual([{ action: "markRead", total: 3, skipped: [{ id: "c1", accountId: "c", reason: "permission" }] }]);
    expect(h.errors).toEqual([]);
  });

  it("archives a message of another mailbox through its route; a read-only one is skipped without a request", async () => {
    const h = mutationsHarness((call) => Response.json({ action: "moved", archiveFolderId: "b:Archiv", messageId: "b1" }));
    let outcomes: string[] = [];
    await act(async () => {
      outcomes = [
        await h.hook.result.current.handleArchiveMessage(message("b", "b1")),
        await h.hook.result.current.handleArchiveMessage(message("c", "c1"), { quietDenied: true })
      ];
    });
    expect(outcomes).toEqual(["done", "denied"]);
    expect(h.calls.map((call) => call.path)).toEqual(["/api/accounts/b/messages/b1/archive"]);
    expect(h.skips).toEqual([]);
  });
});

describe("notice about skipped messages", () => {
  const accountById = new Map([
    ["c", { email: "info@example.test", name: "Info" }],
    ["d", { email: "team@example.test", name: "Team" }]
  ]);
  function noticeFor(report: MailboxSkipReport) {
    const notices: Array<{ type: string; title: string; description?: string; wrapDescription?: boolean }> = [];
    const hook = renderHook(() => useMailboxSkipNotice({ accountById, pushNotice: (notice) => notices.push(notice) }), {
      wrapper: ({ children }) => <I18nTestProvider locale="de">{children}</I18nTestProvider>
    });
    act(() => hook.result.current(report));
    return notices;
  }

  it("names the action, the count and the mailbox, and that the rest was done (German)", () => {
    expect(noticeFor({
      action: "delete", total: 12,
      skipped: ["1", "2", "3"].map((id) => ({ id, accountId: "c", reason: "permission" as const }))
    })).toEqual([{
      type: "warning",
      title: "3 von 12 Nachrichten nicht gelöscht",
      description: "3 von 12 Nachrichten wurden nicht gelöscht: keine Berechtigung im Postfach info@example.test. Die übrigen wurden gelöscht.",
      wrapDescription: true
    }]);
  });

  it("says when nothing could be done", () => {
    expect(noticeFor({
      action: "archive", total: 2,
      skipped: [{ id: "1", accountId: "c", reason: "permission" }, { id: "2", accountId: "d", reason: "permission" }]
    })[0]).toMatchObject({
      title: "2 Nachrichten nicht archiviert",
      description: "Keine der 2 Nachrichten wurde archiviert: keine Berechtigung in den Postfächern info@example.test, team@example.test."
    });
  });

  it("pushes nothing when nothing was skipped", () => {
    expect(noticeFor({ action: "move", total: 3, skipped: [] })).toEqual([]);
  });
});
