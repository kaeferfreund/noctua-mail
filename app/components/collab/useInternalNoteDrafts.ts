"use client";
import { useState } from "react";

/** Mounted with the reader, outside the collapsible/thread-specific composer. */
export function useInternalNoteDrafts(accountId: string, threadId?: string) {
  const [drafts, setDrafts] = useState(new Map<string, string>());
  const key = JSON.stringify([accountId, threadId]);
  return {
    body: drafts.get(key) ?? "",
    setBody: (body: string) => setDrafts(previous => new Map(previous).set(key, body)),
    clearSaved: (submittedBody: string) => setDrafts(previous => {
      // An older submission can settle after navigation/reopening and further edits.
      if (previous.get(key) !== submittedBody) return previous;
      const next = new Map(previous);
      next.delete(key);
      return next;
    }),
  };
}
