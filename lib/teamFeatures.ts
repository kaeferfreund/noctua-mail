// superseded by feat/team-auth's lib/teamFeatures.ts on merge
export function teamFeaturesSupported(env: Record<string, string | undefined> = process.env): boolean {
  const storage = env.IMAP_CREDENTIALS_STORAGE?.trim().toLowerCase() || "db";
  return env.NOCTUA_DESKTOP_MODE !== "true" && (storage === "db" || storage === "both");
}
