import { afterEach, describe, expect, it, mock } from "bun:test";
import { useEffect, useRef, useState } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { render } from "@/lib/i18n/testRender";
import { Theme } from "@radix-ui/themes";
import { TooltipProvider } from "@/app/components/ui/tooltip";
import type { Message } from "@/lib/data";
import { useMessageMutations } from "../useMessageMutations";
import SelectionActionsMenu from "./SelectionActionsMenu";
import { bindSelectionActions, type SelectionActions } from "./selectionActions";
import { createSelectionStore } from "./selectionStore";
import { usePruneMessageSelection } from "./usePruneMessageSelection";

afterEach(cleanup);

const messages: Message[] = ["first", "second", "third"].map((id) => ({
  id, threadId: `thread-${id}`, subject: `Subject ${id}`,
  from: "alice@example.test", to: "bob@example.test", preview: "",
  date: new Date(0).toISOString(), dateValue: 0,
  folderId: "acc:INBOX", accountId: "acc", body: ""
}));

function setupArchive({ failedId, active = "", allFolders = false }: {
  failedId?: string; active?: string; allFolders?: boolean;
} = {}) {
  const store = createSelectionStore();
  store.setSelection(new Set(["first", "second"]));
  const reportError = mock(() => {});
  const viewRef = { current: null as Message | null };
  let archive: () => Promise<void> = async () => {};
  let activeId = active;
  function Harness() {
    const [currentMessages, setMessages] = useState(messages);
    const [activeMessageId, setActiveMessageId] = useState(active);
    const [viewMessage, setViewMessage] = useState(messages.find((message) => message.id === active) ?? null);
    const lastSelectedIdRef = useRef<string | null>("second");
    usePruneMessageSelection(currentMessages, store, lastSelectedIdRef);
    const { handleArchiveMessage } = useMessageMutations({
      activeAccountId: "acc", searchScope: allFolders ? "all" : "folder", viewMessage,
      hasFilteredSearchCriteria: false,
      apiFetch: async (input) => String(input).includes(`/${failedId}/`)
        ? new Response(null, { status: 500 })
        : Response.json({ action: "moved", archiveFolderId: "acc:Archive" }),
      readErrorMessage: async () => "Archive failed.", reportError, pushNotice: () => {},
      updateMessagesWithCurrentResultPrune: (updater) => setMessages((prev) => prev.flatMap((message) => {
        const updated = updater(message);
        return updated && (allFolders || updated.folderId === "acc:INBOX") ? [updated] : [];
      })),
      setViewMessage, setActiveMessageId, setFolders: () => {}, setPendingMessageActions: () => {},
      evictMessageCaches: () => {},
      shouldKeepMessageInCurrentResults: (message) => allFolders || message.folderId === "acc:INBOX",
      undoMoveOperation: () => {}, confirmUnsubscribe: async () => false,
      applyMoveReconcileSuppression: () => {}, setActiveTopicSuggestionMessages: () => {},
      updateThreadCacheWithFlags: () => {}, updateThreadCacheWithCategory: () => {},
      queueFilteredSearchRefresh: () => {}
    });
    useEffect(() => {
      activeId = activeMessageId;
      viewRef.current = viewMessage;
      archive = async () => {
        // Same per-target archive path used by the shared selectionActions.
        const selected = new Set(store.getIds());
        for (const target of currentMessages.filter((message) => selected.has(message.id))) {
          await handleArchiveMessage(target);
        }
      };
    }, [activeMessageId, currentMessages, handleArchiveMessage, viewMessage]);
    const actions: SelectionActions = {
      markRead: () => {}, markUnread: () => {}, toggleFlag: () => {}, toggleTodo: () => {},
      moveToFolder: () => {}, moveToOther: () => {}, addTopic: () => {},
      archive: () => { void archive(); }, remove: () => {}, copyToAccount: () => {}, moveToAccount: () => {}
    };
    return <Theme><TooltipProvider><SelectionActionsMenu
      selectionStore={store} hasActiveMessage={Boolean(activeMessageId)}
      actions={bindSelectionActions(actions, () => ({ ids: [...store.getIds()], threadIds: [...store.getIds()] }))}
      allTopics={[]} hasOtherAccounts={false} onGetRecentFolders={() => []}
      onSelectAll={() => {}} onClearSelection={() => store.clearSelection()}
    /></TooltipProvider></Theme>;
  }
  const view = render(<Harness />);
  return { view, store, reportError, viewRef, activeId: () => activeId, archive: () => act(async () => { await archive(); }) };
}

describe("selection after messages leave the list", () => {
  it("bulk archive drops the header count and disables the menu", async () => {
    const fixture = setupArchive();
    expect(fixture.view.getByRole("button", { name: "Message actions: 2 selected" })).toBeTruthy();
    await fixture.archive();
    expect(fixture.store.getIds().size).toBe(0);
    expect(fixture.view.getByRole("button", { name: "Message actions: nothing selected" }).hasAttribute("disabled")).toBe(true);
  });

  it("keeps failed archive targets selected with an accurate header count", async () => {
    const fixture = setupArchive({ failedId: "second" });
    await fixture.archive();
    expect([...fixture.store.getIds()]).toEqual(["second"]);
    expect(fixture.view.getByRole("button", { name: "Message actions: 1 selected" }).hasAttribute("disabled")).toBe(false);
    expect(fixture.reportError).toHaveBeenCalledTimes(1);
  });

  it("preserves the existing reader transition when the open message is archived", async () => {
    const fixture = setupArchive({ active: "first" });
    await fixture.archive();
    expect(fixture.viewRef.current).toBeNull();
    expect(fixture.activeId()).toBe("");
    expect(fixture.store.getIds().size).toBe(0);
  });

  it("keeps selection when archived messages remain in all-folder results", async () => {
    const fixture = setupArchive({ allFolders: true });
    await fixture.archive();
    expect([...fixture.store.getIds()]).toEqual(["first", "second"]);
    expect(fixture.view.getByRole("button", { name: "Message actions: 2 selected" })).toBeTruthy();
  });

  it("prunes move/account/topic removals, resets the range anchor and keeps unrelated selection", () => {
    const store = createSelectionStore("first");
    store.setSelection(new Set(["first", "second", "third"]));
    const anchor = { current: "second" as string | null };
    const hook = renderHook(({ current }) => usePruneMessageSelection(current, store, anchor), {
      initialProps: { current: messages }
    });
    hook.rerender({ current: [messages[2]] });
    expect([...store.getIds()]).toEqual(["third"]);
    expect(store.getActiveId()).toBeNull();
    expect(anchor.current).toBeNull();
  });

  it("keeps hidden thread members and topic suggestions that remain in the message scope", () => {
    const store = createSelectionStore("second");
    store.setSelection(new Set(["first", "second"]));
    const anchor = { current: "second" as string | null };
    const snapshot = store.getSnapshot();
    renderHook(() => usePruneMessageSelection(messages, store, anchor));
    expect(store.getSnapshot()).toBe(snapshot);
    expect(anchor.current).toBe("second");
  });

  it("does not alter selection after a copy that leaves source messages in place", () => {
    const store = createSelectionStore();
    store.setSelection(new Set(["first", "second"]));
    const anchor = { current: "second" as string | null };
    const hook = renderHook(({ current }) => usePruneMessageSelection(current, store, anchor), {
      initialProps: { current: messages }
    });
    const snapshot = store.getSnapshot();
    hook.rerender({ current: [...messages] });
    expect(store.getSnapshot()).toBe(snapshot);
  });
});
