import { describe, expect, test } from "bun:test";
import { SPAM_MODEL_PRICES } from "./config";
import { addSpamUsage, EMPTY_SPAM_USAGE, estimateSpamCostUsd, spamCacheHitRate, spamUsageFromSdk } from "./usage";

const sdkUsage = (noCache: number, read: number, write: number, output: number) => ({
  inputTokens: noCache + read + write,
  inputTokenDetails: { noCacheTokens: noCache, cacheReadTokens: read, cacheWriteTokens: write },
  outputTokens: output,
  outputTokenDetails: { textTokens: output, reasoningTokens: undefined },
  totalTokens: noCache + read + write + output
});

describe("spam model usage", () => {
  test("aggregates SDK usage, hit rate and cost", () => {
    const total = [sdkUsage(300, 0, 1_000, 50), sdkUsage(300, 1_000, 0, 50)].map(spamUsageFromSdk).reduce(addSpamUsage, EMPTY_SPAM_USAGE);
    expect(total).toEqual({ calls: 2, cacheHits: 1, inputTokens: 2_600, noCacheTokens: 600, cacheReadTokens: 1_000, cacheWriteTokens: 1_000, outputTokens: 100 });
    expect(spamCacheHitRate(total)).toBeCloseTo(1_000 / 2_600);
    expect(spamCacheHitRate(EMPTY_SPAM_USAGE)).toBe(0);
    // (600 × 0.10 + 1,000 × 0.01 + 1,000 × 0.20 + 100 × 0.50) / 1M USD
    expect(estimateSpamCostUsd(total, SPAM_MODEL_PRICES["claude-haiku-5-5"])).toBeCloseTo(320 / 1_000_000);
  });

  test("missing details count as zero", () => {
    expect(spamUsageFromSdk({ ...sdkUsage(0, 0, 0, 0), inputTokens: 10, inputTokenDetails: { noCacheTokens: undefined, cacheReadTokens: undefined, cacheWriteTokens: undefined } }))
      .toMatchObject({ inputTokens: 10, noCacheTokens: 10, cacheReadTokens: 0, cacheWriteTokens: 0, cacheHits: 0 });
  });
});
