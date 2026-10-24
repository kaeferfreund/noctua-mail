import { getFolderDisplayName, folderNameMatches } from "@/lib/i18n/folderNames";
import { useLocale, useTranslations } from "next-intl";
import { memo, useState } from "react";
import type React from "react";
import { Folder as FolderIcon, MoreVertical } from "lucide-react";
import { Badge, DropdownMenu, IconButton } from "@radix-ui/themes";
import { CaretRightIcon } from "@radix-ui/react-icons";
import { badgeColors } from "@/lib/ui/badgeColors";
import type { Folder } from "@/lib/data";
import type { SyncTriggerOptions } from "../types";
import { getFolderCountTitle, getFolderTreeCount } from "./folderBadgePresentation";
import styles from "./FolderTree.module.css";
import TooltipIconButton from "@/app/components/TooltipIconButton";

type FolderTreeNodeProps = {
  folder: Folder;
  depth: number;
  forceShow: boolean;
  state: {
    folderTree: Map<string, Folder[]>;
    folderById: Map<string, Folder>;
    folderQueryText: string;
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
  helpers: {
    hasFolderMatch: (folder: Folder) => boolean;
    folderPathLabel: (folder: Folder) => string;
  };
};

function FolderTreeNodeView({
  folder,
  depth,
  forceShow,
  state,
  actions,
  helpers
}: FolderTreeNodeProps) {
  const locale = useLocale();
  const t = useTranslations("List");
  const {
    folderTree,
    folderQueryText,
    searchScope,
    activeFolderId,
    collapsedFolders,
    syncingFolders,
    deletingFolderIds,
    draggingMessageIds,
    dragOverFolderId
  } = state;
  const {
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
  } = actions;
  const { hasFolderMatch, folderPathLabel } = helpers;
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  // The Radix menu + tooltip and the count title cost real work per folder and
  // are rarely used, so they are built on the first sign of interest in this
  // row (pointer over it, focus in it) and kept from then on. The active and
  // syncing rows show their action button without hover, so they mount it
  // right away and keyboard users always reach the real menu trigger.
  const [isEngaged, setIsEngaged] = useState(false);
  const engage = () => setIsEngaged(true);

  const isCollapsed = collapsedFolders[folder.id] ?? false;
  const hasChildren = (folderTree.get(folder.id) ?? []).length > 0;
  const specialIcon = folderSpecialIcon(folder);
  if (folderQueryText && !forceShow && !hasFolderMatch(folder)) {
    return null;
  }
  const matchesQuery = folderQueryText
    ? folderNameMatches(folder, folderQueryText, locale)
    : true;
  const childNodes = folderTree.get(folder.id) ?? [];
  const folderTitle = isEngaged
    ? getFolderCountTitle(folderPathLabel(folder), folder.count ?? 0, folder.unreadCount ?? 0, locale)
    : undefined;
  const treeCount = getFolderTreeCount(folder);
  const isDeleting = deletingFolderIds.has(folder.id);
  const isSyncingFolder = syncingFolders.has(folder.id);
  const isActive = searchScope === "folder" && folder.id === activeFolderId;
  const mountMenu = isEngaged || isActive || isSyncingFolder;

  return (
    <div
      key={folder.id}
      className={`${styles.treeNode} ${
        dragOverFolderId === folder.id ? styles.treeNodeDropTarget : ""
      }`}
    >
      <div
        className={`${styles.treeRow} ${isActive ? styles.treeRowActive : ""} ${
          isDeleting ? styles.treeRowDisabled : ""
        }`}
        data-syncing={isSyncingFolder ? "true" : "false"}
        data-menu-open={isMenuOpen ? "true" : "false"}
        title={folderTitle}
        data-folder-id={folder.id}
        role="button"
        tabIndex={0}
        onPointerEnter={engage}
        onFocus={engage}
        onClick={() => {
          if (isDeleting) return;
          clearSearch();
          setSearchScope("folder");
          setActiveFolderId(folder.id);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (isDeleting) return;
            clearSearch();
            setSearchScope("folder");
            setActiveFolderId(folder.id);
          }
        }}
        onDragOver={(event) => {
          if (isDeleting) return;
          if (!draggingMessageIds.size && !event.dataTransfer.types.includes("application/json")) {
            return;
          }
          event.preventDefault();
          setDragOverFolderId(folder.id);
          event.dataTransfer.dropEffect = "move";
        }}
        onDragLeave={() => {
          if (dragOverFolderId === folder.id) {
            setDragOverFolderId(null);
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          if (isDeleting) return;
          setDragOverFolderId(null);
          let ids = draggingMessageIds.size > 0 ? Array.from(draggingMessageIds) : [];
          if (!ids.length) {
            try {
              const parsed = JSON.parse(event.dataTransfer.getData("application/json"));
              if (parsed?.messageIds && Array.isArray(parsed.messageIds)) {
                ids = parsed.messageIds;
              }
            } catch {
              // ignore
            }
          }
          if (!ids.length) return;
          handleMoveMessages(folder.id, ids);
        }}
        style={{ paddingLeft: `${6 + depth * 2}px` }}
      >
        <span
          className={`${styles.treeCaret} ${!isCollapsed ? styles.treeCaretOpen : ""}`}
          onClick={(event) => {
            if (!hasChildren) return;
            event.stopPropagation();
            if (isDeleting) return;
            setCollapsedFolders((prev) => ({ ...prev, [folder.id]: !isCollapsed }));
          }}
        >
          {hasChildren ? <CaretRightIcon /> : ""}
        </span>
        <span className={styles.treeIcon} aria-hidden>
          {specialIcon ?? <FolderIcon size={14} />}
        </span>
        <span className={`${styles.treeName} ${treeCount.kind === "unread" && treeCount.count ? styles.treeNameUnread : ""}`}>
          <span className={styles.treeNameText}>{getFolderDisplayName(folder, locale)}</span>
          {isSyncingFolder && <span className={styles.treeSyncSpinner} aria-hidden="true" />}
        </span>
        {treeCount.count ? (
          <Badge
            size="1"
            variant="soft"
            color={badgeColors.unread}
            className={styles.treeUnreadBadge}
            aria-label={t(treeCount.kind === "unread" ? "unreadCount" : "draftCount", { count: treeCount.count })}
            title={folderTitle}
          >
            {treeCount.count}
          </Badge>
        ) : null}
        <span className={styles.treeActions}>
          {mountMenu ? (
            <DropdownMenu.Root open={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <DropdownMenu.Trigger>
                <TooltipIconButton
                  className={styles.treeAction}
                  variant="ghost"
                  size="1"
                  tooltip={t("folderActions")}
                  disabled={isDeleting}
                  onClick={(event) => event.stopPropagation()}
                >
                  <MoreVertical size={14} />
                </TooltipIconButton>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content align="end" className={styles.menuContent}>
                <DropdownMenu.Item
                  disabled={isDeleting || isSyncingFolder}
                  onSelect={() => {
                    syncAccount(folder.id, "full", {
                      recategorizeFolder: true,
                      fullSyncReason: t("manualFolderSyncReason")
                    });
                  }}
                >{t("sync")}</DropdownMenu.Item>
                <DropdownMenu.Item
                  disabled={isDeleting}
                  onSelect={() => {
                    handleCreateSubfolder(folder);
                  }}
                >{t("createSubfolder")}</DropdownMenu.Item>
                <DropdownMenu.Item
                  disabled={isDeleting}
                  onSelect={() => {
                    handleRenameFolderItem(folder);
                  }}
                >{t("rename")}</DropdownMenu.Item>
                <DropdownMenu.Item
                  disabled={isDeleting}
                  onSelect={() => {
                    handleDeleteFolderItem(folder);
                  }}
                >{t("delete")}</DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          ) : (
            <IconButton
              className={styles.treeAction}
              variant="ghost"
              size="1"
              aria-label={t("folderActions")}
              aria-haspopup="menu"
              aria-expanded={false}
              disabled={isDeleting}
              onClick={(event) => {
                event.stopPropagation();
                engage();
                setIsMenuOpen(true);
              }}
            >
              <MoreVertical size={14} />
            </IconButton>
          )}
        </span>
      </div>
      {!isCollapsed && hasChildren && (
        <div className={styles.treeChildren}>
          {childNodes.map((child) => (
            <FolderTreeNode
              key={child.id}
              folder={child}
              depth={depth + 1}
              forceShow={matchesQuery}
              state={state}
              actions={actions}
              helpers={helpers}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Children recurse through the memoized component, so an unchanged subtree is
// skipped as a whole.
const FolderTreeNode = memo(FolderTreeNodeView);
export default FolderTreeNode;
