import { describe, expect, it } from "bun:test";
import manifest from "./manifest";
import { APP_ICON_VERSION, DEFAULT_APP_TITLE } from "@/lib/appBranding";

describe("web app manifest", () => {
  it("uses the product name and a German description", () => {
    const result = manifest();
    expect(result.name).toBe(DEFAULT_APP_TITLE);
    expect(result.short_name).toBe(DEFAULT_APP_TITLE);
    expect(result.description).toBe("Webmail für persönliche und gemeinsame Postfächer");
  });

  it("versions every icon URL so installed apps pick up new art", () => {
    const icons = manifest().icons ?? [];
    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) expect(icon.src).toEndWith(`?v=${APP_ICON_VERSION}`);
  });
});
