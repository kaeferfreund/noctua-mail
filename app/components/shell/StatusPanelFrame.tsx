"use client";

import mobileStyles from "./MobileFrames.module.css";
import { useContext, type ComponentProps, type ReactNode } from "react";
import { MobileStatusFocusContext, restoreStatusFocus } from "./MobileStatusFocus";
import { Popover, Theme } from "@radix-ui/themes";
import { useIsMobile } from "@/app/hooks/use-mobile";
import { Sheet, SheetContent, SheetTitle } from "@/app/components/ui/sheet";
import { Badge } from "@/app/components/ui/badge";

type Props = {
  embedded?: boolean;
  description?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  count?: number;
  trigger: ReactNode;
  contentProps: ComponentProps<typeof Popover.Content>;
  children: ReactNode;
};

/** The one visible title row every phone status Sheet starts with; the Sheet's own close button sits at its end. */
export function StatusSheetTitle({ title, count }: { title: string; count?: number }) {
  return <div className={mobileStyles.statusSheetTitle}>
    <SheetTitle>{title}</SheetTitle>
    {count !== undefined ? <Badge variant="secondary" className="tabular-nums">{count}</Badge> : null}
  </div>;
}

/** Keeps each status panel's content and handlers shared across both frames. */
export default function StatusPanelFrame({ embedded, description, open, onOpenChange, title, count, trigger, contentProps, children }: Props) {
  const isMobile = useIsMobile();
  const focusTarget = useContext(MobileStatusFocusContext);
  if (embedded) return <>{children}</>;
  if (isMobile) return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent onCloseAutoFocus={(event) => restoreStatusFocus(event, focusTarget?.current)} side="bottom" aria-describedby={undefined} className={mobileStyles.statusSheet}>
        <StatusSheetTitle title={title} count={count} />
        <Theme asChild><div className={`${mobileStyles.statusContent} ${contentProps.className ?? ""}`}>{description ? <p className="mb-3 text-sm text-muted-foreground">{description}</p> : null}{children}</div></Theme>
      </SheetContent>
    </Sheet>
  );
  return <Popover.Root open={open} onOpenChange={onOpenChange}>
    <Popover.Trigger>{trigger}</Popover.Trigger>
    <Popover.Content {...contentProps}>{children}</Popover.Content>
  </Popover.Root>;
}
