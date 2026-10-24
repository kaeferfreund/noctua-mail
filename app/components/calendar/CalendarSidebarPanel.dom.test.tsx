import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { cleanup, render, within } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { I18nTestProvider } from "@/lib/i18n/testRender";
import type { UiLocale } from "@/lib/i18n/config";
import CalendarSidebarPanel from "./CalendarSidebarPanel";

afterEach(cleanup);

describe("calendar sidebar panel", () => {
  for (const [locale, title, openWindow, close] of [
    ["de", "Kalender", "Kalender in neuem Fenster öffnen", "Kalender schließen"],
    ["en", "Calendar", "Open calendar in window", "Close calendar"]
  ] as const satisfies readonly (readonly [UiLocale, string, string, string])[]) it(`labels its header in ${locale}`, () => {
    const network = spyOn(globalThis, "fetch").mockImplementation(Object.assign(
      async () => Response.json({ items: [], conflicts: [] }),
      { preconnect: globalThis.fetch.preconnect }
    ));
    try {
      const view = render(<I18nTestProvider locale={locale}><Theme>
        <CalendarSidebarPanel accountId="synthetic-account" onClose={() => {}} />
      </Theme></I18nTestProvider>);
      const panel = view.container;
      expect(within(panel).getByRole("heading", { name: title })).toBeTruthy();
      expect(within(panel).getByRole("button", { name: openWindow })).toBeTruthy();
      expect(within(panel).getByRole("button", { name: close })).toBeTruthy();
    } finally { network.mockRestore(); }
  });
});
