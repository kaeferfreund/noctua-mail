"use client";

import mobileStyles from "./MobileFrames.module.css";
import type { ReactNode } from "react";
import { useRef } from "react";
import { Dialog, Theme } from "@radix-ui/themes";
import { useIsMobile } from "@/app/hooks/use-mobile";
import { Sheet, SheetContent, SheetTitle } from "@/app/components/ui/sheet";
import { DialogLayerContext, DIALOG_LAYERS } from "@/app/components/ui/dialogLayers";

export function SettingsTitle({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();
  return isMobile ? <SheetTitle className="m-0">{children}</SheetTitle> : <Dialog.Title size="5" weight="bold">{children}</Dialog.Title>;
}

export default function SettingsFrame({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const isMobile = useIsMobile();
  const opener = useRef<HTMLElement | null>(null);
  const focusProps = {
    onOpenAutoFocus: () => { opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; },
    onCloseAutoFocus: (event: Event) => { event.preventDefault(); opener.current?.focus(); }
  };
  if (isMobile) return <Sheet open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
    <SheetContent {...focusProps} aria-describedby={undefined} showCloseButton={false} className={mobileStyles.fullscreenSheet}>
      <DialogLayerContext.Provider value={DIALOG_LAYERS.base}><Theme asChild><div className={mobileStyles.settingsBody}>{children}</div></Theme></DialogLayerContext.Provider>
    </SheetContent>
  </Sheet>;
  return <Dialog.Root open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
    <Dialog.Content {...focusProps} className="account-settings-modal" size="4" width="94vw" maxWidth="980px" aria-describedby={undefined}
      onInteractOutside={(event) => event.preventDefault()}
      style={{ height: "min(86dvh, 900px)", overflow: "hidden" }}>
      <DialogLayerContext.Provider value={DIALOG_LAYERS.settings}>{children}</DialogLayerContext.Provider>
    </Dialog.Content>
  </Dialog.Root>;
}
