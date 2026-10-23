import en from "@/messages/en.json";

export const SEARCH_FIELD_OPTIONS = [
  ["sender", "fields.sender"],
  ["participants", "fields.participants"],
  ["subject", "fields.subject"],
  ["body", "fields.body"],
  ["attachments", "fields.attachments"]
] as const;

export const SEARCH_BADGE_OPTIONS = [
  ["unread", "badges.unread"],
  ["unanswered", "badges.unanswered"],
  ["flagged", "badges.flagged"],
  ["todo", "badges.todo"],
  ["calendar", "badges.calendar"],
  ["attachments", "badges.attachments"],
  ["newsletter", "badges.newsletter"],
  ["notification", "badges.notification"],
  ["transactional", "badges.transactional"],
  ["ai-modified", "badges.ai-modified"]
] as const;

type SearchFieldKey = (typeof SEARCH_FIELD_OPTIONS)[number][0];
type SearchBadgeKey = (typeof SEARCH_BADGE_OPTIONS)[number][0];

type SearchLabelKey = (typeof SEARCH_FIELD_OPTIONS)[number][1] | (typeof SEARCH_BADGE_OPTIONS)[number][1];
export type SearchTranslator = (key: SearchLabelKey) => string;
// Legacy callers retain English until their owning slice supplies its translator.
const englishLabels: SearchTranslator = (key) => {
  const [group, id] = key.split(".") as ["fields" | "badges", string];
  return (en.Search[group] as Record<string, string>)[id];
};

const searchFieldLabelMap = new Map<SearchFieldKey, SearchLabelKey>(SEARCH_FIELD_OPTIONS);
const searchBadgeLabelMap = new Map<SearchBadgeKey, SearchLabelKey>(SEARCH_BADGE_OPTIONS);

export const SEARCH_FIELD_ORDER = SEARCH_FIELD_OPTIONS.map(([key]) => key) as SearchFieldKey[];
export const SEARCH_BADGE_ORDER = SEARCH_BADGE_OPTIONS.map(([key]) => key) as SearchBadgeKey[];

export function getSearchFieldLabel(key: string, t: SearchTranslator = englishLabels): string {
  const label = searchFieldLabelMap.get(key as SearchFieldKey);
  return label ? t(label) : key;
}

export function getSearchBadgeLabel(key: string, t: SearchTranslator = englishLabels): string {
  const label = searchBadgeLabelMap.get(key as SearchBadgeKey);
  return label ? t(label) : key;
}
