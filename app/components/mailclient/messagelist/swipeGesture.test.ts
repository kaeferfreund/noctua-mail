import { describe, expect, test } from "bun:test";
import {
  SWIPE_ACTION_WIDTH,
  SWIPE_AXIS_LOCK_PX,
  createSwipeOpenStore,
  endSwipe,
  moveSwipe,
  restOffset,
  startSwipe,
  type SwipeGeometry,
  type SwipeTracking
} from "./swipeGesture";

const geometry: SwipeGeometry = {
  width: 390,
  leadingWidth: SWIPE_ACTION_WIDTH,
  trailingWidth: SWIPE_ACTION_WIDTH * 2
};

const drag = (path: Array<[number, number]>, baseOffset = 0): SwipeTracking => {
  const [[x0, y0], ...rest] = path;
  let state = startSwipe(x0, y0, baseOffset);
  for (const [x, y] of rest) state = moveSwipe(state, x, y, geometry);
  return state;
};

describe("swipe axis lock", () => {
  test("stays pending below the lock distance", () => {
    const state = drag([[200, 100], [200 - (SWIPE_AXIS_LOCK_PX - 1), 103]]);
    expect(state.phase).toBe("pending");
    expect(endSwipe(state, geometry)).toBeNull();
  });

  test("locks vertical when the first movement is mostly vertical", () => {
    const state = drag([[200, 100], [204, 112], [100, 120]]);
    expect(state.phase).toBe("vertical");
    expect(endSwipe(state, geometry)).toBeNull();
  });

  test("locks horizontal and measures from the lock point", () => {
    const state = drag([[200, 100], [190, 102], [140, 130]]);
    expect(state).toMatchObject({ phase: "horizontal", offset: -50 });
  });

  test("clamps the offset to the row width", () => {
    const state = drag([[380, 100], [370, 100], [-500, 100]]);
    expect(state).toMatchObject({ phase: "horizontal", offset: -geometry.width });
  });
});

describe("swipe release", () => {
  test("a short left swipe opens the trailing actions", () => {
    expect(endSwipe(drag([[300, 100], [290, 100], [190, 100]]), geometry)).toEqual({
      rest: "trailing",
      commit: null
    });
  });

  test("a left swipe past 60 % of the width deletes directly", () => {
    expect(endSwipe(drag([[380, 100], [370, 100], [120, 100]]), geometry)).toEqual({
      rest: "closed",
      commit: "trailing"
    });
  });

  test("a short right swipe opens the read toggle, a long one runs it", () => {
    expect(endSwipe(drag([[20, 100], [30, 100], [90, 100]]), geometry)).toEqual({
      rest: "leading",
      commit: null
    });
    expect(endSwipe(drag([[20, 100], [30, 100], [290, 100]]), geometry)).toEqual({
      rest: "closed",
      commit: "leading"
    });
  });

  test("a small movement springs back closed", () => {
    expect(endSwipe(drag([[200, 100], [190, 100], [170, 100]]), geometry)).toEqual({
      rest: "closed",
      commit: null
    });
  });

  test("dragging an open row back closes it", () => {
    const base = restOffset("trailing", geometry);
    expect(base).toBe(-SWIPE_ACTION_WIDTH * 2);
    expect(endSwipe(drag([[100, 100], [110, 100], [240, 100]], base), geometry)).toEqual({
      rest: "closed",
      commit: null
    });
  });
});

describe("swipe open store", () => {
  test("holds one open row and notifies only on change", () => {
    const store = createSwipeOpenStore();
    let calls = 0;
    const unsubscribe = store.subscribe(() => {
      calls += 1;
    });
    store.set("a");
    store.set("a");
    store.set("b");
    expect(store.get()).toBe("b");
    expect(calls).toBe(2);
    unsubscribe();
    store.set(null);
    expect(calls).toBe(2);
  });
});
