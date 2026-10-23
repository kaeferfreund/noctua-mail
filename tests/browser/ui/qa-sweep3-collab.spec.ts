import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { evidencePath, recordQa, signInQa } from "./qaRound2Session";
import { catalogs } from "./qaSweep3";

for (const locale of ["de", "en"] as const) test.describe(`QA-212 ${locale}`, () => {
  const copy = catalogs[locale];
  test.use({ locale: locale === "de" ? "de-DE" : "en-GB" });
  test(`QA-212 the assignee list shows the current user once (${locale})`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 }); await page.emulateMedia({ colorScheme: "light" });
    await signInQa(page);
    // Jo joins as a second member so the list shows the current user next to others.
    const [, jo] = JSON.parse(readFileSync(process.env.QA_SHELL_SEED_FILE!, "utf8"));
    const joined = await page.request.put(`/api/accounts/qa-shared/members/${encodeURIComponent(jo.id)}`, { headers: { origin: new URL(page.url()).origin }, data: { role: "editor" } });
    expect(joined.status()).toBe(200);
    await page.reload();
    await page.getByText(/^QA long subject checks wrapping/).first().click();
    await page.getByRole("combobox", { name: copy.Collaboration.assignee.label, exact: true }).click();
    const options = (await page.getByRole("option").allInnerTexts()).map(text => text.trim());
    const self = copy.Collaboration.assignee.meNamed.replace("{name}", "Synthetic Alex");
    expect(options).toContain(self);
    expect(options.filter(text => text.includes("Synthetic Alex"))).toEqual([self]);
    expect(options).toEqual([copy.Collaboration.assignee.unassigned, self, "Synthetic Jo"]);
    await page.screenshot({ path: evidencePath(`QA-212-assignee-${locale}-1440-light.png`) });
    await page.getByRole("option", { name: self, exact: true }).click();
    await expect(page.getByRole("combobox", { name: copy.Collaboration.assignee.label, exact: true })).toContainText("Synthetic Alex");
    recordQa(`QA-212-${locale}`, { options });
  });
});
