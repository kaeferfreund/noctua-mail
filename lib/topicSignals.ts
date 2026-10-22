import { isOwnAddress, ownAddressList, parseAddressEmails, type OwnAddressInput } from "@/lib/ownAddresses";
import type { TopicSuggestionSignal } from "./data";

export type TopicSignalSource = {
  fromEmail?: string | null;
  to?: string | null;
  cc?: string | null;
  listId?: string | null;
  subject?: string | null;
  messageId?: string | null;
};

export type TopicSignalEntry = {
  type: TopicSuggestionSignal;
  value: string;
};

const JIRA_PROJECT_KEY_PATTERN = /\b([A-Z][A-Z0-9]+)-\d+\b/g;
const JIRA_SUBJECT_HINT_PATTERN = /\[[^\]]+\].*\b[A-Z][A-Z0-9]+-\d+\b/;

export function extractEmailAddresses(fields: Array<string | null | undefined>): string[] {
  return [...new Set(fields.flatMap(field => parseAddressEmails(field)))];
}

function looksLikeJiraMessage(source: Pick<TopicSignalSource, "subject" | "messageId">) {
  const messageId = source.messageId?.toLowerCase().trim() ?? "";
  if (messageId.includes("@atlassian.jira") || messageId.includes("@jira.")) {
    return true;
  }
  const subject = source.subject?.trim() ?? "";
  return JIRA_SUBJECT_HINT_PATTERN.test(subject);
}

export function extractJiraProjectKeys(
  rows: Array<Pick<TopicSignalSource, "subject" | "messageId">>
): string[] {
  const seen = new Set<string>();
  const keys: string[] = [];

  rows.forEach((row) => {
    if (!looksLikeJiraMessage(row)) return;
    const subject = row.subject?.trim() ?? "";
    for (const match of subject.matchAll(JIRA_PROJECT_KEY_PATTERN)) {
      const projectKey = match[1]?.trim().toUpperCase();
      if (!projectKey || seen.has(projectKey)) continue;
      seen.add(projectKey);
      keys.push(projectKey);
    }
  });

  return keys;
}

export function collectTopicSignalEntries(
  rows: TopicSignalSource[],
  options?: {
    excludeAccountEmail?: OwnAddressInput;
  }
): TopicSignalEntry[] {
  const ownAddresses = ownAddressList(options?.excludeAccountEmail);
  const seen = new Set<string>();
  const entries: TopicSignalEntry[] = [];

  const add = (type: TopicSuggestionSignal, value?: string | null) => {
    const normalizedValue = value?.trim();
    if (!normalizedValue) return;
    const key = `${type}\u0000${normalizedValue}`;
    if (seen.has(key)) return;
    seen.add(key);
    entries.push({ type, value: normalizedValue });
  };

  rows.forEach((row) => {
    const fromEmail = parseAddressEmails(row.fromEmail)[0] ?? "";
    if (fromEmail && !isOwnAddress(fromEmail, ownAddresses)) {
      add("senderEmail", fromEmail);
      const senderDomain = fromEmail.includes("@") ? fromEmail.split("@")[1] : "";
      if (senderDomain) {
        add("senderDomain", senderDomain);
      }
    }

    if (row.listId?.trim()) {
      add("listId", row.listId.trim());
    }

    extractEmailAddresses([row.to, row.cc])
      .filter((email) => !isOwnAddress(email, ownAddresses))
      .forEach((email) => add("recipient", email));
  });

  extractJiraProjectKeys(rows).forEach((projectKey) => add("jiraProjectKey", projectKey));

  return entries;
}
