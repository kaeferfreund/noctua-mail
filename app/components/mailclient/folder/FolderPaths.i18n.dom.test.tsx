import { afterEach, expect, test } from "bun:test";
import { cleanup, fireEvent } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { SearchParamsContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { I18nTestProvider, render } from "@/lib/i18n/testRender";
import type { Folder, Message } from "@/lib/data";
import { useMessageListHelpers } from "../messagelist/useMessageListHelpers";
import MessageWindowPage from "@/app/message/window/page";

const folders: Folder[] = [{ id: "synthetic:INBOX", accountId: "synthetic", name: "INBOX", specialUse: "\\Inbox", count: 1 }];
const message: Message = { id: "synthetic-message", accountId: "synthetic", folderId: folders[0].id,
  subject: "Synthetic subject", from: "sender@example.test", to: "user@example.test", date: "2026-10-22T12:00:00Z",
  dateValue: 1792670400000, preview: "Synthetic preview", body: "Synthetic body" };
const originalFetch = globalThis.fetch;
afterEach(() => { cleanup(); globalThis.fetch = originalFetch; });

for (const locale of ["de", "en"] as const) {
  const name = locale === "de" ? "Posteingang" : "Inbox";
  test(`main shell folder badges localize paths in ${locale} and select the raw ID`, () => {
    const selected: string[] = [];
    function Harness() {
      const { renderFolderBadges } = useMessageListHelpers({ groupBy: "folder", activeAccountId: "synthetic", folders,
        toggleFlaggedFlag() {}, setSearchScope() {}, setActiveFolderId: id => selected.push(id as string) });
      return renderFolderBadges([folders[0].id]);
    }
    const page = render(<I18nTestProvider locale={locale}><Theme><Harness /></Theme></I18nTestProvider>);
    const badge = page.getByRole("button", { name, exact: true });
    expect(badge.title).toBe(name);
    fireEvent.click(badge);
    expect(selected).toEqual([folders[0].id]);
  });
  test(`detached reader folder badges localize paths in ${locale}`, async () => {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/folders")) return Response.json(folders);
      if (url === "/api/accounts") return Response.json([]);
      return Response.json({ message });
    }) as typeof fetch;
    const page = render(<I18nTestProvider locale={locale}><Theme>
      <SearchParamsContext.Provider value={new URLSearchParams({ accountId: "synthetic", messageId: message.id })}>
        <MessageWindowPage />
      </SearchParamsContext.Provider>
    </Theme></I18nTestProvider>);
    expect((await page.findByRole("button", { name, exact: true })).title).toBe(name);
  });
}
