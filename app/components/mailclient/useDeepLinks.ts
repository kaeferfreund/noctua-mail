"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { MessageResolution } from "@/lib/navigation/resolveMessage";
import type { Message } from "@/lib/data";
import { authorizeDeepLink, deepLinkHistoryMode, emptyDeepLink, parseDeepLink, serializeDeepLink, type DeepLinkState } from "@/lib/navigation/deepLinks";
import { afterMobileOverlayNavigation, isMobileOverlayPop } from "@/app/hooks/useMobileOverlayHistory";
import { readerShortcut } from "@/lib/ui/readerFocus";

type Options = {
  ready: boolean;
  /** False while the session has expired and the sign-in screen is shown. */
  authenticated: boolean;
  state: DeepLinkState;
  accountIds: string[];
  messages: Message[];
  switchAccount: (id: string) => Promise<void>;
  applyPlace: (state: DeepLinkState) => DeepLinkState;
  resolveMessage: (accountId: string, messageId: string, signal: AbortSignal) => Promise<MessageResolution>;
  onUnauthenticated?: () => void;
  onForbidden?: () => void;
  openMessage: (message: Message) => void;
  notice: (kind: "forbidden" | "missing" | "moved" | "failed") => void;
  /** URL → UI transaction boundaries, e.g. for scroll anchors of history entries. */
  onTransaction?: (event: DeepLinkTransaction) => void;
};
/** `history` is Back/Forward; `link` is an in-app navigation to an explicit target. */
export type DeepLinkTransaction = { phase: "start" | "settled"; origin: "initial" | "history" | "link"; messageId: string };
type Pending = { target: DeepLinkState; phase: "requested" | "switching" | "account" | "place" | "message" | "settle"; origin: DeepLinkTransaction["origin"]; expected?: DeepLinkState; forbidden?: boolean; historyMode: "push" | "replace"; keepMessage?: boolean;
  /** Keep the status panel, calendar sidebar and composer as they are when the place is applied. */
  keepShell?: boolean; controller: AbortController; done: () => void };

let entrySequence = 0;
/** Identifies one history entry, so two visits of the same place keep their own state. */
const nextHistoryEntry = () => `${Date.now().toString(36)}.${(++entrySequence).toString(36)}`;

/**
 * An expired session interrupts a transaction wherever it is. The target stays and the
 * transaction starts over once the session is back: the mailbox the sign-in restores is
 * not a fallback the link chose. Reads and switches of the interrupted attempt end with its signal.
 */
function rewind(work: Pending) {
  work.controller.abort();
  work.controller = new AbortController();
  work.phase = "requested";
  work.expected = undefined; work.forbidden = undefined; work.keepMessage = undefined;
}

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
  // The transaction attempt (its signal) whose mailbox switch has finished. State rather than
  // a phase write: an effect of a render committed before the switch's own updates can still
  // run after the switch resolved, and must not read that render's mailbox as the switch's result.
  // Per attempt, so a transaction started over after a sign-in waits for its new switch.
  const [switched, setSwitched] = useState<AbortSignal | null>(null);
  const request = useCallback((target: DeepLinkState, origin: Pending["origin"] = "link", historyMode: "push" | "replace" = "replace", keepShell = false) => {
    pending.current?.controller.abort();
    pending.current?.done();
    let done = () => {};
    const settled = new Promise<void>(resolve => { done = resolve; });
    pending.current = { target, origin, historyMode, keepShell, phase: "requested", controller: new AbortController(), done };
    latest.current.onTransaction?.({ phase: "start", origin, messageId: target.messageId });
    update();
    return settled;
  }, [update]);
  const write = useCallback((state: DeepLinkState, mode: "push" | "replace") => {
    const href = serializeDeepLink(state, window.location.href);
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const entry = mode === "replace" && typeof window.history.state?.noctuaEntry === "string" ? window.history.state.noctuaEntry : nextHistoryEntry();
    const historyState = { ...window.history.state, noctuaUrl: true, noctuaMessageEntry: Boolean(state.messageId), noctuaEntry: entry };
    if (href !== current || !window.history.state?.noctuaUrl) {
      window.history[mode === "push" ? "pushState" : "replaceState"](historyState, "", href);
    }
  }, []);
  useEffect(() => {
    initialized.current = true;
    // Hydrate external browser state after mount; subsequent updates come from popstate.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    request(parseDeepLink(window.location.search), "initial");
    const onPop = (event: PopStateEvent) => {
      if (!isMobileOverlayPop(event)) void request(parseDeepLink(window.location.search), "history");
    };
    // Only keys that move the selection (reader next/previous) mark the next change;
    // arrow keys scroll and must not leave the flag set for a later click-free change.
    const onKey = (event: KeyboardEvent) => {
      const shortcut = readerShortcut(event);
      if (shortcut === "next" || shortcut === "previous") keyboard.current = true;
    };
    const onPointer = () => { keyboard.current = false; };
    window.addEventListener("popstate", onPop);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", onPointer, true);
    return () => {
      initialized.current = false;
      pending.current?.controller.abort();
      pending.current?.done();
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pointerdown", onPointer, true);
    };
  }, [request]);
  useEffect(() => {
    const work = pending.current;
    if (!options.authenticated && work && work.phase !== "requested") rewind(work);
  }, [options.authenticated]);
  useEffect(() => {
    if (!options.ready || !initialized.current) return;
    const work = pending.current;
    if (!work) return;
    const revoked = (accountId: string) => Boolean(accountId) && !options.accountIds.includes(accountId);
    if (revoked(work.target.accountId) && (work.phase !== "requested" || revoked(options.state.accountId))) {
      // An authorization refresh can revoke a destination while its detail is loading.
      options.notice("forbidden");
      if (revoked(options.state.accountId)) {
        // The mailbox on screen is gone as well, so there is no granted fallback here:
        // finish the transaction and let the bootstrap resolve the server's selection.
        work.controller.abort();
        pending.current = null;
        work.done();
        latest.current.onForbidden?.();
        return;
      }
      // The URL transaction falls back to the granted mailbox on screen; the state
      // machine advances one phase per render, as for the initial URL above.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      request({ ...emptyDeepLink(), accountId: options.state.accountId });
      return;
    }
    const signal = work.controller.signal;
    const current = () => pending.current === work && !signal.aborted;
    if (work.phase === "switching") {
      if (switched !== signal) return;
      work.phase = "account";
    }
    if (work.phase === "requested") {
      const authorized = authorizeDeepLink(work.target, options.accountIds, options.state.accountId);
      work.target = authorized.state;
      if (authorized.forbidden) options.notice("forbidden");
      // New-message links may arrive before the user selects a mailbox at the gate.
      if (!work.target.accountId && !work.target.admin && !work.target.security) return;
      work.phase = "switching";
      // Even reselecting the currently visible mailbox cancels an older in-flight switch.
      void options.switchAccount(work.target.accountId).then(() => {
        if (current()) setSwitched(signal);
      });
    } else if (work.phase === "account") {
      if (options.state.accountId !== work.target.accountId) {
        // The switch was denied or failed and the controller kept or reloaded another mailbox.
        // Never keep retrying a denied link. (An expired session never gets here: it rewinds.)
        work.target = { ...emptyDeepLink(), accountId: options.state.accountId };
      }
      if (work.keepShell) {
        // Read now, after the click that started the link has closed its own popover or sheet.
        work.target = { ...work.target, panel: options.state.panel, calendar: options.state.calendar, compose: options.state.compose };
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
          rewind(work);
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
      work.done();
      previous.current = options.state;
      // A directly opened reader gets a list entry too, including after login/reload.
      if (work.origin === "initial" && options.state.messageId && !window.history.state?.noctuaMessageEntry) {
        write({ ...options.state, messageId: "" }, "replace");
        write(options.state, "push");
      } else write(work.keepMessage ? { ...options.state, messageId: work.target.messageId } : options.state, work.historyMode);
      latest.current.onTransaction?.({ phase: "settled", origin: work.origin, messageId: options.state.messageId });
    }
  });
  useEffect(() => {
    if (!options.ready || !initialized.current || pending.current) return;
    const next = options.state;
    const last = previous.current;
    if (last && serializeDeepLink(last) === serializeDeepLink(next)) return;
    return afterMobileOverlayNavigation(() => {
      // Deleting/archiving the reader advances selection within the same list.
      // Replace that reader entry so Back cannot reopen the removed message.
      const removedReader = last?.messageId && !options.messages.some(message => message.id === last.messageId) &&
        serializeDeepLink({ ...last, messageId: next.messageId }) === serializeDeepLink(next);
      write(next, last && !removedReader ? deepLinkHistoryMode(last, next, keyboard.current) : "replace");
      keyboard.current = false;
      previous.current = next;
    });
  });
  const navigateAccount = useCallback((accountId: string) => {
    const current = latest.current.state;
    const target = accountId === current.accountId ? { ...current, messageId: "" } : { ...emptyDeepLink(), accountId };
    return new Promise<void>(resolve => {
      afterMobileOverlayNavigation(() => { write(target, "push"); void request(target).then(resolve); });
    });
  }, [request, write]);
  // Reminders, calendar entries and notices open a message without closing the
  // status panel, the calendar sidebar or the composer.
  const navigateMessage = useCallback((messageId: string, accountId?: string) => {
    const target = { ...emptyDeepLink(), accountId: accountId || latest.current.state.accountId, messageId };
    afterMobileOverlayNavigation(() => request(target, "link", "push", true));
  }, [request]);
  // Folder clicks can arrive after the destination renders but before its
  // mailbox transaction applies its default place. Keep the latest choice.
  const queueFolderChoice = useCallback((folderId: string) => {
    const work = pending.current;
    if (!work || !["requested", "switching", "account"].includes(work.phase)) return false;
    work.target = { ...work.target, folderId, messageId: "", scope: "folder", query: "", badges: [], view: null };
    return true;
  }, []);
  return { navigateAccount, navigateMessage, queueFolderChoice };
}
