import { expect, test } from "bun:test";
import { getFolderDisplayName, folderNameMatches } from "./folderNames";

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
