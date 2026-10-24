import { afterEach, expect, test } from "bun:test";
import { cleanup, fireEvent, waitFor } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { useState } from "react";
import { I18nTestProvider, render } from "@/lib/i18n/testRender";
import { getTranslator } from "@/lib/i18n/translator";
import AccountSettingsModal from "../AccountSettingsModal";
import type { Account } from "@/lib/data";

afterEach(cleanup);
const account: Account = {
  id: "synthetic", avatar: "", email: "user@example.test", name: "Synthetic mailbox", accessRole: "manager",
  imap: { host: "imap.example.test", port: 993, secure: true, user: "user@example.test", password: "" },
  smtp: { host: "smtp.example.test", port: 465, secure: true, user: "user@example.test", password: "" }
};

test("QA-205: Settings open on the selected tab and one Escape closes them", async () => {
  const t = getTranslator("de");
  function Harness() {
    const [open, setOpen] = useState(false);
    return <>
      <button onClick={() => setOpen(true)}>Open settings</button>
      {open && <AccountSettingsModal editingAccount={account} isOpen manageTab="account" isExistingAccount
        onClose={() => setOpen(false)} onTabChange={() => {}} onSave={() => {}} onDelete={() => {}} />}
    </>;
  }
  const page = render(<I18nTestProvider locale="de"><Theme><Harness /></Theme></I18nTestProvider>);
  const opener = page.getByRole("button", { name: "Open settings" });
  opener.focus(); fireEvent.click(opener);
  const dialog = await page.findByRole("dialog", { name: t("Settings.accountTitle") });
  // The close button carries a focus tooltip; starting there made the first Escape close only the tooltip.
  const focused = () => `${document.activeElement?.getAttribute("role") ?? document.activeElement?.tagName}:${document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.textContent}`;
  await waitFor(() => expect(focused()).toBe(`tab:${t("Settings.tabs.account")}`));
  expect(document.querySelectorAll('[data-state="instant-open"], [data-state="delayed-open"]').length).toBe(0);
  fireEvent.keyDown(document.activeElement!, { key: "Escape" });
  await waitFor(() => expect(dialog.isConnected).toBe(false));
  await waitFor(() => expect(focused()).toBe("BUTTON:Open settings"));
});
