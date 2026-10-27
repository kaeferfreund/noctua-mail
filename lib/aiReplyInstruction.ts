/**
 * The optional „KI-Antwort“ instruction (doc/AI-REPLY.md): what the user wants the reply to say,
 * typed or dictated. Client-safe; the server applies the same normalization before checking the limit.
 */
export const AI_REPLY_INSTRUCTION_LIMIT = 200;

/** Trimmed with whitespace runs collapsed to one space; empty means no instruction. */
export function normalizeAiReplyInstruction(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

/** Appends dictated text to the typed text without passing the limit. */
export function appendAiReplyInstruction(current: string, addition: string) {
  const next = normalizeAiReplyInstruction(addition);
  if (!next) return current;
  const joined = current.trim() ? `${current.replace(/\s+$/, "")} ${next}` : next;
  return joined.slice(0, AI_REPLY_INSTRUCTION_LIMIT);
}
