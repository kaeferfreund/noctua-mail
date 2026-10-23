import { getFolderDisplayPath, folderNameMatches } from "@/lib/i18n/folderNames";
import { useLocale } from "next-intl";
import type React from "react";
import type { Folder } from "@/lib/data";
import type { SyncTriggerOptions } from "../types";
import FolderTreeNode from "./FolderTreeNode";

type FolderTreeProps = {
  state: {
    rootFolders: Folder[];
    folderTree: Map<string, Folder[]>;
    folderById: Map<string, Folder>;
    folderQuery: string;
    searchScope: "folder" | "all";
    activeFolderId: string;
    collapsedFolders: Record<string, boolean>;
    syncingFolders: Set<string>;
    deletingFolderIds: Set<string>;
    draggingMessageIds: Set<string>;
    dragOverFolderId: string | null;
  };
  actions: {
    setActiveFolderId: React.Dispatch<React.SetStateAction<string>>;
    setSearchScope: React.Dispatch<React.SetStateAction<"folder" | "all">>;
    clearSearch: () => void;
    setCollapsedFolders: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
    setDragOverFolderId: React.Dispatch<React.SetStateAction<string | null>>;
    handleMoveMessages: (folderId: string, messageIds: string[]) => void;
    handleCreateSubfolder: (folder: Folder) => void;
    handleRenameFolderItem: (folder: Folder) => void;
    handleDeleteFolderItem: (folder: Folder) => void;
    syncAccount: (
      folderId?: string,
      mode?: "new" | "full",
      options?: SyncTriggerOptions
    ) => void;
    folderSpecialIcon: (folder: Folder) => React.ReactNode;
  };
};

export default function FolderTree({ state, actions }: FolderTreeProps) {
  const locale = useLocale();
  const {
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
  } = state;

  const folderQueryText = folderQuery.trim().toLowerCase();

  const hasFolderMatch = (folder: Folder): boolean => {
    if (!folderQueryText) return true;
    if (folderNameMatches(folder, folderQueryText, locale)) return true;
    const children = folderTree.get(folder.id) ?? [];
    return children.some((child) => hasFolderMatch(child));
  };

  const folderPathLabel = (folder: Folder) =>
    getFolderDisplayPath(folder.id, id => folderById.get(id), locale);

  return (
    <>
      {rootFolders.map((folder) => (
        <FolderTreeNode
          key={folder.id}
          folder={folder}
          depth={0}
          forceShow={false}
          state={{
            folderTree,
            folderById,
            folderQueryText,
            searchScope,
            activeFolderId,
            collapsedFolders,
            syncingFolders,
            deletingFolderIds,
            draggingMessageIds,
            dragOverFolderId
          }}
          actions={actions}
          helpers={{ hasFolderMatch, folderPathLabel }}
        />
      ))}
    </>
  );
}
