/** Public, version-independent URL state for the single-page mail shell. */
export const SETTINGS_SECTIONS = ["account", "identities", "signatures", "preferences", "categorization", "calendar", "topics", "translation", "mcp", "recipient-aliases", "members"] as const;
export const ADMIN_SECTIONS = ["users", "mailboxes", "invites", "audit"] as const;
export const GROUPS = ["none", "date", "week", "sender", "domain", "year", "folder", "event"] as const;
export const PANELS = ["process", "exception", "reminder", "calendar", "mail-check"] as const;
export const VIEWS = ["virtual:focused", "virtual:action-queue", "virtual:invite-deck", "virtual:assigned-to-me", "virtual:unassigned", "virtual:open"] as const;
export type DeepLinkState = {
  accountId: string;
  folderId: string;
  messageId: string;
  query: string;
  scope: "folder" | "all";
  view: (typeof VIEWS)[number] | null;
  group: (typeof GROUPS)[number];
  badges: string[];
  fields: string[];
  settings: (typeof SETTINGS_SECTIONS)[number] | null;
  admin: (typeof ADMIN_SECTIONS)[number] | null;
  security: boolean;
  panel: (typeof PANELS)[number] | null;
  calendar: boolean;
  compose: boolean;
};
export const FIELD_KEYS = ["sender", "participants", "subject", "body", "attachments"];
export const BADGE_KEYS = ["unread", "unanswered", "flagged", "todo", "calendar", "attachments", "newsletter", "notification", "transactional", "ai-modified"];
export function emptyDeepLink(): DeepLinkState {
  return { accountId: "", folderId: "", messageId: "", query: "", scope: "folder", view: null,
    group: "date", badges: [], fields: [...FIELD_KEYS], settings: null, admin: null, security: false,
    panel: null, calendar: false, compose: false };
}
function member<T extends string>(values: readonly T[], value: string | null): T | null {
  return values.includes(value as T) ? value as T : null;
}
/** The parameter determines the prefix; ~ escapes every other (including RFC) ID. */
export function encodeDeepLinkId(id: string, prefix: "acc" | "imap"): string {
  const hex = id.match(new RegExp(`^${prefix}-([0-9a-f]{24})$`))?.[1];
  if (!hex) return `~${id}`;
  const bytes = hex.match(/../g)!.map(byte => String.fromCharCode(parseInt(byte, 16))).join("");
  return btoa(bytes).replace(/\+/g, "-").replace(/\//g, "_");
}
function decodeDeepLinkId(value: string, prefix: "acc" | "imap"): string {
  if (value.startsWith("~")) return value.slice(1);
  if (!/^[A-Za-z0-9_-]{16}$/.test(value)) return "";
  const bytes = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  return `${prefix}-${Array.from(bytes, byte => byte.charCodeAt(0).toString(16).padStart(2, "0")).join("")}`;
}
export function parseDeepLink(search: string): DeepLinkState {
  const p = new URLSearchParams(search);
  const view = member(VIEWS, p.get("view"));
  const accountId = decodeDeepLinkId(p.get("a") ?? "", "acc");
  const folder = p.get("f");
  const folderId = folder === null ? "" : folder.startsWith("~:") ? folder.slice(2)
    : accountId ? `${accountId}:${folder.startsWith("~~") ? folder.slice(1) : folder}` : "";
  return { ...emptyDeepLink(), accountId, folderId,
    // Notifications may carry RFC Message-ID; the authorized resolver supports both.
    messageId: decodeDeepLinkId(p.get("m") ?? "", "imap"), query: p.get("q") ?? "",
    scope: view || p.get("s") === "all" ? "all" : "folder", view,
    group: member(GROUPS, p.get("g")) ?? "date",
    badges: BADGE_KEYS.filter(key => p.get("filter")?.split(",").includes(key)),
    fields: p.has("fields") ? FIELD_KEYS.filter(key => p.get("fields")!.split(",").includes(key)) : [...FIELD_KEYS],
    settings: member(SETTINGS_SECTIONS, p.get("settings")), admin: member(ADMIN_SECTIONS, p.get("admin")),
    security: p.get("security") === "1", panel: member(PANELS, p.get("panel")),
    calendar: p.get("calendar") === "1", compose: p.has("c") };
}
const OWNED_PARAMS = ["a", "f", "m", "s", "g", "q", "view", "filter", "fields", "settings", "admin", "security", "panel", "calendar", "c"];
export function serializeDeepLink(state: DeepLinkState, current = "/"): string {
  const url = new URL(current, "http://localhost");
  OWNED_PARAMS.forEach(key => url.searchParams.delete(key));
  const put = (key: string, value: string | null | false) => { if (value) url.searchParams.set(key, value); };
  put("a", state.accountId && encodeDeepLinkId(state.accountId, "acc"));
  if (state.folderId) {
    const relative = state.accountId && state.folderId.startsWith(`${state.accountId}:`) ? state.folderId.slice(state.accountId.length + 1) : null;
    url.searchParams.set("f", relative === null ? `~:${state.folderId}` : relative.startsWith("~") ? `~${relative}` : relative);
  }
  put("m", state.messageId && encodeDeepLinkId(state.messageId, "imap"));
  put("s", state.scope === "all" && "all"); put("q", state.query); put("view", state.view);
  put("g", state.group !== "date" && state.group);
  put("filter", BADGE_KEYS.filter(key => state.badges.includes(key)).join(","));
  if (FIELD_KEYS.some(key => !state.fields.includes(key))) url.searchParams.set("fields", FIELD_KEYS.filter(key => state.fields.includes(key)).join(","));
  put("settings", state.settings); put("admin", state.admin); put("security", state.security && "1");
  put("panel", state.panel); put("calendar", state.calendar && "1");
  // An outgoing link may reopen a blank composer; never serialize its draft or recipients.
  put("c", state.compose && "mailto:");
  return `${url.pathname}${url.search}${url.hash}`;
}
export function deepLinkHistoryMode(previous: DeepLinkState, next: DeepLinkState, keyboard = false): "push" | "replace" {
  // A cold mailbox can initially have no folders until its first sync completes.
  // Discovering its default folder enriches the existing mailbox entry.
  if (previous.accountId && !previous.folderId && next.folderId && previous.accountId === next.accountId &&
    serializeDeepLink({ ...previous, folderId: next.folderId }) === serializeDeepLink(next)) return "replace";
  // Virtual views auto-clear once a query or badge filter takes over.
  if (previous.view && !next.view && (next.query.trim() || next.badges.length) &&
    serializeDeepLink({ ...previous, view: null }) === serializeDeepLink(next)) return "replace";
  const continuous = (s: DeepLinkState) => ({ ...s, query: "", messageId: "" });
  if (JSON.stringify(continuous(previous)) === JSON.stringify(continuous(next)) && (keyboard || previous.messageId === next.messageId)) return "replace";
  return "push";
}
/** A membership list is a client-side guard only; routes still authorize every request. */
export function authorizeDeepLink(target: DeepLinkState, accountIds: string[], fallback: string): { state: DeepLinkState; forbidden: boolean } {
  if (!target.accountId || accountIds.includes(target.accountId)) return { state: { ...target, accountId: target.accountId || fallback }, forbidden: false };
  return { state: { ...emptyDeepLink(), accountId: fallback }, forbidden: true };
}

/** Uses the message's own identity even in a detached reader or a different list. */
export function messageDeepLink(message: { accountId: string; id: string; folderId: string }, origin: string): string {
  return new URL(serializeDeepLink({ ...emptyDeepLink(), accountId: message.accountId, folderId: message.folderId, messageId: message.id }), origin).href;
}

/** Warm service-worker clicks carry the same compact URL as cold notification opens. */
export function notificationDeepLink(payload: { url?: unknown }): DeepLinkState {
  if (typeof payload.url === "string") {
    try { return parseDeepLink(new URL(payload.url, "http://localhost").search); } catch { /* Ignore malformed optional URL. */ }
  }
  return emptyDeepLink();
}
