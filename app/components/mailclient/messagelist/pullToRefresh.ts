/**
 * Pull-to-refresh on the phone message list. A touch that starts with the
 * list scrolled to the top and moves down locks to a pull; any other touch
 * (scrolling, a row swipe) is left alone. The functions here are pure so the
 * gesture rules can be tested without a browser.
 */
import { SWIPE_AXIS_LOCK_PX } from "./swipeGesture";

/** Indicator travel per px of finger travel (the pull feels resisted). */
export const PULL_RESISTANCE = 0.6;
/** Indicator offset past which releasing triggers the refresh. */
export const PULL_TRIGGER_PX = 56;
/** Furthest the indicator follows the finger. */
export const PULL_MAX_PX = 96;
/** Offset the indicator rests at while the refresh runs. */
export const PULL_REFRESHING_PX = 48;

export type PullTracking =
  | { phase: "pending"; startX: number; startY: number }
  | { phase: "pulling"; startY: number; offset: number }
  | { phase: "ignored" };

/** A pull may only start while the list sits at its top. */
export function startPull(x: number, y: number, scrollTop: number): PullTracking {
  return scrollTop <= 0 ? { phase: "pending", startX: x, startY: y } : { phase: "ignored" };
}

/**
 * Advances the gesture. Like a row swipe it commits to an axis after
 * `SWIPE_AXIS_LOCK_PX`; only a downward vertical move becomes a pull, so a
 * horizontal swipe on a row or an upward scroll never moves the indicator.
 */
export function movePull(state: PullTracking, x: number, y: number): PullTracking {
  if (state.phase === "ignored") return state;
  if (state.phase === "pulling") {
    return { ...state, offset: pullOffset(y - state.startY) };
  }
  const dx = x - state.startX;
  const dy = y - state.startY;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_AXIS_LOCK_PX) return state;
  if (dy <= 0 || Math.abs(dx) > Math.abs(dy)) return { phase: "ignored" };
  // Start from the lock point so the indicator does not jump by the lock distance.
  return { phase: "pulling", startY: y, offset: 0 };
}

/** Whether releasing the gesture triggers a refresh. */
export function endPull(state: PullTracking): boolean {
  return state.phase === "pulling" && state.offset >= PULL_TRIGGER_PX;
}

export function pullOffset(distance: number): number {
  return Math.max(0, Math.min(PULL_MAX_PX, distance * PULL_RESISTANCE));
}
