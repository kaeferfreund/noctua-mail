import { describe, expect, spyOn, test } from "bun:test";
import { createAuthenticatedTestSession } from "@/lib/testAuthHarness";
import { dbModulePromise } from "@/lib/testDbHarness";
import * as removal from "@/lib/mail/removeMessageAttachment";
import { mailboxErrorResponse } from "@/lib/mailboxFailure";
import { requireActiveUserSession } from "@/lib/auth";
import type { Account, Message } from "@/lib/data";
import { DELETE } from "./route";

describe("attachment removal mailbox failures", () => {
  test.each(["manager", "editor"] as const)("%s receives the role-aware credential DTO without upstream detail", async (role: "manager" | "editor") => {
    const db = await dbModulePromise;
    const accountId = `attachment-${crypto.randomUUID()}`;
    await db.upsertAccount({ id: accountId, name: "Synthetic attachment mailbox", email: "attachment@example.test", avatar: "",
      imap: { host: "imap.example.test", port: 993, secure: true, user: "attachment@example.test", password: "synthetic" },
      smtp: { host: "smtp.example.test", port: 465, secure: true, user: "attachment@example.test", password: "synthetic" }
    } satisfies Account);
    const manager = await createAuthenticatedTestSession(accountId);
    const auth = role === "manager" ? manager : await createAuthenticatedTestSession(accountId);
    if (role === "editor") await db.setUserAccountRole(auth.user.id, accountId, "editor", manager.user.id);
    const folderId = `${accountId}:INBOX`, messageId = `${accountId}-message`, attachmentId = `${accountId}-attachment`;
    await db.saveFoldersForAccount(accountId, [{ id: folderId, accountId, name: "Inbox", count: 0 }]);
    await db.upsertMessages(accountId, folderId, [{ id: messageId, accountId, folderId, threadId: messageId,
      subject: "Synthetic attachment", from: "sender@example.test", to: "attachment@example.test", preview: "", body: "Synthetic body",
      date: new Date(1000000).toISOString(), dateValue: 1000000, imapUid: 42, mailboxPath: "INBOX",
      attachments: [{ id: attachmentId, filename: "synthetic.txt", contentType: "text/plain", size: 5, inline: false }]
    } satisfies Message], true, { recomputeThreads: false });
    const error = Object.assign(new Error("Synthetic upstream detail that must remain private"), { authenticationFailed: true, serverResponseCode: "AUTHENTICATIONFAILED" });
    const remove = spyOn(removal, "removeMessageAttachmentEverywhere").mockRejectedValue(error);
    try {
      const response = await DELETE(new Request(`http://localhost:3000/api/accounts/${accountId}/messages/${messageId}/attachments/${attachmentId}`, {
        method: "DELETE", headers: auth.jar.headers({ origin: "http://localhost:3000" })
      }), { params: Promise.resolve({ accountId, messageId, attachmentId }) });
      expect(remove).toHaveBeenCalledTimes(1);
      expect(response.status).toBe(503);
      const dto = await response.json();
      expect(dto).toEqual(await (await mailboxErrorResponse(error, accountId, role))!.json());
      expect(dto.repairAllowed).toBe(role === "manager");
      expect(dto.reauthRequired).toBe(role === "manager");
      if (role === "editor") expect(dto.managerContact).toEqual([{ name: manager.user.name, email: manager.user.email }]);
      expect(JSON.stringify(dto)).not.toContain("upstream detail");
      expect(await requireActiveUserSession(new Request("http://localhost:3000", { headers: auth.jar.headers() }))).not.toBeInstanceOf(Response);
    } finally { remove.mockRestore(); }
  });
});
