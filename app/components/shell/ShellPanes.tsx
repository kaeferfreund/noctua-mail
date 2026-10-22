"use client";

import type { CSSProperties, ReactNode } from "react";
import { useDefaultLayout, type LayoutStorage } from "react-resizable-panels";
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

// The hook defaults to `localStorage`, which does not exist while the shell is
// server-rendered; the wrapper reports "nothing stored" there and lets the
// client snapshot take over after hydration.
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
  list: ReactNode;
  reader: ReactNode;
  /** Mounted only while the calendar sidebar is open. */
  calendar?: ReactNode | null;
};

export default function ShellPanes({ list, reader, calendar }: ShellPanesProps) {
  const panelIds = calendar
    ? [LIST_PANEL_ID, READER_PANEL_ID, CALENDAR_PANEL_ID]
    : [LIST_PANEL_ID, READER_PANEL_ID];
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: PANE_LAYOUT_STORAGE_ID,
    panelIds,
    storage: paneLayoutStorage
  });

  return (
    <ResizablePanelGroup
      id="noctua-panes"
      orientation="horizontal"
      defaultLayout={defaultLayout}
      onLayoutChanged={onLayoutChanged}
      className="min-h-0 min-w-0 flex-1 gap-2 p-4"
    >
      <ResizablePanel
        id={LIST_PANEL_ID}
        defaultSize="42%"
        minSize={240}
        className="rounded-lg border bg-card shadow-xs"
        style={panelContentStyle}
      >
        {list}
      </ResizablePanel>
      <ResizableHandle className="w-1 bg-transparent" />
      <ResizablePanel
        id={READER_PANEL_ID}
        minSize={320}
        className="rounded-lg border bg-card shadow-xs"
        style={panelContentStyle}
      >
        {reader}
      </ResizablePanel>
      {calendar ? (
        <>
          <ResizableHandle className="w-1 bg-transparent" />
          <ResizablePanel
            id={CALENDAR_PANEL_ID}
            defaultSize={400}
            minSize={320}
            maxSize="50%"
            className="rounded-lg border bg-card shadow-xs"
            style={panelContentStyle}
          >
            {calendar}
          </ResizablePanel>
        </>
      ) : null}
    </ResizablePanelGroup>
  );
}
