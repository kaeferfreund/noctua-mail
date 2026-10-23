import { afterEach, expect, it } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import { I18nTestProvider } from "@/lib/i18n/testRender";
import type { UiLocale } from "@/lib/i18n/config";
import ShellSearch, { type ShellSearchProps } from "./ShellSearch";
import { DEFAULT_SEARCH_BADGES, DEFAULT_SEARCH_FIELDS } from "@/app/components/mailclient/useSearchState";

afterEach(cleanup);

const noop = () => {};
function placeholderFor(locale: UiLocale, activeFolderId: string) {
  const state: ShellSearchProps["state"] = {
    query: "", searchScope: "folder", activeFolderId, lastFolderId: activeFolderId,
    searchFields: DEFAULT_SEARCH_FIELDS, searchBadges: DEFAULT_SEARCH_BADGES,
    includeSentInEverywhere: false, sentFolderName: "Sent", isRelatedSearch: false,
    searchFieldsLabel: "", searchBadgesLabel: "",
    accountFolders: [
      { id: "inbox", name: "INBOX", specialUse: "\\Inbox", accountId: "synthetic", count: 0, unreadCount: 0 },
      { id: "drafts", name: "Drafts", specialUse: "\\Drafts", accountId: "synthetic", count: 0, unreadCount: 0 },
      { id: "custom", name: "Projekte 2026", accountId: "synthetic", count: 0, unreadCount: 0 }
    ]
  };
  const view = render(<I18nTestProvider locale={locale}><ShellSearch state={state} actions={{ setQuery: noop, setSearchScope: noop,
    setActiveFolderId: noop, setLastFolderId: noop, setSearchFields: noop, setSearchBadges: noop,
    setIncludeSentInEverywhere: noop, clearSearch: noop }} /></I18nTestProvider>);
  const placeholder = view.container.querySelector<HTMLInputElement>("#top-search-input")!.placeholder;
  cleanup();
  return placeholder;
}

// QA-210: "E-Mails in Posteingang suchen" was ungrammatical, and it and the English
// "Search messages in Inbox" were clipped at 1280/1440.
// The folder name stays a standalone object, so every display name reads correctly.
it("names the current folder in a short, grammatical search placeholder", () => {
  expect(placeholderFor("de", "inbox")).toBe("Posteingang durchsuchen");
  expect(placeholderFor("de", "drafts")).toBe("Entwürfe durchsuchen");
  expect(placeholderFor("de", "custom")).toBe("Projekte 2026 durchsuchen");
  expect(placeholderFor("en", "inbox")).toBe("Search Inbox");
  expect(placeholderFor("en", "custom")).toBe("Search Projekte 2026");
});
