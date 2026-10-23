"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CalendarEventDiff } from "@/lib/calendarEventDiff";
import { buildAccountCalendarConflictsPath } from "@/lib/accountApiPaths";
import {
  CALENDAR_EVENTS_UPDATED_EVENT,
  CALENDAR_SYNC_COMPLETED_EVENT
} from "./calendarEventsClient";

export type CalendarEventConflictItem = {
  eventId: string;
  eventUid: string;
  summary: string | null;
  timeZone: string | null;
  allDay: boolean;
  localChangedAtMs: number | null;
  remoteChangedAtMs: number | null;
  localDiff: CalendarEventDiff | null;
  remoteDiff: CalendarEventDiff | null;
};

/**
 * Loads unresolved CalDAV write-back conflicts for the account and keeps them
 * fresh: it re-fetches on local mutations (resolve/edit) and after each sync
 * round-trip settles, since that is when the server may have recorded a new
 * conflict.
 */
export function useCalendarConflicts(accountId: string) {
  const [result, setResult] = useState<{ accountId: string; conflicts: CalendarEventConflictItem[] }>({ accountId, conflicts: [] });
  // Adjust only when the account changes so switching away and back cannot
  // resurrect an old snapshot before the new request settles.
  if (result.accountId !== accountId) {
    setResult({ accountId, conflicts: [] });
  }
  const conflicts = result.accountId === accountId ? result.conflicts : [];
  // Monotonic token: every refresh claims one; a response only applies if it's
  // still the latest. Bumped on cleanup so an in-flight fetch can't update state
  // after an account switch or unmount (stale data / setState-after-unmount).
  const requestRef = useRef({ version: 0 });

  const refresh = useCallback(() => {
    if (!accountId) return Promise.resolve();
    const request = requestRef.current;
    const token = ++request.version;
    return fetch(buildAccountCalendarConflictsPath(accountId), {
      credentials: "include"
    }).then(async res => {
      if (!res.ok) return;
      const body = (await res.json()) as {
        ok?: boolean;
        conflicts?: CalendarEventConflictItem[];
      };
      if (token !== request.version) return; // superseded or unmounted
      if (body.ok) setResult({ accountId, conflicts: body.conflicts ?? [] });
    }).catch(() => {
      // transient; next signal refreshes
    });
  }, [accountId]);

  useEffect(() => {
    const request = requestRef.current;
    void refresh();
    const handler = () => void refresh();
    window.addEventListener(CALENDAR_EVENTS_UPDATED_EVENT, handler);
    window.addEventListener(CALENDAR_SYNC_COMPLETED_EVENT, handler);
    return () => {
      request.version++; // invalidate any in-flight refresh
      window.removeEventListener(CALENDAR_EVENTS_UPDATED_EVENT, handler);
      window.removeEventListener(CALENDAR_SYNC_COMPLETED_EVENT, handler);
    };
  }, [refresh]);

  return { conflicts, refresh };
}
