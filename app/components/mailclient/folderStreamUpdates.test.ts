import { expect, test } from "bun:test";
import type { Folder } from "@/lib/data";
import { applyFolderStreamUpdates } from "./folderStreamUpdates";

const inbox: Folder = { id: "synthetic-a:INBOX", accountId: "synthetic-a", name: "INBOX", count: 10, unreadCount: 2 };
const other = { ...inbox, id: "synthetic-b:INBOX", accountId: "synthetic-b" };

test("equal, empty, unknown and uidNext-only folder events keep arrays and entities", () => {
  const folders = [inbox, other];
  for (const updates of [[], [{ id: inbox.id, exists: 10, unseen: 2 }], [{ id: inbox.id, uidNext: 99 }], [{ id: "unknown", unseen: 4 }]]) {
    expect(applyFolderStreamUpdates(folders, updates)).toBe(folders);
  }
});

for (const change of [{ exists: 11 }, { unseen: 0 }]) test(`folder ${JSON.stringify(change)} only replaces its own entity`, () => {
  const folders = [inbox, other];
  const updates = [{ id: inbox.id, ...change }];
  const next = applyFolderStreamUpdates(folders, updates);
  expect(next).not.toBe(folders);
  expect(next[0]).not.toBe(inbox);
  expect(next[1]).toBe(other);
  expect(inbox).toMatchObject({ count: 10, unreadCount: 2 });
  expect(applyFolderStreamUpdates(next, updates)).toBe(next);
});

test("folder events from the previous account cannot affect a new account", () => {
  const folders = [other];
  expect(applyFolderStreamUpdates(folders, [{ id: inbox.id, exists: 99, unseen: 99 }])).toBe(folders);
});
