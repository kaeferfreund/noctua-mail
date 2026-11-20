import { afterEach, describe, expect, it } from "bun:test";
import { clearRecentMoveFolders, getRecentMoveFolderIds, recordRecentMoveFolder } from "./recentMoveFolders";
import { clearSignedOutBrowserState } from "@/lib/browserUserState";
import { openDetachedWindow } from "@/lib/ui/openDetachedWindow";

// SD50, SD55: recent move destinations belong to the signed-in user, not to the shared mailbox.
afterEach(() => { localStorage.clear(); });

describe("recent move destinations", () => {
  it("are the signed-in user's own, also in a shared mailbox", () => {
    recordRecentMoveFolder("user-a", "shared-mailbox", "shared-mailbox:Private/Project");
    expect(getRecentMoveFolderIds("user-a", "shared-mailbox")).toEqual(["shared-mailbox:Private/Project"]);
    expect(getRecentMoveFolderIds("user-b", "shared-mailbox")).toEqual([]);
    recordRecentMoveFolder("user-b", "shared-mailbox", "shared-mailbox:Archive");
    expect(getRecentMoveFolderIds("user-b", "shared-mailbox")).toEqual(["shared-mailbox:Archive"]);
    expect(localStorage.getItem("noctua:recent-move-folders:v2")).not.toContain("Private/Project");
  });
  it("are neither read nor stored without a signed-in user", () => {
    recordRecentMoveFolder(null, "shared-mailbox", "shared-mailbox:Archive");
    expect(localStorage.length).toBe(0);
    expect(getRecentMoveFolderIds(undefined, "shared-mailbox")).toEqual([]);
  });
  it("drop the legacy mailbox-only history", () => {
    localStorage.setItem("noctua-recent-move-folders", JSON.stringify({ "shared-mailbox": ["shared-mailbox:Private/Project"] }));
    expect(getRecentMoveFolderIds("user-b", "shared-mailbox")).toEqual([]);
    expect(localStorage.getItem("noctua-recent-move-folders")).toBeNull();
  });
  it("are removed at sign-out", async () => {
    recordRecentMoveFolder("user-a", "shared-mailbox", "shared-mailbox:Archive");
    await clearSignedOutBrowserState();
    expect(getRecentMoveFolderIds("user-a", "shared-mailbox")).toEqual([]);
    clearRecentMoveFolders();
  });
});

describe("sign-out and detached windows", () => {
  it("closes the windows this window opened (SD23)", async () => {
    const original = window.open;
    const closed: string[] = [];
    const fake = (name: string) => ({ closed: false, opener: {}, focus() {}, close() { closed.push(name); this.closed = true; } });
    let next = 0;
    window.open = (() => fake(`window-${++next}`)) as unknown as typeof window.open;
    try {
      openDetachedWindow("/message/window?accountId=synthetic&messageId=synthetic");
      openDetachedWindow("/compose/window?handoff=synthetic");
      await clearSignedOutBrowserState();
      expect(closed).toEqual(["window-1", "window-2"]);
      await clearSignedOutBrowserState();
      expect(closed).toHaveLength(2);
    } finally {
      window.open = original;
    }
  });
});
