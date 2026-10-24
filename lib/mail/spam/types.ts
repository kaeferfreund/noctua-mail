export type SpamVerdict = "spam" | "ham" | "unsure";
export type SpamLabel = "spam" | "ham";

/** Everything the classifier sees about one message. No raw HTML. */
export type SpamInput = {
  from: string;
  fromEmail: string | null;
  fromName: string | null;
  replyTo: string | null;
  to: string;
  /** Cc addresses; absent in older callers. */
  cc?: string;
  messageId?: string | null;
  subject: string;
  date: string | null;
  listId: string | null;
  listUnsubscribe: string | null;
  autoSubmitted?: string | null;
  /** Unfolded `Authentication-Results` header values. */
  authenticationResults: string[];
  /** Unfolded `X-Spam-*` headers as "Name: value". */
  spamHeaders: string[];
  linkDomains: string[];
  /** Link targets whose visible text names another domain (extractMaskedLinkDomains). */
  maskedLinkDomains?: string[];
  /** "filename (content/type)" */
  attachments: string[];
  /** Plain text without quoted replies, at most SPAM_TEXT_LIMIT characters. */
  text: string;
};

export type SpamDecisionSource = "allowlist" | "static-allow" | "static-deny" | "trusted:profile" | "model";

/**
 * How the sender profile took part (doc/SPAM-DETECTION.md, trusted senders):
 * skipped as trusted, a canary sample of a trusted sender that the model
 * checked anyway (`mismatch`: the model did not say ham), or a trusted sender
 * whose mail deviates from its pattern.
 */
export type SpamTrustOutcome =
  | { kind: "skip" }
  | { kind: "canary"; mismatch: boolean }
  | { kind: "anomaly"; anomalies: string[] };

export type SpamDecision = {
  verdict: SpamVerdict;
  confidence: number;
  reasons: string[];
  source: SpamDecisionSource;
  /** A stricter spam threshold for this decision (trusted senders: 0.9). */
  minThreshold?: number;
  trust?: SpamTrustOutcome;
};

/** One stored user decision, as used in the prompt. */
export type SpamExample = {
  senderEmail: string | null;
  senderDomain: string | null;
  subject: string;
  snippet: string;
  label: SpamLabel;
  createdAt: number;
};
