import { afterEach, describe, expect, it } from "bun:test";
import { useState } from "react";
import { cleanup, fireEvent, within } from "@testing-library/react";
import { render, I18nTestProvider } from "@/lib/i18n/testRender";
import ShellSearch, { type ShellSearchProps } from "./ShellSearch";
import { DEFAULT_SEARCH_BADGES, DEFAULT_SEARCH_FIELDS } from "@/app/components/mailclient/useSearchState";
import { expectFocused } from "@/lib/testDomAssertions";

afterEach(cleanup);

function SearchHarness({ scope = "folder", folder = "archive" }: { scope?: "folder" | "all"; folder?: string }) {
  const [query, setQuery] = useState("");
  const [searchScope, setSearchScope] = useState(scope);
  const [activeFolderId, setActiveFolderId] = useState(scope === "folder" ? folder : "");
  const [lastFolderId, setLastFolderId] = useState(scope === "folder" ? "inbox" : "archive");
  const [searchFields, setSearchFields] = useState({ ...DEFAULT_SEARCH_FIELDS, participants: false });
  const [searchBadges, setSearchBadges] = useState(DEFAULT_SEARCH_BADGES);
  const [includeSentInEverywhere, setIncludeSentInEverywhere] = useState(false);
  const state: ShellSearchProps["state"] = {
    query, searchScope, activeFolderId, lastFolderId, searchFields, searchBadges,
    includeSentInEverywhere, sentFolderName: "Sent", isRelatedSearch: false,
    searchFieldsLabel: "All fields", searchBadgesLabel: "All messages",
    accountFolders: [
      { id: "inbox", name: "INBOX", specialUse: "\\Inbox", accountId: "synthetic", count: 0, unreadCount: 0 },
      { id: "archive", name: "Archive", accountId: "synthetic", count: 0, unreadCount: 0 }
    ]
  };
  return <>
    <ShellSearch state={state} actions={{ setQuery, setSearchScope, setActiveFolderId,
      setLastFolderId, setSearchFields, setSearchBadges, setIncludeSentInEverywhere,
      clearSearch: () => setQuery("") }} />
    <output data-testid="folders">{JSON.stringify({ activeFolderId, lastFolderId })}</output>
  </>;
}

async function openFilters(scope?: "folder" | "all") {
  const view = render(<SearchHarness scope={scope} />);
  fireEvent.click(view.getByRole("button", { name: "Search filters" }));
  const dialog = await view.findByRole("dialog");
  return { view, dialog, filters: within(dialog) };
}

describe("shell search filters", () => {
  it("reselecting Current folder preserves the active Archive and remembered Inbox", async () => {
    const { view, filters } = await openFilters();
    fireEvent.click(filters.getByRole("radio", { name: /Current folder/ }));
    expect(JSON.parse(view.getByTestId("folders").textContent!)).toEqual({ activeFolderId: "archive", lastFolderId: "inbox" });
  });

  it("labels the current folder with its localized display name, not the IMAP name", async () => {
    for (const [locale, name] of [["de", "Posteingang"], ["en", "Inbox"]] as const) {
      const view = render(<SearchHarness folder="inbox" />, { wrapper: ({ children }) => <I18nTestProvider locale={locale}>{children}</I18nTestProvider> });
      fireEvent.click(view.getByRole("button", { name: locale === "de" ? "Suchfilter" : "Search filters" }));
      const dialog = within(await view.findByRole("dialog"));
      expect(dialog.getByText(name).closest('[data-slot="badge"]')?.getAttribute("title")).toBe(name);
      expect(dialog.queryByText("INBOX")).toBeNull();
      cleanup();
    }
  });

  it("reselecting Everywhere preserves Archive for the return to Current folder", async () => {
    const { view, filters } = await openFilters();
    fireEvent.click(filters.getByRole("radio", { name: "Everywhere" }));
    fireEvent.click(filters.getByRole("radio", { name: "Everywhere" }));
    expect(JSON.parse(view.getByTestId("folders").textContent!)).toEqual({ activeFolderId: "", lastFolderId: "archive" });
    fireEvent.click(filters.getByRole("radio", { name: /Current folder/ }));
    expect(JSON.parse(view.getByTestId("folders").textContent!)).toEqual({ activeFolderId: "archive", lastFolderId: "archive" });
  });

  it("exposes labelled native groups and preserves field, category and Sent behavior", async () => {
    const { filters, dialog } = await openFilters();
    for (const name of ["Scope", "Search in", "Filter", "Categories", "AI"]) {
      expect(filters.getByRole("group", { name }).tagName).toBe("FIELDSET");
    }
    expect(dialog.querySelector('[role^="menuitem"]')).toBeNull();
    const folder = filters.getByRole("radio", { name: /Current folder/ }) as HTMLInputElement;
    const everywhere = filters.getByRole("radio", { name: "Everywhere" }) as HTMLInputElement;
    expect(folder.type).toBe("radio");
    expect(folder.name).toBe(everywhere.name);
    const sent = filters.getByRole("checkbox", { name: "Include Sent" }) as HTMLInputElement;
    expect(sent.disabled).toBe(true);
    fireEvent.click(everywhere);
    expect(sent.disabled).toBe(false);
    fireEvent.click(sent);
    expect(sent.checked).toBe(true);
    const sender = filters.getByRole("checkbox", { name: "Sender" }) as HTMLInputElement;
    expect(sender.checked).toBe(true);
    fireEvent.click(filters.getByRole("checkbox", { name: "Participants" }));
    expect(sender.checked).toBe(false);
    expect(sender.disabled).toBe(true);
    const newsletter = filters.getByRole("checkbox", { name: /Newsletters/ }) as HTMLInputElement;
    const notification = filters.getByRole("checkbox", { name: /Notifications/ }) as HTMLInputElement;
    fireEvent.click(newsletter);
    expect(newsletter.checked).toBe(true);
    fireEvent.click(notification);
    expect(newsletter.checked).toBe(false);
    expect(notification.checked).toBe(true);
    fireEvent.click(notification);
    expect(notification.checked).toBe(false);
    const ai = filters.getByRole("checkbox", { name: "AI Modified" }) as HTMLInputElement;
    ai.focus();
    expectFocused(ai);
    fireEvent.click(ai);
    expect(ai.checked).toBe(true);
  });
});
