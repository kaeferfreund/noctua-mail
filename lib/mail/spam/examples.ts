import { getRootDomain } from "@/lib/senderIdentity";
import { normalizeIdentityEmail, parseAddressEmails } from "@/lib/ownAddresses";
import { listSpamExampleCandidates, saveSpamExample, saveSpamVerdict } from "@/lib/serverDb";
import type { Message } from "@/lib/data";
import { stripQuotedText } from "./input";
import type { SpamExample, SpamLabel } from "./types";

/**
 * Labeled examples from the users' own decisions ("Als Spam", "Kein Spam",
 * "Nicht verdächtig"). Each classification call gets the nearest ones in the
 * prompt instead of any training: same sender address first, then the same
 * root domain, then subject similarity, then the most recent.
 */
export const SPAM_EXAMPLE_LIMIT = 16;
const MIN_PER_LABEL = 3;
const SNIPPET_LENGTH = 280;

export type SpamExampleSource = "mark-spam" | "not-spam" | "not-suspicious";
export type SpamExampleTarget = { senderEmail: string | null; subject: string };

export function senderParts(from: string | null | undefined) {
  const email = parseAddressEmails(from ?? "")[0] ?? null;
  const normalized = email ? normalizeIdentityEmail(email) ?? email.toLowerCase() : null;
  const domain = normalized ? getRootDomain(normalized.slice(normalized.lastIndexOf("@") + 1)) : null;
  return { senderEmail: normalized, senderDomain: domain };
}

function subjectTokens(subject: string) {
  return new Set(subject.toLowerCase().replace(/^((re|aw|fwd?|wg)\s*:\s*)+/i, "")
    .split(/[^\p{L}\p{N}]+/u).filter((token) => token.length >= 3));
}

/** Jaccard similarity of subject words (≥ 3 characters, reply prefixes ignored). */
export function subjectSimilarity(a: string, b: string) {
  const left = subjectTokens(a);
  const right = subjectTokens(b);
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  return shared / (left.size + right.size - shared);
}

export function rankSpamExamples(candidates: SpamExample[], target: SpamExampleTarget, limit = SPAM_EXAMPLE_LIMIT) {
  const email = target.senderEmail?.toLowerCase() ?? null;
  const domain = email ? getRootDomain(email.slice(email.lastIndexOf("@") + 1)) : null;
  const tier = (example: SpamExample) =>
    email && example.senderEmail === email ? 0 : domain && example.senderDomain === domain ? 1 : 2;
  const scored = candidates.map((example) => ({
    example, tier: tier(example), similarity: subjectSimilarity(example.subject, target.subject)
  }));
  scored.sort((a, b) => a.tier - b.tier || b.similarity - a.similarity || b.example.createdAt - a.example.createdAt);
  const ranked = scored.map((entry) => entry.example);
  const picked = ranked.slice(0, limit);
  // Keep both labels in view: a prompt with only spam examples biases towards spam.
  for (const label of ["spam", "ham"] as const) {
    const missing = Math.min(MIN_PER_LABEL, ranked.filter((example) => example.label === label).length)
      - picked.filter((example) => example.label === label).length;
    if (missing <= 0) continue;
    const extra = ranked.slice(limit).filter((example) => example.label === label).slice(0, missing);
    for (const example of extra) {
      let replaceAt = picked.length - 1;
      while (replaceAt >= 0 && picked[replaceAt].label === label) replaceAt -= 1;
      if (replaceAt < 0) break;
      picked.splice(replaceAt, 1);
      picked.push(example);
    }
  }
  return picked;
}

export async function findSpamExamples(accountId: string, target: SpamExampleTarget) {
  const domain = target.senderEmail ? getRootDomain(target.senderEmail.slice(target.senderEmail.lastIndexOf("@") + 1)) : null;
  const candidates = await listSpamExampleCandidates(accountId, { senderEmail: target.senderEmail, senderDomain: domain });
  return rankSpamExamples(candidates, target);
}

export function buildSpamExample(message: Pick<Message, "from" | "subject" | "body" | "preview">, label: SpamLabel): SpamExample {
  const text = stripQuotedText(message.body || message.preview || "").replace(/\s+/g, " ").trim();
  return {
    ...senderParts(message.from),
    subject: (message.subject ?? "").slice(0, 200),
    snippet: text.slice(0, SNIPPET_LENGTH),
    label,
    createdAt: Date.now()
  };
}

/** Never throws: a failed example write must not fail the user's action. */
export async function recordSpamDecision(params: {
  accountId: string;
  message: Pick<Message, "id" | "from" | "subject" | "body" | "preview">;
  label: SpamLabel;
  source: SpamExampleSource;
  userId?: string | null;
}) {
  try {
    await saveSpamExample(params.accountId, {
      ...buildSpamExample(params.message, params.label),
      messageId: params.message.id,
      source: params.source,
      decidedByUserId: params.userId ?? null
    });
  } catch (error) {
    console.warn("[spam] failed to record decision example", { accountId: params.accountId, error: String(error) });
  }
}

/** A user's "Kein Spam" overrides any automatic verdict on the message itself. */
export async function markMessageNotSuspicious(accountId: string, messageId: string) {
  try {
    return await saveSpamVerdict(accountId, messageId, { verdict: "ham", confidence: 1, reasons: ["Von Nutzer als „Kein Spam“ markiert"] });
  } catch (error) {
    console.warn("[spam] failed to clear suspicious mark", { accountId, error: String(error) });
    return false;
  }
}
