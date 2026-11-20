/**
 * Codes of the shared request body limits (app/api/_helpers/readJsonBody.ts)
 * and the Notifications message key the client shows for them.
 */
export const REQUEST_BODY_TOO_LARGE = "request_body_too_large";
export const REQUEST_BODY_TIMEOUT = "request_body_timeout";

export type RequestBodyErrorKey = "requestBodyTooLarge" | "requestBodyTimeout";

export function requestBodyErrorKey(status: number, code?: unknown): RequestBodyErrorKey | null {
  if (code === REQUEST_BODY_TOO_LARGE || status === 413) return "requestBodyTooLarge";
  if (code === REQUEST_BODY_TIMEOUT) return "requestBodyTimeout";
  return null;
}
