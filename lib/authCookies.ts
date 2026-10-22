/** Sealed legacy cookies are never read or decrypted. Remove them when encountered. */
export function expireLegacyCookie(request: Request, headers: Headers) {
  if (/(?:^|;\s*)noctua_session=/.test(request.headers.get("cookie") ?? "")) {
    headers.append("set-cookie", "noctua_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
  }
}
