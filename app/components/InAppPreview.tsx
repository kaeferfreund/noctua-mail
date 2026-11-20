"use client";

import { Sheet, SheetContent } from "@/app/components/ui/sheet";
import { StatusSheetTitle } from "@/app/components/shell/StatusPanelFrame";
import mobileStyles from "@/app/components/shell/MobileFrames.module.css";

export type InAppPreviewTarget = {
  src: string;
  title: string;
  /** Sandbox tokens for the frame; left out only where a viewer cannot run sandboxed (PDF). */
  sandbox?: string;
};

/**
 * Full-screen preview inside the app, for a home-screen app where a new window
 * would have no way back (lib/ui/displayMode.ts). The phone frame keeps the
 * Sheet's 44px close below the status bar and the frame above the home
 * indicator; Escape and the mobile Back gesture close it like every Sheet.
 */
export default function InAppPreview({ target, onClose }: { target: InAppPreviewTarget | null; onClose: () => void }) {
  return (
    <Sheet open={target !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      {target && (
        <SheetContent
          aria-describedby={undefined}
          className={mobileStyles.fullscreenSheet}
          data-in-app-preview=""
          // Start on the close button, not the frame: keys pressed inside the frame's
          // document never reach the app, so Escape would not close the preview.
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            (event.currentTarget as HTMLElement | null)?.querySelector<HTMLElement>(':scope > [data-slot="sheet-close"]')?.focus();
          }}
        >
          <StatusSheetTitle title={target.title} />
          <iframe
            key={target.src}
            src={target.src}
            title={target.title}
            sandbox={target.sandbox}
            referrerPolicy="no-referrer"
            className="min-h-0 w-full flex-1 border-0 bg-white"
          />
        </SheetContent>
      )}
    </Sheet>
  );
}
