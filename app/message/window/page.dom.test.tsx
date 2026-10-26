import { afterEach, expect, test } from "bun:test";
import { act, cleanup, waitFor } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { SearchParamsContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { render } from "@/lib/i18n/testRender";
import { SENDER_SETTINGS_STORAGE_KEY } from "@/lib/ui/senderSettings";
import MessageWindowPage from "./page";

const originalFetch = globalThis.fetch;
afterEach(() => { cleanup(); globalThis.fetch = originalFetch; });

test("an already open detached reader reloads changed preferences and retries marking once", async () => {
  const message = { id: "synthetic", accountId: "synthetic", folderId: "synthetic:INBOX", subject: "Synthetic detached mail",
    from: "sender@example.test", to: "reader@example.test", body: "Synthetic body", date: "2026-10-26", dateValue: 0, preview: "", seen: false };
  let mode = "never", attempts = 0;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/prefs")) return Response.json({ prefs: { reading: { autoMarkRead: mode } } });
    if (url === "/api/accounts") return Response.json([{ id: "synthetic", accessRole: "editor", settings: {} }]);
    if (url.endsWith("/folders")) return Response.json([{ id: "synthetic:INBOX", accountId: "synthetic", name: "INBOX" }]);
    if (url.endsWith("/flags")) {
      attempts++;
      return attempts === 1 ? Response.json({ message: "Synthetic failure" }, { status: 500 }) : Response.json({ flags: ["\\Seen"] });
    }
    return Response.json({ message });
  }) as typeof fetch;
  const page = render(<Theme><SearchParamsContext.Provider value={new URLSearchParams({ accountId: "synthetic", messageId: "synthetic" })}>
    <MessageWindowPage />
  </SearchParamsContext.Provider></Theme>);
  await page.findByText("Synthetic detached mail");
  expect(attempts).toBe(0);
  mode = "immediate";
  act(() => { window.dispatchEvent(new StorageEvent("storage", { key: SENDER_SETTINGS_STORAGE_KEY, newValue: JSON.stringify({ accountId: "synthetic" }) })); });
  await waitFor(() => expect(attempts).toBe(1));
  expect(page.queryByText("Synthetic failure")).toBeNull();
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 1200)); });
  await waitFor(() => expect(attempts).toBe(2));
  expect(page.queryByText("Synthetic failure")).toBeNull();
});

test("an open detached reader also follows a changed inherited mailbox default", async () => {
  let mode = "never", attempts = 0;
  const message = { id: "synthetic", accountId: "synthetic", folderId: "synthetic:INBOX", subject: "Synthetic inherited mail",
    from: "sender@example.test", to: "reader@example.test", body: "Synthetic body", date: "2026-10-26", dateValue: 0, preview: "", seen: false };
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/prefs")) return Response.json({ prefs: {} });
    if (url === "/api/accounts") return Response.json([{ id: "synthetic", accessRole: "editor", settings: { reading: { autoMarkRead: mode } } }]);
    if (url.endsWith("/folders")) return Response.json([]);
    if (url.endsWith("/flags")) { attempts++; return Response.json({ flags: ["\\Seen"] }); }
    return Response.json({ message });
  }) as typeof fetch;
  const page = render(<Theme><SearchParamsContext.Provider value={new URLSearchParams({ accountId: "synthetic", messageId: "synthetic" })}>
    <MessageWindowPage />
  </SearchParamsContext.Provider></Theme>);
  await page.findByText("Synthetic inherited mail");
  expect(attempts).toBe(0);
  mode = "immediate";
  act(() => { window.dispatchEvent(new StorageEvent("storage", { key: SENDER_SETTINGS_STORAGE_KEY, newValue: JSON.stringify({ accountId: "synthetic" }) })); });
  await waitFor(() => expect(attempts).toBe(1));
});
