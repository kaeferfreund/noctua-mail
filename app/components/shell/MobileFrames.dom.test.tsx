import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { act, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import { render } from "@/lib/i18n/testRender";
import { createRef, useState, type ComponentProps } from "react";
import { Theme } from "@radix-ui/themes";
import MessageMenu from "@/app/components/mailclient/message/MessageMenu";
import ProcessStatusPopover from "@/app/components/mailclient/status/ProcessStatusPopover";
import ExceptionStatusPopover from "@/app/components/mailclient/status/ExceptionStatusPopover";

import MessageCardList from "@/app/components/mailclient/messagelist/MessageCardList";
import MessageTable from "@/app/components/mailclient/messagelist/MessageTable";
import mobileStyles from "./MobileFrames.module.css";
import MessageThreadList from "@/app/components/mailclient/messagelist/MessageThreadList";
import { createSelectionStore } from "@/app/components/mailclient/messagelist/selectionStore";
import { buildThreadTree, flattenThread, getThreadLatestDate } from "@/app/components/mailclient/messagelist/threadTree";
import type { MessageCardListProps, MessageThreadListProps } from "@/app/components/mailclient/messagelist/messageListViewTypes";
import StatusPanelFrame from "./StatusPanelFrame";
import { MobileStatusFocusContext } from "./MobileStatusFocus";
import { expectFocused } from "@/lib/testDomAssertions";

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
    const more = await page.findByRole("menuitem", { name: "More..." });
    expect(more.closest(`.${mobileStyles.messageMenu}`) !== null).toBe(true);
  });
  it("shows the shared process content inside a themed Sheet", async () => {
    const page = render(<Theme><ProcessStatusPopover open onOpenChange={noop} isSyncing={false}
      isRecomputingThreads isRecomputingCategories={false} syncingFolders={new Set()}
      syncProgressItems={[]} accountFolders={[]} /></Theme>);
    const sheet = await page.findByRole("dialog", { name: "Background tasks" });
    expect(sheet.getAttribute("data-slot")).toBe("sheet-content");
    expect(within(sheet).getByText("Recomputing threads…").closest(".radix-themes")).toBeTruthy();
  });
  it("keeps the exception content and clear handler in the mobile Sheet", async () => {
    let cleared = 0;
    const page = render(<Theme><ExceptionStatusPopover open onOpenChange={noop}
      exceptionEntries={[{ id: "synthetic-error", message: "Synthetic error", timestamp: 1792627200000 }]}
      onClearExceptions={() => { cleared++; }} formatRelativeTime={() => "just now"} /></Theme>);
    const sheet = await page.findByRole("dialog", { name: "Errors" });
    fireEvent.click(within(sheet).getByRole("button", { name: "Clear exceptions" }));
    expect(cleared).toBe(1);
  });
  it("starts every status Sheet with one visible title row: title, count, icon close, then the description", async () => {
    const page = render(<Theme><ExceptionStatusPopover open onOpenChange={noop}
      exceptionEntries={[{ id: "synthetic-error", message: "Synthetic error", timestamp: 1792627200000 }]}
      onClearExceptions={noop} formatRelativeTime={() => "just now"} /></Theme>);
    const sheet = await page.findByRole("dialog", { name: "Errors" });
    const title = sheet.querySelector<HTMLElement>('[data-slot="sheet-title"]')!;
    expect(title.textContent).toBe("Errors");
    expect(title.className).not.toContain("sr-only");
    expect(title.parentElement!.querySelector('[data-slot="badge"]')!.textContent).toBe("1");
    expect(within(sheet).getAllByText("Errors").length).toBe(1);
    const close = within(sheet).getByRole("button", { name: "Close" });
    expect(close.getAttribute("data-slot")).toBe("sheet-close");
    expect(close.textContent).toBe("Close");
    const description = within(sheet).getByText("See errors with timestamps and details.");
    expect(title.compareDocumentPosition(description) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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
      toggleTodoFlag: noop, toggleRowRead: noop, handleAddSuggestedThread: noop
    },
    helpers: {
      buildThreadTree, flattenThread, getThreadLatestDate, getGroupLabel: (group) => group.key,
      renderSelectIndicators: () => null, renderFolderBadges: () => null, renderQuickActions: () => null,
      renderMessageMenu: () => <MessageMenu {...menuProps()} />, handleShowRelated: noop, isTrashFolder: () => false
    }
  };
}

// The virtual list positions each row in an item with a fixed height; on
// phones the swipe wrapper sits between that item and the row.
const virtualItemHeight = (row: Element) => {
  let item = row.parentElement;
  while (item && !item.style.transform) item = item.parentElement;
  return item?.style.height;
};

describe("mobile message rows", () => {
  it("switches desktop narrow thread rows and virtual spacing together", () => {
    window.innerWidth = 1280;
    const props = threadListProps();
    const page = render(<Theme><MessageThreadList {...props} /></Theme>);
    const row = () => page.container.querySelector<HTMLElement>('[data-message-list-row]')!;
    expect(row().dataset.messageNarrow).toBe("true");
    expect(virtualItemHeight(row())).toBe("72px");
    page.rerender(<Theme><MessageThreadList {...props} state={{ ...props.state, listIsNarrow: false }} /></Theme>);
    expect(row().dataset.messageNarrow).toBe("false");
    expect(virtualItemHeight(row())).toBe("40px");
  });
  it("allocates 72px for Compact on mobile and 60px on desktop", () => {
    const props = threadListProps();
    const page = render(<Theme><MessageCardList {...props} state={{ ...props.state, isCompactView: true }} /></Theme>);
    // Rows remount when the swipe wrapper comes or goes at the breakpoint.
    const rows = () => [...page.container.querySelectorAll('[data-compact="true"]')];
    expect(rows()).toHaveLength(2);
    expect(rows().map((row) => virtualItemHeight(row))).toEqual(["72px", "72px"]);
    act(() => window.dispatchEvent(new Event("resize")));
    act(() => { window.innerWidth = 1280; window.dispatchEvent(new Event("resize")); });
    expect(rows().map((row) => virtualItemHeight(row))).toEqual(["60px", "60px"]);
  });
  it("keeps Table selection independent from unread and row activation on mobile", () => {
    const props = threadListProps();
    let selected = 0;
    const page = render(<Theme><MessageTable {...props} actions={{ ...props.actions, toggleMessageSelection: () => { selected++; } }} /></Theme>);
    const row = page.container.querySelector<HTMLElement>('[data-message-list-row]')!;
    const checkbox = within(row).getByRole("checkbox", { name: "Select message" });
    expect(checkbox.closest('[data-message-cell="unread"]') !== null).toBe(true);
    fireEvent.click(checkbox);
    expect(selected).toBe(1);
    expect(within(row).getByText("Unread") !== null).toBe(true);
  });

  it("marks unread rows with a ring on the sender icon instead of a dot", () => {
    for (const desktop of [false, true]) {
      window.innerWidth = desktop ? 1280 : 390;
      for (const layout of ["card", "compact", "table", "threads"] as const) {
        const props = threadListProps();
        const read = { ...message, id: "read", threadId: "read-thread", seen: true };
        const listProps: MessageCardListProps = {
          ...props,
          state: {
            ...props.state, isCompactView: layout === "compact", senderIconsEnabled: true,
            groupedMessages: [{ key: "Today", items: [message, read] }]
          }
        };
        const List = layout === "table" ? MessageTable : layout === "threads" ? MessageThreadList : MessageCardList;
        const page = render(<Theme><List {...listProps} /></Theme>);
        const [unreadRow, readRow] = [...page.container.querySelectorAll<HTMLElement>('[data-message-list-row]')];
        const ring = (row: HTMLElement) => row.querySelector('[data-message-cell="from"] [data-unread]') !== null;
        expect([layout, desktop, ring(unreadRow), ring(readRow)]).toEqual([layout, desktop, true, false]);
        // Screen readers still hear the state; read rows say nothing extra.
        expect(within(unreadRow).getByText("Unread").closest('[data-message-cell="from"]') !== null).toBe(true);
        expect(within(readRow).queryByText("Unread")).toBe(null);
        expect(page.container.querySelector('[data-unread-dot], [title^="Mark as"], [aria-label^="Mark as"]')).toBe(null);
        cleanup();
      }
    }
  });

  it("allocates nonoverlapping 72px virtual rows and restores desktop density at the breakpoint", () => {
    const props = threadListProps();
    const page = render(<Theme><MessageThreadList {...props} /></Theme>);
    const rows = () => [...page.container.querySelectorAll('[data-message-list-row]')];
    expect(rows()).toHaveLength(2);
    expect(rows().map((row) => virtualItemHeight(row))).toEqual(["72px", "72px"]);
    expect(rows()[0].querySelector('[data-message-subject]')!.textContent).toBe("Synthetic subject");
    expect(rows()[0].querySelector('[data-message-cell="actions"] button[aria-label="Message actions"]')).toBeTruthy();
    props.state.listIsNarrow = false;
    page.rerender(<Theme><MessageThreadList {...props} /></Theme>);
    act(() => window.dispatchEvent(new Event("resize")));
    act(() => { window.innerWidth = 1280; window.dispatchEvent(new Event("resize")); });
    expect(rows().map((row) => virtualItemHeight(row))).toEqual(["40px", "40px"]);
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
    await waitFor(() => expectFocused(indicator));
  });
});
