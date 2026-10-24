import { describe, expect, it } from "bun:test";
import {
  getFolderBadgeKind,
  getFolderBadgeLabel,
  getDraftsFolderCount,
  getFolderCountTitle,
  getFolderTreeCount
} from "./folderBadgePresentation";

describe("folder badge presentation", () => {
  it("renders special folders as icon-only badges", () => {
    const sentFolder = { name: "Sent", specialUse: "\\Sent" };
    const inboxFolder = { name: "INBOX", specialUse: "" };

    expect(getFolderBadgeKind(sentFolder)).toBe("sent");
    expect(getFolderBadgeLabel(sentFolder, sentFolder.name)).toBe("");
    expect(getFolderBadgeKind(inboxFolder)).toBe("inbox");
    expect(getFolderBadgeLabel(inboxFolder, inboxFolder.name)).toBe("");
  });

  it("keeps regular folder names as text labels", () => {
    const folder = { name: "Ukulelen-Stammtisch FFM", specialUse: "" };

    expect(getFolderBadgeKind(folder)).toBe("folder");
    expect(getFolderBadgeLabel(folder, folder.name)).toBe("Ukulelen-Stammtisch FFM");
  });

  it("formats folder count titles from total and unread counts", () => {
    expect(getFolderCountTitle("INBOX", 933, 556, "en")).toBe("INBOX (933 Messages, 556 Unread)");
  });

  it("clamps negative counts to zero", () => {
    expect(getFolderCountTitle("Drafts", -3, -1, "en")).toBe("Drafts (0 Messages, 0 Unread)");
  });

  it("counts drafts by total and every other folder by unread (QA-213)", () => {
    expect(getFolderTreeCount({ specialUse: "\\Drafts", count: 12, unreadCount: 3 })).toEqual({ kind: "drafts", count: 12 });
    expect(getFolderTreeCount({ specialUse: "\\Inbox", count: 12, unreadCount: 3 })).toEqual({ kind: "unread", count: 3 });
    expect(getFolderTreeCount({ specialUse: "", count: 4 })).toEqual({ kind: "unread", count: 0 });
  });

  it("uses one drafts count for the tree and the pinned entry, 0 while the count is unknown", () => {
    const unknown = { specialUse: "\\Drafts", count: null as unknown as number, unreadCount: 0 };
    expect(getDraftsFolderCount(unknown)).toBe(0);
    expect(getFolderTreeCount(unknown)).toEqual({ kind: "drafts", count: getDraftsFolderCount(unknown) });
    expect(getDraftsFolderCount({ count: -2 })).toBe(0);
    expect(getDraftsFolderCount({ count: 7 })).toBe(7);
  });
});
