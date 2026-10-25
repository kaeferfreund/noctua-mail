"use client";

import mobileStyles from "./MobileFrames.module.css";
import styles from "./SettingsFrame.module.css";
import type { ReactNode } from "react";
import { Dialog } from "@radix-ui/themes";
import { X } from "lucide-react";
import TooltipIconButton from "@/app/components/TooltipIconButton";
import { useIsMobile } from "@/app/hooks/use-mobile";
import { useMobileOverlayHistory } from "@/app/hooks/useMobileOverlayHistory";
import { DialogLayerContext, DIALOG_LAYERS } from "@/app/components/ui/dialogLayers";
import { useDialogFocusRestore } from "@/app/components/ui/dialogFocus";

export function SettingsTitle({ children }: { children: ReactNode }) {
  return <Dialog.Title size="5" weight="bold" mb="0">{children}</Dialog.Title>;
}

/** Title row shared by Settings and Admin: the title and one close icon button. */
export function SettingsHeader({ title, closeLabel, closeDisabled, onClose }: { title: ReactNode; closeLabel: string; closeDisabled?: boolean; onClose: () => void }) {
  return <div className={styles.header}>
    <SettingsTitle>{title}</SettingsTitle>
    <TooltipIconButton variant="ghost" tooltip={closeLabel} disabled={closeDisabled} onClick={onClose}><X size={18} /></TooltipIconButton>
  </div>;
}

/** Section navigation classes: vertical Settings tabs (`tabs`, plus `tabsWide` off phones) and the Admin button row (`buttons`). */
export const settingsNavClass = { tabs: styles.nav, tabsWide: styles.navWide, buttons: styles.sectionNav };

export default function SettingsFrame({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const isMobile = useIsMobile();
  const focusProps = useDialogFocusRestore();
  // Keep the portal and child tree mounted when only the presentation changes.
  // In particular, nested admin dialogs own unsaved state below this frame.
  useMobileOverlayHistory(isMobile && open, onClose);
  return <Dialog.Root open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
    <Dialog.Content {...focusProps} onOpenAutoFocus={(event) => {
      focusProps.onOpenAutoFocus();
      // Start on the selected tab or section, not on the first tabbable element
      // (the tooltip close button): its focus tooltip would swallow the first Escape.
      const tab = (event.currentTarget as HTMLElement | null)?.querySelector<HTMLElement>(`[role="tab"][aria-selected="true"], .${styles.sectionNav} [aria-pressed="true"]`);
      if (tab) { event.preventDefault(); tab.focus(); }
    }} data-slot={isMobile ? "sheet-content" : "settings-content"} className={`account-settings-modal ${isMobile ? mobileStyles.settingsFullscreen : ""}`} size="4" width="94vw" maxWidth="980px" aria-describedby={undefined}
      onInteractOutside={(event) => event.preventDefault()}
      style={{ height: isMobile ? "var(--app-height)" : "min(86dvh, 900px)", overflow: "hidden" }}>
      <DialogLayerContext.Provider value={DIALOG_LAYERS.settings}><div className={isMobile ? mobileStyles.settingsBody : undefined} style={{ height: "100%", minHeight: 0 }}>{children}</div></DialogLayerContext.Provider>
    </Dialog.Content>
  </Dialog.Root>;
}
