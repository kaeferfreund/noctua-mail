import { MockLanguageModelV4 } from "ai/test";

/** A mocked AI SDK model that answers every call with `text`; tests never call a real API. */
export function mockSpamModel(text: string | (() => string)) {
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: "text", text: typeof text === "function" ? text() : text }],
      finishReason: { unified: "stop", raw: undefined },
      usage: {
        inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
        outputTokens: { total: 20, text: 20, reasoning: undefined }
      },
      warnings: []
    })
  });
}
