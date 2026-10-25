import { describe, expect, test } from "bun:test";
import { SWIPE_AXIS_LOCK_PX } from "./swipeGesture";
import {
  PULL_MAX_PX,
  PULL_RESISTANCE,
  PULL_TRIGGER_PX,
  endPull,
  movePull,
  startPull,
  type PullTracking
} from "./pullToRefresh";

const drag = (path: Array<[number, number]>, scrollTop = 0): PullTracking => {
  const [[x0, y0], ...rest] = path;
  let state = startPull(x0, y0, scrollTop);
  for (const [x, y] of rest) state = movePull(state, x, y);
  return state;
};
const pastTrigger = SWIPE_AXIS_LOCK_PX + Math.ceil(PULL_TRIGGER_PX / PULL_RESISTANCE);

describe("pull-to-refresh gesture", () => {
  test("only starts at the top of the list", () => {
    expect(startPull(100, 100, 0).phase).toBe("pending");
    expect(startPull(100, 100, 1).phase).toBe("ignored");
    expect(drag([[100, 100], [100, 100 + pastTrigger]], 40).phase).toBe("ignored");
  });

  test("stays pending below the lock distance", () => {
    expect(drag([[100, 100], [100, 100 + SWIPE_AXIS_LOCK_PX - 1]]).phase).toBe("pending");
  });

  test("a horizontal swipe or an upward scroll never becomes a pull", () => {
    expect(drag([[100, 100], [130, 110], [130, 300]]).phase).toBe("ignored");
    expect(drag([[100, 300], [100, 280], [100, 500]]).phase).toBe("ignored");
  });

  test("follows the finger with resistance from the lock point, capped", () => {
    const state = drag([[100, 100], [100, 100 + SWIPE_AXIS_LOCK_PX], [100, 100 + SWIPE_AXIS_LOCK_PX + 50]]);
    expect(state).toEqual({ phase: "pulling", startY: 100 + SWIPE_AXIS_LOCK_PX, offset: 50 * PULL_RESISTANCE });
    const far = drag([[100, 100], [100, 100 + SWIPE_AXIS_LOCK_PX], [100, 2000]]);
    expect(far.phase === "pulling" && far.offset).toBe(PULL_MAX_PX);
  });

  test("releasing past the trigger refreshes; a short pull or pulling back does not", () => {
    const lock = 100 + SWIPE_AXIS_LOCK_PX;
    expect(endPull(drag([[100, 100], [100, lock], [100, 100 + pastTrigger]]))).toBe(true);
    expect(endPull(drag([[100, 100], [100, lock], [100, lock + 40]]))).toBe(false);
    expect(endPull(drag([[100, 100], [100, lock], [100, 100 + pastTrigger], [100, lock + 10]]))).toBe(false);
    expect(endPull(drag([[100, 100], [100, 101]]))).toBe(false);
  });
});
