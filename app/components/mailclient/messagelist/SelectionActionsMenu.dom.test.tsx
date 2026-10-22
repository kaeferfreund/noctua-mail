// Uses the existing happy-dom harness through bun run test:dom.
import { afterEach, describe, expect, it } from "bun:test";
import { act, cleanup, fireEvent, render, within } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { TooltipProvider } from "@/app/components/ui/tooltip";
import type { Message } from "@/lib/data";
import BulkActionContextMenu from "./BulkActionContextMenu";
import SelectionActionsMenu from "./SelectionActionsMenu";
import {
  bindSelectionActions,
  resolveSelectionActionTargets,
  type SelectionActions,
  type SelectionActionTargets
} from "./selectionActions";
import { createSelectionStore, type SelectionStore } from "./selectionStore";

afterEach(cleanup);

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

// A collapsed two-message thread (shown as its root row) and two single messages.
const root = makeMessage("root", "thread-1");
const reply = makeMessage("reply", "thread-1");
const first = makeMessage("first", "thread-2");
const second = makeMessage("second", "thread-3");

type Call = [keyof SelectionActions, SelectionActionTargets, ...unknown[]];

function renderMenu({
  selected = [],
  activeMessageId = null
}: { selected?: string[]; activeMessageId?: string | null } = {}) {
  const store = createSelectionStore(activeMessageId);
  store.setSelection(new Set(selected));
  const calls: Call[] = [];
  const record =
    (name: keyof SelectionActions) =>
    (targets: SelectionActionTargets, ...args: unknown[]) => {
      calls.push([name, targets, ...args]);
    };
  const shared: SelectionActions = {
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
  // Bound exactly like MailClient binds the header menu.
  const actions = bindSelectionActions(shared, () =>
    resolveSelectionActionTargets({
      selectedIds: store.getIds(),
      activeMessageId,
      visibleMessages: [
        { message: root, depth: 0, threadId: "thread-1" },
        { message: first, depth: 0, threadId: "thread-2" },
        { message: second, depth: 0, threadId: "thread-3" }
      ],
      collapsedThreads: {},
      threadScopeMessages: [root, reply, first, second],
      supportsThreads: true
    })
  );
  let selectAllCalls = 0;
  const view = render(
    <Theme>
      <TooltipProvider>
        <SelectionActionsMenu
          selectionStore={store}
          hasActiveMessage={activeMessageId !== null}
          actions={actions}
          allTopics={[]}
          hasOtherAccounts={false}
          onGetRecentFolders={() => []}
          onSelectAll={() => {
            selectAllCalls += 1;
          }}
          onClearSelection={() => store.clearSelection()}
        />
      </TooltipProvider>
    </Theme>
  );
  return { view, store, calls, selectAllCalls: () => selectAllCalls };
}

// Radix positions and animates menus asynchronously; let those updates land
// inside act so they do not leak into the next assertion.
async function interact(fire: () => void) {
  await act(async () => {
    fire();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

const trigger = (view: ReturnType<typeof render>) =>
  view.getByRole("button", { name: /^Message actions/ });

async function openMenu(view: ReturnType<typeof render>) {
  await interact(() => {
    fireEvent.keyDown(trigger(view), { key: "Enter" });
  });
  return within(view.getByRole("menu"));
}

async function choose(view: ReturnType<typeof render>, name: RegExp | string) {
  const menu = await openMenu(view);
  await interact(() => {
    fireEvent.click(menu.getByRole("menuitem", { name }));
  });
}

describe("header selection menu", () => {
  it("is present but disabled with nothing to act on", () => {
    const { view } = renderMenu();
    const button = trigger(view);
    expect(button.getAttribute("aria-label")).toBe("Message actions: nothing selected");
    expect(button.hasAttribute("disabled")).toBe(true);
  });

  it("acts on the open message when nothing is selected", async () => {
    const { view, calls } = renderMenu({ activeMessageId: "first" });
    expect(trigger(view).getAttribute("aria-label")).toBe("Message actions: open message");
    expect(trigger(view).hasAttribute("disabled")).toBe(false);
    await choose(view, /Mark as read/);
    expect(calls).toEqual([["markRead", { ids: ["first"], threadIds: ["first"] }]]);
  });

  it("names the count with two or more selected and follows the selection", async () => {
    const { view, store } = renderMenu({ selected: ["first"] });
    expect(trigger(view).getAttribute("aria-label")).toBe("Message actions: 1 selected");
    expect(view.queryByText("1 selected")).toBeNull();

    await interact(() => store.setSelection(new Set(["first", "second", "root"])));
    const button = trigger(view);
    expect(button.getAttribute("aria-label")).toBe("Message actions: 3 selected");
    // The visible label in a wide header; a badge on the icon in a narrow one.
    // happy-dom does not evaluate container queries, so assert the variants.
    const label = within(button).getByText("3 selected");
    expect(label.classList.contains("hidden")).toBe(true);
    expect(label.classList.contains("@3xl/header:inline-block")).toBe(true);
    const badge = within(button).getByText("3");
    expect(badge.getAttribute("aria-hidden")).toBe("true");
    expect(badge.classList.contains("@3xl/header:hidden")).toBe(true);
  });

  it("lists the bulk actions with their shortcut hints", async () => {
    const { view } = renderMenu({ selected: ["first", "second"] });
    const menu = await openMenu(view);
    expect(menu.getByText("2 selected")).toBeTruthy();
    const items = menu.getAllByRole("menuitem").map((item) => item.textContent);
    expect(items).toEqual([
      "Mark as readR",
      "Mark as unreadU",
      "FlagF",
      "To-DoT",
      "Move to",
      "Add topic",
      "Archive",
      "DeleteDel",
      "Select all",
      "Clear selection"
    ]);
  });

  it("hits the selection, with a collapsed thread covering the whole thread", async () => {
    const { view, calls } = renderMenu({ selected: ["root", "first"], activeMessageId: "second" });
    await choose(view, /Mark as read/);
    await choose(view, /Flag/);
    await choose(view, /To-Do/);
    await choose(view, /Archive/);
    await choose(view, /Delete/);
    const selection = { ids: ["root", "first"], threadIds: ["root", "first", "reply"] };
    expect(calls).toEqual([
      ["markRead", selection],
      ["toggleFlag", selection],
      ["toggleTodo", selection],
      ["archive", selection],
      ["remove", selection]
    ]);
  });

  it("returns focus to the trigger after an action", async () => {
    const { view } = renderMenu({ selected: ["first", "second"] });
    await choose(view, /Mark as unread/);
    expect(document.activeElement).toBe(trigger(view));
  });

  it("clears and selects all", async () => {
    const { view, store, selectAllCalls } = renderMenu({ selected: ["first", "second"] });
    await choose(view, "Select all");
    expect(selectAllCalls()).toBe(1);
    await choose(view, "Clear selection");
    expect(store.getIds().size).toBe(0);
    expect(trigger(view).getAttribute("aria-label")).toBe("Message actions: nothing selected");
  });
});

describe("right-click bulk menu", () => {
  it("shares the header menu's action items", async () => {
    const store: SelectionStore = createSelectionStore(null);
    const calls: string[] = [];
    const shared = new Proxy({} as SelectionActions, {
      get: (_, name: string) => () => calls.push(name)
    });
    const view = render(
      <Theme>
        <BulkActionContextMenu
          open
          position={{ x: 10, y: 10 }}
          selectionCount={2}
          onOpenChange={() => {}}
          actions={bindSelectionActions(shared, () => ({
            ids: Array.from(store.getIds()),
            threadIds: Array.from(store.getIds())
          }))}
          allTopics={[]}
          hasOtherAccounts
          onGetRecentFolders={() => []}
        />
      </Theme>
    );
    await interact(() => store.setSelection(new Set(["first", "second"])));
    const menu = within(view.getByRole("menu"));
    expect(menu.getByText("2 selected")).toBeTruthy();
    expect(menu.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "Mark as readR",
      "Mark as unreadU",
      "FlagF",
      "To-DoT",
      "Move to",
      "Copy to account...",
      "Move to account...",
      "Add topic",
      "Archive",
      "DeleteDel"
    ]);
    await interact(() => {
      fireEvent.click(menu.getByRole("menuitem", { name: /To-Do/ }));
    });
    expect(calls).toEqual(["toggleTodo"]);
  });
});
