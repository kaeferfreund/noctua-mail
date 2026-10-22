import type { Topic } from "@/lib/data";

/**
 * Shape of the `explanation` field returned by
 * `/api/.../message-topics/explain?threadId=...` (the route returns an
 * `{ ok, explanation }` envelope; this type is the payload). Shared
 * between the state owner (`MessageViewOrchestrator`) and the popover
 * that renders it (`ThreadTopicSuggestionsRow`) so the two cannot
 * drift.
 */
export type TopicSuggestionExplanation = {
  signals: Array<{ type: string; value: string; weight: number }>;
  topics: Array<{
    topic: Topic;
    suggestionScore: number;
    matchCount: number;
    matchedSignals: Array<{ type: string; value: string; weight: number }>;
    matchedThreads: Array<{
      threadId: string;
      score: number;
      signals: Array<{ type: string; value: string; weight: number }>;
    }>;
  }>;
};

/**
 * Body presentation of one message in the thread view. Shared by the
 * per-message state map (`MessageViewOrchestrator.messageTabs`), the card
 * that renders the panels and the display-options menu that switches them.
 */
export type MessageTab = "html" | "text" | "markdown" | "source";
