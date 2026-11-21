import { describe, expect, it } from "bun:test";
import { domainRecipientListFolderIds, NO_DOMAIN_ROLE_FOLDERS, readDomainRoleFolders } from "./domainView";

const folders = [{ accountId: "acc-a", folderId: "acc-a:Sent" }, { accountId: "acc-b", folderId: "acc-b:Sent" }];

describe("domain list role folders", () => {
  it("keeps the folder ids together with the role of the response", () => {
    expect(readDomainRoleFolders({ role: "sent", folders })).toEqual({ role: "sent", folderIds: ["acc-a:Sent", "acc-b:Sent"] });
    expect(readDomainRoleFolders({ items: [] } as never)).toBe(NO_DOMAIN_ROLE_FOLDERS);
    expect(readDomainRoleFolders(null)).toBe(NO_DOMAIN_ROLE_FOLDERS);
    expect(readDomainRoleFolders({ role: "bogus", folders })).toEqual({ role: null, folderIds: ["acc-a:Sent", "acc-b:Sent"] });
  });

  it("names recipient-list folders only for a Sent or Drafts response", () => {
    expect(domainRecipientListFolderIds(readDomainRoleFolders({ role: "sent", folders }))).toEqual(["acc-a:Sent", "acc-b:Sent"]);
    expect(domainRecipientListFolderIds(readDomainRoleFolders({ role: "drafts", folders: [{ folderId: "acc-b:Drafts" }] })))
      .toEqual(["acc-b:Drafts"]);
    for (const role of ["inbox", "archive", "trash", "spam", "bogus"]) {
      expect(domainRecipientListFolderIds(readDomainRoleFolders({ role, folders: [{ folderId: "acc-b:INBOX" }] }))).toEqual([]);
    }
  });
});
