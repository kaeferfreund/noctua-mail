/** Untrusted correlation IDs must be safe before logging or worker forwarding. */
export function getRequestClientId(request: Request): string | undefined {
  const value = request.headers.get("x-noctua-client") ?? "";
  return /^[A-Za-z0-9_-]{1,64}$/.test(value) ? value : undefined;
}
