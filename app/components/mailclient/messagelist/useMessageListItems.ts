import { useLocale } from "next-intl";
import { useMemo } from "react";
import {
  buildMessageListItems,
  type BuildMessageListItemsParams,
  type ListItem
} from "./listModel";

type UseMessageListItemsParams = BuildMessageListItemsParams;

export function useMessageListItems({
  groupedMessages,
  collapsedGroups,
  collapsedThreads,
  supportsThreads,
  includeThreadAcrossFolders,
  searchScope,
  activeFolderId,
  buildThreadTree,
  flattenThread,
  getThreadLatestDate,
  userEmail,
  preferToDisplay,
  findRecipientAlias,
  mode,
  collapsedNestedMessages
}: UseMessageListItemsParams): ListItem[] {
  const locale = useLocale();
  return useMemo(
    () =>
      buildMessageListItems({
        locale,
        groupedMessages,
        collapsedGroups,
        collapsedThreads,
        supportsThreads,
        includeThreadAcrossFolders,
        searchScope,
        activeFolderId,
        buildThreadTree,
        flattenThread,
        getThreadLatestDate,
        userEmail,
        preferToDisplay,
        findRecipientAlias,
        mode,
        collapsedNestedMessages
      }),
    [
      locale,
      groupedMessages,
      collapsedGroups,
      collapsedThreads,
      supportsThreads,
      includeThreadAcrossFolders,
      searchScope,
      activeFolderId,
      buildThreadTree,
      flattenThread,
      getThreadLatestDate,
      userEmail,
      preferToDisplay,
      findRecipientAlias,
      mode,
      collapsedNestedMessages
    ]
  );
}
