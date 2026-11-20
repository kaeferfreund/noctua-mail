import { afterEach, expect, test } from "bun:test";
import { cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { I18nTestProvider, render } from "@/lib/i18n/testRender";
import { getTranslator } from "@/lib/i18n/translator";
import AccountSettingsModal from "../AccountSettingsModal";
import type { Account } from "@/lib/data";

afterEach(cleanup);
const mailbox = (id: string, email: string): Account => ({
  id, avatar: "", email, name: id, accessRole: "manager", isOwner: true,
  imap: { host: "imap.example.test", port: 993, secure: true, user: email, password: "" },
  smtp: { host: "smtp.example.test", port: 465, secure: true, user: email, password: "" }
});
const first = mailbox("mailbox-first", "first@example.test");
const second = mailbox("mailbox-second", "second@example.test");

test("A19: the delete confirmation submits the mailbox it names, and a changed target closes it", async () => {
  const t = getTranslator("de");
  const deleted: string[] = [];
  const modal = (account: Account, key?: string) => <I18nTestProvider locale="de"><Theme>
    <AccountSettingsModal key={key} editingAccount={account} isOpen manageTab="account" isExistingAccount
      onClose={() => {}} onTabChange={() => {}} onSave={() => {}} onDelete={id => deleted.push(id)} />
  </Theme></I18nTestProvider>;
  const page = render(modal(first));
  const openConfirm = async () => {
    // A dialog removed while open (not closed) can leave Radix's aria-hidden on the page in jsdom.
    fireEvent.click(await page.findByRole("button", { name: t("Settings.account.delete"), hidden: true }));
    return page.findByRole("dialog", { name: t("Settings.modal.deleteTitle") });
  };
  const confirm = await openConfirm();
  expect(confirm.textContent).toContain(first.email);
  // The parent switches the edited mailbox (history navigation) while the dialog stays mounted.
  page.rerender(modal(second));
  await waitFor(() => expect(confirm.isConnected).toBe(false));
  expect(deleted).toEqual([]);
  // MailClient keys the dialog by mailbox: the new mailbox's confirmation names and submits it.
  page.rerender(modal(second, second.id));
  const again = await openConfirm();
  expect(again.textContent).toContain(second.email);
  expect(again.textContent).not.toContain(first.email);
  fireEvent.click(within(again).getByRole("button", { name: t("Admin.confirm") }));
  expect(deleted).toEqual([second.id]);
});
