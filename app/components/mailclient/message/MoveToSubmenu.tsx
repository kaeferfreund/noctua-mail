"use client";

import { getFolderDisplayName } from "@/lib/i18n/folderNames";

import { useLocale, useTranslations } from "next-intl";
import { useIsMobile } from "@/app/hooks/use-mobile";
import mobileStyles from "@/app/components/shell/MobileFrames.module.css";
import { useState } from "react";
import { DropdownMenu } from "@radix-ui/themes";
import { FolderInput } from "lucide-react";
import type { Folder } from "@/lib/data";
import styles from "./MessageMenu.module.css";

type MoveToSubmenuProps = {
  onGetRecentFolders: () => Folder[];
  onMoveToFolder: (folderId: string) => void;
  onMoveToOther: () => void;
  disabled?: boolean;
};

/**
 * "Move to" submenu used by both the single-message DropdownMenu and the
 * multi-selection bulk context menu. Caller binds the target message(s)
 * inside its `onMoveToFolder` / `onMoveToOther` callbacks.
 *
 * Recent folders are fetched lazily when the submenu opens so the host
 * doesn't have to recompute the list on every render.
 */
export default function MoveToSubmenu({
  onGetRecentFolders,
  onMoveToFolder,
  onMoveToOther,
  disabled
}: MoveToSubmenuProps) {
  const locale = useLocale();
  const t = useTranslations("Reader");
  const isMobile = useIsMobile();
  const [recentFolders, setRecentFolders] = useState<Folder[]>([]);

  return (
    <DropdownMenu.Sub
      onOpenChange={(open) => {
        if (open) setRecentFolders(onGetRecentFolders());
      }}
    >
      <DropdownMenu.SubTrigger disabled={disabled}>
        <span className={styles.menuIcon}>
          <FolderInput size={14} />
        </span>
        <span className={styles.menuLabel}>{t("moveTo")}</span>
      </DropdownMenu.SubTrigger>
      <DropdownMenu.SubContent className={`${styles.menuContent} ${isMobile ? mobileStyles.messageMenu : ""}`}>
        {recentFolders.map((folder) => (
          <DropdownMenu.Item
            key={folder.id}
            onSelect={() => onMoveToFolder(folder.id)}
          >
            <span className={styles.menuIcon}>
              <FolderInput size={14} />
            </span>
            <span className={styles.menuLabel}>{getFolderDisplayName(folder, locale)}</span>
          </DropdownMenu.Item>
        ))}
        {recentFolders.length > 0 && <DropdownMenu.Separator />}
        <DropdownMenu.Item onSelect={() => onMoveToOther()}>
          <span className={styles.menuIcon}>
            <FolderInput size={14} />
          </span>
          <span className={styles.menuLabel}>{t("moreMenu")}</span>
        </DropdownMenu.Item>
      </DropdownMenu.SubContent>
    </DropdownMenu.Sub>
  );
}
