import { NextResponse } from "next/server";
import { createRateLimiter } from "@/lib/rateLimit";

/** DeepL calls bill the mailbox's key: per user in a mailbox, and per mailbox overall. */
export const DEEPL_CALLS_PER_USER_MAILBOX_PER_MINUTE = 20;
export const DEEPL_CALLS_PER_MAILBOX_PER_MINUTE = 60;
const perUserMailbox = createRateLimiter({ max: DEEPL_CALLS_PER_USER_MAILBOX_PER_MINUTE });
const perMailbox = createRateLimiter({ max: DEEPL_CALLS_PER_MAILBOX_PER_MINUTE });

/**
 * A 429 response once the caller or the mailbox has used its DeepL budget for
 * this minute; null otherwise. Call it right before an upstream DeepL request
 * (cache hits cost nothing and are not counted).
 */
export function deeplRateLimitResponse(userId: string, accountId: string) {
  // Short-circuit: a rejected user call does not use up the mailbox budget.
  if (!perUserMailbox.isLimited(`${userId}\n${accountId}`) && !perMailbox.isLimited(accountId)) return null;
  return NextResponse.json(
    { ok: false, message: "Too many translation requests. Try again in a minute." },
    { status: 429, headers: { "retry-after": "60" } }
  );
}
