import type { Folder } from "@/lib/data";

export type FolderStreamUpdate = {
  id: string;
  uidNext?: number;
  // STATUS UNSEEN count, never SELECT's first unseen sequence number.
  unseen?: number;
  exists?: number;
};

export function applyFolderStreamUpdates(folders: Folder[], updates: FolderStreamUpdate[]): Folder[] {
  return folders.map((folder) => {
    const update = updates.find((item) => item.id === folder.id);
    if (!update) return folder;
    return {
      ...folder,
      count: typeof update.exists === "number" ? update.exists : folder.count,
      unreadCount: typeof update.unseen === "number" ? update.unseen : folder.unreadCount
    };
  });
}
