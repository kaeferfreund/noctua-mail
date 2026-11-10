import { describe, expect, test } from "bun:test";
import type { Folder } from "@/lib/data";
import { getTranslator } from "@/lib/i18n/translator";
import {
  canEditWithRole,
  groupByAccount,
  partitionByPermission,
  resolveEquivalentFolderId,
  singleAccountOf,
  summarizeMailboxSkips
} from "./mailboxFanOut";

const folder = (accountId: string, path: string, specialUse?: string): Folder =>
  ({ id: `${accountId}:${path}`, accountId, name: path.split("/").pop() ?? path, specialUse, count: 0, unreadCount: 0 }) as Folder;

describe("grouping per mailbox", () => {
  test("keeps first-seen order of mailboxes and messages", () => {
    const groups = groupByAccount([
      { id: "1", accountId: "b" },
      { id: "2", accountId: "a" },
      { id: "3", accountId: "b" },
      { id: "4", accountId: "" }
    ], "a");
    expect(Array.from(groups.keys())).toEqual(["b", "a"]);
    expect(groups.get("b")?.map((item) => item.id)).toEqual(["1", "3"]);
    expect(groups.get("a")?.map((item) => item.id)).toEqual(["2", "4"]);
  });

  test("names the one mailbox of a selection, or none when mixed or empty", () => {
    expect(singleAccountOf([{ accountId: "a" }, { accountId: "a" }])).toBe("a");
    expect(singleAccountOf([{ accountId: "a" }, { accountId: "b" }])).toBeNull();
    expect(singleAccountOf([])).toBeNull();
  });
});

describe("permissions", () => {
  test("editor and manager may change messages, viewer may not, an unknown role is left to the server", () => {
    expect(canEditWithRole("viewer")).toBe(false);
    expect(canEditWithRole("editor")).toBe(true);
    expect(canEditWithRole("manager")).toBe(true);
    expect(canEditWithRole(undefined)).toBe(true);
  });

  test("splits a selection into permitted and skipped messages", () => {
    const roles: Record<string, "viewer" | "editor"> = { a: "editor", b: "viewer" };
    const { allowed, denied } = partitionByPermission(
      [{ id: "1", accountId: "a" }, { id: "2", accountId: "b" }, { id: "3", accountId: "a" }],
      (accountId) => canEditWithRole(roles[accountId])
    );
    expect(allowed.map((item) => item.id)).toEqual(["1", "3"]);
    expect(denied.map((item) => item.id)).toEqual(["2"]);
  });
});

describe("partial results", () => {
  test("counts skipped messages once, per reason and mailbox", () => {
    const summary = summarizeMailboxSkips({
      action: "delete",
      total: 12,
      skipped: [
        { id: "1", accountId: "c", reason: "permission" },
        { id: "2", accountId: "c", reason: "permission" },
        { id: "2", accountId: "c", reason: "permission" },
        { id: "3", accountId: "d", reason: "permission" },
        { id: "4", accountId: "e", reason: "noFolder" }
      ]
    });
    expect(summary).toEqual({
      total: 12,
      skippedCount: 4,
      doneCount: 8,
      reasons: [
        { reason: "permission", count: 3, accountIds: ["c", "d"] },
        { reason: "noFolder", count: 1, accountIds: ["e"] }
      ]
    });
  });

  test("German notice names the action, the count and the mailboxes", () => {
    const t = getTranslator("de");
    const action = t("Notifications.mailboxSkip.action.delete");
    expect(t("Notifications.mailboxSkip.some", {
      action, reason: "permission", mailboxes: "info@example.test", mailboxCount: 1, skipped: 3, total: 12
    })).toBe("3 von 12 Nachrichten wurden nicht gelöscht: keine Berechtigung im Postfach info@example.test.");
    expect(t("Notifications.mailboxSkip.rest", { action })).toBe("Die übrigen wurden gelöscht.");
    expect(t("Notifications.mailboxSkip.all", {
      action, reason: "permission", mailboxes: "info@example.test, team@example.test", mailboxCount: 2, total: 3
    })).toBe("Keine der 3 Nachrichten wurde gelöscht: keine Berechtigung in den Postfächern info@example.test, team@example.test.");
    expect(t("Notifications.mailboxSkip.all", {
      action: t("Notifications.mailboxSkip.action.markRead"), reason: "permission", mailboxes: "info@example.test", mailboxCount: 1, total: 1
    })).toBe("Die Nachricht wurde nicht als gelesen markiert: keine Berechtigung im Postfach info@example.test.");
    expect(t("Notifications.mailboxSkip.some", {
      action: t("Notifications.mailboxSkip.action.move"), reason: "noFolder", mailboxes: "team@example.test", mailboxCount: 1, skipped: 1, total: 4
    })).toBe("1 von 4 Nachrichten wurde nicht verschoben: kein passender Ordner im Postfach team@example.test.");
  });
});

describe("folder of the same role in another mailbox", () => {
  const destination = folder("a", "Archive", "\\Archive");
  const otherFolders = [folder("b", "INBOX", "\\Inbox"), folder("b", "Archiv", "\\Archive"), folder("b", "Projekte")];

  test("the destination itself in its own mailbox", () => {
    expect(resolveEquivalentFolderId({ destination, accountId: "a", accountFolders: [] })).toBe("a:Archive");
  });

  test("the special folder of the same role elsewhere", () => {
    expect(resolveEquivalentFolderId({ destination, accountId: "b", accountFolders: otherFolders })).toBe("b:Archiv");
    expect(resolveEquivalentFolderId({ destination: folder("a", "INBOX", "\\Inbox"), accountId: "b", accountFolders: otherFolders }))
      .toBe("b:INBOX");
  });

  test("no equivalent for a custom folder or a missing role", () => {
    expect(resolveEquivalentFolderId({ destination: folder("a", "Projekte"), accountId: "b", accountFolders: otherFolders })).toBeNull();
    expect(resolveEquivalentFolderId({ destination: folder("a", "Trash", "\\Trash"), accountId: "b", accountFolders: otherFolders }))
      .toBeNull();
  });
});
