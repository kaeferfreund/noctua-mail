import { afterEach, expect, test } from "bun:test";
import { act, cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import AdminMailboxes from "@/app/components/admin/AdminMailboxes";
import SettingsFrame, { SettingsTitle } from "./SettingsFrame";
import { MOBILE_QUERY } from "@/app/hooks/use-mobile";

afterEach(cleanup);
for (const startMobile of [false, true]) {
  test(`QA-102 preserves the open mailbox dialog and typed values ${startMobile ? "phone → desktop → phone" : "desktop → phone → desktop"}`, async () => {
    const original = window.matchMedia;
    let mobile = startMobile;
    const listeners = new Set<() => void>();
    window.matchMedia = ((query: string) => query === MOBILE_QUERY ? {
      matches: mobile, media: query, addEventListener: (_: string, fn: () => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: () => void) => listeners.delete(fn)
    } : original.call(window, query)) as typeof window.matchMedia;
    try {
      const page = render(<Theme><SettingsFrame open onClose={() => {}}>
        <SettingsTitle>Admin</SettingsTitle>
        <AdminMailboxes users={[]} apiFetch={async () => new Response(JSON.stringify({ accounts: [] }))} />
      </SettingsFrame></Theme>);
      fireEvent.click(await page.findByRole("button", { name: "Create mailbox" }));
      const dialog = await page.findByRole("dialog", { name: "Create mailbox" });
      const name = within(dialog).getByLabelText("Name", { exact: true }) as HTMLInputElement;
      const email = within(dialog).getByLabelText("Email", { exact: true }) as HTMLInputElement;
      fireEvent.change(name, { target: { value: "Synthetic unsent mailbox" } });
      fireEvent.change(email, { target: { value: "synthetic@example.test" } });
      for (const next of [!startMobile, startMobile]) {
        await act(async () => { mobile = next; listeners.forEach(listener => listener()); });
        await waitFor(() => {
          expect(page.getByRole("dialog", { name: "Create mailbox" })).toBe(dialog);
          expect(within(dialog).getByLabelText("Name", { exact: true })).toBe(name);
          expect(name.value).toBe("Synthetic unsent mailbox");
          expect(email.value).toBe("synthetic@example.test");
        });
      }
    } finally { cleanup(); window.matchMedia = original; }
  });
}
