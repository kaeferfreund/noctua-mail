/**
 * Client crash reports (POST /api/client-errors). Shared by the browser reporter,
 * which builds and truncates the report, and the route, which accepts only these
 * fields and truncates again. Never carries a search text, mail content or tokens; query
 * values only in the blank-screen context (deep-link ids and folder, `q` emptied).
 */
export const CLIENT_ERROR_SOURCES = ["boundary", "global", "error", "unhandledrejection", "watchdog"] as const;
export type ClientErrorSource = (typeof CLIENT_ERROR_SOURCES)[number];

export type ClientErrorReport = {
  source: ClientErrorSource;
  kind?: "overlay-back-fallback" | "blank-screen";
  count?: number;
  /** Blank-screen watchdog only: the context of an app root that stayed empty. */
  blank?: BlankScreenContext;
  message: string;
  stack: string;
  /** Next.js digest of a server-rendered error, if any. */
  digest: string;
  path: string;
  /** Query parameter names only; values such as a search text `q` stay in the browser. */
  queryKeys: string[];
  build: string;
  userAgent: string;
  /** iOS home-screen app or another standalone PWA window. */
  standalone: boolean;
};

export type BlankScreenContext = {
  /** Search of the location without the value of a search text `q`; never the fragment. */
  search: string;
  /** Keys of `history.state`, never its values. */
  historyStateKeys: string[];
  visibilityState: string;
  /** `performance.getEntriesByType("navigation")[0].type`: navigate, reload, back_forward, … */
  navigationType: string;
  /** What started the check: load, pageshow or popstate. */
  trigger: string;
};

export const CLIENT_ERROR_LIMITS = { message: 1024, stack: 4096, digest: 64, path: 256, queryKeys: 24, build: 128, userAgent: 512, search: 512, stateKeys: 24 } as const;

// Tabs and newlines stay (stack frames); other control characters do not reach the log.
const clip = (value: unknown, limit: number) => typeof value === "string" ? value.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").slice(0, limit) : "";

/** Path plus parameter names of a location; the search values are dropped. */
export function clientErrorLocation(href: string): Pick<ClientErrorReport, "path" | "queryKeys"> {
  const url = new URL(href, "http://localhost");
  return { path: url.pathname, queryKeys: [...new Set(url.searchParams.keys())] };
}

/** A search with the value of a search text `q` dropped; deep-link ids are opaque and stay. */
export function clientErrorSearch(search: string): string {
  const params = new URLSearchParams(search);
  if (params.has("q")) params.set("q", "");
  const value = params.toString();
  return value ? `?${value}` : "";
}

const KEY = /^[A-Za-z0-9_.-]{1,64}$/;
const word = (value: unknown) => typeof value === "string" && /^[a-z_-]{1,32}$/.test(value) ? value : "";

function sanitizeBlankScreen(input: unknown): BlankScreenContext | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const raw = input as Record<string, unknown>;
  return {
    search: clientErrorSearch(clip(raw.search, CLIENT_ERROR_LIMITS.search)),
    historyStateKeys: (Array.isArray(raw.historyStateKeys) ? raw.historyStateKeys : [])
      .filter((key): key is string => typeof key === "string" && KEY.test(key)).slice(0, CLIENT_ERROR_LIMITS.stateKeys),
    visibilityState: word(raw.visibilityState), navigationType: word(raw.navigationType), trigger: word(raw.trigger)
  };
}

/** The accepted report, or null when the body is not a report. Unknown fields are dropped. */
export function sanitizeClientErrorReport(input: unknown): ClientErrorReport | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const raw = input as Record<string, unknown>;
  const source = CLIENT_ERROR_SOURCES.find(item => item === raw.source);
  const message = clip(raw.message, CLIENT_ERROR_LIMITS.message);
  if (!source || !message) return null;
  const blank = raw.kind === "blank-screen" ? sanitizeBlankScreen(raw.blank) : null;
  return {
    source, message,
    ...(blank ? { kind: "blank-screen" as const, blank } : {}),
    ...(raw.kind === "overlay-back-fallback" && Number.isSafeInteger(raw.count) && Number(raw.count) > 0
      ? { kind: "overlay-back-fallback" as const, count: Math.min(Number(raw.count), 100_000) } : {}),
    stack: raw.kind === "overlay-back-fallback" || blank ? "" : clip(raw.stack, CLIENT_ERROR_LIMITS.stack),
    digest: clip(raw.digest, CLIENT_ERROR_LIMITS.digest),
    path: clip(raw.path, CLIENT_ERROR_LIMITS.path).split("?")[0],
    queryKeys: (Array.isArray(raw.queryKeys) ? raw.queryKeys : [])
      .filter((key): key is string => typeof key === "string" && /^[A-Za-z0-9_.-]{1,32}$/.test(key))
      .slice(0, CLIENT_ERROR_LIMITS.queryKeys),
    build: clip(raw.build, CLIENT_ERROR_LIMITS.build),
    userAgent: clip(raw.userAgent, CLIENT_ERROR_LIMITS.userAgent),
    standalone: raw.standalone === true
  };
}
