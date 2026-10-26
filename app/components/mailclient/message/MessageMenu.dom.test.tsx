// Uses the shared resolver and actions through the real row menu.
import { afterEach, describe, expect, it } from "bun:test";
import { act, cleanup, fireEvent } from "@testing-library/react";
import { render } from "@/lib/i18n/testRender";
import type { ComponentProps } from "react";
import { Theme } from "@radix-ui/themes";
import { TooltipProvider } from "@/app/components/ui/tooltip";
import type { Message } from "@/lib/data";
import { bindRowReadAction, resolveSelectionActionTargets } from "../messagelist/selectionActions";
import { ScheduledSendProvider } from "../scheduledSend/ScheduledSend";
import MessageMenu from "./MessageMenu";

afterEach(cleanup);
const noop = () => {};

function setup({ collapsed = true, allRead = false, origin = "list", single = false, supportsThreads = true, inTrash = false, isDraft = false }: {
  isDraft?: boolean;
  collapsed?: boolean;
  inTrash?: boolean;
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
  const root = { ...makeMessage("root", true), draft: isDraft };
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
  const deletes: Array<[string, boolean | undefined]> = [];
  const archives: string[] = [];
  const props: ComponentProps<typeof MessageMenu> = {
    message: root, origin, isDraft, readAction, pendingMessageActions: new Set(),
    openCompose: noop,
    updateFlagState: (message, flag, value) => {
      flags.push([message.id, flag, value]);
      if (flag === "seen") message.seen = value;
    },
    toggleTodoFlag: message => { todos.push(message.id); }, clearTodoFlag: noop,
    handleMarkSpam: noop, handleMarkNotSpam: noop,
    handleArchiveMessage: message => { archives.push(message.id); },
    handleSetCategory: noop,
    handleDeleteMessage: (message, options) => { deletes.push([message.id, options?.allowThreadDeletion]); },
    handleUnsubscribe: noop,
    handleDownloadEml: noop, handleResyncMessage: noop, handleOpenInNewWindow: noop,
    handleOpenHtmlInNewWindow: noop, onShowRelated: noop, onShowThread: noop,
    allTopics: [], onFetchSuggestions: async () => [], onAssignTopics: noop,
    onToggleTopic: noop, onGetRecentFolders: () => [], onMoveToFolder: noop,
    onMoveTo: noop, isTrashFolder: () => inTrash, isSpamFolder: () => false
  };
  let rowClicks = 0;
  const tree = () => <Theme><TooltipProvider><ScheduledSendProvider value={{ byDraftId: new Map(),
    unschedule: async () => {}, sendNow: async () => {}, schedule: noop }}><div onClick={() => { rowClicks++; }}><MessageMenu {...props} /></div></ScheduledSendProvider></TooltipProvider></Theme>;
  const view = render(tree());
  const markPending = () => { props.pendingMessageActions.add(root.id); view.rerender(tree()); };
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
  return { view, open, choose, markPending, messages, calls, flags, todos, deletes, archives, resolutions: () => resolutions, rowClicks: () => rowClicks };
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

describe("row menu delete", () => {
  const itemsWithSeparators = (menu: ReturnType<typeof setup>) =>
    Array.from(menu.view.getByRole("menu").querySelectorAll('[role="menuitem"], [role="separator"]'))
      .map(node => node.getAttribute("role") === "separator" ? "---" : node.textContent);

  for (const origin of ["list", "table", "thread"] as const) {
    it(`${origin}: offers Delete as its own group right after the compose actions`, async () => {
      const menu = setup({ origin });
      await menu.open();
      expect(itemsWithSeparators(menu).slice(0, 7)).toEqual([
        "Reply", "Reply all", "Forward", "Edit as New", "---", "Delete", "---"
      ]);
      await menu.choose("Delete");
      expect(menu.deletes).toEqual([["root", origin !== "thread"]]);
    });
  }
  it("is reachable with arrow keys and triggers on Enter like Archive", async () => {
    const menu = setup({ origin: "table" });
    await menu.open();
    const items = menu.view.getAllByRole("menuitem");
    const deleteIndex = items.findIndex(item => item.textContent === "Delete");
    expect(deleteIndex).toBe(4);
    await act(async () => { items[0].focus(); });
    for (let step = 0; step < deleteIndex; step++) {
      await act(async () => {
        fireEvent.keyDown(document.activeElement as Element, { key: "ArrowDown" });
        await new Promise(resolve => setTimeout(resolve, 0));
      });
    }
    expect(document.activeElement?.textContent).toBe("Delete");
    await act(async () => {
      fireEvent.keyDown(document.activeElement as Element, { key: "Enter" });
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    expect(menu.deletes).toEqual([["root", true]]);
    expect(menu.archives).toEqual([]);
  });
  it("labels the entry as permanent delete in the Trash folder", async () => {
    const menu = setup({ inTrash: true });
    await menu.open();
    await menu.choose("Delete permanently");
    expect(menu.deletes).toEqual([["root", true]]);
  });
});

describe("row menu focus return", () => {
  it("returns keyboard focus to ⋮ after the menu closes without reopening its tooltip", async () => {
    // Escape is a keyboard interaction, so browsers mark the returned focus :focus-visible.
    const originalMatches = Element.prototype.matches;
    Element.prototype.matches = function (this: Element, selector: string) {
      return selector === ":focus-visible" ? this === document.activeElement : originalMatches.call(this, selector);
    } as typeof Element.prototype.matches;
    try {
      const menu = setup();
      const trigger = menu.view.getByRole("button", { name: "Message actions" });
      act(() => { trigger.focus(); });
      await menu.open();
      // Radix returns focus from a 0 ms timer after the menu unmounts. No
      // waitFor here: its polling starves happy-dom's timers for seconds.
      await act(async () => {
        fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
        await new Promise(resolve => setTimeout(resolve, 50));
      });
      expect(menu.view.queryByRole("menu")).toBeNull();
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 50)); });
      expect(document.activeElement).toBe(trigger);
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 800)); });
      expect(menu.view.queryByRole("tooltip")).toBeNull();
    } finally {
      Element.prototype.matches = originalMatches;
    }
  });
});


it("disables scheduling when an action becomes pending while the draft menu is open", async () => {
  const menu = setup({ single: true, isDraft: true });
  await menu.open();
  expect(menu.view.getByRole("menuitem", { name: "Schedule send …" }).getAttribute("aria-disabled")).not.toBe("true");
  menu.markPending();
  expect(menu.view.getByRole("menuitem", { name: "Schedule send …" }).getAttribute("aria-disabled")).toBe("true");
});

it("portal menu actions never bubble into the owning message row", async () => {
  const menu = setup();
  await menu.open();
  await menu.choose("Mark as read");
  expect(menu.rowClicks()).toBe(0);
  expect(menu.calls).toHaveLength(1);
});
