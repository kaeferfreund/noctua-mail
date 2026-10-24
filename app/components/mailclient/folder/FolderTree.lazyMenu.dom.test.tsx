import { afterEach, describe, expect, it } from "bun:test";
import { act, cleanup, fireEvent, within } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { I18nTestProvider, render } from "@/lib/i18n/testRender";
import type { Folder } from "@/lib/data";
import FolderTree from "./FolderTree";

afterEach(cleanup);

const folders: Folder[] = [
  { id: "synthetic:INBOX", accountId: "synthetic", name: "INBOX", specialUse: "\\Inbox", count: 12, unreadCount: 3 },
  { id: "synthetic:Archive", accountId: "synthetic", name: "Archive", count: 4 },
  { id: "synthetic:Archive/2025", accountId: "synthetic", parentId: "synthetic:Archive", name: "2025", count: 2 }
];

function renderTree(overrides: { activeFolderId?: string; syncing?: string[] } = {}) {
  const calls: string[] = [];
  const record = (name: string) => (folder?: unknown, ...rest: unknown[]) =>
    calls.push(`${name}:${typeof folder === "string" ? folder : (folder as Folder | undefined)?.id ?? ""}${rest.length ? `:${String(rest[0])}` : ""}`);
  const state = {
    rootFolders: folders.slice(0, 2),
    folderTree: new Map([[folders[1].id, [folders[2]]]]),
    folderById: new Map(folders.map(folder => [folder.id, folder])),
    folderQuery: "",
    searchScope: "folder" as const,
    activeFolderId: overrides.activeFolderId ?? folders[0].id,
    collapsedFolders: {},
    syncingFolders: new Set(overrides.syncing ?? []),
    deletingFolderIds: new Set<string>(),
    draggingMessageIds: new Set<string>(),
    dragOverFolderId: null
  };
  const actions = {
    setActiveFolderId: record("select"), setSearchScope: () => {}, clearSearch: () => {}, setCollapsedFolders: () => {},
    setDragOverFolderId: () => {}, handleMoveMessages: () => {}, handleCreateSubfolder: record("create"),
    handleRenameFolderItem: record("rename"), handleDeleteFolderItem: record("delete"), syncAccount: record("sync"),
    folderSpecialIcon: () => null
  };
  const view = render(<I18nTestProvider locale="en"><Theme><FolderTree state={state} actions={actions} /></Theme></I18nTestProvider>);
  const row = (id: string) => view.container.querySelector<HTMLElement>(`[data-folder-id="${id}"]`)!;
  const actionButton = (id: string) => within(row(id)).getByRole("button", { name: "Folder actions" });
  return { view, calls, row, actionButton };
}

// Radix positions menus asynchronously; let those updates land inside act.
async function interact(fire: () => void) {
  await act(async () => {
    fire();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("folder tree lazy menus", () => {
  it("mounts no menu for idle rows, only for the active row", () => {
    const { view, row, actionButton } = renderTree();
    // Radix triggers carry data-state; the plain placeholder does not.
    expect(view.container.querySelectorAll("[data-state]").length).toBe(1);
    expect(actionButton("synthetic:INBOX").getAttribute("data-state")).toBe("closed");
    for (const id of ["synthetic:Archive", "synthetic:Archive/2025"]) {
      const button = actionButton(id);
      expect(button.getAttribute("data-state")).toBeNull();
      expect(button.getAttribute("aria-haspopup")).toBe("menu");
      expect(button.getAttribute("aria-expanded")).toBe("false");
    }
    expect(view.queryByRole("menu")).toBeNull();
  });

  it("describes every row with its counts before any pointer or focus", () => {
    const { view, row } = renderTree();
    // Screen-reader browse mode reaches a row without hovering or focusing it.
    expect(row("synthetic:INBOX").getAttribute("title")).toBe("Inbox (12 Messages, 3 Unread)");
    expect(row("synthetic:Archive/2025").getAttribute("title")).toBe("Archive/2025 (2 Messages, 0 Unread)");
    expect(view.getByRole("button", { name: /^Archive\b/, description: "Archive (4 Messages, 0 Unread)" })).toBe(row("synthetic:Archive"));
  });

  it("mounts the menu once the pointer or focus reaches a row", async () => {
    const { row, actionButton } = renderTree();
    fireEvent.pointerEnter(row("synthetic:Archive/2025"));
    expect(actionButton("synthetic:Archive/2025").getAttribute("data-state")).toBe("closed");
    await interact(() => { row("synthetic:Archive").focus(); });
    expect(actionButton("synthetic:Archive").getAttribute("data-state")).toBe("closed");
  });

  it("selects a folder from its row but never from its action button or menu", async () => {
    const { view, calls, row, actionButton } = renderTree();
    const selected = () => calls.filter(call => call.startsWith("select:"));
    await interact(() => { row("synthetic:Archive").focus(); });
    const trigger = actionButton("synthetic:Archive");
    for (const key of ["Enter", " "]) {
      await interact(() => { trigger.focus(); fireEvent.keyDown(trigger, { key }); });
      const menu = within(view.getByRole("menu"));
      // A menu item chosen by keyboard, then one chosen by pointer.
      await interact(() => { fireEvent.keyDown(menu.getByRole("menuitem", { name: "Rename" }), { key: "Enter" }); });
      await interact(() => { fireEvent.keyDown(trigger, { key: "Enter" }); });
      await interact(() => { fireEvent.click(within(view.getByRole("menu")).getByRole("menuitem", { name: "Delete" })); });
    }
    expect(calls).toContain("rename:synthetic:Archive");
    expect(calls).toContain("delete:synthetic:Archive");
    expect(selected()).toEqual([]);
    await interact(() => { fireEvent.keyDown(row("synthetic:Archive"), { key: "Enter" }); });
    await interact(() => { fireEvent.click(row("synthetic:Archive/2025")); });
    expect(selected()).toEqual(["select:synthetic:Archive", "select:synthetic:Archive/2025"]);
  });

  it("opens the menu by keyboard and runs sync, rename and delete", async () => {
    const { view, calls, row, actionButton } = renderTree();
    for (const [item, expected] of [["Sync", "sync:synthetic:Archive:full"], ["Rename", "rename:synthetic:Archive"], ["Delete", "delete:synthetic:Archive"]] as const) {
      await interact(() => { row("synthetic:Archive").focus(); });
      const trigger = actionButton("synthetic:Archive");
      await interact(() => { trigger.focus(); fireEvent.keyDown(trigger, { key: "Enter" }); });
      const menu = within(view.getByRole("menu"));
      calls.length = 0;
      await interact(() => { fireEvent.click(menu.getByRole("menuitem", { name: item })); });
      expect(calls).toContain(expected);
      expect(view.queryByRole("menu")).toBeNull();
    }
  });

  it("opens the menu from a press on a row that was never hovered or focused", async () => {
    const { view, calls, actionButton } = renderTree();
    await interact(() => { fireEvent.click(actionButton("synthetic:Archive/2025")); });
    const menu = within(view.getByRole("menu"));
    expect(menu.getByRole("menuitem", { name: "Create Subfolder" })).toBeTruthy();
    expect(calls).toEqual([]);
  });

  it("keeps the menu trigger mounted on a syncing row", () => {
    const { actionButton } = renderTree({ syncing: ["synthetic:Archive"] });
    expect(actionButton("synthetic:Archive").getAttribute("data-state")).toBe("closed");
    expect(actionButton("synthetic:Archive/2025").getAttribute("data-state")).toBeNull();
  });
});
