import { expect, test } from "bun:test";
import { teamFeaturesSupported } from "./teamFeatures";

test("team features require server DB credentials and reject desktop/cookie runtime", () => {
  for (const mode of [undefined, "db", "both", " DB "]) {
    expect(teamFeaturesSupported({ IMAP_CREDENTIALS_STORAGE: mode })).toBe(true);
    expect(teamFeaturesSupported({ IMAP_CREDENTIALS_STORAGE: mode, NOCTUA_DESKTOP_MODE: "true" })).toBe(false);
  }
  for (const mode of ["cookie", "unknown"]) expect(teamFeaturesSupported({ IMAP_CREDENTIALS_STORAGE: mode })).toBe(false);
});
