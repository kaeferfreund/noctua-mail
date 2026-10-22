"use client";

import mobileStyles from "./MobileFrames.module.css";
import type { ReactNode } from "react";
import { Dialog, Theme } from "@radix-ui/themes";
import { useIsMobile } from "@/app/hooks/use-mobile";
import { Sheet, SheetContent, SheetTitle } from "@/app/components/ui/sheet";

export function SettingsTitle({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();
  return isMobile ? <SheetTitle className="m-0">{children}</SheetTitle> : <Dialog.Title size="5" weight="bold">{children}</Dialog.Title>;
}

export default function SettingsFrame({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const isMobile = useIsMobile();
  if (isMobile) return <Sheet open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
    <SheetContent aria-describedby={undefined} showCloseButton={false} className={mobileStyles.fullscreenSheet}>
      <Theme asChild><div className={mobileStyles.settingsBody}>{children}</div></Theme>
    </SheetContent>
  </Sheet>;
  return <Dialog.Root open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
    <Dialog.Content className="account-settings-modal" size="4" width="94vw" maxWidth="980px" aria-describedby={undefined}
      onInteractOutside={(event) => event.preventDefault()} onEscapeKeyDown={(event) => event.preventDefault()}
      style={{ height: "min(86dvh, 900px)", overflow: "hidden" }}>
      {children}
    </Dialog.Content>
  </Dialog.Root>;
}
