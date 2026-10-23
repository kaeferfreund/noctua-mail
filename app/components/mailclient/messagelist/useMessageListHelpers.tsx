import { getFolderDisplayName } from "@/lib/i18n/folderNames";
import { useLocale } from "next-intl";
import { useCallback } from "react";
import type React from "react";
import type { Folder, Message } from "@/lib/data";
import { isMessageFlagged, messageGroupLabel } from "../utils/messageHelpers";
import FolderBadges from "../folder/FolderBadges";
import MessageSelectIndicators from "./MessageSelectIndicators";

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
  const locale = useLocale();
  const folderById = useCallback(
    (id: string) => folders.find((folder) => folder.id === id),
    [folders]
  );

  const threadPathById = useCallback(
    (id: string) => {
      const folder = folderById(id);
      if (!folder) return id.replace(`${activeAccountId}:`, "");
      const parts = [getFolderDisplayName(folder, locale)];
      let parentId = folder.parentId;
      while (parentId) {
        const parent = folderById(parentId);
        if (!parent) break;
        parts.unshift(getFolderDisplayName(parent, locale));
        parentId = parent.parentId;
      }
      return parts.join("/");
    },
    [activeAccountId, folderById, locale]
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
      return messageGroupLabel(group.key, groupBy, locale, group.label ?? group.key);
    },
    [groupBy, locale, threadPathById]
  );

  return {
    threadPathById,
    renderSelectIndicators,
    renderFolderBadges,
    getGroupLabel
  };
}
