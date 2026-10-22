"use client";

import { DropdownMenu } from "@radix-ui/themes";
import {
  Archive as ArchiveIcon,
  ArrowRightLeft,
  Copy,
  Flag,
  Mail,
  MailOpen,
  Square,
  Tags,
  Trash2
} from "lucide-react";
import type { Folder, Topic } from "@/lib/data";
import menuStyles from "../message/MessageMenu.module.css";
import MoveToSubmenu from "../message/MoveToSubmenu";
import TopicBadge from "../TopicBadge";
import type { BulkActionMenuActions } from "./selectionActions";

export type BulkActionMenuItemsProps = {
  actions: BulkActionMenuActions;
  allTopics: Topic[];
  hasOtherAccounts: boolean;
  onGetRecentFolders: () => Folder[];
};

/**
 * The actions for selected messages, shared by the right-click bulk menu and
 * the header's selection menu. Render inside a Radix Themes
 * `DropdownMenu.Content`. The shortcut hints are the list's keyboard
 * shortcuts, which run the same actions.
 */
export default function BulkActionMenuItems({
  actions,
  allTopics,
  hasOtherAccounts,
  onGetRecentFolders
}: BulkActionMenuItemsProps) {
  return (
    <>
      <DropdownMenu.Item shortcut="R" onSelect={actions.onMarkRead}>
        <span className={menuStyles.menuIcon}>
          <MailOpen size={14} />
        </span>
        <span className={menuStyles.menuLabel}>Mark as read</span>
      </DropdownMenu.Item>
      <DropdownMenu.Item shortcut="U" onSelect={actions.onMarkUnread}>
        <span className={menuStyles.menuIcon}>
          <Mail size={14} />
        </span>
        <span className={menuStyles.menuLabel}>Mark as unread</span>
      </DropdownMenu.Item>
      <DropdownMenu.Item shortcut="F" onSelect={actions.onToggleFlag}>
        <span className={menuStyles.menuIcon}>
          <Flag size={14} />
        </span>
        <span className={menuStyles.menuLabel}>Flag</span>
      </DropdownMenu.Item>
      <DropdownMenu.Item shortcut="T" onSelect={actions.onToggleTodo}>
        <span className={menuStyles.menuIcon}>
          <Square size={14} />
        </span>
        <span className={menuStyles.menuLabel}>To-Do</span>
      </DropdownMenu.Item>
      <DropdownMenu.Separator />
      <MoveToSubmenu
        onGetRecentFolders={onGetRecentFolders}
        onMoveToFolder={actions.onMoveToFolder}
        onMoveToOther={actions.onMoveToOther}
      />
      {hasOtherAccounts && (
        <DropdownMenu.Item onSelect={actions.onCopyToAccount}>
          <span className={menuStyles.menuIcon}>
            <Copy size={14} />
          </span>
          <span className={menuStyles.menuLabel}>Copy to account...</span>
        </DropdownMenu.Item>
      )}
      {hasOtherAccounts && (
        <DropdownMenu.Item onSelect={actions.onMoveToAccount}>
          <span className={menuStyles.menuIcon}>
            <ArrowRightLeft size={14} />
          </span>
          <span className={menuStyles.menuLabel}>Move to account...</span>
        </DropdownMenu.Item>
      )}
      <DropdownMenu.Sub>
        <DropdownMenu.SubTrigger disabled={allTopics.length === 0}>
          <span className={menuStyles.menuIcon}>
            <Tags size={14} />
          </span>
          <span className={menuStyles.menuLabel}>Add topic</span>
        </DropdownMenu.SubTrigger>
        <DropdownMenu.SubContent
          className={menuStyles.menuContent}
          style={{ maxHeight: 360, overflowY: "auto" }}
        >
          {allTopics.map((topic) => (
            <DropdownMenu.Item key={topic.id} onSelect={() => actions.onAddTopic(topic.id)}>
              <TopicBadge topic={topic} size="1" />
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.SubContent>
      </DropdownMenu.Sub>
      <DropdownMenu.Item onSelect={actions.onArchive}>
        <span className={menuStyles.menuIcon}>
          <ArchiveIcon size={14} />
        </span>
        <span className={menuStyles.menuLabel}>Archive</span>
      </DropdownMenu.Item>
      <DropdownMenu.Separator />
      <DropdownMenu.Item color="red" shortcut="Del" onSelect={actions.onDelete}>
        <span className={menuStyles.menuIcon}>
          <Trash2 size={14} />
        </span>
        <span className={menuStyles.menuLabel}>Delete</span>
      </DropdownMenu.Item>
    </>
  );
}
