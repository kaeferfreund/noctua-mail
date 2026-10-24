"use client";

import { useSyncExternalStore, useState, type CSSProperties, type ReactNode } from "react";
import { SidebarInset, SidebarProvider } from "@/app/components/ui/sidebar";
import { TooltipProvider } from "@/app/components/ui/tooltip";
import { useIsMobile } from "@/app/hooks/use-mobile";
import { useMobileNavigation } from "@/app/hooks/useMobileNavigation";
import { MobileNavigationContext } from "./MobileNavigation";
import ShellHeader, { type ShellHeaderProps } from "./ShellHeader";
import styles from "./ShellPanes.module.css";
import ShellPanes, { type ShellPanesProps } from "./ShellPanes";
import ShellSidebar, { type ShellSidebarProps } from "./ShellSidebar";
import type { InAppNoticePlacement } from "@/app/components/mailclient/InAppNoticeStack";

// shadcn's SidebarProvider persists the open state in this cookie. The shell
// is server-rendered open and reads the cookie after mount; reading it during
// render would make the server and client trees disagree.
const SIDEBAR_COOKIE_NAME = "sidebar_state";
const noop = () => {};
const SIDEBAR_WIDTH = "18rem";
const subscribeSidebarCookie = () => () => {};

/**
 * Notices dock above the account card only while the desktop sidebar is
 * visible. A collapsed sidebar or the phone sheet would hide them, so they
 * float over the panes instead.
 */
export function resolveNoticePlacement(isMobile: boolean, sidebarOpen: boolean): InAppNoticePlacement {
  return !isMobile && sidebarOpen ? "sidebar" : "floating";
}

function readSidebarCookie(): boolean {
  const entry = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SIDEBAR_COOKIE_NAME}=`));
  if (!entry) return true;
  return entry.slice(SIDEBAR_COOKIE_NAME.length + 1) === "true";
}

export type AppShellProps = {
  onReaderNavigate?: () => void;
  mobileNavigation?: { messageId: string | null; clearMessage: () => void };
  sidebar: ShellSidebarProps;
  header: ShellHeaderProps;
  panes: ShellPanesProps;
  /** Shared compact header indicator and responsive status panels. */
  statusBar: ReactNode;
  /**
   * Fixed-position overlays that belong to the shell viewport. Dialogs and
   * portals are rendered by MailClient next to the shell, not inside it.
   */
  overlays?: ReactNode;
  /** In-app notice stack, rendered for the placement the shell layout allows. */
  notices?: (placement: InAppNoticePlacement) => ReactNode;
};

/**
 * Desktop application shell (design §7.2): sidebar, header, resizable list /
 * reading / calendar panes and the header status indicator. Owns layout, theme and
 * navigation state; all data state and handler bags stay in MailClient and
 * arrive as props.
 */
export default function AppShell({ sidebar, header, panes, statusBar, overlays, notices, mobileNavigation, onReaderNavigate }: AppShellProps) {
  // Hydrate the saved cookie without a synchronous setState effect. Changes
  // made through SidebarProvider drive local state and update its cookie.
  const isMobile = useIsMobile();
  const navigation = useMobileNavigation(isMobile, mobileNavigation?.messageId ?? null, mobileNavigation?.clearMessage ?? noop);
  const savedOpen = useSyncExternalStore(subscribeSidebarCookie, readSidebarCookie, () => true);
  const [sidebarOpen, setSidebarOpen] = useState<boolean | null>(null);
  const open = sidebarOpen ?? savedOpen;
  const noticePlacement = resolveNoticePlacement(isMobile, open);

  return (
    <MobileNavigationContext.Provider value={navigation.back}>
    <TooltipProvider>
      <SidebarProvider
        data-shell=""
        open={open}
        onOpenChange={setSidebarOpen}
        className="h-dvh min-h-0 overflow-hidden bg-sidebar text-foreground"
        style={{ "--sidebar-width": SIDEBAR_WIDTH, "--header-height": "3rem" } as CSSProperties}
      >
        <ShellSidebar
          {...sidebar}
          notices={noticePlacement === "sidebar" ? notices?.("sidebar") : null}
          onNavigate={isMobile ? mobileNavigation?.clearMessage : onReaderNavigate}
        />
        <SidebarInset className={`${styles.workspace} h-auto min-h-0 min-w-0 overflow-hidden md:rounded-xl md:shadow-xs`}>
          <ShellHeader
            {...header}
            // On phones an open message covers the list, so its controls go too.
<<<<<<< origin/feat/status-bar-compact
            toolbar={isMobile && navigation.view === "thread" ? undefined : header.toolbar}
            indicators={statusBar}
=======
            toolbar={(isMobile && navigation.view === "thread") || (!isMobile && panes.readerLayout === "focus") ? undefined : header.toolbar}
            indicators={isMobile ? statusBar : undefined}
>>>>>>> HEAD
          />
          <ShellPanes {...panes} mobileView={navigation.view} />
        </SidebarInset>
        {noticePlacement === "floating" ? notices?.("floating") : null}
        {overlays}
      </SidebarProvider>
    </TooltipProvider>
    </MobileNavigationContext.Provider>
  );
}
