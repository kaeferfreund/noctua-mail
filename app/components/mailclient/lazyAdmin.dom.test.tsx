import { describe, expect, it } from "bun:test";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import React from "react";
import dynamic from "next/dynamic";
import { act, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { render } from "@/lib/i18n/testRender";
import { Theme } from "@radix-ui/themes";
import { ThemeProvider } from "next-themes";
import { SidebarProvider } from "../ui/sidebar";
import LazyDialogLoading from "../LazyDialogLoading";

const AdminPanel = dynamic(() => import("../admin/AdminPanel"), {
  ssr: false,
  loading: () => <LazyDialogLoading label="Admin" />
});

const scenario = process.env.NOCTUA_LAZY_ADMIN_TEST;
const scenarios = [
  "non-admin stays cold after idle",
  "cold admin from mailbox gate",
  "cold mailbox creation from mailbox gate",
  "cold admin from user menu without a mailbox",
  "admin idle warm-up",
  "cancel warm-up on unmount",
  "cancel warm-up on role change",
  "QA-014 desktop to mobile preserves unsent invite",
  "QA-014 mobile to desktop preserves unsent invite"
];

// Match lazyAccountSettings.dom.test.tsx: independent Bun processes keep the
// real dynamic imports cold even when other DOM tests import admin modules.
if (!scenario) {
  describe("lazy admin surfaces", () => {
    for (const name of scenarios) it(name, () => {
      const child = Bun.spawnSync([
        process.execPath, "test", "--config=bunfig.dom.toml", fileURLToPath(import.meta.url)
      ], {
        cwd: process.cwd(),
        env: { ...process.env, NOCTUA_LAZY_ADMIN_TEST: name },
        stdout: "pipe", stderr: "pipe"
      });
      expect(child.exitCode, child.stdout.toString() + child.stderr.toString()).toBe(0);
    }, 20000);
  });
} else {
  it(scenario, async () => {
    const require = createRequire(import.meta.url);
    const modulePaths = ["../admin/AdminPanel", "../admin/AdminMailboxes", "../admin/AdminAuditLog"]
      .map(path => require.resolve(path));
    const loaded = () => modulePaths.map(path => Boolean(require.cache[path]));
    const idleTasks = new Map<number, IdleRequestCallback>();
    let nextIdleId = 0;
    let role = scenario.startsWith("non-admin") ? "user" : "admin";
    const originalIdle = window.requestIdleCallback;
    const originalCancelIdle = window.cancelIdleCallback;
    const originalFetch = globalThis.fetch;
    const originalEventSource = globalThis.EventSource;
    const originalWidth = window.innerWidth;
    const originalHeight = window.innerHeight;
    const breakpointScenario = scenario.startsWith("QA-014");
    const startsMobile = scenario.includes("mobile to desktop");
    if (breakpointScenario) {
      window.innerWidth = startsMobile ? 390 : 1440;
      window.innerHeight = startsMobile ? 844 : 900;
    }
    const calls: string[] = [];
    window.requestIdleCallback = callback => {
      const id = ++nextIdleId;
      idleTasks.set(id, callback);
      return id;
    };
    window.cancelIdleCallback = id => { idleTasks.delete(id); };
    globalThis.EventSource = class extends EventTarget {
      close() {}
    } as unknown as typeof EventSource;
    // Exercise the real client/hooks; only browser network transports are replaced.
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      calls.push(url);
      if (url === "/api/auth/me") return Response.json({
        user: { id: "synthetic-user", email: "user@example.test", role },
        accounts: breakpointScenario ? [{ id: "synthetic-account", name: "Synthetic mailbox", email: "user@example.test",
          accessRole: "manager", settings: {},
          imap: { host: "imap.example.test", port: 993, secure: true, user: "user@example.test", password: "" },
          smtp: { host: "smtp.example.test", port: 465, secure: true, user: "user@example.test", password: "" } }] : [],
        accountId: breakpointScenario ? "synthetic-account" : null, mailboxState: breakpointScenario ? "selected" : "none"
      });
      if (url.endsWith("/folders")) return Response.json([{
        id: "synthetic-inbox", accountId: "synthetic-account", name: "Inbox", path: "INBOX", specialUse: "\\Inbox"
      }]);
      return Response.json({ ok: true, users: [], accounts: [], items: [], messages: [],
        total: 0, hasMore: false, topics: [], aliases: [], members: [], mailboxes: [], invites: [], prefs: {} });
    }) as typeof fetch;
    const flushIdle = async () => {
      await act(async () => {
        for (const [id, callback] of [...idleTasks]) {
          idleTasks.delete(id);
          callback({ didTimeout: false, timeRemaining: () => 50 });
        }
      });
    };
    const expectCold = () => expect(loaded()).toEqual([false, false, false]);
    const expectLoading = (view: ReturnType<typeof render>, label: string) => {
      const loading = view.getByRole("status", { name: label });
      expect(loading.getAttribute("aria-busy")).toBe("true");
      expect(loading.className).toContain("fixed inset-0");
      expect(loading.className).toContain("bg-black/40");
      expect(loading.querySelector(".rt-Spinner")).toBeTruthy();
      expect(view.queryByRole("dialog")).toBeNull();
    };
    try {
      expectCold();
      const { default: MailClient } = await import("../MailClient");
      const { default: ShellUserMenu } = await import("../shell/ShellUserMenu");
      expectCold();
      // A stable owner supplies the same callback contract as MailClient, even
      // without a selected mailbox. The menu itself must never mount a panel.
      function Menu({ isAdminUser }: { isAdminUser: boolean }) {
        const [open, setOpen] = React.useState(false);
        return (
        <ThemeProvider attribute="class"><Theme><SidebarProvider>
          <ShellUserMenu userEmail="user@example.test" currentAccount={null} isAdminUser={isAdminUser}
            onOpenSettings={() => {}} onOpenAdmin={() => setOpen(true)} onShowThreadJson={() => {}}
            onEvictThreadCache={() => {}} onLogout={() => {}} />
          {open && isAdminUser && <AdminPanel isAdminUser={isAdminUser} onClose={() => setOpen(false)} />}
        </SidebarProvider></Theme></ThemeProvider>
        );
      }
      const menu = (isAdminUser: boolean) => <Menu isAdminUser={isAdminUser} />;
      const openMenu = (view: ReturnType<typeof render>) => {
        fireEvent.pointerDown(view.getByRole("button", { name: "User menu" }), { button: 0, ctrlKey: false });
      };

      if (scenario === "cold admin from user menu without a mailbox") {
        const view = render(menu(true));
        expectCold();
        openMenu(view);
        const admin = await view.findByRole("menuitem", { name: "Admin" });
        expectCold();
        act(() => { fireEvent.click(admin); });
        expectLoading(view, "Admin");
        await view.findByRole("dialog", { name: "Admin" }, { timeout: 5000 });
        expect(loaded()).toEqual([true, true, true]);
        await waitFor(() => expect(calls).toContain("/api/admin/users"));
        // An already open panel and its entry disappear if admin access is lost.
        view.rerender(menu(false));
        expect(view.queryByRole("dialog")).toBeNull();
        openMenu(view);
        await view.findByRole("menuitem", { name: "Profile & security" });
        expect(view.queryByRole("menuitem", { name: "Admin" })).toBeNull();
        return;
      }

      const view = render(<ThemeProvider attribute="class"><Theme><MailClient /></Theme></ThemeProvider>);
      if (breakpointScenario) {
        if (startsMobile) fireEvent.click(await view.findByRole("button", { name: "Toggle sidebar" }));
        await view.findByRole("button", { name: "User menu" });
        openMenu(view);
        fireEvent.click(await view.findByRole("menuitem", { name: "Admin" }));
        await view.findByRole("dialog", { name: "Admin" }, { timeout: 5000 });
        expect(view.getAllByRole("button", { name: "Close admin" })).toHaveLength(1);
        fireEvent.click(view.getByRole("button", { name: "Invites" }));
        const name = await view.findByLabelText("Name", { exact: true });
        fireEvent.change(name, { target: { value: "Synthetic unsent invite" } });
        await act(async () => {
          window.innerWidth = startsMobile ? 1440 : 390;
          window.innerHeight = startsMobile ? 900 : 844;
          window.dispatchEvent(new Event("resize"));
        });
        await waitFor(() => {
          const admin = view.getByRole("dialog", { name: "Admin" });
          expect(admin.getAttribute("data-slot")).toBe(startsMobile ? null : "sheet-content");
          expect(view.getAllByRole("button", { name: "Close admin" })).toHaveLength(1);
          expect(view.getByRole("button", { name: "Invites" }).getAttribute("aria-pressed")).toBe("true");
          expect((view.getByLabelText("Name", { exact: true }) as HTMLInputElement).value).toBe("Synthetic unsent invite");
        });
        expect(calls.filter(url => url === "/api/admin/users")).toHaveLength(1);
        fireEvent.click(view.getByRole("button", { name: "Close admin" }));
        await waitFor(() => expect(view.queryByRole("dialog", { name: "Admin" })).toBeNull());
        return;
      }
      await view.findByRole("heading", { name: "No mailbox yet" });
      await waitFor(() => expect(idleTasks.size).toBe(role === "admin" ? 2 : 1));
      expectCold();
      expect(view.queryByRole("dialog")).toBeNull();

      if (scenario === "cancel warm-up on unmount") {
        expect(idleTasks.size).toBe(2);
        view.unmount();
        expect(idleTasks.size).toBe(0);
        await flushIdle();
        expectCold();
        return;
      }
      if (scenario === "cancel warm-up on role change") {
        expect(idleTasks.size).toBe(2);
        role = "user";
        // The retry resolves identity asynchronously; flush its passive effects
        // before checking cancellation, rather than only observing gate markup.
        await act(async () => { fireEvent.click(view.getByRole("button", { name: "Retry" })); });
        await waitFor(() => {
          expect(view.queryByRole("button", { name: "Admin" })).toBeNull();
          expect(idleTasks.size).toBe(1);
        });
      }
      if (scenario.startsWith("non-admin") || scenario === "cancel warm-up on role change") {
        expect(view.queryByRole("button", { name: "Admin" })).toBeNull();
        expect(view.queryByRole("button", { name: "Add a mailbox" })).toBeNull();
        await flushIdle();
        await waitFor(() => expect(Boolean(require.cache[require.resolve("../AccountSettingsModal")])).toBe(true));
        expectCold();
        expect(calls.some(url => url.startsWith("/api/admin/"))).toBe(false);
        view.unmount();
        const userMenu = render(menu(false));
        openMenu(userMenu);
        await userMenu.findByRole("menuitem", { name: "Profile & security" });
        expect(userMenu.queryByRole("menuitem", { name: "Admin" })).toBeNull();
        expect(userMenu.queryByRole("dialog")).toBeNull();
        expectCold();
        return;
      }
      if (scenario === "admin idle warm-up") {
        expect(idleTasks.size).toBe(2);
        await flushIdle();
        await waitFor(() => expect(loaded()).toEqual([true, true, true]));
        expect(view.queryByRole("dialog")).toBeNull();
        expect(calls.some(url => url.startsWith("/api/admin/"))).toBe(false);
      }
      if (scenario === "cold mailbox creation from mailbox gate") {
        act(() => { fireEvent.click(view.getByRole("button", { name: "Add a mailbox" })); });
        const loading = view.getByRole("status", { name: "Add mailbox" });
        expect(loading.getAttribute("aria-busy")).toBe("true");
        const loadingDialog = view.getByRole("dialog", { name: "Add mailbox" });
        expect(loadingDialog.contains(loading)).toBe(true);
        expect(loadingDialog.className).toContain("sm:max-w-3xl");
        expect(loading.className).toContain("h-[75dvh] max-h-[75dvh]");
        expect(loading.closest(".radix-themes")).toBeTruthy();
        expect(loading.querySelector(".rt-Spinner")).toBeTruthy();
        await view.findByRole("dialog", { name: "Create mailbox" }, { timeout: 5000 });
        expect(view.queryByRole("status", { name: "Add mailbox" })).toBeNull();
        expect(loaded()).toEqual([false, true, false]);
        expect(view.getByText("Creates an ownerless mailbox. Grant members after creation.")).toBeTruthy();
        fireEvent.click(view.getAllByRole("button", { name: "Close" })[0]);
      } else {
        act(() => { fireEvent.click(view.getByRole("button", { name: "Admin" })); });
        if (scenario === "cold admin from mailbox gate") expectLoading(view, "Admin");
        await view.findByRole("dialog", { name: "Admin" }, { timeout: 5000 });
        expect(loaded()).toEqual([true, true, true]);
        await waitFor(() => expect(calls).toContain("/api/admin/users"));
        fireEvent.click(view.getByRole("button", { name: "Close admin" }));
      }
      await waitFor(() => expect(view.queryByRole("dialog")).toBeNull());
    } finally {
      cleanup();
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
      window.requestIdleCallback = originalIdle;
      window.cancelIdleCallback = originalCancelIdle;
      globalThis.fetch = originalFetch;
      globalThis.EventSource = originalEventSource;
      window.innerWidth = originalWidth;
      window.innerHeight = originalHeight;
    }
  }, 15000);
}
