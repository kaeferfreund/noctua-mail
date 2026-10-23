import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { SidebarProvider } from "@/app/components/ui/sidebar";
import ShellUserMenu from "./ShellUserMenu";

afterEach(cleanup);
const noop = () => {};
describe("Admin menu role gating", () => {
  for (const isAdminUser of [false, true]) it(`${isAdminUser ? "opens" : "hides"} Admin with no active mailbox`, async () => {
    const network = spyOn(globalThis, "fetch").mockImplementation(Object.assign(async () => new Response(JSON.stringify({ ok: true, users: [] }), { headers: { "Content-Type": "application/json" } }), { preconnect: globalThis.fetch.preconnect }));
    try {
      let adminOpens = 0;
      const page = render(<Theme><SidebarProvider><ShellUserMenu userEmail="synthetic@example.test" currentAccount={null} isAdminUser={isAdminUser} onOpenSettings={noop} onOpenAdmin={() => { adminOpens++; }} onShowThreadJson={noop} onEvictThreadCache={noop} onLogout={noop} /></SidebarProvider></Theme>);
      fireEvent.keyDown(page.getByRole("button", { name: "User menu" }), { key: "Enter" });
      await page.findByRole("menuitem", { name: "Log out" });
      if (isAdminUser) {
        const admin = page.getByRole("menuitem", { name: "Admin" });
        expect(admin.getAttribute("data-disabled")).toBeNull(); fireEvent.click(admin);
        expect(adminOpens).toBe(1);
      } else expect(page.queryByRole("menuitem", { name: "Admin" })).toBeNull();
      expect(page.queryByRole("dialog")).toBeNull();
      expect(network).not.toHaveBeenCalled();
    } finally { network.mockRestore(); }
  });
});
