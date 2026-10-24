import type { LanguageModelUsage } from "ai";
import type { SpamModelPrice } from "./config";

/**
 * Token usage of model calls, taken from the AI SDK's `usage` only (no own
 * token counting). `inputTokens` is the total: uncached + cache read + cache write.
 */
export type SpamTokenUsage = {
  calls: number;
  /** Calls that read at least one token from the prompt cache. */
  cacheHits: number;
  inputTokens: number;
  noCacheTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  outputTokens: number;
};

export const EMPTY_SPAM_USAGE: SpamTokenUsage = {
  calls: 0, cacheHits: 0, inputTokens: 0, noCacheTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: 0
};

export function spamUsageFromSdk(usage: LanguageModelUsage): SpamTokenUsage {
  const cacheReadTokens = usage.inputTokenDetails.cacheReadTokens ?? 0;
  const cacheWriteTokens = usage.inputTokenDetails.cacheWriteTokens ?? 0;
  const inputTokens = usage.inputTokens ?? 0;
  return {
    calls: 1,
    cacheHits: cacheReadTokens > 0 ? 1 : 0,
    inputTokens,
    noCacheTokens: usage.inputTokenDetails.noCacheTokens ?? Math.max(0, inputTokens - cacheReadTokens - cacheWriteTokens),
    cacheReadTokens,
    cacheWriteTokens,
    outputTokens: usage.outputTokens ?? 0
  };
}

export function addSpamUsage(total: SpamTokenUsage, usage: SpamTokenUsage): SpamTokenUsage {
  return {
    calls: total.calls + usage.calls,
    cacheHits: total.cacheHits + usage.cacheHits,
    inputTokens: total.inputTokens + usage.inputTokens,
    noCacheTokens: total.noCacheTokens + usage.noCacheTokens,
    cacheReadTokens: total.cacheReadTokens + usage.cacheReadTokens,
    cacheWriteTokens: total.cacheWriteTokens + usage.cacheWriteTokens,
    outputTokens: total.outputTokens + usage.outputTokens
  };
}

/** Token counts for log lines (no content). */
export function spamUsageLogFields(usage: SpamTokenUsage) {
  return {
    inputTokens: usage.inputTokens,
    cacheReadTokens: usage.cacheReadTokens,
    cacheWriteTokens: usage.cacheWriteTokens,
    outputTokens: usage.outputTokens
  };
}

/** Share of all input tokens that were read from the cache (0 without calls). */
export function spamCacheHitRate(usage: SpamTokenUsage) {
  return usage.inputTokens ? usage.cacheReadTokens / usage.inputTokens : 0;
}

export function estimateSpamCostUsd(usage: SpamTokenUsage, price: SpamModelPrice) {
  return (usage.noCacheTokens * price.input + usage.cacheReadTokens * price.cacheRead
    + usage.cacheWriteTokens * price.cacheWrite + usage.outputTokens * price.output) / 1_000_000;
}
