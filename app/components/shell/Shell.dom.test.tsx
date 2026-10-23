// Uses the existing happy-dom harness through bun run test:dom.
import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { readFileSync } from "node:fs";
import { act, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import { render, I18nTestProvider } from "@/lib/i18n/testRender";
import { renderToString } from "react-dom/server";
import { useEffect } from "react";
import { hydrateRoot } from "react-dom/client";
import { Theme, Button as KeptButton } from "@radix-ui/themes";
import { ThemeProvider } from "next-themes";
import { Sheet, SheetContent, SheetTitle } from "@/app/components/ui/sheet";
import { SidebarInset, SidebarProvider, useSidebar } from "@/app/components/ui/sidebar";
import { MOBILE_QUERY } from "@/app/hooks/use-mobile";
import type { ShellAccount } from "./types";
import ShellSidebar, { type ShellSidebarProps } from "./ShellSidebar";
import ShellPanes from "./ShellPanes";
import ShellHeader, { ThemeToggle, type ShellHeaderProps } from "./ShellHeader";
import { TooltipProvider } from "@/app/components/ui/tooltip";
import { getTranslator } from "@/lib/i18n/translator";
import type { UiLocale } from "@/lib/i18n/config";
import { DEFAULT_SEARCH_BADGES, DEFAULT_SEARCH_FIELDS, VIRTUAL_FOLDERS, getVirtualFolderLabels } from "@/app/components/mailclient/useSearchState";

const style = document.createElement("style");
afterEach(() => {
  cleanup();
  style.remove();
  document.documentElement.classList.remove("dark", "light");
  window.localStorage.clear();
});

function account(id: string, name: string, domain = "example.test", shared = false): ShellAccount {
  return {
    id, name, email: `${id}@${domain}`, avatar: "", shared,
    imap: { host: "imap.example.test", port: 993, secure: true, user: "", password: "" },
    smtp: { host: "smtp.example.test", port: 465, secure: true, user: "", password: "" }
  };
}

function renderSidebar(
  accounts: ShellAccount[],
  onSwitch: (id: string) => void,
  onSync = () => {},
  userOverrides: Partial<ShellSidebarProps["user"]> = {},
  views: ShellSidebarProps["views"] = { inbox: null, collab: [], virtual: [] },
  locale: UiLocale = "en",
  sidebar: { open?: boolean; openMobile?: boolean } = {}
) {
  const props: ShellSidebarProps = {
    brand: { buildVersionLabel: "" },
    mailboxes: { accounts, activeAccountId: accounts[0]?.id ?? "", onSwitch, onAdd: userOverrides.isAdminUser ? () => {} : undefined },
    compose: { onCompose: () => {}, draftsCount: 0, onOpenDrafts: null },
    sync: { isSyncing: false, onCheckNewMail: onSync },
    user: {
      userEmail: "person@example.test", userName: "Example Person", currentAccount: accounts[0] ?? null,
      isAdminUser: false, onOpenSettings: () => {}, onOpenAdmin: () => {},
      onShowThreadJson: () => {}, onEvictThreadCache: () => {}, onLogout: () => {},
      ...userOverrides
    },
    views,
    topics: { topics: [], activeTopicId: null, onTopicClick: () => {} },
    folders: {
      accountFolderCount: 0, isRecomputingThreads: false, isRecomputingCategories: false,
      syncAccount: () => {}, recomputeThreads: () => {}, recomputeCategories: () => {},
      rootFolders: [], folderTree: new Map(), folderById: new Map(), searchScope: "folder",
      activeFolderId: "", setActiveFolderId: () => {}, setSearchScope: () => {}, clearSearch: () => {},
      syncingFolders: new Set(), deletingFolderIds: new Set(), draggingMessageIds: new Set(),
      dragOverFolderId: "", setDragOverFolderId: () => {}, handleMoveMessages: async () => {},
      handleCreateSubfolder: async () => {}, handleRenameFolderItem: async () => {},
      handleDeleteFolderItem: async () => {}, folderSpecialIcon: () => null
    }
  };
  return render(<I18nTestProvider locale={locale}><Theme><SidebarProvider open={sidebar.open}>
    {sidebar.openMobile ? <OpenMobileSheet /> : null}<ShellSidebar {...props} />
  </SidebarProvider></Theme></I18nTestProvider>);
}

function OpenMobileSheet() {
  const { setOpenMobile } = useSidebar();
  useEffect(() => { setOpenMobile(true); }, [setOpenMobile]);
  return null;
}

describe("shell sidebar", () => {
  for (const admin of [false, true]) it(`shows mailbox creation only when admin=${admin}`, () => {
    const view = renderSidebar([account("synthetic", "Synthetic mailbox")], () => {}, () => {}, { isAdminUser: admin });
    expect(Boolean(view.queryByRole("button", { name: "Add mailbox" }))).toBe(admin);
  });

  it("sorts personal and shared mailboxes, switches accounts and keeps full mailbox sync reachable", () => {
    const switched: string[] = [];
    let syncs = 0;
    const view = renderSidebar([account("z", "Zulu"), account("a", "Alpha"), account("team", "Team", "example.test", true)],
      (id) => switched.push(id), () => { syncs++; });
    const rows = [...view.container.querySelectorAll<HTMLButtonElement>("button[aria-current], button[title$='@example.test']")]
      .filter((row) => row.getAttribute("aria-label") !== "User menu");
    expect(rows.map((row) => row.textContent)).toEqual(["ALAlpha", "ZUZulu", "TETeam"]);
    fireEvent.click(view.getByRole("button", { name: /Alpha/ }));
    expect(switched).toEqual(["a"]);
    fireEvent.click(view.getByRole("button", { name: "Check all folders for new mail" }));
    expect(syncs).toBe(1);
    expect(view.getByText("Example Person")).toBeTruthy();
  });

  it("renders domain headings only for sections with more than six mailboxes", () => {
    const accounts = Array.from({ length: 7 }, (_, i) => account(`box${i}`, `Box ${6 - i}`, i % 2 ? "b.example.test" : "a.example.test"));
    const view = renderSidebar(accounts, () => {});
    expect(view.getByText("a.example.test")).toBeTruthy();
    expect(view.getByText("b.example.test")).toBeTruthy();
    const rows = [...view.container.querySelectorAll<HTMLButtonElement>("button[title$='@a.example.test']")];
    expect(rows.map((row) => row.title)).toEqual(["box6@a.example.test", "box4@a.example.test", "box2@a.example.test", "box0@a.example.test"]);
    view.unmount();
    const short = renderSidebar(accounts.slice(0, 6), () => {});
    expect(short.queryByText("a.example.test")).toBeNull();
  });

  it("keeps the thread JSON and thread cache developer tools reachable from the user menu", async () => {
    const calls: string[] = [];
    const view = renderSidebar([account("a", "Alpha")], () => {}, () => {}, {
      onShowThreadJson: () => { calls.push("json"); },
      onEvictThreadCache: () => { calls.push("evict"); }
    });
    for (const label of ["Show thread JSON", "Evict thread cache"]) {
      fireEvent.keyDown(view.getByRole("button", { name: "User menu" }), { key: "Enter" });
      const item = await view.findByRole("menuitem", { name: label });
      await act(async () => { fireEvent.click(item); });
    }
    expect(calls).toEqual(["json", "evict"]);
  });
});

describe("theme menu", () => {
  it("selects light, dark and system through next-themes", async () => {
    const view = render(<ThemeProvider attribute="class" storageKey="noctua:theme" enableSystem><ThemeToggle /></ThemeProvider>);
    for (const [label, stored] of [["Dark", "dark"], ["Light", "light"], ["System", "system"]]) {
      fireEvent.keyDown(view.getByRole("button", { name: "Theme" }), { key: "Enter" });
      const item = await view.findByRole("menuitemradio", { name: label });
      await act(async () => { fireEvent.click(item); });
      await waitFor(() => expect(window.localStorage.getItem("noctua:theme")).toBe(stored));
      if (stored !== "system") expect(document.documentElement.classList.contains(stored)).toBe(true);
    }
  });
});

describe("shell header", () => {
  const noop = () => {};
  const search: ShellHeaderProps["search"] = {
    state: {
      query: "", searchScope: "folder", activeFolderId: "inbox", lastFolderId: "inbox",
      searchFields: DEFAULT_SEARCH_FIELDS, searchBadges: DEFAULT_SEARCH_BADGES,
      includeSentInEverywhere: false, sentFolderName: "Sent", isRelatedSearch: false,
      searchFieldsLabel: "All fields", searchBadgesLabel: "All messages",
      accountFolders: [{ id: "inbox", name: "INBOX", accountId: "synthetic", count: 0, unreadCount: 0 }]
    },
    actions: {
      setQuery: noop, setSearchScope: noop, setActiveFolderId: noop, setLastFolderId: noop,
      setSearchFields: noop, setSearchBadges: noop, setIncludeSentInEverywhere: noop, clearSearch: noop
    }
  };

  it("puts the list toolbar right after the title, inside a header container", () => {
    const view = render(
      <SidebarProvider><TooltipProvider>
        <ShellHeader title="Synthetic / INBOX" search={search} sync={{ isSyncing: false, onCheckNewMail: noop }}
          toolbar={<button type="button">View: Threads</button>} />
      </TooltipProvider></SidebarProvider>
    );
    const header = view.container.querySelector<HTMLElement>("[data-slot='shell-header']")!;
    expect(header.className).toContain("@container/header");
    const title = within(header).getByRole("heading", { name: "Synthetic / INBOX" });
    expect(title.nextElementSibling).toBe(within(header).getByRole("button", { name: "View: Threads" }));
  });

  it("renders mailbox and folder as one heading with a quiet separator", () => {
    const view = render(
      <SidebarProvider><TooltipProvider>
        <ShellHeader title={["Synthetic", "INBOX"]} search={search} sync={{ isSyncing: false, onCheckNewMail: noop }} />
      </TooltipProvider></SidebarProvider>
    );
    const title = within(view.container).getByRole("heading", { name: "Synthetic / INBOX" });
    expect(title.title).toBe("Synthetic / INBOX");
    expect(title.className).toContain("font-medium");
    expect(title.className).not.toContain("tracking-");
    const separator = title.querySelector("span")!;
    expect(separator.textContent).toBe(" / ");
    expect(separator.className).toContain("text-muted-foreground");
  });
});

describe("Radix components in shadcn portals", () => {
  it("resolves the kept component's --space-2 inside a Sheet", async () => {
    // Load the actual Radix CSS: the root Theme's scoped tokens cannot be
    // inherited by the body portal. Theme asChild restores them there.
    style.textContent = readFileSync(new URL("../../../node_modules/@radix-ui/themes/styles.css", import.meta.url), "utf8");
    document.head.append(style);
    const view = render(<Theme accentColor="iris" grayColor="gray">
      <Sheet open><SheetContent aria-describedby={undefined}><SheetTitle>Mailbox settings</SheetTitle>
        <Theme asChild><div><KeptButton>Kept button</KeptButton></div></Theme>
      </SheetContent></Sheet>
    </Theme>);
    const dialog = await view.findByRole("dialog");
    const kept = within(dialog).getByRole("button", { name: "Kept button" });
    expect(view.container.contains(dialog)).toBe(false);
    expect(kept.closest(".radix-themes")).toBeTruthy();
    // happy-dom resolves custom properties on the declaring Theme; unlike a
    // browser it does not expose inherited custom properties on descendants.
    const themedRoot = kept.closest<HTMLElement>(".radix-themes")!;
    expect(dialog.contains(themedRoot)).toBe(true);
    expect(getComputedStyle(themedRoot).getPropertyValue("--space-2")).toBe("calc(8px * 1)");

  });
});

describe("resizable shell panes", () => {
  it("keeps the list viewport and reader mounted when the calendar opens and closes", () => {
    const list = <div data-testid="list-viewport">Messages</div>;
    const reader = <div data-testid="reader-content">Reading pane</div>;
    const view = render(<ShellPanes list={list} reader={reader} />);
    const viewport = view.getByTestId("list-viewport");
    const content = view.getByTestId("reader-content");
    view.rerender(<ShellPanes list={list} reader={reader} calendar={<div>Calendar</div>} />);
    expect(view.getByText("Calendar")).toBeTruthy();
    expect(view.getByTestId("list-viewport")).toBe(viewport);
    expect(view.getByTestId("reader-content")).toBe(content);
    view.rerender(<ShellPanes list={list} reader={reader} />);
    expect(view.queryByText("Calendar")).toBeNull();
    expect(view.getByTestId("list-viewport")).toBe(viewport);
    expect(view.getByTestId("reader-content")).toBe(content);
  });
});


describe("shell landmarks", () => {
  it("keeps a single main landmark when SidebarInset sits inside the root main", () => {
    const view = render(<main><SidebarProvider><SidebarInset>Mail</SidebarInset></SidebarProvider></main>);
    expect(view.getAllByRole("main")).toHaveLength(1);
  });
});


describe("sidebar editable target guard", () => {
  it("leaves native text fields and nested contenteditable targets to their own shortcuts", () => {
    let toggles = 0;
    const view = render(<><SidebarProvider onOpenChange={() => { toggles++; }} />
      <input aria-label="Synthetic input" /><textarea aria-label="Synthetic textarea" />
      <div contentEditable suppressContentEditableWarning><span>Editable child</span></div>
    </>);
    for (const target of [view.getByLabelText("Synthetic input"), view.getByLabelText("Synthetic textarea"), view.getByText("Editable child")]) {
      for (const modifier of [{ ctrlKey: true }, { metaKey: true }]) {
        expect(fireEvent.keyDown(target, { key: "b", ...modifier })).toBe(true);
        expect(toggles).toBe(0);
      }
    }
    expect(fireEvent.keyDown(window, { key: "b", ctrlKey: true })).toBe(false);
    expect(toggles).toBe(1);
  });
});


describe("saved shell hydration", () => {
  it("hydrates a saved pane layout and theme without attribute or tree mismatches", async () => {
    window.localStorage.setItem("react-resizable-panels:noctua:panes:list:reader", JSON.stringify({ list: 30, reader: 70 }));
    window.localStorage.setItem("noctua:theme", "light");
    const errors: unknown[][] = [];
    const recoveries: unknown[] = [];
    const error = spyOn(console, "error").mockImplementation((...args: unknown[]) => { errors.push(args); });
    const container = document.createElement("div");
    document.body.append(container);
    const shell = <I18nTestProvider><ThemeProvider attribute="class" storageKey="noctua:theme" forcedTheme="light">
      <ThemeToggle /><ShellPanes list={<div>List</div>} reader={<div>Reader</div>} />
    </ThemeProvider></I18nTestProvider>;
    container.innerHTML = renderToString(shell);
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      await act(async () => { root = hydrateRoot(container, shell, { onRecoverableError: (issue) => recoveries.push(issue) }); });
      expect(recoveries).toEqual([]);
      expect(errors.filter((args) => /hydrat|didn't match|did not match/i.test(String(args[0])))).toEqual([]);
      expect(container.querySelector('button[aria-label="Theme"] svg')?.getAttribute("class")).toContain("sun");
      expect(window.localStorage.getItem("react-resizable-panels:noctua:panes:list:reader")).toBe('{"list":30,"reader":70}');
    } finally {
      act(() => root?.unmount());
      container.remove(); error.mockRestore();
    }
  });
});

for (const locale of ["de", "en"] as const) it(`renders all seven sidebar views and descriptions in ${locale}, selecting stable IDs`, async () => {
  const t = getTranslator(locale);
  const selected: string[] = [];
  const rows = VIRTUAL_FOLDERS.map(folder => ({
    ...folder, ...getVirtualFolderLabels(folder, key => t(`Views.${key}`)),
    active: false, icon: null, count: 3,
    onSelect: () => selected.push(folder.id)
  }));
  const inbox = { id: "folder:synthetic-inbox", name: t("Views.inbox.name"), description: t("Views.inbox.description"), active: true, icon: null, onSelect: () => selected.push("folder:synthetic-inbox") };
  const page = renderSidebar([], () => {}, () => {}, {}, { inbox, collab: rows.slice(0, 3), virtual: rows.slice(3) }, locale);
  const buttons = [...page.container.querySelectorAll<HTMLButtonElement>("[data-view-id]")];
  expect(buttons.map(button => button.textContent)).toEqual(locale === "de"
    ? ["Posteingang", "Mir zugewiesen", "Nicht zugewiesen", "Offen", "Ungelesen & unbeantwortet", "Markiert & Aufgaben", "Kalendereinladungen"]
    : ["Inbox", "Assigned to me", "Unassigned", "Open", "Focused", "Action Queue", "Invite Deck"]);
  expect(page.getByText(locale === "de" ? "Ansichten" : "Views")).toBeTruthy();
  expect(page.getByPlaceholderText(locale === "de" ? "Ordner suchen" : "Search folders")).toBeTruthy();
  expect(page.getByText(locale === "de" ? "0 insgesamt" : "0 total")).toBeTruthy();
  const views = [inbox, ...rows];
  for (const [index, button] of buttons.entries()) {
    // The description is a row-bound tooltip (no native title) and follows
    // keyboard focus from row to row without keeping the previous text.
    expect(button.hasAttribute("title")).toBe(false);
    await act(async () => { button.focus(); });
    const tooltip = await page.findByRole("tooltip");
    expect(page.getAllByRole("tooltip")).toHaveLength(1);
    expect(tooltip.textContent).toBe(t("Views.rowTitle", { name: views[index].name, description: views[index].description }));
    expect(tooltip.textContent).not.toContain("undefined");
    expect(tooltip.textContent).toContain(": ");
    expect(button.getAttribute("aria-describedby")).toBe(tooltip.id);
    fireEvent.click(button);
  }
  expect(selected).toEqual([inbox.id, ...VIRTUAL_FOLDERS.map(folder => folder.id)]);
  // Moving the pointer to the neighbouring row replaces the description at once.
  await act(async () => { (document.activeElement as HTMLElement | null)?.blur(); });
  for (const [index, button] of buttons.slice(0, 3).entries()) {
    if (index) fireEvent.pointerLeave(buttons[index - 1], { pointerType: "mouse" });
    fireEvent.pointerMove(button, { pointerType: "mouse" });
    await waitFor(() => expect(page.getAllByRole("tooltip").map(tooltip => tooltip.textContent))
      .toEqual([t("Views.rowTitle", { name: views[index].name, description: views[index].description })]));
  }
});

for (const mode of ["collapsed sidebar", "phone sheet"] as const) it(`renders no view row description in the ${mode}`, async () => {
  const original = window.matchMedia;
  if (mode === "phone sheet") window.matchMedia = ((query: string) => query === MOBILE_QUERY
    ? { matches: true, media: query, addEventListener() {}, removeEventListener() {} }
    : original.call(window, query)) as typeof window.matchMedia;
  try {
    const t = getTranslator("en");
    const virtual = VIRTUAL_FOLDERS.map(folder => ({
      ...folder, ...getVirtualFolderLabels(folder, key => t(`Views.${key}`)), active: false, icon: null, count: 3, onSelect() {}
    }));
    const page = renderSidebar([], () => {}, () => {}, {}, { inbox: null, collab: [], virtual }, "en",
      mode === "collapsed sidebar" ? { open: false } : { openMobile: true });
    const buttons = await waitFor(() => {
      const found = [...document.querySelectorAll<HTMLButtonElement>("[data-view-id]")];
      expect(found).toHaveLength(VIRTUAL_FOLDERS.length);
      return found;
    });
    // The collapsed offcanvas sidebar is off screen: none of its rows can take focus.
    const container = document.querySelector('[data-slot="sidebar-container"]');
    expect(container?.hasAttribute("inert") ?? false).toBe(mode === "collapsed sidebar");
    for (const button of buttons) {
      await act(async () => { button.focus(); });
      fireEvent.pointerMove(button, { pointerType: "mouse" });
      expect(button.hasAttribute("aria-describedby")).toBe(false);
    }
    await new Promise(resolve => setTimeout(resolve, 500));
    expect(page.queryAllByRole("tooltip")).toHaveLength(0);
    expect(document.querySelector('[data-slot="tooltip-content"]')).toBeNull();
  } finally { cleanup(); window.matchMedia = original; }
});

for (const locale of ["de", "en"] as const) it(`uses numeric view counts with complete accessible descriptions in ${locale}`, () => {
  const view = { id: "virtual:focused", name: locale === "de" ? "Ungelesen & unbeantwortet" : "Focused",
    description: "Synthetic description", icon: null, active: false, count: 3, countLabel: "Legacy verbose count",
    countAriaLabel: locale === "de" ? "3 ungelesen" : "3 unread", onSelect() {} };
  const page = renderSidebar([], () => {}, () => {}, {}, { inbox: null, collab: [], virtual: [view] }, locale);
  const button = page.container.querySelector('[data-view-id="virtual:focused"]')!;
  const badge = button.parentElement!.querySelector('[data-sidebar="menu-badge"]')!;
  expect(button.textContent).toBe(view.name);
  expect(badge.textContent).toBe("3");
  expect(badge.getAttribute("aria-label")).toBe(view.countAriaLabel);
});
