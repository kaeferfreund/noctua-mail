import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type React from "react";
import { Mail, MailOpen, MoreHorizontal, Trash2 } from "lucide-react";
import { MessageMenuControlContext } from "../message/messageMenuControl";
import {
  SWIPE_ACTION_WIDTH,
  endSwipe,
  fullSwipeSide,
  moveSwipe,
  restOffset,
  startSwipe,
  type SwipeCommit,
  type SwipeGeometry,
  type SwipeOpenStore,
  type SwipeRest,
  type SwipeTracking
} from "./swipeGesture";
import styles from "./SwipeableRow.module.css";

/** Matches the transform transition in SwipeableRow.module.css. */
const SWIPE_SETTLE_MS = 200;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

// Pointerdowns that closed an open row; they must not start a new swipe.
const closingPointerDowns = new WeakSet<Event>();

const settleDelay = () =>
  window.matchMedia?.(REDUCED_MOTION_QUERY).matches ? 0 : SWIPE_SETTLE_MS;

export type RowSwipeActions = {
  seen: boolean;
  disabled: boolean;
  onDelete: () => void;
  onToggleRead: () => void;
};

type SwipeableRowProps = RowSwipeActions & {
  rowKey: string;
  store: SwipeOpenStore;
  children: React.ReactNode;
};

export default function SwipeableRow({
  rowKey,
  store,
  seen,
  disabled,
  onDelete,
  onToggleRead,
  children
}: SwipeableRowProps) {
  const t = useTranslations("List");
  const isOpenRow = useSyncExternalStore(
    store.subscribe,
    () => store.get() === rowKey,
    () => false
  );
  const [rest, setRest] = useState<SwipeRest>("closed");
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const [exitOffset, setExitOffset] = useState<number | null>(null);
  const [fullSide, setFullSide] = useState<SwipeCommit | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const trackingRef = useRef<SwipeTracking | null>(null);
  const geometryRef = useRef<SwipeGeometry | null>(null);
  const suppressClickRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  const effectiveRest: SwipeRest = isOpenRow ? rest : "closed";
  const offset =
    dragOffset ??
    exitOffset ??
    restOffset(effectiveRest, {
      width: 0,
      leadingWidth: SWIPE_ACTION_WIDTH,
      trailingWidth: SWIPE_ACTION_WIDTH * 2
    });
  const revealed = offset !== 0;

  const schedule = (callback: () => void) => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      callback();
    }, settleDelay());
  };

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
  }, []);

  const close = () => {
    setRest("closed");
    if (store.get() === rowKey) store.set(null);
  };

  const open = (side: Exclude<SwipeRest, "closed">) => {
    setRest(side);
    store.set(rowKey);
  };

  const runDelete = () => {
    const width = rootRef.current?.offsetWidth ?? 0;
    setExitOffset(-width);
    close();
    schedule(() => {
      setExitOffset(null);
      onDelete();
    });
  };

  const runToggleRead = () => {
    close();
    onToggleRead();
  };

  const runCommit = (commit: SwipeCommit) => {
    if (commit === "trailing") runDelete();
    else runToggleRead();
  };

  // While open, a touch outside the row closes it. A touch on another list
  // row is consumed, as on iOS: it does not open that message. Touches on the
  // open row itself go through the gesture (drag back, or tap to close).
  useEffect(() => {
    if (!isOpenRow || effectiveRest === "closed") return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target && rootRef.current?.contains(target)) return;
      closingPointerDowns.add(event);
      setRest("closed");
      if (store.get() === rowKey) store.set(null);
      if (!target?.closest("[data-swipe-row]")) return;
      const swallowClick = (click: MouseEvent) => {
        click.preventDefault();
        click.stopPropagation();
      };
      const release = () => {
        document.removeEventListener("click", swallowClick, true);
        document.removeEventListener("pointerdown", release, true);
      };
      document.addEventListener("click", swallowClick, { capture: true, once: true });
      // A touch that turns into a scroll produces no click; drop the guard on
      // the next touch so it never eats an unrelated tap.
      document.addEventListener("pointerdown", release, true);
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [effectiveRest, isOpenRow, rowKey, store]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    suppressClickRef.current = false;
    if (disabled || event.pointerType === "mouse" || !event.isPrimary) return;
    if (closingPointerDowns.has(event.nativeEvent)) return;
    const width = rootRef.current?.offsetWidth ?? 0;
    if (width <= 0) return;
    geometryRef.current = {
      width,
      leadingWidth: SWIPE_ACTION_WIDTH,
      trailingWidth: SWIPE_ACTION_WIDTH * 2
    };
    trackingRef.current = startSwipe(event.clientX, event.clientY, offset);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const tracking = trackingRef.current;
    const geometry = geometryRef.current;
    if (!tracking || !geometry || tracking.phase === "vertical") return;
    const next = moveSwipe(tracking, event.clientX, event.clientY, geometry);
    trackingRef.current = next;
    if (next.phase !== "horizontal") return;
    if (tracking.phase === "pending") {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    const nextFull = fullSwipeSide(next.offset, geometry);
    if (nextFull !== fullSide) {
      // Crossing the full-swipe threshold snaps the edge action; buzz where
      // supported (browsers refuse vibration before the first user activation).
      if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.(10);
      setFullSide(nextFull);
    }
    setDragOffset(next.offset);
  };

  const finishGesture = (event: React.PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const tracking = trackingRef.current;
    const geometry = geometryRef.current;
    trackingRef.current = null;
    if (!tracking || !geometry) return;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragOffset(null);
    setFullSide(null);
    const result = cancelled ? null : endSwipe(tracking, geometry);
    if (!result) {
      // A tap on an open row closes it instead of opening the message.
      if (!cancelled && tracking.phase === "pending" && tracking.baseOffset !== 0) {
        suppressClickRef.current = true;
        close();
      }
      return;
    }
    // The touch was a swipe, not a tap: keep it from opening the message.
    suppressClickRef.current = true;
    if (result.commit) runCommit(result.commit);
    else if (result.rest === "closed") close();
    else open(result.rest);
  };

  const handleClickCapture = (event: React.MouseEvent) => {
    if (!suppressClickRef.current) return;
    suppressClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  const handleMore = () => {
    close();
    // Open the menu once the row is back in place so it anchors to the
    // row's ⋮ button at its final position.
    schedule(() => setMenuOpen(true));
  };

  return (
    <div
      ref={rootRef}
      className={styles.root}
      data-swipe-row=""
      data-swipe-state={dragOffset !== null ? "dragging" : effectiveRest}
      style={{ "--swipe-offset": `${offset}px` } as React.CSSProperties}
    >
      {revealed && offset > 0 && (
        <div className={styles.leading} data-swipe-actions="leading">
          <button
            type="button"
            className={`${styles.action} ${styles.actionRead}`}
            data-swipe-action="read"
            data-full={fullSide === "leading" || undefined}
            tabIndex={effectiveRest === "leading" ? 0 : -1}
            onClick={runToggleRead}
          >
            {seen ? <Mail size={18} /> : <MailOpen size={18} />}
            <span>{seen ? t("swipeUnread") : t("swipeRead")}</span>
          </button>
        </div>
      )}
      {revealed && offset < 0 && (
        <div className={styles.trailing} data-swipe-actions="trailing">
          <button
            type="button"
            className={`${styles.action} ${styles.actionMore}`}
            data-swipe-action="more"
            data-collapsed={fullSide === "trailing" || exitOffset !== null || undefined}
            tabIndex={effectiveRest === "trailing" ? 0 : -1}
            onClick={handleMore}
          >
            <MoreHorizontal size={18} />
            <span>{t("swipeMore")}</span>
          </button>
          <button
            type="button"
            className={`${styles.action} ${styles.actionDelete}`}
            data-swipe-action="delete"
            data-full={fullSide === "trailing" || exitOffset !== null || undefined}
            tabIndex={effectiveRest === "trailing" ? 0 : -1}
            onClick={runDelete}
          >
            <Trash2 size={18} />
            <span>{t("delete")}</span>
          </button>
        </div>
      )}
      <div
        className={styles.content}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(event) => finishGesture(event, false)}
        onPointerCancel={(event) => finishGesture(event, true)}
        onClickCapture={handleClickCapture}
      >
        <MessageMenuControlContext.Provider value={{ open: menuOpen, onOpenChange: setMenuOpen }}>
          {children}
        </MessageMenuControlContext.Provider>
      </div>
    </div>
  );
}
