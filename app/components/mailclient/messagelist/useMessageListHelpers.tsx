import { useCallback } from "react";
import type React from "react";
import type { Folder, Message } from "@/lib/data";
import { isMessageFlagged } from "../utils/messageHelpers";
import FolderBadges from "../folder/FolderBadges";
import MessageSelectIndicators from "./MessageSelectIndicators";
import UnreadDot from "./UnreadDot";

type UseMessageListHelpersParams = {
  groupBy: string;
  activeAccountId: string;
  folders: Folder[];
  toggleFlaggedFlag: (message: Message) => void;
  setSearchScope: React.Dispatch<React.SetStateAction<"folder" | "all">>;
  setActiveFolderId: React.Dispatch<React.SetStateAction<string>>;
};

export function useMessageListHelpers({
  groupBy,
  activeAccountId,
  folders,
  toggleFlaggedFlag,
  setSearchScope,
  setActiveFolderId
}: UseMessageListHelpersParams) {
  const folderById = useCallback(
    (id: string) => folders.find((folder) => folder.id === id),
    [folders]
  );

  const threadPathById = useCallback(
    (id: string) => id.replace(`${activeAccountId}:`, ""),
    [activeAccountId]
  );

  const renderSelectIndicators = useCallback(
    (message: Message) => (
      <MessageSelectIndicators
        isFlagged={isMessageFlagged(message)}
        isDraft={Boolean(message.draft)}
        onFlaggedClick={() => toggleFlaggedFlag(message)}
      />
    ),
    [toggleFlaggedFlag]
  );

  const renderUnreadDot = useCallback(
    (message: Message, options?: { seen?: boolean }) => (
      <UnreadDot seen={options?.seen ?? Boolean(message.seen)} />
    ),
    []
  );

  const renderFolderBadges = useCallback(
    (folderIds: string[]) => (
      <FolderBadges
        folderIds={folderIds}
        threadPathById={threadPathById}
        folderById={folderById}
        onSelectFolder={(folderId) => {
          setSearchScope("folder");
          setActiveFolderId(folderId);
        }}
      />
    ),
    [folderById, setActiveFolderId, setSearchScope, threadPathById]
  );

  const getGroupLabel = useCallback(
    (group: { key: string; label?: string }) => {
      if (groupBy === "folder") {
        return threadPathById(group.key);
      }
      return group.label ?? group.key;
    },
    [groupBy, threadPathById]
  );

  return {
    threadPathById,
    renderSelectIndicators,
    renderUnreadDot,
    renderFolderBadges,
    getGroupLabel
  };
}
