import { createHash } from "node:crypto";
import type { Message } from "./data";

/** Bind both the MIME source and the parsed SMTP envelope to what the user planned. */
export function scheduledDraftFingerprint(draft: Pick<Message, "messageId" | "from" | "to" | "cc" | "bcc">, rawSource: string) {
  return createHash("sha256").update(JSON.stringify([
    rawSource, draft.messageId ?? null, draft.from, draft.to, draft.cc ?? null, draft.bcc ?? null
  ])).digest("hex");
}
