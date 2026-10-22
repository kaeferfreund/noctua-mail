"use client";

import type React from "react";
import { useEffect, useRef } from "react";
import { DropdownMenu } from "@radix-ui/themes";
import menuStyles from "../message/MessageMenu.module.css";
import BulkActionMenuItems, { type BulkActionMenuItemsProps } from "./BulkActionMenuItems";

type BulkActionContextMenuProps = {
  open: boolean;
  position: { x: number; y: number } | null;
  selectionCount: number;
  onOpenChange: (open: boolean) => void;
  /**
   * Element to focus when the menu closes. Radix's default would restore
   * focus to our invisible positioning trigger; we prefer the right-clicked
   * row so keyboard / screen-reader navigation lands somewhere meaningful.
   */
  returnFocusRef?: React.RefObject<HTMLElement | null>;
} & BulkActionMenuItemsProps;

/**
 * Bulk-action menu shown when right-clicking a row inside a multi-message
 * selection. The items are shared with the header's selection menu; the
 * caller binds them to the selection captured when the menu opened.
 *
 * Anchored to an invisible fixed-position trigger so Radix's DropdownMenu
 * positioning works against arbitrary pointer coordinates.
 */
export default function BulkActionContextMenu({
  open,
  position,
  selectionCount,
  onOpenChange,
  returnFocusRef,
  ...itemProps
}: BulkActionContextMenuProps) {
  const triggerRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!open || !position) return;
    const node = triggerRef.current;
    if (!node) return;
    node.style.left = `${position.x}px`;
    node.style.top = `${position.y}px`;
  }, [open, position]);

  return (
    <DropdownMenu.Root open={open} onOpenChange={onOpenChange}>
      <DropdownMenu.Trigger>
        <span
          ref={triggerRef}
          tabIndex={-1}
          style={{
            position: "fixed",
            width: 0,
            height: 0,
            left: position?.x ?? -9999,
            top: position?.y ?? -9999,
            pointerEvents: "none"
          }}
        />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content
        align="start"
        side="bottom"
        sideOffset={2}
        className={menuStyles.menuContent}
        onContextMenu={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => {
          const target = returnFocusRef?.current;
          if (target) {
            event.preventDefault();
            target.focus();
          }
        }}
      >
        <DropdownMenu.Label>{selectionCount} selected</DropdownMenu.Label>
        <BulkActionMenuItems {...itemProps} />
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}
