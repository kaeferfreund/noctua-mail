"use client";

import { useCallback, useState } from "react";

export type ReloginPrompt = {
  /** Mailbox whose credentials dialog is open; "" while closed. */
  reloginAccountId: string;
  /** A failed request wants new credentials. Ignored for mailboxes the person cancelled. */
  requestRelogin: (accountId: string) => void;
  /** The person asks for the dialog (status bar), which lifts an earlier cancel. */
  openRelogin: (accountId: string) => void;
  /** Close without new credentials (Cancel, Escape, outside click): no automatic prompt for that mailbox any more. */
  dismissRelogin: () => void;
  /** New credentials were accepted for the mailbox. */
  completeRelogin: (accountId: string) => void;
  /** The mailbox can no longer be repaired by this person: close its dialog without counting a cancel. */
  closeRelogin: (accountId: string) => void;
  /** Another person signed in or the person signed out: forget everything. Safe during render. */
  resetRelogin: () => void;
};

type State = { accountId: string; dismissed: ReadonlySet<string> };

const INITIAL: State = { accountId: "", dismissed: new Set() };

function without(set: ReadonlySet<string>, accountId: string): ReadonlySet<string> {
  if (!set.has(accountId)) return set;
  const next = new Set(set);
  next.delete(accountId);
  return next;
}

/**
 * Background requests keep failing while the mail server is down or the password is wrong.
 * Without remembering a cancel, every one of them would reopen the dialog and the locally
 * stored mail would stay out of reach. The cancel lasts until the page reloads, the person
 * opens the dialog themselves, a re-login succeeds or another person signs in.
 */
export function useReloginPrompt(): ReloginPrompt {
  const [state, setState] = useState<State>(INITIAL);

  const requestRelogin = useCallback((accountId: string) => {
    if (!accountId) return;
    setState((current) =>
      current.dismissed.has(accountId) || current.accountId === accountId
        ? current
        : { ...current, accountId }
    );
  }, []);

  const openRelogin = useCallback((accountId: string) => {
    if (!accountId) return;
    setState((current) => ({ accountId, dismissed: without(current.dismissed, accountId) }));
  }, []);

  const dismissRelogin = useCallback(() => {
    setState((current) => {
      if (!current.accountId) return current;
      const dismissed = new Set(current.dismissed);
      dismissed.add(current.accountId);
      return { accountId: "", dismissed };
    });
  }, []);

  const completeRelogin = useCallback((accountId: string) => {
    setState((current) => {
      const dismissed = without(current.dismissed, accountId);
      const open = current.accountId === accountId ? "" : current.accountId;
      return dismissed === current.dismissed && open === current.accountId
        ? current
        : { accountId: open, dismissed };
    });
  }, []);

  const closeRelogin = useCallback((accountId: string) => {
    setState((current) =>
      accountId && current.accountId === accountId ? { ...current, accountId: "" } : current
    );
  }, []);

  const resetRelogin = useCallback(() => setState(INITIAL), []);

  return {
    reloginAccountId: state.accountId,
    requestRelogin,
    openRelogin,
    dismissRelogin,
    completeRelogin,
    closeRelogin,
    resetRelogin
  };
}
