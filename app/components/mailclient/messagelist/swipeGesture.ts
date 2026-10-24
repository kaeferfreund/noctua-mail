/**
 * Touch swipe actions on message rows (phone layout), modelled on iOS Mail.
 *
 * Offsets are the content's horizontal translation in px: positive moves the
 * row right and reveals the leading action (read toggle), negative moves it
 * left and reveals the trailing actions (more, delete). The functions here are
 * pure so the gesture rules can be tested without a browser.
 */

/** Movement before the gesture commits to an axis. */
export const SWIPE_AXIS_LOCK_PX = 8;
/** Share of the row width past which releasing runs the edge action directly. */
export const SWIPE_FULL_RATIO = 0.6;
/** Width of one revealed action button. */
export const SWIPE_ACTION_WIDTH = 74;

export type SwipeRest = "closed" | "leading" | "trailing";
export type SwipeCommit = "leading" | "trailing";

export type SwipeGeometry = {
  width: number;
  leadingWidth: number;
  trailingWidth: number;
};

export type SwipeTracking =
  | { phase: "pending"; startX: number; startY: number; baseOffset: number }
  | { phase: "horizontal"; startX: number; baseOffset: number; offset: number }
  | { phase: "vertical" };

export function restOffset(rest: SwipeRest, geometry: SwipeGeometry): number {
  if (rest === "leading") return geometry.leadingWidth;
  if (rest === "trailing") return -geometry.trailingWidth;
  return 0;
}

export function startSwipe(x: number, y: number, baseOffset: number): SwipeTracking {
  return { phase: "pending", startX: x, startY: y, baseOffset };
}

const clampOffset = (offset: number, geometry: SwipeGeometry) =>
  Math.max(-geometry.width, Math.min(geometry.width, offset));

/**
 * Advances the gesture. A pending gesture stays pending until it has moved
 * `SWIPE_AXIS_LOCK_PX`; it then locks to the dominant axis for the rest of
 * the touch, so a vertical scroll never turns into a swipe.
 */
export function moveSwipe(
  state: SwipeTracking,
  x: number,
  y: number,
  geometry: SwipeGeometry
): SwipeTracking {
  if (state.phase === "vertical") return state;
  if (state.phase === "horizontal") {
    return { ...state, offset: clampOffset(state.baseOffset + x - state.startX, geometry) };
  }
  const dx = x - state.startX;
  const dy = y - state.startY;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_AXIS_LOCK_PX) return state;
  if (Math.abs(dy) >= Math.abs(dx)) return { phase: "vertical" };
  // Start from the lock point so the row does not jump by the lock distance.
  return { phase: "horizontal", startX: x, baseOffset: state.baseOffset, offset: state.baseOffset };
}

/** Whether releasing at `offset` runs the edge action directly. */
export function fullSwipeSide(offset: number, geometry: SwipeGeometry): SwipeCommit | null {
  const threshold = geometry.width * SWIPE_FULL_RATIO;
  if (offset >= threshold) return "leading";
  if (offset <= -threshold) return "trailing";
  return null;
}

/**
 * Resolves a released gesture. `null` means the touch never became a swipe
 * (a tap or a vertical scroll) and the row keeps its state.
 */
export function endSwipe(
  state: SwipeTracking,
  geometry: SwipeGeometry
): { rest: SwipeRest; commit: SwipeCommit | null } | null {
  if (state.phase !== "horizontal") return null;
  const { offset } = state;
  const commit = fullSwipeSide(offset, geometry);
  if (commit) return { rest: "closed", commit };
  if (offset > geometry.leadingWidth / 2) return { rest: "leading", commit: null };
  if (offset < -geometry.trailingWidth / 2) return { rest: "trailing", commit: null };
  return { rest: "closed", commit: null };
}

/** Holds the key of the one open row of a list. */
export type SwipeOpenStore = {
  get: () => string | null;
  set: (key: string | null) => void;
  subscribe: (listener: () => void) => () => void;
};

export function createSwipeOpenStore(): SwipeOpenStore {
  let openKey: string | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => openKey,
    set: (key) => {
      if (openKey === key) return;
      openKey = key;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}
