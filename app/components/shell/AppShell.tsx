"use client";

import { useSyncExternalStore, useState, type CSSProperties, type ReactNode } from "react";
import { SidebarInset, SidebarProvider } from "@/app/components/ui/sidebar";
import { TooltipProvider } from "@/app/components/ui/tooltip";
import { useIsMobile } from "@/app/hooks/use-mobile";
import { useMobileNavigation } from "@/app/hooks/useMobileNavigation";
import { MobileNavigationContext } from "./MobileNavigation";
import ShellHeader, { type ShellHeaderProps } from "./ShellHeader";
import ShellPanes, { type ShellPanesProps } from "./ShellPanes";
import ShellSidebar, { type ShellSidebarProps } from "./ShellSidebar";

// shadcn's SidebarProvider persists the open state in this cookie. The shell
// is server-rendered open and reads the cookie after mount; reading it during
// render would make the server and client trees disagree.
const SIDEBAR_COOKIE_NAME = "sidebar_state";
const noop = () => {};
const SIDEBAR_WIDTH = "18rem";
const subscribeSidebarCookie = () => () => {};

function readSidebarCookie(): boolean {
  const entry = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SIDEBAR_COOKIE_NAME}=`));
  if (!entry) return true;
  return entry.slice(SIDEBAR_COOKIE_NAME.length + 1) === "true";
}

export type AppShellProps = {
  mobileNavigation?: { messageId: string | null; clearMessage: () => void };
  sidebar: ShellSidebarProps;
  header: ShellHeaderProps;
  panes: ShellPanesProps;
  /** Compact status bar below the panes (BottomStatusBar). */
  statusBar: ReactNode;
  /**
   * Fixed-position overlays that belong to the shell viewport (the in-app
   * notice stack). Dialogs and portals are rendered by MailClient next to
   * the shell, not inside it.
   */
  overlays?: ReactNode;
};

/**
 * Desktop application shell (design §7.2): sidebar, header, resizable list /
 * reading / calendar panes and the status bar. Owns layout, theme and
 * navigation state; all data state and handler bags stay in MailClient and
 * arrive as props.
 */
export default function AppShell({ sidebar, header, panes, statusBar, overlays, mobileNavigation }: AppShellProps) {
  // Hydrate the saved cookie without a synchronous setState effect. Changes
  // made through SidebarProvider drive local state and update its cookie.
  const isMobile = useIsMobile();
  const navigation = useMobileNavigation(isMobile, mobileNavigation?.messageId ?? null, mobileNavigation?.clearMessage ?? noop);
  const savedOpen = useSyncExternalStore(subscribeSidebarCookie, readSidebarCookie, () => true);
  const [sidebarOpen, setSidebarOpen] = useState<boolean | null>(null);

  return (
    <MobileNavigationContext.Provider value={navigation.back}>
    <TooltipProvider>
      <SidebarProvider
        data-shell=""
        open={sidebarOpen ?? savedOpen}
        onOpenChange={setSidebarOpen}
        className="h-dvh min-h-0 overflow-hidden bg-sidebar text-foreground"
        style={{ "--sidebar-width": SIDEBAR_WIDTH, "--header-height": "3rem" } as CSSProperties}
      >
        <ShellSidebar {...sidebar} onNavigate={isMobile ? mobileNavigation?.clearMessage : undefined} />
        <SidebarInset className="h-auto min-h-0 min-w-0 overflow-hidden md:rounded-xl md:shadow-xs">
          <ShellHeader
            {...header}
            // On phones an open message covers the list, so its controls go too.
            toolbar={isMobile && navigation.view === "thread" ? undefined : header.toolbar}
            indicators={isMobile ? statusBar : undefined}
          />
          <ShellPanes {...panes} mobileView={navigation.view} />
          {!isMobile ? statusBar : null}
        </SidebarInset>
        {overlays}
      </SidebarProvider>
    </TooltipProvider>
    </MobileNavigationContext.Provider>
  );
}
