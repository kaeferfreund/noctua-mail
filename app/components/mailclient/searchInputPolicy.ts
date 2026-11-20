/**
 * Decides how text typed into the search box reaches the applied query that
 * drives the message list (ported from upstream #165).
 *
 * Every applied query starts a server search, so typing is debounced: the
 * box applies its text after a short pause, Enter applies it at once, and an
 * emptied box clears the search at once.
 */

export const SEARCH_INPUT_DEBOUNCE_MS = 250;

export type SearchInputTransition =
  | { type: "none" }
  | { type: "apply"; query: string }
  | { type: "schedule"; query: string };

export function resolveSearchInputTransition(value: string, appliedQuery: string): SearchInputTransition {
  const next = value.trim();
  if (next === appliedQuery) return { type: "none" };
  if (next === "") return { type: "apply", query: "" };
  return { type: "schedule", query: next };
}

export function resolveSubmittedSearchQuery(value: string): string {
  return value.trim();
}
