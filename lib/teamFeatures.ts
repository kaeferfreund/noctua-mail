/** Server team features require DB credentials; `both` is the deprecated DB alias. */
export function teamFeaturesSupported(env: Record<string, string | undefined> = process.env): boolean {
  const storage = env.IMAP_CREDENTIALS_STORAGE?.trim().toLowerCase() || "db";
  return env.NOCTUA_DESKTOP_MODE !== "true" && (storage === "db" || storage === "both");
}
