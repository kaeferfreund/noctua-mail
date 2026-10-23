import { expect, test } from "bun:test";
import { getFolderDisplayName, getFolderDisplayPath, folderNameMatches } from "./folderNames";

for (const [flag, de, en] of [
  ["Inbox", "Posteingang", "Inbox"], ["Sent", "Gesendet", "Sent"], ["Drafts", "Entwürfe", "Drafts"],
  ["Trash", "Papierkorb", "Trash"], ["Junk", "Spam", "Spam"], ["Spam", "Spam", "Spam"], ["Archive", "Archiv", "Archive"]
]) test(`localizes ${flag} by flag, independently of its IMAP name`, () => {
  const folder = { name: "Synthetic custom protocol name", specialUse: `\\${flag}` };
  expect(getFolderDisplayName(folder, "de")).toBe(de);
  expect(getFolderDisplayName(folder, "en")).toBe(en);
  expect(folder.name).toBe("Synthetic custom protocol name");
  expect(folderNameMatches(folder, de.toLowerCase(), "de")).toBe(true);
  expect(folderNameMatches(folder, "protocol", "de")).toBe(true);
});

test("user names that resemble special folders remain literal without a supported flag", () => {
  for (const name of ["INBOX", "Sent", "Drafts", "Trash", "Junk", "Spam", "Archive", "Synthetic {opaque}"]) {
    for (const specialUse of [undefined, "", "\\Unknown"]) {
      expect(getFolderDisplayName({ name, specialUse }, "de")).toBe(name);
    }
  }
});

test("display paths localize each known ancestor and preserve literal names and missing IDs", () => {
  const folders = [
    { id: "acc:INBOX", accountId: "acc", name: "INBOX", specialUse: "\\Inbox", count: 0 },
    { id: "acc:INBOX/Sent", accountId: "acc", parentId: "acc:INBOX", name: "Sent", count: 0 }
  ];
  const lookup = (id: string) => folders.find(folder => folder.id === id);
  expect(getFolderDisplayPath(folders[0].id, lookup, "de", "acc")).toBe("Posteingang");
  expect(getFolderDisplayPath(folders[1].id, lookup, "de", "acc")).toBe("Posteingang/Sent");
  expect(getFolderDisplayPath(folders[1].id, lookup, "en", "acc")).toBe("Inbox/Sent");
  expect(getFolderDisplayPath("acc:Unknown", lookup, "de", "acc")).toBe("Unknown");
  expect(getFolderDisplayPath("other:Unknown", lookup, "de", "acc")).toBe("other:Unknown");
  expect(folders[0].name).toBe("INBOX");
});
