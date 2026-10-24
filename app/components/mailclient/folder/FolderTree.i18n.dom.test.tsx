import { afterEach, expect, test } from "bun:test";
import { cleanup, fireEvent } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { I18nTestProvider, render } from "@/lib/i18n/testRender";
import type { Folder } from "@/lib/data";
import FolderTree from "./FolderTree";

afterEach(cleanup);
const folders: Folder[] = [
  { id: "synthetic-inbox", accountId: "synthetic", name: "Unusual protocol name", specialUse: "\\Inbox", count: 3, unreadCount: 2 },
  { id: "synthetic-sent", accountId: "synthetic", name: "Protocol sent", specialUse: "\\Sent", count: 0 },
  { id: "synthetic-literal", accountId: "synthetic", name: "Sent", count: 0 },
  { id: "synthetic-child", accountId: "synthetic", parentId: "synthetic-inbox", name: "Synthetic child", count: 0 }
];
for (const locale of ["de", "en"] as const) test(`folder tree localizes flags and searches display labels in ${locale} without renaming literal folders`, () => {
  const selected: string[] = [];
  const state = { rootFolders: folders.slice(0, 3), folderTree: new Map([[folders[0].id, [folders[3]]]]), folderById: new Map(folders.map(folder => [folder.id, folder])), folderQuery: "", searchScope: "folder" as const, activeFolderId: "", collapsedFolders: {}, syncingFolders: new Set<string>(), deletingFolderIds: new Set<string>(), draggingMessageIds: new Set<string>(), dragOverFolderId: null };
  const actions = { setActiveFolderId: (id: unknown) => selected.push(id as string), setSearchScope: () => {}, clearSearch: () => {}, setCollapsedFolders: () => {}, setDragOverFolderId: () => {}, handleMoveMessages: () => {}, handleCreateSubfolder: () => {}, handleRenameFolderItem: () => {}, handleDeleteFolderItem: () => {}, syncAccount: () => {}, folderSpecialIcon: () => null };
  const tree = (query: string) => <I18nTestProvider locale={locale}><Theme><FolderTree state={{ ...state, folderQuery: query }} actions={actions} /></Theme></I18nTestProvider>;
  const page = render(tree(""));
  const row = (id: string) => page.container.querySelector<HTMLElement>(`[data-folder-id="${id}"]`);
  expect(row("synthetic-inbox")?.textContent).toContain(locale === "de" ? "Posteingang" : "Inbox");
  expect(row("synthetic-sent")?.textContent).toContain(locale === "de" ? "Gesendet" : "Sent");
  expect(row("synthetic-literal")?.textContent).toBe("Sent");
  // The count title is built when the pointer or focus reaches the row.
  expect(row("synthetic-child")?.title).toBe("");
  fireEvent.pointerEnter(row("synthetic-child")!);
  expect(row("synthetic-child")?.title).toContain(locale === "de" ? "Posteingang/Synthetic child" : "Inbox/Synthetic child");
  fireEvent.click(row("synthetic-inbox")!);
  expect(selected).toEqual(["synthetic-inbox"]);
  page.rerender(tree(locale === "de" ? "posteingang" : "inbox"));
  expect(row("synthetic-inbox")).toBeTruthy();
  expect(row("synthetic-child")).toBeTruthy();
  expect(row("synthetic-literal")).toBeNull();
  page.rerender(tree("unusual protocol"));
  expect(row("synthetic-inbox")).toBeTruthy();
});

test("QA-213: the Drafts row shows the draft total like the pinned Drafts entry; other folders show unread", () => {
  const drafts: Folder = { id: "synthetic-drafts", accountId: "synthetic", name: "Drafts", specialUse: "\\Drafts", count: 12, unreadCount: 3 };
  const tree = [folders[0], drafts];
  const state = { rootFolders: tree, folderTree: new Map<string, Folder[]>(), folderById: new Map(tree.map(folder => [folder.id, folder])), folderQuery: "", searchScope: "folder" as const, activeFolderId: "", collapsedFolders: {}, syncingFolders: new Set<string>(), deletingFolderIds: new Set<string>(), draggingMessageIds: new Set<string>(), dragOverFolderId: null };
  const actions = { setActiveFolderId: () => {}, setSearchScope: () => {}, clearSearch: () => {}, setCollapsedFolders: () => {}, setDragOverFolderId: () => {}, handleMoveMessages: () => {}, handleCreateSubfolder: () => {}, handleRenameFolderItem: () => {}, handleDeleteFolderItem: () => {}, syncAccount: () => {}, folderSpecialIcon: () => null };
  const page = render(<I18nTestProvider locale="de"><Theme><FolderTree state={state} actions={actions} /></Theme></I18nTestProvider>);
  expect(page.getByLabelText("12 Entwürfe").textContent).toBe("12");
  expect(page.queryByText("3")).toBeNull();
  expect(page.getByLabelText("2 ungelesen").textContent).toBe("2");
});
