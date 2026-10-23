import { afterEach, expect, test } from "bun:test";
import { Profiler, useEffect, useState } from "react";
import { act, cleanup } from "@testing-library/react";
import { render } from "@/lib/i18n/testRender";
import { Theme } from "@radix-ui/themes";
import type { Folder, Message } from "@/lib/data";
import type { CollabSummary } from "../collab/types";
import FolderTreeNode from "./folder/FolderTreeNode";
import { applyFolderStreamUpdates } from "./folderStreamUpdates";
import { applyMessageCollabUpdate, applyMessagesCollabUpdates, applyThreadCollabCacheUpdates } from "./threadCollabUpdates";

afterEach(cleanup);
const accountId = "synthetic-account";
const folder: Folder = { id: `${accountId}:INBOX`, accountId, name: "INBOX", count: 10, unreadCount: 2 };
const collab: CollabSummary = { status: "open", assigneeUserId: null, commentCount: 1, updatedAt: 1234 };
const message: Message = { id: "synthetic-message", threadId: "synthetic-thread", accountId, folderId: folder.id,
  subject: "Synthetic message", from: "sender@example.test", to: "recipient@example.test", preview: "Synthetic preview",
  date: "2026-10-23", dateValue: 1, body: "Synthetic body", collab };
const noop = () => {};

test("20 identical folder/collab bursts leave list, sidebar and reader commits unchanged", async () => {
  const commits = { list: 0, sidebar: 0, reader: 0 };
  function Harness() {
    const [folders, setFolders] = useState([folder]);
    const [messages, setMessages] = useState([message]);
    const [reader, setReader] = useState(message);
    const [cache, setCache] = useState(new Map([[accountId, new Map([[message.threadId, collab]])]]));
    const [thread, setThread] = useState([message]);
    useEffect(() => {
      const update = (event: Event) => {
        const payload = JSON.parse((event as MessageEvent).data) as { unseen: number; commentCount: number };
        const updates = new Map([[message.threadId, { ...collab, commentCount: payload.commentCount }]]);
        setFolders(prev => applyFolderStreamUpdates(prev, [{ id: folder.id, exists: 10, unseen: payload.unseen, uidNext: 11 }]));
        setCache(prev => applyThreadCollabCacheUpdates(prev, accountId, updates));
        setMessages(prev => applyMessagesCollabUpdates(prev, accountId, updates));
        setReader(prev => applyMessageCollabUpdate(prev, accountId, updates));
        setThread(prev => applyMessagesCollabUpdates(prev, accountId, updates));
      };
      window.addEventListener("synthetic-live-update", update);
      return () => window.removeEventListener("synthetic-live-update", update);
    }, []);
    return <Theme>
      <Profiler id="sidebar" onRender={() => commits.sidebar++}>
        <FolderTreeNode folder={folders[0]} depth={0} forceShow state={{
          folderTree: new Map(), folderById: new Map(folders.map(item => [item.id, item])),
          folderQueryText: "", searchScope: "folder", activeFolderId: folder.id, collapsedFolders: {},
          syncingFolders: new Set(), deletingFolderIds: new Set(), draggingMessageIds: new Set(), dragOverFolderId: null
        }} actions={{
          setActiveFolderId: noop, setSearchScope: noop, clearSearch: noop, setCollapsedFolders: noop,
          setDragOverFolderId: noop, handleMoveMessages: noop, handleCreateSubfolder: noop,
          handleRenameFolderItem: noop, handleDeleteFolderItem: noop, syncAccount: noop, folderSpecialIcon: () => null
        }} helpers={{ hasFolderMatch: () => true, folderPathLabel: item => item.name }} />
      </Profiler>
      <Profiler id="list" onRender={() => commits.list++}>
        <ul>{messages.map(item => <li key={item.id}>{item.subject}: {item.collab?.commentCount} notes</li>)}</ul>
        <output data-testid="cache">{cache.get(accountId)?.get(message.threadId)?.commentCount}</output>
      </Profiler>
      <Profiler id="reader" onRender={() => commits.reader++}>
        <article>{reader.body}: {reader.collab?.commentCount} notes; thread: {thread[0].collab?.commentCount}</article>
      </Profiler>
    </Theme>;
  }
  const view = render(<Harness />);
  const emit = (unseen = 2, commentCount = 1) => act(() => {
    window.dispatchEvent(new MessageEvent("synthetic-live-update", { data: JSON.stringify({ unseen, commentCount }) }));
  });
  emit(); // Warm the mounted Radix controls before measuring the burst.
  await act(async () => {});
  const initial = { ...commits };
  for (let i = 0; i < 20; i++) emit();
  const burst = { list: commits.list - initial.list, sidebar: commits.sidebar - initial.sidebar, reader: commits.reader - initial.reader };
  console.info("equal-live-update burst commits", burst);
  expect(burst).toEqual({ list: 0, sidebar: 0, reader: 0 });
  emit(3, 2);
  expect(view.getByLabelText("3 unread")).toBeTruthy();
  expect(view.getByText("Synthetic message: 2 notes")).toBeTruthy();
  expect(view.getByTestId("cache").textContent).toBe("2");
  expect(view.getByText("Synthetic body: 2 notes; thread: 2")).toBeTruthy();
  expect(commits.list).toBe(initial.list + 1);
});
