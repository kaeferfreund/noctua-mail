import { afterEach, expect, mock, test } from "bun:test";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { createRef } from "react";
import { I18nTestProvider } from "@/lib/i18n/testRender";
import MessageListPane from "./MessageListPane";
import { SWIPE_AXIS_LOCK_PX } from "./swipeGesture";

afterEach(cleanup);

function touch(target: Element, type: string, y: number, x = 100) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  const touches = type === "touchend" || type === "touchcancel" ? [] : [{ clientX: x, clientY: y }];
  Object.defineProperty(event, "touches", { value: touches });
  act(() => { target.dispatchEvent(event); });
  return event;
}

function renderPane(onPullRefresh?: () => Promise<unknown>) {
  const listPaneRef = createRef<HTMLDivElement>();
  const onRowClick = mock(() => {});
  const page = render(
    <I18nTestProvider locale="de">
      <MessageListPane refs={{ listPaneRef }} onPullRefresh={onPullRefresh}>
        <button type="button" onClick={onRowClick}>Synthetic row</button>
      </MessageListPane>
    </I18nTestProvider>
  );
  return { page, pane: listPaneRef.current!, row: page.getByText("Synthetic row"), onRowClick };
}

function pull(row: Element, distance: number) {
  touch(row, "touchstart", 100);
  touch(row, "touchmove", 100 + SWIPE_AXIS_LOCK_PX);
  const move = touch(row, "touchmove", 100 + SWIPE_AXIS_LOCK_PX + distance);
  touch(row, "touchend", 100 + SWIPE_AXIS_LOCK_PX + distance);
  return move;
}

test("one pull from the top runs one sync and shows the indicator while it runs", async () => {
  let finish = () => {};
  const onPullRefresh = mock(() => new Promise<void>((resolve) => { finish = resolve; }));
  const { page, pane, row, onRowClick } = renderPane(onPullRefresh);
  expect(pane.dataset.pullState).toBe("idle");

  touch(row, "touchstart", 100);
  touch(row, "touchmove", 100 + SWIPE_AXIS_LOCK_PX);
  const move = touch(row, "touchmove", 300);
  expect(move.defaultPrevented).toBe(true);
  expect(pane.dataset.pullState).toBe("armed");
  expect(page.getByRole("status").textContent).toBe("Zum Aktualisieren loslassen");
  touch(row, "touchend", 300);
  await act(async () => {});
  expect(onPullRefresh).toHaveBeenCalledTimes(1);
  expect(pane.dataset.pullState).toBe("refreshing");
  expect(pane.getAttribute("aria-busy")).toBe("true");
  expect(page.getByRole("status").textContent).toBe("Postfach wird abgerufen …");
  // The release of a pull is not a tap on the row under the finger.
  fireEvent.click(row);
  expect(onRowClick).not.toHaveBeenCalled();

  // A second pull while the sync runs does not start another one.
  pull(row, 300);
  await act(async () => {});
  expect(onPullRefresh).toHaveBeenCalledTimes(1);

  await act(async () => { finish(); });
  expect(pane.dataset.pullState).toBe("idle");
  fireEvent.click(row);
  expect(onRowClick).toHaveBeenCalledTimes(1);
});

test("a short pull, a scrolled list or a horizontal swipe do not sync", async () => {
  const onPullRefresh = mock(() => Promise.resolve());
  const { pane, row } = renderPane(onPullRefresh);
  pull(row, 20);
  expect(pane.dataset.pullState).toBe("idle");

  Object.defineProperty(pane, "scrollTop", { configurable: true, value: 120 });
  const scrolled = pull(row, 300);
  expect(scrolled.defaultPrevented).toBe(false);
  Object.defineProperty(pane, "scrollTop", { configurable: true, value: 0 });

  touch(row, "touchstart", 100, 100);
  touch(row, "touchmove", 105, 140);
  const swipe = touch(row, "touchmove", 300, 140);
  expect(swipe.defaultPrevented).toBe(false);
  touch(row, "touchend", 300, 140);
  await act(async () => {});
  expect(onPullRefresh).not.toHaveBeenCalled();
});

test("without a refresh handler (desktop) the pane has no pull indicator", () => {
  const { page, pane, row } = renderPane();
  expect(pane.dataset.pullState).toBeUndefined();
  expect(page.container.querySelector("[data-pull-indicator]")).toBeNull();
  expect(touch(row, "touchmove", 300).defaultPrevented).toBe(false);
});
