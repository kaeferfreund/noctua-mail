import type { Account } from "../data";
export function identityTestAccount(id: string = crypto.randomUUID(), ownerUserId?: string): Account {
  return { id, ownerUserId, name: "Synthetic Mailbox", email: "primary@example.test", avatar: "SM",
    imap: { host: "imap.example.test", user: "primary@example.test", password: "synthetic", port: 993, secure: true },
    smtp: { host: "smtp.example.test", user: "primary@example.test", password: "synthetic", port: 465, secure: true } };
}
