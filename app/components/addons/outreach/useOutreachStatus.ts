"use client";

import { useSyncExternalStore } from "react";
import type { OutreachStatusResponse } from "@/lib/addons/outreach/types";

/** REST base of the addon for one mailbox: `outreachApiPath(id, "contacts")` → `/api/addons/outreach/accounts/<id>/contacts`. */
export function outreachApiPath(accountId: string, sub = "") {
  const base = `/api/addons/outreach/accounts/${encodeURIComponent(accountId)}`;
  return sub ? `${base}/${sub.replace(/^\/+/, "")}` : base;
}

export type OutreachStatus = Omit<OutreachStatusResponse, "ok"> & { loaded: boolean };

const UNLOADED: OutreachStatus = { loaded: false, available: false, accounts: [], sesConfigured: false, trackingConfigured: false };
const OFF: OutreachStatus = { ...UNLOADED, loaded: true };

let current = UNLOADED;
let pending: Promise<void> | null = null;
/** Number of the newest status request; an older answer that arrives later is dropped. */
let generation = 0;
const listeners = new Set<() => void>();

function publish(next: OutreachStatus) {
  current = next;
  for (const listener of listeners) listener();
}

async function load() {
  const request = ++generation;
  const publishIfNewest = (next: OutreachStatus) => { if (request === generation) publish(next); };
  try {
    const response = await fetch("/api/addons/outreach/status", { cache: "no-store" });
    const body = response.ok ? await response.json() as Partial<OutreachStatusResponse> | null : null;
    // Anything that is not a complete status answer means "off" (also a stubbed fetch in tests).
    publishIfNewest(body?.ok === true && typeof body.available === "boolean" && Array.isArray(body.accounts)
      ? { loaded: true, available: body.available, accounts: body.accounts, sesConfigured: body.sesConfigured === true, trackingConfigured: body.trackingConfigured === true }
      : OFF);
  } catch {
    // The addon is optional: any failure means "not there" for this page load.
    publishIfNewest(OFF);
  }
}

/** Asks the server again, for example after the settings tab activated the addon for a mailbox. */
export function refreshOutreachStatus() {
  const request = load().finally(() => { if (pending === request) pending = null; });
  pending = request;
  return request;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!current.loaded && !pending) void refreshOutreachStatus();
  return () => { listeners.delete(listener); };
}

/**
 * One request per page load, shared by every component. While it is loading and whenever the
 * addon is off, `available` is false and `accounts` is empty: addon UI must render nothing then.
 */
export function useOutreachStatus(): OutreachStatus {
  return useSyncExternalStore(subscribe, () => current, () => UNLOADED);
}

export function isOutreachEnabledFor(status: OutreachStatus, accountId: string | null | undefined) {
  return status.available && !!accountId && status.accounts.some(account => account.accountId === accountId && account.enabled);
}

/** Test seam: reset the module cache between DOM tests. */
export function resetOutreachStatusForTests(next: OutreachStatus = UNLOADED) {
  pending = null;
  generation++;
  publish(next);
}
