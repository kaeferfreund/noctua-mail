import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent } from "@testing-library/react";
import { render } from "@/lib/i18n/testRender";
import { Theme } from "@radix-ui/themes";
import { SidebarProvider } from "@/app/components/ui/sidebar";
import { MOBILE_QUERY } from "@/app/hooks/use-mobile";
import ShellUserMenu from "./ShellUserMenu";

afterEach(cleanup);
const noop = () => {};
// The drawer footer leaves no room to the right of the trigger on phones.
describe("User menu placement", () => {
  for (const phone of [true, false]) it(`opens ${phone ? "above the trigger with 44px rows on phones" : "to the right on desktop"}`, async () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({ matches: phone && query === MOBILE_QUERY, media: query,
      onchange: null, addListener() {}, removeListener() {}, dispatchEvent: () => true,
      addEventListener() {}, removeEventListener() {} })) as typeof window.matchMedia;
    try {
      const page = render(<Theme><SidebarProvider><ShellUserMenu userEmail="synthetic@example.test" currentAccount={null} isAdminUser onOpenSettings={noop} onOpenAdmin={noop} onShowThreadJson={noop} onEvictThreadCache={noop} onLogout={noop} /></SidebarProvider></Theme>);
      fireEvent.keyDown(page.getByRole("button", { name: "User menu" }), { key: "Enter" });
      const menu = await page.findByRole("menu");
      expect(menu.getAttribute("data-phone")).toBe(phone ? "true" : null);
      expect(menu.getAttribute("data-side")).toBe(phone ? "top" : "right");
      expect(menu.getAttribute("data-align")).toBe("end");
      expect(menu.className).toContain("max-md:max-w-[calc(100vw-2rem)]");
      const rows = [...menu.querySelectorAll('[role="menuitem"], [role="menuitemradio"]')];
      expect(rows.length).toBe(9);
      for (const row of rows) expect(row.className).toContain("max-md:min-h-11");
    } finally { window.matchMedia = original; }
  });
});
