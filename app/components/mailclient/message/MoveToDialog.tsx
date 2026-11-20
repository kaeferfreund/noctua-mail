"use client";

import { getFolderDisplayName, folderNameMatches } from "@/lib/i18n/folderNames";

import { useLocale, useTranslations } from "next-intl";
import { useState, useCallback, useMemo, useRef } from "react";
import { X, Clock, Folder as FolderIcon } from "lucide-react";
import { Dialog, TextField } from "@radix-ui/themes";
import type { Folder } from "@/lib/data";
import FolderPickerNode from "../folder/FolderPickerNode";
import { folderSpecialIcon } from "../RenderHelpers";
import styles from "./MoveToDialog.module.css";
import TooltipIconButton from "@/app/components/TooltipIconButton";
import { getRecentMoveFolderIds } from "../utils/recentMoveFolders";

type MoveToDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Signed-in user: recent destinations are this user's own. */
  userId: string | null | undefined;
  accountId: string;
  rootFolders: Folder[];
  folderTree: Map<string, Folder[]>;
  folderById: Map<string, Folder>;
  onMove: (folderId: string) => void;
};

export default function MoveToDialog({
  open,
  onOpenChange,
  userId,
  accountId,
  rootFolders,
  folderTree,
  folderById,
  onMove
}: MoveToDialogProps) {
  const locale = useLocale();
  const t = useTranslations("Reader");
  const [query, setQuery] = useState("");
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});
  const searchInputRef = useRef<HTMLInputElement>(null);

  const recentIds = useMemo(
    () => (open ? getRecentMoveFolderIds(userId, accountId) : []),
    [open, userId, accountId]
  );

  const recentFolders = useMemo(
    () => recentIds.flatMap((id) => (folderById.has(id) ? [folderById.get(id)!] : [])),
    [recentIds, folderById]
  );

  const folderQueryText = query.trim().toLowerCase();

  function hasFolderMatch(folder: Folder): boolean {
    if (!folderQueryText) return true;
    if (folderNameMatches(folder, folderQueryText, locale)) return true;
    const children = folderTree.get(folder.id) ?? [];
    return children.some((child) => hasFolderMatch(child));
  }

  const onToggleCollapse = useCallback((folderId: string) => {
    setCollapsedFolders((prev) => ({ ...prev, [folderId]: !prev[folderId] }));
  }, []);

  const handleSelect = useCallback(
    (folderId: string) => {
      onMove(folderId);
      onOpenChange(false);
    },
    [onMove, onOpenChange]
  );

  const hasNoResults =
    folderQueryText.length > 0 && !rootFolders.some((f) => hasFolderMatch(f));

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content
        className={styles.dialogContent}
        aria-label={t("moveFolder")}
        aria-describedby={undefined}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          searchInputRef.current?.focus();
        }}
      >
        <div className={styles.dialogHeader}>
          <Dialog.Title className={styles.dialogTitle}>{t("moveToDialog")}</Dialog.Title>
          <Dialog.Close>
            <TooltipIconButton variant="ghost" size="1" tooltip={t("close")}>
              <X size={14} />
            </TooltipIconButton>
          </Dialog.Close>
        </div>

        <div className={styles.searchArea}>
          <TextField.Root
            ref={searchInputRef}
            size="2"
            type="search"
            placeholder={t("searchFolders")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={styles.searchInput}
          >
            {query ? (
              <TextField.Slot side="right">
                <TooltipIconButton
                  size="1"
                  variant="ghost"
                  onClick={() => setQuery("")}
                  tooltip={t("clearSearch")}
                >
                  <X size={12} />
                </TooltipIconButton>
              </TextField.Slot>
            ) : null}
          </TextField.Root>
        </div>

        <div className={styles.scrollArea}>
          {recentFolders.length > 0 && !folderQueryText && (
            <div className={styles.recentSection}>
              <div className={styles.sectionLabel}>{t("recent")}</div>
              {recentFolders.map((folder) => {
                const icon = folderSpecialIcon(folder);
                return (
                  <button
                    key={folder.id}
                    type="button"
                    className={styles.recentRow}
                    onClick={() => handleSelect(folder.id)}
                  >
                    <span className={styles.recentIcon} aria-hidden>
                      {icon ?? <FolderIcon size={14} />}
                    </span>
                    {getFolderDisplayName(folder, locale)}
                  </button>
                );
              })}
            </div>
          )}

          <div className={styles.folderSection}>
            {!folderQueryText && <div className={styles.sectionLabel}>{t("folders")}</div>}
            {hasNoResults ? (
              <div className={styles.emptyState}>{t("noMatchingFolders", { query })}</div>
            ) : (
              rootFolders.map((folder) => (
                <FolderPickerNode
                  key={folder.id}
                  folder={folder}
                  depth={0}
                  forceShow={false}
                  folderTree={folderTree}
                  folderById={folderById}
                  folderQueryText={folderQueryText}
                  collapsedFolders={collapsedFolders}
                  onToggleCollapse={onToggleCollapse}
                  onSelectFolder={handleSelect}
                  folderSpecialIcon={folderSpecialIcon}
                  hasFolderMatch={hasFolderMatch}
                />
              ))
            )}
          </div>
        </div>
      </Dialog.Content>
    </Dialog.Root>
  );
}
