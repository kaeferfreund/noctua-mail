import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { useCallback, useState } from "react";
import { renderToString } from "react-dom/server";
import { useIsMobile } from "./use-mobile";
import { useMobileNavigation } from "./useMobileNavigation";
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
    expect(page.getByRole("status").textContent).toBe("list");
    fireEvent.click(page.getByText("Open notice"));
    expect(page.getByRole("status").textContent).toBe("thread");
    expect(push).toHaveBeenCalledTimes(1);
    expect(window.history.state).toEqual({ unrelated: "kept", noctuaMobileView: "thread" });
    fireEvent.click(page.getByText("Open reminder"));
    expect(push).toHaveBeenCalledTimes(1);
    expect(page.getByRole("textbox")).toBe(list);
    expect(page.getByText("Thread content")).toBe(thread);
    fireEvent.click(page.getByText("Clear selection"));
    expect(page.getByRole("status").textContent).toBe("list");
  });
  it("derives thread for initial deep links, and returns to list on popstate", () => {
    const page = render(<Navigation initialId="deep-link" />);
    expect(page.getByRole("status").textContent).toBe("thread");
    act(() => window.dispatchEvent(new PopStateEvent("popstate", { state: null })));
    expect(page.getByRole("status").textContent).toBe("list");
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
    expect(page.getByRole("status").textContent).toBe("list");
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
    expect(page.getByRole("status").textContent).toBe("true");
    // happy-dom initializes each matchMedia listener with matchesState=false.
    act(() => window.dispatchEvent(new Event("resize")));
    act(() => { window.innerWidth = 1000; window.dispatchEvent(new Event("resize")); });
    expect(page.getByRole("status").textContent).toBe("false");
  });
});
