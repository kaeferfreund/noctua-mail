import type { Folder } from "@/lib/data";

export type FolderStreamUpdate = {
  id: string;
  uidNext?: number;
  // STATUS UNSEEN count, never SELECT's first unseen sequence number.
  unseen?: number;
  exists?: number;
};

export function applyFolderStreamUpdates(folders: Folder[], updates: FolderStreamUpdate[]): Folder[] {
  let next = folders;
  folders.forEach((folder, index) => {
    const update = updates.find((item) => item.id === folder.id);
    if (!update) return;
    const count = typeof update.exists === "number" ? update.exists : folder.count;
    const unreadCount = typeof update.unseen === "number" ? update.unseen : folder.unreadCount;
    if (count === folder.count && unreadCount === folder.unreadCount) return;
    if (next === folders) next = folders.slice();
    next[index] = { ...folder, count, unreadCount };
  });
  return next;
}
