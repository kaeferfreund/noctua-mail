import { useTranslations } from "next-intl";
import type React from "react";
import { MoreVertical, X } from "lucide-react";
import { DropdownMenu, TextField } from "@radix-ui/themes";
import { SidebarGroup, SidebarGroupLabel } from "@/app/components/ui/sidebar";
import type { SyncTriggerOptions } from "../types";
import styles from "./FolderTree.module.css";
import TooltipIconButton from "@/app/components/TooltipIconButton";

type FolderPaneProps = {
  state: {
    folderQuery: string;
    accountFolderCount: number;
    isRecomputingThreads: boolean;
    isRecomputingCategories: boolean;
  };
  actions: {
    setFolderQuery: React.Dispatch<React.SetStateAction<string>>;
    syncAccount: (
      folderId?: string,
      mode?: "new" | "full",
      options?: SyncTriggerOptions
    ) => void;
    recomputeThreads: () => void;
    recomputeCategories: () => void;
  };
  children?: React.ReactNode;
};

/**
 * The "Folders" section of the shell sidebar: header with the mailbox
 * actions menu, the folder search field and the folder tree (children).
 */
export default function FolderPane({ state, actions, children }: FolderPaneProps) {
  const t = useTranslations("List");
  const { folderQuery, accountFolderCount, isRecomputingThreads, isRecomputingCategories } = state;
  const { setFolderQuery, syncAccount, recomputeThreads, recomputeCategories } = actions;

  return (
    <SidebarGroup aria-label={t("folders")}>
      <div className={styles.treeHeader}>
        <div>
          <SidebarGroupLabel>{t("folders")}</SidebarGroupLabel>
          <div className={styles.panelMeta}>{t("folderCount", { count: accountFolderCount })}</div>
        </div>
        <div className={styles.treeHeaderActions}>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              <TooltipIconButton
                variant="ghost"
                size="1"
                className={styles.treeAction}
                tooltip={t("folderActions")}
              >
                <MoreVertical size={14} />
              </TooltipIconButton>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end" className={styles.menuContent}>
              <DropdownMenu.Item onSelect={() => syncAccount(undefined, "new")}>{t("syncNew")}</DropdownMenu.Item>
              <DropdownMenu.Item
                onSelect={() =>
                  syncAccount(undefined, "full", {
                    fullSyncReason: t("manualMailboxSyncReason")
                  })
                }
              >{t("fullMailboxSync")}</DropdownMenu.Item>
              <DropdownMenu.Item
                onSelect={() => recomputeThreads()}
                disabled={isRecomputingThreads}
              >{t("recomputeThreads")}</DropdownMenu.Item>
              <DropdownMenu.Item
                onSelect={() => recomputeCategories()}
                disabled={isRecomputingCategories}
              >{t("recomputeCategories")}</DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </div>
      </div>
      <div className={styles.folderSearch}>
        <TextField.Root
          size="2"
          type="search"
          placeholder={t("searchFolders")}
          value={folderQuery}
          onChange={(event) => setFolderQuery(event.target.value)}
          id="folder-search-input"
          className={styles.folderSearchInput}
        >
          {folderQuery ? (
            <TextField.Slot side="right">
              <TooltipIconButton
                size="1"
                variant="ghost"
                onClick={() => setFolderQuery("")}
                tooltip={t("clearFolderSearch")}
              >
                <X size={12} />
              </TooltipIconButton>
            </TextField.Slot>
          ) : null}
        </TextField.Root>
      </div>
      <div className={styles.treeRail}>{children}</div>
    </SidebarGroup>
  );
}
