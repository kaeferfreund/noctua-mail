"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { MessageResolution } from "@/lib/navigation/resolveMessage";
import type { Message } from "@/lib/data";
import { authorizeDeepLink, deepLinkHistoryMode, emptyDeepLink, parseDeepLink, serializeDeepLink, type DeepLinkState } from "@/lib/navigation/deepLinks";
import { afterMobileOverlayNavigation, isMobileOverlayPop } from "@/app/hooks/useMobileOverlayHistory";

type Options = {
  ready: boolean;
  state: DeepLinkState;
  accountIds: string[];
  switchAccount: (id: string) => Promise<void>;
  applyPlace: (state: DeepLinkState) => DeepLinkState;
  resolveMessage: (accountId: string, messageId: string, signal: AbortSignal) => Promise<MessageResolution>;
  onUnauthenticated?: () => void;
  onForbidden?: () => void;
  openMessage: (message: Message) => void;
  notice: (kind: "forbidden" | "missing" | "moved" | "failed") => void;
};
type Pending = { target: DeepLinkState; phase: "requested" | "switching" | "account" | "place" | "message" | "settle"; initial: boolean; expected?: DeepLinkState; forbidden?: boolean; historyMode: "push" | "replace"; keepMessage?: boolean; controller: AbortController };

/** URL → UI is an explicit transaction. UI → URL never initiates account loads. */
export function useDeepLinks(options: Options) {
  const latest = useRef(options);
  useLayoutEffect(() => { latest.current = options; });
  const pending = useRef<Pending | null>(null);
  const previous = useRef<DeepLinkState | null>(null);
  const keyboard = useRef(false);
  const initialized = useRef(false);
  const [, refresh] = useState(0);
  const update = useCallback(() => refresh(value => value + 1), []);
  const request = useCallback((target: DeepLinkState, initial = false, historyMode: "push" | "replace" = "replace") => {
    pending.current?.controller.abort();
    pending.current = { target, initial, historyMode, phase: "requested", controller: new AbortController() };
    update();
  }, [update]);
  const write = useCallback((state: DeepLinkState, mode: "push" | "replace") => {
    const href = serializeDeepLink(state, window.location.href);
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const historyState = { ...window.history.state, noctuaUrl: true, noctuaMessageEntry: Boolean(state.messageId) };
    if (href !== current || !window.history.state?.noctuaUrl) {
      window.history[mode === "push" ? "pushState" : "replaceState"](historyState, "", href);
    }
  }, []);
  useEffect(() => {
    initialized.current = true;
    // Hydrate external browser state after mount; subsequent updates come from popstate.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    request(parseDeepLink(window.location.search), true);
    const onPop = (event: PopStateEvent) => {
      if (!isMobileOverlayPop(event)) request(parseDeepLink(window.location.search));
    };
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest("input, textarea, [contenteditable=true]") && ["j", "k", "ArrowDown", "ArrowUp"].includes(event.key)) keyboard.current = true;
    };
    const onPointer = () => { keyboard.current = false; };
    window.addEventListener("popstate", onPop);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", onPointer, true);
    return () => {
      initialized.current = false;
      pending.current?.controller.abort();
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pointerdown", onPointer, true);
    };
  }, [request]);
  useEffect(() => {
    if (!options.ready || !initialized.current) return;
    const work = pending.current;
    if (!work) return;
    if (work.phase !== "requested" && work.target.accountId && !options.accountIds.includes(work.target.accountId)) {
      // An authorization refresh can revoke a destination while its detail is loading.
      options.notice("forbidden");
      request({ ...emptyDeepLink(), accountId: options.state.accountId });
      return;
    }
    const current = () => pending.current === work && !work.controller.signal.aborted;
    if (work.phase === "requested") {
      const authorized = authorizeDeepLink(work.target, options.accountIds, options.state.accountId);
      work.target = authorized.state;
      if (authorized.forbidden) options.notice("forbidden");
      // New-message links may arrive before the user selects a mailbox at the gate.
      if (!work.target.accountId && !work.target.admin && !work.target.security) return;
      work.phase = "switching";
      // Even reselecting the currently visible mailbox cancels an older in-flight switch.
      void options.switchAccount(work.target.accountId).then(() => {
        if (!current()) return;
        work.phase = "account";
        update();
      });
    } else if (work.phase === "account") {
      if (options.state.accountId !== work.target.accountId) {
        // Controller failed/rebootstrap selected a fallback. Never keep retrying a denied link.
        work.target = { ...emptyDeepLink(), accountId: options.state.accountId };
      }
      work.phase = "place";
      work.expected = options.applyPlace(work.target);
      update();
    } else if (work.phase === "place") {
      // External-store selection notifications may flush React between the
      // adapter's setters. Advance only after the complete place is committed.
      if (!work.expected || serializeDeepLink(options.state) !== serializeDeepLink(work.expected)) return;
      work.phase = "message";
      if (!work.target.messageId) { work.phase = "settle"; update(); return; }
      void options.resolveMessage(work.target.accountId, work.target.messageId, work.controller.signal).then(result => {
        if (!current()) return;
        if (result.status === "unauthenticated") {
          work.phase = "requested";
          latest.current.onUnauthenticated?.();
          return;
        }
        if (result.status === "ready") {
          const message = result.message;
          if (work.target.folderId && work.target.scope === "folder" && work.target.folderId !== message.folderId) latest.current.notice("moved");
          work.expected = { ...work.expected!, messageId: message.id,
            folderId: work.target.scope === "folder" ? message.folderId : work.expected!.folderId };
          latest.current.openMessage(message);
        } else {
          latest.current.notice(result.status);
          if (result.status === "forbidden") { work.forbidden = true; latest.current.onForbidden?.(); }
          if (result.status === "failed") work.keepMessage = true;
        }
        work.phase = "settle";
        update();
      }).catch(() => {
        if (!current()) return;
        latest.current.notice("failed"); work.keepMessage = true; work.phase = "settle"; update();
      });
    } else if (work.phase === "settle") {
      if (!work.forbidden && work.expected && serializeDeepLink(options.state) !== serializeDeepLink(work.expected)) return;
      pending.current = null;
      previous.current = options.state;
      // A directly opened reader gets a list entry too, including after login/reload.
      if (work.initial && options.state.messageId && !window.history.state?.noctuaMessageEntry) {
        write({ ...options.state, messageId: "" }, "replace");
        write(options.state, "push");
      } else write(work.keepMessage ? { ...options.state, messageId: work.target.messageId } : options.state, work.historyMode);
    }
  });
  useEffect(() => {
    if (!options.ready || !initialized.current || pending.current) return;
    const next = options.state;
    const last = previous.current;
    if (last && serializeDeepLink(last) === serializeDeepLink(next)) return;
    return afterMobileOverlayNavigation(() => {
      write(next, last ? deepLinkHistoryMode(last, next, keyboard.current) : "replace");
      keyboard.current = false;
      previous.current = next;
    });
  });
  const navigateAccount = useCallback((accountId: string) => {
    const current = latest.current.state;
    const target = accountId === current.accountId ? { ...current, messageId: "" } : { ...emptyDeepLink(), accountId };
    afterMobileOverlayNavigation(() => { write(target, "push"); request(target); });
  }, [request, write]);
  const navigateMessage = useCallback((messageId: string, accountId?: string) => {
    const target = { ...emptyDeepLink(), accountId: accountId || latest.current.state.accountId, messageId };
    afterMobileOverlayNavigation(() => request(target, false, "push"));
  }, [request]);
  return { navigateAccount, navigateMessage };
}
