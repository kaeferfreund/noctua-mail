"use client";

import type React from "react";
import { useState } from "react";
import type { Folder } from "@/lib/data";
import FolderPane from "./FolderPane";
import FolderTree from "./FolderTree";
import type { SyncTriggerOptions } from "../types";

export type FolderSidebarPaneProps = {
  // Folder pane header
  accountFolderCount: number;
  isRecomputingThreads: boolean;
  isRecomputingCategories: boolean;
  syncAccount: (
    folderId?: string,
    mode?: "new" | "full",
    options?: SyncTriggerOptions
  ) => void;
  recomputeThreads: () => void;
  recomputeCategories: () => void;

  // Folder tree data
  rootFolders: Folder[];
  folderTree: Map<string, Folder[]>;
  folderById: Map<string, Folder>;

  // Folder tree selection / search
  searchScope: "folder" | "all";
  activeFolderId: string;
  setActiveFolderId: React.Dispatch<React.SetStateAction<string>>;
  setSearchScope: React.Dispatch<React.SetStateAction<"folder" | "all">>;
  clearSearch: () => void;

  // Folder tree async state
  syncingFolders: Set<string>;
  deletingFolderIds: Set<string>;
  draggingMessageIds: Set<string>;

  // Drag-over highlight — owned by MailClient because it is also reset by the
  // message drag-drop hook on drag end.
  dragOverFolderId: string | null;
  setDragOverFolderId: React.Dispatch<React.SetStateAction<string | null>>;

  // Folder tree actions
  handleMoveMessages: (folderId: string, messageIds: string[]) => void;
  handleCreateSubfolder: (folder: Folder) => void;
  handleRenameFolderItem: (folder: Folder) => void;
  handleDeleteFolderItem: (folder: Folder) => void;
  folderSpecialIcon: (folder: Folder) => React.ReactNode;
};

/**
 * Folder section of the shell sidebar. Owns the purely local UI state: the
 * folder search query and the folder collapse map.
 *
 * Selection state, sync state, folder data, drag-over highlight state, and
 * handlers that touch the data layer still live in MailClient and arrive as
 * props.
 */
export default function FolderSidebarPane({
  accountFolderCount,
  isRecomputingThreads,
  isRecomputingCategories,
  syncAccount,
  recomputeThreads,
  recomputeCategories,
  rootFolders,
  folderTree,
  folderById,
  searchScope,
  activeFolderId,
  setActiveFolderId,
  setSearchScope,
  clearSearch,
  syncingFolders,
  deletingFolderIds,
  draggingMessageIds,
  dragOverFolderId,
  setDragOverFolderId,
  handleMoveMessages,
  handleCreateSubfolder,
  handleRenameFolderItem,
  handleDeleteFolderItem,
  folderSpecialIcon
}: FolderSidebarPaneProps) {
  const [folderQuery, setFolderQuery] = useState("");
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});

  return (
    <FolderPane
      state={{
        folderQuery,
        accountFolderCount,
        isRecomputingThreads,
        isRecomputingCategories
      }}
      actions={{
        setFolderQuery,
        syncAccount,
        recomputeThreads,
        recomputeCategories
      }}
    >
      <FolderTree
        state={{
          rootFolders,
          folderTree,
          folderById,
          folderQuery,
          searchScope,
          activeFolderId,
          collapsedFolders,
          syncingFolders,
          deletingFolderIds,
          draggingMessageIds,
          dragOverFolderId
        }}
        actions={{
          setActiveFolderId,
          setSearchScope,
          clearSearch,
          setCollapsedFolders,
          setDragOverFolderId,
          handleMoveMessages,
          handleCreateSubfolder,
          handleRenameFolderItem,
          handleDeleteFolderItem,
          syncAccount,
          folderSpecialIcon
        }}
      />
    </FolderPane>
  );
}
