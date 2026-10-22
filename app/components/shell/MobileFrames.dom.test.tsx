import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { act, cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import { createRef, useState, type ComponentProps } from "react";
import { Theme } from "@radix-ui/themes";
import MessageMenu from "@/app/components/mailclient/message/MessageMenu";
import ProcessStatusPopover from "@/app/components/mailclient/status/ProcessStatusPopover";
import ExceptionStatusPopover from "@/app/components/mailclient/status/ExceptionStatusPopover";

import MessageThreadList from "@/app/components/mailclient/messagelist/MessageThreadList";
import { createSelectionStore } from "@/app/components/mailclient/messagelist/selectionStore";
import { buildThreadTree, flattenThread, getThreadLatestDate } from "@/app/components/mailclient/messagelist/threadTree";
import UnreadDot from "@/app/components/mailclient/messagelist/UnreadDot";
import type { MessageThreadListProps } from "@/app/components/mailclient/messagelist/messageListViewTypes";
import StatusPanelFrame from "./StatusPanelFrame";
import { MobileStatusFocusContext } from "./MobileStatusFocus";

const originalWidth = window.innerWidth;
beforeEach(() => { window.innerWidth = 390; });
afterEach(() => { cleanup(); window.innerWidth = originalWidth; });
const noop = () => {};
const message: ComponentProps<typeof MessageMenu>["message"] = {
  id: "synthetic-message", threadId: "synthetic-thread", preview: "Synthetic preview", dateValue: 1792627200000, accountId: "synthetic-account", folderId: "synthetic-inbox",
  subject: "Synthetic subject", from: "sender@example.test", to: "recipient@example.test",
  date: "2026-10-22T00:00:00.000Z", seen: false, flagged: false, answered: false, draft: false,
  body: "Synthetic body", attachments: []
};
function menuProps(onRead = noop): ComponentProps<typeof MessageMenu> {
  return {
    message, isDraft: false, pendingMessageActions: new Set(), openCompose: noop,
    updateFlagState: onRead, toggleTodoFlag: noop, clearTodoFlag: noop,
    handleMarkSpam: noop, handleMarkNotSpam: noop, handleArchiveMessage: noop,
    handleSetCategory: noop, handleDeleteMessage: noop, handleUnsubscribe: noop,
    handleDownloadEml: noop, handleResyncMessage: noop, handleOpenInNewWindow: noop,
    handleOpenHtmlInNewWindow: noop, onShowRelated: noop, onShowThread: noop,
    allTopics: [{ id: "topic", name: "Synthetic topic", color: "iris", accountId: "synthetic-account", imapKeyword: "synthetic-topic", createdAt: 1, updatedAt: 1 }],
    onFetchSuggestions: async () => [], onAssignTopics: noop, onToggleTopic: noop,
    onGetRecentFolders: () => [], onMoveToFolder: noop, onMoveTo: noop,
    isTrashFolder: () => false, isSpamFolder: () => false
  };
}

describe("mobile kept component frames", () => {
  it("renders existing message actions in the shadcn menu and invokes the same handler", async () => {
    let reads = 0;
    const page = render(<Theme><MessageMenu {...menuProps(() => { reads++; })} /></Theme>);
    fireEvent.keyDown(page.getByRole("button", { name: "Message actions" }), { key: "Enter" });
    const item = await page.findByRole("menuitem", { name: "Mark as read" });
    expect(item.getAttribute("data-slot")).toBe("dropdown-menu-item");
    expect(item.closest(".radix-themes")).toBeTruthy();
    fireEvent.click(item);
    expect(reads).toBe(1);
  });
  it("keeps the existing Move to submenu working inside the shadcn root", async () => {
    const page = render(<Theme><MessageMenu {...menuProps()} /></Theme>);
    fireEvent.keyDown(page.getByRole("button", { name: "Message actions" }), { key: "Enter" });
    const move = await page.findByRole("menuitem", { name: "Move to" });
    fireEvent.keyDown(move, { key: "ArrowRight" });
    expect(await page.findByRole("menuitem", { name: "More..." })).toBeTruthy();
  });
  it("shows the shared process content inside a themed Sheet", async () => {
    const page = render(<Theme><ProcessStatusPopover open onOpenChange={noop} isSyncing={false}
      isRecomputingThreads isRecomputingCategories={false} syncingFolders={new Set()}
      syncProgressItems={[]} accountFolders={[]} /></Theme>);
    const sheet = await page.findByRole("dialog", { name: "Processes" });
    expect(sheet.getAttribute("data-slot")).toBe("sheet-content");
    expect(within(sheet).getByText("Recomputing threads…").closest(".radix-themes")).toBeTruthy();
  });
  it("keeps the exception content and clear handler in the mobile Sheet", async () => {
    let cleared = 0;
    const page = render(<Theme><ExceptionStatusPopover open onOpenChange={noop} exceptionEntries={[]}
      onClearExceptions={() => { cleared++; }} formatRelativeTime={() => "just now"} /></Theme>);
    const sheet = await page.findByRole("dialog", { name: "Exceptions" });
    fireEvent.click(within(sheet).getByRole("button", { name: "Clear exceptions" }));
    expect(cleared).toBe(1);
  });
});

function threadListProps(onSelect = noop): MessageThreadListProps {
  return {
    state: {
      groupedMessages: [{ key: "Today", items: [message, { ...message, id: "second", threadId: "second-thread" }] }],
      visibleMessages: [], selectionStore: createSelectionStore(), draggingMessageIds: new Set(),
      collapsedGroups: {}, collapsedThreads: {}, pendingMessageActions: new Set(),
      supportsThreads: true, includeThreadAcrossFolders: true, searchScope: "folder",
      activeFolderId: message.folderId!, messageById: new Map([[message.id, message]]), messageTopicsById: new Map(),
      suggestedThreadIds: new Set(), pendingSuggestedThreadIds: new Set(), sortDir: "desc",
      showMessageSize: false, listIsNarrow: true, preferToDisplay: false, activeTopic: null, senderIconsEnabled: false
    },
    refs: { scrollRef: createRef() },
    actions: {
      setLastSelectedIdRef: noop, setSortKey: noop, setSortDir: noop, setCollapsedGroups: noop, setCollapsedThreads: noop,
      handleMessageDragStart: noop, handleMessageDragEnd: noop, handleRowClick: noop,
      handleSelectMessage: onSelect, selectRangeTo: noop, toggleMessageSelection: noop,
      selectCollapsedThread: noop, handleDeleteMessage: noop, toggleFlaggedFlag: noop,
      toggleTodoFlag: noop, handleAddSuggestedThread: noop
    },
    helpers: {
      buildThreadTree, flattenThread, getThreadLatestDate, getGroupLabel: (group) => group.key,
      renderUnreadDot: () => <UnreadDot seen={false} onToggle={noop} />,
      renderSelectIndicators: () => null, renderFolderBadges: () => null, renderQuickActions: () => null,
      renderMessageMenu: () => <MessageMenu {...menuProps()} />, handleShowRelated: noop, isTrashFolder: () => false
    }
  };
}

describe("mobile message rows", () => {
  it("allocates nonoverlapping 72px virtual rows and restores desktop density at the breakpoint", () => {
    const props = threadListProps();
    const page = render(<Theme><MessageThreadList {...props} /></Theme>);
    const rows = [...page.container.querySelectorAll('[data-message-list-row]')];
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.parentElement!.parentElement!.style.height)).toEqual(["72px", "72px"]);
    expect(rows[0].querySelector('[data-message-subject]')!.textContent).toBe("Synthetic subject");
    expect(rows[0].querySelector('[data-message-cell="actions"] button[aria-label="Message actions"]')).toBeTruthy();
    act(() => window.dispatchEvent(new Event("resize")));
    act(() => { window.innerWidth = 1280; window.dispatchEvent(new Event("resize")); });
    expect(rows.map((row) => row.parentElement!.parentElement!.style.height)).toEqual(["40px", "40px"]);
  });
  it("opens Message actions with Enter inside a real thread row without selecting it", async () => {
    let selected = 0;
    const page = render(<Theme><MessageThreadList {...threadListProps(() => { selected++; })} /></Theme>);
    const row = page.container.querySelector<HTMLElement>('[data-message-list-row]')!;
    fireEvent.keyDown(within(row).getByRole("button", { name: "Message actions" }), { key: "Enter" });
    expect(await page.findByRole("menuitem", { name: "Mark as read" })).toBeTruthy();
    expect(selected).toBe(0);
    fireEvent.keyDown(row, { key: "Enter" });
    expect(selected).toBe(1);
  });
});

describe("status Sheet focus", () => {
  it("restores the header indicator after Escape dismisses Processes", async () => {
    function Status() {
      const [open, setOpen] = useState(false);
      const indicator = createRef<HTMLButtonElement>();
      return <MobileStatusFocusContext.Provider value={indicator}>
        <button ref={indicator} onClick={() => setOpen(true)}>Synthetic indicator</button>
        <StatusPanelFrame open={open} onOpenChange={setOpen} title="Processes" trigger={null} contentProps={{}}>
          <button>Process detail</button>
        </StatusPanelFrame>
      </MobileStatusFocusContext.Provider>;
    }
    const page = render(<Theme><Status /></Theme>);
    const indicator = page.getByRole("button", { name: "Synthetic indicator" });
    fireEvent.click(indicator);
    const sheet = await page.findByRole("dialog", { name: "Processes" });
    fireEvent.keyDown(sheet, { key: "Escape" });
    await waitFor(() => expect(page.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(indicator));
  });
});
