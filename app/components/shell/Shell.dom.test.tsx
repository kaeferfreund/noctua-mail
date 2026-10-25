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
import type { UserMailboxSummary } from "@/lib/mailboxSummary";
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
  onSwitch: ShellSidebarProps["mailboxes"]["onSwitch"],
  onSync = () => {},
  userOverrides: Partial<ShellSidebarProps["user"]> = {},
  views: ShellSidebarProps["views"] = { inbox: null, collab: [], virtual: [] },
  locale: UiLocale = "en",
  buildInfo: ShellSidebarProps["brand"]["buildInfo"] = null,
  sidebar: { open?: boolean; openMobile?: boolean } = {},
  activeAccountId = accounts[0]?.id ?? "",
  mailboxOverrides: Partial<ShellSidebarProps["mailboxes"]> = {}
) {
  const props: ShellSidebarProps = {
    brand: { buildInfo },
    mailboxes: { accounts, activeAccountId, onSwitch, onAdd: userOverrides.isAdminUser ? () => {} : undefined, ...mailboxOverrides },
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
  for (const admin of [false, true]) it(`offers mailbox creation only in the empty state, only when admin=${admin}`, () => {
    // With a mailbox there is no add action in the sidebar (Administration has it).
    const listed = renderSidebar([account("synthetic", "Synthetic mailbox")], () => {}, () => {}, { isAdminUser: admin });
    expect(listed.queryByRole("button", { name: "Add mailbox" })).toBeNull();
    expect(listed.queryByText("No mailbox yet")).toBeNull();
    cleanup();
    const empty = renderSidebar([], () => {}, () => {}, { isAdminUser: admin });
    expect(empty.getByText("No mailbox yet")).toBeTruthy();
    const add = empty.queryByRole("button", { name: "Add mailbox" });
    expect(Boolean(add)).toBe(admin);
    if (add) {
      // A labelled row with the plus icon, 44 px on phones.
      expect(add.textContent).toBe("Add mailbox");
      expect(add.querySelector("svg")).toBeTruthy();
      expect(add.className).toContain("max-md:h-11");
    }
  });

  it("labels the brand with the same short commit and Berlin build time as the status popover", () => {
    const buildInfo = { hash: "0ac6cfa3d9e1b2c4f5a6b7c8d9e0f1a2b3c4d5e6", shortHash: "0ac6cfa", builtAt: "2026-10-23T13:16:05Z" };
    for (const [locale, label, title] of [
      ["de", "Build 0ac6cfa · 23.10.2026, 15:16", "Commit 0ac6cfa3d9e1b2c4f5a6b7c8d9e0f1a2b3c4d5e6, gebaut 2026-10-23T13:16:05Z"],
      ["en", "Build 0ac6cfa · 23/10/2026, 15:16", "Commit 0ac6cfa3d9e1b2c4f5a6b7c8d9e0f1a2b3c4d5e6, built 2026-10-23T13:16:05Z"]
    ] as const) {
      const view = renderSidebar([account("synthetic", "Synthetic mailbox")], () => {}, () => {}, {}, undefined, locale, buildInfo);
      expect(view.getByText(label).getAttribute("title")).toBe(title);
      cleanup();
    }
    const plain = renderSidebar([account("synthetic", "Synthetic mailbox")], () => {}, () => {});
    expect(plain.queryByText(/^Build /)).toBeNull();
  });

  it("lists own and shared mailboxes in one sorted list, switches accounts and keeps full mailbox sync reachable", () => {
    const switched: string[] = [];
    let syncs = 0;
    const view = renderSidebar([account("z", "Zulu"), account("team", "Team", "example.test", true), account("a", "Alpha")],
      (id) => { switched.push(id); }, () => { syncs++; });
    const rows = [...view.container.querySelectorAll<HTMLButtonElement>("button[aria-current], button[title$='@example.test']")]
      .filter((row) => row.getAttribute("aria-label") !== "User menu");
    expect(rows.map((row) => row.textContent)).toEqual(["Alpha", "Team", "Zulu"]);
    // One section in one menu: no heading above the list, no second section.
    expect(new Set(rows.map((row) => row.closest("[data-sidebar=menu]"))).size).toBe(1);
    expect(view.queryByText("My mailboxes")).toBeNull();
    expect(view.queryByText("Shared mailboxes")).toBeNull();
    // Only the shared mailbox carries the marker, after its name.
    const markers = rows.map((row) => row.querySelector("[data-shared-mailbox]"));
    expect(markers.map(Boolean)).toEqual([false, true, false]);
    expect(markers[1]!.getAttribute("role")).toBe("img");
    expect(markers[1]!.getAttribute("aria-label")).toBe("Shared mailbox");
    expect(markers[1]!.getAttribute("title")).toBe("Shared mailbox");
    expect(markers[1]!.previousElementSibling?.textContent).toBe("Team");
    expect(markers[1]!.previousElementSibling?.className).toContain("truncate");
    fireEvent.click(view.getByRole("button", { name: /Alpha/ }));
    expect(switched).toEqual(["a"]);
    fireEvent.click(view.getByRole("button", { name: "Check all folders for new mail" }));
    expect(syncs).toBe(1);
    expect(view.getByText("Example Person")).toBeTruthy();
  });

  it("renders domain headings only for sections with more than six mailboxes", () => {
    // A shared mailbox counts towards the list and sits in its domain's group.
    const accounts = Array.from({ length: 7 }, (_, i) => account(`box${i}`, `Box ${6 - i}`, i % 2 ? "b.example.test" : "a.example.test", i === 2));
    const view = renderSidebar(accounts, () => {});
    expect(view.getByText("a.example.test")).toBeTruthy();
    expect(view.getByText("b.example.test")).toBeTruthy();
    const rows = [...view.container.querySelectorAll<HTMLButtonElement>("button[title$='@a.example.test']")];
    expect(rows.map((row) => row.title)).toEqual(["box6@a.example.test", "box4@a.example.test", "box2@a.example.test", "box0@a.example.test"]);
    expect(rows.map((row) => Boolean(row.querySelector("[data-shared-mailbox]")))).toEqual([false, false, true, false]);
    // Grouped rows sit in a guided container, indented to the heading's text.
    for (const row of rows) {
      expect(row.closest("[data-sidebar=menu]")?.hasAttribute("data-domain-group")).toBe(true);
      expect(row.className).toContain("pl-8");
    }
    const heading = view.getByText("a.example.test").parentElement!;
    expect(heading.className).toContain("font-medium");
    // Flat nesting: heading and its rows are siblings in the section, with
    // no group wrapper adding padding; heading and rows share one height.
    expect(heading.nextElementSibling?.hasAttribute("data-domain-group")).toBe(true);
    expect(heading.parentElement!.getAttribute("data-sidebar")).toBe("group-content");
    expect(heading.parentElement!.parentElement!.className).toContain("md:px-0");
    for (const element of [heading, ...rows]) expect(element.className).toContain("h-8");
    view.unmount();
    const short = renderSidebar(accounts.slice(0, 6), () => {});
    expect(short.queryByText("a.example.test")).toBeNull();
    // Ungrouped rows keep the plain layout: no guide, no indent.
    const plainRows = [...short.container.querySelectorAll<HTMLButtonElement>("button[title$='.example.test']")];
    expect(plainRows).toHaveLength(6);
    for (const row of plainRows) {
      expect(row.closest("[data-sidebar=menu]")?.hasAttribute("data-domain-group")).toBe(false);
      expect(row.className).not.toContain("pl-8");
    }
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
  it("marks the clicked mailbox busy until its switch settles, aria-current only after the commit", async () => {
    const accounts = [account("a", "Alpha"), account("b", "Bravo"), account("c", "Charlie")];
    const pending = new Map<string, () => void>();
    const onSwitch = (id: string) => new Promise<void>((resolve) => { pending.set(id, resolve); });
    const view = renderSidebar(accounts, onSwitch);
    const row = (name: string) => view.getByRole("button", { name: new RegExp(name) });
    const settle = async (id: string) => { await act(async () => { pending.get(id)!(); }); };
    fireEvent.click(row("Bravo"));
    expect(row("Bravo").getAttribute("aria-busy")).toBe("true");
    expect(row("Bravo").getAttribute("aria-current")).toBeNull();
    expect(row("Alpha").getAttribute("aria-current")).toBe("true");
    expect(row("Alpha").getAttribute("aria-busy")).toBeNull();
    await settle("b");
    expect(row("Bravo").getAttribute("aria-busy")).toBeNull();

    // A -> B -> A: the superseded switch settling first leaves the newer click pending.
    fireEvent.click(row("Bravo"));
    fireEvent.click(row("Alpha"));
    expect(row("Alpha").getAttribute("aria-busy")).toBe("true");
    expect(row("Bravo").getAttribute("aria-busy")).toBeNull();
    await settle("b");
    expect(row("Alpha").getAttribute("aria-busy")).toBe("true");
    await settle("a");
    expect(view.container.querySelector("[aria-busy]")).toBeNull();

    // A denied switch (403: switchAccount reports it and settles without a commit) clears the row too.
    fireEvent.click(row("Charlie"));
    expect(row("Charlie").getAttribute("aria-busy")).toBe("true");
    await settle("c");
    expect(row("Charlie").getAttribute("aria-busy")).toBeNull();
    expect(row("Alpha").getAttribute("aria-current")).toBe("true");
    cleanup();

    // The committed mailbox carries aria-current; busy and current never overlap after the settle.
    const committed = renderSidebar(accounts, () => Promise.resolve(), undefined, undefined, undefined, undefined, undefined, undefined, "c");
    const current = committed.getByRole("button", { name: /Charlie/ });
    expect(current.getAttribute("aria-current")).toBe("true");
    expect(current.getAttribute("aria-busy")).toBeNull();
  });
});

describe("collapsible domain groups", () => {
  const brand = ["a", "b", "c", "d"].map(id => account(id, `Brand ${id}`, "brand.example.test"));
  const plain = ["e", "f", "g"].map(id => account(id, `Plain ${id}`, "plain.example.test"));
  const summary = (row: ShellAccount, unread: number | null, assignedToMe: number): UserMailboxSummary => ({
    accountId: row.id, name: row.name, email: row.email, accessRole: "manager", isOwner: true, shared: false,
    unread, assignedToMe, unassignedOpen: 5, open: 5, watcher: { state: "idling" }
  });
  const summaries = [summary(brand[0], 3, 0), summary(brand[1], 4, 1), summary(brand[2], null, 2), summary(brand[3], 0, 0),
    summary(plain[0], 0, 0), summary(plain[1], 0, 0), summary(plain[2], 0, 0)];
  const renderGroups = (userId = "user-1", activeAccountId = plain[0].id) =>
    renderSidebar([...brand, ...plain], () => {}, undefined, undefined, undefined, undefined, undefined, undefined, activeAccountId, { userId, summaries });
  const headerOf = (view: ReturnType<typeof renderSidebar>, domain: string) =>
    view.getByText(domain, { selector: "span" }).closest("button")!;
  const rowTitles = (view: ReturnType<typeof renderSidebar>, domain: string) =>
    [...view.container.querySelectorAll<HTMLButtonElement>(`button[title*="@${domain}"]`)];

  it("toggles a group's rows from its heading button", () => {
    const view = renderGroups();
    const header = headerOf(view, "brand.example.test");
    expect(header.getAttribute("type")).toBe("button");
    expect(header.getAttribute("aria-expanded")).toBe("true");
    const list = document.getElementById(header.getAttribute("aria-controls")!)!;
    expect(list.getAttribute("data-sidebar")).toBe("menu");
    expect(rowTitles(view, "brand.example.test")).toHaveLength(4);
    fireEvent.click(header);
    expect(header.getAttribute("aria-expanded")).toBe("false");
    expect(list.hidden).toBe(true);
    expect(rowTitles(view, "brand.example.test")).toHaveLength(0);
    // The other group stays open.
    expect(rowTitles(view, "plain.example.test")).toHaveLength(3);
    fireEvent.click(header);
    expect(header.getAttribute("aria-expanded")).toBe("true");
    expect(list.hidden).toBe(false);
    expect(rowTitles(view, "brand.example.test")).toHaveLength(4);
  });

  it("restores the collapsed groups per user after a remount", () => {
    const first = renderGroups("user-1");
    fireEvent.click(headerOf(first, "brand.example.test"));
    expect(window.localStorage.getItem("noctua:sidebarDomainsCollapsed:user-1")).toBe('["mine:brand.example.test"]');
    first.unmount();
    const again = renderGroups("user-1");
    expect(headerOf(again, "brand.example.test").getAttribute("aria-expanded")).toBe("false");
    expect(headerOf(again, "plain.example.test").getAttribute("aria-expanded")).toBe("true");
    again.unmount();
    const other = renderGroups("user-2");
    expect(headerOf(other, "brand.example.test").getAttribute("aria-expanded")).toBe("true");
  });

  it("shows the summed counters only on a collapsed heading, hiding zero totals", () => {
    const view = renderGroups();
    const brandHeader = headerOf(view, "brand.example.test");
    const plainHeader = headerOf(view, "plain.example.test");
    expect(brandHeader.querySelector("[data-domain-counts]")).toBeNull();
    fireEvent.click(brandHeader);
    fireEvent.click(plainHeader);
    // 3 + 4 unread (the unavailable count adds nothing), 1 + 2 assigned to me.
    const counts = brandHeader.querySelector("[data-domain-counts]")!;
    expect(within(counts as HTMLElement).getByLabelText("7 unread").textContent).toBe("7");
    expect(within(counts as HTMLElement).getByLabelText("3 assigned to me").textContent).toBe("3");
    expect(counts.querySelectorAll("svg")).toHaveLength(2);
    // The name ellipsizes before the counters; its full text is the title.
    const name = brandHeader.querySelector<HTMLElement>("[data-domain-name]")!;
    expect(name.className).toContain("truncate");
    expect(name.className).toContain("min-w-0");
    expect(name.title).toBe("brand.example.test");
    expect(counts.parentElement!.className).toContain("shrink-0");
    // All totals zero: no counters at all.
    expect(plainHeader.querySelector("[data-domain-counts]")).toBeNull();
    expect(plainHeader.textContent).toBe("plain.example.test");
  });

  it("tints a collapsed heading that hides the active mailbox, without expanding it", () => {
    window.localStorage.setItem("noctua:sidebarDomainsCollapsed:user-1", '["brand.example.test"]');
    const view = renderGroups("user-1", brand[1].id);
    const brandHeader = headerOf(view, "brand.example.test");
    expect(brandHeader.getAttribute("aria-expanded")).toBe("false");
    expect(brandHeader.getAttribute("data-active")).toBe("true");
    expect(headerOf(view, "plain.example.test").hasAttribute("data-active")).toBe(false);
    fireEvent.click(brandHeader);
    expect(brandHeader.hasAttribute("data-active")).toBe(false);
    expect(view.getByRole("button", { name: /Brand b/ }).getAttribute("aria-current")).toBe("true");
  });

  it("own and shared mailboxes of one domain share one group and one stored key", () => {
    const sharedBrand = ["h", "i", "j", "k"].map(id => account(id, `Shared ${id}`, "brand.example.test", true));
    window.localStorage.setItem("noctua:sidebarDomainsCollapsed:user-1", '["brand.example.test"]');
    const view = renderSidebar([...brand, ...plain, ...sharedBrand], () => {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, { userId: "user-1", summaries });
    const headers = view.getAllByText("brand.example.test", { selector: "span" }).map(span => span.closest("button")!);
    expect(headers).toHaveLength(1);
    expect(headers[0].getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(headers[0]);
    expect(headers[0].getAttribute("aria-expanded")).toBe("true");
    // The legacy bare key is split per section on the first toggle; only the list's own entry matters now.
    const stored = window.localStorage.getItem("noctua:sidebarDomainsCollapsed:user-1") ?? "[]";
    expect(stored).not.toContain("mine:brand.example.test");
    expect(stored).not.toContain('"brand.example.test"');
  });

  it("keeps ungrouped sections without a toggle", () => {
    const view = renderSidebar(brand, () => {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, { userId: "user-1", summaries });
    expect(view.container.querySelector("button[aria-expanded][aria-controls]")).toBeNull();
    expect(rowTitles(view, "brand.example.test")).toHaveLength(4);
  });
});

/** Stands in for the `window.Image` probe Radix Avatar loads its source with,
 * so a test decides which avatar sources load and which fail. */
function stubAvatarImages() {
  const probes: Array<{ src: string; settle: (ok: boolean) => void }> = [];
  class ProbeImage extends EventTarget {
    complete = false;
    naturalWidth = 0;
    referrerPolicy = "";
    crossOrigin: string | null = null;
    #src = "";
    get src() { return this.#src; }
    set src(value: string) {
      this.#src = value;
      probes.push({ src: value, settle: (ok) => {
        this.complete = true;
        this.naturalWidth = ok ? 16 : 0;
        this.dispatchEvent(new Event(ok ? "load" : "error"));
      } });
    }
  }
  const original = window.Image;
  window.Image = ProbeImage as unknown as typeof window.Image;
  return {
    probes,
    settle: (src: string, ok: boolean) => act(() => { probes.filter(probe => probe.src === src).forEach(probe => probe.settle(ok)); }),
    restore: () => { window.Image = original; }
  };
}

describe("mailbox avatars and domain icons", () => {
  const rowOf = (view: ReturnType<typeof renderSidebar>, name: string) =>
    view.getByRole("button", { name: new RegExp(name) });
  const headerOf = (view: ReturnType<typeof renderSidebar>, domain: string) =>
    view.getByText(domain, { selector: "span" }).parentElement!;
  const domainIconSrc = (row: ShellAccount, domain: string) =>
    `/api/accounts/${row.id}/sender-icon?${new URLSearchParams({ from: domain, fromEmail: row.email, fallback: "none" })}`;

  it("shows a row avatar only for a custom image URL, never initials", async () => {
    const images = stubAvatarImages();
    try {
      const custom = { ...account("a", "Alpha"), avatar: "https://avatars.example.test/alpha.png" };
      const literal = { ...account("b", "Bravo"), avatar: "NW" };
      const view = renderSidebar([custom, literal, account("c", "Charlie")], () => {});
      // Up to six mailboxes: no domain headers, so the custom avatar is the only image request.
      expect(images.probes.map(probe => probe.src)).toEqual([custom.avatar]);
      await images.settle(custom.avatar, true);
      await waitFor(() => expect(rowOf(view, "Alpha").querySelector("[data-slot=avatar] img")?.getAttribute("src")).toBe(custom.avatar));
      // The literal "NW" and an empty value mean no avatar: the name starts the row.
      for (const name of ["Bravo", "Charlie"]) {
        expect(rowOf(view, name).querySelector("[data-slot=avatar]")).toBeNull();
        expect(rowOf(view, name).firstElementChild?.textContent).toBe(name);
      }
      expect(view.queryByText("NW")).toBeNull();
      expect(view.queryByText("BR")).toBeNull();
    } finally {
      images.restore();
    }
  });

  it("requests one icon per domain header and keeps a plain header without one", async () => {
    const images = stubAvatarImages();
    try {
      const brand = ["a", "b", "c", "d"].map(id => account(id, `Brand ${id}`, "brand.example.test"));
      const plain = ["e", "f"].map(id => account(id, `Plain ${id}`, "plain.example.test"));
      const quiet = { ...account("g", "Quiet"), settings: { appearance: { senderIcons: false } } } as ShellAccount;
      const view = renderSidebar([...brand, ...plain, quiet], () => {});
      const brandSrc = domainIconSrc(brand[0], "brand.example.test");
      const plainSrc = domainIconSrc(plain[0], "plain.example.test");
      // One request per domain; a domain whose mailboxes have sender icons off makes none.
      expect(images.probes.map(probe => probe.src).sort()).toEqual([brandSrc, plainSrc].sort());
      for (const row of [...brand, ...plain, quiet]) {
        expect(rowOf(view, row.name).querySelector("[data-slot=avatar]")).toBeNull();
      }

      await images.settle(brandSrc, true);
      await images.settle(plainSrc, false);
      await waitFor(() => expect(headerOf(view, "brand.example.test").querySelector("img")?.getAttribute("src")).toBe(brandSrc));
      // No logo (the route answers 404): the header keeps only its text.
      expect(headerOf(view, "plain.example.test").querySelector("img")).toBeNull();
      expect(headerOf(view, "plain.example.test").querySelector("[data-slot=avatar]")?.childElementCount).toBe(0);
      expect(headerOf(view, "plain.example.test").textContent).toBe("plain.example.test");
      expect(headerOf(view, "example.test").querySelector("[data-slot=avatar]")).toBeNull();
    } finally {
      images.restore();
    }
  });

  it("loads an uploaded domain icon by its version, also when sender icons are off", async () => {
    const images = stubAvatarImages();
    try {
      const quiet = ["a", "b", "c", "d"].map(id => ({ ...account(id, `Brand ${id}`, "brand.example.test"), settings: { appearance: { senderIcons: false } } }) as ShellAccount);
      const plain = ["e", "f", "g"].map(id => account(id, `Plain ${id}`, "plain.example.test"));
      const view = renderSidebar([...quiet, ...plain], () => {}, undefined, {}, undefined, "en", null, {}, quiet[0].id,
        { domainIcons: { "brand.example.test": "abcdef0123456789" } });
      const brandSrc = `${domainIconSrc(quiet[0], "brand.example.test")}&v=abcdef0123456789`;
      expect(images.probes.map(probe => probe.src).sort()).toEqual([brandSrc, domainIconSrc(plain[0], "plain.example.test")].sort());
      await images.settle(brandSrc, true);
      await waitFor(() => expect(headerOf(view, "brand.example.test").querySelector("img")?.getAttribute("src")).toBe(brandSrc));
    } finally {
      images.restore();
    }
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

for (const locale of ["de", "en"] as const) it(`renders all eight sidebar views and descriptions in ${locale}, selecting stable IDs`, async () => {
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
    ? ["Posteingang", "Mir zugewiesen", "Nicht zugewiesen", "Offen", "Ungelesen & unbeantwortet", "Markiert & Aufgaben", "Kalendereinladungen", "Verdächtig"]
    : ["Inbox", "Assigned to me", "Unassigned", "Open", "Focused", "Action Queue", "Invite Deck", "Suspicious"]);
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
    const page = renderSidebar([], () => {}, () => {}, {}, { inbox: null, collab: [], virtual }, "en", null,
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
