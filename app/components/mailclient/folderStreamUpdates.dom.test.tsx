import { afterEach, expect, test } from "bun:test";
import { useEffect, useState } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import type { Folder } from "@/lib/data";
import FolderTreeNode from "./folder/FolderTreeNode";
import { applyFolderStreamUpdates, type FolderStreamUpdate } from "./folderStreamUpdates";

afterEach(cleanup);
const inbox: Folder = { id: "synthetic:INBOX", name: "INBOX", accountId: "synthetic", count: 300, unreadCount: 110 };
const noop = () => {};

function FolderHarness({ initial = inbox }: { initial?: Folder }) {
  const [folders, setFolders] = useState([initial]);
  useEffect(() => {
    const update = (event: Event) => setFolders(prev => applyFolderStreamUpdates(prev, JSON.parse((event as MessageEvent).data)));
    window.addEventListener("folder:update", update);
    return () => window.removeEventListener("folder:update", update);
  }, []);
  return <Theme><FolderTreeNode folder={folders[0]} depth={0} forceShow state={{
    folderTree: new Map(), folderById: new Map(folders.map(folder => [folder.id, folder])),
    folderQueryText: "", searchScope: "folder", activeFolderId: inbox.id, collapsedFolders: {},
    syncingFolders: new Set(), deletingFolderIds: new Set(), draggingMessageIds: new Set(), dragOverFolderId: null
  }} actions={{
    setActiveFolderId: noop, setSearchScope: noop, clearSearch: noop, setCollapsedFolders: noop,
    setDragOverFolderId: noop, handleMoveMessages: noop, handleCreateSubfolder: noop,
    handleRenameFolderItem: noop, handleDeleteFolderItem: noop, syncAccount: noop, folderSpecialIcon: () => null
  }} helpers={{ hasFolderMatch: () => true, folderPathLabel: folder => folder.name }} /></Theme>;
}

function emit(update: FolderStreamUpdate) {
  act(() => { window.dispatchEvent(new MessageEvent("folder:update", { data: JSON.stringify([update]) })); });
}

test("QA-006 folder:update reducer renders STATUS counts through initial sync, flags, EXISTS and reload", () => {
  const view = render(<FolderHarness />);
  const expectBadge = (count: number) => expect(view.getByLabelText(`${count} unread`).textContent).toBe(String(count));
  emit({ id: inbox.id, uidNext: 301, exists: 300, unseen: 110 });
  expectBadge(110);
  emit({ id: inbox.id, unseen: 100 }); // Ten marked read.
  expectBadge(100);
  emit({ id: inbox.id, exists: 305, unseen: 105, uidNext: 306 }); // Five EXISTS.
  expectBadge(105);
  emit({ id: inbox.id, unseen: 115 }); // Ten marked unread again.
  expectBadge(115);
  emit({ id: inbox.id, uidNext: 306 }); // Partial updates preserve known counts.
  expectBadge(115);
  emit({ id: "other:INBOX", unseen: 1 });
  expectBadge(115);
  view.unmount();
  const reloaded = render(<FolderHarness initial={{ ...inbox, count: 305, unreadCount: 115 }} />);
  emit({ id: inbox.id, exists: 305, unseen: 115, uidNext: 306 });
  expect(reloaded.getByLabelText("115 unread").textContent).toBe("115");
  emit({ id: inbox.id, unseen: 0 });
  expect(reloaded.queryByLabelText("115 unread")).toBeNull();
});

test("missing unread counts stay unknown rather than copying total messages", () => {
  const unknownUnread = { ...inbox, unreadCount: undefined };
  expect(applyFolderStreamUpdates([unknownUnread], [{ id: inbox.id, exists: 305 }])[0]).toMatchObject({ count: 305, unreadCount: undefined });
});
