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
  const { folderQuery, accountFolderCount, isRecomputingThreads, isRecomputingCategories } = state;
  const { setFolderQuery, syncAccount, recomputeThreads, recomputeCategories } = actions;

  return (
    <SidebarGroup aria-label="Folders">
      <div className={styles.treeHeader}>
        <div>
          <SidebarGroupLabel>Folders</SidebarGroupLabel>
          <div className={styles.panelMeta}>{accountFolderCount} total</div>
        </div>
        <div className={styles.treeHeaderActions}>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              <TooltipIconButton
                variant="ghost"
                size="1"
                className={styles.treeAction}
                tooltip="Folder actions"
              >
                <MoreVertical size={14} />
              </TooltipIconButton>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end" className={styles.menuContent}>
              <DropdownMenu.Item onSelect={() => syncAccount(undefined, "new")}>
                Sync New Messages
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onSelect={() =>
                  syncAccount(undefined, "full", {
                    fullSyncReason: "Manual full mailbox sync from the folder pane."
                  })
                }
              >
                Full Mailbox Sync
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onSelect={() => recomputeThreads()}
                disabled={isRecomputingThreads}
              >
                Recompute Threads
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onSelect={() => recomputeCategories()}
                disabled={isRecomputingCategories}
              >
                Recompute Categories
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </div>
      </div>
      <div className={styles.folderSearch}>
        <TextField.Root
          size="2"
          type="search"
          placeholder="Search folders"
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
                tooltip="Clear folder search"
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
