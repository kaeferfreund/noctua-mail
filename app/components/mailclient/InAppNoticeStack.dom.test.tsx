// Uses the existing happy-dom harness through bun run test:dom.
import { afterEach, describe, expect, it } from "bun:test";
import { act, cleanup, fireEvent, within } from "@testing-library/react";
import { render } from "@/lib/i18n/testRender";
import { Theme } from "@radix-ui/themes";
import { SidebarProvider } from "@/app/components/ui/sidebar";
import ShellSidebar, { type ShellSidebarProps } from "@/app/components/shell/ShellSidebar";
import { resolveNoticePlacement } from "@/app/components/shell/AppShell";
import InAppNoticeStack, { SIDEBAR_NOTICE_LIMIT, type InAppNotice, type InAppNoticePlacement } from "./InAppNoticeStack";

afterEach(() => cleanup());

const notice = (id: string, overrides: Partial<InAppNotice> = {}): InAppNotice => ({
  id, type: "success", title: `Notice ${id}`, expiresAt: null, ...overrides
});

function renderStack(
  notices: InAppNotice[],
  placement: InAppNoticePlacement = "sidebar",
  onDismissNotice: (id: string) => void = () => {}
) {
  return render(
    <InAppNoticeStack
      placement={placement}
      state={{ inAppNotices: notices }}
      actions={{ onOpenNotice: () => {}, onDismissNotice }}
    />
  );
}

// The dismiss animation runs for 140 ms before the notice leaves the state.
const waitForDismissAnimation = () => act(() => new Promise((resolve) => setTimeout(resolve, 200)));

describe("in-app notice stack", () => {
  it("docks in the sidebar only while the desktop sidebar is open", () => {
    expect(resolveNoticePlacement(false, true)).toBe("sidebar");
    expect(resolveNoticePlacement(false, false)).toBe("floating");
    expect(resolveNoticePlacement(true, true)).toBe("floating");
    expect(resolveNoticePlacement(true, false)).toBe("floating");
  });

  it("keeps a polite live region mounted while empty", () => {
    const view = renderStack([]);
    const region = view.getByRole("region", { name: "Notifications" });
    expect(region.getAttribute("aria-live")).toBe("polite");
    expect(region.children).toHaveLength(0);
  });

  it("renders the slim sidebar card with title, subject, Undo and dismiss", async () => {
    const calls: string[] = [];
    const dismissed: string[] = [];
    const view = renderStack(
      [notice("trash", {
        title: "Moved message to Trash.",
        description: "English follow-up",
        actionLabel: "Undo",
        onAction: () => { calls.push("undo"); }
      })],
      "sidebar",
      (id) => dismissed.push(id)
    );
    const region = view.getByRole("region", { name: "Notifications" });
    expect(region.getAttribute("data-placement")).toBe("sidebar");
    // The docked card does not use the global floating toast classes.
    expect(region.querySelector(".inapp-notice")).toBeNull();
    expect(region.querySelector("[data-tone='success']")).not.toBeNull();
    expect(view.getByText("English follow-up")).toBeTruthy();

    fireEvent.click(view.getByRole("button", { name: "Undo" }));
    expect(calls).toEqual(["undo"]);
    await waitForDismissAnimation();
    expect(dismissed).toEqual(["trash"]);
  });

  it("dismisses from the × button without running the action", async () => {
    const calls: string[] = [];
    const dismissed: string[] = [];
    const view = renderStack(
      [notice("a", { actionLabel: "Undo", onAction: () => { calls.push("undo"); } })],
      "sidebar",
      (id) => dismissed.push(id)
    );
    const dismiss = view.getByRole("button", { name: "Dismiss notification" });
    expect(dismiss.tagName).toBe("BUTTON");
    fireEvent.click(dismiss);
    expect(view.container.querySelector("[data-dismissing]")).not.toBeNull();
    await waitForDismissAnimation();
    expect(dismissed).toEqual(["a"]);
    expect(calls).toEqual([]);
  });

  it("shows only the newest notices in the sidebar, newest last (next to the account card)", () => {
    const view = renderStack([notice("1"), notice("2"), notice("3", { type: "error" })]);
    const titles = [...view.container.querySelectorAll("strong")].map((node) => node.textContent);
    expect(titles).toHaveLength(SIDEBAR_NOTICE_LIMIT);
    expect(titles).toEqual(["Notice 2", "Notice 3"]);
  });

  it("keeps the floating toast markup and every notice for the fallback placement", () => {
    const view = renderStack([notice("1"), notice("2"), notice("3", { type: "error" })], "floating");
    expect(view.container.querySelectorAll(".inapp-notice")).toHaveLength(3);
    expect(view.container.querySelector(".inapp-notice-error")).not.toBeNull();
  });

  it("renders the docked notices in the sidebar footer above the account card", () => {
    const props = {
      brand: { buildVersionLabel: "" },
      mailboxes: { accounts: [], activeAccountId: "", onSwitch: () => {}, onAdd: () => {} },
      compose: { onCompose: () => {}, draftsCount: 0, onOpenDrafts: null },
      sync: { isSyncing: false, onCheckNewMail: () => {} },
      user: {
        userEmail: "person@example.test", userName: "Example Person", currentAccount: null,
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
      },
      notices: (
        <InAppNoticeStack
          placement="sidebar"
          state={{ inAppNotices: [notice("docked", { title: "Moved message to Trash." })] }}
          actions={{ onOpenNotice: () => {}, onDismissNotice: () => {} }}
        />
      )
    } satisfies ShellSidebarProps;
    const view = render(<Theme><SidebarProvider><ShellSidebar {...props} /></SidebarProvider></Theme>);
    const footer = view.container.querySelector<HTMLElement>("[data-sidebar='footer']");
    expect(footer).not.toBeNull();
    const region = within(footer!).getByRole("region", { name: "Notifications" });
    const userMenu = within(footer!).getByRole("button", { name: "User menu" });
    expect(region.compareDocumentPosition(userMenu) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(region).getByText("Moved message to Trash.")).toBeTruthy();
  });
});
