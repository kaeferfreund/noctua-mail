"use client";

import { AdminApiError, adminRequest, jsonMutation, type AdminFetch } from "@/app/hooks/useAdminApi";
import { outreachApiPath } from "../useOutreachStatus";

/**
 * Thin REST client for one mailbox's addon routes (doc/ADDON-OUTREACH.md). It reuses the
 * settings/admin request seam, so failures arrive as `AdminApiError` with status and code;
 * `outreachErrorKey` turns them into one of the `outreach.errors.*` messages.
 */
export type OutreachApi = {
  get<T>(path: string, query?: Record<string, string | number | boolean | null | undefined>): Promise<T>;
  send<T>(method: "POST" | "PATCH" | "PUT" | "DELETE", path: string, body?: unknown): Promise<T>;
};

export function createOutreachApi(accountId: string, fetchImpl: AdminFetch = fetch): OutreachApi {
  return {
    get(path, query) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(query ?? {})) {
        if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
      }
      const search = params.toString();
      return adminRequest(fetchImpl, `${outreachApiPath(accountId, path)}${search ? `?${search}` : ""}`);
    },
    send(method, path, body) {
      // The DELETE routes accept only an empty body; every other write is a JSON write.
      return adminRequest(fetchImpl, outreachApiPath(accountId, path), method === "DELETE" ? { method } : jsonMutation(method, body ?? {}));
    }
  };
}

export type OutreachErrorKey =
  | "errors.disabled" | "errors.conflict" | "errors.invalid" | "errors.forbidden" | "errors.notFound"
  | "errors.session" | "errors.rateLimited" | "errors.offline" | "errors.generic";

/** Maps a failed request to a translated message key plus the server's own text where it helps (400/409). */
export function outreachErrorKey(error: unknown): { key: OutreachErrorKey; detail: string | null } {
  if (!(error instanceof AdminApiError)) return { key: error instanceof TypeError ? "errors.offline" : "errors.generic", detail: null };
  const detail = error.message && !/^Request failed/.test(error.message) ? error.message : null;
  if (error.code === "outreach_disabled") return { key: "errors.disabled", detail: null };
  switch (error.status) {
    case 400: return { key: "errors.invalid", detail };
    case 401: return { key: "errors.session", detail: null };
    case 403: return { key: "errors.forbidden", detail: null };
    case 404: return { key: "errors.notFound", detail: null };
    case 409: return { key: "errors.conflict", detail };
    case 429: return { key: "errors.rateLimited", detail: null };
    default: return { key: "errors.generic", detail: null };
  }
}

export { AdminApiError };
