import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { useCallback, useState } from "react";
import { renderToString } from "react-dom/server";
import { useIsMobile } from "./use-mobile";
import { useMobileNavigation } from "./useMobileNavigation";
import { Sheet, SheetContent, SheetTitle } from "@/app/components/ui/sheet";
import ShellPanes from "@/app/components/shell/ShellPanes";

const restores: Array<() => void> = [];
afterEach(() => {
  cleanup();
  restores.splice(0).forEach((restore) => restore());
  window.history.replaceState(null, "");
});
function Navigation({ initialId = null, mobile = true }: { initialId?: string | null; mobile?: boolean }) {
  const [id, setId] = useState(initialId);
  const clear = useCallback(() => setId(null), []);
  const { view, back } = useMobileNavigation(mobile, id, clear);
  return <>
    <button onClick={() => setId("notice-message")}>Open notice</button>
    <button onClick={() => setId("reminder-message")}>Open reminder</button>
    <button onClick={clear}>Clear selection</button>
    <button onClick={back}>Back</button>
    <output>{view}</output>
    <ShellPanes mobileView={view} list={<input aria-label="List scroll fixture" defaultValue="kept" />} reader={<div>Thread content</div>} />
  </>;
}

describe("derived mobile navigation", () => {
  it("pushes one history entry for external selections and keeps both panes mounted", () => {
    window.history.replaceState({ unrelated: "kept" }, "");
    const push = spyOn(window.history, "pushState");
    restores.push(() => push.mockRestore());
    const page = render(<Navigation />);
    const list = page.getByRole("textbox");
    const thread = page.getByText("Thread content");
    expect(page.getByRole("status", { hidden: true }).textContent).toBe("list");
    fireEvent.click(page.getByText("Open notice"));
    expect(page.getByRole("status", { hidden: true }).textContent).toBe("thread");
    expect(push).toHaveBeenCalledTimes(1);
    expect(window.history.state).toEqual({ unrelated: "kept", noctuaMobileView: "thread" });
    fireEvent.click(page.getByText("Open reminder"));
    expect(push).toHaveBeenCalledTimes(1);
    expect(page.getByRole("textbox")).toBe(list);
    expect(page.getByText("Thread content")).toBe(thread);
    fireEvent.click(page.getByText("Clear selection"));
    expect(page.getByRole("status", { hidden: true }).textContent).toBe("list");
  });
  it("derives thread for initial deep links, and returns to list on popstate", () => {
    const page = render(<Navigation initialId="deep-link" />);
    expect(page.getByRole("status", { hidden: true }).textContent).toBe("thread");
    act(() => window.dispatchEvent(new PopStateEvent("popstate", { state: null })));
    expect(page.getByRole("status", { hidden: true }).textContent).toBe("list");
  });
  it("uses browser back for a marked entry and clears a selection without a marker", () => {
    const back = spyOn(window.history, "back").mockImplementation(() => {});
    restores.push(() => back.mockRestore());
    const page = render(<Navigation initialId="message" />);
    fireEvent.click(page.getByText("Back"));
    expect(back).toHaveBeenCalledTimes(1);
    window.history.replaceState(null, "");
    fireEvent.click(page.getByText("Back"));
    expect(back).toHaveBeenCalledTimes(1);
    expect(page.getByRole("status", { hidden: true }).textContent).toBe("list");
  });
  it("does not push history for desktop selections", () => {
    const push = spyOn(window.history, "pushState");
    restores.push(() => push.mockRestore());
    const page = render(<Navigation mobile={false} initialId="desktop-message" />);
    fireEvent.click(page.getByText("Open notice"));
    expect(push).not.toHaveBeenCalled();
  });
  it("server renders initial thread visibility independently of the media query", () => {
    expect(renderToString(<Navigation initialId="deep-link" />)).toContain('data-mobile-view="thread"');
  });
  it("reads the media query on first client mount and follows breakpoint changes", () => {
    const originalWidth = window.innerWidth;
    window.innerWidth = 390;
    restores.push(() => { window.innerWidth = originalWidth; });
    function Probe() { return <output>{String(useIsMobile())}</output>; }
    const page = render(<Probe />);
    expect(page.getByRole("status", { hidden: true }).textContent).toBe("true");
    // happy-dom initializes each matchMedia listener with matchesState=false.
    act(() => window.dispatchEvent(new Event("resize")));
    act(() => { window.innerWidth = 1000; window.dispatchEvent(new Event("resize")); });
    expect(page.getByRole("status", { hidden: true }).textContent).toBe("false");
  });
});


describe("mobile overlay navigation history", () => {
  it("places an initially open Sheet above an initial deep-linked thread", async () => {
    const originalWidth = window.innerWidth;
    window.innerWidth = 390;
    restores.push(() => { window.innerWidth = originalWidth; });
    const pushes: unknown[] = [];
    const originalPush = window.history.pushState.bind(window.history);
    const push = spyOn(window.history, "pushState").mockImplementation((state: unknown, unused: string, url?: string | URL | null) => {
      pushes.push(state);
      originalPush(state, unused, url);
    });
    restores.push(() => push.mockRestore());
    function Initial() {
      const [open, setOpen] = useState(true);
      useMobileNavigation(true, "synthetic-deep-link", () => {});
      return <Sheet open={open} onOpenChange={setOpen}><SheetContent aria-describedby={undefined}>
        <SheetTitle>Calendar</SheetTitle>
      </SheetContent></Sheet>;
    }
    render(<Initial />);
    expect(pushes).toHaveLength(2);
    expect(pushes[0]).toEqual({ noctuaMobileView: "thread" });
    expect(window.history.state.noctuaMobileView).toBe("thread");
    act(() => window.dispatchEvent(new PopStateEvent("popstate", { state: pushes[0] })));
  });
  it("Back dismisses Processes before the thread, and supports nested settings/sidebar Sheets", async () => {
    const originalWidth = window.innerWidth;
    window.innerWidth = 390;
    restores.push(() => { window.innerWidth = originalWidth; });
    function Overlays() {
      const [id, setId] = useState<string | null>(null);
      const [processes, setProcesses] = useState(false);
      const [settings, setSettings] = useState(false);
      const clear = useCallback(() => setId(null), []);
      const { view } = useMobileNavigation(true, id, clear);
      return <><output>{view}</output><button onClick={() => setId("synthetic-message")}>Thread</button>
        <button onClick={() => setProcesses(true)}>Processes</button>
        <Sheet open={processes} onOpenChange={setProcesses}><SheetContent aria-describedby={undefined}>
          <SheetTitle>Processes</SheetTitle><button onClick={() => setSettings(true)}>Settings</button>
        </SheetContent></Sheet>
        <Sheet open={settings} onOpenChange={setSettings}><SheetContent aria-describedby={undefined}>
          <SheetTitle>Settings</SheetTitle>
        </SheetContent></Sheet>
      </>;
    }
    const page = render(<Overlays />);
    fireEvent.click(page.getByText("Thread"));
    const threadState = window.history.state;
    fireEvent.click(page.getByRole("button", { name: "Processes" }));
    const processState = window.history.state;
    expect(processState.noctuaMobileOverlay).toBeNumber();
    fireEvent.click(page.getByRole("button", { name: "Settings" }));
    expect(window.history.state.noctuaMobileOverlay).not.toBe(processState.noctuaMobileOverlay);
    act(() => window.dispatchEvent(new PopStateEvent("popstate", { state: processState })));
    await waitFor(() => expect(page.queryByRole("dialog", { name: "Settings" })).toBeNull());
    expect(page.getByRole("status", { hidden: true }).textContent).toBe("thread");
    act(() => window.dispatchEvent(new PopStateEvent("popstate", { state: threadState })));
    await waitFor(() => expect(page.queryByRole("dialog", { name: "Processes" })).toBeNull());
    expect(page.getByRole("status", { hidden: true }).textContent).toBe("thread");
    act(() => window.dispatchEvent(new PopStateEvent("popstate", { state: null })));
    expect(page.getByRole("status", { hidden: true }).textContent).toBe("list");
  });
});
