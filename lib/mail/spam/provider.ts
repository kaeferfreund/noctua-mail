import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";
import type { SpamConfig } from "./config";

export type SpamModelProviderOptions = Record<string, Record<string, string>>;

/**
 * The AI SDK model for the configured provider, or null when it cannot be
 * used (missing key, unknown provider). Adding another provider (e.g. a local
 * OpenAI-compatible server) is one more case here plus its env variables.
 */
export function getSpamLanguageModel(config: SpamConfig): LanguageModel | null {
  switch (config.provider) {
    case "anthropic":
      return config.apiKey ? createAnthropic({ apiKey: config.apiKey })(config.model) : null;
    default:
      return null;
  }
}

/** Classification needs little reasoning: low effort keeps latency and cost down. */
export function getSpamProviderOptions(config: SpamConfig): SpamModelProviderOptions | undefined {
  return config.provider === "anthropic" ? { anthropic: { effort: "low" } } : undefined;
}

/** Why the model cannot be used: "missing-key" or "unsupported-provider" (null when usable). */
export function spamModelUnavailableReason(config: SpamConfig) {
  if (config.provider !== "anthropic") return "unsupported-provider" as const;
  return config.apiKey ? null : "missing-key" as const;
}
