"use client";

import { useTranslations } from "next-intl";

import type { ReaderLayout } from "@/lib/ui/readerFocus";
import mobileStyles from "./MobileFrames.module.css";
import { Theme } from "@radix-ui/themes";
import { useIsMobile } from "@/app/hooks/use-mobile";
import { Sheet, SheetContent, SheetTitle } from "@/app/components/ui/sheet";
import styles from "./ShellPanes.module.css";
import { useEffect, useMemo, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { useDefaultLayout, useGroupCallbackRef, type LayoutStorage } from "react-resizable-panels";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup
} from "@/app/components/ui/resizable";

// Design §7.2 asks for `autoSaveId="noctua:panes"` with a stable id and order
// per panel. react-resizable-panels v4 (which the shadcn wrapper targets) has
// neither prop: persistence goes through `useDefaultLayout` keyed by this id,
// and conditionally mounted panels are handled by passing the ids of the
// panels currently rendered (one stored layout per id set). Order is the
// render order below, which never changes.
export const PANE_LAYOUT_STORAGE_ID = "noctua:panes";

const LIST_PANEL_ID = "list";
const READER_PANEL_ID = "reader";
const CALENDAR_PANEL_ID = "calendar";

// Read storage only after hydration, then restore through the group API.
// Server markup and the first client snapshot must use the same defaults.
const subscribeMounted = () => () => {};
const paneLayoutStorage: LayoutStorage = {
  getItem: (key) => (typeof window === "undefined" ? null : window.localStorage.getItem(key)),
  setItem: (key, value) => {
    if (typeof window !== "undefined") window.localStorage.setItem(key, value);
  }
};

// `Panel` applies className and style to an inner wrapper whose inline
// `overflow: auto` would turn it into the scroll container; the panes own
// their scrolling (MessageListPane is the list's virtualization viewport),
// so the wrapper is a non-scrolling flex column instead.
const panelContentStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  overflow: "hidden"
};

export type ShellPanesProps = {
  readerLayout?: ReaderLayout;
  mobileView?: "list" | "thread";
  onCloseCalendar?: () => void;
  list: ReactNode;
  reader: ReactNode;
  /** Mounted only while the calendar sidebar is open. */
  calendar?: ReactNode | null;
};

export default function ShellPanes({ list, reader, calendar, mobileView = "list", readerLayout = "split", onCloseCalendar }: ShellPanesProps) {
  const t = useTranslations("Shell");
  const isMobile = useIsMobile();
  const focus = !isMobile && readerLayout === "focus";
  const desktopCalendar = Boolean(calendar) && !isMobile;
  const panelIds = useMemo(() => desktopCalendar
    ? [LIST_PANEL_ID, READER_PANEL_ID, CALENDAR_PANEL_ID]
    : [LIST_PANEL_ID, READER_PANEL_ID], [desktopCalendar]);
  const mounted = useSyncExternalStore(subscribeMounted, () => true, () => false);
  const storage = useMemo<LayoutStorage>(() => ({
    getItem: (key) => mounted ? paneLayoutStorage.getItem(key) : null,
    setItem: paneLayoutStorage.setItem
  }), [mounted]);
  const [group, groupRef] = useGroupCallbackRef();
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: PANE_LAYOUT_STORAGE_ID,
    panelIds,
    storage,
    onlySaveAfterUserInteractions: true
  });

  useEffect(() => {
    if (!isMobile && defaultLayout && group) group.setLayout(defaultLayout);
  }, [defaultLayout, group, isMobile, panelIds]);

  return (
    <>
    <ResizablePanelGroup
      id="noctua-panes"
      data-mobile-view={mobileView}
      data-reader-layout={focus ? "focus" : "split"}
      orientation="horizontal"
      disabled={isMobile || focus}
      groupRef={groupRef}
      onLayoutChanged={isMobile || focus ? undefined : onLayoutChanged}
      className={`${styles.panes} min-h-0 min-w-0 flex-1 gap-2 p-4`}
    >
      <ResizablePanel
        id={LIST_PANEL_ID}
        defaultSize="42%"
        minSize={isMobile ? 0 : 240}
        className="rounded-lg border bg-card shadow-xs"
        style={panelContentStyle}
      >
        {list}
      </ResizablePanel>
      <ResizableHandle className="w-1 bg-transparent" />
      <ResizablePanel
        id={READER_PANEL_ID}
        minSize={isMobile ? 0 : 320}
        className="rounded-lg border bg-card shadow-xs"
        style={panelContentStyle}
      >
        {reader}
      </ResizablePanel>
      {desktopCalendar ? (
        <>
          <ResizableHandle className="w-1 bg-transparent" />
          <ResizablePanel
            id={CALENDAR_PANEL_ID}
            defaultSize={400}
            minSize={isMobile ? 0 : 320}
            maxSize="50%"
            className="rounded-lg border bg-card shadow-xs"
            style={panelContentStyle}
          >
            {calendar}
          </ResizablePanel>
        </>
      ) : null}
    </ResizablePanelGroup>
    {isMobile && calendar ? <Sheet open onOpenChange={(open) => { if (!open) onCloseCalendar?.(); }}>
      <SheetContent aria-describedby={undefined} className={mobileStyles.fullscreenSheet} showCloseButton={false}>
        <SheetTitle className="sr-only">{t("calendar")}</SheetTitle>
        <Theme asChild><div className="flex min-h-0 flex-1 flex-col">{calendar}</div></Theme>
      </SheetContent>
    </Sheet> : null}
    </>
  );
}
