// Uses the shared resolver and actions through the real row menu.
import { afterEach, describe, expect, it } from "bun:test";
import { act, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { render } from "@/lib/i18n/testRender";
import type { ComponentProps } from "react";
import { Theme } from "@radix-ui/themes";
import { TooltipProvider } from "@/app/components/ui/tooltip";
import type { Message } from "@/lib/data";
import { bindRowReadAction, resolveSelectionActionTargets } from "../messagelist/selectionActions";
import MessageMenu from "./MessageMenu";

afterEach(cleanup);
const noop = () => {};

function setup({ collapsed = true, allRead = false, origin = "list", single = false, supportsThreads = true }: {
  collapsed?: boolean;
  allRead?: boolean;
  origin?: "list" | "table" | "thread";
  single?: boolean;
  supportsThreads?: boolean;
} = {}) {
  const makeMessage = (id: string, seen: boolean): Message => ({
    id, seen, threadId: "conversation", subject: "Synthetic conversation",
    from: "Alice <alice@example.test>", to: "Bob <bob@example.test>",
    preview: "", date: new Date(0).toISOString(), dateValue: 0,
    folderId: "acc:INBOX", accountId: "acc", body: ""
  });
  // The representative is read even when another message is unread.
  const root = makeMessage("root", true);
  const reply = makeMessage("reply", allRead);
  const messages = single ? [root] : [root, reply];
  let resolutions = 0;
  const calls: Array<[string[], boolean]> = [];
  const readAction = collapsed && !single && supportsThreads
    ? bindRowReadAction(root.id, allRead, {
        markRead: ({ threadIds }) => {
          calls.push([threadIds, true]);
          messages.forEach(m => { if (threadIds.includes(m.id)) m.seen = true; });
        },
        markUnread: ({ threadIds }) => {
          calls.push([threadIds, false]);
          messages.forEach(m => { if (threadIds.includes(m.id)) m.seen = false; });
        }
      }, selectedIds => {
        resolutions++;
        return resolveSelectionActionTargets({
          selectedIds, activeMessageId: "unrelated-active-message",
          visibleMessages: [{ message: root, depth: 0, threadId: "conversation" }],
          collapsedThreads: { conversation: collapsed }, threadScopeMessages: messages,
          supportsThreads
        });
      })
    : undefined;
  const flags: Array<[string, string, boolean]> = [];
  const todos: string[] = [];
  const props: ComponentProps<typeof MessageMenu> = {
    message: root, origin, isDraft: false, readAction, pendingMessageActions: new Set(),
    openCompose: noop,
    updateFlagState: (message, flag, value) => {
      flags.push([message.id, flag, value]);
      if (flag === "seen") message.seen = value;
    },
    toggleTodoFlag: message => { todos.push(message.id); }, clearTodoFlag: noop,
    handleMarkSpam: noop, handleMarkNotSpam: noop, handleArchiveMessage: noop,
    handleSetCategory: noop, handleDeleteMessage: noop, handleUnsubscribe: noop,
    handleDownloadEml: noop, handleResyncMessage: noop, handleOpenInNewWindow: noop,
    handleOpenHtmlInNewWindow: noop, onShowRelated: noop, onShowThread: noop,
    allTopics: [], onFetchSuggestions: async () => [], onAssignTopics: noop,
    onToggleTopic: noop, onGetRecentFolders: () => [], onMoveToFolder: noop,
    onMoveTo: noop, isTrashFolder: () => false, isSpamFolder: () => false
  };
  const view = render(<Theme><TooltipProvider><MessageMenu {...props} /></TooltipProvider></Theme>);
  const open = async () => {
    await act(async () => {
      fireEvent.keyDown(view.getByRole("button", { name: "Message actions" }), { key: "Enter" });
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    await view.findByRole("menu");
  };
  const choose = async (name: string) => {
    await act(async () => {
      fireEvent.click(view.getByRole("menuitem", { name }));
      await new Promise(resolve => setTimeout(resolve, 0));
    });
  };
  return { view, open, choose, messages, calls, flags, todos, resolutions: () => resolutions };
}

describe("row read/unread menu", () => {
  for (const origin of ["list", "table"] as const) {
    it(`${origin}: mixed collapsed thread offers read and marks the whole thread read lazily`, async () => {
      const menu = setup({ origin });
      expect(menu.resolutions()).toBe(0);
      await menu.open();
      expect(menu.resolutions()).toBe(0);
      await menu.choose("Mark as read");
      expect(menu.resolutions()).toBe(1);
      expect(menu.calls).toEqual([[["root", "reply"], true]]);
      expect(menu.messages.every(m => m.seen)).toBe(true);
      expect(menu.flags).toEqual([]);
    });
    it(`${origin}: all-read collapsed thread marks every message unread`, async () => {
      const menu = setup({ origin, allRead: true });
      await menu.open();
      await menu.choose("Mark as unread");
      expect(menu.calls).toEqual([[["root", "reply"], false]]);
      expect(menu.messages.every(m => !m.seen)).toBe(true);
    });
  }
  for (const options of [{ collapsed: false }, { single: true }, { supportsThreads: false }, { origin: "thread" as const }]) {
    it(`keeps read state and updates per message for ${JSON.stringify(options)}`, async () => {
      const menu = setup(options);
      await menu.open();
      await menu.choose("Mark as unread");
      expect(menu.flags).toEqual([["root", "seen", false]]);
      expect(menu.calls).toEqual([]);
      expect(menu.resolutions()).toBe(0);
    });
  }
  it("keeps Flag per representative message on a collapsed row", async () => {
    const menu = setup();
    await menu.open();
    await menu.choose("Flag");
    expect(menu.flags).toEqual([["root", "flagged", true]]);
    expect(menu.resolutions()).toBe(0);
  });
  it("keeps To-Do per representative message on a collapsed row", async () => {
    const menu = setup();
    await menu.open();
    await menu.choose("Mark as To-Do");
    expect(menu.todos).toEqual(["root"]);
    expect(menu.resolutions()).toBe(0);
  });
});

describe("row menu focus return", () => {
  it("returns keyboard focus to ⋮ after the menu closes without reopening its tooltip", async () => {
    // Escape is a keyboard interaction, so browsers mark the returned focus :focus-visible.
    const originalMatches = Element.prototype.matches;
    Element.prototype.matches = function (this: Element, selector: string) {
      return selector === ":focus-visible" ? this === document.activeElement : originalMatches.call(this, selector);
    };
    try {
      const menu = setup();
      const trigger = menu.view.getByRole("button", { name: "Message actions" });
      act(() => { trigger.focus(); });
      await menu.open();
      await act(async () => {
        fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
        await new Promise(resolve => setTimeout(resolve, 50));
      });
      expect(menu.view.queryByRole("menu")).toBeNull();
      await waitFor(() => expect(document.activeElement).toBe(trigger));
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 800)); });
      expect(menu.view.queryByRole("tooltip")).toBeNull();
    } finally {
      Element.prototype.matches = originalMatches;
    }
  });
});
