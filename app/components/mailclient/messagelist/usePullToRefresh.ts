import { useEffect, useRef, useState } from "react";
import type React from "react";
import {
  PULL_REFRESHING_PX,
  PULL_TRIGGER_PX,
  endPull,
  movePull,
  startPull,
  type PullTracking
} from "./pullToRefresh";

export type PullState = "idle" | "pulling" | "armed" | "refreshing";

/**
 * Pull-to-refresh on a scroll container (see pullToRefresh.ts). Touch events
 * rather than pointer events: the rows' `touch-action: pan-y` lets the browser
 * take vertical moves, which cancels pointer events but not touch events.
 * One release runs `onRefresh` once; pulls while it runs are ignored.
 */
export function usePullToRefresh(
  scrollRef: React.RefObject<HTMLElement | null>,
  onRefresh: (() => Promise<unknown>) | undefined
) {
  const [offset, setOffset] = useState(0);
  const [state, setState] = useState<PullState>("idle");
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => { onRefreshRef.current = onRefresh; }, [onRefresh]);
  const enabled = Boolean(onRefresh);

  useEffect(() => {
    const element = scrollRef.current;
    if (!enabled || !element) return;
    let tracking: PullTracking | null = null;
    let refreshing = false;
    let suppressClick = false;
    let disposed = false;

    const reset = () => {
      setOffset(0);
      setState("idle");
    };

    const refresh = () => {
      refreshing = true;
      setOffset(PULL_REFRESHING_PX);
      setState("refreshing");
      void Promise.resolve()
        .then(() => onRefreshRef.current?.())
        .catch(() => { /* the sync reports its own errors */ })
        .finally(() => {
          refreshing = false;
          if (!disposed) reset();
        });
    };

    const handleTouchStart = (event: TouchEvent) => {
      suppressClick = false;
      tracking = refreshing || event.touches.length !== 1
        ? null
        : startPull(event.touches[0].clientX, event.touches[0].clientY, element.scrollTop);
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (!tracking || tracking.phase === "ignored") return;
      if (event.touches.length !== 1) {
        tracking = null;
        reset();
        return;
      }
      tracking = movePull(tracking, event.touches[0].clientX, event.touches[0].clientY);
      if (tracking.phase !== "pulling") return;
      // Keep the browser from scrolling or bouncing the list under the pull.
      if (event.cancelable) event.preventDefault();
      setOffset(tracking.offset);
      setState(tracking.offset >= PULL_TRIGGER_PX ? "armed" : "pulling");
    };

    const handleTouchEnd = (event: TouchEvent) => {
      const finished = tracking;
      tracking = null;
      if (finished?.phase !== "pulling") return;
      // The touch was a pull, not a tap: keep it from opening a message.
      suppressClick = true;
      if (event.type === "touchend" && endPull(finished)) refresh();
      else reset();
    };

    const handleClickCapture = (event: MouseEvent) => {
      if (!suppressClick) return;
      suppressClick = false;
      event.preventDefault();
      event.stopPropagation();
    };

    element.addEventListener("touchstart", handleTouchStart, { passive: true });
    element.addEventListener("touchmove", handleTouchMove, { passive: false });
    element.addEventListener("touchend", handleTouchEnd);
    element.addEventListener("touchcancel", handleTouchEnd);
    element.addEventListener("click", handleClickCapture, true);
    return () => {
      disposed = true;
      element.removeEventListener("touchstart", handleTouchStart);
      element.removeEventListener("touchmove", handleTouchMove);
      element.removeEventListener("touchend", handleTouchEnd);
      element.removeEventListener("touchcancel", handleTouchEnd);
      element.removeEventListener("click", handleClickCapture, true);
      reset();
    };
  }, [enabled, scrollRef]);

  return { offset, state };
}
