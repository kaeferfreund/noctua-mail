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
import { useReaderFocusPlacement } from "./useReaderFocusPlacement";
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
  expect(view.getByRole("group", { name: "Message reading controls" })).toBeTruthy();
  const position = view.container.querySelector("[data-reader-position]")!;
  expect(position.getAttribute("aria-live")).toBe("polite");
  expect(document.getElementById(position.getAttribute("aria-describedby")!)?.textContent).toBe("Message 1 of 2 visible rows");
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
test("keyboard entry: one Escape leaves focus while the focused Back tooltip is open", async () => {
  const view = render(<FocusHarness />);
  fireEvent.keyDown(view.getByTestId("row"), { key: "Enter" });
  expect(layout(view.container)).toBe("focus");
  // Keyboard-driven focus placement matches :focus-visible, which opens the tooltip.
  const back = view.getByRole("button", { name: "Back to messages" });
  await act(async () => { back.focus(); });
  expect(document.querySelector('[role="tooltip"]')?.textContent).toBe("Back to messages (Escape)");
  fireEvent.keyDown(back, { key: "Escape" });
  expect(layout(view.container)).toBe("split");
  // Escape handled by anything other than a tooltip still wins over the shortcut.
  const handled = new KeyboardEvent("keydown", { key: "Escape", cancelable: true });
  handled.preventDefault();
  expect(readerShortcut(handled)).toBeNull();
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

test("every focus entry places focus on Back; exit restores scroll with a virtualized-row fallback", async () => {
  function Harness({ focused, rowPresent }: { focused: boolean; rowPresent: boolean }) {
    const list = useRef<HTMLDivElement>(null), savedScroll = useRef<number | null>(211);
    useReaderFocusPlacement(focused, "synthetic", list, savedScroll);
    return <><div ref={list} tabIndex={-1} data-testid="focus-list">
      {rowPresent && <button data-message-id="synthetic">Synthetic row</button>}
    </div>{focused && <div data-reader-toolbar=""><button>Back</button></div>}</>;
  }
  const view = render(<Harness focused={false} rowPresent />);
  view.rerender(<Harness focused rowPresent />);
  await act(async () => { await new Promise(resolve => window.requestAnimationFrame(resolve)); });
  expect(document.activeElement).toBe(view.getByText("Back"));
  view.rerender(<Harness focused={false} rowPresent={false} />);
  await act(async () => { await new Promise(resolve => window.requestAnimationFrame(resolve)); });
  expect(document.activeElement).toBe(view.getByTestId("focus-list"));
  expect(view.getByTestId("focus-list").scrollTop).toBe(211);
  // The same effect also handles a single click re-entering the saved preference.
  view.rerender(<Harness focused rowPresent />);
  await act(async () => { await new Promise(resolve => window.requestAnimationFrame(resolve)); });
  expect(document.activeElement).toBe(view.getByText("Back"));
  view.rerender(<Harness focused={false} rowPresent />);
  await act(async () => { await new Promise(resolve => window.requestAnimationFrame(resolve)); });
  expect(document.activeElement).toBe(view.getByText("Synthetic row"));
});

test("exit focuses the reader's message row, also when the reader closes in the same commit", async () => {
  function Harness({ focused, readerId }: { focused: boolean; readerId: string }) {
    const list = useRef<HTMLDivElement>(null), savedScroll = useRef<number | null>(null);
    useReaderFocusPlacement(focused, readerId, list, savedScroll);
    return <><div ref={list} tabIndex={-1} data-testid="focus-list">
      <button data-message-id="first">First row</button><button data-message-id="second">Second row</button>
    </div>{focused && <div data-reader-toolbar=""><button>Back</button></div>}</>;
  }
  const frame = () => act(async () => { await new Promise(resolve => window.requestAnimationFrame(resolve)); });
  const view = render(<Harness focused={false} readerId="first" />);
  // Opening the second message and leaving at once targets that message, not an
  // earlier selection.
  view.rerender(<Harness focused readerId="second" />);
  await frame();
  expect(document.activeElement).toBe(view.getByText("Back"));
  view.rerender(<Harness focused={false} readerId="second" />);
  await frame();
  expect(document.activeElement).toBe(view.getByText("Second row"));
  view.rerender(<Harness focused readerId="first" />);
  await frame();
  view.rerender(<Harness focused={false} readerId="" />);
  await frame();
  expect(document.activeElement).toBe(view.getByText("First row"));
});

test("focus dropped by a disabled or removed control returns to Back while focused", async () => {
  function Harness({ busy, notice }: { busy: boolean; notice: boolean }) {
    const list = useRef<HTMLDivElement>(null), savedScroll = useRef<number | null>(null);
    useReaderFocusPlacement(true, "synthetic", list, savedScroll);
    return <><div ref={list} tabIndex={-1} /><div data-reader-toolbar=""><button>Back</button>
      <button disabled={busy}>Delete</button></div>{notice && <button>Undo</button>}</>;
  }
  const frame = () => act(async () => { await new Promise(resolve => window.requestAnimationFrame(resolve)); });
  const view = render(<Harness busy={false} notice />);
  await frame();
  // happy-dom has no focus fixup, so dispatch the blur Chromium performs when the
  // focused control is disabled (busy Delete) or removed (Undo notice dismissed).
  // It ignores blur() on a disabled button; the guard reads the state a frame later.
  const remove = view.getByText("Delete");
  remove.focus();
  remove.blur();
  view.rerender(<Harness busy notice />);
  await frame();
  expect(document.activeElement).toBe(view.getByText("Back"));
  const undo = view.getByText("Undo");
  undo.focus();
  fireEvent.focusOut(undo);
  view.rerender(<Harness busy={false} notice={false} />);
  await frame();
  expect(document.activeElement).toBe(view.getByText("Back"));
  // An ordinary blur of a control that is still usable is left alone.
  view.rerender(<Harness busy={false} notice={false} />);
  remove.focus();
  remove.blur();
  await frame();
  expect(document.activeElement).toBe(document.body);
});
