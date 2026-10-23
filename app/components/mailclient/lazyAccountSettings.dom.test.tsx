import { describe, expect, it } from "bun:test";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import React from "react";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { ThemeProvider } from "next-themes";

const scenario = process.env.NOCTUA_LAZY_SETTINGS_TEST;
const scenarios = ["cold open", "idle warm-up", "cancel warm-up"];

// Other DOM tests import the real modal eagerly. A fresh Bun process gives each
// scenario a genuinely cold module cache without mocking next/dynamic or tabs.
if (!scenario) {
  describe("lazy account settings", () => {
    for (const name of scenarios) it(name, () => {
      const child = Bun.spawnSync([
        process.execPath, "test", "--config=bunfig.dom.toml", fileURLToPath(import.meta.url)
      ], {
        cwd: process.cwd(),
        env: { ...process.env, NOCTUA_LAZY_SETTINGS_TEST: name },
        stdout: "pipe", stderr: "pipe"
      });
      expect(child.exitCode, child.stdout.toString() + child.stderr.toString()).toBe(0);
    }, 20000);
  });
} else {
  it(scenario, async () => {
    const require = createRequire(import.meta.url);
    const modalPath = require.resolve("../AccountSettingsModal");
    const loaded = () => Boolean(require.cache[modalPath]);
    const idleTasks = new Map<number, IdleRequestCallback>();
    let nextIdleId = 0;
    const originalIdle = window.requestIdleCallback;
    const originalCancelIdle = window.cancelIdleCallback;
    const originalFetch = globalThis.fetch;
    const originalEventSource = globalThis.EventSource;
    const calls: string[] = [];
    window.requestIdleCallback = (callback) => {
      const id = ++nextIdleId;
      idleTasks.set(id, callback);
      return id;
    };
    window.cancelIdleCallback = (id) => { idleTasks.delete(id); };
    // Keep the real client/hooks, replacing only browser network transports.
    globalThis.EventSource = class extends EventTarget {
      close() {}
    } as unknown as typeof EventSource;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      calls.push(url);
      if (url === "/api/auth/me") return Response.json({
        user: { id: "synthetic-user", email: "user@example.test", role: "admin" },
        accounts: [{ id: "synthetic-account", name: "Synthetic mailbox", email: "user@example.test",
          accessRole: "manager", settings: {},
          imap: { host: "imap.example.test", port: 993, secure: true, user: "user@example.test", password: "" },
          smtp: { host: "smtp.example.test", port: 465, secure: true, user: "user@example.test", password: "" } }],
        accountId: "synthetic-account", mailboxState: "selected"
      });
      if (url.endsWith("/folders")) return Response.json([{
        id: "synthetic-inbox", accountId: "synthetic-account", name: "Inbox", path: "INBOX", specialUse: "\\Inbox"
      }]);
      return Response.json({ ok: true, items: [], messages: [], total: 0, hasMore: false,
        topics: [], aliases: [], members: [], mailboxes: [], prefs: {} });
    }) as typeof fetch;
    try {
      expect(loaded()).toBe(false);
      const { default: MailClient } = await import("../MailClient");
      expect(loaded()).toBe(false);
      const view = render(<ThemeProvider attribute="class"><Theme><MailClient /></Theme></ThemeProvider>);
      await view.findByRole("button", { name: "User menu" });
      expect(loaded()).toBe(false);
      expect(view.queryByRole("dialog")).toBeNull();
      expect(calls.some(url => url.endsWith("/prefs"))).toBe(false);

      if (scenario === "cancel warm-up") {
        view.unmount();
        expect(idleTasks.size).toBe(0);
        expect(loaded()).toBe(false);
        return;
      }
      if (scenario === "idle warm-up") {
        await act(async () => {
          for (const [id, callback] of [...idleTasks]) {
            idleTasks.delete(id);
            callback({ didTimeout: false, timeRemaining: () => 50 });
          }
        });
        await waitFor(() => expect(loaded()).toBe(true));
        // Importing the module must not mount any settings tab or read its data.
        expect(view.queryByRole("dialog")).toBeNull();
        expect(calls.some(url => url.endsWith("/prefs"))).toBe(false);
      }
      fireEvent.pointerDown(view.getByRole("button", { name: "User menu" }), { button: 0, ctrlKey: false });
      const settings = await view.findByRole("menuitem", { name: "Settings" });
      act(() => { fireEvent.click(settings); });
      if (scenario === "cold open") {
        const loading = view.getByRole("status", { name: "Settings" });
        expect(loading.getAttribute("aria-busy")).toBe("true");
        expect(loading.textContent).toBe("");
        expect(view.queryByRole("dialog")).toBeNull();
      }
      const accountTab = await view.findByRole("tab", { name: "Account" }, { timeout: 5000 });
      expect(accountTab.getAttribute("aria-selected")).toBe("true");
      expect(loaded()).toBe(true);
      fireEvent.mouseDown(view.getByRole("tab", { name: "Signatures" }), { button: 0, ctrlKey: false });
      await waitFor(() => expect(view.getByRole("tab", { name: "Signatures" }).getAttribute("aria-selected")).toBe("true"));
      fireEvent.click(view.getAllByRole("button", { name: "Close" })[0]);
      await waitFor(() => expect(view.queryByRole("dialog")).toBeNull());
    } finally {
      cleanup();
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
      window.requestIdleCallback = originalIdle;
      window.cancelIdleCallback = originalCancelIdle;
      globalThis.fetch = originalFetch;
      globalThis.EventSource = originalEventSource;
    }
  }, 15000);
}
