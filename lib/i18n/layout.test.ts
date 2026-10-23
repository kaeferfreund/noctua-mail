import { expect, test } from "bun:test";

for (const [input, locale, label, description] of [
  [{}, "de", "Sprache", "Moderner Webmail-Client als Prototyp"],
  [{ acceptLanguage: "en-US,en;q=0.8" }, "en", "Language", "Modern webmail client prototype"],
  [{ cookie: "en", acceptLanguage: "de" }, "en", "Language", "Modern webmail client prototype"],
  [{ uiLocale: "de", cookie: "en", acceptLanguage: "en" }, "de", "Sprache", "Moderner Webmail-Client als Prototyp"]
] as const) test(`root SSR uses the resolved locale consistently: ${JSON.stringify(input)}`, async () => {
  const child = Bun.spawn([process.execPath, "tests/helpers/i18nSsr.tsx", JSON.stringify(input)], { cwd: process.cwd(), stdout: "pipe", stderr: "pipe", env: process.env });
  const [output, errors, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  expect(errors).toBe("");
  expect(code).toBe(0);
  const { html, metadata } = JSON.parse(output);
  expect(html).toContain(`<html lang="${locale}">`);
  expect(html).toContain(`data-locale="${locale}" data-zone="Europe/Berlin">${label}</p>`);
  expect(metadata.description).toBe(description);
  expect(metadata.manifest).toBe("/manifest.webmanifest");
});
