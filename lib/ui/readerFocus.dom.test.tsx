import { afterEach, expect, test } from "bun:test";
import { useEffect, useRef, useState } from "react";
import { act, cleanup, fireEvent } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { render } from "@/lib/i18n/testRender";
import ShellPanes from "@/app/components/shell/ShellPanes";
import ReaderToolbar from "@/app/components/mailclient/message/ReaderToolbar";
import MessageListView from "@/app/components/mailclient/messagelist/MessageListView";
import { reviewListProps } from "@/tests/helpers/i18nSlice2b";
import { handleMessageRowKeyDown } from "@/app/components/mailclient/messagelist/listInteractions";
import { useReaderFocus } from "./useReaderFocus";
import { isReaderRowActivation, readerShortcut, READER_HINT_KEY, READER_LAYOUT_KEY } from "./readerFocus";

afterEach(() => { cleanup(); localStorage.clear(); });
function FocusHarness({ mobile = false }: { mobile?: boolean }) {
  const { readerLayout, changeLayout, onNavigate, onSelect, hintMessageId, dismissHint } = useReaderFocus(mobile);
  const [selected, setSelected] = useState(false);
  const scroll = useRef<HTMLDivElement>(null);
  const open = () => { onSelect("synthetic"); changeLayout("focus"); };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (mobile) return;
      const shortcut = readerShortcut(e);
      if (shortcut === "back") changeLayout("split");
      if (shortcut === "toggle") changeLayout(readerLayout === "split" ? "focus" : "split");
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [changeLayout, mobile, readerLayout]);
  const toolbar = <ReaderToolbar layout={readerLayout} showHint={hintMessageId === "synthetic"} dismissHint={dismissHint}
    toggleLayout={() => changeLayout(readerLayout === "split" ? "focus" : "split")} back={() => changeLayout("split")}
    archive={() => {}} spam={() => {}} inSpam={false} remove={() => {}} move={() => {}} topics={() => {}} done={() => {}}
    isDone={false} busy={false} menu={null} openWindow={() => {}} position={1} total={2} hasMore={false}
    previous={() => {}} next={() => {}} canPrevious={false} canNext navigating={false} />;
  return <Theme><button onClick={onNavigate}>Synthetic folder</button><ShellPanes readerLayout={readerLayout}
    list={<div ref={scroll} data-testid="scroll"><div role="button" tabIndex={0} data-testid="row" data-selected={selected}
      onClick={() => { setSelected(true); onSelect("synthetic"); }}
      onDoubleClick={event => { if (isReaderRowActivation(event)) open(); }}
      onKeyDown={event => handleMessageRowKeyDown({ event, messageId: "synthetic", onSelect: open, selectRangeTo() {}, toggleMessageSelection() {} })}>Synthetic message</div></div>}
    reader={mobile ? <div>Mobile reader</div> : toolbar} /></Theme>;
}
function layout(container: HTMLElement) { return container.querySelector('[data-reader-layout]')!.getAttribute("data-reader-layout"); }

test("split/focus round trip keeps the list node, its selection and scroll position", () => {
  const view = render(<FocusHarness />), row = view.getByTestId("row"), scroll = view.getByTestId("scroll");
  scroll.scrollTop = 211;
  fireEvent.click(row); fireEvent.doubleClick(row);
  expect(layout(view.container)).toBe("focus");
  expect(localStorage.getItem(READER_LAYOUT_KEY)).toBe("focus");
  fireEvent.click(view.getByRole("button", { name: "Back to messages" }));
  expect(layout(view.container)).toBe("split");
  expect(view.getByTestId("row")).toBe(row);
  expect(row.getAttribute("data-selected")).toBe("true");
  expect(scroll.scrollTop).toBe(211);
  fireEvent.click(view.getByRole("button", { name: "Expand reading view" }));
  fireEvent.click(view.getByRole("button", { name: "Show message list" }));
  expect(layout(view.container)).toBe("split");
});
test("Enter, Shift+Enter, Escape and sidebar navigation; preferred layout survives remount", async () => {
  let view = render(<FocusHarness />);
  fireEvent.keyDown(view.getByTestId("row"), { key: "Enter" });
  expect(layout(view.container)).toBe("focus");
  fireEvent.click(view.getByText("Synthetic folder"));
  expect(layout(view.container)).toBe("split");
  expect(localStorage.getItem(READER_LAYOUT_KEY)).toBe("focus");
  fireEvent.click(view.getByTestId("row"));
  expect(layout(view.container)).toBe("focus");
  view.unmount(); view = render(<FocusHarness />);
  expect(layout(view.container)).toBe("focus");
  fireEvent.keyDown(window, { key: "Escape" });
  expect(layout(view.container)).toBe("split");
  fireEvent.keyDown(window, { key: "Enter", shiftKey: true });
  expect(layout(view.container)).toBe("focus");
  const input = document.createElement("input"); document.body.append(input);
  fireEvent.keyDown(input, { key: "Escape" }); expect(layout(view.container)).toBe("focus"); input.remove();
  const menu = document.createElement("div"); menu.setAttribute("role", "menu"); document.body.append(menu);
  fireEvent.keyDown(window, { key: "Escape" }); expect(layout(view.container)).toBe("focus"); menu.remove();
  await act(async () => {});
});
test("hint is one line of translated copy, dismissible and seen only once across messages/remount", () => {
  let view = render(<FocusHarness />);
  fireEvent.click(view.getByTestId("row"));
  expect(view.getByText("Tip: Double-click opens the message in a larger view")).toBeTruthy();
  expect(localStorage.getItem(READER_HINT_KEY)).toBe("1");
  fireEvent.click(view.getByTestId("row"));
  expect(view.getByText("Tip: Double-click opens the message in a larger view")).toBeTruthy();
  fireEvent.click(view.getByRole("button", { name: "Dismiss reading view tip" }));
  expect(view.queryByText(/^Tip:/)).toBeNull();
  view.unmount(); view = render(<FocusHarness />);
  fireEvent.click(view.getByTestId("row")); expect(view.queryByText(/^Tip:/)).toBeNull();
});
test("mobile ignores saved focus and focus entry paths, leaving desktop preference intact", () => {
  localStorage.setItem(READER_LAYOUT_KEY, "focus");
  const view = render(<FocusHarness mobile />);
  fireEvent.doubleClick(view.getByTestId("row")); fireEvent.keyDown(window, { key: "Enter", shiftKey: true });
  expect(layout(view.container)).toBe("split");
  expect(view.queryByRole("button", { name: "Expand reading view" })).toBeNull();
  expect(localStorage.getItem(READER_LAYOUT_KEY)).toBe("focus");
  expect(localStorage.getItem(READER_HINT_KEY)).toBeNull();
});
for (const mode of ["card", "compact", "table", "threads"] as const) test(`${mode}: real row supports double-click and Enter without activating from child controls`, () => {
  const props = reviewListProps(); const opened: string[] = []; const rows: string[][] = [];
  const view = render(<Theme><MessageListView {...props} view={mode} actions={{ ...props.actions,
    onOpenReader: message => opened.push(message.id), onNavigationRowsChange: messages => rows.push(messages.map(m => m.id)) }} /></Theme>);
  const row = view.container.querySelector<HTMLElement>('[data-message-list-row="true"]')!;
  fireEvent.doubleClick(row); fireEvent.keyDown(row, { key: "Enter" });
  expect(opened).toEqual([row.dataset.messageId!, row.dataset.messageId!]);
  const control = row.querySelector("button")!;
  fireEvent.doubleClick(control); fireEvent.keyDown(control, { key: "Enter" });
  expect(opened.length).toBe(2);
  expect(rows.at(-1)).toContain(row.dataset.messageId!);
});
