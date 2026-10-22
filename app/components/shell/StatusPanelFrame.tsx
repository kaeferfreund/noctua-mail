"use client";

import mobileStyles from "./MobileFrames.module.css";
import { useContext, type ComponentProps, type ReactNode } from "react";
import { MobileStatusFocusContext, restoreStatusFocus } from "./MobileStatusFocus";
import { Popover, Theme } from "@radix-ui/themes";
import { useIsMobile } from "@/app/hooks/use-mobile";
import { Sheet, SheetContent, SheetTitle } from "@/app/components/ui/sheet";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  trigger: ReactNode;
  contentProps: ComponentProps<typeof Popover.Content>;
  children: ReactNode;
};

/** Keeps each status panel's content and handlers shared across both frames. */
export default function StatusPanelFrame({ open, onOpenChange, title, trigger, contentProps, children }: Props) {
  const isMobile = useIsMobile();
  const focusTarget = useContext(MobileStatusFocusContext);
  if (isMobile) return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent onCloseAutoFocus={(event) => restoreStatusFocus(event, focusTarget?.current)} side="bottom" aria-describedby={undefined} showCloseButton={false} className={mobileStyles.statusSheet}>
        <SheetTitle className="sr-only">{title}</SheetTitle>
        <Theme asChild><div className={`${mobileStyles.statusContent} ${contentProps.className ?? ""}`}>{children}</div></Theme>
      </SheetContent>
    </Sheet>
  );
  return <Popover.Root open={open} onOpenChange={onOpenChange}>
    <Popover.Trigger>{trigger}</Popover.Trigger>
    <Popover.Content {...contentProps}>{children}</Popover.Content>
  </Popover.Root>;
}
