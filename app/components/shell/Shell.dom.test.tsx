// Uses the existing happy-dom harness through bun run test:dom.
import { afterEach, describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { act, cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import { Theme, Button as KeptButton } from "@radix-ui/themes";
import { ThemeProvider } from "next-themes";
import { Sheet, SheetContent, SheetTitle } from "@/app/components/ui/sheet";
import { SidebarProvider } from "@/app/components/ui/sidebar";
import type { ShellAccount } from "./types";
import ShellSidebar, { type ShellSidebarProps } from "./ShellSidebar";
import ShellPanes from "./ShellPanes";
import { ThemeToggle } from "./ShellHeader";

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

function renderSidebar(accounts: ShellAccount[], onSwitch: (id: string) => void, onSync = () => {}) {
  const props: ShellSidebarProps = {
    brand: { buildVersionLabel: "" },
    mailboxes: { accounts, activeAccountId: accounts[0]?.id ?? "", onSwitch, onAdd: () => {} },
    compose: { onCompose: () => {}, draftsCount: 0, onOpenDrafts: null },
    sync: { isSyncing: false, onCheckNewMail: onSync },
    user: {
      userEmail: "person@example.test", userName: "Example Person", currentAccount: accounts[0] ?? null,
      isAdminUser: false, onOpenSettings: () => {}, onOpenAdmin: () => {},
      onShowThreadJson: () => {}, onEvictThreadCache: () => {}, onLogout: () => {}
    },
    views: { inbox: null, collab: [], virtual: [] },
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
  return render(<Theme><SidebarProvider><ShellSidebar {...props} /></SidebarProvider></Theme>);
}

describe("shell sidebar", () => {
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
