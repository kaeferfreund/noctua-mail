import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { useContext } from "react";
import { Theme } from "@radix-ui/themes";
import type { Message } from "@/lib/data";
import { I18nTestProvider } from "@/lib/i18n/testRender";
import { reviewListProps, syntheticReviewMessage } from "@/tests/helpers/i18nSlice2b";
import { MessageMenuControlContext } from "../message/messageMenuControl";
import MessageListView from "./MessageListView";
import SwipeableRow from "./SwipeableRow";
import { createSwipeOpenStore, type SwipeOpenStore } from "./swipeGesture";

const ROW_WIDTH = 390;
const originalMatchMedia = window.matchMedia;

// The settle animation is skipped under reduced motion, so timers run at 0 ms.
beforeEach(() => {
  window.matchMedia = ((query: string) => ({
    matches: query.includes("prefers-reduced-motion"),
    media: query,
    addEventListener() {},
    removeEventListener() {}
  })) as unknown as typeof window.matchMedia;
});
afterEach(() => {
  cleanup();
  window.matchMedia = originalMatchMedia;
});

function MenuProbe() {
  const control = useContext(MessageMenuControlContext);
  return <span data-testid="menu-state">{control?.open ? "open" : "closed"}</span>;
}

function renderRows(store: SwipeOpenStore, overrides: { seen?: boolean } = {}) {
  const handlers = {
    a: { onDelete: mock(() => {}), onToggleRead: mock(() => {}), onClick: mock(() => {}) },
    b: { onDelete: mock(() => {}), onToggleRead: mock(() => {}), onClick: mock(() => {}) }
  };
  const page = render(
    <I18nTestProvider locale="de">
      {(["a", "b"] as const).map((key) => (
        <SwipeableRow
          key={key}
          rowKey={key}
          store={store}
          seen={overrides.seen ?? false}
          disabled={false}
          onDelete={handlers[key].onDelete}
          onToggleRead={handlers[key].onToggleRead}
        >
          <div data-testid={`row-${key}`} onClick={handlers[key].onClick}>
            Synthetic row {key}
            {key === "a" && <MenuProbe />}
          </div>
        </SwipeableRow>
      ))}
    </I18nTestProvider>
  );
  for (const root of page.container.querySelectorAll<HTMLElement>("[data-swipe-row]")) {
    Object.defineProperty(root, "offsetWidth", { configurable: true, value: ROW_WIDTH });
  }
  const rowRoot = (key: "a" | "b") =>
    page.getByTestId(`row-${key}`).closest<HTMLElement>("[data-swipe-row]")!;
  const content = (key: "a" | "b") => page.getByTestId(`row-${key}`).parentElement!;
  return { page, handlers, rowRoot, content };
}

const touch = { pointerType: "touch", isPrimary: true, pointerId: 1, button: 0 };

function swipe(target: HTMLElement, path: Array<[number, number]>, pointerType = "touch") {
  const [[x0, y0], ...rest] = path;
  const init = { ...touch, pointerType };
  fireEvent.pointerDown(target, { ...init, clientX: x0, clientY: y0 });
  for (const [x, y] of rest) fireEvent.pointerMove(target, { ...init, clientX: x, clientY: y });
  const [xEnd, yEnd] = path[path.length - 1];
  fireEvent.pointerUp(target, { ...init, clientX: xEnd, clientY: yEnd });
}

const flushTimers = () => act(() => new Promise((resolve) => setTimeout(resolve, 5)));

describe("SwipeableRow gestures", () => {
  test("a vertical touch scroll never moves the row", () => {
    const { rowRoot, content, page } = renderRows(createSwipeOpenStore());
    swipe(content("a"), [[200, 100], [203, 112], [120, 200]]);
    expect(rowRoot("a").dataset.swipeState).toBe("closed");
    expect(page.container.querySelector("[data-swipe-actions]")).toBeNull();
  });

  test("a mouse drag does nothing (desktop selection keeps working)", () => {
    const { rowRoot, content } = renderRows(createSwipeOpenStore());
    swipe(content("a"), [[300, 100], [290, 100], [150, 100]], "mouse");
    expect(rowRoot("a").dataset.swipeState).toBe("closed");
  });

  test("a short left swipe reveals Mehr and Löschen without deleting", () => {
    const { rowRoot, content, page, handlers } = renderRows(createSwipeOpenStore());
    swipe(content("a"), [[300, 100], [290, 100], [190, 100]]);
    expect(rowRoot("a").dataset.swipeState).toBe("trailing");
    expect(page.getByRole("button", { name: "Mehr" })).toBeTruthy();
    expect(page.getByRole("button", { name: "Löschen" })).toBeTruthy();
    expect(handlers.a.onDelete).not.toHaveBeenCalled();
    // The click that ends a swipe must not open the message.
    fireEvent.click(page.getByTestId("row-a"));
    expect(handlers.a.onClick).not.toHaveBeenCalled();
  });

  test("a long left swipe deletes directly", async () => {
    const { content, handlers } = renderRows(createSwipeOpenStore());
    swipe(content("a"), [[380, 100], [370, 100], [100, 100]]);
    await flushTimers();
    expect(handlers.a.onDelete).toHaveBeenCalledTimes(1);
  });

  test("the revealed Löschen button deletes", async () => {
    const { content, page, handlers } = renderRows(createSwipeOpenStore());
    swipe(content("a"), [[300, 100], [290, 100], [190, 100]]);
    fireEvent.click(page.getByRole("button", { name: "Löschen" }));
    await flushTimers();
    expect(handlers.a.onDelete).toHaveBeenCalledTimes(1);
  });

  test("a short right swipe shows Gelesen for an unread row; a long one toggles", () => {
    const { rowRoot, content, page, handlers } = renderRows(createSwipeOpenStore());
    swipe(content("b"), [[20, 100], [30, 100], [300, 100]]);
    expect(handlers.b.onToggleRead).toHaveBeenCalledTimes(1);
    expect(rowRoot("b").dataset.swipeState).toBe("closed");

    swipe(content("a"), [[20, 100], [30, 100], [100, 100]]);
    expect(rowRoot("a").dataset.swipeState).toBe("leading");
    expect(page.getByRole("button", { name: "Gelesen" })).toBeTruthy();
    expect(handlers.a.onToggleRead).not.toHaveBeenCalled();
  });

  test("while a row is open, a touch on another row only closes it", () => {
    const { rowRoot, content, handlers } = renderRows(createSwipeOpenStore());
    swipe(content("a"), [[300, 100], [290, 100], [190, 100]]);
    swipe(content("b"), [[20, 100], [30, 100], [300, 100]]);
    expect(rowRoot("a").dataset.swipeState).toBe("closed");
    expect(rowRoot("b").dataset.swipeState).toBe("closed");
    expect(handlers.b.onToggleRead).not.toHaveBeenCalled();
  });

  test("a read row offers Ungelesen", () => {
    const { content, page } = renderRows(createSwipeOpenStore(), { seen: true });
    swipe(content("a"), [[20, 100], [30, 100], [100, 100]]);
    expect(page.getByRole("button", { name: "Ungelesen" })).toBeTruthy();
  });

  test("only one row is open at a time", () => {
    const store = createSwipeOpenStore();
    const { rowRoot, content } = renderRows(store);
    swipe(content("a"), [[300, 100], [290, 100], [190, 100]]);
    expect(rowRoot("a").dataset.swipeState).toBe("trailing");
    act(() => store.set("b"));
    expect(rowRoot("a").dataset.swipeState).toBe("closed");
  });

  test("touching another row closes the open one without opening a message", () => {
    const store = createSwipeOpenStore();
    const { rowRoot, content, page, handlers } = renderRows(store);
    swipe(content("a"), [[300, 100], [290, 100], [190, 100]]);
    fireEvent.pointerDown(page.getByTestId("row-b"), { ...touch, clientX: 200, clientY: 300 });
    fireEvent.pointerUp(page.getByTestId("row-b"), { ...touch, clientX: 200, clientY: 300 });
    fireEvent.click(page.getByTestId("row-b"));
    expect(rowRoot("a").dataset.swipeState).toBe("closed");
    expect(rowRoot("b").dataset.swipeState).toBe("closed");
    expect(store.get()).toBeNull();
    expect(handlers.b.onClick).not.toHaveBeenCalled();
    // The next tap opens the message again.
    fireEvent.pointerDown(page.getByTestId("row-b"), { ...touch, clientX: 200, clientY: 300 });
    fireEvent.click(page.getByTestId("row-b"));
    expect(handlers.b.onClick).toHaveBeenCalledTimes(1);
  });

  test("an open row can be dragged closed, and a tap on it closes it without opening", () => {
    const { rowRoot, content, page, handlers } = renderRows(createSwipeOpenStore());
    swipe(content("a"), [[300, 100], [290, 100], [190, 100]]);
    expect(rowRoot("a").dataset.swipeState).toBe("trailing");
    swipe(content("a"), [[150, 100], [160, 100], [300, 100]]);
    expect(rowRoot("a").dataset.swipeState).toBe("closed");

    swipe(content("a"), [[300, 100], [290, 100], [190, 100]]);
    swipe(content("a"), [[150, 100]]);
    fireEvent.click(page.getByTestId("row-a"));
    expect(rowRoot("a").dataset.swipeState).toBe("closed");
    expect(handlers.a.onClick).not.toHaveBeenCalled();
  });

  test("Mehr closes the row and opens the row's message menu", async () => {
    const { rowRoot, content, page } = renderRows(createSwipeOpenStore());
    swipe(content("a"), [[300, 100], [290, 100], [190, 100]]);
    expect(page.getByTestId("menu-state").textContent).toBe("closed");
    fireEvent.click(page.getByRole("button", { name: "Mehr" }));
    expect(rowRoot("a").dataset.swipeState).toBe("closed");
    await flushTimers();
    expect(page.getByTestId("menu-state").textContent).toBe("open");
  });
});

describe("swipe actions in the message list", () => {
  const renderList = (view: "threads" | "compact" | "table" | "card", phone: boolean) => {
    window.matchMedia = ((query: string) => ({
      matches: query.includes("prefers-reduced-motion") || (phone && query.includes("max-width")),
      media: query,
      addEventListener() {},
      removeEventListener() {}
    })) as unknown as typeof window.matchMedia;
    const props = reviewListProps();
    const handleDeleteMessage = mock((_message: Message) => {});
    const toggleRowRead = mock((_message: Message, _seen: boolean) => {});
    const page = render(
      <I18nTestProvider locale="de">
        <Theme>
          <MessageListView
            {...props}
            view={view}
            actions={{ ...props.actions, handleDeleteMessage, toggleRowRead }}
          />
        </Theme>
      </I18nTestProvider>
    );
    for (const root of page.container.querySelectorAll<HTMLElement>("[data-swipe-row]")) {
      Object.defineProperty(root, "offsetWidth", { configurable: true, value: ROW_WIDTH });
    }
    const row = () => page.container.querySelector<HTMLElement>("[data-message-list-row]")!;
    return { page, row, handleDeleteMessage, toggleRowRead };
  };

  for (const view of ["threads", "compact", "table", "card"] as const) {
    test(`${view}: full swipes run the list's delete and read actions on phones`, async () => {
      const { row, handleDeleteMessage, toggleRowRead } = renderList(view, true);
      swipe(row(), [[20, 100], [30, 100], [300, 100]]);
      expect(toggleRowRead).toHaveBeenCalledTimes(1);
      expect(toggleRowRead.mock.calls[0][0].id).toBe(syntheticReviewMessage.id);
      expect(toggleRowRead.mock.calls[0][1]).toBe(false);
      swipe(row(), [[380, 100], [370, 100], [100, 100]]);
      await flushTimers();
      expect(handleDeleteMessage).toHaveBeenCalledTimes(1);
      expect(handleDeleteMessage.mock.calls[0][0].id).toBe(syntheticReviewMessage.id);
    });
  }

  test("desktop rows have no swipe wrapper", () => {
    const { page } = renderList("threads", false);
    expect(page.container.querySelector("[data-message-list-row]")).toBeTruthy();
    expect(page.container.querySelector("[data-swipe-row]")).toBeNull();
  });
});
