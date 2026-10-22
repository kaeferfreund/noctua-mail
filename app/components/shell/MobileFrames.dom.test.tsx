import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { Theme } from "@radix-ui/themes";
import MessageMenu from "@/app/components/mailclient/message/MessageMenu";
import ProcessStatusPopover from "@/app/components/mailclient/status/ProcessStatusPopover";
import ExceptionStatusPopover from "@/app/components/mailclient/status/ExceptionStatusPopover";

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
