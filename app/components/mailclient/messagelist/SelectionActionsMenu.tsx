"use client";

import { formatNumber } from "@/lib/i18n/format";

import { useLocale, useTranslations } from "next-intl";
import { DropdownMenu } from "@radix-ui/themes";
import { ListChecks, SquareDashed, SquareStack } from "lucide-react";
import ToolbarButton from "@/app/components/ToolbarButton";
import menuStyles from "../message/MessageMenu.module.css";
import BulkActionMenuItems, { type BulkActionMenuItemsProps } from "./BulkActionMenuItems";
import { useSelectionSnapshot, type SelectionStore } from "./selectionStore";

export type SelectionActionsMenuProps = BulkActionMenuItemsProps & {
  selectionStore: SelectionStore;
  /** With nothing selected the actions hit the open message, like the shortcuts. */
  hasActiveMessage: boolean;
  onSelectAll: () => void;
  onClearSelection: () => void;
};



/**
 * Header menu for the selected messages: the right-click bulk menu's actions,
 * reachable without a right click (touch) and next to the list tools. It
 * subscribes to the selection itself, so selecting rows re-renders only this
 * button and not the whole mail client.
 *
 * In a header narrower than 48rem (`@container/header`) the "3 selected" label
 * becomes a count badge on the icon; the button itself never drops out, since
 * on touch it is the only way to act on several messages.
 */
export default function SelectionActionsMenu({
  selectionStore,
  hasActiveMessage,
  onSelectAll,
  onClearSelection,
  ...itemProps
}: SelectionActionsMenuProps) {
  const locale = useLocale();
  const t = useTranslations("List");
  const { ids } = useSelectionSnapshot(selectionStore);
  const count = ids.size;
  const disabled = count === 0 && !hasActiveMessage;
  const countText = formatNumber(count, locale);
  const showCount = count >= 2;
  const tooltip = disabled
    ? t("actionsNothingSelected")
    : count === 0
      ? t("actionsOpenMessage")
      : t("actionsSelected", { count });

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        <ToolbarButton
          menu
          disabled={disabled}
          tooltip={tooltip}
          icon={
            <span className="relative inline-flex">
              <ListChecks className="size-4" />
              {showCount ? (
                <span
                  aria-hidden="true"
                  className="absolute -top-1.5 -right-2 min-w-3.5 rounded-full bg-primary px-1 text-center text-2xs leading-3.5 font-medium text-primary-foreground tabular-nums @3xl/header:hidden"
                >
                  {count > 99 ? "99+" : countText}
                </span>
              ) : null}
            </span>
          }
          label={showCount ? t("selectedCount", { count }) : undefined}
          labelClassName="hidden @3xl/header:inline-block"
        />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="start" sideOffset={6} className={menuStyles.menuContent}>
        <DropdownMenu.Label>{count === 0 ? t("openMessage") : t("selectedCount", { count })}</DropdownMenu.Label>
        <BulkActionMenuItems {...itemProps} />
        <DropdownMenu.Separator />
        <DropdownMenu.Item onSelect={onSelectAll}>
          <span className={menuStyles.menuIcon}>
            <SquareStack size={14} />
          </span>
          <span className={menuStyles.menuLabel}>{t("selectAll")}</span>
        </DropdownMenu.Item>
        <DropdownMenu.Item disabled={count === 0} onSelect={onClearSelection}>
          <span className={menuStyles.menuIcon}>
            <SquareDashed size={14} />
          </span>
          <span className={menuStyles.menuLabel}>{t("clearSelection")}</span>
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}
