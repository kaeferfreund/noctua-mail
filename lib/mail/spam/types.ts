export type SpamVerdict = "spam" | "ham" | "unsure";
export type SpamLabel = "spam" | "ham";

/** Everything the classifier sees about one message. No raw HTML. */
export type SpamInput = {
  from: string;
  fromEmail: string | null;
  fromName: string | null;
  replyTo: string | null;
  to: string;
  subject: string;
  date: string | null;
  listId: string | null;
  listUnsubscribe: string | null;
  /** Unfolded `Authentication-Results` header values. */
  authenticationResults: string[];
  /** Unfolded `X-Spam-*` headers as "Name: value". */
  spamHeaders: string[];
  linkDomains: string[];
  /** "filename (content/type)" */
  attachments: string[];
  /** Plain text without quoted replies, at most SPAM_TEXT_LIMIT characters. */
  text: string;
};

export type SpamDecisionSource = "allowlist" | "static-allow" | "static-deny" | "model";

export type SpamDecision = {
  verdict: SpamVerdict;
  confidence: number;
  reasons: string[];
  source: SpamDecisionSource;
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
