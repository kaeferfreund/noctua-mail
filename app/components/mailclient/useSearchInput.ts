"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  SEARCH_INPUT_DEBOUNCE_MS,
  resolveSearchInputTransition,
  resolveSubmittedSearchQuery
} from "./searchInputPolicy";

type UseSearchInputOptions = {
  /** The applied query that drives the message list. */
  query: string;
  setQuery: (next: string) => void;
  debounceMs?: number;
};

export type SearchInputState = {
  /** What the box shows; may run ahead of `query` while typing. */
  searchInput: string;
  setSearchInput: (value: string) => void;
  /** Enter: apply the box content now. */
  submitSearchInput: () => void;
};

/**
 * Keeps the search box text apart from the applied query, so a typing burst
 * starts one server search instead of one per keystroke (the list hook already
 * aborts superseded requests). A query set elsewhere (topic, related search,
 * deep link, mailbox switch) re-seeds the box and drops a pending search.
 */
export function useSearchInput({
  query,
  setQuery,
  debounceMs = SEARCH_INPUT_DEBOUNCE_MS
}: UseSearchInputOptions): SearchInputState {
  // `seenQuery` is the applied query the box text belongs to; a different
  // `query` was set elsewhere and replaces the text (adjusted during render).
  const [box, setBox] = useState({ input: query, seenQuery: query });
  const timerRef = useRef<number | null>(null);
  const appliedQueryRef = useRef(query);

  const cancelPending = useCallback(() => {
    if (timerRef.current === null) return;
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const applyQuery = useCallback(
    (next: string) => {
      cancelPending();
      appliedQueryRef.current = next;
      setBox((prev) => (prev.seenQuery === next ? prev : { ...prev, seenQuery: next }));
      setQuery(next);
    },
    [cancelPending, setQuery]
  );

  let searchInput = box.input;
  if (box.seenQuery !== query) {
    searchInput = query;
    setBox({ input: query, seenQuery: query });
  }

  useEffect(() => {
    if (query === appliedQueryRef.current) return;
    appliedQueryRef.current = query;
    cancelPending();
  }, [cancelPending, query]);

  useEffect(() => cancelPending, [cancelPending]);

  const setSearchInput = useCallback(
    (value: string) => {
      setBox((prev) => ({ ...prev, input: value }));
      const transition = resolveSearchInputTransition(value, appliedQueryRef.current);
      if (transition.type === "none") {
        cancelPending();
        return;
      }
      if (transition.type === "apply") {
        applyQuery(transition.query);
        return;
      }
      cancelPending();
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        applyQuery(transition.query);
      }, debounceMs);
    },
    [applyQuery, cancelPending, debounceMs]
  );

  const submitSearchInput = useCallback(() => {
    applyQuery(resolveSubmittedSearchQuery(searchInput));
  }, [applyQuery, searchInput]);

  return { searchInput, setSearchInput, submitSearchInput };
}
